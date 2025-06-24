import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Alert,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import EleveAvatar from '../../../components/EleveAvatar';
import { getConversations, getMessages, getMessagesConversation } from '../../../services/messagerie';
import * as enseignantMessagerieService from '../../../services/enseignantMessagerieService';
import api, { getCompletePhotoUrl, getEnfants, getUserInfo, getEleveById, deleteConversation } from '../../../services/api';
import storage from '../../../services/storage';
import AuthContext from '../../../contexts/AuthContext';

export default function MessagesScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [eleves, setEleves] = useState([]);
  const { token } = useContext(AuthContext);
  
  // États pour le modal de confirmation de suppression
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState(null);

  useEffect(() => {
    loadUserInfoAndConversations();
  }, []);
  
  // Recharger les conversations lorsque l'utilisateur revient à cet écran
  useFocusEffect(
    useCallback(() => {
      console.log('Écran Messages a reçu le focus - rechargement des conversations');
      loadUserInfoAndConversations();
      return () => {};
    }, [])
  );
  
  const loadUserInfoAndConversations = async () => {
    try {
      // Récupérer les informations de l'utilisateur
      const userData = await getUserInfo();
      console.log('Informations utilisateur récupérées:', userData);
      setUserInfo(userData);
      
      // Récupérer la liste des élèves
      const elevesData = await getEnfants();
      console.log('Données élèves reçues:', elevesData);
      
      const elevesArray = Array.isArray(elevesData) ? elevesData : (elevesData.results || []);
      console.log(`${elevesArray.length} élèves trouvés`);
      
      // Afficher les élèves pour le débogage
      elevesArray.forEach((eleve, index) => {
        console.log(`Élève ${index + 1}: ${eleve.prenom} ${eleve.nom}, photo: ${eleve.photo ? 'Oui' : 'Non'}`);
      });
      
      setEleves(elevesArray);
      
      // Charger les conversations
      await loadConversations(userData, elevesArray);
    } catch (error) {
      console.error('Erreur lors du chargement des données initiales:', error);
      // En cas d'erreur, essayer de charger les conversations avec des données fictives
      await loadConversations(null, []);
    }
  };

  const loadConversations = async () => {
    try {
      setLoading(true);

      // Vérifier si nous avons un token valide
      const token = await storage.getItem('userToken');
      if (!token) {
        console.warn('Aucun token disponible pour récupérer les conversations');
        setError('Veuillez vous connecter pour voir vos conversations');
        setLoading(false);
        return;
      }

      // Récupérer l'ID de l'utilisateur courant pour les comparaisons
      const currentUserId = await storage.getItem('userId');
      console.log('ID utilisateur courant pour le traitement des conversations:', currentUserId);

      // Charger les conversations depuis l'API avec le service spécifique aux enseignants
      console.log('Chargement des conversations avec le service enseignant...');
      // Forcer le rafraîchissement des données pour s'assurer que les conversations restaurées apparaissent
      const response = await getConversations(true); // true = forceRefresh
      console.log('Réponse API conversations:', response);

      // La réponse peut être un tableau ou un objet avec une propriété 'results'
      let conversationsData = [];
      
      if (Array.isArray(response)) {
        console.log('Réponse API sous forme de tableau');
        conversationsData = response;
      } else if (response && response.results && Array.isArray(response.results)) {
        console.log('Réponse API sous forme d\'objet avec propriété results');
        conversationsData = response.results;
      } else if (response && typeof response === 'object') {
        console.log('Réponse API sous forme d\'objet unique');
        conversationsData = [response]; // Convertir en tableau pour traitement uniforme
      }
      
      console.log(`Nombre de conversations trouvées: ${conversationsData.length}`);
      
      if (conversationsData.length === 0) {
        console.log('Aucune conversation trouvée');
        setConversations([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Formater les conversations pour l'affichage
      const formattedConversations = [];

      // Log des détails pour comprendre la structure de données
      console.log('Structure de la première conversation:', JSON.stringify(conversationsData[0], null, 2).substring(0, 500) + '...');

      for (const conv of conversationsData) {
        try {
          // Récupérer les informations de l'autre utilisateur (parent)
          let otherUser = conv.other_user || {};

          // Si other_user est vide, essayer de le récupérer depuis participants_details
          if ((!otherUser.id || !otherUser.nom) && conv.participants_details && Array.isArray(conv.participants_details)) {
            // Rechercher le parent dans les participants_details
            const participant = conv.participants_details.find((p) => {
              // Vérifier si c'est un parent et pas l'utilisateur courant
              const participantId = p.id?.toString() || '';
              const userId = currentUserId?.toString() || '';
              const isParent = p.role === 'parent';
              const isNotCurrentUser = participantId !== userId;
              
              console.log(`Participant ${p.prenom} ${p.nom} (ID: ${p.id}): role=${p.role}, isParent=${isParent}, isNotCurrentUser=${isNotCurrentUser}`);
              
              return isParent && isNotCurrentUser;
            });

            if (participant) {
              console.log(`Parent trouvé dans participants_details pour la conversation ${conv.id}:`, participant);
              otherUser = participant;
            }
          }
          
          // Si toujours pas d'informations valides, essayer de récupérer depuis participants
          if ((!otherUser.id || !otherUser.nom) && conv.participants && Array.isArray(conv.participants)) {
            // Trouver l'ID du participant qui n'est pas l'utilisateur courant
            const otherParticipantId = conv.participants.find(id => 
              id?.toString() !== currentUserId?.toString()
            );
            
            if (otherParticipantId) {
              console.log(`ID du parent trouvé dans participants: ${otherParticipantId}`);
              
              // Chercher les détails de ce participant dans la liste des participants_details
              if (conv.participants_details && Array.isArray(conv.participants_details)) {
                const participantDetails = conv.participants_details.find(p => 
                  p.id?.toString() === otherParticipantId?.toString() && p.role === 'parent'
                );
                
                if (participantDetails) {
                  console.log(`Détails du parent trouvés:`, participantDetails);
                  otherUser = participantDetails;
                }
              }
            }
          }

          // Si toujours pas d'informations valides, créer un utilisateur par défaut
          if (!otherUser.id || !otherUser.nom) {
            console.log(`Création d'un parent par défaut pour la conversation ${conv.id}`);
            otherUser = {
              id: conv.parent_id || 0,
              nom: 'Parent',
              prenom: '',
              role: 'parent',
            };
          }

          // Récupérer les informations de l'élève
          let eleveInfo = null;
          
          // Vérifier si les détails de l'élève sont déjà disponibles
          if (conv.eleve_details) {
            eleveInfo = conv.eleve_details;
            console.log(`Détails de l'élève déjà disponibles pour la conversation ${conv.id}:`, eleveInfo);
          } 
          // Sinon, vérifier si l'élève est disponible comme objet
          else if (conv.eleve && typeof conv.eleve === 'object' && conv.eleve.id) {
            eleveInfo = conv.eleve;
            console.log(`Objet élève disponible pour la conversation ${conv.id}:`, eleveInfo);
          } 
          // Sinon, vérifier si l'ID de l'élève est disponible
          else if (conv.eleve_id || (conv.eleve && typeof conv.eleve === 'number')) {
            const eleveId = conv.eleve_id || conv.eleve;
            try {
              // Récupérer les détails de l'élève depuis l'API
              eleveInfo = await getEleveById(eleveId);
              console.log(`Détails de l'élève récupérés pour la conversation ${conv.id}:`, eleveInfo);
            } catch (eleveError) {
              console.error(`Erreur lors de la récupération des détails de l'élève ${eleveId}:`, eleveError);
              
              // Essayer de trouver l'élève dans la liste des élèves déjà chargés
              if (eleves && eleves.length > 0) {
                const eleveFromList = eleves.find(e => e.id === eleveId);
                if (eleveFromList) {
                  console.log(`Élève trouvé dans la liste des élèves:`, eleveFromList);
                  eleveInfo = eleveFromList;
                }
              }
            }
          }

          // Si pas d'informations sur l'élève, créer un élève par défaut
          if (!eleveInfo) {
            console.log(`Création d'un élève par défaut pour la conversation ${conv.id}`);
            eleveInfo = {
              id: conv.eleve_id || (typeof conv.eleve === 'number' ? conv.eleve : 0),
              nom: otherUser.nom || 'Inconnu',
              prenom: 'Enfant',
              photo: null,
            };
          }

          // Assurer que la photo de l'élève a une URL complète
          if (eleveInfo.photo) {
            eleveInfo.photo_complete = getCompletePhotoUrl(eleveInfo.photo);
            console.log(`URL complète de la photo: ${eleveInfo.photo_complete}`);
          }

          // Récupérer les informations du dernier message
          let lastMessage = null;
          let messageDate = new Date();
          let messageContent = 'Aucun message';
          let unreadCount = 0;

          if (conv.dernier_message) {
            lastMessage = conv.dernier_message;
            messageDate = new Date(lastMessage.date_envoi);
            messageContent = lastMessage.contenu || 'Aucun message';
            unreadCount = conv.non_lus || 0;
          }

          // Ajouter la conversation formatée
          formattedConversations.push({
            id: conv.id,
            parent: {
              id: otherUser.id || '',
              nom: otherUser.nom || 'Parent',
              prenom: otherUser.prenom || '',
              role: otherUser.role || 'parent',
            },
            eleve: {
              id: eleveInfo.id,
              nom: eleveInfo.nom || '',
              prenom: eleveInfo.prenom || '',
              photo: eleveInfo.photo || null,
              photo_complete: eleveInfo.photo_complete || null,
            },
            dernierMessage: messageContent,
            dateMessage: messageDate,
            nonLu: unreadCount,
          });
        } catch (convError) {
          console.error(`Erreur lors du traitement de la conversation ${conv.id}:`, convError);
        }
      }

      // Trier par date (du plus récent au plus ancien)
      formattedConversations.sort((a, b) => b.dateMessage - a.dateMessage);

      console.log(`${formattedConversations.length} conversations formatées`);
      setConversations(formattedConversations);
    } catch (error) {
      console.error('Erreur lors du chargement des conversations:', error);
      setError('Impossible de charger les conversations. Veuillez réessayer.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadConversations();
  };

  const navigateToNewMessage = () => {
    navigation.navigate('NewMessage');
  };
  
  // Fonction pour gérer la suppression d'une conversation
  const handleDeleteConversation = async (conversationId, parentName) => {
    console.log(`Début de la suppression de la conversation ${conversationId} avec ${parentName}`);
    
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

  const navigateToConversation = async (conversationId, parentName, eleve) => {
    try {
      console.log(`Navigation vers la conversation ${conversationId} avec le parent:`, parentName);
      
      // Récupérer les messages de la conversation avec pagination complète
      let messagesData = [];
      try {
        // Utiliser getMessagesConversation qui gère la pagination
        messagesData = await getMessagesConversation(conversationId);
        console.log(`${messagesData.length} messages récupérés pour la conversation ${conversationId}`);
      } catch (error) {
        console.error('Erreur lors de la récupération des messages:', error);
      }
      
      // Récupérer les informations complètes de l'élève
      let eleveComplet = { ...eleve };
      if (eleve && eleve.id) {
        try {
          console.log(`Récupération des informations complètes de l'élève ${eleve.id}`);
          const eleveDetails = await getEleveById(eleve.id);
          if (eleveDetails) {
            eleveComplet = { ...eleveDetails };
            console.log('Informations complètes de l\'\u00e9lève récupérées:', eleveDetails);
            
            // S'assurer que la photo est complète
            if (eleveDetails.photo) {
              eleveComplet.photo_complete = getCompletePhotoUrl(eleveDetails.photo);
              console.log('URL complète de la photo:', eleveComplet.photo_complete);
            }
          }
        } catch (eleveError) {
          console.error(`Erreur lors de la récupération des informations de l'élève ${eleve.id}:`, eleveError);
        }
      }
      
      // Préparer les données du parent pour la navigation
      const parentDetails = {
        id: parentName.id,
        nom: parentName.nom || '',
        prenom: parentName.prenom || '',
        role: parentName.role || 'parent'
      };
      
      // Afficher les détails du parent pour le débogage
      console.log('Détails du parent pour la navigation:', parentDetails);
      
      // Naviguer vers l'écran de conversation avec toutes les informations nécessaires
      navigation.navigate('Conversation', { 
        conversationId, 
        parentName: `${parentName.prenom || ''} ${parentName.nom || 'Parent'}`.trim(),
        parentDetails: parentDetails, // Ajouter les détails complets du parent
        eleveInfo: eleveComplet,
        messages: messagesData
      });
    } catch (error) {
      console.error('Erreur lors de la navigation vers la conversation:', error);
      Alert.alert('Erreur', 'Impossible d\'ouvrir la conversation');
    }
  };

  const formatDate = (date) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (messageDate.getTime() === today.getTime()) {
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    }
  };

  // Vérifier si une conversation correspond à la recherche
  const matchesSearch = (conversation, query) => {
    if (!query) return true;
    
    const searchLower = query.toLowerCase();
    const parentName = `${conversation.parent?.prenom || ''} ${conversation.parent?.nom || ''}`.toLowerCase();
    const eleveName = `${conversation.eleve?.prenom || ''} ${conversation.eleve?.nom || ''}`.toLowerCase();
    const messageContent = (conversation.dernierMessage || '').toLowerCase();
    
    return parentName.includes(searchLower) || 
           eleveName.includes(searchLower) || 
           messageContent.includes(searchLower);
  };

  // Rendu d'un élément de conversation
  const renderConversationItem = ({ item }) => {
    const formattedDate = formatDate(item.dateMessage);
    const isUnread = item.nonLu > 0;

    // Vérifier si l'élément correspond à la recherche
    if (searchQuery && !matchesSearch(item, searchQuery)) {
      return null;
    }

    // Déterminer la source de l'image de l'élève
    let photoSource = null;
    let photoUrl = null;
    
    if (item.eleve?.photo_complete) {
      photoUrl = item.eleve.photo_complete;
    } else if (item.eleve?.photo) {
      // Nettoyer l'URL de la photo si nécessaire
      let cleanPhotoUrl = item.eleve.photo;
      if (typeof cleanPhotoUrl === 'string') {
        // Supprimer les guillemets si présents
        cleanPhotoUrl = cleanPhotoUrl.replace(/["']/g, '');
      }
      photoUrl = getCompletePhotoUrl(cleanPhotoUrl);
    }
    
    if (photoUrl) {
      photoSource = { uri: photoUrl };
      console.log('URL de la photo de l\'élève dans la liste:', photoUrl);
    }
    
    // Fonction pour afficher le modal de confirmation de suppression
    const confirmDelete = () => {
      console.log(`Demande de confirmation pour supprimer la conversation ${item.id}`);
      // Stocker les informations de la conversation à supprimer
      setConversationToDelete({
        id: item.id,
        parentName: `${item.parent.prenom} ${item.parent.nom}`
      });
      // Afficher le modal de confirmation
      setConfirmModalVisible(true);
    };

    return (
      <View style={styles.conversationContainer}>
        {/* Carte de conversation principale avec bouton de suppression intégré */}
        <TouchableOpacity
          style={styles.conversationCard}
          onPress={() => navigateToConversation(item.id, item.parent, item.eleve)}
        >
          {/* Photo de l'élève à gauche */}
          <View style={styles.photoContainer}>
            <EleveAvatar 
              eleve={item.eleve} 
              size="medium" 
            />
          </View>
          
          {/* Informations de la conversation */}
          <View style={styles.conversationInfo}>
            <View style={styles.conversationHeader}>
              <Text style={styles.parentName}>
                {item.parent.prenom ? `${item.parent.prenom} ${item.parent.nom}` : item.parent.nom || 'Parent'}
              </Text>
              <Text style={styles.messageDate}>{formattedDate}</Text>
            </View>

            <Text style={styles.studentName}>
              Parent de {item.eleve.prenom} {item.eleve.nom}
            </Text>

            <Text 
              style={[styles.messagePreview, isUnread && styles.unreadMessage]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.dernierMessage}
            </Text>
          </View>
          
          {/* Badge de messages non lus */}
          {isUnread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{item.nonLu}</Text>
            </View>
          )}
          
          {/* Bouton de suppression intégré dans la carte */}
          <TouchableOpacity 
            style={styles.inlineDeleteButton}
            onPress={confirmDelete}
            activeOpacity={0.6}
          >
            <Ionicons name="trash-outline" size={20} color="#e74c3c" />
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
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
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un parent ou un élève..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={conversations.filter(conv => {
          if (!searchQuery) return true;
          const query = searchQuery.toLowerCase();
          const parentName = `${conv.parent?.prenom || ''} ${conv.parent?.nom || ''}`.toLowerCase();
          const eleveName = `${conv.eleve?.prenom || ''} ${conv.eleve?.nom || ''}`.toLowerCase();
          return parentName.includes(query) || eleveName.includes(query);
        })}
        renderItem={renderConversationItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery ? 'Aucun résultat trouvé' : 'Aucune conversation pour le moment'}
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => navigation.navigate('NewMessage')}
            >
              <Text style={styles.emptyButtonText}>Créer un nouveau message</Text>
            </TouchableOpacity>
          </View>
        }
      />
      
      {/* Bouton flottant pour créer un nouveau message */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NewMessage')}
      >
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>
      
      {/* Modal de confirmation de suppression */}
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
                  ? `Êtes-vous sûr de vouloir supprimer la conversation avec ${conversationToDelete.parentName} ?` 
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
                    handleDeleteConversation(conversationToDelete.id, conversationToDelete.parentName);
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  conversationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 8,
  },
  inlineDeleteButton: {
    position: 'absolute',
    right: 12,
    top: 50,
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  newMessageButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
  },
  newMessageButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  searchContainer: {
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 8,
    fontSize: 16,
  },
  listContent: {
    padding: 12,
  },
  conversationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    flex: 1,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  conversationInfo: {
    flex: 1,
    marginLeft: 12,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  parentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  messageDate: {
    fontSize: 14,
    color: '#666',
  },
  studentName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  messagePreview: {
    fontSize: 15,
    color: '#333',
  },
  unreadMessage: {
    fontWeight: 'bold',
  },
  unreadBadge: {
    backgroundColor: '#0066cc',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  deleteButton: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    backgroundColor: '#e74c3c',
    borderRadius: 8,
    minWidth: 100,
    height: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 3,
  },
  deleteButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 15,
  },
  emptyButton: {
    backgroundColor: '#0056b3',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    right: 20,
    bottom: 20,
    backgroundColor: '#0056b3',
    borderRadius: 28,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  
  // Styles pour le modal de confirmation
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
  photoContainer: {
    marginRight: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#e1e1e1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  photoPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0066cc',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  photoPlaceholderText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
