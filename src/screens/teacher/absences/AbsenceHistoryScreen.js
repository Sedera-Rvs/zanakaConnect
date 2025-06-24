import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAbsencesByClasse, deleteAbsence } from '../../../services/api';

export default function AbsenceHistoryScreen({ route, navigation }) {
  const { classeId, className } = route.params;
  const [absences, setAbsences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // États pour la suppression
  const [deletingAbsenceId, setDeletingAbsenceId] = useState(null);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [absenceToDelete, setAbsenceToDelete] = useState(null);

  useEffect(() => {
    loadAbsences();
  }, [classeId]);

  const loadAbsences = async () => {
    try {
      setLoading(true);
      // Charger les absences depuis l'API pour la classe spécifiée
      const response = await getAbsencesByClasse(classeId);
      console.log(`Absences chargées pour la classe ${classeId}:`, response);
      
      // Formater les données pour s'assurer que les détails des matières sont correctement traités
      const formattedAbsences = response.map(absence => ({
        ...absence,
        // Utiliser les détails de la matière si disponibles
        matiere_details: absence.matiere_details || 
                        (absence.matiere ? { 
                          id: absence.matiere.id || absence.matiere,
                          nom: absence.matiere.nom || 'Non spécifiée',
                          code: absence.matiere.code || ''
                        } : null)
      }));
      
      console.log('Absences formatées:', formattedAbsences);
      setAbsences(formattedAbsences);
    } catch (error) {
      console.error('Erreur lors du chargement des absences:', error);
      Alert.alert(
        'Erreur',
        'Impossible de charger l\'historique des absences. Veuillez réessayer.'
      );
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAbsences();
    setRefreshing(false);
  };

  // Fonction pour initialiser la suppression d'une absence
  const handleDeleteAbsence = (absence, studentName) => {
    console.log(`Demande de confirmation pour supprimer l'absence ${absence.id}`);
    // Stocker les informations de l'absence à supprimer
    setAbsenceToDelete({
      id: absence.id,
      studentName: studentName,
      type: absence.type,
      date: absence.date,
      matiere: absence.matiere_details?.nom || 'Non spécifiée'
    });
    // Afficher le modal de confirmation
    setConfirmModalVisible(true);
  };

  // Fonction pour effectuer la suppression après confirmation
  const confirmDeleteAbsence = async () => {
    if (!absenceToDelete) return;
    
    try {
      setDeletingAbsenceId(absenceToDelete.id);
      console.log(`Suppression de l'absence ${absenceToDelete.id}...`);
      
      // Appeler l'API pour supprimer l'absence
      const result = await deleteAbsence(absenceToDelete.id);
      console.log('Résultat de la suppression:', result);
      
      // Mettre à jour la liste des absences localement
      setAbsences(prevAbsences => 
        prevAbsences.filter(absence => absence.id !== absenceToDelete.id)
      );
      
      // Fermer le modal et réinitialiser les états
      setConfirmModalVisible(false);
      setAbsenceToDelete(null);
      
      // Afficher un message de confirmation
      Alert.alert(
        'Succès', 
        `${absenceToDelete.type === 'absence' ? 'L\'absence' : 'Le retard'} a été supprimé(e) avec succès.`
      );
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      Alert.alert(
        'Erreur', 
        `Impossible de supprimer ${absenceToDelete.type === 'absence' ? 'l\'absence' : 'le retard'}. ${error.message || 'Veuillez réessayer.'}`
      );
    } finally {
      setDeletingAbsenceId(null);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const renderAbsenceItem = ({ item }) => {
    // Utiliser les détails de l'élève si disponibles, sinon utiliser l'objet élève directement
    const eleveNom = item.eleve_details?.nom || (item.eleve?.nom || 'Inconnu');
    const elevePrenom = item.eleve_details?.prenom || (item.eleve?.prenom || '');
    const studentName = `${elevePrenom} ${eleveNom}`;
    
    // Utiliser les détails de la matière si disponibles
    const matiereName = item.matiere_details?.nom || (item.matiere?.nom || 'Non spécifiée');
    
    // Vérifier si cette absence est en cours de suppression
    const isDeleting = deletingAbsenceId === item.id;
    
    return (
      <View style={styles.absenceCard}>
        <View style={styles.absenceInfo}>
          <Text style={styles.studentName}>{studentName}</Text>
          <Text style={styles.absenceDetails}>
            <Text style={styles.absenceType}>
              {item.type === 'absence' ? '🔴 Absence' : '🟠 Retard'}
            </Text>
            {' - '}
            {formatDate(item.date)}
          </Text>
          <Text style={styles.matiereText}>
            Matière: {matiereName}
          </Text>
          {item.justification && (
            <Text style={styles.justification}>
              Justification: {item.justification}
            </Text>
          )}
        </View>
        {isDeleting ? (
          <View style={styles.deletingContainer}>
            <ActivityIndicator size="small" color="#ff4757" />
            <Text style={styles.deletingText}>Suppression...</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteAbsence(item, studentName)}
          >
            <Ionicons name="trash-outline" size={20} color="#d32f2f" />
            <Text style={styles.deleteButtonText}>Supprimer</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Rendu du modal de confirmation
  const renderConfirmModal = () => {
    if (!absenceToDelete) return null;
    
    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={confirmModalVisible}
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {absenceToDelete.type === 'absence' ? 'Supprimer l\'absence' : 'Supprimer le retard'}
            </Text>
            
            <Text style={styles.modalText}>
              Êtes-vous sûr de vouloir supprimer {absenceToDelete.type === 'absence' ? 'l\'absence' : 'le retard'} de {absenceToDelete.studentName} ?
            </Text>
            
            <View style={styles.absenceDetails}>
              <Text style={styles.modalDetailText}>
                <Text style={styles.modalDetailLabel}>Date :</Text> {formatDate(absenceToDelete.date)}
              </Text>
              <Text style={styles.modalDetailText}>
                <Text style={styles.modalDetailLabel}>Matière :</Text> {absenceToDelete.matiere}
              </Text>
            </View>
            
            <Text style={styles.modalWarning}>
              Cette action est irréversible.
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setConfirmModalVisible(false);
                  setAbsenceToDelete(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.deleteModalButton]}
                onPress={confirmDeleteAbsence}
              >
                <Text style={styles.deleteButtonText}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Historique des Absences et Retards</Text>
        <Text style={styles.headerSubtitle}>Classe: {className}</Text>
      </View>

      {absences.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Aucune absence ou retard enregistré</Text>
        </View>
      ) : (
        <FlatList
          data={absences}
          renderItem={renderAbsenceItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
      
      {/* Render le modal de confirmation */}
      {renderConfirmModal()}
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
    backgroundColor: '#0066cc',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#fff',
    marginTop: 4,
  },
  listContent: {
    padding: 16,
  },
  absenceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  absenceInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  absenceDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  absenceType: {
    fontWeight: 'bold',
  },
  matiereText: {
    fontSize: 14,
    color: '#0066cc',
    marginTop: 2,
  },
  justification: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
  },
  deleteButtonText: {
    color: '#d32f2f',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  deletingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3f3',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
  },
  deletingText: {
    color: '#d32f2f',
    marginLeft: 8,
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  // Styles pour le modal de confirmation
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalDetailText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  modalDetailLabel: {
    fontWeight: 'bold',
    color: '#333',
  },
  modalWarning: {
    fontSize: 14,
    color: '#d32f2f',
    fontStyle: 'italic',
    marginTop: 8,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 4,
    alignItems: 'center',
    marginHorizontal: 5,
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
  deleteModalButton: {
    backgroundColor: '#ffebee',
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
});
