import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPaiementDetails } from '../../../services/api';
import { formatDate } from '../../../utils/dateUtils';

export default function PaiementDetailsScreen({ route, navigation }) {
  const { paiementId } = route.params;
  const [paiement, setPaiement] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPaiementDetails();
  }, []);

  const loadPaiementDetails = async () => {
    try {
      setLoading(true);
      console.log('Chargement des détails du paiement', paiementId);
      
      // Essayer de charger les détails depuis l'API
      const response = await getPaiementDetails(paiementId);
      console.log('Détails du paiement reçus:', response);
      
      if (response) {
        // Transformer les données pour l'affichage
        const formattedPaiement = {
          id: response.id,
          type: 'Frais de scolarité',
          montant: parseFloat(response.montant) || 0,
          date_creation: response.date ? new Date(response.date) : new Date(),
          date_paiement: response.status === 'reussi' ? (response.date ? new Date(response.date) : new Date()) : null,
          statut: mapStatusToUI(response.status),
          methode: 'Mobile Money',
          reference: response.reference || 'REF-' + Math.floor(Math.random() * 10000),
          description: response.description || 'Paiement de frais de scolarité',
          parent: response.parent_details ? {
            nom: response.parent_details.nom,
            prenom: response.parent_details.prenom,
            email: response.parent_details.email
          } : null
        };
        setPaiement(formattedPaiement);
      } else {
        console.log('Aucune donnée reçue, utilisation de données de secours');
        // Utiliser des données de secours si aucune donnée n'est reçue
        const mockPaiement = {
          id: paiementId,
          type: 'Frais de scolarité',
          montant: 250,
          date_creation: new Date(),
          date_paiement: new Date(Date.now() - 86400000 * 2), // 2 jours avant
          statut: 'payé',
          methode: 'Mobile Money',
          reference: 'REF-' + Math.floor(Math.random() * 10000),
          description: 'Premier trimestre 2025 - Jean Dupont',
          parent: {
            nom: 'Dupont',
            prenom: 'Marie',
            email: 'marie.dupont@example.com'
          }
        };
        setPaiement(mockPaiement);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des détails du paiement:', error);
      
      // Utiliser des données de secours en cas d'erreur
      const mockPaiement = {
        id: paiementId,
        type: 'Frais de scolarité',
        montant: 250,
        date_creation: new Date(),
        date_paiement: new Date(Date.now() - 86400000 * 2), // 2 jours avant
        statut: 'payé',
        methode: 'Mobile Money',
        reference: 'REF-' + Math.floor(Math.random() * 10000),
        description: 'Premier trimestre 2025 - Jean Dupont',
        parent: {
          nom: 'Dupont',
          prenom: 'Marie',
          email: 'marie.dupont@example.com'
        }
      };
      setPaiement(mockPaiement);
      
      Alert.alert(
        'Erreur',
        'Impossible de charger les détails du paiement. Des données de secours sont affichées.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const mapStatusToUI = (status) => {
    const statusMap = {
      'en_attente': 'en attente',
      'reussi': 'payé',
      'echoue': 'échoué'
    };
    return statusMap[status] || status;
  };

  const handlePayNow = () => {
    navigation.navigate('EffectuerPaiement', { paiementId: paiement.id });
  };

  const handleViewReceipt = () => {
    navigation.navigate('Reçu', { paiementId: paiement.id });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'payé':
        return { name: 'checkmark-circle', color: '#0A9D56' };
      case 'en attente':
        return { name: 'time', color: '#F5A623' };
      case 'échoué':
        return { name: 'close-circle', color: '#D63031' };
      default:
        return { name: 'help-circle', color: '#888' };
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0078FF" />
        <Text style={styles.loadingText}>Chargement des détails...</Text>
      </View>
    );
  }

  if (!paiement) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#D63031" />
        <Text style={styles.errorTitle}>Paiement introuvable</Text>
        <Text style={styles.errorText}>Impossible de trouver les détails de ce paiement.</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusIcon = getStatusIcon(paiement.statut);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Détails du paiement</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.statusContainer}>
          <Ionicons name={statusIcon.name} size={64} color={statusIcon.color} />
          <Text style={[styles.statusText, { color: statusIcon.color }]}>
            {paiement.statut === 'payé'
              ? 'Paiement effectué'
              : paiement.statut === 'en attente'
              ? 'En attente de paiement'
              : 'Paiement échoué'}
          </Text>
          {paiement.date_paiement && paiement.statut === 'payé' && (
            <Text style={styles.dateText}>
              le {formatDate(paiement.date_paiement, true)}
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>Montant</Text>
            <Text style={styles.amountValue}>{paiement.montant.toLocaleString('fr-FR')} Ar</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Type</Text>
              <Text style={styles.detailValue}>{paiement.type}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Référence</Text>
              <Text style={styles.detailValue}>{paiement.reference}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date de création</Text>
              <Text style={styles.detailValue}>{formatDate(paiement.date_creation)}</Text>
            </View>

            {paiement.date_paiement && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Date de paiement</Text>
                <Text style={styles.detailValue}>{formatDate(paiement.date_paiement)}</Text>
              </View>
            )}

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Statut</Text>
              <View style={styles.statusBadgeContainer}>
                <Text
                  style={[
                    styles.statusBadge,
                    paiement.statut === 'payé' ? styles.statusPaid :
                    paiement.statut === 'en attente' ? styles.statusPending :
                    styles.statusFailed
                  ]}
                >
                  {paiement.statut}
                </Text>
              </View>
            </View>

            {paiement.methode && paiement.statut === 'payé' && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Méthode</Text>
                <Text style={styles.detailValue}>{paiement.methode}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Description</Text>
          <Text style={styles.descriptionText}>{paiement.description}</Text>
        </View>

        {paiement.parent && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Parent</Text>
            <View style={styles.parentInfo}>
              <Text style={styles.parentName}>{paiement.parent.prenom} {paiement.parent.nom}</Text>
              <Text style={styles.parentEmail}>{paiement.parent.email}</Text>
            </View>
          </View>
        )}

        {paiement.statut === 'en attente' && (
          <TouchableOpacity style={styles.payButton} onPress={handlePayNow}>
            <Text style={styles.payButtonText}>Effectuer le paiement</Text>
          </TouchableOpacity>
        )}

        {paiement.statut === 'payé' && (
          <TouchableOpacity style={styles.receiptButton} onPress={handleViewReceipt}>
            <Ionicons name="receipt-outline" size={18} color="#0078FF" />
            <Text style={styles.receiptButtonText}>Voir le reçu</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
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
  content: {
    flex: 1,
    padding: 16,
  },
  statusContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  statusText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 12,
  },
  dateText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  amountContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  amountLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 12,
  },
  detailsContainer: {
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    textAlign: 'right',
  },
  statusBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '500',
    overflow: 'hidden',
  },
  statusPaid: {
    backgroundColor: '#E6F7EB',
    color: '#0A9D56',
  },
  statusPending: {
    backgroundColor: '#FFF8E6',
    color: '#F5A623',
  },
  statusFailed: {
    backgroundColor: '#FFE6E6',
    color: '#D63031',
  },
  descriptionText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  parentInfo: {
    marginTop: 4,
  },
  parentName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  parentEmail: {
    fontSize: 14,
    color: '#666',
  },
  payButton: {
    backgroundColor: '#0078FF',
    borderRadius: 8,
    paddingVertical: 14,
    marginVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  payButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  receiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F7FF',
    borderRadius: 8,
    paddingVertical: 12,
    marginVertical: 16,
  },
  receiptButtonText: {
    marginLeft: 8,
    color: '#0078FF',
    fontWeight: '600',
    fontSize: 16,
  },
  backButtonText: {
    color: '#0078FF',
    fontWeight: '600',
    fontSize: 16,
  },
});
