import AsyncStorage from '@react-native-async-storage/async-storage';

// Fallback pour le web si AsyncStorage n'est pas disponible
const createWebStorage = () => {
  return {
    getItem: async (key) => {
      return localStorage.getItem(key);
    },
    setItem: async (key, value) => {
      return localStorage.setItem(key, value);
    },
    removeItem: async (key) => {
      return localStorage.removeItem(key);
    },
  };
};

// Utiliser AsyncStorage pour mobile ou localStorage pour web
const storage = typeof window !== 'undefined' ? createWebStorage() : AsyncStorage;

export default storage;
