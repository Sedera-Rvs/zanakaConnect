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
  Image,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getParentsEleves, startConversationWithParent, checkExistingConversation } from '../../../services/enseignantMessagerieService';
import { useIsFocused } from '@react-navigation/native';

export default function NewMessageScreen({ navigation, route }) {
  const [parents, setParents] = useState([]);
  const [selectedParent, setSelectedParent] = useState(null);
  const [selectedEleve, setSelectedEleve] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredParents, setFilteredParents] = useState([]);
  const isFocused = useIsFocused();

  // Charger les parents des élèves au chargement de l'écran
  useEffect(() => {
    if (isFocused) {
      loadParents();
    }
  }, [isFocused]);

  // Filtrer les parents selon la recherche
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredParents(parents);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = parents.filter(parent => {
        // Recherche dans le nom et prénom du parent
        const parentMatch = 
          parent.nom.toLowerCase().includes(query) || 
          parent.prenom.toLowerCase().includes(query);
        
        // Recherche dans les noms des élèves du parent
        const elevesMatch = parent.eleves.some(eleve => 
          eleve.nom.toLowerCase().includes(query) || 
          eleve.prenom.toLowerCase().includes(query) ||
          (eleve.classe && eleve.classe.toLowerCase().includes(query))
        );
        
        return parentMatch || elevesMatch;
      });
      
      setFilteredParents(filtered);
    }
  }, [searchQuery, parents]);

  // Charger les parents des élèves que l'enseignant enseigne
  const loadParents = async () => {
    try {
      setLoading(true);
      setSelectedParent(null);
      setSelectedEleve(null);
      
      // Récupérer les parents des élèves via l'API
      const response = await getParentsEleves();
      console.log(`${response.length} parents récupérés`);
      
      // Trier les parents par nom
      const sortedParents = [...response].sort((a, b) => {
        if (a.nom !== b.nom) return a.nom.localeCompare(b.nom);
        return a.prenom.localeCompare(b.prenom);
      });
      
      setParents(sortedParents);
      setFilteredParents(sortedParents);
      
      // Vérifier si nous avons des parents à afficher
      if (sortedParents.length === 0) {
        Alert.alert(
          'Information',
          'Aucun parent trouvé pour vos élèves.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (error) {
      console.error('Erreur lors du chargement des parents:', error);
      Alert.alert('Erreur', 'Impossible de charger la liste des parents');
    } finally {
      setLoading(false);
    }
  };

  // Sélectionner un parent
  const handleSelectParent = (parent) => {
    setSelectedParent(parent);
    setSelectedEleve(null); // Réinitialiser l'élève sélectionné
  };

  // Sélectionner un élève du parent sélectionné
  const handleSelectEleve = (eleve) => {
    setSelectedEleve(eleve);
  };

  // Envoyer un message au parent sélectionné concernant l'élève sélectionné
  const handleSendMessage = async () => {
    if (!selectedParent) {
      Alert.alert('Erreur', 'Veuillez sélectionner un parent');
      return;
    }

    if (!selectedEleve) {
      Alert.alert('Erreur', 'Veuillez sélectionner un élève');
      return;
    }

    if (!messageText.trim()) {
      Alert.alert('Erreur', 'Veuillez écrire un message');
      return;
    }

    try {
      setSending(true);
      
      // Vérifier d'abord si une conversation existe déjà avec ce parent
      console.log(`Vérification de l'existence d'une conversation avec le parent ${selectedParent.id}`);
      const existingConversation = await checkExistingConversation(selectedParent.id);
      
      if (existingConversation) {
        console.log(`Conversation existante trouvée avec ID: ${existingConversation.id}`);
        
        // Si une conversation existe déjà, informer l'utilisateur et retourner à la liste des messages
        Alert.alert(
          'Conversation existante',
          `Une conversation existe déjà avec ${selectedParent.prenom} ${selectedParent.nom}. Vous pouvez la retrouver dans votre liste de messages.`,
          [
            {
              text: 'OK',
              onPress: () => {
                // Retourner à la liste des messages
                console.log('Retour à la liste des messages (conversation existante)');
                navigation.navigate('MessagesList');
              }
            }
          ]
        );
        
        return;
      }
      
      // Si aucune conversation n'existe, en créer une nouvelle
      console.log(`Création d'une nouvelle conversation avec le parent ${selectedParent.id} pour l'élève ${selectedEleve.id}`);
      const response = await startConversationWithParent(
        selectedParent.id,
        selectedEleve.id,
        messageText.trim()
      );
      
      console.log('Réponse de la création de conversation:', response);
      
      // Rediriger vers la conversation créée
      if (response) {
        // Ajouter des logs détaillés pour comprendre la structure de la réponse
        console.log('Structure détaillée de la réponse:', JSON.stringify(response));
        
        // Extraire l'ID de la conversation de différentes façons possibles
        let conversationId;
        
        if (response.conversation && typeof response.conversation === 'object' && response.conversation.id) {
          // Si conversation est un objet avec un ID
          conversationId = response.conversation.id;
          console.log(`ID de conversation extrait de response.conversation.id: ${conversationId}`);
        } else if (response.conversation_id) {
          // Si l'API renvoie directement un conversation_id
          conversationId = response.conversation_id;
          console.log(`ID de conversation extrait de response.conversation_id: ${conversationId}`);
        } else if (response.conversation && typeof response.conversation === 'number') {
          // Si conversation est directement l'ID
          conversationId = response.conversation;
          console.log(`ID de conversation extrait de response.conversation (number): ${conversationId}`);
        } else if (response.id) {
          // Si la réponse elle-même a un ID
          conversationId = response.id;
          console.log(`ID de conversation extrait de response.id: ${conversationId}`);
        }
        
        if (!conversationId) {
          console.error('Impossible de trouver l\'ID de la conversation dans la réponse');
          Alert.alert('Erreur', 'Impossible de trouver la conversation créée. Veuillez réessayer.');
          return;
        }
        
        console.log(`ID de conversation final pour la redirection: ${conversationId}`);
        
        // Afficher un message de succès
        Alert.alert(
          'Message envoyé',
          'Votre message a été envoyé avec succès.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Retourner directement à la liste des messages au lieu d'essayer de naviguer vers la conversation
                // Cela permettra à l'utilisateur de voir la nouvelle conversation dans la liste
                console.log('Retour à la liste des messages après création de conversation');
                navigation.navigate('MessagesList');
              }
            }
          ]
        );
      } else {
        console.error('Impossible de trouver les détails de la conversation dans la réponse');
        Alert.alert('Erreur', 'Une erreur est survenue lors de la création de la conversation');
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer le message: ' + (error.message || 'Erreur inconnue'));
    } finally {
      setSending(false);
    }
  };

  const renderEleveItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.selectableCard,
        selectedEleve?.id === item.id && styles.selectedCard,
      ]}
      onPress={() => handleSelectEleve(item)}
    >
      <View style={styles.cardContent}>
        <View style={styles.eleveInfo}>
          <Text style={styles.cardTitle}>
            {item.prenom} {item.nom}
          </Text>
          <Text style={styles.cardSubtitle}>{item.classe.nom}</Text>
        </View>
        {item.parent_details && (
          <View style={styles.parentInfo}>
            <Text style={styles.parentText}>
              Parent: {item.parent_details.prenom} {item.parent_details.nom}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.loadingText}>Chargement des parents...</Text>
        </View>
      ) : (
        <>
          {/* Barre de recherche */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un parent ou un élève..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          
          {/* Étape 1: Sélection du parent */}
          {!selectedParent ? (
            <FlatList
              data={filteredParents}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.parentItem}
                  onPress={() => handleSelectParent(item)}
                >
                  <View style={styles.parentHeader}>
                    <Text style={styles.parentName}>{item.prenom} {item.nom}</Text>
                    {item.has_conversation && (
                      <View style={styles.conversationBadge}>
                        <Text style={styles.conversationBadgeText}>Conversation existante</Text>
                      </View>
                    )}
                  </View>
                  
                  <Text style={styles.parentEleves}>{
                    item.eleves.length === 1 
                      ? '1 élève' 
                      : `${item.eleves.length} élèves`
                  }</Text>
                  
                  <View style={styles.elevesPreview}>
                    {item.eleves.slice(0, 3).map(eleve => (
                      <View key={eleve.id} style={styles.elevePreview}>
                        {eleve.photo ? (
                          <Image source={{ uri: eleve.photo }} style={styles.elevePhoto} />
                        ) : (
                          <View style={styles.elevePhotoPlaceholder}>
                            <Text style={styles.elevePhotoPlaceholderText}>
                              {eleve.prenom.charAt(0)}{eleve.nom.charAt(0)}
                            </Text>
                          </View>
                        )}
                        <Text style={styles.elevePreviewName}>{eleve.prenom} {eleve.nom}</Text>
                        <Text style={styles.elevePreviewClasse}>{eleve.classe}</Text>
                      </View>
                    ))}
                    {item.eleves.length > 3 && (
                      <View style={styles.moreEleves}>
                        <Text style={styles.moreElevesText}>+{item.eleves.length - 3}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    {searchQuery ? 'Aucun parent trouvé pour cette recherche' : 'Aucun parent disponible'}
                  </Text>
                </View>
              }
            />
          ) : (
            <>
              {/* En-tête avec le parent sélectionné */}
              <View style={styles.selectedParentHeader}>
                <TouchableOpacity 
                  style={styles.backButton}
                  onPress={() => setSelectedParent(null)}
                >
                  <Ionicons name="arrow-back" size={24} color="#0066cc" />
                </TouchableOpacity>
                <Text style={styles.selectedParentName}>{selectedParent.prenom} {selectedParent.nom}</Text>
              </View>
              
              {/* Étape 2: Sélection de l'élève */}
              <Text style={styles.sectionTitle}>Sélectionnez un élève:</Text>
              <ScrollView style={styles.elevesContainer}>
                {selectedParent.eleves.map(eleve => (
                  <TouchableOpacity
                    key={eleve.id}
                    style={[styles.eleveItem, selectedEleve?.id === eleve.id && styles.selectedEleveItem]}
                    onPress={() => handleSelectEleve(eleve)}
                  >
                    <View style={styles.eleveRow}>
                      {eleve.photo ? (
                        <Image source={{ uri: eleve.photo }} style={styles.elevePhoto} />
                      ) : (
                        <View style={styles.elevePhotoPlaceholder}>
                          <Text style={styles.elevePhotoPlaceholderText}>
                            {eleve.prenom.charAt(0)}{eleve.nom.charAt(0)}
                          </Text>
                        </View>
                      )}
                      <View style={styles.eleveInfo}>
                        <Text style={styles.eleveName}>{eleve.prenom} {eleve.nom}</Text>
                        <Text style={styles.eleveClasse}>{eleve.classe}</Text>
                      </View>
                      {selectedEleve?.id === eleve.id && (
                        <Ionicons name="checkmark-circle" size={24} color="#0066cc" />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              
              {/* Étape 3: Saisie du message */}
              <View style={styles.messageContainer}>
                <TextInput
                  style={styles.messageInput}
                  placeholder={selectedEleve ? `Écrire un message concernant ${selectedEleve.prenom}...` : "Sélectionnez un élève pour envoyer un message..."}
                  value={messageText}
                  onChangeText={setMessageText}
                  multiline
                  editable={!!selectedEleve}
                />
                <TouchableOpacity
                  style={[styles.sendButton, (!selectedEleve || !messageText.trim() || sending) ? styles.sendButtonDisabled : {}]}
                  onPress={handleSendMessage}
                  disabled={!selectedEleve || !messageText.trim() || sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="send" size={24} color={!selectedEleve || !messageText.trim() ? '#999' : '#fff'} />
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingBottom: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    margin: 10,
    paddingHorizontal: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  // Styles pour les items parents
  parentItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginHorizontal: 10,
    marginVertical: 5,
    padding: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  parentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  parentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  conversationBadge: {
    backgroundColor: '#e6f7ff',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  conversationBadgeText: {
    fontSize: 12,
    color: '#0066cc',
  },
  parentEleves: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  elevesPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  elevePreview: {
    width: '30%',
    marginRight: '3%',
    marginBottom: 10,
    alignItems: 'center',
  },
  elevePhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 5,
  },
  elevePhotoPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  elevePhotoPlaceholderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  elevePreviewName: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 2,
  },
  elevePreviewClasse: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  moreEleves: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  moreElevesText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },
  // Styles pour l'écran après sélection d'un parent
  selectedParentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 10,
  },
  selectedParentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    marginTop: 15,
    marginBottom: 10,
    marginLeft: 15,
  },
  elevesContainer: {
    flex: 1,
    marginBottom: 10,
  },
  eleveItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginHorizontal: 10,
    marginVertical: 5,
    padding: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedEleveItem: {
    backgroundColor: '#e6f7ff',
    borderColor: '#0066cc',
    borderWidth: 1,
  },
  eleveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 8,
  },
  eleveInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  eleveName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  eleveClasse: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
  },
  // Styles pour la zone de message
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#0066cc',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  // Styles pour les messages vides
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  // Styles pour les éléments de la liste (compatibilité)
  selectableCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginHorizontal: 10,
    marginVertical: 5,
    padding: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  selectedCard: {
    backgroundColor: '#e6f7ff',
    borderColor: '#0066cc',
    borderWidth: 1,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 3,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  parentText: {
    fontSize: 14,
    color: '#0066cc',
  },
  sectionContainer: {
    flex: 1,
    padding: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    margin: 10,
    color: '#333',
  },
  listContainer: {
    paddingBottom: 20,
  },
  selectableCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  selectedCard: {
    backgroundColor: '#e6f2ff',
    borderWidth: 1,
    borderColor: '#0056b3',
  },
  cardContent: {
    flexDirection: 'column',
  },
  eleveInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  parentInfo: {
    marginTop: 5,
  },
  parentText: {
    fontSize: 14,
    color: '#0056b3',
    fontStyle: 'italic',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    fontSize: 16,
    maxHeight: 120,
  },
  sendButton: {
    backgroundColor: '#0056b3',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  loader: {
    marginTop: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
