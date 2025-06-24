import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { getEnfants, getEnseignantsEleve, sendMessage, startConversation } from '../../../services/api';

export default function NewMessageScreen({ navigation }) {
  const [enfants, setEnfants] = useState([]);
  const [enseignants, setEnseignants] = useState([]);
  const [selectedEnfant, setSelectedEnfant] = useState(null);
  const [selectedEnseignant, setSelectedEnseignant] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingEnseignants, setLoadingEnseignants] = useState(false);

  useEffect(() => {
    loadEnfants();
  }, []);

  useEffect(() => {
    if (selectedEnfant) {
      loadEnseignants(selectedEnfant.id);
    } else {
      setEnseignants([]);
      setSelectedEnseignant(null);
    }
  }, [selectedEnfant]);

  const loadEnfants = async () => {
    try {
      setLoading(true);
      // Charger les enfants depuis l'API
      const response = await getEnfants();
      console.log('Enfants chargés:', response);
      
      // Formater les données des enfants
      const formattedEnfants = response.map(enfant => ({
        id: enfant.id.toString(),
        nom: enfant.nom,
        prenom: enfant.prenom,
        classe: enfant.classe_details || enfant.classe || { id: null, nom: 'Classe non spécifiée' }
      }));
      
      setEnfants(formattedEnfants);
    } catch (error) {
      console.error('Erreur lors du chargement des enfants:', error);
      Alert.alert('Erreur', 'Impossible de charger la liste des enfants');
    } finally {
      setLoading(false);
    }
  };

  const loadEnseignants = async (enfantId) => {
    try {
      setLoadingEnseignants(true);
      // Charger les enseignants de l'élève depuis l'API
      const response = await getEnseignantsEleve(enfantId);
      console.log(`Enseignants chargés pour l'élève ${enfantId}:`, response);
      
      // Formater les données des enseignants
      // La structure des données peut varier selon l'implémentation de getEnseignantsEleve
      const formattedEnseignants = response.map(enseignant => ({
        id: enseignant.id.toString(),
        nom: enseignant.nom || '',
        prenom: enseignant.prenom || '',
        matiere: enseignant.matiere || 'Enseignant'
      }));
      
      console.log('Enseignants formatés:', formattedEnseignants);
      setEnseignants(formattedEnseignants);
      
      // Si nous n'avons pas d'enseignants, afficher un message
      if (formattedEnseignants.length === 0) {
        console.warn('Aucun enseignant trouvé pour cet élève');
      }
    } catch (error) {
      console.error('Erreur lors du chargement des enseignants:', error);
      Alert.alert('Erreur', 'Impossible de charger la liste des enseignants');
      setEnseignants([]);
    } finally {
      setLoadingEnseignants(false);
    }
  };

  const handleSelectEnfant = (enfant) => {
    console.log('Enfant sélectionné:', enfant);
    setSelectedEnfant(enfant);
    
    // Charger les enseignants pour cet enfant
    if (enfant && enfant.id) {
      loadEnseignants(enfant.id);
    }
  };

  const handleSelectEnseignant = (enseignant) => {
    setSelectedEnseignant(enseignant);
  };

  const handleSendMessage = async () => {
    if (!selectedEnfant) {
      Alert.alert('Erreur', 'Veuillez sélectionner un enfant');
      return;
    }

    if (!selectedEnseignant) {
      Alert.alert('Erreur', 'Veuillez sélectionner un enseignant');
      return;
    }

    if (!messageText.trim()) {
      Alert.alert('Erreur', 'Veuillez écrire un message');
      return;
    }

    try {
      setLoading(true);
      
      // Utiliser la nouvelle fonction startConversation qui combine à la fois
      // la création d'une conversation et l'envoi du premier message
      const startConversationData = {
        destinataire: selectedEnseignant.id,
        eleve: selectedEnfant.id,
        message: messageText.trim()
      };
      
      console.log('Démarrage d\'une nouvelle conversation:', startConversationData);
      const response = await startConversation(startConversationData);
      console.log('Réponse après démarrage de la conversation:', response);
      
      // Vérifier si nous avons bien une réponse avec une conversation
      if (response && response.conversation) {
        console.log('Conversation créée avec succès:', response.conversation);
        
        // Préparer les informations pour l'écran de conversation
        const conversation = {
          id: response.conversation.id,
          titre: response.conversation.titre || `Conversation avec ${selectedEnseignant.prenom} ${selectedEnseignant.nom}`,
          autre_participant: {
            id: selectedEnseignant.id,
            nom: selectedEnseignant.nom,
            prenom: selectedEnseignant.prenom,
            role: 'enseignant'
          },
          enfant: selectedEnfant
        };
        
        // Informer l'utilisateur que le message a été envoyé et naviguer vers la conversation
        Alert.alert(
          'Succès',
          'Votre message a été envoyé avec succès!',
          [{ 
            text: 'OK', 
            onPress: () => navigation.replace('ConversationDetails', {
              conversation: conversation,
              title: `${selectedEnseignant.prenom} ${selectedEnseignant.nom}`,
              subtitle: selectedEnseignant.matiere
            })
          }]
        );
      } else {
        // Si nous n'avons pas de conversation dans la réponse, simplement revenir à l'écran précédent
        Alert.alert(
          'Succès',
          'Votre message a été envoyé avec succès!',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer le message. Veuillez réessayer plus tard.');
    } finally {
      setLoading(false);
    }
  };

  const renderEnfantItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.selectableCard,
        selectedEnfant?.id === item.id && styles.selectedCard,
      ]}
      onPress={() => handleSelectEnfant(item)}
    >
      <Text style={styles.cardTitle}>
        {item.prenom} {item.nom}
      </Text>
      <Text style={styles.cardSubtitle}>{item.classe.nom}</Text>
    </TouchableOpacity>
  );

  const renderEnseignantItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.selectableCard,
        selectedEnseignant?.id === item.id && styles.selectedCard,
      ]}
      onPress={() => handleSelectEnseignant(item)}
    >
      <Text style={styles.cardTitle}>
        {item.prenom} {item.nom}
      </Text>
      <Text style={styles.cardSubtitle}>{item.matiere}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sélectionnez un enfant</Text>
          <FlatList
            data={enfants}
            renderItem={renderEnfantItem}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          />
        </View>

        {selectedEnfant && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sélectionnez un enseignant</Text>
            {loadingEnseignants ? (
              <ActivityIndicator size="small" color="#0066cc" style={styles.smallLoader} />
            ) : (
              <FlatList
                data={enseignants}
                renderItem={renderEnseignantItem}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>Aucun enseignant disponible</Text>
                  </View>
                }
              />
            )}
          </View>
        )}

        <View style={styles.messageSection}>
          <Text style={styles.sectionTitle}>Votre message</Text>
          <TextInput
            style={styles.messageInput}
            placeholder="Écrivez votre message ici..."
            value={messageText}
            onChangeText={setMessageText}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!selectedEnfant || !selectedEnseignant || !messageText.trim()) && styles.disabledButton,
          ]}
          onPress={handleSendMessage}
          disabled={!selectedEnfant || !selectedEnseignant || !messageText.trim()}
        >
          <Text style={styles.sendButtonText}>Envoyer le message</Text>
        </TouchableOpacity>
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
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  horizontalList: {
    paddingBottom: 8,
  },
  selectableCard: {
    backgroundColor: '#fff',
    padding: 12,
    marginRight: 12,
    borderRadius: 8,
    minWidth: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  selectedCard: {
    backgroundColor: '#e6f2ff',
    borderColor: '#0066cc',
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  smallLoader: {
    marginVertical: 20,
  },
  messageSection: {
    flex: 1,
  },
  messageInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flex: 1,
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  sendButton: {
    backgroundColor: '#0066cc',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#b3d1ff',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
