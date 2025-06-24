import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthContext from '../../contexts/AuthContext';
import { getUserInfo } from '../../services/api';
import ClassesScreen from './ClassesScreen';

const Stack = createNativeStackNavigator();

function HomeScreen({ navigation }) {
  const { signOut, token, role } = useContext(AuthContext);
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const data = await getUserInfo();
        setUserInfo(data);
      } catch (error) {
        console.error('Erreur lors du chargement des infos utilisateur:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserInfo();
  }, []);

  const menuItems = [
    {
      title: 'Classes',
      icon: '👨‍🏫',
      screen: 'Classes',
      description: 'Voire les classes',
    },
    {
      title: 'Notes',
      icon: '🌟',
      screen: 'Notes',
      description: 'Gérer les notes et évaluations',
    },
    {
      title: 'Absences',
      icon: '📅',
      screen: 'Absences',
      description: 'Gérer les absences et retards',
    },
    {
      title: 'Devoirs',
      icon: '📚',
      screen: 'Devoirs',
      description: 'Ajouter et suivre les devoirs',
    },
    {
      title: 'Messages',
      icon: '✉️',
      screen: 'Messages',
      description: 'Communiquer avec les parents',
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ZanakaConnect</Text>
        <TouchableOpacity 
          onPress={() => navigation.navigate('Profile')} 
          style={styles.profileButton}
        >
          <View style={styles.avatarSmall}>
            <Text style={styles.avatarText}>
              {userInfo?.prenom?.[0] || '?'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      ) : (
        <ScrollView style={styles.content}>
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeText}>
              Bonjour, {userInfo?.prenom || 'Enseignant'} !
            </Text>
            <Text style={styles.dateText}>
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </Text>
          </View>

          <View style={styles.grid}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.card}
                onPress={() => navigation.navigate(item.screen)}
              >
                <Text style={styles.cardIcon}>{item.icon}</Text>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDescription}>{item.description}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('Profile')}
            >
              <Text style={styles.cardIcon}>👤</Text>
              <Text style={styles.cardTitle}>Mon Profil</Text>
              <Text style={styles.cardDescription}>Gérer votre compte et vos préférences</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#4CAF50',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
  },
  profileButton: {
    padding: 4,
  },
  avatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    color: 'white',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  welcomeSection: {
    padding: 20,
    backgroundColor: 'white',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  dateText: {
    fontSize: 14,
    color: '#666',
  },
  grid: {
    padding: 15,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    marginBottom: 15,
    width: '48%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
  },
  cardIcon: {
    fontSize: 30,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  cardDescription: {
    fontSize: 12,
    color: '#666',
  },
});

export default function TeacherNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="TeacherDashboard"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Profile"
        component={require('../ProfileScreen').default}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Classes"
        component={ClassesScreen}
        options={{
          title: 'Mes Classes',
          headerStyle: {
            backgroundColor: '#0066cc',
          },
          headerTintColor: '#fff',
        }}
      />
    </Stack.Navigator>
  );
}
