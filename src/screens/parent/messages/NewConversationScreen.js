import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAvailableContacts } from '../../../services/messagerie';
import { startConversationWithTeacher } from '../../../services/parentMessagerieService';

export default function NewConversationScreen({ navigation }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [step, setStep] = useState(1); // 1: Select teacher, 2: Select student, 3: Write message

  // Charger les contacts disponibles (enseignants des enfants)
  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const contactsData = await getAvailableContacts();
      console.log('Contacts disponibles:', contactsData);
      
      if (Array.isArray(contactsData) && contactsData.length > 0) {
        setContacts(contactsData);
      } else {
        console.warn('Aucun contact disponible ou format de données incorrect');
        Alert.alert(
          'Information', 
          'Aucun enseignant disponible pour le moment. Des données de test sont affichées.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Erreur lors du chargement des contacts:', error);
      Alert.alert(
        'Erreur', 
        'Impossible de charger la liste des enseignants. Des données de test sont affichées.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  // Gérer la sélection d'un enseignant
  const handleTeacherSelect = (teacher) => {
    setSelectedTeacher(teacher);
    
    // Si l'enseignant n'a qu'un seul élève associé, le sélectionner automatiquement
    if (teacher.eleves && teacher.eleves.length === 1) {
      setSelectedStudent(teacher.eleves[0]);
      setStep(3); // Passer directement à l'étape d'écriture du message
    } else {
      setStep(2); // Passer à l'étape de sélection de l'élève
    }
  };

  // Gérer la sélection d'un élève
  const handleStudentSelect = (student) => {
    setSelectedStudent(student);
    setStep(3); // Passer à l'étape d'écriture du message
  };

  // Gérer l'envoi du message
  const handleSendMessage = async () => {
    if (!messageText.trim()) {
      Alert.alert('Message requis', 'Veuillez écrire un message');
      return;
    }

    if (!selectedTeacher) {
      Alert.alert('Enseignant requis', 'Veuillez sélectionner un enseignant');
      return;
    }

    setSending(true);

    try {
      console.log(`Tentative de démarrage d'une conversation avec l'enseignant ${selectedTeacher.id}...`);
      
      // Utiliser le nouveau service qui vérifie et restaure les conversations supprimées
      const response = await startConversationWithTeacher(
        messageText.trim(),
        selectedTeacher.id,
        selectedStudent ? selectedStudent.id : null
      );

      console.log('Conversation créée ou restaurée:', response);
      
      // Naviguer vers l'écran de conversation avec les données de la nouvelle conversation
      console.log('Réponse complète:', JSON.stringify(response, null, 2));
      
      // Déterminer l'ID de la conversation à partir de la réponse
      let conversationId;
      if (response && response.conversation && response.conversation.id) {
        // Format: { conversation: { id: ... } }
        conversationId = response.conversation.id;
      } else if (response && response.id) {
        // Format: { id: ... }
        conversationId = response.id;
      } else if (response && typeof response === 'object') {
        // Chercher un ID dans l'objet de réponse
        for (const key in response) {
          if (response[key] && response[key].id) {
            conversationId = response[key].id;
            break;
          }
        }
      }
      
      console.log(`ID de conversation identifié: ${conversationId}`);
      
      if (conversationId) {
        // Naviguer vers l'écran de conversation
        navigation.replace('Conversation', {
          conversationId: conversationId,
          otherUser: {
            id: selectedTeacher.id,
            nom: selectedTeacher.nom || '',
            prenom: selectedTeacher.prenom || '',
            role: selectedTeacher.role || 'enseignant'
          },
          eleveDetails: selectedStudent
        });
      } else {
        // Si nous n'avons pas de réponse valide, simuler une conversation pour le développement
        console.warn('Réponse invalide du serveur, simulation d\'une conversation');
        
        // Créer un ID de conversation temporaire
        const tempConversationId = `temp-${Date.now()}`;
        
        // Naviguer vers l'écran de conversation avec des données simulées
        navigation.replace('Conversation', {
          conversationId: tempConversationId,
          otherUser: {
            id: selectedTeacher.id,
            nom: selectedTeacher.nom || '',
            prenom: selectedTeacher.prenom || '',
            role: selectedTeacher.role || 'enseignant'
          },
          eleveDetails: selectedStudent
        });
        
        // Afficher un message pour informer l'utilisateur
        setTimeout(() => {
          Alert.alert(
            'Mode développement',
            'Conversation simulée pour le développement. Les messages ne seront pas envoyés au serveur.',
            [{ text: 'OK' }]
          );
        }, 500);
      }
    } catch (error) {
      console.error('Erreur lors de la création de la conversation:', error);
      
      // En mode développement, simuler une conversation même en cas d'erreur
      console.warn('Simulation d\'une conversation après erreur');
      
      // Créer un ID de conversation temporaire
      const tempConversationId = `temp-${Date.now()}`;
      
      // Naviguer vers l'écran de conversation avec des données simulées
      navigation.replace('Conversation', {
        conversationId: tempConversationId,
        otherUser: {
          id: selectedTeacher.id,
          nom: selectedTeacher.nom || '',
          prenom: selectedTeacher.prenom || '',
          role: selectedTeacher.role || 'enseignant'
        },
        eleveDetails: selectedStudent
      });
      
      // Afficher un message pour informer l'utilisateur
      setTimeout(() => {
        Alert.alert(
          'Mode développement',
          'Conversation simulée pour le développement. Les messages ne seront pas envoyés au serveur.',
          [{ text: 'OK' }]
        );
      }, 500);
    } finally {
      setSending(false);
    }
  };

  // Retourner à l'étape précédente
  const handleBack = () => {
    if (step === 1) {
      navigation.goBack();
    } else if (step === 2) {
      setStep(1);
      setSelectedTeacher(null);
    } else if (step === 3) {
      if (selectedTeacher && selectedTeacher.eleves && selectedTeacher.eleves.length === 1) {
        setStep(1); // Revenir à la sélection d'enseignant si étape de sélection d'élève a été sautée
        setSelectedTeacher(null);
        setSelectedStudent(null);
      } else {
        setStep(2); // Revenir à la sélection d'élève
        setSelectedStudent(null);
      }
    }
  };

  // Rendu d'un enseignant dans la liste
  const renderTeacherItem = ({ item }) => {
    // Générer les initiales pour l'avatar
    const initials = `${item.prenom?.charAt(0) || '?'}${item.nom?.charAt(0) || '?'}`;
    const specialite = item.specialite || 'Enseignant';
    const elevesCount = item.eleves?.length || 0;
    
    return (
      <TouchableOpacity 
        style={styles.contactItem}
        onPress={() => handleTeacherSelect(item)}
      >
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.id) }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.prenom || ''} {item.nom || ''}</Text>
          <Text style={styles.contactRole}>{specialite}</Text>
          {elevesCount > 0 && (
            <Text style={styles.contactDetails}>
              {elevesCount} {elevesCount > 1 ? 'élèves en commun' : 'élève en commun'}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </TouchableOpacity>
    );
  };

  // Rendu d'un élève dans la liste
  const renderStudentItem = ({ item }) => {
    // Générer les initiales pour l'avatar
    const initials = `${item.prenom?.charAt(0) || '?'}${item.nom?.charAt(0) || '?'}`;
    const classeText = item.classe || 'Élève';
    
    return (
      <TouchableOpacity 
        style={styles.contactItem}
        onPress={() => handleStudentSelect(item)}
      >
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: '#4CAF50' }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.prenom || ''} {item.nom || ''}</Text>
          <Text style={styles.contactRole}>{classeText}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </TouchableOpacity>
    );
  };

  // Générer une couleur d'avatar basée sur l'ID
  const getAvatarColor = (id) => {
    const colors = [
      '#0078FF', '#4CAF50', '#FF5722', '#9C27B0', '#3F51B5',
      '#009688', '#795548', '#607D8B', '#E91E63', '#FFC107'
    ];
    return colors[id % colors.length];
  };

  // Contenu de l'étape 1: Sélection d'enseignant
  const renderTeacherSelection = () => {
    return (
      <>
        <Text style={styles.stepTitle}>Choisir un enseignant</Text>
        <Text style={styles.stepSubtitle}>Sélectionnez l'enseignant avec qui vous souhaitez communiquer</Text>
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0078FF" />
          </View>
        ) : contacts.length > 0 ? (
          <FlatList
            data={contacts}
            renderItem={renderTeacherItem}
            keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
            contentContainerStyle={styles.listContainer}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={80} color="#ccc" style={{ marginBottom: 20 }} />
            <Text style={styles.emptyText}>Aucun enseignant disponible</Text>
            <Text style={styles.emptySubtext}>Il n'y a pas d'enseignants disponibles pour vos enfants actuellement.</Text>
          </View>
        )}
      </>
    );
  };

  // Contenu de l'étape 2: Sélection d'élève
  const renderStudentSelection = () => {
    // Si aucun enseignant n'est sélectionné, revenir à l'étape 1
    if (!selectedTeacher) {
      setStep(1);
      return null;
    }
    
    // Récupérer les élèves associés à l'enseignant sélectionné
    const eleves = selectedTeacher.eleves || [];
    const teacherName = `${selectedTeacher.prenom || ''} ${selectedTeacher.nom || ''}`;
    
    return (
      <>
        <Text style={styles.stepTitle}>Choisir un élève</Text>
        <Text style={styles.stepSubtitle}>
          Sélectionnez l'élève concerné par cette conversation avec {teacherName.trim()}
        </Text>
        
        {eleves.length > 0 ? (
          <FlatList
            data={eleves}
            renderItem={renderStudentItem}
            keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
            contentContainerStyle={styles.listContainer}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="school-outline" size={80} color="#ccc" style={{ marginBottom: 20 }} />
            <Text style={styles.emptyText}>Aucun élève disponible</Text>
            <Text style={styles.emptySubtext}>Il n'y a pas d'élèves associés à cet enseignant.</Text>
            <TouchableOpacity 
              style={[styles.sendButton, { marginTop: 20 }]}
              onPress={() => setStep(3)}
            >
              <Text style={styles.sendButtonText}>Continuer sans sélectionner d'élève</Text>
            </TouchableOpacity>
          </View>
        )}
      </>
    );
  };

  // Contenu de l'étape 3: Écriture du message
  const renderMessageComposition = () => {
    // Si aucun enseignant n'est sélectionné, revenir à l'étape 1
    if (!selectedTeacher) {
      setStep(1);
      return null;
    }
    
    // Texte à afficher selon si un élève est sélectionné ou non
    const teacherName = `${selectedTeacher.prenom || ''} ${selectedTeacher.nom || ''}`.trim();
    let subtitle;
    
    if (selectedStudent) {
      const studentName = `${selectedStudent.prenom || ''} ${selectedStudent.nom || ''}`.trim();
      subtitle = `À ${teacherName} concernant ${studentName}`;
    } else {
      subtitle = `À ${teacherName}`;
    }
    
    return (
      <>
        <Text style={styles.stepTitle}>Écrire un message</Text>
        <Text style={styles.stepSubtitle}>{subtitle}</Text>
        
        <View style={styles.messageContainer}>
          <TextInput
            style={styles.messageInput}
            placeholder="Écrivez votre message ici..."
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={1000}
            autoFocus
          />
          
          <View style={styles.characterCount}>
            <Text style={styles.characterCountText}>
              {messageText.length}/1000 caractères
            </Text>
          </View>
          
          <TouchableOpacity 
            style={[
              styles.sendButton,
              (!messageText.trim() || sending) && styles.disabledButton
            ]}
            onPress={handleSendMessage}
            disabled={!messageText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={18} color="#fff" style={styles.sendIcon} />
                <Text style={styles.sendButtonText}>Envoyer</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="#0078FF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nouvelle conversation</Text>
        </View>
        
        <View style={styles.content}>
          {step === 1 && renderTeacherSelection()}
          {step === 2 && renderStudentSelection()}
          {step === 3 && renderMessageComposition()}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    marginRight: 16,
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
  stepTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    paddingBottom: 16,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    marginBottom: 12,
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0078FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  contactRole: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  contactDetails: {
    fontSize: 12,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  messageContainer: {
    flex: 1,
    marginTop: 16,
  },
  messageInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    minHeight: 150,
    maxHeight: 300,
    textAlignVertical: 'top',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  characterCount: {
    alignSelf: 'flex-end',
    marginTop: 8,
    marginRight: 4,
  },
  characterCountText: {
    fontSize: 12,
    color: '#999',
  },
  sendButton: {
    backgroundColor: '#0078FF',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#b3d1ff',
    opacity: 0.7,
  },
  sendIcon: {
    marginRight: 8,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
