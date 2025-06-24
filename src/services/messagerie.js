import api, { setToken, getEleveById } from './api';
import storage from './storage';

// Utiliser le service API principal qui gère déjà l'authentification

// Fonction pour vérifier et restaurer le token si nécessaire
export const checkAndRestoreAuth = async () => {
  try {
    // Vérifier si nous avons un token dans le stockage
    const storedToken = await storage.getItem('userToken');
    
    if (storedToken) {
      console.log('Token trouvé dans le stockage, restauration...');
      // Configurer le token dans l'API
      setToken(storedToken);
      return true;
    } else {
      console.warn('Aucun token trouvé dans le stockage');
      return false;
    }
  } catch (error) {
    console.error('Erreur lors de la vérification de l\'authentification:', error);
    return false;
  }
};

/**
 * Service de gestion des conversations
 */

// Cache pour les conversations
let conversationsCache = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5000; // 5 secondes - réduit pour permettre une mise à jour plus fréquente

// Fonction pour réinitialiser le cache des conversations
export const resetConversationsCache = () => {
  console.log('Réinitialisation du cache des conversations');
  conversationsCache = null;
  lastFetchTime = 0;
};

// Récupérer la liste des conversations de l'utilisateur connecté
export const getConversations = async (forceRefresh = false) => {
  try {
    // Vérifier si nous avons un token avant de faire la requête
    const token = await storage.getItem('userToken');
    if (!token) {
      console.warn('Aucun token disponible pour récupérer les conversations');
      return [];
    }
    
    // Vérifier si nous pouvons utiliser le cache
    const now = Date.now();
    if (!forceRefresh && conversationsCache && (now - lastFetchTime < CACHE_DURATION)) {
      console.log('Utilisation du cache pour les conversations');
      return conversationsCache;
    }
    
    console.log('Tentative de récupération des conversations avec le token:', token.substring(0, 10) + '...');
    
    const response = await api.get('/conversations/');
    console.log('Réponse API conversations:', response.status);
    console.log('Données reçues:', typeof response.data, Array.isArray(response.data) ? 'tableau' : 'non-tableau');
    
    // Vérifier si nous avons des données et les formater correctement
    if (response.data) {
      let conversations = [];
      
      // Si les données sont un tableau, les utiliser directement
      if (Array.isArray(response.data)) {
        conversations = response.data;
        console.log(`${conversations.length} conversations trouvées (format tableau)`);
      }
      // Si les données sont un objet avec une propriété results, utiliser results
      else if (response.data.results) {
        conversations = response.data.results;
        console.log(`${conversations.length} conversations trouvées (format objet avec results)`);
      }
      // Si c'est un objet unique, le mettre dans un tableau
      else if (typeof response.data === 'object' && response.data !== null) {
        conversations = [response.data];
        console.log('Une seule conversation trouvée (format objet unique)');
      }
      
      // Ajouter des logs pour débogage
      if (conversations.length > 0) {
        console.log('Détails de la première conversation:', JSON.stringify(conversations[0], null, 2));
        
        // Récupérer l'ID de l'utilisateur courant
        const userId = await storage.getItem('userId');
        console.log('ID utilisateur pour filtrer les participants:', userId);
        
        // Traiter chaque conversation pour extraire les informations de l'autre utilisateur
        const processedConversations = [];
        
        // Mettre à jour le cache
        conversationsCache = conversations;
        lastFetchTime = Date.now();
        
        for (const conv of conversations) {
          try {
            // Vérifier que la conversation a un ID valide
            if (!conv.id) {
              console.warn('Conversation sans ID détectée, ignorée');
              continue;
            }
            
            // Créer une copie de la conversation pour éviter de modifier l'original
            const processedConv = {...conv};
            
            // Créer une propriété other_user si elle n'existe pas déjà
            if (!processedConv.other_user) {
              processedConv.other_user = {};
            }
            
            console.log(`Traitement de la conversation ${processedConv.id} pour extraire les informations de l'autre utilisateur`);
            
            // Déterminer le rôle de l'utilisateur courant
            const userRole = await storage.getItem('userRole');
            console.log(`Rôle de l'utilisateur courant: ${userRole}`);
            
            // Variable pour suivre si les informations de l'autre utilisateur ont été trouvées
            let otherUserFound = false;
            
            // Traitement différent selon le rôle de l'utilisateur
            if (userRole === 'enseignant') {
              // POUR LES ENSEIGNANTS: Afficher les informations des parents
              if (processedConv.eleve_details && processedConv.eleve_details.id) {
                const eleveId = processedConv.eleve_details.id;
                console.log(`Conversation ${processedConv.id} concerne l'élève ${eleveId}: ${processedConv.eleve_details.prenom} ${processedConv.eleve_details.nom}`);
                
                // Tenter de récupérer les détails complets de l'élève
                try {
                  const eleveComplet = await getEleveById(eleveId);
                  console.log(`Détails complets de l'élève ${eleveId} récupérés:`, eleveComplet);
                  
                  if (eleveComplet && eleveComplet.parent_details) {
                    const parentDetails = eleveComplet.parent_details;
                    console.log(`Détails du parent de l'élève ${eleveId}:`, parentDetails);
                    
                    // Mettre à jour other_user avec les informations du parent
                    processedConv.other_user = {
                      id: parentDetails.id,
                      nom: parentDetails.nom || 'Parent',
                      prenom: parentDetails.prenom || '',
                      role: 'parent'
                    };
                    
                    console.log(`Utilisation des informations du parent lié à l'élève ${eleveId} pour la conversation ${processedConv.id}`);
                    otherUserFound = true;
                  }
                } catch (error) {
                  console.warn(`Erreur lors de la récupération des détails de l'élève ${eleveId}:`, error);
                }
              }
              
              // Si on n'a pas trouvé les infos du parent via l'élève, chercher dans les participants
              if (!otherUserFound && processedConv.participants_details && Array.isArray(processedConv.participants_details)) {
                // Chercher un participant qui est un parent
                const parentParticipant = processedConv.participants_details.find(p => p.role === 'parent');
                
                if (parentParticipant) {
                  console.log(`Parent trouvé dans les participants de la conversation ${processedConv.id}:`, parentParticipant);
                  
                  processedConv.other_user = {
                    id: parentParticipant.id,
                    nom: parentParticipant.nom || 'Parent',
                    prenom: parentParticipant.prenom || '',
                    role: 'parent'
                  };
                  
                  otherUserFound = true;
                }
              }
            } else {
              // POUR LES PARENTS: Chercher les informations des enseignants
              console.log('Utilisateur parent: recherche des informations des enseignants');
              
              // Chercher l'enseignant dans les participants_details
              if (processedConv.participants_details && Array.isArray(processedConv.participants_details)) {
                const enseignant = processedConv.participants_details.find(p => p.role === 'enseignant');
                
                if (enseignant) {
                  console.log(`Enseignant trouvé dans participants_details pour la conversation ${processedConv.id}:`, enseignant);
                  processedConv.other_user = {
                    id: enseignant.id,
                    nom: enseignant.nom || 'Enseignant',
                    prenom: enseignant.prenom || '',
                    role: 'enseignant',
                    specialite: enseignant.specialite || enseignant.matiere || ''
                  };
                  otherUserFound = true;
                }
              }
              
              // Si pas trouvé dans participants_details, essayer avec le dernier message
              if (!otherUserFound && processedConv.dernier_message) {
                const dernierMessage = processedConv.dernier_message;
                if (dernierMessage.expediteur_role === 'enseignant') {
                  console.log(`Enseignant trouvé dans le dernier message pour la conversation ${processedConv.id}`);
                  processedConv.other_user = {
                    id: dernierMessage.expediteur_id,
                    nom: dernierMessage.expediteur_nom ? dernierMessage.expediteur_nom.split(' ')[1] || '' : 'Enseignant',
                    prenom: dernierMessage.expediteur_nom ? dernierMessage.expediteur_nom.split(' ')[0] || '' : '',
                    role: 'enseignant'
                  };
                  otherUserFound = true;
                }
              }
            }
            
            // PRIORITÉ 2: Si on est un enseignant et qu'on n'a pas trouvé les infos du parent via l'élève, chercher dans les participants
            if (userRole === 'enseignant' && !otherUserFound && processedConv.participants_details && Array.isArray(processedConv.participants_details)) {
              // Chercher un participant qui est un parent
              const parentParticipant = processedConv.participants_details.find(p => p.role === 'parent');
              
              if (parentParticipant) {
                console.log(`Parent trouvé dans les participants de la conversation ${processedConv.id}:`, parentParticipant);
                
                processedConv.other_user = {
                  id: parentParticipant.id,
                  nom: parentParticipant.nom || 'Parent',
                  prenom: parentParticipant.prenom || '',
                  role: 'parent'
                };
                
                parentInfoFound = true;
              } else {
                // Si aucun parent n'est trouvé, mais qu'il y a d'autres participants
                const otherUser = processedConv.participants_details.find(p => {
                  const participantId = p.id?.toString() || '';
                  const currentUserId = userId?.toString() || '';
                  return participantId !== currentUserId;
                });
                
                if (otherUser) {
                  console.log(`Autre utilisateur (non parent) trouvé dans la conversation ${processedConv.id}:`, otherUser);
                  
                  // Forcer l'affichage comme parent
                  processedConv.other_user = {
                    id: otherUser.id,
                    nom: 'Parent', // Forcer le nom générique "Parent"
                    prenom: '',
                    role: 'parent' // Forcer le rôle parent
                  };
                }
              }
            }
            
            // PRIORITÉ 3: Si on n'a toujours pas d'informations, utiliser un parent générique
            if (Object.keys(processedConv.other_user).length === 0) {
              console.log(`Aucune information de parent trouvée pour la conversation ${processedConv.id}, utilisation d'un parent générique`);
              
              processedConv.other_user = {
                id: 0,
                nom: 'Parent',
                prenom: '',
                role: 'parent'
              };
            }
            
            // Si nous avons toujours un other_user vide, essayer de le récupérer depuis participants
            if (Object.keys(processedConv.other_user).length === 0) {
              // Si nous avons participants, extraire l'autre utilisateur
              if (processedConv.participants && Array.isArray(processedConv.participants)) {
                // Filtrer pour trouver l'autre utilisateur (celui qui n'est pas l'utilisateur courant)
                const otherUserId = processedConv.participants.find(id => {
                  // Convertir les IDs en string pour une comparaison fiable
                  const participantId = id?.toString() || '';
                  const currentUserId = userId?.toString() || '';
                  return participantId !== currentUserId;
                });
              
                if (otherUserId) {
                  console.log(`ID de l'autre utilisateur trouvé dans participants: ${otherUserId}`);
                  
                  // Mettre à jour other_user avec l'ID trouvé
                  processedConv.other_user = {
                    id: otherUserId,
                    // Autres propriétés seront vides jusqu'à ce que nous récupérions plus d'informations
                  };
                } else {
                  console.log(`Aucun autre utilisateur trouvé dans participants pour la conversation ${processedConv.id}`);
                }
              } else {
                console.log(`participants non disponible pour la conversation ${processedConv.id}`);
              }
            }
            
            // Si other_user est toujours vide, créer un utilisateur par défaut
            if (Object.keys(processedConv.other_user).length === 0) {
              console.log(`Création d'un utilisateur par défaut pour la conversation ${processedConv.id}`);
              
              // Déterminer le rôle par défaut (si l'utilisateur courant est parent, l'autre est enseignant et vice versa)
              const userRole = await storage.getItem('userRole');
              const defaultRole = userRole === 'parent' ? 'enseignant' : 'parent';
              
              processedConv.other_user = {
                id: 0, // ID par défaut
                nom: defaultRole === 'enseignant' ? 'Enseignant' : 'Parent',
                prenom: '',
                role: defaultRole
              };
            }
            
            // Ajouter des informations sur l'élève si disponibles
            if (processedConv.eleve) {
              console.log(`Conversation ${processedConv.id} a un élève associé: ${processedConv.eleve}`);
            } else if (processedConv.eleve_details) {
              console.log(`Conversation ${processedConv.id} a des détails d'élève:`, processedConv.eleve_details);
              processedConv.eleve = processedConv.eleve_details.id;
            }
            
            // Ajouter des informations sur le dernier message si disponibles
            if (processedConv.dernier_message) {
              console.log(`Conversation ${processedConv.id} a un dernier message:`, processedConv.dernier_message);
            }
            
            // Ajouter la conversation traitée à la liste
            processedConversations.push(processedConv);
          } catch (error) {
            console.error(`Erreur lors du traitement de la conversation:`, error);
          }
        }
        
        console.log(`${processedConversations.length} conversations traitées avec succès`);
        return processedConversations;
      } else {
        console.warn('Aucune conversation trouvée');
        return [];
      }
    } else {
      console.warn('Aucune donnée reçue pour les conversations');
      return [];
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des conversations:', error);
    
    // Vérifier si l'erreur est due à un problème d'authentification
    if (error.response && error.response.status === 401) {
      // Propager l'erreur pour que l'écran puisse afficher l'erreur d'authentification
      throw error;
    }
    
    return [];
  }
};

// Récupérer les détails d'une conversation
export const getConversation = async (conversationId) => {
  try {
    const response = await api.get(`/conversations/${conversationId}/`);
    return response.data;
  } catch (error) {
    console.error(`Erreur lors de la récupération de la conversation ${conversationId}:`, error);
    return null;
  }
};

// Récupérer les contacts disponibles pour démarrer une conversation
export const getAvailableContacts = async () => {
  try {
    // Essayer d'abord le nouvel endpoint spécifique pour les parents
    const response = await api.get('/parent/enseignants/');
    console.log('Enseignants récupérés depuis /parent/enseignants/:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erreur avec /parent/enseignants/:', error);
    
    try {
      // Essayer l'endpoint officiel comme fallback
      const fallbackResponse = await api.get('/conversations/available-contacts/');
      console.log('Contacts disponibles récupérés depuis /conversations/available-contacts/:', fallbackResponse.data);
      return fallbackResponse.data;
    } catch (fallbackError) {
      console.error('Erreur avec /conversations/available-contacts/:', fallbackError);
      
      // Solution de contournement: créer des données de test pour le développement
      console.log('Utilisation de données de test pour les contacts');
      
      // Créer des enseignants de test
      const mockTeachers = [
        {
          id: 1,
          nom: 'Dupont',
          prenom: 'Jean',
          role: 'enseignant',
          specialite: 'Mathématiques',
          eleves: [
            { id: 1, nom: 'Enfant1', prenom: 'Prénom1', classe: '6ème A' },
            { id: 2, nom: 'Enfant2', prenom: 'Prénom2', classe: '6ème A' }
          ]
        },
        {
          id: 2,
          nom: 'Martin',
          prenom: 'Sophie',
          role: 'enseignant',
          specialite: 'Français',
          eleves: [
            { id: 1, nom: 'Enfant1', prenom: 'Prénom1', classe: '6ème A' }
          ]
        },
        {
          id: 3,
          nom: 'Petit',
          prenom: 'Marie',
          role: 'enseignant',
          specialite: 'Histoire-Géographie',
          eleves: [
            { id: 2, nom: 'Enfant2', prenom: 'Prénom2', classe: '6ème A' }
          ]
        }
      ];
      
      return mockTeachers;
    }
  }
};

// Démarrer une nouvelle conversation
export const startConversation = async (messageText, destinataireId, eleveId = null) => {
  try {
    const payload = {
      destinataire: destinataireId,
      message: messageText
    };
    
    // Ajouter l'élève seulement s'il est fourni
    if (eleveId) {
      payload.eleve = eleveId;
    }
    
    console.log('Démarrage d\'une nouvelle conversation:', payload);
    const response = await api.post('/conversations/start_conversation/', payload);
    console.log('Réponse après création de la conversation:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la création de la conversation:', error);
    
    // Vérifier si l'erreur est due à un problème d'authentification
    if (error.response && error.response.status === 401) {
      console.error('Erreur d\'authentification lors de la création de la conversation');
    } else if (error.response && error.response.status === 404) {
      console.error('Endpoint de création de conversation non trouvé');
      // Essayer un autre endpoint comme fallback
      try {
        console.log('Tentative avec endpoint alternatif...');
        const fallbackPayload = {
          recipient_id: destinataireId,
          content: messageText
        };
        if (eleveId) {
          fallbackPayload.student_id = eleveId;
        }
        
        const fallbackResponse = await api.post('/messages/create_conversation/', fallbackPayload);
        console.log('Réponse après création de la conversation (fallback):', fallbackResponse.data);
        return fallbackResponse.data;
      } catch (fallbackError) {
        console.error('Erreur lors de la création de la conversation (fallback):', fallbackError);
      }
    }
    
    throw error;
  }
};

// Marquer tous les messages d'une conversation comme lus
export const markConversationAsRead = async (conversationId) => {
  try {
    console.log(`Marquage de la conversation ${conversationId} comme lue...`);
    
    // Utiliser directement l'endpoint /conversations/{id}/read/ qui fonctionne d'après les logs
    console.log(`Utilisation de l'endpoint /conversations/${conversationId}/read/`);
    const response = await api.post(`/conversations/${conversationId}/read/`, {});
    console.log('Réponse après marquage comme lu:', response.data);
    return response.data;
  } catch (error) {
    console.error(`Erreur lors du marquage de la conversation ${conversationId} comme lue:`, error.response?.data || error.message);
    
    // Ne pas bloquer l'interface en cas d'erreur
    console.log('Continuation malgré l\'erreur de marquage comme lu');
    return { success: false, error: error.message };
  }
};

/**
 * Service de gestion des messages
 */

// Récupérer les messages d'une conversation
export const getMessages = async (conversationId) => {
  try {
    console.log(`Requête GET vers /messages/?conversation=${conversationId} avec token d'authentification`);
    const response = await api.get(`/messages/?conversation=${conversationId}`);
    console.log(`Réponse API messages pour conversation ${conversationId}:`, response.status);
    
    // Vérifier la structure de la réponse
    if (response.data) {
      console.log('Structure de la réponse messages:', JSON.stringify(response.data).substring(0, 100) + '...');
      
      // Vérifier si nous avons un tableau ou un objet avec results
      if (Array.isArray(response.data)) {
        console.log(`${response.data.length} messages récupérés dans le tableau`);
        return response.data;
      } else if (response.data.results && Array.isArray(response.data.results)) {
        console.log(`${response.data.results.length} messages récupérés dans results`);
        return response.data.results;
      } else {
        console.warn(`Format de réponse inattendu pour les messages de la conversation ${conversationId}`);
        return [];
      }
    } else {
      console.warn(`Aucune donnée reçue pour les messages de la conversation ${conversationId}`);
      return [];
    }
  } catch (error) {
    console.error(`Erreur lors de la récupération des messages de la conversation ${conversationId}:`, error);
    return [];
  }
};

// Récupérer les messages d'une conversation (version améliorée)
export const getMessagesConversation = async (conversationId, userId = null, userRole = null) => {
  try {
    console.log(`Récupération des messages pour la conversation ${conversationId}...`);
    
    // Récupérer l'ID de l'utilisateur pour identifier ses messages si non fourni
    if (!userId) {
      userId = await storage.getItem('userId');
    }
    console.log('ID utilisateur pour la récupération des messages:', userId);
    
    // Récupérer le rôle de l'utilisateur si non fourni
    if (!userRole) {
      userRole = await storage.getItem('userRole');
    }
    console.log('Rôle de l\'utilisateur pour la récupération des messages:', userRole);
    
    // Récupérer les messages avec pagination (100 messages par page)
    const response = await api.get(`/messages/?conversation=${conversationId}&page_size=100`);
    
    // Vérifier si nous avons des résultats
    if (!response.data || !response.data.results) {
      console.warn(`Aucun message trouvé pour la conversation ${conversationId}`);
      return [];
    }
    
    // Extraire les messages de la réponse
    let messages = response.data.results;
    console.log(`${messages.length} messages récupérés pour la conversation ${conversationId}`);
    
    // Si nous avons des pages supplémentaires, les récupérer
    if (response.data.next) {
      console.log(`Pages supplémentaires détectées pour la conversation ${conversationId}`);
      let nextPage = response.data.next;
      
      while (nextPage) {
        // Extraire l'URL relative de nextPage
        const relativeUrl = nextPage.split('/api')[1];
        console.log(`Récupération de la page suivante: ${relativeUrl}`);
        
        const nextResponse = await api.get(relativeUrl);
        
        if (nextResponse.data && nextResponse.data.results) {
          console.log(`${nextResponse.data.results.length} messages supplémentaires récupérés`);
          messages = [...messages, ...nextResponse.data.results];
          nextPage = nextResponse.data.next;
        } else {
          nextPage = null;
        }
      }
    }
    
    console.log(`Total de ${messages.length} messages récupérés pour la conversation ${conversationId}`);
    
    // Si nous avons des détails sur les participants, les utiliser pour enrichir les messages
    let enseignantDetails = null;
    let parentDetails = null;
    
    try {
      const conversationResponse = await api.get(`/conversations/${conversationId}/`);
      const conversationData = conversationResponse.data;
      
      // Vérifier si nous avons des détails sur les participants
      if (conversationData && conversationData.participants_details) {
        console.log(`Détails des participants récupérés pour la conversation ${conversationId}`);
        
        // Créer un mapping des IDs aux détails des participants
        const participantsMap = {};
        
        // Identifier les participants par leur rôle
        const enseignants = [];
        const parents = [];
        
        // Première passe : identifier clairement les rôles
        conversationData.participants_details.forEach(participant => {
          if (participant && participant.id) {
            participantsMap[participant.id] = participant;
            
            // Classer les participants par rôle
            if (participant.role === 'enseignant') {
              enseignants.push(participant);
              console.log('Enseignant identifié:', participant.prenom, participant.nom, '(ID:', participant.id, ')');
            } else if (participant.role === 'parent') {
              parents.push(participant);
              console.log('Parent identifié:', participant.prenom, participant.nom, '(ID:', participant.id, ')');
            } else {
              console.log('Participant avec rôle inconnu:', participant.role, '-', participant.prenom, participant.nom);
            }
          }
        });
        
        // Récupérer le rôle de l'utilisateur courant
        const userRole = await storage.getItem('userRole') || '';
        const currentUserRole = userRole || 'enseignant';
        console.log(`Rôle de l'utilisateur courant: ${currentUserRole}`);
        
        // Identifier correctement les participants en fonction du rôle de l'utilisateur
        if (userRole === 'enseignant') {
          // Si l'utilisateur est un enseignant, chercher les parents
          if (parents.length > 0) {
            // Prendre le premier parent
            parentDetails = parents[0];
            console.log('Parent identifié pour enseignant:', parentDetails.prenom, parentDetails.nom);
          } else {
            // Si aucun parent n'est trouvé, chercher les participants qui ne sont pas l'utilisateur
            const nonUsers = conversationData.participants_details.filter(p => 
              p.id.toString() !== userId.toString() && p.role !== 'enseignant'
            );
            
            if (nonUsers.length > 0) {
              parentDetails = nonUsers[0];
              console.log('Parent identifié par exclusion:', parentDetails.prenom, parentDetails.nom);
            }
          }
          
          // Pour l'enseignant, utiliser l'utilisateur courant
          const currentUser = conversationData.participants_details.find(p => 
            p.id.toString() === userId.toString()
          );
          
          if (currentUser) {
            enseignantDetails = currentUser;
            console.log('Enseignant identifié comme utilisateur courant:', enseignantDetails.prenom, enseignantDetails.nom);
          } else if (enseignants.length > 0) {
            enseignantDetails = enseignants[0];
            console.log('Enseignant identifié depuis la liste:', enseignantDetails.prenom, enseignantDetails.nom);
          }
        } else if (userRole === 'parent') {
          // Si l'utilisateur est un parent, chercher les enseignants
          if (enseignants.length > 0) {
            enseignantDetails = enseignants[0];
            console.log('Enseignant identifié pour parent:', enseignantDetails.prenom, enseignantDetails.nom);
          } else {
            // Si aucun enseignant n'est trouvé, chercher les participants qui ne sont pas l'utilisateur
            const nonUsers = conversationData.participants_details.filter(p => 
              p.id.toString() !== userId.toString() && p.role !== 'parent'
            );
            
            if (nonUsers.length > 0) {
              enseignantDetails = nonUsers[0];
              console.log('Enseignant identifié par exclusion:', enseignantDetails.prenom, enseignantDetails.nom);
            }
          }
          
          // Pour le parent, utiliser l'utilisateur courant
          const currentUser = conversationData.participants_details.find(p => 
            p.id.toString() === userId.toString()
          );
          
          if (currentUser) {
            parentDetails = currentUser;
            console.log('Parent identifié comme utilisateur courant:', parentDetails.prenom, parentDetails.nom);
          } else if (parents.length > 0) {
            parentDetails = parents[0];
            console.log('Parent identifié depuis la liste:', parentDetails.prenom, parentDetails.nom);
          }
        }
        
        // 3. Si nous n'avons pas de parent mais que nous avons des participants qui ne sont pas enseignants
        if (!parentDetails) {
          const nonEnseignants = conversationData.participants_details.filter(p => 
            p.role !== 'enseignant' && p.id.toString() !== (enseignantDetails?.id?.toString() || ''))
          
          if (nonEnseignants.length > 0) {
            parentDetails = nonEnseignants[0];
            console.log('Parent identifié par exclusion:', parentDetails.prenom, parentDetails.nom);
          }
        }
        
        // 4. Vérification finale : s'assurer que parentDetails et enseignantDetails sont différents
        if (parentDetails && enseignantDetails && 
            parentDetails.id.toString() === enseignantDetails.id.toString()) {
          console.log('ERREUR: Le parent et l\'enseignant sont la même personne!');
          
          // Chercher un autre participant pour remplacer le parent
          const autresParticipants = conversationData.participants_details.filter(p => 
            p.id.toString() !== enseignantDetails.id.toString());
          
          if (autresParticipants.length > 0) {
            parentDetails = autresParticipants[0];
            console.log('Parent remplacé par un autre participant:', parentDetails.prenom, parentDetails.nom);
          } else {
            // Si nous n'avons pas d'autre participant, annuler l'identification du parent
            parentDetails = null;
            console.log('Identification du parent annulée pour éviter la confusion');
          }
        }
        
        // Vérification finale
        console.log('Détails finaux de l\'enseignant:', enseignantDetails);
        console.log('Détails finaux du parent:', parentDetails);
        
        // Si nous n'avons pas trouvé l'enseignant par son rôle, essayer de le trouver par déduction
        if (!enseignantDetails && parentDetails && conversationData.participants_details.length === 2) {
          enseignantDetails = conversationData.participants_details.find(p => 
            p.id !== parentDetails.id
          );
          if (enseignantDetails) {
            console.log('Détails de l\'enseignant déduits:', enseignantDetails);
          }
        }
        
        // Ajouter les détails des participants aux messages si manquants
        messages = messages.map(message => {
          // Si le message a déjà des détails d'expéditeur complets, les conserver
          if (message.expediteur_details && 
              Object.keys(message.expediteur_details).length > 0 &&
              message.expediteur_details.nom && 
              message.expediteur_details.role) {
            return message;
          }
          
          // Sinon, essayer de les ajouter à partir du mapping
          if (message.expediteur) {
            const expediteurId = message.expediteur.toString();
            
            // Vérifier si c'est un message du parent
            if (parentDetails && parentDetails.id.toString() === expediteurId) {
              return {
                ...message,
                expediteur_details: parentDetails,
                est_de_moi: userId && expediteurId === userId.toString()
              };
            }
            
            // Vérifier si c'est un message de l'enseignant
            if (enseignantDetails && enseignantDetails.id.toString() === expediteurId) {
              return {
                ...message,
                expediteur_details: enseignantDetails,
                est_de_moi: false
              };
            }
            
            // Si nous avons le participant dans notre mapping
            if (participantsMap[expediteurId]) {
              return {
                ...message,
                expediteur_details: participantsMap[expediteurId],
                est_de_moi: userId && expediteurId === userId.toString()
              };
            }
          }
          
          // Si nous ne pouvons pas déterminer l'expéditeur, utiliser les informations disponibles
          if (!message.expediteur_details) {
            // Déterminer si c'est un message du parent ou de l'enseignant
            const isParentMessage = userId && message.expediteur && message.expediteur.toString() === userId.toString();
            
            message.expediteur_details = isParentMessage 
              ? (parentDetails || { id: message.expediteur, nom: 'Vous', prenom: '', role: 'parent' })
              : (enseignantDetails || { id: message.expediteur, nom: 'Enseignant', prenom: '', role: 'enseignant' });
            
            message.est_de_moi = isParentMessage;
          }
          
          return message;
        });
      }
    } catch (convError) {
      console.warn(`Erreur lors de la récupération des détails de la conversation ${conversationId}:`, convError);
    }
    
    return messages;
  } catch (error) {
    console.error(`Erreur lors de la récupération des messages de la conversation ${conversationId}:`, error);
    return [];
  }
};

// Envoyer un nouveau message dans une conversation
// Fonction simplifiée pour les enseignants pour envoyer un nouveau message à un parent
export const sendNewMessageToParent = async (parentId, messageText, eleveId) => {
  try {
    console.log(`Envoi d'un nouveau message au parent (ID: ${parentId}) pour l'élève (ID: ${eleveId})`);
    
    // Vérifier que nous avons tous les paramètres nécessaires
    if (!parentId) {
      throw new Error('ID du parent requis pour envoyer un message');
    }
    if (!messageText || !messageText.trim()) {
      throw new Error('Contenu du message requis');
    }
    if (!eleveId) {
      throw new Error('ID de l\'\u00e9lève requis pour envoyer un message');
    }
    
    // Récupérer l'ID de l'utilisateur (enseignant)
    const userId = await storage.getItem('userId');
    if (!userId) {
      throw new Error('Utilisateur non authentifié');
    }
    console.log(`Envoi du message en tant qu'utilisateur ${userId}`);
    
    // Créer directement une nouvelle conversation
    console.log('Création d\'une nouvelle conversation...');
    
    // Préparer les données pour la création de la conversation
    const conversationData = {
      participants: [parseInt(userId), parseInt(parentId)],
      eleve_id: parseInt(eleveId)
    };
    
    console.log('Données pour créer la conversation:', conversationData);
    
    // Essayer de créer la conversation
    let conversationId = null;
    let conversationResponse = null;
    
    try {
      conversationResponse = await api.post('/conversations/', conversationData);
      
      if (conversationResponse.data && conversationResponse.data.id) {
        conversationId = conversationResponse.data.id;
        console.log(`Nouvelle conversation créée avec ID: ${conversationId}`);
      } else {
        throw new Error('La création de la conversation a échoué');
      }
    } catch (error) {
      console.error('Erreur lors de la création de la conversation:', error.response?.data || error.message);
      
      // Si la conversation existe déjà, essayer de récupérer son ID depuis l'erreur
      if (error.response && error.response.data && 
          (error.response.data.detail === 'Conversation déjà existante' || 
           error.response.data.non_field_errors && 
           error.response.data.non_field_errors.includes('Conversation déjà existante'))) {
        
        console.log('La conversation existe déjà, nouvelle tentative de recherche...');
        
        // Faire une nouvelle tentative pour trouver la conversation
        try {
          const conversationsResponse = await api.get('/conversations/');
          const conversations = Array.isArray(conversationsResponse.data) ? 
            conversationsResponse.data : 
            (conversationsResponse.data.results || []);
          
          // Rechercher à nouveau la conversation
          const existingConversation = conversations.find(conv => {
            // Vérifier si le parent fait partie des participants
            const hasParent = conv.participants && 
              Array.isArray(conv.participants) && 
              conv.participants.includes(parseInt(parentId));
            
            // Vérifier si l'élève est associé à la conversation
            const hasEleve = conv.eleve_id === parseInt(eleveId) || 
              (conv.eleve && conv.eleve.id === parseInt(eleveId));
            
            return hasParent && hasEleve;
          });
          
          if (existingConversation) {
            conversationId = existingConversation.id;
            console.log(`Conversation existante finalement trouvée avec ID: ${conversationId}`);
          } else {
            throw new Error('Impossible de trouver la conversation existante');
          }
        } catch (retryError) {
          console.error('Erreur lors de la nouvelle tentative:', retryError);
          throw new Error('Impossible de créer ou de trouver la conversation');
        }
      } else {
        throw error;
      }
    }
    
    // ÉTAPE 3: Envoyer le message dans la conversation
    if (!conversationId) {
      throw new Error('Aucune conversation disponible pour envoyer le message');
    }
    
    console.log(`Envoi du message dans la conversation ${conversationId}...`);
    
    // Préparer les données pour l'envoi du message
    const messageData = {
      conversation: conversationId,
      contenu: messageText.trim()
    };
    
    console.log('Données du message:', messageData);
    const response = await api.post('/messages/', messageData);
    
    console.log('Réponse après envoi du message:', response.data);
    
    // Ajouter l'ID de la conversation à la réponse pour faciliter la redirection
    const result = response.data;
    if (result && !result.conversation) {
      result.conversation = conversationId;
    }
    if (result && !result.conversation_id) {
      result.conversation_id = conversationId;
    }
    
    return {
      ...result,
      conversation: conversationId,
      conversation_id: conversationId
    };
  } catch (error) {
    console.error('Erreur lors de l\'envoi du nouveau message:', error);
    throw error;
  }
};

export const sendMessage = async (conversationId, messageText, destinataireId = null) => {
  try {
    // Récupérer l'ID de l'utilisateur du stockage
    const userId = await storage.getItem('userId');
    console.log(`Envoi d'un message dans la conversation ${conversationId} par l'utilisateur ${userId}`);
    
    // Récupérer les détails de la conversation pour trouver le destinataire
    if (!destinataireId) {
      try {
        console.log(`Récupération des détails de la conversation ${conversationId} pour trouver le destinataire`);
        const conversationDetails = await api.get(`/conversations/${conversationId}/`);
        console.log(`Détails de la conversation ${conversationId}:`, JSON.stringify(conversationDetails.data, null, 2));
        
        // Vérifier si nous avons participants_details
        if (conversationDetails.data && conversationDetails.data.participants_details && 
            Array.isArray(conversationDetails.data.participants_details)) {
          
          // Trouver l'enseignant dans participants_details
          const enseignant = conversationDetails.data.participants_details.find(p => 
            p.role === 'enseignant' || (userId && p.id !== parseInt(userId))
          );
          
          if (enseignant) {
            destinataireId = enseignant.id;
            console.log(`Destinataire (enseignant) trouvé dans participants_details:`, enseignant);
          }
        }
        // Si nous n'avons pas participants_details, essayer avec participants
        else if (conversationDetails.data && conversationDetails.data.participants && 
            Array.isArray(conversationDetails.data.participants)) {
          
          // Trouver l'ID du destinataire (celui qui n'est pas l'utilisateur courant)
          const destinataire = conversationDetails.data.participants.find(id => 
            id !== parseInt(userId) && id !== userId
          );
          
          if (destinataire) {
            destinataireId = destinataire;
            console.log(`Destinataire trouvé dans participants:`, destinataireId);
          }
        }
      } catch (err) {
        console.warn(`Impossible de récupérer les détails de la conversation ${conversationId}:`, err);
      }
    }
    
    // Si nous n'avons toujours pas de destinataireId, essayer de le récupérer depuis la liste des conversations
    if (!destinataireId) {
      try {
        console.log('Tentative de récupération du destinataire depuis la liste des conversations');
        const conversationsResponse = await api.get('/conversations/');
        
        if (conversationsResponse.data && conversationsResponse.data.results) {
          const conversations = conversationsResponse.data.results;
          const currentConv = conversations.find(c => c.id === parseInt(conversationId));
          
          if (currentConv && currentConv.participants_details) {
            const enseignant = currentConv.participants_details.find(p => 
              p.role === 'enseignant' || (userId && p.id !== parseInt(userId))
            );
            
            if (enseignant) {
              destinataireId = enseignant.id;
              console.log('Destinataire trouvé dans la liste des conversations:', enseignant);
            }
          }
        }
      } catch (err) {
        console.warn('Impossible de récupérer la liste des conversations:', err);
      }
    }
    
    console.log(`ID du destinataire final pour l'envoi du message: ${destinataireId}`);
    
    // Essayer d'abord avec le format 'contenu' (format Django standard)
    const payload = {
      conversation: conversationId,
      contenu: messageText
    };
    
    // Ajouter l'ID de l'expéditeur si disponible
    if (userId) {
      payload.expediteur = userId;
    }
    
    // Ajouter l'ID du destinataire si disponible
    if (destinataireId) {
      payload.destinataire = destinataireId;
    }
    
    // Récupérer l'ID de l'élève si disponible
    try {
      const eleveId = await storage.getItem('currentEleveId');
      if (eleveId) {
        console.log(`Ajout de l'ID de l'élève ${eleveId} au message`);
        payload.eleve_id = eleveId;
      } else {
        // Essayer de récupérer l'élève à partir des détails de la conversation
        const conversationDetails = await api.get(`/conversations/${conversationId}/`);
        if (conversationDetails.data && conversationDetails.data.eleve_id) {
          console.log(`ID de l'élève récupéré depuis la conversation: ${conversationDetails.data.eleve_id}`);
          payload.eleve_id = conversationDetails.data.eleve_id;
          // Sauvegarder pour les futurs messages
          await storage.setItem('currentEleveId', conversationDetails.data.eleve_id.toString());
        }
      }
    } catch (error) {
      console.warn("Impossible de récupérer l'ID de l'élève:", error);
    }
    
    console.log(`Envoi d'un message dans la conversation ${conversationId}:`, payload);
    
    const response = await api.post('/messages/', payload);
    console.log('Réponse après envoi du message:', response.data);
    
    // Vérifier si la réponse contient les détails du message
    if (response.data && response.data.id) {
      // Ajouter les détails de l'expéditeur si nécessaire
      if (!response.data.expediteur_details && userId) {
        console.log('Ajout des détails de l\'expéditeur au message');
        // Récupérer les détails de l'utilisateur depuis le stockage si disponible
        const userNom = await storage.getItem('userNom');
        const userPrenom = await storage.getItem('userPrenom');
        
        if (userNom || userPrenom) {
          // Récupérer le rôle de l'utilisateur pour déterminer s'il est parent ou enseignant
          const userRole = await storage.getItem('userRole');
          
          response.data.expediteur_details = {
            id: parseInt(userId),
            nom: userNom || '',
            prenom: userPrenom || '',
            role: userRole === 'enseignant' ? 'enseignant' : 'parent'
          };
        }
      }
      
      // Essayer de mettre à jour la conversation pour qu'elle apparaisse en haut de la liste
      try {
        await api.post(`/conversations/${conversationId}/touch/`, {});
        console.log(`Conversation ${conversationId} mise à jour pour apparaître en haut de la liste`);
      } catch (touchError) {
        console.warn(`Impossible de mettre à jour la conversation ${conversationId}:`, touchError);
      }
    }
    
    return response.data;
  } catch (error) {
    console.error('Erreur lors de l\'envoi du message:', error);
    
    // Si l'erreur est 400, essayer avec un autre format de payload
    if (error.response && error.response.status === 400) {
      try {
        console.log('Tentative avec format de payload alternatif (text)...');
        const userId = await storage.getItem('userId');
        const altPayload = {
          conversation: conversationId,
          text: messageText
        };
        
        // Ajouter l'ID de l'expéditeur si disponible
        if (userId) {
          altPayload.sender_id = userId;
        }
        
        // Ajouter l'ID du destinataire si disponible
        if (destinataireId) {
          altPayload.recipient_id = destinataireId;
        }
        
        const altResponse = await api.post('/messages/', altPayload);
        console.log('Réponse après envoi du message (format alternatif):', altResponse.data);
        
        // Essayer de mettre à jour la conversation pour qu'elle apparaisse en haut de la liste
        try {
          await api.post(`/conversations/${conversationId}/touch/`, {});
          console.log(`Conversation ${conversationId} mise à jour pour apparaître en haut de la liste`);
        } catch (touchError) {
          console.warn(`Impossible de mettre à jour la conversation ${conversationId}:`, touchError);
        }
        
        return altResponse.data;
      } catch (altError) {
        console.error('Erreur avec format alternatif:', altError);
      }
    }
    
    // Vérifier si l'erreur est due à un problème d'authentification
    if (error.response && error.response.status === 401) {
      console.error('Erreur d\'authentification lors de l\'envoi du message');
    }
    
    throw error;
  }
};

// Supprimer un message
export const deleteMessage = async (messageId) => {
try {
  const response = await api.delete(`/messages/${messageId}/`);
  return response.data;
} catch (error) {
  console.error('Erreur lors de la suppression du message:', error);
  throw error;
}
};

// Supprimer une conversation (suppression logique)
export const deleteConversation = async (conversationId) => {
  try {
    // Vérifier si nous avons un token avant de faire la requête
    const token = await storage.getItem('userToken');
    if (!token) {
      console.error('Aucun token disponible pour supprimer la conversation');
      throw new Error('Vous devez être connecté pour effectuer cette action');
    }
    
    console.log(`Tentative de suppression de la conversation ${conversationId} avec token: ${token.substring(0, 10)}...`);
    
    // Vérifier que l'ID de conversation est valide
    if (!conversationId) {
      console.error('ID de conversation invalide');
      throw new Error('ID de conversation invalide');
    }
    
    // Configurer les en-têtes pour la requête
    const config = {
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      }
    };
    
    console.log('Configuration de la requête de suppression:', config);
    
    // Effectuer la requête DELETE
    const response = await api.delete(`/conversations/${conversationId}/`, config);
    
    console.log(`Réponse de suppression de conversation ${conversationId}:`, response.status);
    console.log('Détails de la réponse:', response.data || 'Aucune donnée');
    
    return response.data;
  } catch (error) {
    console.error(`Erreur lors de la suppression de la conversation ${conversationId}:`, error);
    
    if (error.response) {
      // La requête a été faite et le serveur a répondu avec un code d'erreur
      console.error('Statut de l\'erreur:', error.response.status);
      console.error('Données de l\'erreur:', error.response.data);
    } else if (error.request) {
      // La requête a été faite mais aucune réponse n'a été reçue
      console.error('Aucune réponse reçue du serveur:', error.request);
    } else {
      // Une erreur s'est produite lors de la configuration de la requête
      console.error('Erreur de configuration de la requête:', error.message);
    }
    
    throw error;
  }
};
