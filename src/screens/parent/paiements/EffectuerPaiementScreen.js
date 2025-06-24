import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPaiementDetails, updatePaiementStatus } from '../../../services/api';
import { formatDate } from '../../../utils/dateUtils';

export default function EffectuerPaiementScreen({ route, navigation }) {
  // Récupérer les paramètres de la route
  const { paiementId, paiementData } = route.params;
  const [paiement, setPaiement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('card');
  
  // Infos carte
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVC, setCardCVC] = useState('');
  const [cardName, setCardName] = useState('');
  
  // Infos Mobile Money
  const [phoneNumber, setPhoneNumber] = useState('');
  const [operateur, setOperateur] = useState('orange');

  useEffect(() => {
    // Vérifier si les données du paiement ont été passées directement
    if (paiementData) {
      console.log('Utilisation des données de paiement passées directement:', paiementData);
      initializePaiementFromData(paiementData);
    } else {
      // Sinon, charger depuis l'API
      loadPaiementDetails();
    }
  }, []);

  // Initialiser le paiement à partir des données passées directement
  const initializePaiementFromData = (data) => {
    try {
      // Transformer les données pour l'affichage
      const formattedPaiement = {
        id: data.id,
        type: 'Frais de scolarité',
        montant: parseFloat(data.montant) || 0,
        date_creation: data.date ? new Date(data.date) : new Date(),
        statut: mapStatusToUI(data.status),
        reference: data.reference || 'REF-' + Math.floor(Math.random() * 10000),
        description: data.description || 'Paiement de frais de scolarité',
      };
      setPaiement(formattedPaiement);
      setLoading(false);
    } catch (error) {
      console.error('Erreur lors de l\'initialisation des données de paiement:', error);
      // En cas d'erreur, essayer de charger depuis l'API
      loadPaiementDetails();
    }
  };

  const loadPaiementDetails = async () => {
    try {
      setLoading(true);
      console.log('Chargement des détails du paiement avec ID:', paiementId);
      
      if (!paiementId) {
        console.error('ID de paiement manquant');
        Alert.alert('Erreur', 'Impossible de charger les détails du paiement: ID manquant');
        navigation.goBack();
        return;
      }
      
      // Essayer de charger les détails depuis l'API
      const response = await getPaiementDetails(paiementId);
      console.log('Détails du paiement reçus:', response);
      
      if (response) {
        // Vérifier que les données essentielles sont présentes
        if (!response.id) {
          console.warn('ID manquant dans la réponse du paiement');
          response.id = paiementId; // Utiliser l'ID de la route comme fallback
        }
        
        // Transformer les données pour l'affichage
        const formattedPaiement = {
          id: response.id,
          type: 'Frais de scolarité',
          montant: parseFloat(response.montant) || 0,
          date_creation: response.date ? new Date(response.date) : new Date(),
          statut: mapStatusToUI(response.status),
          reference: response.reference || 'REF-' + Math.floor(Math.random() * 10000),
          description: response.description || 'Paiement de frais de scolarité',
        };
        setPaiement(formattedPaiement);
      } else {
        console.log('Aucune donnée reçue, utilisation de données de secours');
        // Utiliser des données de secours si aucune donnée n'est reçue
        const mockPaiement = {
          id: paiementId,
          type: 'Frais de scolarité',
          montant: 200, // Montant par défaut plus réaliste
          date_creation: new Date(),
          statut: 'en attente',
          reference: 'REF-' + Math.floor(Math.random() * 10000),
          description: 'Frais de scolarité',
        };
        setPaiement(mockPaiement);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des détails du paiement:', error);
      
      // Utiliser des données de secours en cas d'erreur
      const mockPaiement = {
        id: paiementId,
        type: 'Frais de scolarité',
        montant: 200, // Montant par défaut plus réaliste
        date_creation: new Date(),
        statut: 'en attente',
        reference: 'REF-' + Math.floor(Math.random() * 10000),
        description: 'Frais de scolarité',
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

  const formatCardNumber = (text) => {
    // Supprime tous les espaces
    const cleaned = text.replace(/\s+/g, '');
    // Ajoute un espace tous les 4 caractères
    const formatted = cleaned.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    return formatted;
  };

  const formatExpiryDate = (text) => {
    // Supprime tous les caractères non numériques
    const cleaned = text.replace(/[^\d]/g, '');
    // Format MM/YY
    if (cleaned.length >= 2) {
      return `${cleaned.substring(0, 2)}/${cleaned.substring(2, 4)}`;
    }
    return cleaned;
  };

  const formatPhoneNumber = (text) => {
    // Supprime tous les caractères non numériques
    const cleaned = text.replace(/[^\d]/g, '');
    return cleaned;
  };

  const handleCardNumberChange = (text) => {
    const formatted = formatCardNumber(text);
    // Limite à 19 caractères (16 chiffres + 3 espaces)
    if (formatted.length <= 19) {
      setCardNumber(formatted);
    }
  };

  const handleExpiryChange = (text) => {
    const formatted = formatExpiryDate(text);
    // Limite à 5 caractères (MM/YY)
    if (formatted.length <= 5) {
      setCardExpiry(formatted);
    }
  };

  const handleCVCChange = (text) => {
    // Limite à 3 caractères
    if (text.length <= 3 && /^\\d*$/.test(text)) {
      setCardCVC(text);
    }
  };

  const handlePhoneNumberChange = (text) => {
    const formatted = formatPhoneNumber(text);
    // Limite à 10 caractères
    if (formatted.length <= 10) {
      setPhoneNumber(formatted);
    }
  };

  const validateCardDetails = () => {
    // Vérifier le numéro de carte (doit contenir 16 chiffres sans les espaces)
    const cleanedCardNumber = cardNumber.replace(/\s+/g, '');
    if (!cleanedCardNumber || cleanedCardNumber.length !== 16 || !/^\d+$/.test(cleanedCardNumber)) {
      Alert.alert('Erreur', 'Veuillez entrer un numéro de carte valide (16 chiffres)');
      return false;
    }

    // Vérifier la date d'expiration (format MM/YY)
    if (!cardExpiry.trim() || cardExpiry.length !== 5 || !/^\d{2}\/\d{2}$/.test(cardExpiry)) {
      Alert.alert('Erreur', 'Veuillez entrer une date d\'expiration valide (MM/YY)');
      return false;
    }

    // Vérifier le CVC (3 chiffres)
    if (!cardCVC.trim() || cardCVC.length !== 3 || !/^\d{3}$/.test(cardCVC)) {
      Alert.alert('Erreur', 'Veuillez entrer un code CVC valide (3 chiffres)');
      return false;
    }

    // Vérifier le nom sur la carte
    if (!cardName.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer le nom sur la carte');
      return false;
    }

    return true;
  };

  const validateMobileMoneyDetails = () => {
    // Vérifier que le numéro de téléphone est valide (au moins 10 chiffres)
    if (!phoneNumber.trim() || phoneNumber.length < 10 || !/^\d+$/.test(phoneNumber)) {
      Alert.alert('Erreur', 'Veuillez entrer un numéro de téléphone valide (10 chiffres)');
      return false;
    }

    return true;
  };

  const handlePaymentSubmit = async () => {
    console.log('Début du processus de paiement');
    console.log('Méthode de paiement sélectionnée:', paymentMethod);
    console.log('Montant à payer:', paiement.montant);
    
    // Validation selon la méthode de paiement
    if (paymentMethod === 'card') {
      console.log('Validation des détails de la carte...');
      if (!validateCardDetails()) {
        console.log('Validation de la carte échouée');
        return;
      }
      console.log('Validation de la carte réussie');
    } else if (paymentMethod === 'mobile') {
      console.log('Validation des détails du mobile money...');
      if (!validateMobileMoneyDetails()) {
        console.log('Validation du mobile money échouée');
        return;
      }
      console.log('Validation du mobile money réussie');
    }

    try {
      // Indiquer que le paiement est en cours
      setProcessingPayment(true);
      
      // Simulation d'un délai pour le traitement du paiement
      console.log('Soumission des informations de paiement en cours...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Ici, intégrer l'appel à l'API de paiement réelle
      console.log('Informations de paiement:');
      
      if (paymentMethod === 'card') {
        // Sécurité: n'affiche que les 4 derniers chiffres de la carte
        const maskedCardNumber = cardNumber.replace(/\s+/g, '').slice(-4).padStart(16, '*').replace(/(....)/g, '$1 ').trim();
        console.log('Infos carte:', {
          cardNumber: maskedCardNumber,
          cardExpiry,
          cardName
        });
      } else {
        console.log('Infos Mobile Money:', {
          phoneNumber,
          operateur
        });
      }
      
      // Le paiement a été soumis. Il reste "en attente" pour validation par l'administrateur.
      // Le statut par défaut est déjà "en_attente" côté backend lors de la création.
      // Aucune mise à jour de statut n'est effectuée ici.
      console.log('Informations de paiement soumises, statut reste en attente.');
      
      // Afficher une alerte de soumission
      Alert.alert(
        'Paiement Soumis',
        'Votre paiement a été soumis et est en attente de validation par l\'administration.',
        [
          {
            text: 'OK',
            onPress: () => {
              console.log('Navigation vers l\'historique des paiements...');
              // Essayer de naviguer directement vers l'historique des paiements
              try {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'HistoriquePaiements' }],
                });
              } catch (navError) {
                console.error('Erreur lors de la navigation:', navError);
                // Fallback: essayer une navigation simple
                try {
                  navigation.navigate('Paiements');
                } catch (fallbackError) {
                  console.error('Erreur lors de la navigation de secours:', fallbackError);
                  // Dernier recours: revenir en arrière
                  navigation.goBack();
                }
              }
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('Erreur lors du traitement du paiement:', error);
      console.error('Détails de l\'erreur:', error.message);
      
      Alert.alert(
        'Erreur de paiement',
        'Une erreur est survenue lors du traitement de votre paiement. Veuillez réessayer.',
        [{ text: 'OK' }]
      );
    } finally {
      setProcessingPayment(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0078FF" />
        <Text style={styles.loadingText}>Chargement...</Text>
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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Paiement</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Résumé du paiement</Text>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Type</Text>
              <Text style={styles.summaryValue}>{paiement.type}</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Description</Text>
              <Text style={styles.summaryValue} numberOfLines={2}>{paiement.description}</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Référence</Text>
              <Text style={styles.summaryValue}>{paiement.reference}</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Date</Text>
              <Text style={styles.summaryValue}>{formatDate(paiement.date_creation)}</Text>
            </View>
            
            <View style={styles.amountContainer}>
              <Text style={styles.amountLabel}>Montant total</Text>
              <Text style={styles.amountValue}>{typeof paiement.montant === 'number' ? paiement.montant.toLocaleString('fr-FR') : paiement.montant} Ar</Text>
            </View>
          </View>

          <View style={styles.paymentMethodsCard}>
            <Text style={styles.sectionTitle}>Méthode de paiement</Text>
            
            <View style={styles.paymentMethods}>
              <TouchableOpacity
                style={[
                  styles.paymentMethodButton,
                  paymentMethod === 'card' && styles.paymentMethodButtonSelected
                ]}
                onPress={() => setPaymentMethod('card')}
              >
                <Ionicons
                  name="card-outline"
                  size={24}
                  color={paymentMethod === 'card' ? '#0078FF' : '#888'}
                />
                <Text
                  style={[
                    styles.paymentMethodText,
                    paymentMethod === 'card' && styles.paymentMethodTextSelected
                  ]}
                >
                  Carte bancaire
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.paymentMethodButton,
                  paymentMethod === 'mobile' && styles.paymentMethodButtonSelected
                ]}
                onPress={() => setPaymentMethod('mobile')}
              >
                <Ionicons
                  name="phone-portrait-outline"
                  size={24}
                  color={paymentMethod === 'mobile' ? '#0078FF' : '#888'}
                />
                <Text
                  style={[
                    styles.paymentMethodText,
                    paymentMethod === 'mobile' && styles.paymentMethodTextSelected
                  ]}
                >
                  Mobile Money
                </Text>
              </TouchableOpacity>
            </View>
            
            {paymentMethod === 'card' ? (
              <View style={styles.paymentForm}>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Numéro de carte</Text>
                  <TextInput
                    style={styles.input}
                    value={cardNumber}
                    onChangeText={handleCardNumberChange}
                    placeholder="1234 5678 9012 3456"
                    keyboardType="numeric"
                    maxLength={19}
                  />
                </View>
                
                <View style={styles.formRow}>
                  <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.label}>Date d'expiration</Text>
                    <TextInput
                      style={styles.input}
                      value={cardExpiry}
                      onChangeText={handleExpiryChange}
                      placeholder="MM/YY"
                      keyboardType="numeric"
                      maxLength={5}
                    />
                  </View>
                  
                  <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                    <Text style={styles.label}>CVC</Text>
                    <TextInput
                      style={styles.input}
                      value={cardCVC}
                      onChangeText={handleCVCChange}
                      placeholder="123"
                      keyboardType="numeric"
                      maxLength={3}
                      secureTextEntry
                    />
                  </View>
                </View>
                
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Nom sur la carte</Text>
                  <TextInput
                    style={styles.input}
                    value={cardName}
                    onChangeText={setCardName}
                    placeholder="JEAN DUPONT"
                    autoCapitalize="characters"
                  />
                </View>
                
                <View style={styles.securityNote}>
                  <Ionicons name="lock-closed-outline" size={16} color="#888" />
                  <Text style={styles.securityText}>
                    Vos informations de paiement sont sécurisées. Nous ne stockons pas les détails de votre carte.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.paymentForm}>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Numéro de téléphone</Text>
                  <TextInput
                    style={styles.input}
                    value={phoneNumber}
                    onChangeText={handlePhoneNumberChange}
                    placeholder="0612345678"
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
                
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Opérateur</Text>
                  <View style={styles.operateurButtons}>
                    <TouchableOpacity
                      style={[
                        styles.operateurButton,
                        operateur === 'orange' && styles.operateurButtonSelected
                      ]}
                      onPress={() => setOperateur('orange')}
                    >
                      <View style={[styles.operateurIconContainer, { backgroundColor: '#FF6600' }]}>
                        <Ionicons name="cash-outline" size={24} color="#FFFFFF" />
                        <Text style={styles.operateurIconText}>Orange Money</Text>
                      </View>
                      <Text
                        style={[
                          styles.operateurText,
                          operateur === 'orange' && styles.operateurTextSelected
                        ]}
                      >
                        Orange Money
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.operateurButton,
                        operateur === 'mtn' && styles.operateurButtonSelected
                      ]}
                      onPress={() => setOperateur('mtn')}
                    >
                      <View style={[styles.operateurIconContainer, { backgroundColor: '#FFCC00' }]}>
                        <Ionicons name="phone-portrait-outline" size={24} color="#333" />
                        <Text style={styles.operateurIconText}>MTN MoMo</Text>
                      </View>
                      <Text
                        style={[
                          styles.operateurText,
                          operateur === 'mtn' && styles.operateurTextSelected
                        ]}
                      >
                        MTN Mobile Money
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                
                <View style={styles.securityNote}>
                  <Ionicons name="information-circle-outline" size={16} color="#888" />
                  <Text style={styles.securityText}>
                    Vous recevrez un code de confirmation sur votre téléphone pour valider le paiement.
                  </Text>
                </View>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.payButton}
            onPress={handlePaymentSubmit}
            disabled={processingPayment}
          >
            {processingPayment ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.payButtonText}>
                  Payer {typeof paiement.montant === 'number' ? paiement.montant.toLocaleString('fr-FR') : paiement.montant} Ar
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
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
  summaryCard: {
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
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  amountContainer: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  amountValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  paymentMethodsCard: {
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  paymentMethods: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  paymentMethodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  paymentMethodButtonSelected: {
    backgroundColor: '#E6F0FF',
    borderWidth: 1,
    borderColor: '#0078FF',
  },
  paymentMethodText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#555',
  },
  paymentMethodTextSelected: {
    color: '#0078FF',
    fontWeight: '500',
  },
  paymentForm: {
    marginTop: 8,
  },
  formGroup: {
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  operateurButtons: {
    flexDirection: 'column',
    marginTop: 4,
  },
  operateurButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    marginBottom: 8,
  },
  operateurButtonSelected: {
    borderColor: '#0078FF',
    backgroundColor: '#E6F0FF',
  },
  operateurIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  operateurIconText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 14,
  },
  operateurText: {
    fontSize: 14,
    color: '#333',
  },
  operateurTextSelected: {
    color: '#0078FF',
    fontWeight: '500',
  },
  securityNote: {
    flexDirection: 'row',
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    alignItems: 'flex-start',
  },
  securityText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  payButton: {
    backgroundColor: '#0078FF',
    borderRadius: 8,
    paddingVertical: 16,
    marginVertical: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  payButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  backButtonText: {
    color: '#0078FF',
    fontWeight: '600',
    fontSize: 16,
  },
});
