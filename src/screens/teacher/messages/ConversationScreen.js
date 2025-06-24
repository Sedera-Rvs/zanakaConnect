import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import EleveAvatar from '../../../components/EleveAvatar';
import { getMessagesConversation, sendMessage, markConversationAsRead } from '../../../services/messagerie';
import api, { getCompletePhotoUrl, setToken, getUserById } from '../../../services/api';
import storage from '../../../services/storage';
import AuthContext from '../../../contexts/AuthContext';
import { formatMessageDate, formatTime, isSameDay } from '../../../utils/dateUtils';

export default function ConversationScreen({ route, navigation }) {
  // Ajouter des logs détaillés pour les paramètres de route
  console.log('Paramètres de route reçus par ConversationScreen:', JSON.stringify(route.params));
  
  // Vérifier si les paramètres de route sont valides
  if (!route.params) {
    console.error('Aucun paramètre de route reçu par ConversationScreen');
    Alert.alert('Erreur', 'Impossible de charger la conversation. Paramètres manquants.', [
      { text: 'Retour', onPress: () => navigation.goBack() }
    ]);
    return null;
  }
  
  // Extraire les paramètres avec des valeurs par défaut pour éviter les erreurs
  const { 
    conversationId, 
    parentName: initialParentName, 
    eleveInfo, 
    messages: initialMessages, 
    initialMessage 
  } = route.params;
  
  // Vérifier si l'ID de conversation est valide
  if (!conversationId) {
    console.error('ID de conversation manquant dans les paramètres de route');
    Alert.alert('Erreur', 'ID de conversation manquant. Impossible de charger la conversation.', [
      { text: 'Retour', onPress: () => navigation.goBack() }
    ]);
    return null;
  }
  
  console.log(`ConversationScreen - ID de conversation: ${conversationId}`);
  console.log(`ConversationScreen - Info parent: ${JSON.stringify(initialParentName)}`);
  console.log(`ConversationScreen - Info élève: ${JSON.stringify(eleveInfo)}`);
  console.log(`ConversationScreen - Message initial: ${initialMessage || 'Aucun'}`);
  
  const [parentName, setParentName] = useState(initialParentName);
  const [messages, setMessages] = useState(initialMessages || []);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const flatListRef = useRef(null);
  const authContext = React.useContext(AuthContext);
  // Référence pour savoir si le composant est monté
  const isMounted = useRef(true);
  // Stocker l'intervalle de rafraîchissement
  const [refreshInterval, setRefreshInterval] = useState(null);
  // Dernier ID de message pour détecter les nouveaux messages
  const [lastMessageId, setLastMessageId] = useState(null);
  // État pour gérer les erreurs de chargement d'image
  const [imageLoadError, setImageLoadError] = useState(false);
  // États pour la pagination des messages
  const [allMessages, setAllMessages] = useState([]);
  const [displayedMessages, setDisplayedMessages] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const messagesPerPage = 10;

  // Composant d'en-tête personnalisé avec l'image de l'élève
  const ConversationHeader = useCallback(() => {
    // Récupérer les informations du parent
    let displayName = '';
    let role = '';
    let parentInfo = null;
    
    console.log('Route params pour la conversation:', route.params);
    
    // 1. Vérifier d'abord les détails du parent dans les paramètres de route (priorité la plus élevée)
    if (route.params?.parentDetails) {
      // Vérifier si les détails du parent sont valides (pas un admin)
      if (route.params.parentDetails.role === 'parent' || 
          (!route.params.parentDetails.role && route.params.parentDetails.id)) {
        parentInfo = route.params.parentDetails;
        console.log('Utilisation des détails du parent depuis route.params.parentDetails:', parentInfo);
      } else {
        console.log('Détails du parent ignorés car ce n\'est pas un parent:', route.params.parentDetails);
      }
    } 
    // 2. Sinon, vérifier otherUser dans les paramètres de route
    else if (route.params?.otherUser) {
      // Vérifier si otherUser est un parent valide (pas un admin)
      if (route.params.otherUser.role === 'parent' || 
          (!route.params.otherUser.role && route.params.otherUser.id)) {
        parentInfo = route.params.otherUser;
        console.log('Utilisation des détails du parent depuis route.params.otherUser:', parentInfo);
      } else {
        console.log('Détails du parent ignorés car ce n\'est pas un parent:', route.params.otherUser);
      }
    }
    // 3. Sinon, vérifier si parentName est un objet
    else if (typeof parentName === 'object' && parentName !== null) {
      // Vérifier si parentName est un parent valide (pas un admin)
      if (parentName.role === 'parent' || (!parentName.role && parentName.id)) {
        parentInfo = parentName;
        console.log('Utilisation des détails du parent depuis parentName (objet):', parentInfo);
      } else {
        console.log('Détails du parent ignorés car ce n\'est pas un parent:', parentName);
      }
    }
    // 4. Sinon, vérifier si parentName est une chaîne
    else if (typeof parentName === 'string' && parentName.trim()) {
      displayName = parentName.trim();
      role = 'parent'; // Par défaut, on suppose que c'est un parent
      console.log('Utilisation du nom du parent depuis parentName (chaîne):', displayName);
    }
    // 5. Sinon, essayer de récupérer les informations du parent à partir de l'élève
    else if (eleveInfo) {
      // Vérifier si nous avons les détails du parent dans l'élève
      if (eleveInfo.parent_details) {
        parentInfo = eleveInfo.parent_details;
        console.log('Utilisation des détails du parent depuis eleveInfo.parent_details:', parentInfo);
      }
      // Si nous avons l'ID du parent mais pas les détails, essayer de les récupérer
      else if (eleveInfo.parent) {
        // Utiliser un nom générique en attendant de récupérer les détails
        displayName = 'Parent';
        role = 'parent';
        
        // Récupérer les détails du parent en arrière-plan
        getUserById(eleveInfo.parent)
          .then(parentData => {
            if (parentData) {
              console.log('Détails du parent récupérés à partir de l\'ID:', parentData);
              // Mettre à jour l'en-tête avec les nouvelles informations
              setParentName({
                id: parentData.id,
                nom: parentData.nom || 'Parent',
                prenom: parentData.prenom || '',
                role: 'parent'
              });
            }
          })
          .catch(error => {
            console.warn('Erreur lors de la récupération des détails du parent:', error);
          });
      }
    }
    // 6. Sinon, utiliser une valeur par défaut
    else {
      displayName = 'Parent';
      role = 'parent';
      console.log('Utilisation du nom du parent par défaut');
    }
    
    // Si nous avons des informations sur le parent, extraire le nom et le rôle
    if (parentInfo) {
      // Vérifier si c'est un admin ou un utilisateur système
      const isAdmin = parentInfo.role === 'admin' || 
                      parentInfo.username === 'admin' || 
                      parentInfo.is_staff === true;
      
      // Si c'est un admin, utiliser un nom générique de parent
      if (isAdmin) {
        console.log('Utilisateur admin détecté, utilisation d\'un nom générique de parent');
        displayName = 'Parent';
        role = 'parent';
      } else {
        // Sinon, utiliser les informations du parent
        displayName = `${parentInfo.prenom || ''} ${parentInfo.nom || ''}`.trim() || 'Parent';
        role = parentInfo.role || 'parent';
        
        // Forcer le rôle à 'parent' si nous sommes dans l'interface enseignant
        // et que l'autre utilisateur n'est pas un enseignant
        if (role !== 'enseignant') {
          role = 'parent';
        }
      }
    }
    
    // Déterminer le sous-titre en fonction du rôle et des informations de l'élève
    let subtitle = '';
    if (role === 'parent' && eleveInfo) {
      subtitle = `Parent de ${eleveInfo.prenom || ''} ${eleveInfo.nom || ''}`;
    } else if (eleveInfo) {
      subtitle = `Élève: ${eleveInfo.prenom || ''} ${eleveInfo.nom || ''}`;
    }
    
    console.log('Affichage de l\'en-tête avec:', { displayName, role, subtitle });
    
    // Fonction pour retourner à la liste des conversations
    const handleBackPress = () => {
      console.log('Retour à la liste des conversations');
      navigation.goBack();
    };
    
    return (
      <View style={styles.headerContainer}>
        {/* Bouton de retour */}
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#0078FF" />
        </TouchableOpacity>
        
        {/* Avatar de l'élève - taille augmentée */}
        <View style={styles.avatarContainer}>
          <EleveAvatar eleve={eleveInfo} size={50} style={styles.headerAvatar} />
        </View>
        
        {/* Informations du parent */}
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>{displayName}</Text>
          <Text style={styles.headerSubtitle}>{subtitle}</Text>
        </View>
      </View>
    );
  }, [parentName, eleveInfo, route.params, navigation]);

  // Initialisation de l'écran
  useEffect(() => {
    // Configurer le titre de la page avec un composant personnalisé
    navigation.setOptions({
      headerTitle: () => <ConversationHeader />,
      headerLeft: () => null, // Masquer le bouton de retour par défaut
      headerStyle: {
        elevation: 0, // Supprimer l'ombre sur Android
        shadowOpacity: 0, // Supprimer l'ombre sur iOS
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
      },
    });
    
    // Pré-remplir le champ de message si un message initial est fourni
    if (initialMessage) {
      setNewMessage(initialMessage);
    }
    
    // Initialiser les données
    const initScreen = async () => {
      try {
        // Vérifier si l'utilisateur est authentifié
        const storedToken = await storage.getItem('userToken');
        const userId = await storage.getItem('userId');
        
        console.log('Token et ID utilisateur récupérés:', { token: !!storedToken, userId });
        
        if (!storedToken) {
          console.log('Aucun token trouvé, utilisateur peut-être déconnecté');
          return;
        }
        
        // Mettre à jour le token dans l'API
        setToken(storedToken);
        
        // Charger les messages
        await loadMessages(true, userId);
        
        // Marquer la conversation comme lue
        try {
          const response = await markConversationAsRead(conversationId);
          console.log(`${response.count} messages marqués comme lus`);
        } catch (err) {
          console.error(`Erreur lors du marquage de la conversation ${conversationId}:`, err);
        }
        
        // Configurer un intervalle pour rafraîchir les messages
        const interval = setInterval(() => {
          if (isMounted.current) {
            loadMessages(false, userId); // Charger sans afficher le loader
          }
        }, 3000); // Rafraîchir toutes les 3 secondes pour une meilleure réactivité
        
        setRefreshInterval(interval);
      } catch (error) {
        console.error('Erreur lors de l\'initialisation de l\'écran:', error);
      }
    };
    
    // Exécuter l'initialisation
    initScreen();
    
    // Nettoyer lors du démontage du composant
    return () => {
      isMounted.current = false;
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [conversationId]); // Ne dépendre que de conversationId pour éviter des rechargements inutiles

  // Charger les messages de la conversation
  const loadMessages = async (showLoader = true, userId = null, resetPagination = false) => {
    try {
      // Vérifier si le composant est toujours monté
      if (!isMounted.current) {
        console.log('Composant démonté, chargement des messages annulé');
        return;
      }
      
      if (showLoader && isMounted.current) {
        setLoading(true);
      }
      
      // Vérifier que nous avons bien un ID de conversation
      if (!conversationId) {
        console.error('Aucun ID de conversation fourni');
        if (isMounted.current) {
          Alert.alert('Erreur', 'Impossible de charger les messages: conversation non identifiée');
          setLoading(false);
        }
        return;
      }
      
      console.log(`Chargement des messages pour la conversation ${conversationId}...`);
      
      // Stocker le dernier ID de message pour la détection de nouveaux messages
      let lastMessageId = null;
      if (messages.length > 0 && !resetPagination) {
        lastMessageId = messages[messages.length - 1].id;
      }
      
      // Si nous n'avons pas d'ID utilisateur, le récupérer
      let currentUserId = userId;
      if (!currentUserId) {
        currentUserId = await storage.getItem('userId');
      }
      
      // Récupérer les informations de l'utilisateur
      const userRole = await storage.getItem('userRole') || 'enseignant';
      const userNom = await storage.getItem('userNom') || '';
      const userPrenom = await storage.getItem('userPrenom') || '';
      
      console.log(`Chargement des messages en tant que ${userRole}`);
      console.log(`Utilisateur: ${userPrenom} ${userNom} (ID: ${currentUserId})`);
      
      // Récupérer les messages de la conversation
      console.log(`Récupération des messages de la conversation ${conversationId}...`);
      const messagesData = await getMessagesConversation(conversationId, currentUserId, userRole);
      
      if (!messagesData || messagesData.length === 0) {
        console.log('Aucun message trouvé pour cette conversation');
        setMessages([]);
        setLoading(false);
        return;
      }
      
      console.log(`${messagesData.length} messages reçus pour la conversation ${conversationId}`);
      
      // Transformer les données pour correspondre à notre format d'affichage
      const formattedMessages = messagesData.map(msg => {
        // Vérifier que nous avons un contenu valide
        if (!msg.contenu && !msg.text) {
          console.warn('Message sans contenu détecté:', msg.id);
        }
        
        // Vérifier que nous avons une date valide
        const dateStr = msg.date_envoi || msg.timestamp;
        if (!dateStr) {
          console.warn('Message sans date détecté:', msg.id);
        }
        
        // Convertir les IDs en chaînes pour une comparaison fiable
        const expediteurId = msg.expediteur?.toString() || '';
        const userId = currentUserId?.toString() || '';
        const expediteurDetailsId = msg.expediteur_details?.id?.toString() || '';
        
        // Déterminer si le message est de l'utilisateur courant
        const isFromCurrentUser = userId && (expediteurId === userId || expediteurDetailsId === userId);
        
        // Obtenir les détails de l'expéditeur
        let expediteurDetails = msg.expediteur_details || {};
        
        // Simplifier la gestion des détails d'expéditeur
        if (isFromCurrentUser) {
          // Si c'est un message de l'utilisateur courant
          expediteurDetails = {
            id: msg.expediteur || currentUserId,
            nom: 'Vous',
            prenom: '',
            role: userRole
          };
        } else {
          // Si c'est un message d'un autre utilisateur
          if (userRole === 'enseignant') {
            // Si l'utilisateur est un enseignant, l'autre est un parent
            expediteurDetails = {
              id: msg.expediteur || 0,
              nom: parentName?.nom || parentName || 'Parent',
              prenom: parentName?.prenom || '',
              role: 'parent'
            };
          } else {
            // Si l'utilisateur est un parent, l'autre est un enseignant
            expediteurDetails = {
              id: msg.expediteur || 0,
              nom: 'Enseignant',
              prenom: '',
              role: 'enseignant'
            };
          }
        }
        
        return {
          id: msg.id?.toString() || `temp-${Date.now()}`,
          contenu: msg.contenu || '',
          texte: msg.contenu || '',
          date_envoi: msg.date_envoi ? new Date(msg.date_envoi) : new Date(),
          date: msg.date_envoi ? new Date(msg.date_envoi) : new Date(),
          expediteur: expediteurDetails,
          expediteur_details: expediteurDetails,
          lu: msg.lu || false,
          est_de_moi: isFromCurrentUser
        };
      });
      
      // Trier les messages par date (du plus ancien au plus récent)
      formattedMessages.sort((a, b) => {
        const dateA = a.date_envoi || a.date;
        const dateB = b.date_envoi || b.date;
        return dateA - dateB;
      });
      
      // Vérifier s'il y a de nouveaux messages
      if (formattedMessages.length > 0) {
        const latestMessageId = formattedMessages[formattedMessages.length - 1].id;
        
        // Si nous avons un dernier ID de message et qu'il est différent du nouveau dernier message
        if (lastMessageId && latestMessageId !== lastMessageId) {
          console.log('Nouveaux messages détectés!');
          
          // Faire défiler jusqu'au dernier message si nous ne sommes pas en train de taper
          if (!sending && flatListRef.current) {
            setTimeout(() => {
              if (flatListRef.current) {
                flatListRef.current.scrollToEnd({ animated: true });
              }
            }, 300);
          }
          
          // Marquer la conversation comme lue
          try {
            const response = await markConversationAsRead(conversationId);
            console.log(`${response.count} messages marqués comme lus`);
          } catch (markError) {
            console.error(`Erreur lors du marquage de la conversation ${conversationId}:`, markError);
          }
        }
        
        // Mettre à jour le dernier ID de message
        setLastMessageId(latestMessageId);
      }
      
      // Gérer la pagination des messages
      if (isMounted.current) {
        // Stocker tous les messages
        setAllMessages(formattedMessages);
        
        // Réinitialiser la pagination si demandé
        if (resetPagination) {
          setCurrentPage(1);
        }
        
        // Calculer le nombre total de pages
        const totalPages = Math.ceil(formattedMessages.length / messagesPerPage);
        
        // Déterminer s'il y a plus de messages à afficher
        const hasMore = formattedMessages.length > messagesPerPage;
        setHasMoreMessages(hasMore);
        console.log(`Nombre total de messages: ${formattedMessages.length}, Affichage de ${messagesPerPage} messages par page, Il y a ${hasMore ? 'plus' : 'pas plus'} de messages à afficher`);
        
        // Extraire les messages à afficher en fonction de la pagination
        // Toujours afficher les messages les plus récents (les derniers de la liste)
        const startIndex = Math.max(0, formattedMessages.length - (currentPage * messagesPerPage));
        const endIndex = formattedMessages.length;
        const messagesToDisplay = formattedMessages.slice(startIndex, endIndex);
        
        console.log(`Affichage des messages ${startIndex + 1} à ${endIndex} sur ${formattedMessages.length}`);
        
        // Mettre à jour l'état avec les messages à afficher
        setDisplayedMessages(messagesToDisplay);
        setMessages(messagesToDisplay);
        
        // Mettre à jour l'état de chargement
        if (showLoader) {
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des messages:', error);
      if (isMounted.current) {
        setLoading(false);
        Alert.alert('Erreur', 'Une erreur est survenue lors du chargement des messages.');
      }
    }
  };

  // Fonction pour charger les messages précédents
  const loadPreviousMessages = () => {
    if (!hasMoreMessages) return;
    
    console.log(`Chargement des messages précédents, page ${currentPage + 1}`);
    setCurrentPage(prevPage => prevPage + 1);
    
    // Recalculer les messages à afficher
    const startIndex = Math.max(0, allMessages.length - ((currentPage + 1) * messagesPerPage));
    const endIndex = allMessages.length;
    const messagesToDisplay = allMessages.slice(startIndex, endIndex);
    
    console.log(`Affichage des messages ${startIndex + 1} à ${endIndex} sur ${allMessages.length}`);
    
    // Mettre à jour les messages affichés
    setDisplayedMessages(messagesToDisplay);
    setMessages(messagesToDisplay);
    
    // Vérifier s'il reste des messages à charger
    setHasMoreMessages(startIndex > 0);
  };

  const sendNewMessage = async () => {
    if (!newMessage.trim()) return;

    // Sauvegarder le message à envoyer
    const messageContent = newMessage.trim();
    console.log(`Préparation de l'envoi du message: "${messageContent}"`);
    
    // Effacer le champ de texte immédiatement pour une meilleure expérience utilisateur
    setNewMessage('');
    
    // Activer l'indicateur d'envoi
    setSending(true);
    
    // Créer un ID temporaire pour le message
    const tempId = `temp-${Date.now()}`;
    
    try {
      // Récupérer l'ID de l'utilisateur courant et ses informations
      const userId = await storage.getItem('userId');
      const userNom = await storage.getItem('userNom');
      const userPrenom = await storage.getItem('userPrenom');
      const userRole = await storage.getItem('userRole') || 'enseignant';
      
      console.log('ID utilisateur pour l\'envoi du message:', userId);
      console.log('Rôle de l\'utilisateur:', userRole);
      
      // Récupérer l'ID du destinataire (parent) si disponible
      let destinataireId = null;
      if (parentName && parentName.id) {
        destinataireId = parentName.id;
        console.log(`ID du destinataire (parent) récupéré pour l'envoi du message: ${destinataireId}`);
      } else {
        // Essayer de récupérer les détails de la conversation pour trouver le destinataire
        try {
          // Vérifier d'abord si nous avons des détails du parent dans les paramètres de navigation
          if (route.params && route.params.parentDetails) {
            const parentDetails = route.params.parentDetails;
            console.log('Détails du parent trouvés dans les paramètres de navigation:', parentDetails);
            destinataireId = parentDetails.id;
          } else {
            // Essayer de récupérer les détails de la conversation depuis l'API
            console.log(`Tentative de récupération des détails de la conversation ${conversationId}...`);
            
            // Récupérer la liste des conversations pour trouver celle qui nous intéresse
            const conversationsResponse = await api.get('/conversations/');
            if (conversationsResponse.data) {
              // Convertir en tableau si nécessaire
              const conversations = Array.isArray(conversationsResponse.data) ? 
                conversationsResponse.data : 
                (conversationsResponse.data.results || []);
              
              // Trouver la conversation spécifique
              const currentConversation = conversations.find(c => c.id === parseInt(conversationId));
              
              if (currentConversation) {
                console.log(`Conversation ${conversationId} trouvée dans la liste:`, currentConversation);
                
                // Trouver le parent dans participants_details
                if (currentConversation.participants_details && Array.isArray(currentConversation.participants_details)) {
                  const currentUserId = userId?.toString() || '';
                  const parentParticipant = currentConversation.participants_details.find(p => {
                    const participantId = p.id?.toString() || '';
                    return participantId !== currentUserId && p.role === 'parent';
                  });
                  
                  if (parentParticipant) {
                    destinataireId = parentParticipant.id;
                    console.log(`Destinataire trouvé dans les détails de la conversation:`, parentParticipant);
                  }
                }
              } else {
                console.warn(`Conversation ${conversationId} non trouvée dans la liste des conversations`);
              }
            }
          }
        } catch (error) {
          console.error('Erreur lors de la récupération des détails de la conversation:', error.response?.data || error.message);
        }
      }
      
      // Créer un message temporaire pour l'afficher immédiatement
      const tempMessage = {
        id: tempId,
        texte: messageContent,
        contenu: messageContent,
        date: new Date(),
        date_envoi: new Date(),
        est_de_moi: true,
        lu: false,
        expediteur: {
          id: userId || authContext.userId,
          role: 'enseignant'
        },
        expediteur_details: {
          id: userId || authContext.userId,
          nom: userNom || 'Vous',
          prenom: userPrenom || '',
          role: 'enseignant'
        }
      };
      
      // Ajouter le message temporaire à la liste des messages
      const updatedMessages = [...messages, tempMessage];
      
      // Trier les messages par date
      updatedMessages.sort((a, b) => {
        const dateA = a.date_envoi || a.date;
        const dateB = b.date_envoi || b.date;
        return dateA - dateB;
      });
      
      // Mettre à jour l'état avec le nouveau message
      setMessages(updatedMessages);
      
      // Faire défiler jusqu'au dernier message
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
      
      // Envoyer le message à l'API
      console.log(`Envoi du message à la conversation ${conversationId} avec destinataire ${destinataireId}`);
      try {
        // Vérifier que nous avons toutes les informations nécessaires
        if (!conversationId) {
          throw new Error('ID de conversation manquant');
        }
        
        // Vérifier que nous avons un destinataire
        if (!destinataireId && route.params && route.params.parentDetails) {
          destinataireId = route.params.parentDetails.id;
          console.log(`ID du destinataire récupéré depuis les paramètres de navigation: ${destinataireId}`);
        }
        
        if (!destinataireId) {
          console.warn('Aucun destinataire spécifié pour l\'envoi du message, tentative d\'envoi sans destinataire');
        }
        
        // Ajouter l'ID de l'élève si disponible
        let eleveId = null;
        if (eleveInfo && eleveInfo.id) {
          eleveId = eleveInfo.id;
          console.log(`ID de l'élève pour le message: ${eleveId}`);
          await storage.setItem('currentEleveId', eleveId.toString());
        } else {
          // Essayer de récupérer l'ID de l'élève depuis le stockage
          eleveId = await storage.getItem('currentEleveId');
          console.log(`ID de l'élève récupéré du stockage: ${eleveId}`);
        }
        
        // Envoyer le message avec toutes les informations disponibles
        console.log(`Envoi du message avec: conversationId=${conversationId}, destinataireId=${destinataireId}, eleveId=${eleveId}`);
        const response = await sendMessage(conversationId, messageContent, destinataireId);
        console.log('Réponse après envoi du message:', response);
        
        // Si l'envoi a réussi, recharger les messages pour obtenir le message envoyé
        // Attendre un court instant pour s'assurer que le message est bien enregistré côté serveur
        setTimeout(async () => {
          try {
            // Forcer un rechargement complet des messages
            await loadMessages(true, userId, true); // true pour reset la pagination
            
            // Faire défiler jusqu'au dernier message
            if (flatListRef.current) {
              flatListRef.current.scrollToEnd({ animated: true });
            }
            
            console.log('Messages rechargés avec succès après envoi');
          } catch (reloadError) {
            console.error('Erreur lors du rechargement des messages après envoi:', reloadError);
          }
        }, 500);
        
        // Mettre à jour la conversation pour qu'elle apparaisse en haut de la liste
        try {
          await api.post(`/conversations/${conversationId}/touch/`, {});
          console.log(`Conversation ${conversationId} mise à jour pour apparaître en haut de la liste`);
        } catch (touchError) {
          console.warn(`Impossible de mettre à jour la conversation ${conversationId}:`, touchError);
        }
      } catch (apiError) {
        console.error('Erreur lors de l\'envoi du message via l\'API:', apiError);
        console.error('Détails de l\'erreur:', apiError.response?.data || apiError.message);
        
        // Message d'erreur plus détaillé
        const errorMessage = apiError.response?.data?.detail || 
                            apiError.response?.data?.error || 
                            apiError.message || 
                            'Une erreur est survenue lors de l\'envoi du message';
        
        Alert.alert(
          'Erreur', 
          `Le message a été affiché localement mais n'a pas pu être envoyé au serveur: ${errorMessage}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer le message. Veuillez réessayer.');
    } finally {
      setSending(false);
    }
  };

  // Afficher les détails de l'élève dans une modal
  const showEleveDetails = () => {
    console.log('Affichage des détails de l\'élève:', eleveInfo);
    if (eleveInfo) {
      // Afficher l'URL de la photo pour débogage
      if (eleveInfo.photo) {
        const photoUrl = getCompletePhotoUrl(eleveInfo.photo);
        console.log('URL de la photo de l\'élève:', photoUrl);
        
        // Tester l'accès à l'image
        fetch(photoUrl)
          .then(response => {
            console.log(`Test d'accès à l'image: ${response.status}`);
          })
          .catch(error => {
            console.error('Erreur lors du test d\'accès à l\'image:', error);
          });
      }
      
      setModalVisible(true);
    }
  };

  // Composant pour afficher la photo de l'élève avec gestion des erreurs
  const EleveAvatar = ({ eleve, size = 36 }) => {
    const [hasError, setHasError] = useState(false);
    
    // Générer l'URL complète de la photo
    let photoUrl = null;
    if (eleve && eleve.photo) {
      // Nettoyer l'URL de la photo si nécessaire
      let cleanPhotoUrl = eleve.photo;
      if (typeof cleanPhotoUrl === 'string') {
        // Supprimer les guillemets si présents
        cleanPhotoUrl = cleanPhotoUrl.replace(/["']/g, '');
      }
      photoUrl = getCompletePhotoUrl(cleanPhotoUrl);
      console.log('URL de la photo nettoyée:', photoUrl);
    }
    
    // Styles dynamiques basés sur la taille
    const containerStyle = {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: hasError || !photoUrl ? '#0066cc' : '#e1e1e1',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#fff',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 1,
      elevation: 2,
      overflow: 'hidden'
    };
    
    const textStyle = {
      color: '#fff',
      fontSize: size * 0.5,
      fontWeight: 'bold',
    };
    
    // Si nous avons une URL de photo et pas d'erreur, afficher l'image
    if (photoUrl && !hasError) {
      // Tester l'accès à l'image
      fetch(photoUrl)
        .then(response => {
          if (!response.ok) {
            console.log(`Test d'accès à l'image a échoué: ${response.status}`);
            setHasError(true);
          } else {
            console.log(`Test d'accès à l'image réussi: ${response.status}`);
          }
        })
        .catch(error => {
          console.error('Erreur lors du test d\'accès à l\'image:', error);
          setHasError(true);
        });
        
      return (
        <View style={containerStyle}>
          <Image 
            source={{ uri: photoUrl }}
            style={{ width: size, height: size }}
            resizeMode="cover"
            onError={(e) => {
              console.log('Erreur de chargement de l\'image:', e.nativeEvent.error);
              console.log('URL de l\'image qui a échoué:', photoUrl);
              setHasError(true);
            }}
          />
        </View>
      );
    }
    
    // Sinon, afficher les initiales
    return (
      <View style={containerStyle}>
        <Text style={textStyle}>
          {eleve && eleve.prenom ? eleve.prenom.charAt(0).toUpperCase() : '?'}
        </Text>
      </View>
    );
  };

  const renderMessageItem = ({ item }) => {
    // Déterminer si le message est de l'enseignant (utilisateur actuel) ou du parent
    const isTeacher = item.expediteur?.role === 'enseignant' || 
                     (item.expediteur_details?.role === 'enseignant') ||
                     (authContext.userId && item.expediteur?.toString() === authContext.userId.toString());
    
    // Formater la date du message
    const messageDate = typeof item.date_envoi === 'string' ? new Date(item.date_envoi) : 
                      (item.date ? new Date(item.date) : new Date());
    
    // Obtenir le contenu du message
    const messageContent = item.contenu || item.texte || '';
    
    return (
      <View style={[styles.messageContainer, isTeacher ? styles.teacherMessage : styles.parentMessage]}>
        <View style={styles.messageContentContainer}>
          {/* Bulle de message sans nom ni photo */}
          <View style={[styles.messageBubble, isTeacher ? styles.teacherBubble : styles.parentBubble]}>
            <Text
              style={[
                styles.messageContent,
                isTeacher ? styles.teacherText : styles.parentText,
                { flexShrink: 1, flexWrap: 'wrap' }
              ]}
            >
              {messageContent}
            </Text>
            <Text style={[styles.messageTime, isTeacher ? styles.teacherTime : styles.parentTime]}>
              {messageDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              {isTeacher && item.lu ? ' ✓✓' : (isTeacher ? ' ✓' : '')}
            </Text>
          </View>
        </View>
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessageItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesContainer}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={
            hasMoreMessages ? (
              <TouchableOpacity 
                style={styles.loadMoreButton}
                onPress={loadPreviousMessages}
              >
                <Text style={styles.loadMoreButtonText}>Voir les messages précédents</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Tapez votre message..."
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
        />
        <TouchableOpacity 
          style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
          onPress={sendNewMessage}
          disabled={!newMessage.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>⌯⌲</Text>
          )}
        </TouchableOpacity>
      </View>
      
      {/* Modal pour afficher les détails de l'élève */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
            
            <Text style={styles.modalTitle}>Informations sur l'élève</Text>
            
            {eleveInfo ? (
              eleveInfo.photo ? (
                <Image 
                  source={{ uri: getCompletePhotoUrl(eleveInfo.photo) }}
                  style={styles.modalPhoto}
                  resizeMode="cover"
                  onError={(e) => {
                    console.log('Erreur de chargement de l\'image dans la modal:', e.nativeEvent.error);
                    console.log('URL de l\'image:', getCompletePhotoUrl(eleveInfo.photo));
                  }}
                />
              ) : (
                <View style={styles.modalPhotoPlaceholder}>
                  <Text style={styles.modalPhotoPlaceholderText}>
                    {eleveInfo.prenom ? eleveInfo.prenom.charAt(0).toUpperCase() : '?'}
                  </Text>
                </View>
              )
            ) : null}
            
            <Text style={styles.modalName}>{eleveInfo?.prenom} {eleveInfo?.nom}</Text>
            
            <TouchableOpacity 
              style={styles.viewProfileButton}
              onPress={() => {
                setModalVisible(false);
                // Naviguer vers le profil de l'élève si nécessaire
                // navigation.navigate('EleveProfile', { eleveId: eleveInfo.id });
              }}
            >
              <Text style={styles.viewProfileButtonText}>Voir le profil complet</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Styles pour l'en-tête personnalisé
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: '#fff',
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 5,
    marginRight: 10,
  },
  avatarContainer: {
    marginRight: 12,
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
    backgroundColor: '#fff',
  },
  headerAvatar: {
    borderRadius: 25,
  },
  headerTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesContainer: {
    padding: 16,
    paddingBottom: 16,
  },
  messageContainer: {
    marginBottom: 8,
    flexDirection: 'column',
  },
  messageContentContainer: {
    flexDirection: 'column',
  },
  parentNameText: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'bold',
    marginBottom: 2,
    marginLeft: 4,
  },
  teacherMessage: {
    alignItems: 'flex-end',
    paddingLeft: '15%',
  },
  parentMessage: {
    alignItems: 'flex-start',
    paddingRight: '15%',
  },
  messageBubble: {
    borderRadius: 18,
    padding: 12,
    maxWidth: '100%',
  },
  teacherBubble: {
    backgroundColor: '#0078FF',
    borderBottomRightRadius: 0,
  },
  parentBubble: {
    backgroundColor: '#F1F0F0',
    borderBottomLeftRadius: 0,
  },
  messageContent: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
    wordBreak: 'break-word', // RN Web only – safe on native
  },
  teacherText: {
    color: '#fff',
  },
  parentText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  teacherTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  parentTime: {
    color: '#999',
  },
  elevePhotoContainer: {
    marginRight: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
    position: 'relative',
    left: 0,
  },
  elevePhoto: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#e1e1e1',
  },
  photoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#0066cc',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
  },
  viewProfileButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  loadMoreButton: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 20,
    alignItems: 'center',
    marginVertical: 10,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  loadMoreButtonText: {
    color: '#0066cc',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
