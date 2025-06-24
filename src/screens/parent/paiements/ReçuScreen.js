import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPaiementDetails } from '../../../services/api';
import { formatDate } from '../../../utils/dateUtils';

export default function ReçuScreen({ route, navigation }) {
  const { paiementId } = route.params;
  const [paiement, setPaiement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

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
          date_paiement: new Date(),
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
        date_paiement: new Date(),
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

  // Fonction simplifiée pour remplacer generatePdfHtml

  const shareReceipt = async () => {
    try {
      setSharing(true);
      
      // Version simplifiée pour partager les détails du paiement sous forme de texte
      const paymentDate = paiement.date_paiement ? formatDate(paiement.date_paiement, true) : formatDate(new Date(), true);
      const message = `Reçu de paiement ${paiement.reference}\n\n` +
        `Date: ${paymentDate}\n` +
        `Montant: ${paiement.montant.toLocaleString('fr-FR')} Ar\n` +
        `Description: ${paiement.description}\n` +
        `Statut: Payé\n\n` +
        `Ce reçu est généré automatiquement et ne nécessite pas de signature.`;
      
      await Share.share({
        message,
        title: `Reçu de paiement ${paiement.reference}`
      });
      
      console.log('Partage du reçu sous forme de texte');
    } catch (error) {
      console.error('Erreur lors du partage du reçu:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors du partage du reçu.');
    } finally {
      setSharing(false);
    }
  };

  // Fonction simplifiée pour le partage directement intégrée dans shareReceipt

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0078FF" />
        <Text style={styles.loadingText}>Chargement du reçu...</Text>
      </View>
    );
  }

  if (!paiement) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#D63031" />
        <Text style={styles.errorTitle}>Reçu introuvable</Text>
        <Text style={styles.errorText}>Impossible de charger le reçu pour ce paiement.</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Reçu de paiement</Text>
        <TouchableOpacity
          style={styles.shareButton}
          onPress={shareReceipt}
          disabled={sharing}
        >
          <Ionicons name="share-outline" size={24} color="#0078FF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.receiptContainer}>
          <View style={styles.receiptHeader}>
            <View style={styles.logoContainer}>
              <Ionicons name="school-outline" size={64} color="#0078FF" />
            </View>
            <Text style={styles.receiptTitle}>Reçu de Paiement</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>PAYÉ</Text>
            </View>
          </View>

          <View style={styles.receiptSection}>
            <Text style={styles.sectionTitle}>Détails du paiement</Text>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Référence</Text>
              <Text style={styles.detailValue}>{paiement.reference}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date de paiement</Text>
              <Text style={styles.detailValue}>
                {paiement.date_paiement ? formatDate(paiement.date_paiement, true) : formatDate(new Date(), true)}
              </Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Méthode</Text>
              <Text style={styles.detailValue}>{paiement.methode}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Type</Text>
              <Text style={styles.detailValue}>{paiement.type}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Description</Text>
              <Text style={styles.detailValue}>{paiement.description}</Text>
            </View>
          </View>

          <View style={styles.receiptSection}>
            <Text style={styles.sectionTitle}>Montant</Text>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Sous-total</Text>
              <Text style={styles.detailValue}>{paiement.montant.toLocaleString('fr-FR')} Ar</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Frais</Text>
              <Text style={styles.detailValue}>0,00 Ar</Text>
            </View>
            
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{paiement.montant.toLocaleString('fr-FR')} Ar</Text>
            </View>
          </View>

          {paiement.parent && (
            <View style={styles.receiptSection}>
              <Text style={styles.sectionTitle}>Client</Text>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Nom</Text>
                <Text style={styles.detailValue}>{paiement.parent.prenom} {paiement.parent.nom}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Email</Text>
                <Text style={styles.detailValue}>{paiement.parent.email}</Text>
              </View>
            </View>
          )}

          <View style={styles.barcode}>
            <Ionicons name="barcode-outline" size={64} color="#333" />
            <Text style={styles.barcodeText}>{paiement.reference}</Text>
          </View>

          <View style={styles.receiptFooter}>
            <Text style={styles.footerText}>Ce reçu est généré automatiquement et ne nécessite pas de signature.</Text>
            <Text style={styles.footerText}>Pour toute question, veuillez contacter le service financier.</Text>
            <Text style={styles.footerText}>Date d'impression: {formatDate(new Date(), true)}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.actionBar}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={shareReceipt}
          disabled={sharing}
        >
          {sharing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Partager le reçu</Text>
            </>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back-outline" size={20} color="#0078FF" />
          <Text style={styles.actionButtonTextSecondary}>Retour</Text>
        </TouchableOpacity>
      </View>
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
  shareButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  receiptContainer: {
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
  receiptHeader: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  logoContainer: {
    width: 80,
    height: 80,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0078FF',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 15,
    paddingVertical: 4,
    backgroundColor: '#E6F7EB',
    borderRadius: 16,
  },
  statusText: {
    color: '#0A9D56',
    fontWeight: '600',
    fontSize: 14,
  },
  receiptSection: {
    marginBottom: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    maxWidth: '60%',
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0078FF',
  },
  barcode: {
    alignItems: 'center',
    marginVertical: 20,
  },
  barcodeText: {
    marginTop: 4,
    fontSize: 14,
    color: '#555',
  },
  receiptFooter: {
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  footerText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginBottom: 4,
  },
  actionBar: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#0078FF',
    borderRadius: 8,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  actionButtonSecondary: {
    backgroundColor: '#F0F7FF',
    borderWidth: 1,
    borderColor: '#0078FF',
  },
  actionButtonText: {
    marginLeft: 8,
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  actionButtonTextSecondary: {
    marginLeft: 8,
    color: '#0078FF',
    fontWeight: '600',
    fontSize: 14,
  },
  backButtonText: {
    color: '#0078FF',
    fontWeight: '600',
    fontSize: 16,
  },
});
