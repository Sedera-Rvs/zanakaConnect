import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { getClasses } from '../../../services/api';

export default function AbsencesScreen({ navigation }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadClasses();
  }, []);
  
  // La fonction handleViewHistory est maintenant utilisée pour naviguer vers l'historique des absences

  const loadClasses = async () => {
    try {
      setLoading(true);
      // Charger les classes depuis l'API
      const response = await getClasses();
      setClasses(response);
    } catch (error) {
      console.error('Erreur lors du chargement des classes:', error);
      Alert.alert(
        'Erreur',
        'Impossible de charger les classes. Veuillez réessayer.'
      );
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadClasses();
    setRefreshing(false);
  };

  const handleClassPress = (classId, className) => {
    navigation.navigate('AddAbsence', { classeId: classId, className: className });
  };

  const handleViewHistory = (classId, className) => {
    navigation.navigate('AbsenceHistory', { classeId: classId, className: className });
  };

  const renderClassItem = ({ item }) => (
    <View style={styles.classCard}>
      <TouchableOpacity
        style={styles.classMainContent}
        onPress={() => handleClassPress(item.id, item.nom)}
      >
        <View style={styles.classInfo}>
          <Text style={styles.className}>{item.nom}</Text>
          <Text style={styles.classDetails}>
           👨🏽‍🎓 {item.effectif} élèves
          </Text>
        </View>
        <Text style={styles.arrowIcon}>→</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.historyButton}
        onPress={() => handleViewHistory(item.id, item.nom)}
      >
        <Text style={styles.historyButtonText}>Historique</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gestion des Absences</Text>
        <Text style={styles.headerSubtitle}>Sélectionnez une classe</Text>
      </View>

      <FlatList
        data={classes}
        renderItem={renderClassItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
  header: {
    padding: 16,
    backgroundColor: '#0066cc',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#fff',
    marginTop: 4,
  },
  listContent: {
    padding: 16,
  },
  classCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    overflow: 'hidden',
  },
  classMainContent: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  classInfo: {
    flex: 1,
  },
  className: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  classDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  arrowIcon: {
    fontSize: 20,
    color: '#0066cc',
  },
  historyButton: {
    backgroundColor: '#e6f2ff',
    padding: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  historyButtonText: {
    color: '#0066cc',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
