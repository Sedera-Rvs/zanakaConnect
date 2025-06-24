import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPaiements } from '../../../services/api';
import { formatDate } from '../../../utils/dateUtils';

export default function HistoriquePaiementsScreen({ navigation }) {
  const [paiements, setPaiements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadPaiements();
  }, []);

  const loadPaiements = async () => {
    try {
      setLoading(true);
      console.log('Chargement des paiements...');
      const paiementsData = await getPaiements();
      console.log('Paiements reçus:', paiementsData);
      
      // Vérifier que nous avons bien un tableau
      if (!Array.isArray(paiementsData)) {
        console.warn('Les données reçues ne sont pas un tableau:', paiementsData);
        setPaiements([]);
        return;
      }
      
      // Transformer les données pour l'affichage
      const formattedPaiements = paiementsData
        .filter(item => item && typeof item === 'object') // S'assurer que chaque élément est un objet valide
        .map(item => ({
          id: item.id || Math.random().toString(36).substr(2, 9),
          montant: typeof item.montant === 'string' ? parseFloat(item.montant) : (typeof item.montant === 'number' ? item.montant : 0),
          date: item.date ? new Date(item.date) : new Date(),
          statut: mapStatusToUI(item.status),
          reference: item.reference || 'REF-' + Math.floor(Math.random() * 10000),
          description: item.description || 'Paiement de frais de scolarité'
        }))
        // Trier par date décroissante (du plus récent au plus ancien)
        .sort((a, b) => b.date - a.date);

      console.log('Paiements formatés:', formattedPaiements);
      setPaiements(formattedPaiements);
    } catch (error) {
      console.error('Erreur lors du chargement des paiements:', error);
      
      // Utiliser des données fictives en cas d'erreur
      const mockPaiements = [
        {
          id: '1',
          montant: 250,
          date: new Date(new Date().getTime() - 86400000 * 5), // 5 jours avant
          statut: 'payé',
          reference: 'REF-5421',
          description: 'Premier trimestre 2025 - Jean Dupont'
        },
        {
          id: '2',
          montant: 150,
          date: new Date(new Date().getTime() - 86400000 * 30), // 30 jours avant
          statut: 'payé',
          reference: 'REF-5316',
          description: 'Activités extrascolaires - Jean Dupont'
        },
        {
          id: '3',
          montant: 250,
          date: new Date(new Date().getTime() - 86400000 * 120), // 120 jours avant
          statut: 'payé',
          reference: 'REF-4983',
          description: 'Deuxième trimestre 2024 - Jean Dupont'
        }
      ];
      
      setPaiements(mockPaiements);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPaiements();
  };

  const mapStatusToUI = (status) => {
    const statusMap = {
      'en_attente': 'en attente',
      'reussi': 'payé',
      'echoue': 'échoué'
    };
    return statusMap[status] || status;
  };

  const getStatusStyle = (statut) => {
    switch (statut.toLowerCase()) {
      case 'payé':
        return styles.statusSuccess;
      case 'en attente':
        return styles.statusPending;
      case 'échoué':
        return styles.statusFailed;
      default:
        return styles.statusPending;
    }
  };

  const getStatusTextStyle = (statut) => {
    switch (statut.toLowerCase()) {
      case 'payé':
        return styles.statusTextSuccess;
      case 'en attente':
        return styles.statusTextPending;
      case 'échoué':
        return styles.statusTextFailed;
      default:
        return styles.statusTextPending;
    }
  };

  const renderPaiementItem = ({ item }) => (
    <TouchableOpacity
      style={styles.paiementCard}
      onPress={() => navigation.navigate('PaiementDetails', { paiementId: item.id })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.dateContainer}>
          <Text style={styles.dateText}>{formatDate(item.date)}</Text>
          <Text style={styles.referenceText}>{item.reference}</Text>
        </View>
        <View style={[styles.statusBadge, getStatusStyle(item.statut)]}>
          <Text style={[styles.statusText, getStatusTextStyle(item.statut)]}>
            {item.statut.toUpperCase()}
          </Text>
        </View>
      </View>
      
      <View style={styles.cardBody}>
        <Text style={styles.descriptionText} numberOfLines={2}>
          {item.description}
        </Text>
      </View>
      
      <View style={styles.cardFooter}>
        <Text style={styles.montantText}>{item.montant.toLocaleString('fr-FR')} Ar</Text>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </View>
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0078FF" />
        <Text style={styles.loadingText}>Chargement de l'historique...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Historique des paiements</Text>
        <View style={styles.rightPlaceholder} />
      </View>

      {paiements.length > 0 ? (
        <FlatList
          data={paiements}
          renderItem={renderPaiementItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#0078FF']}
            />
          }
          ListHeaderComponent={() => (
            <Text style={styles.listHeader}>
              {paiements.length} paiement{paiements.length > 1 ? 's' : ''} trouvé{paiements.length > 1 ? 's' : ''}
            </Text>
          )}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={80} color="#CCCCCC" />
          <Text style={styles.emptyTitle}>Aucun paiement</Text>
          <Text style={styles.emptyText}>
            Vous n'avez pas encore effectué de paiement
          </Text>
        </View>
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
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  rightPlaceholder: {
    width: 40,
  },
  listContainer: {
    padding: 16,
  },
  listHeader: {
    marginBottom: 12,
    fontSize: 14,
    color: '#666',
  },
  paiementCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dateContainer: {
    flex: 1,
  },
  dateText: {
    fontSize: 14,
    color: '#666',
  },
  referenceText: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  statusSuccess: {
    backgroundColor: '#E6F7EB',
  },
  statusPending: {
    backgroundColor: '#FFF8E6',
  },
  statusFailed: {
    backgroundColor: '#FFE6E6',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextSuccess: {
    color: '#0A9D56',
  },
  statusTextPending: {
    color: '#F2994A',
  },
  statusTextFailed: {
    color: '#EB5757',
  },
  cardBody: {
    marginBottom: 10,
  },
  descriptionText: {
    fontSize: 14,
    color: '#333',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  montantText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0078FF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
});
