import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getConversations } from '../../../services/messagerie';
import { formatRelativeTime } from '../../../utils/dateUtils';

export default function ConversationsScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Charger les conversations
  const loadConversations = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await getConversations();
      setConversations(data);
    } catch (error) {
      console.error('Erreur lors du chargement des conversations:', error);
      Alert.alert('Erreur', 'Impossible de charger les conversations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Rafraîchir la liste des conversations lorsque l'écran est affiché
  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [])
  );

  // Gérer le rafraîchissement par tirer vers le bas
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadConversations(false);
  }, []);

  // Créer une nouvelle conversation
  const handleNewConversation = () => {
    navigation.navigate('NewConversation');
  };

  // Accéder à une conversation
  const handleConversationPress = (conversation) => {
    navigation.navigate('Conversation', { 
      conversationId: conversation.id,
      otherUser: conversation.other_user,
      eleveDetails: conversation.eleve_details
    });
  };

  // Rendu d'un élément de conversation
  const renderConversationItem = ({ item }) => {
    // Récupérer les infos de l'autre utilisateur (enseignant)
    const otherUser = item.other_user;
    const lastMessage = item.last_message;
    const eleveDetails = item.eleve_details;
    
    // Calcul du temps écoulé depuis le dernier message
    const lastMessageTime = lastMessage ? formatRelativeTime(new Date(lastMessage.timestamp)) : '';
    
    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => handleConversationPress(item)}
      >
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {otherUser?.prenom?.charAt(0)?.toUpperCase() || '?'}
              {otherUser?.nom?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
          {item.unread_count > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.unread_count}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={[styles.userName, item.unread_count > 0 && styles.unreadText]}>
              {otherUser?.prenom} {otherUser?.nom}
            </Text>
            <Text style={styles.timeText}>{lastMessageTime}</Text>
          </View>
          
          {eleveDetails && (
            <Text style={styles.eleveText}>
              Concernant: {eleveDetails.prenom} {eleveDetails.nom}
            </Text>
          )}
          
          <Text 
            style={[styles.lastMessage, item.unread_count > 0 && styles.unreadText]} 
            numberOfLines={1}
          >
            {lastMessage ? lastMessage.text : 'Pas de message'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Affichage pendant le chargement
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        renderItem={renderConversationItem}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0066cc']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Image 
              source={require('../../../assets/empty-inbox.png')} 
              style={styles.emptyImage}
              defaultSource={require('../../../assets/empty-inbox.png')}
            />
            <Text style={styles.emptyText}>Pas de conversations</Text>
            <Text style={styles.emptySubText}>
              Commencez une nouvelle conversation avec un enseignant
            </Text>
          </View>
        }
      />
      
      <TouchableOpacity style={styles.fabButton} onPress={handleNewConversation}>
        <Ionicons name="create-outline" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  avatarContainer: {
    marginRight: 16,
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0066cc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ff3b30',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  timeText: {
    fontSize: 12,
    color: '#999',
  },
  eleveText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  unreadText: {
    fontWeight: 'bold',
    color: '#000',
  },
  fabButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#0066cc',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyImage: {
    width: 100,
    height: 100,
    marginBottom: 20,
    opacity: 0.7,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
