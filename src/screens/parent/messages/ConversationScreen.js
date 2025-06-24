import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getMessagesConversation, sendMessage, markConversationAsRead } from '../../../services/messagerie';
import { formatMessageDate, formatTime, isSameDay } from '../../../utils/dateUtils';
import AuthContext from '../../../contexts/AuthContext';
import storage from '../../../services/storage';
import { setToken } from '../../../services/api';

export default function ConversationScreen({ route, navigation }) {
  const { conversationId, otherUser, eleveDetails } = route.params || {};
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputHeight, setInputHeight] = useState(40);
  const [authError, setAuthError] = useState(false);
  const flatListRef = useRef();
  const { token } = useContext(AuthContext);
  const [refreshInterval, setRefreshInterval] = useState(null);
  
  // Référence pour savoir si le composant est monté
  const isMounted = useRef(true);

  // Regrouper les messages par date pour l'affichage
  const [groupedMessages, setGroupedMessages] = useState([]);
  
  // États pour la pagination des messages
  const [allMessages, setAllMessages] = useState([]);
  const [displayedMessages, setDisplayedMessages] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const messagesPerPage = 10;
  
  console.log('Ouverture de la conversation:', { conversationId, otherUser, eleveDetails });

  // Composant d'en-tête personnalisé pour afficher les détails de l'enseignant
  const ConversationHeader = useCallback(() => {
    // Récupérer les informations de l'enseignant
    let displayName = 'Enseignant';
    let specialite = '';
    
    // Vérifier si nous avons les détails de l'enseignant
    if (otherUser) {
      if (otherUser.prenom && otherUser.nom) {
        displayName = `${otherUser.prenom} ${otherUser.nom}`;
      } else if (otherUser.nom) {
        displayName = otherUser.nom;
      } else if (otherUser.prenom) {
        displayName = otherUser.prenom;
      }
      
      // Récupérer la spécialité ou matière
      specialite = otherUser.specialite || otherUser.matiere || '';
    }
    
    console.log('Affichage de l\'en-tête avec:', { displayName, specialite });
    
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
        
        {/* Avatar de l'enseignant */}
        <View style={styles.headerAvatar}>
          <Text style={styles.avatarText}>
            {displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        
        {/* Informations de l'enseignant */}
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>{displayName}</Text>
          {specialite ? <Text style={styles.headerSubtitle}>{specialite}</Text> : null}
        </View>
      </View>
    );
  }, [otherUser, navigation]);
  
  // Initialisation de l'écran
  const initScreen = async () => {
    try {
      // Vérifier si l'utilisateur est authentifié
      const storedToken = await storage.getItem('userToken');
      const userId = await storage.getItem('userId');
      
      console.log('Token et ID utilisateur récupérés:', { token: !!storedToken, userId });
      
      if (!storedToken) {
        console.log('Aucun token trouvé, redirection vers la page de connexion');
        setAuthError(true);
        setLoading(false);
        return;
      }
      
      // Mettre à jour le token dans l'API
      setToken(storedToken);
      
      // Configurer l'en-tête de navigation avec le composant personnalisé
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
      
      console.log('En-tête personnalisé configuré pour afficher les détails de l\'enseignant');
      
      // Stocker l'ID de l'utilisateur pour identifier ses messages
      if (userId) {
        console.log('ID utilisateur récupéré du stockage:', userId);
      }
      
      // Charger les messages
      await loadMessages(true, userId);
      
      // Marquer la conversation comme lue
      try {
        const response = await markConversationAsRead(conversationId);
        console.log(`${response.count} messages marqués comme lus`);
      } catch (err) {
        console.error(`Erreur lors du marquage de la conversation ${conversationId}:`, err);
      }        // Configurer un intervalle pour rafraîchir les messages
      const interval = setInterval(() => {
        loadMessages(false, userId); // Charger sans afficher le loader
      }, 3000); // Rafraîchir toutes les 3 secondes pour une meilleure réactivité
      
      setRefreshInterval(interval);
    } catch (error) {
      console.error('Erreur lors de l\'initialisation de l\'écran:', error);
      if (error.response && error.response.status === 401) {
        setAuthError(true);
      } else {
        Alert.alert('Erreur', 'Une erreur est survenue lors du chargement de la conversation');
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initialiser la référence isMounted à true au montage du composant
    isMounted.current = true;
    
    initScreen();
    
    // Stocker l'ID de l'élève si disponible pour l'utiliser lors de l'envoi des messages
    if (eleveDetails && eleveDetails.id) {
      console.log(`Stockage de l'ID de l'élève ${eleveDetails.id} pour la conversation`);
      storage.setItem('currentEleveId', eleveDetails.id.toString());
    }
    
    // Nettoyage à la fermeture de l'écran
    return () => {
      // Marquer le composant comme démonté
      isMounted.current = false;
      
      // Nettoyer les intervalles
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
      
      console.log('Composant ConversationScreen démonté');
    };
  }, []);

  // Regrouper les messages par date pour l'affichage
  const groupMessagesByDate = (msgs) => {
    // Vérifier que nous avons des messages valides
    if (!msgs || msgs.length === 0) {
      console.log('Aucun message à grouper');
      return [];
    }
    
    console.log(`Groupement de ${msgs.length} messages par date`);
    
    // Trier les messages par date (du plus ancien au plus récent)
    const sortedMsgs = [...msgs].sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA - dateB;
    });
    
    const groups = [];
    let currentDate = null;
    let currentGroup = [];
    
    sortedMsgs.forEach(msg => {
      // S'assurer que la date est valide
      if (!msg.date) {
        console.warn('Message sans date détecté:', msg.id);
        msg.date = new Date(); // Utiliser la date actuelle comme fallback
      }
      
      const messageDate = new Date(msg.date);
      const messageDay = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
      
      if (!currentDate || !isSameDay(messageDay, currentDate)) {
        // Nouvelle date, créer un nouveau groupe
        if (currentGroup.length > 0) {
          groups.push({
            date: currentDate,
            data: currentGroup
          });
        }
        currentDate = messageDay;
        currentGroup = [msg];
      } else {
        // Même date, ajouter au groupe actuel
        currentGroup.push(msg);
      }
    });
    
    // Ajouter le dernier groupe
    if (currentGroup.length > 0) {
      groups.push({
        date: currentDate,
        data: currentGroup
      });
    }
    
    console.log(`${groups.length} groupes créés`);
    groups.forEach((group, i) => {
      console.log(`Groupe ${i+1}: ${formatMessageDate(group.date)} - ${group.data.length} messages`);
    });
    
    return groups;
  };

  const loadMessages = async (showLoader = true, userId = null) => {
    try {
      // Vérifier que le composant est toujours monté avant de continuer
      if (!isMounted.current) {
        console.log('Composant démonté, chargement des messages annulé');
        return;
      }
      
      if (showLoader && isMounted.current) setLoading(true);
      
      // Vérifier que nous avons bien un ID de conversation
      if (!conversationId) {
        console.error('Aucun ID de conversation fourni');
        if (isMounted.current) {
          Alert.alert('Erreur', 'Impossible de charger les messages: conversation non identifiée');
          setLoading(false);
        }
        return;
      }
      
      // Récupérer l'ID de l'utilisateur du stockage si non fourni
      let currentUserId = userId;
      if (!currentUserId) {
        currentUserId = await storage.getItem('userId');
        console.log('ID utilisateur récupéré du stockage dans loadMessages:', currentUserId);
      }
      
      console.log(`Chargement des messages pour la conversation ${conversationId}...`);
      
      // Charger les messages depuis l'API
      const messagesData = await getMessagesConversation(conversationId);
      
      // Vérifier si nous avons des données
      if (!messagesData || messagesData.length === 0) {
        console.log('Aucun message trouvé pour cette conversation');
        if (isMounted.current) {
          // Ne pas vider les messages existants si nous n'en recevons pas de nouveaux
          // Cela évite que les messages disparaissent après un rechargement automatique
          if (showLoader) {
            setLoading(false);
          }
        }
        return;
      }
      
      console.log(`${messagesData.length} messages reçus pour la conversation ${conversationId}`);
      
      // Transformer les données pour correspondre à notre format d'affichage
      const formattedMessages = messagesData.map(msg => {
        // Afficher chaque message pour débogage
        console.log('Transformation du message:', JSON.stringify(msg, null, 2));
        
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
        
        console.log(`Message ${msg.id} - expéditeur ID: ${expediteurId}, utilisateur ID: ${userId}, est de moi: ${isFromCurrentUser}`);
        
        // Obtenir les détails de l'expéditeur
        let expediteurDetails = msg.expediteur_details || {};
        
        // Si expediteur_details n'existe pas ou est incomplet
        if (!expediteurDetails || Object.keys(expediteurDetails).length === 0) {
          // Si c'est un message de l'utilisateur courant
          if (isFromCurrentUser) {
            expediteurDetails = {
              id: msg.expediteur || currentUserId,
              nom: 'Vous',
              prenom: '',
              role: 'parent'
            };
          } 
          // Si c'est un message de l'enseignant, utiliser les détails de otherUser
          else if (otherUser && otherUser.id) {
            expediteurDetails = {
              id: msg.expediteur || otherUser.id,
              nom: otherUser.nom || 'Enseignant',
              prenom: otherUser.prenom || '',
              role: 'enseignant',
              specialite: otherUser.specialite || ''
            };
          } 
          // Fallback si aucune information n'est disponible
          else {
            expediteurDetails = {
              id: msg.expediteur || 0,
              nom: 'Enseignant',
              prenom: '',
              role: 'enseignant'
            };
          }
        }
        
        console.log(`Message ${msg.id} - détails expéditeur:`, expediteurDetails);
        
        return {
          id: msg.id ? msg.id.toString() : `temp-${Date.now()}`,
          texte: msg.contenu || msg.text || '',
          contenu: msg.contenu || msg.text || '',
          date: dateStr ? new Date(dateStr) : new Date(),
          est_de_moi: isFromCurrentUser,
          lu: msg.lu || msg.is_read || false,
          expediteur_details: expediteurDetails
        };
      });
      
      // Fusionner avec les messages existants pour éviter de perdre des messages
      // lors du rechargement automatique
      const mergedMessages = [...messages];
      
      // Ajouter uniquement les nouveaux messages qui ne sont pas déjà dans la liste
      formattedMessages.forEach(newMsg => {
        if (!mergedMessages.some(existingMsg => existingMsg.id === newMsg.id)) {
          mergedMessages.push(newMsg);
        }
      });
      
      console.log(`${mergedMessages.length} messages après fusion (${messages.length} existants + ${formattedMessages.length} nouveaux)`);
      
      // Trier les messages par date (du plus ancien au plus récent)
      mergedMessages.sort((a, b) => a.date - b.date);
      
      // Stocker tous les messages
      setAllMessages(mergedMessages);
      
      // Gérer la pagination des messages
      // Calculer le nombre total de pages
      const totalPages = Math.ceil(mergedMessages.length / messagesPerPage);
      
      // Déterminer s'il y a plus de messages à afficher
      const hasMore = mergedMessages.length > messagesPerPage;
      setHasMoreMessages(hasMore);
      console.log(`Nombre total de messages: ${mergedMessages.length}, Affichage de ${messagesPerPage} messages par page, Il y a ${hasMore ? 'plus' : 'pas plus'} de messages à afficher`);
      
      // Extraire les messages à afficher en fonction de la pagination
      // Toujours afficher les messages les plus récents (les derniers de la liste)
      const startIndex = Math.max(0, mergedMessages.length - (currentPage * messagesPerPage));
      const endIndex = mergedMessages.length;
      const messagesToDisplay = mergedMessages.slice(startIndex, endIndex);
      
      console.log(`Affichage des messages ${startIndex + 1} à ${endIndex} sur ${mergedMessages.length}`);
      
      // Grouper les messages par date
      const grouped = groupMessagesByDate(messagesToDisplay);
      
      console.log(`${messagesToDisplay.length} messages prêts à afficher, ${grouped.length} groupes`);
      
      // Vérifier que le composant est toujours monté avant de mettre à jour l'état
      if (isMounted.current) {
        setMessages(messagesToDisplay);
        setDisplayedMessages(messagesToDisplay);
        setGroupedMessages(grouped);
        
        // Faire défiler jusqu'au dernier message
        setTimeout(() => {
          if (flatListRef.current && isMounted.current) {
            flatListRef.current.scrollToEnd({ animated: false });
          }
        }, 200);
      } else {
        console.log('Composant démonté, mise à jour des messages annulée');
      }
    } catch (error) {
      console.error('Erreur lors du chargement des messages:', error);
      
      // Vérifier si l'erreur est due à un problème d'authentification
      if (error.response && error.response.status === 401 && isMounted.current) {
        setAuthError(true);
      } else if (showLoader && isMounted.current) {
        Alert.alert('Erreur', 'Impossible de charger les messages');
      }
    } finally {
      if (showLoader && isMounted.current) setLoading(false);
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
    
    // Grouper les messages par date
    const grouped = groupMessagesByDate(messagesToDisplay);
    
    // Mettre à jour les messages affichés
    setDisplayedMessages(messagesToDisplay);
    setMessages(messagesToDisplay);
    setGroupedMessages(grouped);
    
    // Vérifier s'il reste des messages à charger
    setHasMoreMessages(startIndex > 0);
  };

  const handleSendMessage = async () => {
    if (newMessage.trim() === '') return;

    // Vérifier que le composant est toujours monté
    if (!isMounted.current) {
      console.log('Composant démonté, envoi du message annulé');
      return;
    }

    // Vérifier que nous avons bien un ID de conversation
    if (!conversationId) {
      Alert.alert('Erreur', 'Impossible d\'envoyer le message: conversation non identifiée');
      return;
    }
    
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
      // Récupérer l'ID de l'utilisateur courant
      const userId = await storage.getItem('userId');
      console.log('ID utilisateur pour l\'envoi du message:', userId);
      
      // Récupérer le nom et prénom de l'utilisateur pour l'affichage
      const userNom = await storage.getItem('userNom');
      const userPrenom = await storage.getItem('userPrenom');

      // Récupérer l'ID du destinataire (enseignant) si disponible
      let destinataireId = null;
      if (otherUser && otherUser.id) {
        destinataireId = otherUser.id;
        console.log(`ID du destinataire (enseignant) récupéré pour l'envoi du message: ${destinataireId}`);
      } else {
        console.warn('Aucun ID de destinataire disponible pour l\'envoi du message');

        // Essayer de récupérer les détails de la conversation pour trouver le destinataire
        try {
          const response = await api.get(`/conversations/${conversationId}/`);
          console.log(`Détails de la conversation ${conversationId}:`, response.data);

          if (response.data && response.data.participants_details) {
            // Trouver l'autre utilisateur dans participants_details
            const currentUserId = userId?.toString() || '';
            const otherParticipant = response.data.participants_details.find(p => {
              const participantId = p.id?.toString() || '';
              return participantId !== currentUserId;
            });

            if (otherParticipant) {
              destinataireId = otherParticipant.id;
              console.log(`Destinataire trouvé dans les détails de la conversation:`, otherParticipant);

              // Mettre à jour otherUser pour les futurs messages
              setOtherUser(otherParticipant);
            }
          }
        } catch (error) {
          console.error('Erreur lors de la récupération des détails de la conversation:', error);
        }
      }

      // Récupérer l'ID de l'élève si disponible
      let eleveId = null;
      if (eleveDetails && eleveDetails.id) {
        eleveId = eleveDetails.id;
        console.log(`ID de l'élève récupéré pour l'envoi du message: ${eleveId}`);
      } else {
        // Essayer de récupérer l'ID de l'élève du stockage
        try {
          const storedEleveId = await storage.getItem('currentEleveId');
          if (storedEleveId) {
            eleveId = parseInt(storedEleveId);
            console.log(`ID de l'élève récupéré du stockage: ${eleveId}`);
          }
        } catch (error) {
          console.error('Erreur lors de la récupération de l\'ID de l\'élève du stockage:', error);
        }
      }

      // Créer un message temporaire pour l'afficher immédiatement
      if (isMounted.current) {
        const tempMessage = {
          id: tempId,
          texte: messageContent,
          contenu: messageContent,
          date: new Date(),
          est_de_moi: true,
          lu: false,
          expediteur_details: {
            id: userId,
            nom: userNom || 'Vous',
            prenom: userPrenom || '',
            role: 'parent'
          }
        };

        // Ajouter le message temporaire à la liste des messages
        const updatedMessages = [...messages, tempMessage];

        // Trier les messages par date
        updatedMessages.sort((a, b) => a.date - b.date);

        // Mettre à jour l'état avec le nouveau message
        setMessages(updatedMessages);

        // Regrouper les messages par date
        const grouped = groupMessagesByDate(updatedMessages);
        setGroupedMessages(grouped);

        // Faire défiler jusqu'au dernier message
        setTimeout(() => {
          if (flatListRef.current && isMounted.current) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        }, 100);
      }

      // Envoyer le message à l'API
      console.log(`Envoi du message à la conversation ${conversationId} avec destinataire ${destinataireId}`);
      const response = await sendMessage(conversationId, messageContent, destinataireId);
      console.log('Réponse après envoi du message:', response);

      // Si l'envoi a réussi, remplacer le message temporaire par le message réel
      if (response && isMounted.current) {
        // Créer un objet message complet avec toutes les propriétés nécessaires
        const newMsg = {
          id: (response.id !== undefined && response.id !== null) ? response.id.toString() : `api-${Date.now()}`,
          texte: response.contenu || response.text || messageContent,
          contenu: response.contenu || response.text || messageContent,
          date: new Date(response.date_envoi || response.timestamp || new Date()),
          expediteur: userId,
          est_de_moi: true, // Important: marquer le message comme venant du parent
          lu: false,
          expediteur_details: {
            id: parseInt(userId),
            nom: userNom || 'Vous',
            prenom: userPrenom || '',
            role: 'parent'
          }
        };
        
        console.log('Nouveau message créé après envoi réussi:', newMsg);
        
        // Mettre à jour les messages en une seule opération atomique
        setMessages(prevMessages => {
          // Filtrer le message temporaire
          const filteredMessages = prevMessages.filter(msg => msg.id !== tempId);
          // Ajouter le nouveau message
          const newMessages = [...filteredMessages, newMsg];
          
          // Trier les messages par date
          newMessages.sort((a, b) => a.date - b.date);
          
          console.log(`Messages mis à jour après envoi: ${newMessages.length} messages au total`);
          return newMessages;
        });
        
        // Mettre à jour les messages groupés
        setTimeout(() => {
          if (isMounted.current) {
            const grouped = groupMessagesByDate(messages);
            setGroupedMessages(grouped);
            
            // Faire défiler jusqu'au dernier message
            if (flatListRef.current) {
              flatListRef.current.scrollToEnd({ animated: true });
            }
          }
        }, 100);
      }
      
      // Attendre un court instant avant de recharger les messages depuis le serveur
      // Cela permet de s'assurer que le backend a bien enregistré le message
      setTimeout(() => {
        if (isMounted.current) {
          console.log('Rafraîchissement de la conversation après envoi de message');
          loadMessages(false);
        }
      }, 1500);
      
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
      
      // Détails de l'erreur pour le débogage
      if (error.response) {
        console.error('Détails de la réponse d\'erreur:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        });
      } else if (error.request) {
        console.error('Requête envoyée mais pas de réponse reçue:', error.request);
      } else {
        console.error('Erreur lors de la configuration de la requête:', error.message);
      }
      
      // Supprimer le message temporaire en cas d'erreur
      if (isMounted.current) {
        setMessages(prevMessages => {
          const updatedMessages = prevMessages.filter(msg => msg.id !== tempId);
          setGroupedMessages(groupMessagesByDate(updatedMessages));
          return updatedMessages;
        });
      }
      
      // Message d'erreur plus détaillé pour l'utilisateur
      let errorMessage = 'Impossible d\'envoyer le message';
      if (error.response && error.response.status) {
        if (error.response.status === 400) {
          errorMessage += ': données invalides';
        } else if (error.response.status === 401) {
          errorMessage += ': session expirée, veuillez vous reconnecter';
        } else if (error.response.status === 404) {
          errorMessage += ': conversation ou destinataire introuvable';
        } else {
          errorMessage += ` (code ${error.response.status})`;
        }
      } else if (error.message) {
        errorMessage += `: ${error.message}`;
      }
      
      Alert.alert('Erreur', errorMessage);
    } finally {
      // S'assurer que l'indicateur d'envoi est désactivé même en cas d'erreur
      setSending(false);
    }
  };

  // Rendu d'un en-tête de section (date)
  const renderSectionHeader = ({ date }) => {
    return (
      <View style={styles.dateHeaderContainer}>
        <Text style={styles.dateHeaderText}>
          {formatMessageDate(date)}
        </Text>
      </View>
    );
  };

  // Rendu d'un message individuel
  const renderMessage = (item, showName = true) => {
    // Déterminer si le message est du parent ou de l'enseignant
    // Utiliser plusieurs méthodes pour déterminer l'expéditeur
    let isParent = false;
    
    // 1. Vérifier la propriété est_de_moi
    if (item.est_de_moi === true) {
      isParent = true;
    }
    // 2. Vérifier le rôle dans expediteur_details
    else if (item.expediteur_details && item.expediteur_details.role === 'parent') {
      isParent = true;
    }
    // 3. Vérifier si l'ID de l'expéditeur correspond à l'ID de l'utilisateur
    else if (item.expediteur) {
      const userId = storage.getItemSync('userId');
      if (userId && item.expediteur.toString() === userId.toString()) {
        isParent = true;
      }
    }
    
    // Récupérer les détails de l'expéditeur avec des valeurs par défaut
    const expediteurDetails = item.expediteur_details || {};
    
    // Déclarer les variables en dehors des blocs conditionnels pour qu'elles soient accessibles partout
    let prenom = '';
    let nom = '';
    let specialite = '';
    
    // Pour les messages du parent (utilisateur actuel)
    if (isParent) {
      prenom = expediteurDetails.prenom || '';
      nom = expediteurDetails.nom || 'Vous';
      // Pas de spécialité pour le parent
    } 
    // Pour les messages de l'enseignant
    else {
      // Utiliser les détails de l'enseignant des paramètres de route si disponibles
      if (otherUser && otherUser.prenom && otherUser.nom) {
        prenom = otherUser.prenom;
        nom = otherUser.nom;
        specialite = otherUser.specialite || otherUser.matiere || '';
      } else {
        // Fallback aux détails de l'expéditeur si disponibles
        prenom = expediteurDetails.prenom || '';
        nom = expediteurDetails.nom || 'Enseignant';
        specialite = expediteurDetails.specialite || expediteurDetails.matiere || '';
      }
    }
    
    console.log(`Rendu du message ${item.id}:`, {
      isParent,
      est_de_moi: item.est_de_moi,
      prenom,
      nom,
      specialite,
      expediteur: item.expediteur,
      details: expediteurDetails
    });
    
    return (
      <View 
        key={item.id}
        style={[
          styles.messageContainer, 
          isParent ? styles.parentMessageContainer : styles.enseignantMessageContainer
        ]}
      >
        {!isParent && showName && (
          <View style={styles.senderInfoContainer}>
            <Text style={styles.senderName}>
              {prenom} {nom}
            </Text>
            {specialite ? (
              <Text style={styles.senderSpecialite}>
                {specialite}
              </Text>
            ) : null}
          </View>
        )}
        
        <View style={[
          styles.messageBubble, 
          isParent ? styles.parentMessageBubble : styles.enseignantMessageBubble
        ]}>
          <Text style={[styles.messageText, isParent ? styles.parentMessageText : {}]}>
            {item.texte || item.contenu || ''}
          </Text>
          
          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isParent ? styles.parentMessageTime : {}]}>
              {formatTime(new Date(item.date))}
            </Text>
            {isParent && (
              <Text style={[styles.messageStatus, item.isTemp ? styles.statusSending : (item.lu ? styles.statusRead : styles.statusSent)]}>
                {item.isTemp ? ' ⏳' : (item.lu ? ' ✓✓' : ' ✓')}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };
  
  // Rendu d'un groupe de messages pour une date donnée
  const renderMessageGroup = ({ item }) => {
    return (
      <View style={styles.messageGroupContainer}>
        {renderSectionHeader(item)}
        
        {item.data.map((message, index) => {
          const prevMessage = index > 0 ? item.data[index - 1] : null;
          const showName = !prevMessage || prevMessage.expediteur !== message.expediteur;
          return renderMessage(message, showName);
        })}
      </View>
    );
  };

  // Rendu de l'écran d'erreur d'authentification
  const renderAuthError = () => (
    <View style={styles.centerContainer}>
      <Ionicons name="lock-closed-outline" size={80} color="#999" style={{ marginBottom: 20 }} />
      <Text style={styles.errorTitle}>Authentification requise</Text>
      <Text style={styles.errorText}>Vous devez être connecté pour accéder à la messagerie</Text>
      <TouchableOpacity 
        style={styles.loginButton}
        onPress={() => navigation.navigate('Auth', { screen: 'Login' })}
      >
        <Text style={styles.loginButtonText}>Se connecter</Text>
      </TouchableOpacity>
    </View>
  );

  // Rendu de l'écran vide (aucun message)
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="chatbubble-outline" size={80} color="#ccc" style={styles.emptyIcon} />
      <Text style={styles.emptyText}>Aucun message dans cette conversation</Text>
      <Text style={styles.emptySubtext}>Envoyez un message pour commencer</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {authError ? (
          renderAuthError()
        ) : (
          <>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0066cc" />
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={messages} // Utiliser directement la liste des messages sans groupement
                renderItem={({ item, index }) => {
                  // Déterminer si on doit afficher la date
                  const showDate = index === 0 || 
                    !isSameDay(new Date(item.date), new Date(messages[index - 1].date));
                  
                  // Déterminer si on doit afficher le nom de l'expéditeur
                  const showName = index === 0 || 
                    item.expediteur !== messages[index - 1].expediteur;
                  
                  // Afficher la date si nécessaire
                  return (
                    <View key={item.id}>
                      {showDate && (
                        <View style={styles.dateHeaderContainer}>
                          <Text style={styles.dateHeaderText}>
                            {formatMessageDate(new Date(item.date))}
                          </Text>
                        </View>
                      )}
                      {renderMessage(item, showName)}
                    </View>
                  );
                }}
                keyExtractor={(item) => item.id ? item.id.toString() : `msg-${Date.now()}`}
                contentContainerStyle={styles.messagesList}
                onLayout={() => {
                  console.log('FlatList rendu, défilement jusqu\'au dernier message');
                  flatListRef.current?.scrollToEnd({ animated: false });
                }}
                onContentSizeChange={() => {
                  console.log('Taille du contenu changée, défilement jusqu\'au dernier message');
                  flatListRef.current?.scrollToEnd({ animated: false });
                }}
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
                ListEmptyComponent={renderEmptyState()}
                extraData={messages.length} // Forcer le rendu quand le nombre de messages change
              />
            )}

            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, { height: Math.max(40, inputHeight) }]}
                placeholder="Écrivez votre message..."
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
                maxLength={1000}
                onContentSizeChange={(event) => {
                  setInputHeight(Math.min(120, event.nativeEvent.contentSize.height));
                }}
              />
              <TouchableOpacity
                style={[styles.sendButton, (!newMessage.trim() || sending) && styles.disabledSendButton]}
                onPress={handleSendMessage}
                disabled={!newMessage.trim() || sending || authError}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={24} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  // Styles pour l'en-tête personnalisé
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    width: '100%',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 5,
    marginRight: 10,
  },
  headerAvatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#0078FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
  },
  loginButton: {
    backgroundColor: '#0078FF',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    padding: 12,
    paddingBottom: 24,
  },
  messageGroupContainer: {
    marginBottom: 16,
  },
  dateHeaderContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  dateHeaderText: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    overflow: 'hidden',
  },
  messageContainer: {
    marginBottom: 8,
    flexDirection: 'column',
  },
  parentMessageContainer: {
    alignItems: 'flex-end',
    paddingLeft: '15%',
  },
  enseignantMessageContainer: {
    alignItems: 'flex-start',
    paddingRight: '15%',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 18,
    maxWidth: '100%',
  },
  parentMessageBubble: {
    backgroundColor: '#0078FF',
    borderBottomRightRadius: 4,
  },
  enseignantMessageBubble: {
    backgroundColor: '#F1F0F0',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  parentMessageText: {
    color: '#fff',
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 10,
    color: '#999',
  },
  parentMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  messageStatus: {
    fontSize: 10,
    marginLeft: 2,
  },
  statusSending: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  statusSent: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  statusRead: {
    color: '#90CAF9',
  },
  senderInfoContainer: {
    marginLeft: 10,
    marginBottom: 2,
  },
  senderName: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'bold',
  },
  senderSpecialite: {
    fontSize: 11,
    color: '#0078FF',
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyIcon: {
    marginBottom: 16,
    opacity: 0.6,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 120,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#0078FF',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  disabledSendButton: {
    backgroundColor: '#b3d1ff',
    opacity: 0.7,
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
