import React, { useState, useCallback, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Image,
  SafeAreaView,
  Button,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getConversations } from '../../../services/messagerie';
import { formatRelativeTime } from '../../../utils/dateUtils';
import AuthContext from '../../../contexts/AuthContext';
import storage from '../../../services/storage';
import { setToken, deleteConversation } from '../../../services/api';

export default function MessagesScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [authError, setAuthError] = useState(false);
  const [userId, setUserId] = useState(null);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState(null);
  const [deletingConversation, setDeletingConversation] = useState(false);
  const { token, signIn } = useContext(AuthContext);

  // Vérifier l'authentification et restaurer le token si nécessaire
  const checkAndRestoreAuth = async () => {
    try {
      setAuthError(false);
      
      // Vérifier si nous avons déjà un token dans le contexte
      if (!token) {
        console.log('Pas de token dans le contexte, tentative de restauration depuis le stockage...');
        const storedToken = await storage.getItem('userToken');
        const storedRole = await storage.getItem('userRole');
        const storedUserId = await storage.getItem('userId');
        
        console.log('Données utilisateur récupérées du stockage:', { 
          token: !!storedToken, 
          role: storedRole, 
          userId: storedUserId 
        });
        
        // Définir l'ID de l'utilisateur pour l'utiliser dans le composant
        if (storedUserId) {
          setUserId(storedUserId);
        }
        
        if (storedToken && storedRole) {
          console.log('Token trouvé dans le stockage, restauration...');
          // Configurer le token dans l'API
          setToken(storedToken);
          // Mettre à jour le contexte d'authentification
          await signIn(storedToken, storedRole, storedUserId);
          return true;
        } else {
          console.warn('Aucun token trouvé dans le stockage');
          setAuthError(true);
          return false;
        }
      } else {
        // Même si nous avons déjà un token, nous devons récupérer l'ID de l'utilisateur
        const storedUserId = await storage.getItem('userId');
        if (storedUserId) {
          setUserId(storedUserId);
          console.log('ID utilisateur récupéré du stockage:', storedUserId);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Erreur lors de la vérification de l\'authentification:', error);
      setAuthError(true);
      return false;
    }
  };
  
  // Charger les conversations à chaque fois que l'écran est affiché
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      let lastFocusTime = 0;
      
      const initScreen = async () => {
        if (!isMounted) return;
        
        const isAuthenticated = await checkAndRestoreAuth();
        if (!isAuthenticated || !isMounted) return;
        
        // Déterminer si nous devons forcer le rafraîchissement
        const now = Date.now();
        const timeSinceLastFocus = now - lastFocusTime;
        const forceRefresh = timeSinceLastFocus > 1000; // Forcer si plus d'une seconde s'est écoulée
        
        lastFocusTime = now;
        console.log(`Initialisation de l'écran de messages, force refresh: ${forceRefresh}`);
        
        // Charger les conversations avec rafraîchissement forcé si nécessaire
        loadConversations(forceRefresh);
      };
      
      initScreen();
      
      // Configurer un intervalle pour rafraîchir périodiquement les conversations
      const refreshInterval = setInterval(() => {
        if (isMounted) {
          console.log('Rafraîchissement périodique des conversations');
          loadConversations();
        }
      }, 10000); // Rafraîchir toutes les 10 secondes
      
      // Nettoyer l'intervalle lors du démontage
      return () => {
        isMounted = false;
        clearInterval(refreshInterval);
      };
    }, [])
  );

  const loadConversations = async (forceRefresh = false) => {
    try {
      setLoading(true);
      // Charger les conversations depuis l'API avec option de rafraîchissement forcé
      console.log(`Chargement des conversations${forceRefresh ? ' (rafraîchissement forcé)' : ''}...`);
      const response = await getConversations(forceRefresh);
      console.log('Conversations chargées:', response);
      
      if (!response || !Array.isArray(response)) {
        setConversations([]);
        setFilteredConversations([]);
        setLoading(false);
        return;
      }
      
      // Récupérer l'ID de l'utilisateur courant pour les comparaisons
      const currentUserId = await storage.getItem('userId');
      console.log('ID utilisateur courant pour le traitement des conversations:', currentUserId);
      
      // Formater les conversations pour l'affichage
      const formattedConversations = response.map(conv => {
        // Récupérer les infos de l'autre utilisateur (dans ce cas, l'enseignant)
        let otherUser = conv.other_user || {};
        
        // Récupérer les infos du dernier message
        let lastMessage = conv.last_message || null;
        
        // Si last_message est null, essayer de récupérer depuis dernier_message
        if (!lastMessage && conv.dernier_message) {
          console.log(`Utilisation de dernier_message pour la conversation ${conv.id}:`, conv.dernier_message);
          lastMessage = {
            id: conv.dernier_message.id,
            text: conv.dernier_message.contenu,
            timestamp: new Date(conv.dernier_message.date_envoi),
            is_read: !conv.non_lus || conv.non_lus === 0,
            sender_id: conv.dernier_message.expediteur_id,
            expediteur_details: {
              id: conv.dernier_message.expediteur_id,
              nom: conv.dernier_message.expediteur_nom ? conv.dernier_message.expediteur_nom.split(' ')[1] || '' : '',
              prenom: conv.dernier_message.expediteur_nom ? conv.dernier_message.expediteur_nom.split(' ')[0] || '' : '',
              role: conv.dernier_message.expediteur_role || 'enseignant'
            }
          };
        }
        
        // S'assurer que otherUser a toutes les propriétés nécessaires
        if (!otherUser.id && !otherUser.nom) {
          console.log(`Tentative de récupération des informations de l'autre utilisateur pour la conversation ${conv.id} depuis participants_details`);
          
          // Essayer de récupérer depuis participants_details
          if (conv.participants_details && Array.isArray(conv.participants_details)) {
            const participant = conv.participants_details.find(p => {
              const participantId = p.id?.toString() || '';
              const userId = currentUserId?.toString() || '';
              // Ajouter une vérification du rôle pour s'assurer que c'est un enseignant
              const isEnseignant = p.role === 'enseignant';
              return participantId !== userId && isEnseignant;
            });
            
            if (participant) {
              console.log(`Enseignant trouvé dans participants_details pour la conversation ${conv.id}:`, participant);
              otherUser = participant;
            }
          }
        }
        
        // Si toujours pas d'informations valides, créer un utilisateur par défaut
        if (!otherUser.id && !otherUser.nom) {
          console.log(`Création d'un utilisateur par défaut pour la conversation ${conv.id}`);
          otherUser = {
            id: 0,
            nom: 'Enseignant',
            prenom: '',
            role: 'enseignant'
          };
        }
        
        // Ajouter les participants_details et dernier_message pour les utiliser plus tard
        return {
          id: conv.id,
          otherUser: otherUser,
          eleveDetails: conv.eleve_details || null,
          participants_details: conv.participants_details || [],
          dernier_message: conv.dernier_message || null,
          lastMessage: lastMessage ? {
            id: lastMessage.id,
            text: lastMessage.text || lastMessage.contenu || '',
            timestamp: new Date(lastMessage.timestamp || lastMessage.date_envoi),
            isRead: lastMessage.is_read || !conv.non_lus || conv.non_lus === 0,
            senderId: lastMessage.sender_id || lastMessage.expediteur_id,
            expediteur_details: lastMessage.expediteur_details || null
          } : null,
          unreadCount: conv.non_lus || conv.unread_count || 0,
          lastActivity: conv.derniere_activite ? new Date(conv.derniere_activite) : 
                        (conv.last_message_at ? new Date(conv.last_message_at) : null)
        };
      });
      
      // Trier par date de dernière activité (du plus récent au plus ancien)
      formattedConversations.sort((a, b) => {
        if (!a.lastActivity && !b.lastActivity) return 0;
        if (!a.lastActivity) return 1;
        if (!b.lastActivity) return -1;
        return b.lastActivity - a.lastActivity;
      });
      
      // Mettre à jour les conversations et appliquer le filtre de recherche
      setConversations(formattedConversations);
      filterConversations(searchQuery, formattedConversations);
    } catch (error) {
      console.error('Erreur lors du chargement des conversations:', error);
      Alert.alert('Erreur', 'Impossible de charger les conversations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Filtrer les conversations en fonction de la recherche
  const filterConversations = (query, convList = null) => {
    const convsToFilter = convList || conversations;
    if (!query.trim()) {
      setFilteredConversations(convsToFilter);
      return;
    }
    
    const filtered = convsToFilter.filter(conv => {
      const otherUser = conv.otherUser || {};
      const searchTerms = query.toLowerCase().trim();
      const userName = `${otherUser.prenom || ''} ${otherUser.nom || ''}`.toLowerCase();
      const messageText = conv.lastMessage?.text?.toLowerCase() || '';
      
      return userName.includes(searchTerms) || messageText.includes(searchTerms);
    });
    
    setFilteredConversations(filtered);
  };
  
  // Fonction de rafraîchissement par tirer vers le bas
  const onRefresh = () => {
    setRefreshing(true);
    loadConversations();
  };
  
  // Fonction pour gérer la recherche
  const handleSearch = (text) => {
    setSearchQuery(text);
    filterConversations(text);
  };
  
  // Fonction pour gérer le clic sur une conversation
  const handleConversationPress = (conversation) => {
    console.log('Navigation vers la conversation:', conversation.id);
    
    // Récupérer les informations de l'autre utilisateur (enseignant)
    const otherUser = conversation.otherUser || {};
    
    // Naviguer vers l'écran de conversation avec les paramètres nécessaires
    navigation.navigate('Conversation', { 
      conversationId: conversation.id,
      otherUser: otherUser,
      eleveDetails: conversation.eleveDetails
    });
  };
  
  // Fonction pour gérer la suppression d'une conversation
  const handleDeleteConversation = async (conversationId, otherUserName) => {
    console.log(`Début de la suppression de la conversation ${conversationId} avec ${otherUserName}`);
    
    try {
      console.log('Début du processus de suppression...');
      setLoading(true);
      
      // Appeler l'API pour supprimer la conversation
      console.log(`Appel de l'API pour supprimer la conversation ${conversationId}...`);
      const result = await deleteConversation(conversationId);
      console.log(`Résultat de la suppression:`, result);
      
      // Mettre à jour la liste des conversations localement
      setConversations(prevConversations => 
        prevConversations.filter(conv => conv.id !== conversationId)
      );
      setFilteredConversations(prevConversations => 
        prevConversations.filter(conv => conv.id !== conversationId)
      );
      
      console.log(`Conversation ${conversationId} supprimée avec succès`);
      
      // Afficher un message de confirmation
      Alert.alert('Succès', 'La conversation a été supprimée avec succès.');
    } catch (error) {
      console.error('Erreur lors de la suppression de la conversation:', error);
      console.error('Détails de l\'erreur:', error.response?.data || error.message);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la suppression de la conversation. Veuillez réessayer.');
    } finally {
      console.log('Fin du processus de suppression');
      setLoading(false);
    }
  };

  // Rendu d'une conversation dans la liste
  const renderConversationItem = ({ item }) => {
    // Formater la date du dernier message
    const lastMessage = item.lastMessage;
    const timestamp = lastMessage ? new Date(lastMessage.timestamp) : new Date();
    const formattedDate = formatRelativeTime(timestamp);
    
    // Récupérer les informations de l'autre utilisateur (enseignant dans le cas d'un parent)
    let otherUser = item.otherUser || {};
    
    // Fonction pour afficher le modal de confirmation de suppression
    const confirmDelete = () => {
      console.log(`Demande de confirmation pour supprimer la conversation ${item.id}`);
      // Stocker les informations de la conversation à supprimer
      setConversationToDelete({
        id: item.id,
        otherUserName: `${otherUser.prenom || ''} ${otherUser.nom || 'Enseignant'}`
      });
      // Afficher le modal de confirmation
      setConfirmModalVisible(true);
    };

    return (
      <View style={styles.conversationContainer}>
        <TouchableOpacity 
          style={styles.conversationItem} 
          onPress={() => handleConversationPress(item)}
        >
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{otherUser.prenom && otherUser.prenom[0] || 'E'}</Text>
            </View>
            {item.unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
          <View style={styles.conversationContent}>
            <View style={styles.conversationHeader}>
              <Text style={styles.userName}>{otherUser.prenom} {otherUser.nom}</Text>
              <Text style={styles.timeText}>{formattedDate}</Text>
            </View>
            <Text style={styles.lastMessage}>{lastMessage ? lastMessage.text : 'Aucun message'}</Text>
          </View>
          <TouchableOpacity 
            style={styles.inlineDeleteButton}
            onPress={confirmDelete}
          >
            <Ionicons name="trash-outline" size={20} color="#e74c3c" />
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    );
  };

  // Modal de confirmation de suppression
  const renderConfirmDeleteModal = () => {
    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={confirmModalVisible}
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Supprimer la conversation</Text>
            
            <Text style={styles.modalText}>
              {
                conversationToDelete 
                  ? `Êtes-vous sûr de vouloir supprimer la conversation avec ${conversationToDelete.otherUserName} ?` 
                  : 'Voulez-vous supprimer cette conversation ?'
              }
            </Text>
            
            <Text style={styles.modalSubtext}>
              Cette action ne supprimera la conversation que pour vous.
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setConfirmModalVisible(false);
                  setConversationToDelete(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.deleteModalButton]}
                onPress={() => {
                  if (conversationToDelete) {
                    console.log(`Confirmation de suppression de la conversation ${conversationToDelete.id}`);
                    handleDeleteConversation(conversationToDelete.id, conversationToDelete.otherUserName);
                    setConfirmModalVisible(false);
                    setConversationToDelete(null);
                  }
                }}
              >
                <Text style={styles.deleteButtonText}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {authError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Erreur d'authentification</Text>
          <Text style={styles.errorSubText}>Veuillez réessayer plus tard.</Text>
        </View>
      ) : (
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Conversations</Text>
            <TouchableOpacity 
              style={styles.newButton}
              onPress={() => navigation.navigate('NewConversation')}
            >
              <Ionicons name="ios-create" size={24} color="#0078FF" />
            </TouchableOpacity>
          </View>
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="ios-search" size={20} color="#333" style={styles.searchIcon} />
              <TextInput 
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={handleSearch}
                placeholder="Rechercher une conversation"
              />
            </View>
          </View>
          {loading ? (
            <ActivityIndicator size="large" color="#0078FF" style={styles.loadingIndicator} />
          ) : (
            <FlatList 
              data={filteredConversations}
              renderItem={renderConversationItem}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.conversationsList}
              refreshControl={
                <RefreshControl 
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                />
              }
            />
          )}
          {renderConfirmDeleteModal()}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  conversationContainer: {
    position: 'relative',
    marginHorizontal: 16,
    marginVertical: 8,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarContainer: {
    marginRight: 16,
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0078FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ff3b30',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  timeText: {
    fontSize: 12,
    color: '#999',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  inlineDeleteButton: {
    position: 'absolute',
    right: 12,
    top: 35,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
    zIndex: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    marginBottom: 12,
    textAlign: 'center',
    color: '#333',
    lineHeight: 22,
  },
  modalSubtext: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 16,
  },
  deleteModalButton: {
    backgroundColor: '#e74c3c',
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 40,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
  },
  errorSubText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonIcon: {
    marginRight: 8,
  },
  newConversationButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  newButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    backgroundColor: '#fff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInputContainer: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 24,
    fontSize: 16,
    color: '#333',
  },
  loadingIndicator: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversationsList: {
    padding: 12,
  },
});
