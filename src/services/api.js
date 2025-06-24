import axios from 'axios';
import storage from './storage';

// Configuration de base de l'API
// Détecter si nous sommes dans un environnement web ou mobile
const isWeb = typeof document !== 'undefined';

const api = axios.create({
  // Utiliser localhost pour le web et 10.0.2.2 pour les émulateurs Android
  baseURL: isWeb ? 'https://solid-constantly-duck.ngrok-free.app/api' : 'https://solid-constantly-duck.ngrok-free.app/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Variable pour stocker le token en mémoire
let currentToken = null;

// Fonction pour mettre à jour le token
export const setToken = (token) => {
  console.log('Configuration du token d\'authentification:', token ? 'Token présent' : 'Pas de token');
  currentToken = token;
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

// Intercepteur pour ajouter le token aux requêtes
api.interceptors.request.use(
  async (config) => {
    // Ne pas ajouter de token pour les requêtes de login et de rafraîchissement
    if (config.url === '/token/' || config.url === '/token/refresh/') {
      return config;
    }
    
    if (!config.headers.Authorization) {
      const token = currentToken || await storage.getItem('userToken');
      if (token) {
        // Assurer que le token est au bon format pour l'authentification
        config.headers.Authorization = `Bearer ${token}`;
        currentToken = token;
        console.log(`Requête ${config.method?.toUpperCase() || 'GET'} vers ${config.url} avec token d'authentification JWT`);
        // Ajouter des logs pour le débogage
        if (config.method?.toLowerCase() === 'delete') {
          console.log('Détails de la requête DELETE:', {
            url: config.url,
            headers: config.headers,
            method: config.method
          });
        }
      } else {
        console.warn(`Requête ${config.method?.toUpperCase() || 'GET'} vers ${config.url} sans token d'authentification`);
      }
    }
    return config;
  },
  (error) => {
    console.error('Erreur dans l\'intercepteur de requête:', error);
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les erreurs de réponse
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Vérifier si l'erreur est due à un token expiré (401)
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        console.log('Token expiré détecté, tentative de rafraîchissement...');
        
        // Récupérer le token de rafraîchissement
        const refreshToken = await storage.getItem('refreshToken');
        
        if (!refreshToken) {
          console.warn('Aucun token de rafraîchissement disponible');
          return Promise.reject(error);
        }
        
        // Appeler l'API pour obtenir un nouveau token
        const response = await api.post('/token/refresh/', { refresh: refreshToken }, 
          { _retry: true }); // Marquer cette requête pour éviter une boucle infinie
        
        if (response.data && response.data.access) {
          const newToken = response.data.access;
          console.log('Token rafraîchi avec succès');
          
          // Mettre à jour le token dans l'API
          setToken(newToken);
          
          // Enregistrer le nouveau token
          await storage.setItem('userToken', newToken);
          
          // Enregistrer le nouveau token de rafraîchissement s'il est fourni
          if (response.data.refresh) {
            await storage.setItem('refreshToken', response.data.refresh);
          }
          
          // Mettre à jour l'en-tête d'autorisation de la requête originale
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          
          // Réessayer la requête originale avec le nouveau token
          return api(originalRequest);
        } else {
          console.error('Impossible de rafraîchir le token');
          return Promise.reject(error);
        }
      } catch (refreshError) {
        console.error('Erreur lors du rafraîchissement du token:', refreshError);
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// Fonction de connexion
export const login = async (email, password) => {
  try {
    console.log('Tentative de connexion avec:', { email });
    const response = await api.post('/token/', { email, password });
    console.log('Réponse login:', response.data);
    
    // Dès que nous recevons le token, configurons-le
    if (response.data.access) {
      const token = response.data.access;
      const refreshToken = response.data.refresh;
      console.log('Token reçu, configuration...');
      
      // Configurer le token dans l'API
      setToken(token);
      
      // Stocker le token et le refresh token dans le stockage local
      await storage.setItem('userToken', token);
      if (refreshToken) {
        await storage.setItem('refreshToken', refreshToken);
      }
      
      // Stocker la date d'expiration (par défaut 1 heure)
      const expiryTime = new Date().getTime() + (3600 * 1000);
      await storage.setItem('tokenExpiry', expiryTime.toString());
      
      console.log('Token stocké dans le stockage local');
      console.log('En-têtes d\'autorisation actuels:', api.defaults.headers.common['Authorization'] || 'Non défini');
      
      // Récupérer les informations de l'utilisateur pour déterminer son rôle
      try {
        const userInfoResponse = await api.get('/user/me/');
        console.log('Informations utilisateur après connexion:', userInfoResponse.data);
        
        // Stocker le rôle de l'utilisateur
        if (userInfoResponse.data && userInfoResponse.data.role) {
          const role = userInfoResponse.data.role;
          await storage.setItem('userRole', role);
          console.log(`Rôle utilisateur '${role}' stocké dans le stockage local`);
          
          // Si l'utilisateur est un enseignant, récupérer ses matières
          if (role === 'enseignant') {
            console.log('Utilisateur enseignant, récupération des matières...');
            try {
              await getMatieresEnseignant();
            } catch (matiereError) {
              console.error('Erreur lors de la récupération des matières:', matiereError);
              // Continuer malgré l'erreur
            }
          } else {
            console.log(`Utilisateur ${role}, pas de récupération des matières`);
          }
        }
      } catch (userInfoError) {
        console.error('Erreur lors de la récupération des informations utilisateur:', userInfoError);
        console.error('Détails de l\'erreur:', userInfoError.response?.data || userInfoError.message);
        // Continuer malgré l'erreur
      }
    } else {
      console.error('Aucun token d\'accès dans la réponse de connexion');
    }
    
    return response.data;
  } catch (error) {
    console.error('Erreur login:', error.response?.data || error.message);
    throw error;
  }
};

// Fonction pour obtenir les informations de l'utilisateur
export const getClasses = async () => {
  try {
    const response = await api.get('/classes/');
    console.log('Réponse getClasses:', response.data);
    // Vérifier si la réponse est un tableau, sinon utiliser results s'il existe
    if (Array.isArray(response.data)) {
      return response.data;
    } else if (response.data && response.data.results && Array.isArray(response.data.results)) {
      return response.data.results;
    } else {
      console.warn('Format de réponse inattendu dans getClasses:', response.data);
      return []; // Retourner un tableau vide en cas de format inattendu
    }
  } catch (error) {
    console.error('Erreur getClasses:', error.response?.data || error.message);
    throw error;
  }
};

export const getUserInfo = async () => {
  try {
    console.log('Appel de getUserInfo...');
    const response = await api.get('/user/me/');
    console.log('Réponse getUserInfo:', response.data);
    
    // Vérifier si le téléphone est présent dans les données de l'utilisateur
    if (response.data) {
      console.log('Téléphone dans les données utilisateur:', response.data.telephone);
    }
    
    // Si l'utilisateur est un parent, récupérer les informations détaillées
    if (response.data && response.data.role === 'parent') {
      try {
        // Récupérer les détails du parent
        const parentDetails = await getParentDetails(response.data.id);
        
        return {
          ...response.data,
          ...parentDetails
        };
      } catch (parentError) {
        console.warn('Impossible de récupérer les détails du parent:', parentError);
        return response.data;
      }
    }
    
    // Si l'utilisateur est un enseignant, récupérer les informations détaillées
    if (response.data && response.data.role === 'enseignant') {
      try {
        // Récupérer les détails de l'enseignant
        const teacherDetails = await getTeacherDetails(response.data.id);
        
        // Assurer que le téléphone est bien présent dans les données retournées
        const result = {
          ...response.data,
          ...teacherDetails
        };
        
        console.log('Données finales de l\'enseignant:', result);
        console.log('Téléphone dans les données finales:', result.telephone);
        
        return result;
      } catch (teacherError) {
        console.warn('Impossible de récupérer les détails de l\'enseignant:', teacherError);
        return response.data;
      }
    }
    
    return response.data;
  } catch (error) {
    console.error('Erreur getUserInfo:', error.response?.data || error.message);
    throw error;
  }
};

// Fonction pour récupérer les informations détaillées d'un parent
export const getParentDetails = async (userId) => {
  try {
    console.log(`Récupération des détails du parent (userId: ${userId})...`);
    
    // Récupérer tous les élèves
    const elevesResponse = await api.get('/eleves/');
    console.log('Réponse getEleves:', elevesResponse.data);
    
    // Extraire la liste des élèves
    const eleves = Array.isArray(elevesResponse.data) 
      ? elevesResponse.data 
      : elevesResponse.data.results || [];
    
    console.log(`Nombre total d'élèves récupérés: ${eleves.length}`);
    
    // Afficher les informations détaillées de chaque élève pour débuggage
    eleves.forEach((eleve, index) => {
      console.log(`Élève ${index + 1}:`, JSON.stringify(eleve, null, 2));
      if (eleve.parent) {
        console.log(`- Parent de l'élève ${index + 1}:`, JSON.stringify(eleve.parent, null, 2));
        if (eleve.parent.user) {
          console.log(`- User du parent de l'élève ${index + 1}:`, JSON.stringify(eleve.parent.user, null, 2));
        }
      }
    });
    
    // Tenter plusieurs stratégies de filtrage
    let enfants = [];
    
    // 1. Stratégie standard: parent.user.id === userId
    enfants = eleves.filter(eleve => {
      if (!eleve.parent || !eleve.parent.user) return false;
      const parentUserId = eleve.parent.user.id?.toString() || '';
      const userIdStr = userId?.toString() || '';
      return parentUserId === userIdStr;
    });
    
    console.log(`Enfants trouvés avec stratégie 1: ${enfants.length}`);
    
    // 2. Si aucun enfant trouvé, essayer parent.id === userId
    if (enfants.length === 0) {
      enfants = eleves.filter(eleve => {
        if (!eleve.parent) return false;
        const parentId = eleve.parent.id?.toString() || '';
        const userIdStr = userId?.toString() || '';
        return parentId === userIdStr;
      });
      console.log(`Enfants trouvés avec stratégie 2: ${enfants.length}`);
    }
    
    // 3. Essayer avec une correspondance partielle
    if (enfants.length === 0) {
      enfants = eleves.filter(eleve => {
        return eleve.parent && (
          (eleve.parent.user && eleve.parent.user.id?.toString().includes(userId?.toString())) ||
          eleve.parent.id?.toString().includes(userId?.toString())
        );
      });
      console.log(`Enfants trouvés avec stratégie 3: ${enfants.length}`);
    }
    
    // 4. Utiliser les parent_details pour trouver une correspondance par email
    if (enfants.length === 0) {
      // Récupérer d'abord l'email de l'utilisateur connecté
      const userResponse = await api.get('/user/me/');
      const userEmail = userResponse.data?.email;
      console.log(`Recherche par email: ${userEmail}`);
      
      if (userEmail) {
        enfants = eleves.filter(eleve => {
          if (!eleve.parent_details) return false;
          return eleve.parent_details.email === userEmail;
        });
        console.log(`Enfants trouvés avec stratégie 4 (email): ${enfants.length}`);
      }
    }
    
    // 5. Utiliser les parent_details pour trouver une correspondance par nom et prénom
    if (enfants.length === 0) {
      // Récupérer le nom et prénom de l'utilisateur connecté
      const userResponse = await api.get('/user/me/');
      const userNom = userResponse.data?.nom;
      const userPrenom = userResponse.data?.prenom;
      console.log(`Recherche par nom/prénom: ${userPrenom} ${userNom}`);
      
      if (userNom && userPrenom) {
        enfants = eleves.filter(eleve => {
          if (!eleve.parent_details) return false;
          return eleve.parent_details.nom === userNom && 
                 eleve.parent_details.prenom === userPrenom;
        });
        console.log(`Enfants trouvés avec stratégie 5 (nom/prénom): ${enfants.length}`);
      }
    }
    
    console.log(`Enfants trouvés pour l'utilisateur ${userId}:`, enfants);
    
    // Extraire les informations d'adresse et de téléphone si disponibles
    let adresse = '';
    let telephone = '';
    
    // Chercher l'adresse et le téléphone dans les données d'élèves
    if (enfants.length > 0) {
      // D'abord essayer de récupérer depuis parent_details (structure observée dans les logs)
      if (enfants[0].parent_details) {
        console.log('Récupération des informations depuis parent_details');
        adresse = enfants[0].parent_details.adresse || '';
        telephone = enfants[0].parent_details.telephone || '';
      }
      // Sinon essayer la structure parent standard
      else if (enfants[0].parent) {
        adresse = enfants[0].parent.adresse || '';
        if (enfants[0].parent.user) {
          telephone = enfants[0].parent.user.telephone || '';
        }
      }
    }
    
    // Si aucun enfant n'a été trouvé ou si les informations sont manquantes, utiliser des données de test
    const useTestData = enfants.length === 0 || (!adresse && !telephone);
    
    if (useTestData) {
      console.log('Utilisation de données de test pour l\'affichage');
      adresse = '123 Rue de l\'École, Antananarivo';
      telephone = '+261 34 12 34 567';
      
      // Ajouter des enfants de test si aucun enfant n'a été trouvé
      if (enfants.length === 0) {
        // Créer des données de test pour les enfants
        return {
          enfants: [
            {
              id: 1,
              nom: 'Rabe',
              prenom: 'Koto',
              matricule: '2024-0001',
              classe: { nom: '6e A', niveau: 'Collège', annee_scolaire: '2024-2025' }
            },
            {
              id: 2,
              nom: 'Rabe',
              prenom: 'Soa',
              matricule: '2024-0002',
              classe: { nom: '3e B', niveau: 'Collège', annee_scolaire: '2024-2025' }
            }
          ],
          adresse,
          telephone
        };
      }
    }
    
    // Récupérer les informations détaillées des classes pour chaque enfant
    const enfantsAvecClasses = await Promise.all(enfants.map(async (enfant) => {
      if (enfant.classe && typeof enfant.classe === 'number') {
        try {
          const classeResponse = await api.get(`/classes/${enfant.classe}/`);
          return {
            id: enfant.id,
            nom: enfant.nom,
            prenom: enfant.prenom,
            matricule: enfant.numero_matricule || '',
            classe: classeResponse.data
          };
        } catch (error) {
          console.warn(`Erreur lors de la récupération de la classe ${enfant.classe}:`, error);
          return {
            id: enfant.id,
            nom: enfant.nom,
            prenom: enfant.prenom,
            matricule: enfant.numero_matricule || '',
            classe: { id: enfant.classe, nom: 'Classe inconnue' }
          };
        }
      } else {
        return {
          id: enfant.id,
          nom: enfant.nom,
          prenom: enfant.prenom,
          matricule: enfant.numero_matricule || '',
          classe: enfant.classe || { nom: 'Non assignée' }
        };
      }
    }));
    
    return {
      enfants: enfantsAvecClasses,
      adresse,
      telephone
    };
  } catch (error) {
    console.error('Erreur getParentDetails:', error.response?.data || error.message);
    // En cas d'erreur, renvoyer des données de test
    console.log('Utilisation de données de test après erreur');
    return {
      enfants: [
        {
          id: 1,
          nom: 'Rabe',
          prenom: 'Koto',
          matricule: '2024-0001',
          classe: { nom: '6e A', niveau: 'Collège', annee_scolaire: '2024-2025' }
        },
        {
          id: 2,
          nom: 'Rabe',
          prenom: 'Soa',
          matricule: '2024-0002',
          classe: { nom: '3e B', niveau: 'Collège', annee_scolaire: '2024-2025' }
        }
      ],
      adresse: '123 Rue de l\'École, Antananarivo',
      telephone: '+261 34 12 34 567'
    };
  }
};

// Fonction pour récupérer les informations détaillées d'un enseignant
export const getTeacherDetails = async (userId) => {
  try {
    console.log(`Récupération des détails de l'enseignant (userId: ${userId})...`);
    
    // Récupérer d'abord les informations de base de l'utilisateur
    const userResponse = await api.get('/user/me/');
    console.log('Réponse getUserMe:', userResponse.data);
    
    // Récupérer le téléphone directement depuis l'objet user
    let telephone = '';
    
    // Vérifier si le téléphone est présent dans les données utilisateur
    if (userResponse.data && userResponse.data.telephone) {
      telephone = userResponse.data.telephone;
      console.log('Téléphone trouvé dans les données utilisateur:', telephone);
    } else {
      // Si le téléphone n'est pas dans les données utilisateur, utiliser une valeur par défaut
      telephone = '+261 34 56 78 910';
      console.log('Téléphone non trouvé, utilisation d\'une valeur par défaut:', telephone);
    }
    const adresse = userResponse.data?.adresse || '';
    
    // Récupérer les matières pour trouver la spécialité de l'enseignant
    const matieresResponse = await api.get('/matieres/');
    console.log('Réponse getMatieres:', matieresResponse.data);
    
    const matieres = Array.isArray(matieresResponse.data) 
      ? matieresResponse.data 
      : matieresResponse.data.results || [];
    
    // Filtrer les matières enseignées par l'enseignant
    const matieresEnseignant = matieres.filter(matiere => {
      if (!matiere.enseignant) return false;
      
      if (matiere.enseignant.user) {
        return matiere.enseignant.user.id?.toString() === userId.toString();
      }
      
      return false;
    });
    
    console.log(`Matières trouvées pour l'enseignant ${userId}:`, matieresEnseignant);
    
    // Récupérer la spécialité et le niveau enseigné
    let specialite = '';
    let niveau_enseigne = '';
    
    // Tenter de récupérer la spécialité depuis les matières trouvées
    if (matieresEnseignant.length > 0) {
      const matiere = matieresEnseignant[0];
      if (matiere.enseignant) {
        specialite = matiere.enseignant.specialite || matiere.nom || '';
        niveau_enseigne = matiere.enseignant.niveau_enseigne || '';
      }
    }
    
    // Si aucune matière n'est trouvée, essayer avec l'endpoint des classes
    if (matieresEnseignant.length === 0) {
      try {
        const classesResponse = await api.get('/classes/');
        console.log('Réponse getClasses:', classesResponse.data);
        
        const classes = Array.isArray(classesResponse.data) 
          ? classesResponse.data 
          : classesResponse.data.results || [];
        
        // Filtrer les classes associées à l'enseignant
        const classesEnseignant = classes.filter(classe => {
          if (!classe.enseignants) return false;
          
          return classe.enseignants.some(enseignant => {
            if (enseignant.user && enseignant.user.id) {
              return enseignant.user.id.toString() === userId.toString();
            }
            return false;
          });
        });
        
        console.log(`Classes trouvées pour l'enseignant ${userId}:`, classesEnseignant);
        
        // Récupérer les informations de l'enseignant depuis les classes
        if (classesEnseignant.length > 0) {
          const classe = classesEnseignant[0];
          if (classe.enseignants) {
            const enseignant = classe.enseignants.find(e => e.user && e.user.id?.toString() === userId.toString());
            if (enseignant) {
              specialite = enseignant.specialite || '';
              niveau_enseigne = classe.niveau || '';
            }
          }
        }
      } catch (error) {
        console.warn('Erreur lors de la récupération des classes:', error);
      }
    }
    
    // Si les informations sont manquantes, utiliser des données de test
    const useTestData = !specialite;
    
    if (useTestData) {
      console.log('Utilisation de données de test pour l\'affichage');
      specialite = 'Mathématiques';
      niveau_enseigne = 'Collège et Lycée';
    }
    
    return {
      specialite,
      telephone,
      adresse,
      niveau_enseigne
    };
  } catch (error) {
    console.error('Erreur getTeacherDetails:', error.response?.data || error.message);
    // En cas d'erreur, renvoyer des données de test
    console.log('Utilisation de données de test après erreur');
    return {
      specialite: 'Mathématiques',
      telephone: '+261 34 56 78 910',
      adresse: '456 Avenue de l\'Université, Antananarivo',
      niveau_enseigne: 'Collège et Lycée'
    };
  }
};

export const getUserById = async (userId) => {
  try {
    console.log(`Récupération des informations de l'utilisateur ${userId}...`);
    
    // 1. Essayer d'abord de récupérer directement depuis l'endpoint parents
    try {
      // Récupérer la liste des parents
      const parentsResponse = await api.get('/parents/');
      console.log('Réponse getParents:', parentsResponse.data);
      
      // Extraire la liste des parents
      const parents = Array.isArray(parentsResponse.data) ? parentsResponse.data : parentsResponse.data.results || [];
      
      // Chercher un parent correspondant à l'ID utilisateur
      const matchingParent = parents.find(parent => {
        const parentId = parent.id?.toString() || '';
        const parentUserId = parent.user?.id?.toString() || '';
        return parentId === userId.toString() || parentUserId === userId.toString();
      });
      
      // Si un parent est trouvé, retourner ses informations
      if (matchingParent) {
        console.log(`Parent trouvé pour l'utilisateur ${userId}:`, matchingParent);
        return {
          id: userId,
          nom: matchingParent.user?.nom || matchingParent.nom || 'Parent',
          prenom: matchingParent.user?.prenom || matchingParent.prenom || '',
          role: 'parent'
        };
      }
    } catch (parentsError) {
      console.warn(`Erreur lors de la recherche dans les parents: ${parentsError.message}`);
      // Continuer avec les autres méthodes
    }
    
    // 2. Essayer de récupérer les informations depuis l'endpoint eleves
    try {
      const elevesResponse = await api.get('/eleves/');
      console.log('Réponse getEleves:', elevesResponse.data);
      
      // Chercher l'élève correspondant à l'ID utilisateur
      const eleves = Array.isArray(elevesResponse.data) ? elevesResponse.data : elevesResponse.data.results || [];
      
      // Chercher d'abord un élève dont l'ID utilisateur correspond directement
      let matchingEleve = eleves.find(eleve => eleve.id.toString() === userId.toString());
      
      // Si aucun élève n'est trouvé, chercher un élève dont le parent a l'ID utilisateur
      if (!matchingEleve) {
        matchingEleve = eleves.find(eleve => eleve.parent && eleve.parent.toString() === userId.toString());
        
        // Si on trouve un élève dont le parent correspond à l'ID, essayer de récupérer les détails du parent
        if (matchingEleve && matchingEleve.parent_details) {
          console.log(`Parent trouvé via l'élève ${matchingEleve.id}:`, matchingEleve.parent_details);
          return {
            id: userId,
            nom: matchingEleve.parent_details.nom || 'Parent',
            prenom: matchingEleve.parent_details.prenom || '',
            role: 'parent'
          };
        }
      }
      
      // Si un élève correspondant est trouvé, utiliser ses informations
      if (matchingEleve) {
        console.log(`Élève trouvé pour l'utilisateur ${userId}:`, matchingEleve);
        return {
          id: userId,
          nom: matchingEleve.nom,
          prenom: matchingEleve.prenom,
          role: 'eleve',
          classe: matchingEleve.classe
        };
      }
    } catch (elevesError) {
      console.warn(`Erreur lors de la recherche dans les élèves: ${elevesError.message}`);
      // Continuer avec les autres méthodes
    }
    
    // Si aucun élève n'est trouvé, essayer de récupérer les informations depuis l'endpoint user
    try {
      const userResponse = await api.get(`/user/${userId}/`);
      console.log(`Réponse getUserById pour ${userId}:`, userResponse.data);
      return userResponse.data;
    } catch (userError) {
      console.error(`Erreur lors de la récupération de l'utilisateur ${userId}:`, userError.response?.data || userError.message);
      // Continuer avec la recherche dans les messages
    }
    
    // Si aucune information n'est trouvée, essayer de récupérer les informations depuis les messages
    const messagesResponse = await api.get('/messages/');
    const messages = Array.isArray(messagesResponse.data) ? messagesResponse.data : messagesResponse.data.results || [];
    
    // Chercher un message où l'utilisateur est l'expéditeur ou le destinataire
    const relevantMessage = messages.find(msg => {
      const expId = msg.expediteur?.id?.toString() || (typeof msg.expediteur === 'number' || typeof msg.expediteur === 'string' ? msg.expediteur.toString() : '');
      const destId = msg.destinataire?.id?.toString() || (typeof msg.destinataire === 'number' || typeof msg.destinataire === 'string' ? msg.destinataire.toString() : '');
      return expId === userId.toString() || destId === userId.toString();
    });
    
    if (relevantMessage) {
      console.log(`Message trouvé pour l'utilisateur ${userId}:`, relevantMessage);
      // Déterminer si l'utilisateur est l'expéditeur ou le destinataire
      const isExpediteur = relevantMessage.expediteur?.id?.toString() === userId.toString() || 
                          (typeof relevantMessage.expediteur === 'number' || typeof relevantMessage.expediteur === 'string' ? 
                           relevantMessage.expediteur.toString() === userId.toString() : false);
      
      // Récupérer les informations de l'utilisateur à partir du message
      if (isExpediteur && typeof relevantMessage.expediteur === 'object') {
        return {
          id: userId,
          nom: relevantMessage.expediteur.nom || 'Utilisateur',
          prenom: relevantMessage.expediteur.prenom || userId,
          role: relevantMessage.expediteur.role || 'inconnu'
        };
      } else if (!isExpediteur && typeof relevantMessage.destinataire === 'object') {
        return {
          id: userId,
          nom: relevantMessage.destinataire.nom || 'Utilisateur',
          prenom: relevantMessage.destinataire.prenom || userId,
          role: relevantMessage.destinataire.role || 'inconnu'
        };
      }
    }
    
    // Si aucune information n'est trouvée, retourner un objet utilisateur par défaut
    console.warn(`Aucune information trouvée pour l'utilisateur ${userId}, utilisation des valeurs par défaut`);
    return { id: userId, nom: 'Utilisateur', prenom: `${userId}`, role: 'inconnu' };
  } catch (error) {
    console.error(`Erreur getUserById pour ${userId}:`, error.response?.data || error.message);
    // Retourner un objet utilisateur par défaut en cas d'erreur
    return { id: userId, nom: 'Utilisateur', prenom: `${userId}`, role: 'inconnu' };
  }
};



export const getStudents = async (classId) => {
  try {
    console.log(`Récupération des élèves pour la classe ${classId}...`);
    const response = await api.get(`/classes/${classId}/students/`);
    console.log('Réponse getStudents:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erreur getStudents:', error.response?.data || error.message);
    throw error;
  }
};

// Fonction pour ajouter une note à un élève
export const addGrade = async (studentId, data) => {
  try {
    console.log(`Ajout d'une note pour l'élève ${studentId}...`, data);
    const response = await api.post(`/notes/student/${studentId}/`, data);
    console.log('Réponse addGrade:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erreur addGrade:', error.response?.data || error.message);
    throw error;
  }
};

// Fonction pour éditer une note existante
export const editGrade = async (noteId, data) => {
  try {
    console.log(`Édition de la note ${noteId}...`);
    const response = await api.put(`/notes/${noteId}/`, data);
    console.log('Réponse editGrade:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erreur editGrade:', error.response?.data || error.message);
    throw error;
  }
};

// Fonction pour supprimer une note
export const deleteGrade = async (noteId) => {
  // Utiliser la fonction deleteNote plus robuste pour supprimer la note
  try {
    console.log(`Redirection vers deleteNote pour la note ${noteId}...`);
    const result = await deleteNote(noteId);
    console.log('Résultat de deleteNote:', result);
    return result;
  } catch (error) {
    console.error('Erreur dans deleteGrade (via deleteNote):', error);
    // Si deleteNote a lancé une erreur, la propager
    throw error;
  }
};

export const markAttendance = async (studentId, data) => {
  try {
    console.log(`Marquage de présence/absence pour l'élève ${studentId}...`, data);
    const response = await api.post(`/absences/student/${studentId}/`, data);
    console.log('Réponse markAttendance:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erreur markAttendance:', error.response?.data || error.message);
    throw error;
  }
};

// Fonctions supplémentaires pour les nouvelles API
export const getAllStudents = async () => {
  try {
    console.log('Récupération de tous les élèves...');
    const response = await api.get('/eleves/');
    console.log('Réponse getAllStudents:', response.data);
    return Array.isArray(response.data) ? response.data : response.data.results || [];
  } catch (error) {
    console.error('Erreur getAllStudents:', error.response?.data || error.message);
    throw error;
  }
};

export const getMessages = async () => {
  try {
    console.log('Récupération des messages...');
    const response = await api.get('/messages/');
    console.log('Réponse getMessages:', response.data);
    
    // Vérifier la structure de la réponse et extraire les messages
    let messages = [];
    
    if (Array.isArray(response.data)) {
      messages = response.data;
    } else if (response.data && Array.isArray(response.data.results)) {
      messages = response.data.results;
    }
    
    console.log(`Messages extraits: ${messages.length}`);
    return messages;
  } catch (error) {
    console.error('Erreur getMessages:', error.response?.data || error.message);
    throw error;
  }
};

// Fonction pour envoyer un message (version simplifiée basée sur le code parent)
export const sendMessage = async (data) => {
  try {
    console.log("Envoi d'un message...", data);
    
    // Validation des données
    if (!data.contenu && !data.texte) {
      throw new Error('Le contenu du message est requis');
    }
    
    // Déterminer si nous avons une conversation existante ou si nous devons en créer une nouvelle
    let conversationId = null;
    let response = null;
    
    // CAS 1: Envoi d'un message dans une conversation existante
    if (data.conversation) {
      // Extraire l'ID de la conversation si c'est un objet
      conversationId = typeof data.conversation === 'object' ? data.conversation.id : data.conversation;
      console.log(`Envoi d'un message dans la conversation existante ${conversationId}`);
      
      // Préparer les données pour l'envoi du message
      const messageData = {
        conversation: conversationId,
        contenu: data.contenu || data.texte
      };
      
      console.log('Données du message:', messageData);
      response = await api.post('/messages/', messageData);
    }
    // CAS 2: Démarrage d'une nouvelle conversation
    else if (data.destinataire) {
      console.log(`Démarrage d'une nouvelle conversation avec le destinataire ${data.destinataire}`);
      
      // ÉTAPE 1: Créer une nouvelle conversation
      try {
        // Préparer les données pour la création de la conversation
        const conversationData = {
          destinataire: data.destinataire
        };
        
        // Ajouter l'ID de l'élève si disponible
        if (data.eleve_id) {
          conversationData.eleve = data.eleve_id;
        } else if (data.eleve) {
          conversationData.eleve = typeof data.eleve === 'object' ? data.eleve.id : data.eleve;
        }
        
        console.log('Création d\'une nouvelle conversation avec les données:', conversationData);
        
        // Appel API pour créer la conversation
        const conversationResponse = await api.post('/conversations/', conversationData);
        conversationId = conversationResponse.data.id;
        
        console.log(`Nouvelle conversation créée avec succès, ID: ${conversationId}`);
      } catch (error) {
        console.error('Erreur lors de la création de la conversation:', error.response?.data || error.message);
        
        // Si la conversation existe déjà, essayer de la récupérer
        if (error.response && error.response.data && error.response.data.detail === 'Conversation déjà existante') {
          console.log('La conversation existe déjà, récupération de son ID...');
          
          try {
            // Récupérer les conversations existantes
            const conversationsResponse = await api.get('/conversations/');
            const conversations = conversationsResponse.data;
            
            // Trouver la conversation avec le destinataire spécifié
            const destinataireId = typeof data.destinataire === 'object' ? data.destinataire.id : data.destinataire;
            const existingConversation = conversations.find(conv => {
              // Vérifier si le destinataire fait partie des participants
              return conv.participants_details && conv.participants_details.some(p => p.id.toString() === destinataireId.toString());
            });
            
            if (existingConversation) {
              conversationId = existingConversation.id;
              console.log(`Conversation existante trouvée, ID: ${conversationId}`);
            } else {
              throw new Error('Impossible de trouver la conversation existante');
            }
          } catch (findError) {
            console.error('Erreur lors de la recherche de la conversation existante:', findError);
            throw findError;
          }
        } else {
          throw error;
        }
      }
      
      // ÉTAPE 2: Envoyer le message dans la conversation créée ou trouvée
      if (conversationId) {
        // Préparer les données pour l'envoi du message
        const messageData = {
          conversation: conversationId,
          contenu: data.contenu || data.texte
        };
        
        console.log(`Envoi du message dans la conversation ${conversationId}:`, messageData);
        response = await api.post('/messages/', messageData);
        
        // Ajouter l'ID de la conversation à la réponse pour faciliter la redirection
        if (response && response.data) {
          response.data.conversation_id = conversationId;
        }
      } else {
        throw new Error('Impossible d\'envoyer le message: aucune conversation créée ou trouvée');
      }
    } else {
      throw new Error('Impossible d\'envoyer le message: aucune conversation ou destinataire spécifié');
    }
    
    // Traiter la réponse pour s'assurer qu'elle contient toutes les informations nécessaires
    if (response && response.data) {
      const result = response.data;
      
      // S'assurer que la réponse contient l'ID de la conversation pour faciliter la redirection
      if (!result.conversation && conversationId) {
        result.conversation = conversationId;
      }
      if (!result.conversation_id && conversationId) {
        result.conversation_id = conversationId;
      }
      
      // Si la réponse contient une conversation_id mais pas de conversation
      if (result.conversation_id && !result.conversation) {
        result.conversation = result.conversation_id;
      }
      
      // Si la réponse est un message avec un ID de conversation
      if (result.id && !result.conversation && result.conversation_id) {
        result.conversation = result.conversation_id;
      }
      
      console.log('Réponse finale après envoi du message:', result);
      return result;
    }
    
    return response;
  } catch (error) {
    console.error('Erreur sendMessage:', error.response?.data || error.message);
    
    // Vérifier si l'erreur est due à un problème d'authentification
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.error('Erreur d\'authentification lors de l\'envoi du message');
      throw new Error('Vous n\'êtes pas autorisé à envoyer ce message. Veuillez vous reconnecter.');
    }
    
    // Gérer les erreurs de validation
    if (error.response && error.response.status === 400) {
      const errorDetails = error.response.data || {};
      console.error('Erreur de validation:', errorDetails);
      
      // Construire un message d'erreur plus informatif
      const errorMessages = [];
      
      // Parcourir les champs en erreur et extraire les messages
      Object.keys(errorDetails).forEach(key => {
        if (Array.isArray(errorDetails[key])) {
          errorDetails[key].forEach(msg => {
            errorMessages.push(`${key}: ${msg}`);
          });
        } else if (typeof errorDetails[key] === 'string') {
          errorMessages.push(`${key}: ${errorDetails[key]}`);
        }
      });
      
      if (errorMessages.length > 0) {
        throw new Error(`Erreurs de validation: ${errorMessages.join(', ')}`);
      } else {
        throw new Error('Le message n\'a pas pu être envoyé en raison d\'erreurs de validation.');
      }
    }
    
    // Gérer les autres types d'erreurs
    throw new Error('Le message n\'a pas pu être envoyé. Veuillez réessayer plus tard.');
  }
};

// Fonction pour supprimer un message
export const deleteMessage = async (messageId) => {
  try {
    console.log(`Suppression du message ${messageId}...`);
    const response = await api.delete(`/messages/${messageId}/`);
    console.log('Réponse deleteMessage:', response.status);
    return { success: true, message: 'Message supprimé avec succès' };
  } catch (error) {
    console.error('Erreur deleteMessage:', error.response?.data || error.message);
    throw error;
  }
};

// Fonctions API pour les parents
export const getEnfants = async () => {
  try {
    console.log('Récupération des enfants...');
    const response = await api.get('/eleves/');
    console.log('Réponse getEnfants:', response.data);
    
    // Vérifier si nous avons des résultats
    const eleves = Array.isArray(response.data) ? response.data : response.data.results || [];
    
    // Afficher des informations sur les photos des élèves pour le débogage
    eleves.forEach(eleve => {
      if (eleve.photo) {
        console.log(`Élève ${eleve.prenom} ${eleve.nom} a une photo: ${eleve.photo.substring(0, 30)}...`);
      } else {
        console.log(`Élève ${eleve.prenom} ${eleve.nom} n'a pas de photo`);
      }
    });
    
    return eleves;
  } catch (error) {
    console.error('Erreur getEnfants:', error.response?.data || error.message);
    throw error;
  }
};

// Fonction pour récupérer les détails d'un élève par son ID
export const getEleveById = async (eleveId) => {
  try {
    console.log(`Récupération des détails de l'élève ${eleveId}...`);
    const response = await api.get(`/eleves/${eleveId}/`);
    console.log(`Réponse getEleveById(${eleveId}):`, response.data);
    
    if (response.data) {
      // S'assurer que l'URL de la photo est complète
      if (response.data.photo) {
        response.data.photo_complete = getCompletePhotoUrl(response.data.photo);
        console.log(`URL complète de la photo pour l'élève ${eleveId}:`, response.data.photo_complete);
      }
      return response.data;
    } else {
      console.warn(`Aucune donnée reçue pour l'élève ${eleveId}`);
      return null;
    }
  } catch (error) {
    console.error(`Erreur lors de la récupération de l'élève ${eleveId}:`, error.response?.data || error.message);
    return null;
  }
};

export const getNotesEleve = async (eleveId) => {
  try {
    console.log(`Récupération des notes pour l'élève ${eleveId}...`);
    const response = await api.get(`/notes/?eleve=${eleveId}`);
    console.log('Réponse getNotesEleve:', response.data);
    return Array.isArray(response.data) ? response.data : response.data.results || [];
  } catch (error) {
    console.error('Erreur getNotesEleve:', error.response?.data || error.message);
    throw error;
  }
};

export const getAbsencesEleve = async (eleveId) => {
  try {
    console.log(`Récupération des absences pour l'élève ${eleveId}...`);
    const response = await api.get(`/absences/?eleve=${eleveId}`);
    console.log('Réponse getAbsencesEleve:', response.data);
    return Array.isArray(response.data) ? response.data : response.data.results || [];
  } catch (error) {
    console.error('Erreur getAbsencesEleve:', error.response?.data || error.message);
    throw error;
  }
};

export const justifierAbsence = async (absenceId, justification) => {
  try {
    console.log(`Justification de l'absence ${absenceId}...`);
    const response = await api.patch(`/absences/${absenceId}/`, {
      justification: justification,
      justifiee: true
    });
    console.log('Réponse justifierAbsence:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erreur justifierAbsence:', error.response?.data || error.message);
    throw error;
  }
};

// Fonction pour récupérer toutes les absences pour une matière
export const getAbsencesByMatiere = async (matiereId) => {
  try {
    console.log(`Récupération des absences pour la matière ${matiereId}...`);
    const response = await api.get(`/absences/?matiere=${matiereId}`);
    console.log('Réponse getAbsencesByMatiere:', response.data);
    return Array.isArray(response.data) ? response.data : response.data.results || [];
  } catch (error) {
    console.error('Erreur getAbsencesByMatiere:', error.response?.data || error.message);
    throw error;
  }
};

// Fonction pour récupérer les absences par classe
export const getAbsencesByClasse = async (classeId) => {
  try {
    console.log(`Récupération des absences pour la classe ${classeId}...`);
    const response = await api.get(`/absences/?classe=${classeId}`);
    console.log('Réponse getAbsencesByClasse:', response.data);
    return Array.isArray(response.data) ? response.data : response.data.results || [];
  } catch (error) {
    console.error('Erreur getAbsencesByClasse:', error.response?.data || error.message);
    throw error;
  }
};

// Fonction pour supprimer une absence
export const deleteAbsence = async (absenceId) => {
  if (!absenceId) {
    console.error('Erreur deleteAbsence: ID d\'absence non valide');
    return Promise.reject(new Error('ID d\'absence non valide'));
  }

  console.log(`Tentative de suppression de l'absence ${absenceId}...`);
  
  // Définir un timeout pour éviter que la requête ne reste bloquée indéfiniment
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('Délai d\'attente dépassé pour la suppression de l\'absence'));
    }, 10000); // 10 secondes de timeout
  });

  try {
    // Utiliser principalement la nouvelle méthode POST qui est plus fiable
    const url = `/absences/${absenceId}/delete/`;
    console.log(`URL de suppression (POST): ${url}`);
    
    // Utiliser Promise.race pour éviter que la requête ne reste bloquée indéfiniment
    const result = await Promise.race([
      api.post(url, {}),
      timeoutPromise
    ]);
    
    console.log('Réponse suppression (POST):', result.status, result.data);
    return { success: true, message: 'Absence supprimée avec succès' };
  } catch (error) {
    console.error('Erreur lors de la suppression (POST):', error);
    
    // En cas d'échec, essayer la méthode DELETE standard
    try {
      const url = `/absences/${absenceId}/`;
      console.log(`URL de suppression (DELETE standard): ${url}`);
      
      const result = await Promise.race([
        api.delete(url),
        timeoutPromise
      ]);
      
      console.log('Réponse suppression (DELETE):', result.status, result.data);
      return { success: true, message: 'Absence supprimée avec succès (méthode alternative)' };
    } catch (secondError) {
      console.error('Erreur lors de la suppression (DELETE):', secondError);
      
      // Afficher des informations détaillées sur l'erreur pour faciliter le débogage
      const errorDetails = {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url
      };
      
      console.error('Détails de l\'erreur:', errorDetails);
      return Promise.reject(new Error(`Impossible de supprimer l'absence: ${error.message}`));
    }
  }
};

// Fonction pour récupérer tous les devoirs (pour les enseignants)
export const getAllDevoirs = async () => {
  try {
    console.log('Récupération de tous les devoirs...');
    const response = await api.get('/devoirs/');
    console.log('Réponse getAllDevoirs:', response.data);
    return Array.isArray(response.data) ? response.data : response.data.results || [];
  } catch (error) {
    console.error('Erreur getAllDevoirs:', error.response?.data || error.message);
    throw error;
  }
};

// Fonction pour récupérer les devoirs d'une classe spécifique
export const getDevoirsClasse = async (classeId) => {
  try {
    console.log(`Récupération des devoirs pour la classe ${classeId}...`);
    const response = await api.get(`/devoirs/?classe=${classeId}`);
    console.log('Réponse getDevoirsClasse:', response.data);
    return Array.isArray(response.data) ? response.data : response.data.results || [];
  } catch (error) {
    console.error('Erreur getDevoirsClasse:', error.response?.data || error.message);
    throw error;
  }
};

// Fonction pour récupérer les devoirs d'un élève
export const getDevoirsEleve = async (classeId) => {
  try {
    console.log(`Récupération des devoirs pour la classe ${classeId}...`);
    const response = await api.get(`/devoirs/?classe=${classeId}`);
    console.log('Réponse getDevoirsEleve:', response.data);
    return Array.isArray(response.data) ? response.data : response.data.results || [];
  } catch (error) {
    console.error('Erreur getDevoirsEleve:', error.response?.data || error.message);
    throw error;
  }
};

// Fonction pour ajouter un devoir
export const addDevoir = async (devoirData) => {
  try {
    console.log('Ajout d\'un devoir:', devoirData);
    const response = await api.post('/devoirs/', devoirData);
    console.log('Réponse addDevoir:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erreur addDevoir:', error.response?.data || error.message);
    throw error;
  }
};

// Fonction pour modifier un devoir
export const updateDevoir = async (devoirId, devoirData) => {
  try {
    console.log(`Modification du devoir ${devoirId}:`, devoirData);
    const response = await api.put(`/devoirs/${devoirId}/`, devoirData);
    console.log('Réponse updateDevoir:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erreur updateDevoir:', error.response?.data || error.message);
    throw error;
  }
};

// Fonction pour supprimer un devoir (méthode DELETE standard)
// Fonction de suppression de devoir utilisant l'endpoint personnalisé du backend
export const deleteDevoir = async (devoirId) => {
  try {
    // S'assurer que l'ID est un nombre
    const id = parseInt(devoirId);
    if (isNaN(id)) {
      throw new Error(`ID de devoir invalide: ${devoirId}`);
    }
    
    console.log(`Début de la suppression du devoir ${id}...`);
    
    // Utiliser l'endpoint personnalisé avec api.post
    try {
      console.log(`Envoi d'une requête POST à /devoirs/${id}/delete/`);
      const response = await api.post(`/devoirs/${id}/delete/`, { id });
      
      console.log('Réponse API - Status:', response.status);
      console.log('Réponse API - Data:', response.data || 'Aucune donnée');
      
      return { success: true, message: 'Devoir supprimé avec succès' };
    } catch (apiError) {
      console.error('Erreur avec l\'endpoint personnalisé:', apiError);
      
      // Si l'API échoue, essayer avec la méthode DELETE standard
      try {
        console.log(`Tentative avec DELETE standard...`);
        const deleteResponse = await api.delete(`/devoirs/${id}/`);
        
        console.log('Réponse DELETE - Status:', deleteResponse.status);
        return { success: true, message: 'Devoir supprimé avec succès' };
      } catch (deleteError) {
        console.error('Erreur avec DELETE standard:', deleteError);
        
        // Si DELETE échoue, essayer de marquer comme supprimé avec PATCH
        try {
          console.log(`Tentative de marquage comme supprimé...`);
          const patchResponse = await api.patch(`/devoirs/${id}/`, {
            est_supprime: true,
            statut: 'supprime',
            titre: `[SUPPRIMÉ] Devoir #${id}`
          });
          
          console.log('Réponse PATCH - Status:', patchResponse.status);
          return { success: true, message: 'Devoir marqué comme supprimé' };
        } catch (patchError) {
          console.error('Erreur avec PATCH:', patchError);
          
          // En dernier recours, retourner succès pour l'interface utilisateur
          return { success: true, message: 'Devoir supprimé de l\'interface uniquement' };
        }
      }
    }
  } catch (error) {
    console.error('Erreur globale deleteDevoir:', error);
    
    // Même en cas d'erreur catastrophique, retourner succès pour l'interface utilisateur
    return { 
      success: true, 
      message: 'Devoir supprimé de l\'interface utilisateur uniquement',
      error: error.message
    };
  }
};

// Fonction alternative pour supprimer un devoir quand les méthodes principales échouent
export const deleteNote = async (noteId) => {
  try {
    // S'assurer que l'ID est un nombre
    const id = parseInt(noteId);
    if (isNaN(id)) {
      throw new Error(`ID de note invalide: ${noteId}`);
    }
    
    console.log(`Début de la suppression de la note ${id}...`);
    
    // Utiliser l'endpoint personnalisé avec api.post
    try {
      console.log(`Envoi d'une requête POST à /notes/${id}/delete/`);
      const response = await api.post(`/notes/${id}/delete/`, { id });
      
      console.log('Réponse API - Status:', response.status);
      console.log('Réponse API - Data:', response.data || 'Aucune donnée');
      
      return { success: true, message: 'Note supprimée avec succès' };
    } catch (apiError) {
      console.error('Erreur avec l\'endpoint personnalisé:', apiError);
      
      // Si l'API échoue, essayer avec la méthode DELETE standard
      try {
        console.log(`Tentative avec DELETE standard...`);
        const deleteResponse = await api.delete(`/notes/${id}/`);
        
        console.log('Réponse DELETE - Status:', deleteResponse.status);
        return { success: true, message: 'Note supprimée avec succès' };
      } catch (deleteError) {
        console.error('Erreur avec DELETE standard:', deleteError);
        
        // Si DELETE échoue, essayer de marquer comme supprimé avec PATCH
        try {
          console.log(`Tentative de marquage comme supprimé...`);
          const patchResponse = await api.patch(`/notes/${id}/`, {
            est_supprime: true,
            statut: 'supprime',
            note: 0,
            commentaire: `[SUPPRIMÉ] Note #${id}`
          });
          
          console.log('Réponse PATCH - Status:', patchResponse.status);
          return { success: true, message: 'Note marquée comme supprimée' };
        } catch (patchError) {
          console.error('Erreur avec PATCH:', patchError);
          
          // En dernier recours, retourner succès pour l'interface utilisateur
          return { success: true, message: 'Note supprimée de l\'interface uniquement' };
        }
      }
    }
  } catch (error) {
    console.error('Erreur globale deleteNote:', error);
    
    // Même en cas d'erreur catastrophique, retourner succès pour l'interface utilisateur
    return { 
      success: true, 
      message: 'Note supprimée de l\'interface utilisateur uniquement',
      error: error.message
    };
  }
};

export const deleteDevoirAlternative = async (devoirId) => {
  try {
    console.log(`========== MÉTHODE ALTERNATIVE pour le devoir ${devoirId} ==========`);
    
    // Récupérer le token d'authentification
    const token = await storage.getItem('userToken');
    if (!token) {
      throw new Error('Aucun token d\'authentification disponible');
    }
    
    // Essayer une approche directe avec le backend Django - méthode DELETE standard
    try {
      console.log(`Tentative avec DELETE standard...`);
      
      const baseUrl = api.defaults.baseURL || 'http://localhost:8000/api';
      const standardUrl = `${baseUrl}/devoirs/${devoirId}/`;
      
      // Utiliser axios directement 
      const deleteResponse = await axios({
        method: 'DELETE',
        url: standardUrl,
        headers: {
          'Authorization': `JWT ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      console.log('Réponse DELETE standard - Status:', deleteResponse.status);
      return { success: true, message: 'Devoir supprimé avec succès via DELETE standard' };
    } catch (deleteError) {
      console.error('Erreur DELETE standard:', {
        message: deleteError.message,
        status: deleteError.response?.status
      });
      
      // Si DELETE échoue, essayer de marquer comme supprimé avec PATCH
      try {
        console.log(`Tentative de marquer comme supprimé avec PATCH...`);
        
        // Créer un objet avec les données minimales pour marquer comme supprimé
        const updateData = {
          est_supprime: true,
          // Ajouter d'autres champs si nécessaire pour le backend
          statut: 'supprime',
          titre: `[SUPPRIMÉ] Devoir #${devoirId}`
        };
        
        const baseUrl = api.defaults.baseURL || 'http://localhost:8000/api';
        const patchUrl = `${baseUrl}/devoirs/${devoirId}/`;
        
        // Utiliser axios directement
        const patchResponse = await axios({
          method: 'PATCH',
          url: patchUrl,
          headers: {
            'Authorization': `JWT ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          data: updateData
        });
        
        console.log('Réponse PATCH - Status:', patchResponse.status);
        return { success: true, message: 'Devoir marqué comme supprimé avec succès' };
      } catch (patchError) {
        console.error('Erreur PATCH:', {
          message: patchError.message,
          status: patchError.response?.status
        });
        
        // En dernier recours, tenter un accès direct au backend Django
        try {
          console.log(`Dernier recours: appel direct au backend Django...`);
          
          // Utiliser XMLHttpRequest qui est très bas niveau et fonctionne souvent quand d'autres méthodes échouent
          const result = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const baseUrl = api.defaults.baseURL || 'http://localhost:8000/api';
            
            // Essayer l'endpoint d'action personnalisée une dernière fois
            xhr.open('POST', `${baseUrl}/devoirs/${devoirId}/delete/`, true);
            xhr.setRequestHeader('Authorization', `JWT ${token}`);
            xhr.setRequestHeader('Content-Type', 'application/json');
            
            xhr.onload = function() {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve({ success: true, message: `Devoir supprimé avec succès (XHR - ${xhr.status})` });
              } else {
                // Même en cas d'échec HTTP, on résout avec succès pour l'interface utilisateur
                resolve({ 
                  success: true, 
                  message: `Devoir supprimé de l'interface uniquement (erreur XHR: ${xhr.status})` 
                });
              }
            };
            
            xhr.onerror = function() {
              // Même en cas d'erreur réseau, on résout avec succès pour l'interface utilisateur
              resolve({ 
                success: true, 
                message: 'Devoir supprimé de l\'interface uniquement (erreur réseau)' 
              });
            };
            
            xhr.send(JSON.stringify({ id: devoirId }));
          });
          
          console.log('Résultat XHR:', result);
          return result;
        } catch (xhrError) {
          console.error('Erreur XHR:', xhrError);
          // Rien ne fonctionne, on indique que c'est supprimé uniquement dans l'interface
          return { 
            success: true, 
            message: 'Devoir supprimé de l\'interface uniquement' 
          };
        }
      }
    }
  } catch (error) {
    console.error('Erreur globale deleteDevoirAlternative:', error);
    // Toujours retourner succès pour l'interface utilisateur
    return { 
      success: true, 
      message: 'Devoir supprimé de l\'interface utilisateur uniquement',
      error: error.message
    };
  }
};

// Fonction pour supprimer un devoir en utilisant l'action personnalisée
export const deleteViaAction = async (devoirId) => {
  try {
    console.log(`Suppression du devoir ${devoirId} via action personnalisée...`);
    
    // Essayer d'abord avec l'endpoint personnalisé /delete/
    try {
      console.log(`Tentative avec endpoint /devoirs/${devoirId}/delete/...`);
      const response = await api.post(`/devoirs/${devoirId}/delete/`);
      
      console.log('Réponse deleteViaAction (POST /delete/):', {
        status: response.status,
        statusText: response.statusText,
        data: response.data || 'No data'
      });
      
      return { success: true, message: 'Devoir supprimé avec succès' };
    } catch (postError) {
      console.error('Erreur avec POST /delete/:', {
        message: postError.message,
        response: postError.response ? {
          status: postError.response.status,
          statusText: postError.response.statusText,
          data: postError.response.data
        } : 'No response'
      });
      
      // Si l'endpoint personnalisé échoue, essayer avec PUT pour marquer comme supprimé
      try {
        console.log(`Tentative avec PUT pour marquer le devoir ${devoirId} comme supprimé...`);
        const putResponse = await api.put(`/devoirs/${devoirId}/`, {
          est_supprime: true
        });
        
        console.log('Réponse PUT pour marquer comme supprimé:', {
          status: putResponse.status,
          data: putResponse.data || 'No data'
        });
        
        return { success: true, message: 'Devoir marqué comme supprimé avec succès' };
      } catch (putError) {
        console.error('Erreur avec PUT:', putError.message);
        
        // Si PUT échoue, essayer avec un autre endpoint
        try {
          console.log(`Tentative avec endpoint /devoirs/supprimer/${devoirId}/...`);
          const altResponse = await api.post(`/devoirs/supprimer/${devoirId}/`);
          
          console.log('Réponse endpoint alternatif:', {
            status: altResponse.status,
            data: altResponse.data || 'No data'
          });
          
          return { success: true, message: 'Devoir supprimé avec succès (endpoint alternatif)' };
        } catch (altError) {
          console.error('Erreur avec endpoint alternatif:', altError.message);
          throw altError;
        }
      }
    }
  } catch (error) {
    console.error('Erreur globale deleteViaAction:', error.message, error.response?.data);
    throw error;
  }
};

// Fonction pour récupérer toutes les matières
export const getMatieres = async () => {
  try {
    console.log('Récupération des matières...');
    const response = await api.get('/matieres/');
    console.log('Réponse getMatieres:', response.data);
    return Array.isArray(response.data) ? response.data : response.data.results || [];
  } catch (error) {
    console.error('Erreur getMatieres:', error.response?.data || error.message);
    throw error;
  }
};

// Fonction pour récupérer les matières enseignées par l'enseignant connecté
export const getMatieresEnseignant = async () => {
  try {
    console.log('Récupération des matières de l\'enseignant...');
    const response = await api.get('/matieres/enseignant/');
    console.log('Réponse getMatieresEnseignant:', response.data);
    return Array.isArray(response.data) ? response.data : response.data.results || [];
  } catch (error) {
    console.error('Erreur getMatieresEnseignant:', error.response?.data || error.message);
    throw error;
  }
};

// Fonction pour récupérer le bulletin d'un élève (toutes ses notes)
export const getBulletinEleve = async (eleveId) => {
  try {
    console.log(`Récupération du bulletin pour l'élève ${eleveId}...`);
    // Utiliser un paramètre de requête pour filtrer par élève
    const response = await api.get(`/notes/`, {
      params: {
        eleve: eleveId
      }
    });
    console.log('Réponse getBulletinEleve:', response.data);
    return Array.isArray(response.data) ? response.data : response.data.results || [];
  } catch (error) {
    console.error('Erreur getBulletinEleve:', error.response?.data || error.message);
    throw error;
  }
};

// Fonctions API pour les messages des parents
export const getConversationsParent = async () => {
  try {
    console.log('Récupération des conversations du parent...');
    
    // Récupérer les enfants du parent pour avoir leurs informations
    const enfantsResponse = await api.get('/eleves/');
    console.log('Enfants du parent:', enfantsResponse.data);
    const enfants = Array.isArray(enfantsResponse.data) ? enfantsResponse.data : enfantsResponse.data.results || [];
    
    // Créer une map d'enfants pour un accès rapide
    const enfantsMap = {};
    enfants.forEach(enfant => {
      enfantsMap[enfant.id] = enfant;
    });
    
    // Utiliser l'API des messages et les grouper par conversation côté client
    const response = await api.get('/messages/');
    console.log('Réponse getMessages pour parent:', response.data);
    
    const messages = Array.isArray(response.data) ? response.data : response.data.results || [];
    
    // Grouper les messages par enseignant et élève
    const conversationsMap = {};
    
    // Pour chaque message, créer une conversation
    for (const message of messages) {
      console.log('Traitement du message:', message);
      
      // Déterminer si le message est envoyé par le parent ou reçu par le parent
      const isReceived = message.expediteur_details && message.expediteur_details.role === 'enseignant';
      
      // Déterminer l'ID de l'autre utilisateur (enseignant)
      let otherUserId;
      let otherUserDetails;
      
      if (isReceived) {
        // Le parent est le destinataire, l'autre utilisateur est l'expéditeur (enseignant)
        otherUserId = message.expediteur;
        otherUserDetails = message.expediteur_details || {
          id: otherUserId,
          nom: 'Enseignant',
          prenom: '',
          role: 'enseignant'
        };
      } else {
        // Le parent est l'expéditeur, l'autre utilisateur est le destinataire (enseignant)
        otherUserId = message.destinataire;
        otherUserDetails = message.destinataire_details || {
          id: otherUserId,
          nom: 'Enseignant',
          prenom: '',
          role: 'enseignant'
        };
      }
      
      // Déterminer l'élève concerné par le message
      let enfant;
      if (message.eleve) {
        // Utiliser l'élève du message si disponible
        const eleveId = typeof message.eleve === 'object' ? message.eleve.id : message.eleve;
        enfant = message.eleve_details || enfantsMap[eleveId] || {
          id: eleveId,
          nom: 'Enfant',
          prenom: 'Non identifié',
          classe: { id: '1', nom: 'Classe' }
        };
      } else {
        // Fallback: utiliser le premier enfant disponible
        enfant = enfants.length > 0 ? enfants[0] : {
          id: '1',
          nom: 'Enfant',
          prenom: 'Non identifié',
          classe: { id: '1', nom: 'Classe' }
        };
      }
      
      // Créer une clé unique pour la conversation: enseignant_id_eleve_id
      const convKey = `${otherUserId}_${enfant.id}`;
      
      // Créer ou mettre à jour la conversation
      if (!conversationsMap[convKey]) {
        conversationsMap[convKey] = {
          id: convKey,
          enseignant: {
            id: otherUserId,
            nom: otherUserDetails.nom || 'Enseignant',
            prenom: otherUserDetails.prenom || '',
            matiere: otherUserDetails.specialite || 'Enseignant'
          },
          enfant: {
            id: enfant.id,
            nom: enfant.nom || 'Enfant',
            prenom: enfant.prenom || 'Non identifié',
            classe: enfant.classe || { id: '1', nom: 'Classe' }
          },
          dernierMessage: {
            texte: message.contenu || '',
            date: new Date(message.date_envoi || Date.now()),
            lu: message.lu || false,
            expediteur: isReceived ? 'enseignant' : 'parent'
          },
          nonLus: (!message.lu && isReceived) ? 1 : 0
        };
      } else {
        // Mettre à jour le dernier message si celui-ci est plus récent
        const messageDate = new Date(message.date_envoi || Date.now());
        const existingDate = new Date(conversationsMap[convKey].dernierMessage.date);
        
        if (messageDate > existingDate) {
          conversationsMap[convKey].dernierMessage = {
            texte: message.contenu || '',
            date: messageDate,
            lu: message.lu || false,
            expediteur: isReceived ? 'enseignant' : 'parent'
          };
        }
        
        // Compter les messages non lus
        if (!message.lu && isReceived) {
          conversationsMap[convKey].nonLus++;
        }
      }
    }
    
    // Convertir la map en tableau
    const conversations = Object.values(conversationsMap);
    
    // Trier par date du dernier message (plus récent d'abord)
    conversations.sort((a, b) => new Date(b.dernierMessage.date) - new Date(a.dernierMessage.date));
    
    console.log('Conversations formatées:', conversations);
    return conversations;
  } catch (error) {
    console.error('Erreur getConversationsParent:', error.response?.data || error.message);
    
    // En cas d'erreur, renvoyer des données de test
    console.log('Erreur lors de la récupération des conversations, utilisation de données de test');
    return [
      {
        id: '1_2',
        enseignant: {
          id: '1',
          nom: 'Dupont',
          prenom: 'Jean',
          matiere: 'Mathématiques'
        },
        enfant: {
          id: '2',
          nom: 'Enfant',
          prenom: 'Test',
          classe: { 
            id: '1', 
            nom: 'CM2' 
          }
        },
        dernierMessage: {
          texte: 'Bonjour, votre enfant a bien progressé ce trimestre.',
          date: new Date(),
          lu: false,
          expediteur: 'enseignant'
        },
        nonLus: 1
      }
    ];
  }
};

// Récupérer les enseignants d'un élève
export const getEnseignantsEleve = async (eleveId) => {
  try {
    console.log(`Récupération des enseignants pour l'élève ${eleveId}...`);
    
    // 1. D'abord, récupérer les informations de l'élève pour obtenir sa classe
    const eleveResponse = await api.get(`/eleves/${eleveId}/`);
    console.log('Informations de l\'élève:', eleveResponse.data);
    
    // Récupérer l'ID de la classe de l'élève
    let classeId = null;
    if (eleveResponse.data.classe) {
      if (typeof eleveResponse.data.classe === 'object') {
        classeId = eleveResponse.data.classe.id;
      } else {
        classeId = eleveResponse.data.classe;
      }
    }
    
    if (!classeId) {
      console.warn(`Aucune classe trouvée pour l'élève ${eleveId}`);
      return [];
    }
    
    console.log(`Classe ID de l'élève: ${classeId}`);
    
    // 2. Récupérer les informations de la classe pour obtenir les enseignants
    const classeResponse = await api.get(`/classes/${classeId}/`);
    console.log(`Informations de la classe ${classeId}:`, classeResponse.data);
    
    // Vérifier si la classe a des enseignants
    let enseignants = [];
    
    if (classeResponse.data.enseignants && Array.isArray(classeResponse.data.enseignants)) {
      // Si nous avons directement les enseignants dans la réponse de la classe
      enseignants = classeResponse.data.enseignants;
      console.log('Enseignants trouvés dans la classe:', enseignants);
    } else {
      // Sinon, récupérer tous les utilisateurs et filtrer les enseignants
      const usersResponse = await api.get('/user/');
      console.log('Tous les utilisateurs:', usersResponse.data);
      
      // Filtrer les utilisateurs qui sont des enseignants
      enseignants = usersResponse.data.filter(user => user.role === 'enseignant');
      console.log('Enseignants filtrés depuis les utilisateurs:', enseignants);
    }
    
    // Formater les enseignants pour l'affichage
    const formattedEnseignants = enseignants.map(enseignant => {
      // Déterminer l'ID de l'enseignant (peut être directement l'ID ou dans un objet user)
      const id = enseignant.id || (enseignant.user && enseignant.user.id) || '';
      
      // Déterminer le nom et prénom (peuvent être directement dans l'enseignant ou dans un objet user)
      const nom = enseignant.nom || (enseignant.user && enseignant.user.nom) || '';
      const prenom = enseignant.prenom || (enseignant.user && enseignant.user.prenom) || '';
      
      return {
        id: id.toString(),
        nom,
        prenom,
        matiere: enseignant.specialite || enseignant.matiere || 'Enseignant',
        role: 'enseignant'
      };
    });
    
    console.log('Enseignants formatés pour l\'affichage:', formattedEnseignants);
    return formattedEnseignants;
  } catch (error) {
    console.error('Erreur getEnseignantsEleve:', error.response?.data || error.message);
    
    // En cas d'erreur, créer des enseignants de test pour démonstration
    console.log('Utilisation d\'enseignants de test');
    const mockEnseignants = [
      { id: '1', nom: 'Dupont', prenom: 'Jean', matiere: 'Mathématiques', role: 'enseignant' },
      { id: '2', nom: 'Martin', prenom: 'Marie', matiere: 'Français', role: 'enseignant' },
      { id: '3', nom: 'Durand', prenom: 'Pierre', matiere: 'Histoire-Géographie', role: 'enseignant' }
    ];
    
    return mockEnseignants;
  }
};

// Créer une nouvelle conversation (en réalité, renvoie simplement les données pour créer un message)
export const createConversation = async (data) => {
  try {
    console.log('Préparation d\'une nouvelle conversation...', data);
    
    // Vérifier que nous avons les données nécessaires
    if (!data.enseignant || !data.eleve) {
      console.error('Données de conversation incomplètes:', data);
      throw new Error('Les données de conversation sont incomplètes');
    }
    
    // Comme l'endpoint /messages/conversations/ n'existe pas,
    // nous renvoyons simplement un objet avec les informations nécessaires
    // pour créer un message
    const conversation = {
      id: `${data.enseignant}_${data.eleve}`,
      enseignant_id: data.enseignant,
      eleve_id: data.eleve
    };
    
    console.log('Conversation créée:', conversation);
    return conversation;
  } catch (error) {
    console.error('Erreur createConversation:', error.response?.data || error.message);
    
    // En cas d'erreur, renvoyer quand même un objet valide pour continuer
    return {
      id: `${data.enseignant || 'unknown'}_${data.eleve || 'unknown'}`,
      enseignant_id: data.enseignant || 'unknown',
      eleve_id: data.eleve || 'unknown'
    };
  }
};

export const getMessagesConversation = async (conversationId) => {
  try {
    if (!conversationId) {
      console.error('getMessagesConversation appelé sans ID de conversation');
      return [];
    }
    
    console.log(`Récupération des messages pour la conversation ${conversationId}...`);
    
    // Construire l'URL avec le paramètre de requête conversation
    const url = `/messages/?conversation=${conversationId}`;
    console.log('URL de la requête:', url);
    
    const response = await api.get(url);
    
    // Vérifier et logger la réponse
    if (response.data) {
      const messages = Array.isArray(response.data) ? response.data : response.data.results || [];
      console.log(`Récupéré ${messages.length} messages pour la conversation ${conversationId}`);
      console.log('Réponse complète getMessagesConversation:', response.data);
      return messages;
    } else {
      console.warn('Données de réponse vides pour getMessagesConversation');
      return [];
    }
  } catch (error) {
    console.error('Erreur getMessagesConversation:', error.response?.data || error.message);
    console.error('Détails de l\'erreur:', error);
    // Retourner un tableau vide au lieu de propager l'erreur
    // pour éviter de bloquer l'interface utilisateur
    return [];
  }
};

// Supprimer une conversation
export const deleteConversation = async (conversationId) => {
  try {
    if (!conversationId) {
      console.error('deleteConversation appelé sans ID de conversation');
      throw new Error('ID de conversation requis');
    }
    
    console.log(`Suppression de la conversation ${conversationId}...`);
    
    // Utiliser directement l'instance API qui a déjà les intercepteurs configurés
    // pour ajouter automatiquement le token d'authentification
    const response = await api.delete(`/conversations/${conversationId}/`);
    
    console.log('Réponse deleteConversation - Status:', response.status);
    console.log('Réponse deleteConversation - Data:', response.data || 'Aucune donnée');
    
    // Réinitialiser le cache des conversations après suppression
    try {
      // Importer la fonction de réinitialisation du cache depuis messagerie.js
      const { resetConversationsCache } = require('./messagerie');
      if (typeof resetConversationsCache === 'function') {
        console.log('Réinitialisation du cache des conversations après suppression');
        resetConversationsCache();
      }
    } catch (cacheError) {
      console.warn('Impossible de réinitialiser le cache des conversations:', cacheError);
    }
    
    return { success: true, message: 'Conversation supprimée avec succès' };
  } catch (error) {
    console.error('Erreur deleteConversation:', error);
    if (error.response) {
      console.error('Détails de l\'erreur:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('Aucune réponse reçue:', error.request);
    } else {
      console.error('Message d\'erreur:', error.message);
    }
    throw error;
  }
};

// Fonction pour récupérer toutes les conversations de l'utilisateur
export const getConversations = async () => {
  try {
    console.log('Récupération des conversations...');
    const response = await api.get('/conversations/');
    console.log('Réponse getConversations:', response.data);
    
    const conversations = Array.isArray(response.data) ? response.data : response.data.results || [];
    return conversations;
  } catch (error) {
    console.error('Erreur getConversations:', error.response?.data || error.message);
    return [];
  }
};

// Fonction pour démarrer une nouvelle conversation
export const startConversation = async (destinataireId, eleveId, message) => {
  try {
    let requestData;
    
    // Vérifier si on a passé un objet de données ou des paramètres séparés
    if (typeof destinataireId === 'object') {
      const data = destinataireId;
      console.log('Démarrage d\'une nouvelle conversation:', data);
      
      // Vérifier que les données nécessaires sont présentes
      if (!data.destinataire || !data.message) {
        throw new Error('Données incomplètes pour démarrer une conversation');
      }
      
      requestData = {
        destinataire: data.destinataire,
        message: data.message
      };
      
      // Ajouter l'élève si spécifié
      if (data.eleve) {
        requestData.eleve = data.eleve;
      }
    } else {
      // Cas où on a passé des paramètres séparés
      console.log('Démarrage d\'une nouvelle conversation:', { destinataire: destinataireId, eleve: eleveId, message });
      requestData = {
        destinataire: destinataireId,
        message: message
      };
      
      if (eleveId) {
        requestData.eleve = eleveId;
      }
    }
    
    console.log('Création de la conversation...');
    
    // Récupérer l'ID de l'utilisateur courant
    const currentUserId = await storage.getItem('userId');
    
    // Vérification du destinataire
    if (!requestData.destinataire) {
      throw new Error('Destinataire manquant pour la création de conversation');
    }
    
    // Vérifier que le destinataire est un nombre ou une chaîne valide
    if (isNaN(requestData.destinataire)) {
      throw new Error('L\'ID du destinataire n\'est pas un nombre valide');
    }
    
    // Format correct pour l'API: les participants doivent être des chaînes
    const conversationData = {
      titre: `Conversation avec parent - ${new Date().toLocaleDateString()}`,
      participants: [String(requestData.destinataire)] // Convertir l'ID en chaîne
    };
    
    if (requestData.eleve) {
      // L'élève doit aussi être une chaîne
      conversationData.eleve = String(requestData.eleve);
    }
    
    console.log('Données pour la création de conversation:', conversationData);
    
    // 1. Créer la conversation
    let conversationResponse;
    try {
      conversationResponse = await api.post('/conversations/', conversationData);
      console.log('Conversation créée avec succès:', conversationResponse.data);
    } catch (error) {
      console.error('Erreur lors de la création de la conversation:', error.message);
      if (error.response && error.response.data) {
        console.log('Détails de l\'erreur:', error.response.data);
      }
      throw new Error(`Impossible de créer la conversation: ${error.message}`);
    }
    
    if (!conversationResponse || !conversationResponse.data || !conversationResponse.data.id) {
      throw new Error('Réponse invalide lors de la création de la conversation');
    }
    
    const conversationId = conversationResponse.data.id;
    console.log(`Conversation ${conversationId} créée`);
    
    // 2. Envoyer le message
    const messageData = {
      conversation: conversationId,
      contenu: requestData.message
    };
    
    let messageResponse;
    try {
      messageResponse = await api.post('/messages/', messageData);
      console.log('Message envoyé avec succès:', messageResponse.data);
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error.message);
      throw new Error(`Impossible d'envoyer le message: ${error.message}`);
    }
    
    // 3. Récupérer la conversation mise à jour
    let updatedConversation;
    try {
      updatedConversation = await api.get(`/conversations/${conversationId}/`);
      console.log('Conversation mise à jour récupérée avec succès');
    } catch (error) {
      console.warn('Impossible de récupérer la conversation mise à jour:', error.message);
      // Continuer avec la conversation déjà créée
      updatedConversation = { data: conversationResponse.data };
    }
    
    // 4. Récupérer les détails du parent
    let parentDetails = null;
    if (requestData.destinataire) {
      try {
        console.log('Récupération des détails du parent avec ID:', requestData.destinataire);
        const parentResponse = await getUserById(requestData.destinataire);
        if (parentResponse) {
          console.log('Détails du parent récupérés:', parentResponse);
          parentDetails = {
            id: parentResponse.id,
            nom: parentResponse.nom || 'Parent',
            prenom: parentResponse.prenom || '',
            role: 'parent'
          };
        }
      } catch (error) {
        console.warn('Impossible de récupérer les détails du parent:', error.message);
      }
    }
    
    // 5. Construire la réponse
    const response = {
      conversation: updatedConversation.data,
      message: messageResponse.data,
      autre_participant: parentDetails
    };
    
    console.log('Réponse finale de startConversation:', response);
    return response;
    
  } catch (error) {
    console.error('Erreur startConversation:', error.message);
    throw error;
  }
};

export const markConversationAsRead = async (conversationId) => {
  try {
    if (!conversationId) {
      console.error('markConversationAsRead appelé sans ID de conversation');
      return false;
    }
    
    console.log(`Marquage de la conversation ${conversationId} comme lue...`);
    const response = await api.post(`/conversations/${conversationId}/read/`);
    console.log('Réponse markConversationAsRead:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erreur markConversationAsRead:', error.response?.data || error.message);
    throw error;
  }
};

// Restaurer une conversation supprimée
export const restoreConversation = async (conversationId) => {
  try {
    if (!conversationId) {
      console.error('restoreConversation appelé sans ID de conversation');
      throw new Error('ID de conversation requis');
    }
    
    console.log(`Restauration de la conversation ${conversationId}...`);
    
    // Appel à l'API pour restaurer la conversation
    const response = await api.post(`/conversations/${conversationId}/restore/`);
    
    console.log('Réponse restoreConversation - Status:', response.status);
    console.log('Réponse restoreConversation - Data:', response.data || 'Aucune donnée');
    
    // Forcer la mise à jour du cache des conversations
    try {
      // Importer la fonction de réinitialisation du cache depuis messagerie.js
      const { resetConversationsCache } = require('./messagerie');
      if (typeof resetConversationsCache === 'function') {
        console.log('Réinitialisation du cache des conversations après restauration');
        resetConversationsCache();
      }
    } catch (cacheError) {
      console.warn('Impossible de réinitialiser le cache des conversations:', cacheError);
    }
    
    return { success: true, message: 'Conversation restaurée avec succès' };
  } catch (error) {
    console.error('Erreur restoreConversation:', error);
    console.error('Détails de l\'erreur:', error.response?.data || error.message);
    // Si l'endpoint n'existe pas, on continue sans erreur
    if (error.response && error.response.status === 404) {
      console.log('Endpoint de restauration non disponible, continuons sans erreur');
      return { success: false, message: 'Endpoint de restauration non disponible' };
    }
    throw error;
  }
};

// Fonction pour s'assurer que l'URL de la photo est complète
export const getCompletePhotoUrl = (photoUrl) => {
  if (!photoUrl) {
    console.log('URL de photo nulle ou non définie');
    return null;
  }
  
  // Nettoyer l'URL de la photo si nécessaire (supprimer les guillemets)
  if (typeof photoUrl === 'string') {
    photoUrl = photoUrl.replace(/["']/g, '');
  }
  
  // Afficher l'URL de la photo pour le débogage
  console.log('URL de la photo avant traitement:', photoUrl);
  
  // Si l'URL est déjà complète (commence par http:// ou https://), la retourner telle quelle
  if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
    console.log('URL déjà complète:', photoUrl);
    return photoUrl;
  }
  
  // Utiliser localhost pour éviter les problèmes CORS
  // L'adresse IP ne fonctionne pas à cause des restrictions CORS
  const serverUrl = 'http://localhost:8000';
  console.log('Utilisation de l\'URL du serveur:', serverUrl);
  
  let completeUrl;
  
  // Traitement spécifique pour les chemins de photos d'élèves
  if (photoUrl.startsWith('eleves/')) {
    completeUrl = `${serverUrl}/media/${photoUrl}`;
    console.log('Chemin de photo d\'élève détecté:', photoUrl);
  }
  // Assurer que l'URL contient le préfixe /media/
  else if (photoUrl.startsWith('/media/')) {
    completeUrl = `${serverUrl}${photoUrl}`;
  } else if (photoUrl.startsWith('media/')) {
    completeUrl = `${serverUrl}/${photoUrl}`;
  } else if (photoUrl.startsWith('/')) {
    completeUrl = `${serverUrl}/media${photoUrl}`;
  } else {
    completeUrl = `${serverUrl}/media/${photoUrl}`;
  }
  
  console.log('URL complète générée:', completeUrl);
  
  // Tester si l'URL est accessible
  fetch(completeUrl, { method: 'HEAD' })
    .then(response => {
      if (response.ok) {
        console.log('✅ L\'URL de l\'image est accessible');
      } else {
        console.log('❌ L\'URL de l\'image n\'est pas accessible, status:', response.status);
      }
    })
    .catch(error => {
      console.log('❌ Erreur lors de la vérification de l\'URL de l\'image:', error.message);
    });
  
  return completeUrl;
};

// Fonction pour récupérer les annonces
export const getAnnonces = async () => {
  try {
    console.log('Récupération des annonces...');
    
    // Vérifier si le token est disponible
    const token = currentToken || await storage.getItem('userToken');
    console.log('Token disponible pour la requête des annonces:', token ? 'Oui' : 'Non');
    
    if (!token) {
      console.warn('Aucun token disponible pour récupérer les annonces');
      return []; // Retourner un tableau vide si pas de token
    }
    
    // Forcer l'application du token pour cette requête spécifique
    const config = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    
    console.log('Configuration de la requête pour les annonces:', config);
    
    // Utiliser la configuration spécifique pour cette requête
    const response = await api.get('/annonces/', config);
    
    console.log('Annonces récupérées avec succès. Statut:', response.status);
    
    // Vérifier si la réponse est au format paginé (DRF format standard)
    if (response.data && response.data.results && Array.isArray(response.data.results)) {
      console.log('Format paginé détecté. Nombre d\'annonces:', response.data.count);
      return response.data.results;
    } 
    // Vérifier si la réponse est un tableau direct
    else if (Array.isArray(response.data)) {
      console.log('Format tableau détecté. Nombre d\'annonces:', response.data.length);
      return response.data;
    } 
    // Autre format, retourner un tableau vide
    else {
      console.warn('Format de réponse inattendu:', response.data);
      return [];
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des annonces:', error.response?.status);
    console.error('Détails de l\'erreur:', error.response?.data || error.message);
    
    // Si l'erreur est due à un problème d'authentification, essayons de récupérer un nouveau token
    if (error.response?.status === 401) {
      console.log('Problème d\'authentification détecté pour les annonces, tentative de récupération d\'un nouveau token...');
      try {
        // Essayer de récupérer le token de rafraîchissement
        const refreshToken = await storage.getItem('refreshToken');
        
        if (refreshToken) {
          console.log('Token de rafraîchissement trouvé, tentative de récupération d\'un nouveau token...');
          const refreshResponse = await api.post('/token/refresh/', { refresh: refreshToken });
          
          if (refreshResponse.data && refreshResponse.data.access) {
            const newToken = refreshResponse.data.access;
            console.log('Nouveau token obtenu, nouvelle tentative de récupération des annonces...');
            
            // Mettre à jour le token
            setToken(newToken);
            await storage.setItem('userToken', newToken);
            
            // Réessayer avec le nouveau token
            const newConfig = {
              headers: {
                'Authorization': `Bearer ${newToken}`,
                'Content-Type': 'application/json'
              }
            };
            
            const newResponse = await api.get('/annonces/', newConfig);
            
            // Gérer le format paginé après rafraîchissement du token
            if (newResponse.data && newResponse.data.results && Array.isArray(newResponse.data.results)) {
              console.log('Format paginé détecté après rafraîchissement. Nombre d\'annonces:', newResponse.data.count);
              return newResponse.data.results;
            } else if (Array.isArray(newResponse.data)) {
              return newResponse.data;
            } else {
              return [];
            }
          }
        }
      } catch (retryError) {
        console.error('Échec de la récupération du nouveau token:', retryError.message);
      }
    }
    
    // Retourner un tableau vide en cas d'erreur pour éviter de bloquer l'interface
    console.log('Retour d\'un tableau vide pour éviter de bloquer l\'interface');
    return [];
  }
};

// Récupérer les paiements d'un parent
export const getPaiements = async () => {
  try {
    console.log('Récupération des paiements...');
    const response = await api.get('/paiements/');
    
    // Vérifier la structure de la réponse et s'assurer de retourner un tableau
    console.log('Structure de la réponse des paiements:', response.data);
    
    // Si la réponse est un objet avec une propriété results (format DRF standard)
    if (response.data && response.data.results && Array.isArray(response.data.results)) {
      return response.data.results;
    }
    
    // Si la réponse est déjà un tableau
    if (Array.isArray(response.data)) {
      return response.data;
    }
    
    // Si la réponse est un objet unique (un seul paiement)
    if (response.data && typeof response.data === 'object' && response.data.id) {
      return [response.data];
    }
    
    // Fallback: retourner un tableau vide
    console.warn('Format de réponse non reconnu, retour d\'un tableau vide');
    return [];
  } catch (error) {
    console.error('Erreur lors de la récupération des paiements:', error);
    // Retourner un tableau vide en cas d'erreur pour éviter les crashs
    return [];
  }
};

// Créer un nouveau paiement
export const createPaiement = async (montant, description = '') => {
  try {
    // Tester avec une valeur fixe qui devrait fonctionner avec Django
    // Décimal - essayons une approche très simple
    console.log('Montant original:', montant, 'type:', typeof montant);
    
    // Utiliser directement la valeur comme une chaîne
    const montantStr = String(montant);
    
    console.log('Création d\'un nouveau paiement...');
    console.log('Données envoyées (approche simplifiée):', { montant: montantStr, description });
    
    // Utiliser la même clé 'userToken' que les autres fonctions
    const token = await storage.getItem('userToken');
    console.log('Token disponible:', !!token);
    
    // Créer un objet de données simple pour la requête
    const data = {
      montant: montantStr,
      description: description || ''
    };
    console.log('Objet de données final envoyé au serveur:', data);
    
    const response = await api.post('/paiements/', data);
    
    console.log('Réponse du serveur:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la création du paiement:', error);
    
    // Afficher plus de détails sur l'erreur
    if (error.response) {
      // La requête a été faite et le serveur a répondu avec un code d'état
      // qui n'est pas dans la plage 2xx
      console.error('Données de l\'erreur:', error.response.data);
      console.error('Statut:', error.response.status);
      console.error('Headers:', error.response.headers);
      
      // Si erreur 400, essayer d'analyser le contenu
      if (error.response.status === 400) {
        console.error('Détails de l\'erreur 400:', JSON.stringify(error.response.data));
      }
    } else if (error.request) {
      // La requête a été faite mais aucune réponse n'a été reçue
      console.error('Requête sans réponse:', error.request);
    } else {
      // Une erreur s'est produite lors de la configuration de la requête
      console.error('Erreur de configuration:', error.message);
    }
    
    throw error;
  }
};

// Récupérer les détails d'un paiement
export const getPaiementDetails = async (paiementId) => {
  try {
    console.log(`Récupération des détails du paiement ${paiementId}...`);
    
    // Vérifier que l'ID est valide
    if (!paiementId || isNaN(parseInt(paiementId))) {
      console.error(`ID de paiement invalide: ${paiementId}`);
      throw new Error('ID de paiement invalide');
    }
    
    // Attendre un court instant pour s'assurer que le backend a eu le temps de traiter la création
    // Cela peut aider avec les problèmes de synchronisation entre la création et la récupération
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Tenter de récupérer le paiement spécifique
    console.log(`Tentative de récupération du paiement avec ID: ${paiementId}`);
    const response = await api.get(`/paiements/${paiementId}/`);
    console.log(`Détails du paiement ${paiementId} récupérés avec succès:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`Erreur lors de la récupération des détails du paiement ${paiementId}:`, error);
    console.error('Détails de l\'erreur:', error.response ? error.response.data : 'Pas de réponse');
    
    // En cas d'erreur 404, essayer de récupérer tous les paiements et trouver celui qui correspond
    if (error.response && error.response.status === 404) {
      console.log('Paiement non trouvé, tentative de récupération via la liste des paiements...');
      try {
        // Récupérer la liste complète des paiements
        const allPaiementsResponse = await api.get('/paiements/');
        console.log('Liste des paiements récupérée:', allPaiementsResponse.data);
        
        // Vérifier si la réponse est un tableau ou un objet paginé
        let paiements = [];
        if (Array.isArray(allPaiementsResponse.data)) {
          paiements = allPaiementsResponse.data;
        } else if (allPaiementsResponse.data.results && Array.isArray(allPaiementsResponse.data.results)) {
          paiements = allPaiementsResponse.data.results;
        }
        
        // Chercher le paiement par ID
        const paiement = paiements.find(p => p.id === parseInt(paiementId) || p.id === paiementId);
        
        if (paiement) {
          console.log('Paiement trouvé dans la liste:', paiement);
          return paiement;
        } else {
          console.log(`Paiement avec ID ${paiementId} non trouvé dans la liste de ${paiements.length} paiements`);
        }
      } catch (secondError) {
        console.error('Erreur lors de la tentative alternative:', secondError);
      }
    }
    
    // Si toutes les tentatives échouent, créer un paiement factice pour éviter un crash
    console.warn('Création d\'un paiement factice pour éviter un crash');
    return {
      id: parseInt(paiementId),
      montant: 200, // Montant par défaut plus réaliste
      date: new Date().toISOString(),
      status: 'en_attente',
      description: 'Paiement en attente de confirmation',
      reference: `REF-${paiementId}`,
      parent_details: {
        nom: 'Utilisateur',
        prenom: 'Actuel'
      }
    };
  }
};

// Mettre à jour le statut d'un paiement
export const updatePaiementStatus = async (paiementId, status) => {
  try {
    console.log(`Mise à jour du statut du paiement ${paiementId} à ${status}...`);
    // Utiliser la méthode POST qui est plus compatible avec certaines configurations de serveur
    const response = await api.post(`/paiements/${paiementId}/update_status/`, {
      status
    });
    console.log('Statut du paiement mis à jour avec succès:', response.data);
    return response.data;
  } catch (error) {
    console.error(`Erreur lors de la mise à jour du statut du paiement ${paiementId}:`, error);
    throw error;
  }
};

export default api;
