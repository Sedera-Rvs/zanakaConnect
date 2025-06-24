import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { getClasses, addDevoir, updateDevoir } from '../../../services/api';

// Fonction pour formater une date pour l'affichage dans le champ de saisie
function formatDateForInput(date) {
  if (!date) return '';
  
  console.log('Formatage de la date:', date, 'Type:', typeof date);
  
  let d;
  try {
    // Gérer différents formats de date
    if (date instanceof Date) {
      d = date;
    } else if (typeof date === 'string') {
      d = new Date(date);
    } else {
      console.error('Format de date non reconnu:', date);
      return '';
    }
    
    // Vérifier si la date est valide
    if (isNaN(d.getTime())) {
      console.error('Date invalide après conversion:', date);
      return '';
    }
    
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch (error) {
    console.error('Erreur lors du formatage de la date:', error);
    return '';
  }
}

export default function AddDevoirScreen({ route, navigation }) {
  // Récupérer les paramètres de navigation s'ils existent
  const params = route.params || {};
  const { devoirToEdit, isEditing } = params;
  
  console.log('Params reçus dans AddDevoirScreen:', params);
  console.log('devoirToEdit:', devoirToEdit);
  
  // Vérifier si le devoir à modifier est valide
  const devoirValide = devoirToEdit && typeof devoirToEdit === 'object';
  
  // Initialiser les états avec les valeurs du devoir à modifier, si disponible
  const [titre, setTitre] = useState(devoirValide && devoirToEdit.titre ? devoirToEdit.titre : '');
  const [description, setDescription] = useState(devoirValide && devoirToEdit.description ? devoirToEdit.description : '');
  const [classeId, setClasseId] = useState(
    devoirValide && devoirToEdit.classe && devoirToEdit.classe.id 
      ? devoirToEdit.classe.id.toString() 
      : ''
  );
  const [dateRemise, setDateRemise] = useState(
    devoirValide && devoirToEdit.date_remise 
      ? formatDateForInput(devoirToEdit.date_remise) 
      : ''
  );

  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    try {
      setLoading(true);
      // Charger les classes depuis l'API
      const response = await getClasses();
      console.log('Classes chargées:', response);
      
      setClasses(response);
      
      // Si aucune classe n'est sélectionnée et qu'il y a des classes disponibles
      if (!classeId && response.length > 0) {
        setClasseId(response[0].id.toString());
      }
    } catch (error) {
      console.error('Erreur lors du chargement des classes:', error);
      Alert.alert('Erreur', 'Impossible de charger la liste des classes');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    // Validation des champs
    if (!titre.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un titre pour le devoir');
      return;
    }

    if (!dateRemise.trim()) {
      Alert.alert('Erreur', 'Veuillez sélectionner une date de remise');
      return;
    }

    if (!classeId) {
      Alert.alert('Erreur', 'Veuillez sélectionner une classe');
      return;
    }

    if (!dateRemise.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer une date de remise');
      return;
    }

    // Validation du format de la date (JJ/MM/AAAA)
    const dateRegex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
    if (!dateRegex.test(dateRemise)) {
      Alert.alert('Erreur', 'Format de date invalide. Utilisez le format JJ/MM/AAAA');
      return;
    }

    // Convertir la date au format ISO
    const [day, month, year] = dateRemise.split('/');
    const dateRemiseISO = new Date(`${year}-${month}-${day}T23:59:59`);
    
    try {
      setSubmitting(true);
      
      // Préparer les données du devoir
      const devoirData = {
        titre: titre.trim(),
        description: description.trim(),
        classe: parseInt(classeId),
        date_remise: dateRemiseISO.toISOString()
      };
      
      console.log('Données du devoir à envoyer:', devoirData);
      
      let result;
      let message;
      
      if (isEditing && devoirToEdit) {
        // Mise à jour d'un devoir existant
        result = await updateDevoir(devoirToEdit.id, devoirData);
        message = `Devoir "${titre}" modifié avec succès`;
      } else {
        // Ajout d'un nouveau devoir
        result = await addDevoir(devoirData);
        message = `Devoir "${titre}" ajouté avec succès`;
      }
      
      console.log('Résultat de l\'opération:', result);
      
      // Afficher un message de succès et retourner à l'écran précédent
      Alert.alert(
        'Succès',
        message,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Erreur lors de l\'opération sur le devoir:', error);
      Alert.alert('Erreur', `Impossible de ${isEditing ? 'modifier' : 'ajouter'} le devoir: ${error.message || 'Erreur inconnue'}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.formContainer}>
        <Text style={styles.title}>{isEditing ? 'Modifier le devoir' : 'Ajouter un devoir'}</Text>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Titre</Text>
          <TextInput
            style={styles.input}
            value={titre}
            onChangeText={setTitre}
            placeholder="Titre du devoir"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={styles.textArea}
            value={description}
            onChangeText={setDescription}
            placeholder="Description détaillée du devoir"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Classe</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={classeId}
              onValueChange={(itemValue) => setClasseId(itemValue)}
              style={styles.picker}
            >
              {classes.map((classe) => (
                <Picker.Item 
                  key={classe.id} 
                  label={`${classe.nom} (${classe.niveau})`} 
                  value={classe.id} 
                />
              ))}
            </Picker>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Date de remise (JJ/MM/AAAA)</Text>
          <TextInput
            style={styles.input}
            value={dateRemise}
            onChangeText={setDateRemise}
            placeholder="JJ/MM/AAAA"
            keyboardType="numbers-and-punctuation"
          />

        </View>

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitButtonText}>
            {submitting 
              ? 'Traitement en cours...' 
              : isEditing 
                ? 'Enregistrer les modifications' 
                : 'Ajouter le devoir'}
          </Text>
        </TouchableOpacity>
      </View>
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
  formContainer: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 24,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
  },
  textArea: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
    minHeight: 120,
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  submitButton: {
    backgroundColor: '#0066cc',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  disabledButton: {
    backgroundColor: '#84a9d1',
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

});
