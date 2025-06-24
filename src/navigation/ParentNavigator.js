import React from 'react';
import { Text, View } from 'react-native';
import { FontAwesome, Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ParentHomeScreen from '../screens/parent/HomeScreen';

// Écrans à créer pour les parents
import NotesScreen from '../screens/parent/notes/NotesScreen';
import BulletinScreen from '../screens/parent/notes/BulletinScreen';
import AbsencesScreen from '../screens/parent/absences/AbsencesScreen';
import DevoirsScreen from '../screens/parent/devoirs/DevoirsScreen';
import MessagesScreen from '../screens/parent/messages/MessagesScreen';
import NewConversationScreen from '../screens/parent/messages/NewConversationScreen';
import ConversationScreen from '../screens/parent/messages/ConversationScreen';
import PaiementsScreen from '../screens/parent/paiements/PaiementsScreen';
import ReçuScreen from '../screens/parent/paiements/ReçuScreen';
import NouveauPaiementScreen from '../screens/parent/paiements/NouveauPaiementScreen';
import EffectuerPaiementScreen from '../screens/parent/paiements/EffectuerPaiementScreen';
import HistoriquePaiementsScreen from '../screens/parent/paiements/HistoriquePaiementsScreen';
import AnnoncesListScreen from '../screens/parent/annonces/AnnoncesListScreen';

const Tab = createBottomTabNavigator();
const NotesStack = createNativeStackNavigator();
const AbsencesStack = createNativeStackNavigator();
const DevoirsStack = createNativeStackNavigator();
const MessagesStack = createNativeStackNavigator();
const PaiementsStack = createNativeStackNavigator();
const HomeStack = createNativeStackNavigator();

// Navigateur pour les notes
function NotesNavigator() {
  return (
    <NotesStack.Navigator screenOptions={{ headerShown: false }}>
      <NotesStack.Screen 
        name="NotesList" 
        component={NotesScreen} 
      />
      <NotesStack.Screen 
        name="Bulletin" 
        component={BulletinScreen} 
      />
    </NotesStack.Navigator>
  );
}

// Navigateur pour les absences
function AbsencesNavigator() {
  return (
    <AbsencesStack.Navigator screenOptions={{ headerShown: false }}>
      <AbsencesStack.Screen 
        name="AbsencesList" 
        component={AbsencesScreen} 
      />
    </AbsencesStack.Navigator>
  );
}

// Navigateur pour les devoirs
function DevoirsNavigator() {
  return (
    <DevoirsStack.Navigator screenOptions={{ headerShown: false }}>
      <DevoirsStack.Screen 
        name="DevoirsList" 
        component={DevoirsScreen} 
      />
    </DevoirsStack.Navigator>
  );
}

// Navigateur pour les messages
function MessagesNavigator() {
  return (
    <MessagesStack.Navigator>
      <MessagesStack.Screen 
        name="MessagesList" 
        component={MessagesScreen} 
        options={{ headerShown: false }}
      />
      <MessagesStack.Screen 
        name="NewConversation" 
        component={NewConversationScreen} 
        options={{ headerShown: false }}
      />
      <MessagesStack.Screen 
        name="Conversation" 
        component={ConversationScreen} 
        options={{ headerShown: true }}
      />
    </MessagesStack.Navigator>
  );
}

// Navigateur pour les paiements
function PaiementsNavigator() {
  return (
    <PaiementsStack.Navigator screenOptions={{ headerShown: false }}>
      <PaiementsStack.Screen 
        name="PaiementsList" 
        component={PaiementsScreen} 
      />
      <PaiementsStack.Screen 
        name="Reçu" 
        component={ReçuScreen} 
      />
      <PaiementsStack.Screen 
        name="NouveauPaiement" 
        component={NouveauPaiementScreen} 
      />
      <PaiementsStack.Screen 
        name="EffectuerPaiement" 
        component={EffectuerPaiementScreen} 
      />
      <PaiementsStack.Screen 
        name="HistoriquePaiements" 
        component={HistoriquePaiementsScreen} 
      />
    </PaiementsStack.Navigator>
  );
}

// Navigateur pour l'accueil
function HomeNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen 
        name="ParentHome" 
        component={ParentHomeScreen} 
      />
      <HomeStack.Screen 
        name="AnnoncesList" 
        component={AnnoncesListScreen} 
      />
    </HomeStack.Navigator>
  );
}

// Navigateur principal pour les parents
export default function ParentNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#0066cc',
        tabBarInactiveTintColor: '#999',
        tabBarLabelStyle: { fontSize: 12 },
        headerShown: false,
        tabBarStyle: {
          paddingVertical: 5,
          height: 60,
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#eee',
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
        }
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeNavigator} 
        options={{ 
          tabBarLabel: 'Accueil',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="home" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen 
        name="Notes" 
        component={NotesNavigator} 
        options={{ 
          tabBarLabel: 'Notes',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="star" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen 
        name="Absences" 
        component={AbsencesNavigator} 
        options={{ 
          tabBarLabel: 'Absences',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="calendar" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen 
        name="Devoirs" 
        component={DevoirsNavigator} 
        options={{ 
          tabBarLabel: 'Devoirs',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="book" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen 
        name="Messages" 
        component={MessagesNavigator} 
        options={{ 
          tabBarLabel: 'Messages',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="message-circle" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen 
        name="Paiements" 
        component={PaiementsNavigator} 
        options={{ 
          tabBarLabel: 'Paiements',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="credit-card" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Composant d'icône pour les onglets
function TabBarIcon({ name, color, size }) {
  // Utilisation de différentes bibliothèques d'icônes en fonction du nom
  switch (name) {
    case 'home':
      return <Ionicons name="home" size={size} color={color} />;
    case 'star':
      return <Ionicons name="school" size={size} color={color} />;
    case 'calendar':
      return <FontAwesome name="calendar" size={size} color={color} />;
    case 'book':
      return <FontAwesome name="book" size={size} color={color} />;
    case 'message-circle':
      return <MaterialCommunityIcons name="message-text" size={size} color={color} />;
    case 'credit-card':
      return <MaterialIcons name="payment" size={size} color={color} />;
    default:
      return <Text style={{ color, fontSize: size }}>●</Text>;
  }
}
