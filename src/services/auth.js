import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { setToken } from './api';

// Clés pour stocker les informations d'authentification
const AUTH_TOKEN_KEY = 'userToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_ROLE_KEY = 'userRole';
const USER_ID_KEY = 'userId';
const TOKEN_EXPIRY_KEY = 'tokenExpiry';

// Récupérer le token d'authentification
export const getAuthToken = async () => {
  try {
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    
    // Vérifier si le token existe
    if (!token) {
      console.warn('Aucun token d\'authentification trouvé');
      return null;
    }
    
    // Vérifier si le token est expiré
    const expiryTime = await AsyncStorage.getItem(TOKEN_EXPIRY_KEY);
    if (expiryTime) {
      const expiryDate = new Date(parseInt(expiryTime));
      const now = new Date();
      
      // Si le token est expiré, essayer de le rafraîchir
      if (now > expiryDate) {
        console.log('Token expiré, tentative de rafraîchissement...');
        const refreshed = await refreshToken();
        if (refreshed) {
          return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        } else {
          console.warn('Impossible de rafraîchir le token expiré');
          return null;
        }
      }
    }
    
    return token;
  } catch (error) {
    console.error('Erreur lors de la récupération du token:', error);
    return null;
  }
};

// Enregistrer le token d'authentification
export const setAuthToken = async (token, refreshToken = null, role = null, userId = null, expiresIn = 3600) => {
  try {
    // Enregistrer le token principal
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
    
    // Configurer le token dans l'API
    setToken(token);
    
    // Enregistrer la date d'expiration (par défaut 1 heure)
    const expiryTime = new Date().getTime() + (expiresIn * 1000);
    await AsyncStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
    
    // Enregistrer le token de rafraîchissement s'il est fourni
    if (refreshToken) {
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
    
    // Enregistrer le rôle de l'utilisateur s'il est fourni
    if (role) {
      await AsyncStorage.setItem(USER_ROLE_KEY, role);
    }
    
    // Enregistrer l'ID de l'utilisateur s'il est fourni
    if (userId) {
      await AsyncStorage.setItem(USER_ID_KEY, userId.toString());
      console.log(`ID utilisateur ${userId} enregistré dans le stockage`);
    }
    
    console.log('Token d\'authentification enregistré avec succès');
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement du token:', error);
    return false;
  }
};

// Supprimer le token d'authentification (déconnexion)
export const removeAuthToken = async () => {
  try {
    // Supprimer toutes les informations d'authentification
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
    await AsyncStorage.removeItem(USER_ROLE_KEY);
    await AsyncStorage.removeItem(USER_ID_KEY);
    await AsyncStorage.removeItem(TOKEN_EXPIRY_KEY);
    
    // Supprimer le token de l'API
    setToken(null);
    
    console.log('Informations d\'authentification supprimées avec succès');
    return true;
  } catch (error) {
    console.error('Erreur lors de la suppression des informations d\'authentification:', error);
    return false;
  }
};

// Vérifier si l'utilisateur est connecté
export const isAuthenticated = async () => {
  const token = await getAuthToken();
  return !!token;
};

// Rafraîchir le token d'authentification
export const refreshToken = async () => {
  try {
    const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    
    if (!refreshToken) {
      console.warn('Aucun token de rafraîchissement disponible');
      return false;
    }
    
    console.log('Tentative de rafraîchissement du token...');
    
    // Appeler l'API pour obtenir un nouveau token
    const response = await api.post('/token/refresh/', { refresh: refreshToken });
    
    if (response.data && response.data.access) {
      console.log('Token rafraîchi avec succès');
      
      // Enregistrer le nouveau token
      await setAuthToken(
        response.data.access, 
        response.data.refresh || refreshToken,
        await AsyncStorage.getItem(USER_ROLE_KEY)
      );
      
      return true;
    } else {
      console.error('Aucun token dans la réponse de rafraîchissement');
      return false;
    }
  } catch (error) {
    console.error('Erreur lors du rafraîchissement du token:', error);
    
    // Si le rafraîchissement échoue, supprimer les tokens
    if (error.response && error.response.status === 401) {
      console.warn('Token de rafraîchissement expiré, déconnexion nécessaire');
      await removeAuthToken();
    }
    
    return false;
  }
};

// Gérer les erreurs d'authentification (401)
export const handleAuthError = async (error, navigation) => {
  if (error.response && error.response.status === 401) {
    console.log('Erreur 401 détectée, tentative de rafraîchissement du token...');
    
    // Essayer de rafraîchir le token
    const refreshed = await refreshToken();
    
    if (!refreshed) {
      console.warn('Impossible de rafraîchir le token, redirection vers la page de connexion');
      
      // Supprimer les tokens
      await removeAuthToken();
      
      // Rediriger vers la page de connexion si navigation est fournie
      if (navigation) {
        navigation.navigate('Auth', { screen: 'Login' });
      }
      
      return false;
    }
    
    return true;
  }
  
  return false;
};
