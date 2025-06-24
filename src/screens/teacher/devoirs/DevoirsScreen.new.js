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
import { getAllDevoirs, deleteDevoir } from '../../../services/api';
import { formatDate } from '../../../utils/dateUtils';

export default function DevoirsScreen({ navigation }) {
  const [devoirs, setDevoirs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingDevoirId, setDeletingDevoirId] = useState(null);
  
  // États pour le modal de confirmation
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [devoirToDelete, setDevoirToDelete] = useState(null);

  useEffect(() => {
    loadDevoirs();
    
    // Configurer un écouteur pour recharger les devoirs lorsque l'écran est focalisé
    const unsubscribe = navigation.addListener('focus', () => {
      loadDevoirs();
    });
    
    return unsubscribe;
  }, [navigation]);

  const loadDevoirs = async () => {
    try {
      setLoading(true);
      const response = await getAllDevoirs();
      console.log('Devoirs chargés:', response);
      
      // Trier les devoirs par date (les plus récents d'abord)
      const sortedDevoirs = [...response].sort((a, b) => {
        return new Date(b.date_creation || b.date) - new Date(a.date_creation || a.date);
      });
      
      setDevoirs(sortedDevoirs);
    } catch (error) {
      console.error('Erreur lors du chargement des devoirs:', error);
      Alert.alert('Erreur', 'Impossible de charger la liste des devoirs. Veuillez réessayer.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDevoirs();
  };

  // Fonction pour initialiser la suppression d'un devoir
  const handleDeleteDevoir = (devoir) => {
    console.log(`Demande de confirmation pour supprimer le devoir ${devoir.id}`);
    
    // Stocker les informations du devoir à supprimer
    setDevoirToDelete({
      id: devoir.id,
      titre: devoir.titre,
      classe: devoir.classe_details?.nom || 'Non spécifiée',
      matiere: devoir.matiere_details?.nom || 'Non spécifiée',
      date: devoir.date_echeance || devoir.date
    });
    
    // Afficher le modal de confirmation
    setConfirmModalVisible(true);
  };

  // Fonction pour effectuer la suppression après confirmation
  const confirmDeleteDevoir = async () => {
    if (!devoirToDelete) return;
    
    try {
      // Garder une copie des devoirs actuels au cas où on aurait besoin de les restaurer
      const devoirsAvantSuppression = [...devoirs];
      
      // Indiquer quel devoir est en cours de suppression
      setDeletingDevoirId(devoirToDelete.id);
      console.log(`Suppression du devoir ${devoirToDelete.id}...`);
      
      // IMPORTANT: Supprimer le devoir de l'interface AVANT même d'appeler l'API
      // Cela garantit que l'utilisateur voit le devoir disparaître immédiatement
      setDevoirs(prevDevoirs => prevDevoirs.filter(d => d.id !== devoirToDelete.id));
      
      // Fermer le modal de confirmation
      setConfirmModalVisible(false);
      
      // Appeler l'API pour supprimer le devoir du backend
      const result = await deleteDevoir(devoirToDelete.id);
      console.log(`Résultat de la suppression:`, result);
      
      if (result && result.success) {
        // Afficher un message de confirmation
        Alert.alert('Succès', 'Le devoir a été supprimé avec succès.');
        
        // Attendre un court instant puis recharger la liste des devoirs
        // pour s'assurer qu'elle est synchronisée avec le backend
        setTimeout(() => {
          loadDevoirs();
        }, 500);
      } else {
        // Quelque chose s'est mal passé
        console.warn('La suppression a retourné un statut non-succès:', result);
        Alert.alert(
          'Note', 
          'Le devoir a été supprimé de votre écran. Si vous le voyez encore après un rafraîchissement, veuillez réessayer.'
        );
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      
      // Même en cas d'erreur, donner l'option de restaurer
      Alert.alert(
        'Problème de suppression', 
        'Une erreur est survenue lors de la suppression du devoir.',
        [
          { 
            text: 'Restaurer', 
            onPress: () => {
              // Restaurer les devoirs dans l'état avant suppression
              setDevoirs(devoirsAvantSuppression);
              setDevoirToDelete(null);
            }
          },
          { 
            text: 'OK', 
            style: 'default'
          }
        ]
      );
    } finally {
      // Réinitialiser l'état de suppression
      setDeletingDevoirId(null);
    }
  };

  const navigateToAddDevoir = () => {
    navigation.navigate('AddDevoir');
  };

  const navigateToEditDevoir = (devoirId) => {
    navigation.navigate('EditDevoir', { devoirId });
  };

  const renderDevoirItem = ({ item }) => {
    // Vérifier si ce devoir est en cours de suppression
    const isDeleting = deletingDevoirId === item.id;
    
    // Extraire les informations du devoir
    const classeNom = item.classe_details?.nom || 'Classe non spécifiée';
    const matiereNom = item.matiere_details?.nom || 'Matière non spécifiée';
    const dateEcheance = item.date_echeance ? formatDate(item.date_echeance) : 'Date non spécifiée';
    
    return (
      <View style={styles.devoirCard}>
        <View style={styles.devoirInfo}>
          <Text style={styles.devoirTitre}>{item.titre}</Text>
          <Text style={styles.devoirDetails}>
            <Text style={styles.detailLabel}>Classe:</Text> {classeNom}
          </Text>
          <Text style={styles.devoirDetails}>
            <Text style={styles.detailLabel}>Matière:</Text> {matiereNom}
          </Text>
          <Text style={styles.devoirDetails}>
            <Text style={styles.detailLabel}>Échéance:</Text> {dateEcheance}
          </Text>
          {item.description && (
            <Text style={styles.devoirDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}
        </View>
        
        <View style={styles.devoirActions}>
          {isDeleting ? (
            <View style={styles.deletingContainer}>
              <ActivityIndicator size="small" color="#ff4757" />
              <Text style={styles.deletingText}>Suppression...</Text>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.editButton]}
                onPress={() => navigateToEditDevoir(item.id)}
              >
                <Ionicons name="create-outline" size={20} color="#0066cc" />
                <Text style={styles.editButtonText}>Modifier</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => handleDeleteDevoir(item)}
              >
                <Ionicons name="trash-outline" size={20} color="#d32f2f" />
                <Text style={styles.deleteButtonText}>Supprimer</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  // Rendu du modal de confirmation
  const renderConfirmModal = () => {
    if (!devoirToDelete) return null;
    
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
              Supprimer le devoir
            </Text>
            
            <Text style={styles.modalText}>
              Êtes-vous sûr de vouloir supprimer le devoir "{devoirToDelete.titre}" ?
            </Text>
            
            <View style={styles.devoirDetails}>
              <Text style={styles.modalDetailText}>
                <Text style={styles.modalDetailLabel}>Classe :</Text> {devoirToDelete.classe}
              </Text>
              <Text style={styles.modalDetailText}>
                <Text style={styles.modalDetailLabel}>Matière :</Text> {devoirToDelete.matiere}
              </Text>
              <Text style={styles.modalDetailText}>
                <Text style={styles.modalDetailLabel}>Échéance :</Text> {formatDate(devoirToDelete.date)}
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
                  setDevoirToDelete(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.deleteModalButton]}
                onPress={confirmDeleteDevoir}
              >
                <Text style={styles.deleteButtonText}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gestion des Devoirs</Text>
      </View>

      <TouchableOpacity 
        style={styles.addButton}
        onPress={navigateToAddDevoir}
      >
        <Ionicons name="add-circle-outline" size={20} color="#fff" />
        <Text style={styles.addButtonText}>Ajouter un devoir</Text>
      </TouchableOpacity>

      {devoirs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Aucun devoir enregistré</Text>
          <Text style={styles.emptySubtext}>Appuyez sur "Ajouter un devoir" pour commencer</Text>
        </View>
      ) : (
        <FlatList
          data={devoirs}
          renderItem={renderDevoirItem}
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4caf50',
    paddingVertical: 12,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  listContent: {
    padding: 16,
  },
  devoirCard: {
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
  devoirInfo: {
    marginBottom: 12,
  },
  devoirTitre: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  devoirDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  detailLabel: {
    fontWeight: 'bold',
    color: '#444',
  },
  devoirDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  devoirActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  editButton: {
    backgroundColor: '#e3f2fd',
  },
  editButtonText: {
    color: '#0066cc',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  deleteButton: {
    backgroundColor: '#ffebee',
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
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
