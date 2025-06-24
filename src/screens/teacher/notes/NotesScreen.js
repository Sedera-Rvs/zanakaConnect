import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { getClasses, getMatieresEnseignant } from '../../../services/api';

export default function NotesScreen({ navigation }) {
  const [classes, setClasses] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMatieres, setLoadingMatieres] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [matieresModalVisible, setMatieresModalVisible] = useState(false);

  useEffect(() => {
    loadClasses();
    loadMatieres();
  }, []);

  const loadClasses = async () => {
    try {
      setLoading(true);
      // Charger les classes depuis l'API
      const response = await getClasses();
      setClasses(response);
    } catch (error) {
      console.error('Erreur lors du chargement des classes:', error);
      Alert.alert(
        'Erreur',
        'Impossible de charger les classes. Veuillez réessayer.'
      );
    } finally {
      setLoading(false);
    }
  };
  
  const loadMatieres = async () => {
    try {
      setLoadingMatieres(true);
      // Charger les matières enseignées par l'enseignant connecté
      const response = await getMatieresEnseignant();
      console.log('Matières enseignées chargées dans NotesScreen:', response);
      setMatieres(response);
    } catch (error) {
      console.error('Erreur lors du chargement des matières:', error);
      // Pas d'alerte ici pour ne pas perturber l'expérience utilisateur
    } finally {
      setLoadingMatieres(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadClasses();
    setRefreshing(false);
  };

  const navigateToClassNotes = (classeId, className) => {
    navigation.navigate('AddNote', { classeId, className });
  };
  
  // Fonction supprimée car nous ne voulons plus rediriger vers l'ajout de notes en cliquant sur une matière
  // La fonction viewMatiereDetails va simplement afficher plus d'informations sur la matière sans redirection
  const viewMatiereDetails = (matiere) => {
    // On pourrait éventuellement ajouter une alerte ou un toast avec plus d'informations sur la matière
    console.log('Détails de la matière:', matiere);
    
    // Afficher une alerte avec les détails de la matière
    Alert.alert(
      `${matiere.nom}`,
      `Coefficient: ${matiere.coefficient}\n\nCette page sert uniquement à consulter les matières que vous enseignez. Pour ajouter des notes, veuillez utiliser la liste des classes.`,
      [{ text: 'OK', style: 'default' }]
    );
  };
  
  const openMatieresModal = () => {
    // Recharger les matières avant d'ouvrir le modal pour être sûr d'avoir les données à jour
    loadMatieres().then(() => {
      if (matieres.length > 0) {
        console.log('Ouverture du modal avec matières:', matieres);
        setMatieresModalVisible(true);
      } else {
        console.log('Aucune matière trouvée pour cet enseignant');
        Alert.alert(
          'Information',
          'Vous n\'enseignez aucune matière pour le moment.'
        );
      }
    });
  };
  
  const renderMatiereItem = ({ item }) => (
    <TouchableOpacity
      style={styles.matiereCard}
      onPress={() => viewMatiereDetails(item)}
    >
      <View style={styles.matiereInfo}>
        <Text style={styles.matiereName}>{item.nom}</Text>
        <Text style={styles.matiereDetails}>
          Coefficient: {item.coefficient}
        </Text>
      </View>
      <Text style={styles.arrowIcon}>ℹ️</Text>
    </TouchableOpacity>
  );

  const renderClassItem = ({ item }) => (
    <TouchableOpacity
      style={styles.classCard}
      onPress={() => navigateToClassNotes(item.id, item.nom)}
    >
      <View style={styles.classInfo}>
        <Text style={styles.className}>{item.nom}</Text>
        <Text style={styles.classDetails}>
        👨🏽‍🎓 {item.effectif} élèves
        </Text>
      </View>
      <Text style={styles.arrowIcon}>→</Text>
    </TouchableOpacity>
  );

  if (loading || loadingMatieres) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gestion des Notes</Text>
        <View style={styles.headerActions}>
          <Text style={styles.headerSubtitle}>Sélectionnez une classe</Text>
          <TouchableOpacity 
            style={styles.matiereButton}
            onPress={openMatieresModal}
            activeOpacity={0.7}
          >
            <Text style={styles.matiereButtonText}>Voir par matière</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={classes}
        renderItem={renderClassItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
      
      {/* Modal pour afficher les matières */}
      <Modal
        visible={matieresModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setMatieresModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Vos matières</Text>
              <Text style={styles.modalSubtitle}>Sélectionnez une matière pour voir ou ajouter des notes</Text>
            </View>
            
            {loadingMatieres ? (
              <ActivityIndicator size="large" color="#0066cc" />
            ) : matieres.length > 0 ? (
              <FlatList
                data={matieres}
                renderItem={renderMatiereItem}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.matieresList}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Vous n'enseignez aucune matière pour le moment.</Text>
              </View>
            )}
            
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setMatieresModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  matiereButton: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  matiereButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  listContent: {
    padding: 16,
  },
  classCard: {
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
  classInfo: {
    flex: 1,
  },
  className: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  classDetails: {
    fontSize: 14,
    color: '#666',
  },
  arrowIcon: {
    fontSize: 24,
    color: '#0066cc',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    width: '100%',
    maxHeight: '80%',
  },
  modalHeader: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  matieresList: {
    paddingVertical: 8,
  },
  matiereCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
  },
  matiereInfo: {
    flex: 1,
  },
  matiereName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  matiereDetails: {
    fontSize: 14,
    color: '#666',
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
  closeButton: {
    backgroundColor: '#f44336',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#0066cc',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
});
