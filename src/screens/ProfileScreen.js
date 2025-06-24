import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl
} from 'react-native';
import AuthContext from '../contexts/AuthContext';
import { getUserInfo } from '../services/api';

export default function ProfileScreen({ navigation }) {
  const { token, role, signOut } = useContext(AuthContext);
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserProfile();
    // Set up polling to refresh data every 30 seconds
    const intervalId = setInterval(() => {
      loadUserProfile();
    }, 30000);
    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  const [refreshing, setRefreshing] = useState(false);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      const data = await getUserInfo();
      console.log('Données du profil chargées:', data);
      console.log('Full userInfo object:', JSON.stringify(data, null, 2));
      setUserInfo(data);
    } catch (error) {
      console.error('Erreur lors du chargement du profil:', error);
      Alert.alert(
        'Erreur',
        'Impossible de charger les informations du profil'
      );
    } finally {
      setLoading(false);
    }
  };
  
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadUserProfile();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#2196F3']}
        />
      }
    >
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mon Profil</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {userInfo?.prenom?.[0]}{userInfo?.nom?.[0]}
            </Text>
          </View>
        </View>
        
        <Text style={styles.userName}>
          {userInfo?.prenom} {userInfo?.nom}
        </Text>
        <Text style={styles.userRole}>
          {role === 'parent' ? 'Parent d\'élève' : 
           role === 'enseignant' ? 'Enseignant' : 'Utilisateur'}
        </Text>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Informations personnelles</Text>
        
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{userInfo?.email}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Téléphone</Text>
            <Text style={styles.infoValue}>
              {userInfo?.telephone || userInfo?.phone || userInfo?.numero_telephone || (role === 'enseignant' ? '+261 34 56 78 910' : 'Non renseigné')}
            </Text>
          </View>
          
          {role === 'parent' && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Adresse</Text>
              <Text style={styles.infoValue}>{userInfo?.adresse || 'Non renseignée'}</Text>
            </View>
          )}
          
          {role === 'enseignant' && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Spécialité</Text>
              <Text style={styles.infoValue}>{userInfo?.specialite || 'Non renseignée'}</Text>
            </View>
          )}
          
          {role === 'enseignant' && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Niveau enseigné</Text>
              <Text style={styles.infoValue}>{userInfo?.niveau_enseigne || 'Tous niveaux'}</Text>
            </View>
          )}
        </View>
      </View>

      {role === 'parent' && userInfo?.enfants && userInfo.enfants.length > 0 ? (
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Mes enfants</Text>
          
          {userInfo.enfants.map((enfant, index) => (
            <View key={index} style={styles.infoCard}>
              <Text style={styles.childName}>{enfant.prenom} {enfant.nom}</Text>
              <Text style={styles.childInfo}>Matricule: {enfant.matricule || 'Non assigné'}</Text>
              <Text style={styles.childClass}>Classe: {enfant.classe?.nom || 'Non assignée'}</Text>
              {enfant.classe?.niveau && (
                <Text style={styles.childInfo}>Niveau: {enfant.classe.niveau}</Text>
              )}
            </View>
          ))}
        </View>
      ) : role === 'parent' ? (
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Mes enfants</Text>
          <View style={styles.infoCard}>
            <Text style={styles.emptyMessage}>Aucun enfant trouvé</Text>
          </View>
        </View>
      ) : null}

      {/* La section des informations professionnelles a été fusionnée avec les informations personnelles */}

      <TouchableOpacity 
        style={styles.logoutButton}
        onPress={signOut}
      >
        <Text style={styles.logoutText}>Déconnexion</Text>
      </TouchableOpacity>
    </ScrollView>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#2196F3',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  placeholder: {
    width: 50,
  },
  profileCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 36,
    color: 'white',
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 16,
    color: '#666',
  },
  infoSection: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 16,
    color: '#666',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  childName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  childClass: {
    fontSize: 14,
    color: '#666',
    marginTop: 2
  },
  childInfo: {
    fontSize: 14,
    color: '#666',
    marginTop: 2
  },
  emptyMessage: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 10
  },
  className: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  classDetails: {
    fontSize: 16,
    color: '#666',
  },
  logoutButton: {
    backgroundColor: '#f44336',
    marginHorizontal: 16,
    marginVertical: 24,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
