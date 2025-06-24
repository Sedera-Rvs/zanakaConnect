import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { getEnfants, getAbsencesEleve, justifierAbsence } from '../../../services/api';

export default function AbsencesScreen({ navigation }) {
  const [enfants, setEnfants] = useState([]);
  const [selectedEnfant, setSelectedEnfant] = useState(null);
  const [absences, setAbsences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('current'); // 'current' ou 'history'
  const [justificationModalVisible, setJustificationModalVisible] = useState(false);
  const [selectedAbsence, setSelectedAbsence] = useState(null);
  const [justificationText, setJustificationText] = useState('');

  useEffect(() => {
    loadEnfants();
  }, []);

  useEffect(() => {
    if (selectedEnfant) {
      loadAbsences(selectedEnfant.id);
    }
  }, [selectedEnfant]);

  const loadEnfants = async () => {
    try {
      setLoading(true);
      // Charger les enfants depuis l'API
      const response = await getEnfants();
      
      if (!response || !Array.isArray(response) || response.length === 0) {
        console.warn('Aucun enfant trouvé');
        setEnfants([]);
        return;
      }
      
      // Formater les données des enfants pour inclure correctement les informations de classe
      const formattedEnfants = response.map(enfant => ({
        ...enfant,
        // Assurer que les informations de classe sont correctement formatées
        classe: enfant.classe_details || enfant.classe || { id: null, nom: 'Classe non spécifiée' }
      }));
      
      console.log('Enfants formatés:', formattedEnfants);
      setEnfants(formattedEnfants);
      
      // Sélectionner automatiquement le premier enfant
      if (formattedEnfants.length > 0) {
        handleSelectEnfant(formattedEnfants[0]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des enfants:', error);
      Alert.alert('Erreur', 'Impossible de charger la liste des enfants');
      setEnfants([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAbsences = async (enfantId) => {
    try {
      setLoading(true);
      const response = await getAbsencesEleve(enfantId);
      console.log(`Absences chargées pour l'élève ${enfantId}:`, response);
      
      // Formater les données d'absence en utilisant les nouveaux champs du sérialiseur
      const formattedAbsences = response.map(absence => {
        // Utiliser les détails de l'enseignant si disponibles
        const enseignantNom = absence.enseignant_details?.nom || (absence.enseignant?.nom || '');
        const enseignantPrenom = absence.enseignant_details?.prenom || (absence.enseignant?.prenom || '');
        const enseignantDisplay = enseignantNom ? `${enseignantPrenom} ${enseignantNom}` : 'Non spécifié';
        
        // Utiliser les détails de la matière si disponibles
        const matiereNom = absence.matiere_details?.nom || (absence.matiere?.nom || 'Non spécifié');
        
        return {
          id: absence.id.toString(),
          date: new Date(absence.date),
          type: absence.type || 'absence',
          justification: absence.justification || '',
          enseignant: enseignantDisplay,
          matiere: matiereNom,
          justifiee: absence.justifiee || false,
          mois: new Date(absence.date).toLocaleDateString('fr-FR', { month: 'long' }),
          trimestre: getTrimestre(new Date(absence.date)),
        };
      });
      
      // Trier les absences par date (les plus récentes d'abord)
      formattedAbsences.sort((a, b) => b.date - a.date);
      
      setAbsences(formattedAbsences);
    } catch (error) {
      console.error('Erreur lors du chargement des absences:', error);
      Alert.alert('Erreur', 'Impossible de charger les absences');
    } finally {
      setLoading(false);
    }
  };
  
  // Déterminer le trimestre en fonction de la date
  const getTrimestre = (date) => {
    const mois = date.getMonth() + 1; // getMonth() retourne 0-11
    if (mois >= 9 && mois <= 12) return 'Trimestre 1';
    if (mois >= 1 && mois <= 3) return 'Trimestre 2';
    return 'Trimestre 3';
  };
  
  // Filtrer les absences en fonction de l'onglet actif
  const getFilteredAbsences = () => {
    const currentDate = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    if (activeTab === 'current') {
      // Absences du mois en cours
      return absences.filter(absence => absence.date >= oneMonthAgo);
    } else {
      // Historique des absences (plus d'un mois)
      return absences.filter(absence => absence.date < oneMonthAgo);
    }
  };
  
  // Grouper les absences par trimestre pour l'historique
  const getGroupedAbsences = () => {
    const filteredAbsences = getFilteredAbsences();
    
    if (activeTab === 'current') {
      return { 'Mois en cours': filteredAbsences };
    } else {
      // Grouper par trimestre
      return filteredAbsences.reduce((groups, absence) => {
        const key = absence.trimestre;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(absence);
        return groups;
      }, {});
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (selectedEnfant) {
      await loadAbsences(selectedEnfant.id);
    }
    setRefreshing(false);
  };

  const handleSelectEnfant = (enfant) => {
    setSelectedEnfant(enfant);
  };
  
  const handleOpenJustificationModal = (absence) => {
    setSelectedAbsence(absence);
    setJustificationText('');
    setJustificationModalVisible(true);
  };
  
  const handleCloseJustificationModal = () => {
    setJustificationModalVisible(false);
    setSelectedAbsence(null);
    setJustificationText('');
  };
  
  const handleSubmitJustification = async () => {
    if (!selectedAbsence || !justificationText.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer une justification');
      return;
    }
    
    try {
      setLoading(true);
      await justifierAbsence(selectedAbsence.id, justificationText);
      
      // Recharger les absences depuis le serveur pour refléter le nouveau statut
      if (selectedEnfant) {
        await loadAbsences(selectedEnfant.id);
      }
      
      handleCloseJustificationModal();
      Alert.alert('Succès', 'Justification envoyée avec succès');
    } catch (error) {
      console.error('Erreur lors de la justification:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer la justification. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    try {
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch (error) {
      console.error('Erreur de formatage de date:', error);
      return 'Date inconnue';
    }
  };

  const formatTime = (date) => {
    try {
      return date.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      console.error('Erreur de formatage d\'heure:', error);
      return 'Heure inconnue';
    }
  };

  const renderEnfantItem = ({ item }) => {
    // Déterminer le nom de la classe en vérifiant toutes les sources possibles
    let classeNom = 'Classe non spécifiée';
    
    // Vérifier d'abord dans classe (formaté par loadEnfants)
    if (item.classe && item.classe.nom) {
      classeNom = item.classe.nom;
    }
    // Sinon, vérifier dans classe_details
    else if (item.classe_details && item.classe_details.nom) {
      classeNom = item.classe_details.nom;
    }
    
    return (
      <TouchableOpacity
        style={[
          styles.enfantCard,
          selectedEnfant?.id === item.id && styles.selectedEnfantCard,
        ]}
        onPress={() => handleSelectEnfant(item)}
      >
        <Text style={styles.enfantName}>
          {item.prenom} {item.nom}
        </Text>
        <Text style={styles.enfantClasse}>{classeNom}</Text>
      </TouchableOpacity>
    );
  };

  const renderAbsenceItem = ({ item }) => (
    <View style={styles.absenceCard}>
      <View style={styles.absenceHeader}>
        <View style={styles.absenceTypeContainer}>
          <View 
            style={[
              styles.absenceTypeBadge, 
              item.type === 'absence' ? styles.absenceBadge : styles.retardBadge
            ]}
          >
            <Text style={styles.absenceTypeText}>
              {item.type === 'absence' ? 'Absence' : 'Retard'}
            </Text>
          </View>
          {item.justifiee && (
            <View style={styles.justifiedBadge}>
              <Text style={styles.justifiedText}>Justifiée</Text>
            </View>
          )}
        </View>
        <Text style={styles.absenceDate}>
          {formatDate(item.date)} à {formatTime(item.date)}
        </Text>
      </View>
      <View style={styles.absenceDetails}>
        <Text style={styles.absenceMatiere}>{item.matiere}</Text>
        <Text style={styles.absenceEnseignant}>Enseignant: {item.enseignant}</Text>
        
        {item.justification ? (
          <View style={styles.justificationContainer}>
            <Text style={styles.justificationLabel}>Justification:</Text>
            <Text style={styles.justificationText}>{item.justification}</Text>
          </View>
        ) : !item.justifiee && (
          <TouchableOpacity 
            style={styles.justifyButton}
            onPress={() => handleOpenJustificationModal(item)}
          >
            <Text style={styles.justifyButtonText}>Justifier</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // Rendu de l'historique des absences par période
  const renderHistorySection = ({ item }) => (
    <View style={styles.historySection}>
      <Text style={styles.historySectionTitle}>{item[0]}</Text>
      {item[1].length > 0 ? (
        item[1].map(absence => renderAbsenceItem({ item: absence }))
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Aucune absence pour cette période</Text>
        </View>
      )}
    </View>
  );

  // Calculer les statistiques des absences et retards pour l'élève sélectionné
  const totalAbsences = absences.filter(absence => absence.type === 'absence').length;
  const totalRetards = absences.filter(absence => absence.type === 'retard').length;
  const absencesNonJustifiees = absences.filter(absence => absence.type === 'absence' && !absence.justifiee).length;
  const retardsNonJustifies = absences.filter(absence => absence.type === 'retard' && !absence.justifiee).length;
  const absencesJustifiees = absences.filter(absence => absence.type === 'absence' && absence.justifiee).length;
  const retardsJustifies = absences.filter(absence => absence.type === 'retard' && absence.justifiee).length;

  return (
    <View style={styles.container}>
      {/* Modal de justification */}
      <Modal
        visible={justificationModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseJustificationModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Justifier l'absence</Text>
            
            <TextInput
              style={styles.justificationInput}
              placeholder="Saisissez votre justification ici..."
              multiline={true}
              numberOfLines={4}
              value={justificationText}
              onChangeText={setJustificationText}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleCloseJustificationModal}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleSubmitJustification}
              >
                <Text style={styles.submitButtonText}>Envoyer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
        </View>
      ) : (
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Absences et retards</Text>
          </View>
          
          <View style={styles.enfantsContainer}>
            <Text style={styles.sectionTitle}>Mes enfants</Text>
            <FlatList
              data={enfants}
              renderItem={renderEnfantItem}
              keyExtractor={(item) => item.id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.enfantsList}
            />
          </View>
          
          <View style={styles.absencesContainer}>
            <View style={styles.absencesHeader}>
              <Text style={styles.sectionTitle}>
                Absences et retards
              </Text>
              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {totalAbsences}
                  </Text>
                  <Text style={styles.statLabel}>Absences</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {totalRetards}
                  </Text>
                  <Text style={styles.statLabel}>Retards</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {absencesJustifiees + retardsJustifies}
                  </Text>
                  <Text style={styles.statLabel}>Justifiés</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {absencesNonJustifiees + retardsNonJustifies}
                  </Text>
                  <Text style={styles.statLabel}>Non justifiés</Text>
                </View>
              </View>
            </View>
            
            {/* Onglets pour basculer entre les absences actuelles et l'historique */}
            <View style={styles.tabContainer}>
              <TouchableOpacity 
                style={[styles.tabButton, activeTab === 'current' && styles.activeTabButton]}
                onPress={() => setActiveTab('current')}
              >
                <Text style={[styles.tabButtonText, activeTab === 'current' && styles.activeTabButtonText]}>
                  Voir mois
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tabButton, activeTab === 'history' && styles.activeTabButton]}
                onPress={() => setActiveTab('history')}
              >
                <Text style={[styles.tabButtonText, activeTab === 'history' && styles.activeTabButtonText]}>
                  Historique
                </Text>
              </TouchableOpacity>
            </View>
            
            {activeTab === 'current' ? (
              // Affichage des absences du mois en cours
              <FlatList
                data={getFilteredAbsences()}
                renderItem={renderAbsenceItem}
                keyExtractor={(item) => item.id.toString()}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                  />
                }
                style={styles.absencesList}
                contentContainerStyle={getFilteredAbsences().length === 0 && { flex: 1, justifyContent: 'center' }}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>Aucune absence enregistrée ce mois-ci</Text>
                  </View>
                }
              />
            ) : (
              // Affichage de l'historique des absences par trimestre
              <FlatList
                data={Object.entries(getGroupedAbsences())}
                keyExtractor={(item) => item[0]}
                renderItem={renderHistorySection}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                  />
                }
                style={styles.absencesList}
                contentContainerStyle={Object.keys(getGroupedAbsences()).length === 0 && { flex: 1, justifyContent: 'center' }}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>Aucune absence dans l'historique</Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  enfantsContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  enfantsList: {
    paddingBottom: 8,
  },
  enfantCard: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    marginRight: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  selectedEnfantCard: {
    backgroundColor: '#e6f2ff',
    borderColor: '#0066cc',
    borderWidth: 1,
  },
  enfantName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  enfantClasse: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  absencesContainer: {
    flex: 1,
    padding: 16,
  },
  absencesHeader: {
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  absencesList: {
    paddingBottom: 16,
  },
  absenceCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  absenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  absenceTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  absenceTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  absenceBadge: {
    backgroundColor: '#ffcdd2',
  },
  retardBadge: {
    backgroundColor: '#fff9c4',
  },
  absenceTypeText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  justifiedBadge: {
    backgroundColor: '#c8e6c9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  justifiedText: {
    color: '#2e7d32',
    fontWeight: 'bold',
    fontSize: 14,
  },
  absenceDate: {
    fontSize: 14,
    color: '#666',
  },
  absenceDetails: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 12,
  },
  absenceMatiere: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  absenceEnseignant: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  justificationContainer: {
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  justificationLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  justificationText: {
    fontSize: 14,
    color: '#333',
    fontStyle: 'italic',
  },
  justifyButton: {
    backgroundColor: '#0066cc',
    padding: 8,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 8,
  },
  justifyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  // Styles pour les onglets
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#e0e0e0',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  activeTabButton: {
    backgroundColor: '#0066cc',
  },
  tabButtonText: {
    fontWeight: 'bold',
    color: '#333',
  },
  activeTabButtonText: {
    color: '#fff',
  },
  // Styles pour l'historique
  historySection: {
    marginBottom: 24,
  },
  historySectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    backgroundColor: '#e6f2ff',
    padding: 8,
    borderRadius: 4,
  },
  // Styles pour la modal de justification
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#333',
  },
  justificationInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 12,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: '#0066cc',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
