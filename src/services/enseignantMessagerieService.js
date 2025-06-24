import api from './api';
import storage from './storage';
import { getConversations, getMessages, sendMessage, markConversationAsRead } from './messagerie';

/**
 * Service de messagerie spécifique aux enseignants
 */

/**
 * Récupère la liste des parents des élèves que l'enseignant enseigne
 * Inclut les détails des élèves pour chaque parent
 */
export const getParentsEleves = async () => {
  try {
    const response = await api.get('/enseignant/parents/');
    
    // Récupérer les conversations existantes pour marquer les parents
    // avec qui l'enseignant a déjà une conversation
    const conversations = await getConversations();
    const parentsWithConversations = new Set();
    
    if (conversations && conversations.results) {
      conversations.results.forEach(conv => {
        if (conv.participants_details) {
          const parents = conv.participants_details.filter(p => p.role === 'parent');
          parents.forEach(parent => {
            parentsWithConversations.add(parseInt(parent.id));
          });
        }
      });
    }
    
    // Marquer les parents qui ont déjà une conversation
    const parentsWithDetails = response.data.map(parent => ({
      ...parent,
      has_conversation: parentsWithConversations.has(parseInt(parent.id))
    }));
    
    return parentsWithDetails;
  } catch (error) {
    console.error('Erreur lors de la récupération des parents:', error);
    throw error;
  }
};

/**
 * Vérifie si une conversation existe déjà avec un parent spécifique
 * @param {number} parentId - ID du parent
 * @returns {Object|null} - Conversation existante ou null
 */
export const checkExistingConversation = async (parentId) => {
  try {
    const conversations = await getConversations();
    
    if (conversations && conversations.results) {
      // Chercher une conversation où le parent est participant
      const existingConversation = conversations.results.find(conv => {
        return conv.participants_details && 
               conv.participants_details.some(p => 
                 parseInt(p.id) === parseInt(parentId) && p.role === 'parent'
               );
      });
      
      return existingConversation || null;
    }
    
    return null;
  } catch (error) {
    console.error('Erreur lors de la vérification des conversations existantes:', error);
    throw error;
  }
};

/**
 * Démarre une nouvelle conversation avec un parent concernant un élève spécifique
 * @param {number} parentId - ID du parent
 * @param {number} eleveId - ID de l'élève
 * @param {string} message - Message initial
 * @returns {Object} - Données de la conversation créée
 */
export const startConversationWithParent = async (parentId, eleveId, message) => {
  try {
    const response = await api.post('/conversations/start_conversation/', {
      destinataire: parentId,
      eleve: eleveId,
      message: message,
    });
    
    // Si la conversation existe déjà, essayer de la restaurer si elle a été supprimée
    if (response.data && response.data.conversation_exists && response.data.conversation && response.data.conversation.id) {
      try {
        const conversationId = response.data.conversation.id;
        console.log(`La conversation ${conversationId} existe déjà, tentative de restauration si nécessaire...`);
        
        // Importer la fonction de restauration depuis api.js
        const { restoreConversation } = require('./api');
        
        // Essayer de restaurer la conversation
        await restoreConversation(conversationId);
        console.log(`Restauration de la conversation ${conversationId} terminée`);
      } catch (restoreError) {
        console.log('Erreur lors de la tentative de restauration, mais on continue:', restoreError);
      }
    }
    
    return response.data;
  } catch (error) {
    console.error('Erreur lors du démarrage de la conversation:', error);
    throw error;
  }
};

// Exporter aussi les fonctions génériques de messagerie
export {
  getConversations,
  getMessages,
  sendMessage,
  markConversationAsRead
};
