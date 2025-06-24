import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Fallback pour le web
const createWebStorage = () => {
  return {
    getItem: async (key) => {
      try {
        return Promise.resolve(localStorage.getItem(key));
      } catch (e) {
        return Promise.reject(e);
      }
    },
    setItem: async (key, value) => {
      try {
        localStorage.setItem(key, value);
        return Promise.resolve();
      } catch (e) {
        return Promise.reject(e);
      }
    },
    removeItem: async (key) => {
      try {
        localStorage.removeItem(key);
        return Promise.resolve();
      } catch (e) {
        return Promise.reject(e);
      }
    },
  };
};

// Utiliser AsyncStorage pour mobile ou localStorage pour web
const storage = Platform.OS === 'web' ? createWebStorage() : AsyncStorage;

export default storage;
