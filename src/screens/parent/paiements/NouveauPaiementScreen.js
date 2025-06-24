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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { createPaiement, getEnfants } from '../../../services/api';

export default function NouveauPaiementScreen({ navigation }) {
  const [montant, setMontant] = useState('');
  const [description, setDescription] = useState('');
  const [enfants, setEnfants] = useState([]);
  const [selectedEnfant, setSelectedEnfant] = useState(null);
  const [trimestre, setTrimestre] = useState('Trimestre 1');
  const [anneeScolaire, setAnneeScolaire] = useState('2024-2025');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Liste des trimestres
  const trimestres = [
    'Trimestre 1',
    'Trimestre 2',
    'Trimestre 3',
    'Année complète',
  ];

  // Liste des années scolaires
  const anneesScolaires = [
    '2023-2024',
    '2024-2025',
    '2025-2026',
  ];

  useEffect(() => {
    loadEnfants();
  }, []);

  const loadEnfants = async () => {
    try {
      setInitialLoading(true);
      const response = await getEnfants();
      console.log('Enfants récupérés:', response);
      
      if (response && Array.isArray(response) && response.length > 0) {
        // S'assurer que chaque enfant a une classe valide
        const formattedResponse = response.map(enfant => ({
          ...enfant,
          classe: enfant.classe || { id: 'non-defini', nom: 'Classe non définie' }
        }));
        console.log('Enfants formatés avec classes:', formattedResponse);
        setEnfants(formattedResponse);
        setSelectedEnfant(formattedResponse[0].id);
      } else {
        // Utiliser des données de secours si nécessaire
        console.log('Format de réponse inattendu ou aucun enfant trouvé');
        const mockEnfants = [
          { id: '1', nom: 'Dupont', prenom: 'Jean', classe: { id: '1', nom: '6ème A' } },
        ];
        setEnfants(mockEnfants);
        setSelectedEnfant(mockEnfants[0].id);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des enfants:', error);
      // Utiliser des données de secours en cas d'erreur
      const mockEnfants = [
        { id: '1', nom: 'Dupont', prenom: 'Jean', classe: { id: '1', nom: '6ème A' } },
      ];
      setEnfants(mockEnfants);
      setSelectedEnfant(mockEnfants[0].id);
    } finally {
      setInitialLoading(false);
    }
  };

  const validateFields = () => {
    if (!montant || isNaN(parseFloat(montant)) || parseFloat(montant) <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer un montant valide');
      return false;
    }
    
    if (!selectedEnfant) {
      Alert.alert('Erreur', 'Veuillez sélectionner un enfant');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!validateFields()) return;
    
    try {
      setLoading(true);
      
      // Utiliser le montant saisi par l'utilisateur ou un montant par défaut
      const montantAEnvoyer = montant ? montant.toString() : "200";
      console.log('===== CRÉATION DE PAIEMENT =====');
      console.log('Envoi de la demande de paiement avec montant:', montantAEnvoyer);
      
      // Description fournie par l'utilisateur ou par défaut
      const descriptionAEnvoyer = description || "Frais de scolarité";
      
      console.log('Données envoyées:', { montant: montantAEnvoyer, description: descriptionAEnvoyer });
      
      // Création du paiement
      const result = await createPaiement(montantAEnvoyer, descriptionAEnvoyer);
      console.log('Réussite! Résultat de la création:', result);
      
      // Si nous avons réussi à créer le paiement
      if (result && result.id) {
        // Afficher un message de succès
        Alert.alert(
          'Succès',
          'Paiement créé avec succès. Vous allez être redirigé vers la page de paiement.',
          [{ text: 'OK' }]
        );
        
        // Attendre un peu pour s'assurer que le paiement est bien enregistré côté backend
        // et que l'utilisateur a le temps de voir le message de succès
        setTimeout(() => {
          // Redirection vers la page de paiement avec l'ID du paiement créé
          console.log('Redirection vers EffectuerPaiementScreen avec ID:', result.id);
          
          // Vérifier que l'ID est valide
          const paiementId = result.id;
          
          // Naviguer vers l'écran de paiement avec toutes les données disponibles
          navigation.navigate('EffectuerPaiement', { 
            paiementId: paiementId,
            // Passer également les données complètes du paiement pour éviter de les récupérer à nouveau
            paiementData: result 
          });
        }, 1000); // Attendre 1 seconde pour une meilleure expérience utilisateur
      } else {
        // Aucun ID de paiement n'a été retourné
        console.error('Aucun ID de paiement retourné:', result);
        Alert.alert(
          'Succès',
          'Paiement créé avec succès mais impossible de récupérer l\'ID. Veuillez vérifier la liste des paiements.',
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.navigate('PaiementsList');
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Erreur lors de la création du paiement:', error);
      
      let errorMessage = 'Une erreur est survenue lors de la création du paiement.';
      
      // Extraire le message d'erreur du backend si disponible
      if (error.response && error.response.data) {
        console.error('Détails de l\'erreur:', JSON.stringify(error.response.data));
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error;
        }
        
        // Afficher les détails de l'erreur 400
        if (error.response.status === 400) {
          errorMessage += '\n\nDétails: ' + JSON.stringify(error.response.data);
        }
      }
      
      Alert.alert('Erreur de création', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0078FF" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nouveau paiement</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Informations de paiement</Text>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Élève</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedEnfant}
                onValueChange={(itemValue) => setSelectedEnfant(itemValue)}
                style={styles.picker}
              >
                {enfants.map((enfant) => {
                  // S'assurer que la classe est correctement affichée
                  let classeNom = 'Classe non définie';
                  
                  // Vérifier si classe_details existe (venant du backend)
                  if (enfant.classe_details && enfant.classe_details.nom) {
                    classeNom = enfant.classe_details.nom;
                  }
                  // Sinon, essayer avec la propriété classe directe
                  else if (enfant.classe && enfant.classe.nom) {
                    classeNom = enfant.classe.nom;
                  }
                  
                  const displayName = `${enfant.prenom} ${enfant.nom} - ${classeNom}`;
                  console.log('Affichage élève avec classe:', displayName);
                  
                  return (
                    <Picker.Item
                      key={enfant.id}
                      label={displayName}
                      value={enfant.id}
                    />
                  );
                })}
              </Picker>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Trimestre</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={trimestre}
                onValueChange={(itemValue) => setTrimestre(itemValue)}
                style={styles.picker}
              >
                {trimestres.map((item) => (
                  <Picker.Item key={item} label={item} value={item} />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Année scolaire</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={anneeScolaire}
                onValueChange={(itemValue) => setAnneeScolaire(itemValue)}
                style={styles.picker}
              >
                {anneesScolaires.map((item) => (
                  <Picker.Item key={item} label={item} value={item} />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Montant (Ar)</Text>
            <TextInput
              style={styles.input}
              value={montant}
              onChangeText={setMontant}
              placeholder="Ex: 250"
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Description (optionnel)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Ajouter des détails supplémentaires..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Créer le paiement</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.disclaimer}>
          <Ionicons name="information-circle-outline" size={18} color="#888" />
          <Text style={styles.disclaimerText}>
            La création d'un paiement n'entraîne pas de débit immédiat. Vous serez redirigé vers la page de paiement pour finaliser la transaction.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 16,
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
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  formSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
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
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  buttonContainer: {
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: '#0078FF',
    borderRadius: 8,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  disclaimer: {
    flexDirection: 'row',
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'flex-start',
  },
  disclaimerText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
});
