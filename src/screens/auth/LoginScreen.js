import React, { useState, useContext } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import storage from '../../services/storage';
import AuthContext from '../../contexts/AuthContext';
import { login, getUserInfo } from '../../services/api';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useContext(AuthContext);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      Alert.alert('Erreur', 'Veuillez entrer un email valide');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Tentative de connexion...');
      const { access } = await login(email, password);
      console.log('Token reçu:', access);
      
      // Le token est déjà configuré dans le service API
      const userInfo = await getUserInfo();
      console.log('Infos utilisateur reçues:', userInfo);
      
      if (!userInfo || !userInfo.role) {
        throw new Error('Les informations utilisateur sont invalides');
      }
      
      // Stocker les informations de l'utilisateur dans AsyncStorage
      if (userInfo.id) {
        await storage.setItem('userId', userInfo.id.toString());
        console.log('ID utilisateur enregistré dans le stockage:', userInfo.id);
      }
      
      // Stocker le rôle de l'utilisateur
      if (userInfo.role) {
        await storage.setItem('userRole', userInfo.role);
        console.log('Rôle de l\'utilisateur enregistré dans le stockage:', userInfo.role);
      }
      
      // Stocker le nom et le prénom de l'utilisateur
      if (userInfo.nom) {
        await storage.setItem('userNom', userInfo.nom);
        console.log('Nom de l\'utilisateur enregistré dans le stockage:', userInfo.nom);
      }
      
      if (userInfo.prenom) {
        await storage.setItem('userPrenom', userInfo.prenom);
        console.log('Prénom de l\'utilisateur enregistré dans le stockage:', userInfo.prenom);
      }
      
      await signIn(access, userInfo.role, userInfo.id);
      console.log('SignIn effectué avec le rôle:', userInfo.role, 'et ID:', userInfo.id);
    } catch (error) {
      console.error('Erreur de connexion:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      Alert.alert(
        'Erreur de connexion',
        error.response?.data?.detail || 'Une erreur est survenue'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ExpoImage
        source={require('../../assets/logo-zanakaconnect.png')}
        style={styles.logo}
        contentFit="contain"
      />
      <Text style={styles.title}>ZanakaConnect</Text>
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
        />
        <TextInput
          style={styles.input}
          placeholder="Mot de passe"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TouchableOpacity
          style={styles.button}
          onPress={handleLogin}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Connexion...' : 'Se connecter'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  logo: {
    width: 150,
    height: 150,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 40,
    color: '#2196F3',
  },
  form: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
