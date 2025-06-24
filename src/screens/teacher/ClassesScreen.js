import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { getClasses } from '../../services/api';

export default function ClassesScreen({ navigation }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadClasses();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadClasses();
    } catch (error) {
      console.error('Erreur lors du rafraîchissement:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const loadClasses = async () => {
    try {
      setLoading(true);
      const response = await getClasses();
      setClasses(response);
      setError(null);
    } catch (err) {
      setError('Erreur lors du chargement des classes');
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Navigation vers l'écran de gestion des notes pour une classe spécifique
  const navigateToNotes = (classeId, className) => {
    navigation.navigate('Notes', { classeId, className });
  };
  
  // Navigation vers l'écran de gestion des absences pour une classe spécifique
  const navigateToAbsences = (classeId, className) => {
    navigation.navigate('Absences', { classeId, className });
  };
  
  // Navigation vers l'écran de gestion des devoirs pour une classe spécifique
  const navigateToDevoirs = (classeId, className) => {
    navigation.navigate('Devoirs', { classeId, className });
  };
  
  // Navigation vers l'écran de messagerie avec les parents des élèves de la classe
  const navigateToMessages = (classeId, className) => {
    navigation.navigate('Messages', { classeId, className });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={loadClasses} style={styles.retryButton}>
          <Text style={styles.retryText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderClassItem = ({ item }) => (
    <View style={styles.classCard}>
      <View style={styles.classHeader}>
        <Text style={styles.className}>{item.nom}</Text>
        <Text style={styles.classDetails}>
          {item.effectif || 0} élèves
        </Text>
      </View>
      
      <View style={styles.classActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigateToNotes(item.id, item.nom)}
        >
          <Text style={styles.actionButtonText}>Notes</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigateToAbsences(item.id, item.nom)}
        >
          <Text style={styles.actionButtonText}>Absences</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigateToDevoirs(item.id, item.nom)}
        >
          <Text style={styles.actionButtonText}>Devoirs</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigateToMessages(item.id, item.nom)}
        >
          <Text style={styles.actionButtonText}>Messages</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>Aucune classe disponible</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={classes}
        renderItem={renderClassItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.content}
        ListEmptyComponent={renderEmptyComponent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0066cc']}
            tintColor={'#0066cc'}
          />
        }
      />
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    padding: 15,
    flexGrow: 1,
  },
  classCard: {
    backgroundColor: '#fff',
    marginBottom: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  classHeader: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  className: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  classDetails: {
    fontSize: 14,
    color: '#666',
  },
  classActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 10,
  },
  actionButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 5,
    marginHorizontal: 5,
    marginVertical: 5,
    minWidth: '45%',
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#333',
    fontWeight: '500',
  },
  errorText: {
    fontSize: 16,
    color: '#e53935',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
