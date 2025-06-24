import api from './api';
import { getConversations } from './messagerie';
import { restoreConversation } from './api';

/**
 * Vérifie si une conversation existe déjà avec un enseignant spécifique
 * @param {number} enseignantId - ID de l'enseignant
 * @returns {Object|null} - Conversation existante ou null
 */
export const checkExistingConversationWithTeacher = async (enseignantId) => {
  try {
    console.log(`Vérification des conversations existantes avec l'enseignant ${enseignantId}...`);
    const conversationsData = await getConversations();
    
    // Extraire le tableau de conversations selon le format retourné
    let conversations = [];
    if (Array.isArray(conversationsData)) {
      conversations = conversationsData;
    } else if (conversationsData && conversationsData.results && Array.isArray(conversationsData.results)) {
      conversations = conversationsData.results;
    } else if (conversationsData && typeof conversationsData === 'object') {
      conversations = [conversationsData]; // Si c'est un objet unique
    }
    
    console.log(`Nombre de conversations à vérifier: ${conversations.length}`);
    
    if (conversations.length > 0) {
      // Chercher une conversation où l'enseignant est participant
      const existingConversation = conversations.find(conv => {
        return conv.participants_details && 
               conv.participants_details.some(p => 
                 parseInt(p.id) === parseInt(enseignantId) && p.role === 'enseignant'
               );
      });
      
      console.log(`Conversation existante avec l'enseignant ${enseignantId}:`, existingConversation ? existingConversation.id : 'aucune');
      return existingConversation || null;
    }
    
    return null;
  } catch (error) {
    console.error('Erreur lors de la vérification des conversations existantes:', error);
    return null;
  }
};

/**
 * Démarre une nouvelle conversation avec un enseignant concernant un élève spécifique
 * Restaure la conversation si elle a été supprimée
 * @param {string} message - Message initial
 * @param {number} enseignantId - ID de l'enseignant
 * @param {number} eleveId - ID de l'élève (optionnel)
 * @returns {Object} - Données de la conversation créée ou restaurée
 */
export const startConversationWithTeacher = async (message, enseignantId, eleveId = null) => {
  try {
    console.log(`Démarrage d'une conversation avec l'enseignant ${enseignantId}...`);
    
    // Vérifier si une conversation existe déjà avec cet enseignant
    const existingConversation = await checkExistingConversationWithTeacher(enseignantId);
    
    // Si une conversation existe déjà, essayer de la restaurer si nécessaire
    if (existingConversation) {
      console.log(`Une conversation existe déjà avec l'enseignant ${enseignantId} (ID: ${existingConversation.id})`);
      
      try {
        // Essayer de restaurer la conversation au cas où elle aurait été supprimée
        console.log(`Tentative de restauration de la conversation ${existingConversation.id}...`);
        const restoreResult = await restoreConversation(existingConversation.id);
        console.log(`Résultat de la restauration:`, restoreResult);
        
        // Envoyer le nouveau message dans la conversation existante
        try {
          const messageResponse = await api.post(`/conversations/${existingConversation.id}/messages/`, {
            contenu: message
          });
          
          console.log(`Message envoyé dans la conversation existante:`, messageResponse.data);
          
          // Retourner les informations de la conversation existante avec le nouveau message
          return {
            ...existingConversation,
            message_sent: true,
            new_message: messageResponse.data
          };
        } catch (messageError) {
          console.error(`Erreur lors de l'envoi du message dans la conversation ${existingConversation.id}:`, messageError);
          // Retourner quand même les informations de la conversation existante
          return {
            ...existingConversation,
            message_sent: false,
            error: 'Erreur lors de l\'envoi du message'
          };
        }
      } catch (restoreError) {
        console.error(`Erreur lors de la restauration de la conversation ${existingConversation.id}:`, restoreError);
        // Continuer avec la création d'une nouvelle conversation si la restauration échoue
      }
    }
    
    // Créer une nouvelle conversation
    console.log(`Création d'une nouvelle conversation avec l'enseignant ${enseignantId}...`);
    const payload = {
      destinataire: enseignantId,
      message: message
    };
    
    // Ajouter l'élève seulement s'il est fourni
    if (eleveId) {
      payload.eleve = eleveId;
    }
    
    try {
      const response = await api.post('/conversations/start_conversation/', payload);
      console.log('Réponse après création de la conversation:', response.data);
      
      // Vérifier si la réponse indique que la conversation existe déjà mais a été supprimée
      if (response.data && response.data.conversation_exists && response.data.conversation && response.data.conversation.id) {
        const conversationId = response.data.conversation.id;
        console.log(`La conversation ${conversationId} existe déjà mais a été supprimée, tentative de restauration...`);
        
        // Essayer de restaurer la conversation
        try {
          await restoreConversation(conversationId);
          console.log(`Restauration de la conversation ${conversationId} réussie`);
          
          // Forcer un rafraîchissement des conversations dans le cache
          setTimeout(async () => {
            try {
              await getConversations(true); // Force refresh
              console.log('Cache des conversations rafraîchi après restauration');
            } catch (refreshError) {
              console.error('Erreur lors du rafraîchissement du cache des conversations:', refreshError);
            }
          }, 500);
        } catch (restoreError) {
          console.error(`Erreur lors de la restauration de la conversation ${conversationId}:`, restoreError);
        }
      }
      
      return response.data;
    } catch (createError) {
      console.error('Erreur lors de la création de la conversation:', createError);
      
      // Essayer un endpoint alternatif comme fallback
      try {
        console.log('Tentative avec endpoint alternatif...');
        const fallbackPayload = {
          recipient_id: enseignantId,
          content: message
        };
        if (eleveId) {
          fallbackPayload.student_id = eleveId;
        }
        
        const fallbackResponse = await api.post('/messages/create_conversation/', fallbackPayload);
        console.log('Réponse après création de la conversation (fallback):', fallbackResponse.data);
        return fallbackResponse.data;
      } catch (fallbackError) {
        console.error('Erreur lors de la création de la conversation (fallback):', fallbackError);
        throw fallbackError;
      }
    }
  } catch (error) {
    console.error('Erreur lors de la création/restauration de la conversation:', error);
    throw error;
  }
};
