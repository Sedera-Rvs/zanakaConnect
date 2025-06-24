import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthContext from '../../contexts/AuthContext';
import { getUserInfo, getAnnonces } from '../../services/api';

const Stack = createNativeStackNavigator();

function HomeScreen({ navigation }) {
  const { signOut, token, role } = useContext(AuthContext);
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [annonces, setAnnonces] = useState([]);
  const [loadingAnnonces, setLoadingAnnonces] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAnnonce, setSelectedAnnonce] = useState(null);

  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const data = await getUserInfo();
        setUserInfo(data);
        return true; // Indique que le chargement a réussi
      } catch (error) {
        console.error('Erreur lors du chargement des infos utilisateur:', error);
        return false; // Indique que le chargement a échoué
      } finally {
        setLoading(false);
      }
    };

    const loadAnnonces = async () => {
      try {
        console.log('Tentative de chargement des annonces avec token:', token);
        const data = await getAnnonces();
        console.log('Annonces reçues:', data);
        setAnnonces(data);
      } catch (error) {
        console.error('Erreur lors du chargement des annonces:', error);
      } finally {
        setLoadingAnnonces(false);
      }
    };

    // Charger d'abord les informations utilisateur, puis les annonces
    const initializeData = async () => {
      const userInfoLoaded = await loadUserInfo();
      if (userInfoLoaded || token) {
        // Charger les annonces seulement si l'utilisateur est authentifié
        await loadAnnonces();
      }
    };

    initializeData();
  }, [token]); // Dépendance au token pour recharger si le token change

  const menuItems = [
    {
      title: 'Résultats',
      icon: '📊',
      screen: 'Notes',
      description: 'Consultez les notes et bulletins',
    },
    {
      title: 'Absences',
      icon: '📅',
      screen: 'Absences',
      description: 'Suivi des absences et retards',
    },
    {
      title: 'Devoirs',
      icon: '📚',
      screen: 'Devoirs',
      description: 'Devoirs et examens à venir',
    },
    {
      title: 'Messages',
      icon: '✉️',
      screen: 'Messages',
      description: 'Communiquez avec les enseignants',
    },
    {
      title: 'Paiements',
      icon: '💳',
      screen: 'Paiements',
      description: 'Gérez les paiements scolaires',
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ZanakaConnect</Text>
        <TouchableOpacity 
          onPress={() => navigation.navigate('Profile')} 
          style={styles.profileButton}
        >
          <View style={styles.avatarSmall}>
            <Text style={styles.avatarText}>
              {userInfo?.prenom?.[0] || '?'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      ) : (
        <>
          <ScrollView style={styles.scrollView}>
            <View style={styles.welcomeSection}>
            <Text style={styles.welcomeText}>
              Bonjour, {userInfo?.prenom || 'Parent'} !
            </Text>
            <Text style={styles.dateText}>
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </Text>
          </View>

          {/* Section des annonces */}
          <View style={styles.annonceSection}>
            {loadingAnnonces ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#2196F3" />
                <Text style={styles.loadingText}>Chargement des annonces...</Text>
              </View>
            ) : annonces.length > 0 ? (
              <View style={styles.annonceContainer}>
                <View style={styles.headerRow}>
                  <Text style={styles.sectionTitle}>Annonces</Text>
                  <TouchableOpacity 
                    style={styles.voirToutesButton}
                    activeOpacity={0.7}
                    onPress={() => {
                      // Navigation vers l'écran de liste des annonces
                      console.log('Navigation vers AnnoncesList');
                      navigation.navigate('AnnoncesList', { annonces });
                    }}
                  >
                    <Text style={styles.voirToutesText}>Voir tout</Text>
                  </TouchableOpacity>
                </View>
                
                {/* Afficher uniquement la dernière annonce */}
                <TouchableOpacity 
                  style={styles.annonceCard}
                  activeOpacity={0.7}
                  onPress={() => {
                    // Afficher les détails de l'annonce dans un modal
                    setSelectedAnnonce(annonces[0]);
                    setModalVisible(true);
                  }}
                >
                  <View style={styles.annonceHeader}>
                    <Text style={styles.annonceDate}>
                      {new Date(annonces[0].date_creation).toLocaleDateString()}
                    </Text>
                    <Text style={styles.annonceTitle}>{annonces[0].titre}</Text>
                  </View>
                  <Text style={styles.annonceContent} numberOfLines={2}>
                    {annonces[0].contenu}
                  </Text>
                  <View style={styles.annonceFooter}>
                    <Text style={styles.annonceAuthor}>
                      {annonces[0].auteur_details?.prenom} {annonces[0].auteur_details?.nom}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.noAnnonceContainer}>
                <Text style={styles.noAnnonceText}>Aucune annonce disponible</Text>
              </View>
            )}
          </View>

          <View style={styles.grid}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.card}
                onPress={() => navigation.navigate(item.screen)}
              >
                <Text style={styles.cardIcon}>{item.icon}</Text>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDescription}>{item.description}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('Profile')}
            >
              <Text style={styles.cardIcon}>👤</Text>
              <Text style={styles.cardTitle}>Mon Profil</Text>
              <Text style={styles.cardDescription}>Gérer votre compte et vos préférences</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

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
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#2196F3',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
  },
  profileButton: {
    padding: 4,
  },
  avatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    color: 'white',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  welcomeSection: {
    padding: 20,
    backgroundColor: 'white',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  dateText: {
    fontSize: 14,
    color: '#666',
  },
  grid: {
    padding: 15,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    marginBottom: 15,
    width: '48%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  cardIcon: {
    fontSize: 30,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  cardDescription: {
    fontSize: 12,
    color: '#666',
  },
  annonceSection: {
    backgroundColor: 'transparent',
    borderRadius: 10,
    marginBottom:-20,
    marginTop:-15,
    padding:10,
    shadowColor: '#000',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  annonceContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  annonceCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
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
  voirPlusText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '500',
  },
  voirToutesButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  voirToutesText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '500',
  },
  toutesAnnoncesButton: {
    alignItems: 'center',
    padding: 10,
    marginTop: 5,
  },
  toutesAnnoncesText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '500',
  },
  noAnnonceContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noAnnonceText: {
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
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

export default function ParentNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="ParentDashboard"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Profile"
        component={require('../ProfileScreen').default}
        options={{ headerShown: false }}
      />
      {/* Autres écrans à ajouter ici */}
    </Stack.Navigator>
  );
}
