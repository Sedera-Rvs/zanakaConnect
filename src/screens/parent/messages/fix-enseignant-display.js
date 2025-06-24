// INSTRUCTIONS POUR CORRIGER L'AFFICHAGE DES ENSEIGNANTS DANS LA MESSAGERIE CÔTÉ PARENT

// 1. MODIFICATION DANS LE FICHIER messagerie.js
// Cherchez la section qui commence par:
console.log(`Traitement de la conversation ${processedConv.id} pour extraire les informations de l'autre utilisateur`);

// Et remplacez tout le bloc de code jusqu'à la ligne "parentInfoFound = true;" par:

// Déterminer le rôle de l'utilisateur courant
const userRole = await storage.getItem('userRole');
console.log(`Rôle de l'utilisateur courant: ${userRole}`);

// Traitement différent selon le rôle de l'utilisateur
if (userRole === 'enseignant') {
  // POUR LES ENSEIGNANTS: Afficher les informations des parents
  let parentInfoFound = false;
  
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
        parentInfoFound = true;
      }
    } catch (error) {
      console.warn(`Erreur lors de la récupération des détails de l'élève ${eleveId}:`, error);
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
    }
  }
  
  // Si pas trouvé dans participants_details, essayer avec le dernier message
  if (!processedConv.other_user.id && processedConv.dernier_message) {
    const dernierMessage = processedConv.dernier_message;
    if (dernierMessage.expediteur_role === 'enseignant') {
      console.log(`Enseignant trouvé dans le dernier message pour la conversation ${processedConv.id}`);
      processedConv.other_user = {
        id: dernierMessage.expediteur_id,
        nom: dernierMessage.expediteur_nom ? dernierMessage.expediteur_nom.split(' ')[1] || '' : 'Enseignant',
        prenom: dernierMessage.expediteur_nom ? dernierMessage.expediteur_nom.split(' ')[0] || '' : '',
        role: 'enseignant'
      };
    }
  }
}

// 2. MODIFICATION DANS LE FICHIER MessagesScreen.js (côté parent)
// Cherchez la fonction renderConversationItem et modifiez la partie qui récupère les informations de l'autre utilisateur:

// Remplacez:
const otherParticipant = item.participants_details.find(p => {
  const participantId = p.id?.toString() || '';
  return participantId !== currentUserId;
});

// Par:
const enseignant = item.participants_details.find(p => p.role === 'enseignant');

if (enseignant) {
  console.log('Enseignant trouvé dans participants_details:', enseignant);
  otherUser = enseignant;
}
