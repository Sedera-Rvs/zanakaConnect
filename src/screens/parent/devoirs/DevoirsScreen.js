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
} from 'react-native';
import { getEnfants, getDevoirsEleve } from '../../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function DevoirsScreen({ navigation }) {
  const [enfants, setEnfants] = useState([]);
  const [selectedEnfant, setSelectedEnfant] = useState(null);
  const [devoirs, setDevoirs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadEnfants();
  }, []);

  useEffect(() => {
    if (selectedEnfant) {
      loadDevoirs(selectedEnfant.id);
    }
  }, [selectedEnfant]);

  const loadEnfants = async () => {
    try {
      setLoading(true);
      const response = await getEnfants();
      console.log('Enfants récupérés:', response);
      
      if (!response || !Array.isArray(response) || response.length === 0) {
        console.warn('Aucun enfant trouvé');
        setEnfants([]);
        return;
      }
      
      const formattedEnfants = response.map(enfant => ({
        ...enfant,
        classe: enfant.classe_details || enfant.classe || { id: null, nom: 'Classe non spécifiée' }
      }));
      
      console.log('Enfants formatés:', formattedEnfants);
      setEnfants(formattedEnfants);
      
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

  // Clé pour stocker les devoirs vus dans AsyncStorage
  const getViewedDevoirsKey = (enfantId) => `viewed_devoirs_${enfantId}`;
  
  // Charger les devoirs depuis l'API
  const loadDevoirs = async (enfantId) => {
    try {
      setLoading(true);
      
      if (!enfantId) {
        console.warn('ID de l\'enfant non défini');
        setDevoirs([]);
        return;
      }
      
      // Récupérer l'élève sélectionné pour avoir son ID de classe
      const enfant = enfants.find(e => e.id === enfantId);
      console.log('Enfant sélectionné:', enfant);
      
      if (!enfant) {
        console.warn('Enfant non trouvé');
        setDevoirs([]);
        return;
      }
      
      // Déterminer l'ID de classe en vérifiant toutes les sources possibles
      let classeId = null;
      
      // Vérifier d'abord dans classe (formaté par loadEnfants)
      if (enfant.classe && enfant.classe.id) {
        classeId = enfant.classe.id;
      }
      // Sinon, vérifier dans classe_details
      else if (enfant.classe_details && enfant.classe_details.id) {
        classeId = enfant.classe_details.id;
      }
      // Enfin, vérifier le champ classe original
      else if (typeof enfant.classe === 'number') {
        classeId = enfant.classe;
      }
      
      if (!classeId) {
        console.warn('Impossible de déterminer l\'ID de classe pour l\'enfant:', enfant);
        setDevoirs([]);
        return;
      }
      
      // Charger les devoirs de la classe de l'élève
      console.log('Chargement des devoirs pour la classe ID:', classeId);
      const response = await getDevoirsEleve(classeId);
      console.log('Devoirs récupérés:', response);
      
      if (!response || !Array.isArray(response)) {
        console.warn('Format de réponse des devoirs incorrect:', response);
        setDevoirs([]);
        return;
      }
      
      // Récupérer les IDs des devoirs déjà vus
      const viewedDevoirsKey = getViewedDevoirsKey(enfantId);
      const viewedDevoirsJson = await AsyncStorage.getItem(viewedDevoirsKey);
      const viewedDevoirs = viewedDevoirsJson ? JSON.parse(viewedDevoirsJson) : [];
      
      // Formater les devoirs et marquer ceux qui n'ont pas été vus
      const formattedDevoirs = response.map(devoir => {
        console.log('Traitement du devoir:', devoir);
        console.log('Matière details:', devoir.matiere_details, 'Matière:', devoir.matiere);
        console.log('Full devoir object:', JSON.stringify(devoir, null, 2));
        return {
          id: devoir.id.toString(),
          titre: devoir.titre,
          description: devoir.description,
          matiere: devoir.matiere_details?.nom || devoir.matiere?.nom || 'Matière non spécifiée',
          enseignant: devoir.enseignant_details ? 
            `${devoir.enseignant_details.prenom || ''} ${devoir.enseignant_details.nom || ''}` : 
            'Enseignant non spécifié',
          date_creation: devoir.date_creation ? new Date(devoir.date_creation) : new Date(),
          date_remise: devoir.date_remise ? new Date(devoir.date_remise) : new Date(),
          classe: devoir.classe_details || { id: '', nom: 'Classe non spécifiée' },
          vu: viewedDevoirs.includes(devoir.id.toString())
        };
      });
      
      // Sort homework by creation date from most recent to oldest
      formattedDevoirs.sort((a, b) => b.date_creation - a.date_creation);
      
      console.log('Devoirs formatés:', formattedDevoirs);
      
      setDevoirs(formattedDevoirs);
    } catch (error) {
      console.error('Erreur lors du chargement des devoirs:', error);
      Alert.alert('Erreur', 'Impossible de charger les devoirs');
      setDevoirs([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadEnfants();
      if (selectedEnfant) {
        await loadDevoirs(selectedEnfant.id);
      }
    } catch (error) {
      console.error('Erreur lors du rafraîchissement:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSelectEnfant = (enfant) => {
    setSelectedEnfant(enfant);
  };

  const formatDate = (date) => {
    try {
      if (!(date instanceof Date) || isNaN(date)) {
        return 'Date inconnue';
      }
      
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

  const getDaysRemaining = (dateRemise) => {
    const today = new Date();
    const diffTime = dateRemise - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
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
    
    console.log(`Enfant: ${item.prenom} ${item.nom}, Classe: ${classeNom}`);
    
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

  // Marquer un devoir comme vu
  const markDevoirAsViewed = async (devoirId) => {
    try {
      if (!selectedEnfant) return;
      
      const viewedDevoirsKey = getViewedDevoirsKey(selectedEnfant.id);
      const viewedDevoirsJson = await AsyncStorage.getItem(viewedDevoirsKey);
      const viewedDevoirs = viewedDevoirsJson ? JSON.parse(viewedDevoirsJson) : [];
      
      if (!viewedDevoirs.includes(devoirId)) {
        const updatedViewedDevoirs = [...viewedDevoirs, devoirId];
        await AsyncStorage.setItem(viewedDevoirsKey, JSON.stringify(updatedViewedDevoirs));
        
        // Mettre à jour l'état local
        setDevoirs(prevDevoirs => 
          prevDevoirs.map(devoir => 
            devoir.id === devoirId ? { ...devoir, vu: true } : devoir
          )
        );
      }
    } catch (error) {
      console.error('Erreur lors du marquage du devoir comme vu:', error);
    }
  };
  
  // Afficher les détails d'un devoir
  const handleViewDevoirDetails = (devoir) => {
    // Marquer le devoir comme vu
    if (!devoir.vu) {
      markDevoirAsViewed(devoir.id);
      // Mettre à jour l'état local
      setDevoirs(prevDevoirs => 
        prevDevoirs.map(d => 
          d.id === devoir.id ? { ...d, vu: true } : d
        )
      );
    }
    
    // Déterminer le statut du devoir
    const daysRemaining = getDaysRemaining(devoir.date_remise);
    let statusText;
    if (daysRemaining < 0) {
      statusText = 'En retard';
    } else if (daysRemaining <= 2) {
      statusText = `Urgent (${daysRemaining} jours restants)`;
    } else {
      statusText = `${daysRemaining} jours restants`;
    }
    
    // Afficher les détails
    Alert.alert(
      devoir.titre,
      `Matière: ${devoir.matiere}\n\n` +
      `Description: ${devoir.description}\n\n` +
      `Enseignant: ${devoir.enseignant}\n` +
      `Classe: ${devoir.classe?.nom || 'Non spécifiée'}\n` +
      `Date de remise: ${formatDate(devoir.date_remise)}\n` +
      `Statut: ${statusText}`,
      [{ text: 'Fermer', style: 'cancel' }]
    );
  };

  const renderDevoirItem = ({ item }) => {
    const daysRemaining = getDaysRemaining(item.date_remise);
    let statusStyle, statusText;

    if (daysRemaining < 0) {
      statusStyle = styles.statusOverdue;
      statusText = 'En retard';
    } else if (daysRemaining <= 2) {
      statusStyle = styles.statusUrgent;
      statusText = `Urgent (${daysRemaining} j)`;
    } else {
      statusStyle = styles.statusNormal;
      statusText = `${daysRemaining} jours`;
    }

    return (
      <View style={[styles.devoirCard, !item.vu && styles.devoirCardNew]}>
        {!item.vu && <View style={styles.newBadge}><Text style={styles.newBadgeText}>NOUVEAU</Text></View>}
        <View style={styles.devoirHeader}>
          <View style={styles.devoirTitleContainer}>
            <Text style={styles.devoirTitle}>{item.titre}</Text>
          </View>
          <View style={[styles.statusBadge, statusStyle]}>
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        </View>
        <Text style={styles.devoirDescription}>{item.description}</Text>
        <View style={styles.devoirFooter}>
          <View style={styles.devoirInfo}>
            <Text style={styles.devoirEnseignant}>{item.enseignant}</Text>
            <Text style={styles.devoirDate}>À rendre pour le: {formatDate(item.date_remise)}</Text>
          </View>
          <TouchableOpacity 
            style={styles.detailsButton}
            onPress={() => handleViewDevoirDetails(item)}
          >
            <Text style={styles.detailsButtonText}>Détails</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading && enfants.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Devoirs et Examens</Text>
      </View>

      <View style={styles.enfantsContainer}>
        <Text style={styles.sectionTitle}>Mes enfants</Text>
        <FlatList
          data={enfants}
          renderItem={renderEnfantItem}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.enfantsList}
        />
      </View>

      {selectedEnfant && (
        <View style={styles.devoirsContainer}>
          <View style={styles.devoirsHeader}>
            <Text style={styles.sectionTitle}>
              Devoirs de {selectedEnfant.prenom} {selectedEnfant.nom}
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0066cc" />
            </View>
          ) : (
            <FlatList
              data={devoirs.sort((a, b) => a.date_remise - b.date_remise)}
              renderItem={renderDevoirItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.devoirsList}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Aucun devoir pour le moment</Text>
                </View>
              }
            />
          )}
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
  devoirsContainer: {
    flex: 1,
    padding: 16,
  },
  devoirsHeader: {
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  devoirsList: {
    paddingBottom: 16,
  },
  devoirCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    position: 'relative',
  },
  devoirCardNew: {
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
  },
  newBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#4caf50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    zIndex: 1,
  },
  newBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  devoirHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  devoirTitleContainer: {
    flex: 1,
    marginRight: 8,
  },
  devoirTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  devoirMatiere: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  statusNormal: {
    backgroundColor: '#e3f2fd',
  },
  statusUrgent: {
    backgroundColor: '#fff3e0',
  },
  statusOverdue: {
    backgroundColor: '#ffebee',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  devoirDescription: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  devoirFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  devoirInfo: {
    flex: 1,
  },
  devoirEnseignant: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  devoirDate: {
    fontSize: 14,
    color: '#666',
  },
  detailsButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  detailsButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
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
});
