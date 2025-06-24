import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAnnonces } from '../../../services/api';

const AnnoncesListScreen = ({ navigation, route }) => {
  const [annonces, setAnnonces] = useState(route.params?.annonces || []);
  const [loading, setLoading] = useState(!route.params?.annonces);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAnnonce, setSelectedAnnonce] = useState(null);

  // Charger les annonces si elles ne sont pas passées en paramètre
  useEffect(() => {
    if (!route.params?.annonces) {
      loadAnnonces();
    }
  }, []);

  const loadAnnonces = async () => {
    try {
      setLoading(true);
      const data = await getAnnonces();
      setAnnonces(data);
    } catch (error) {
      console.error('Erreur lors du chargement des annonces:', error);
      Alert.alert(
        'Erreur',
        'Impossible de charger les annonces. Veuillez réessayer plus tard.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadAnnonces();
  };

  const showAnnonceDetails = (annonce) => {
    // Créer un modal personnalisé au lieu d'une simple alerte
    setSelectedAnnonce(annonce);
    setModalVisible(true);
  };

  const renderAnnonceItem = ({ item }) => (
    <View style={styles.annonceCard}>
      <View style={styles.annonceHeader}>
        <Text style={styles.annonceDate}>
          {new Date(item.date_creation).toLocaleDateString()}
        </Text>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => showAnnonceDetails(item)}
        >
          <Text style={styles.annonceTitle}>{item.titre}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.annonceContent} numberOfLines={3}>
        {item.contenu}
      </Text>
      <View style={styles.annonceFooter}>
        <Text style={styles.annonceAuthor}>
          Par: {item.auteur_details?.prenom || ''} {item.auteur_details?.nom || ''}
        </Text>
        <TouchableOpacity
          style={styles.voirDetailsButton}
          activeOpacity={0.7}
          onPress={() => showAnnonceDetails(item)}
        >
          <Text style={styles.voirPlusText}>Voir détails</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Toutes les annonces</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Chargement des annonces...</Text>
        </View>
      ) : (
        <FlatList
          data={annonces}
          renderItem={renderAnnonceItem}
          keyExtractor={(item, index) => item.id?.toString() || index.toString()}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Aucune annonce disponible</Text>
            </View>
          }
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}

      {/* Modal pour afficher les détails complets d'une annonce */}
      {selectedAnnonce && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => {
            setModalVisible(false);
          }}
        >
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedAnnonce.titre}</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.modalDateAuthor}>
                <Text style={styles.modalDate}>
                  {new Date(selectedAnnonce.date_creation).toLocaleDateString()}
                </Text>
                <Text style={styles.modalAuthor}>
                  Par: {selectedAnnonce.auteur_details?.prenom || ''} {selectedAnnonce.auteur_details?.nom || ''}
                </Text>
              </View>
              
              <ScrollView style={styles.modalContent}>
                <Text style={styles.modalText}>{selectedAnnonce.contenu}</Text>
              </ScrollView>
              
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2196F3',
    paddingVertical: 15,
    paddingHorizontal: 15,
    elevation: 4,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  listContainer: {
    padding: 15,
  },
  annonceCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  annonceHeader: {
    marginBottom: 8,
  },
  annonceDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  annonceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  annonceContent: {
    fontSize: 14,
    color: '#444',
    marginBottom: 10,
    lineHeight: 20,
  },
  annonceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
  },
  annonceAuthor: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  voirDetailsButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: '#e6f2ff',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  voirPlusText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  // Styles pour le modal
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 0,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#f8f8f8',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    paddingRight: 10,
  },
  closeButton: {
    padding: 5,
  },
  modalDateAuthor: {
    padding: 15,
    paddingTop: 5,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  modalAuthor: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#666',
  },
  modalContent: {
    padding: 15,
    maxHeight: 300,
  },
  modalText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    textAlign: 'justify',
  },
  modalButton: {
    backgroundColor: '#2196F3',
    borderRadius: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 15,
    elevation: 2,
    alignItems: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default AnnoncesListScreen;
