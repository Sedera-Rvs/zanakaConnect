import React from 'react';
import { Text, View } from 'react-native';
import { FontAwesome, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TeacherHomeScreen from '../screens/teacher/HomeScreen';
import ClassesScreen from '../screens/teacher/ClassesScreen';

// Écrans à créer
import NotesScreen from '../screens/teacher/notes/NotesScreen';
import AddNoteScreen from '../screens/teacher/notes/AddNoteScreen';
import AbsencesScreen from '../screens/teacher/absences/AbsencesScreen';
import AddAbsenceScreen from '../screens/teacher/absences/AddAbsenceScreen';
import AbsenceHistoryScreen from '../screens/teacher/absences/AbsenceHistoryScreen';
import DevoirsScreen from '../screens/teacher/devoirs/DevoirsScreen';
import AddDevoirScreen from '../screens/teacher/devoirs/AddDevoirScreen';
import MessagesScreen from '../screens/teacher/messages/MessagesScreen';
import NewMessageScreen from '../screens/teacher/messages/NewMessageScreen';
import ConversationScreen from '../screens/teacher/messages/ConversationScreen';

const Tab = createBottomTabNavigator();
const NotesStack = createNativeStackNavigator();
const AbsencesStack = createNativeStackNavigator();
const DevoirsStack = createNativeStackNavigator();
const MessagesStack = createNativeStackNavigator();
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
        name="AddNote" 
        component={AddNoteScreen} 
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
      <AbsencesStack.Screen 
        name="AddAbsence" 
        component={AddAbsenceScreen} 
      />
      <AbsencesStack.Screen 
        name="AbsenceHistory" 
        component={AbsenceHistoryScreen} 
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
      <DevoirsStack.Screen 
        name="AddDevoir" 
        component={AddDevoirScreen} 
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
        name="NewMessage" 
        component={NewMessageScreen} 
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

// Navigateur pour l'accueil et les classes
function HomeNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen 
        name="TeacherHome" 
        component={TeacherHomeScreen} 
      />
      <HomeStack.Screen 
        name="Classes" 
        component={ClassesScreen} 
      />
    </HomeStack.Navigator>
  );
}

// Navigateur principal pour les enseignants
export default function TeacherNavigator() {
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
      return <Ionicons name="star" size={size} color={color} />;
    case 'calendar':
      return <FontAwesome name="calendar" size={size} color={color} />;
    case 'book':
      return <FontAwesome name="book" size={size} color={color} />;
    case 'message-circle':
      return <MaterialCommunityIcons name="message-text" size={size} color={color} />;
    default:
      return <Text style={{ color, fontSize: size }}>●</Text>;
  }
}
