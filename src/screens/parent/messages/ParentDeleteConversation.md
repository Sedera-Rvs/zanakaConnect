# Guide d'implémentation de la suppression de conversation pour les parents

## 1. Modifications à apporter au fichier MessagesScreen.js des parents

### 1.1. Ajouter les imports nécessaires

Au début du fichier, ajoutez l'import pour Modal et deleteConversation :

```javascript
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Image,
  SafeAreaView,
  Button,
  Modal, // Ajout de Modal
} from 'react-native';
import { setToken, deleteConversation } from '../../../services/api'; // Ajout de deleteConversation
```

### 1.2. Ajouter les états pour le modal de confirmation

Dans le composant MessagesScreen, ajoutez ces états après les autres états existants :

```javascript
const [confirmModalVisible, setConfirmModalVisible] = useState(false);
const [conversationToDelete, setConversationToDelete] = useState(null);
```

### 1.3. Ajouter la fonction pour gérer la suppression d'une conversation

Ajoutez cette fonction après les autres fonctions, avant le rendu du composant :

```javascript
// Fonction pour gérer la suppression d'une conversation
const handleDeleteConversation = async (conversationId, otherUserName) => {
  console.log(`Début de la suppression de la conversation ${conversationId} avec ${otherUserName}`);
  
  try {
    console.log('Début du processus de suppression...');
    setLoading(true);
    
    // Appeler l'API pour supprimer la conversation
    console.log(`Appel de l'API pour supprimer la conversation ${conversationId}...`);
    const result = await deleteConversation(conversationId);
    console.log(`Résultat de la suppression:`, result);
    
    // Mettre à jour la liste des conversations localement
    setConversations(prevConversations => 
      prevConversations.filter(conv => conv.id !== conversationId)
    );
    setFilteredConversations(prevConversations => 
      prevConversations.filter(conv => conv.id !== conversationId)
    );
    
    console.log(`Conversation ${conversationId} supprimée avec succès`);
    
    // Afficher un message de confirmation
    Alert.alert('Succès', 'La conversation a été supprimée avec succès.');
  } catch (error) {
    console.error('Erreur lors de la suppression de la conversation:', error);
    console.error('Détails de l\'erreur:', error.response?.data || error.message);
    Alert.alert('Erreur', 'Une erreur est survenue lors de la suppression de la conversation. Veuillez réessayer.');
  } finally {
    console.log('Fin du processus de suppression');
    setLoading(false);
  }
};
```

### 1.4. Modifier la fonction renderConversationItem pour ajouter le bouton de suppression

Dans la fonction renderConversationItem, ajoutez la fonction confirmDelete et modifiez le rendu :

```javascript
const renderConversationItem = ({ item }) => {
  // Code existant...
  
  // Fonction pour afficher le modal de confirmation de suppression
  const confirmDelete = () => {
    console.log(`Demande de confirmation pour supprimer la conversation ${item.id}`);
    // Stocker les informations de la conversation à supprimer
    setConversationToDelete({
      id: item.id,
      otherUserName: `${prenom} ${nom}`
    });
    // Afficher le modal de confirmation
    setConfirmModalVisible(true);
  };
  
  return (
    <View style={styles.conversationContainer}>
      <TouchableOpacity 
        style={styles.conversationItem} 
        onPress={() => handleConversationPress(item)}
      >
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {prenom.charAt(0)?.toUpperCase() || '?'}
              {nom.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
          {item.unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={[styles.userName, item.unreadCount > 0 && styles.unreadText]}>
              {prenom} {nom}
            </Text>
            <Text style={styles.timeText}>{formattedDate}</Text>
          </View>
          
          {isEnseignant && specialite && (
            <Text style={styles.specialiteText}>
              {specialite}
            </Text>
          )}
          
          {eleveDetails && (
            <Text style={styles.eleveText}>
              Concernant: {eleveDetails.prenom || ''} {eleveDetails.nom || ''}
            </Text>
          )}
          
          <Text 
            style={[styles.lastMessage, item.unreadCount > 0 && styles.unreadText]} 
            numberOfLines={1}
          >
            {lastMessage ? (lastMessage.text || 'Message vide') : 
             item.dernier_message ? (item.dernier_message.contenu || 'Message vide') : 
             'Pas de message'}
          </Text>
        </View>
        
        {/* Bouton de suppression intégré dans la carte */}
        <TouchableOpacity 
          style={styles.inlineDeleteButton}
          onPress={confirmDelete}
          activeOpacity={0.6}
        >
          <Ionicons name="trash-outline" size={20} color="#e74c3c" />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
};
```

### 1.5. Ajouter le modal de confirmation à la fin du composant

Ajoutez ce code juste avant la dernière balise `</View>` du composant MessagesScreen :

```javascript
{/* Modal de confirmation de suppression */}
<Modal
  animationType="fade"
  transparent={true}
  visible={confirmModalVisible}
  onRequestClose={() => setConfirmModalVisible(false)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.modalContent}>
      <Text style={styles.modalTitle}>Supprimer la conversation</Text>
      
      <Text style={styles.modalText}>
        {
          conversationToDelete 
            ? `Êtes-vous sûr de vouloir supprimer la conversation avec ${conversationToDelete.otherUserName} ?` 
            : 'Voulez-vous supprimer cette conversation ?'
        }
      </Text>
      
      <Text style={styles.modalSubtext}>
        Cette action ne supprimera la conversation que pour vous.
      </Text>
      
      <View style={styles.modalButtons}>
        <TouchableOpacity 
          style={[styles.modalButton, styles.cancelButton]}
          onPress={() => {
            setConfirmModalVisible(false);
            setConversationToDelete(null);
          }}
        >
          <Text style={styles.cancelButtonText}>Annuler</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.modalButton, styles.deleteModalButton]}
          onPress={() => {
            if (conversationToDelete) {
              console.log(`Confirmation de suppression de la conversation ${conversationToDelete.id}`);
              handleDeleteConversation(conversationToDelete.id, conversationToDelete.otherUserName);
              setConfirmModalVisible(false);
              setConversationToDelete(null);
            }
          }}
        >
          <Text style={styles.deleteButtonText}>Supprimer</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>
```

### 1.6. Ajouter les styles pour le bouton de suppression et le modal

Ajoutez ces styles à la fin du StyleSheet.create :

```javascript
conversationContainer: {
  position: 'relative',
  marginHorizontal: 16,
  marginVertical: 8,
},
inlineDeleteButton: {
  position: 'absolute',
  right: 12,
  top: 12,
  width: 36,
  height: 36,
  borderRadius: 18,
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  justifyContent: 'center',
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.2,
  shadowRadius: 1,
  elevation: 2,
  zIndex: 10,
},
modalOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  justifyContent: 'center',
  alignItems: 'center',
  padding: 20,
},
modalContent: {
  backgroundColor: '#fff',
  borderRadius: 12,
  padding: 24,
  width: '100%',
  maxWidth: 400,
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 3.84,
  elevation: 5,
},
modalTitle: {
  fontSize: 20,
  fontWeight: 'bold',
  marginBottom: 16,
  color: '#333',
  textAlign: 'center',
},
modalText: {
  fontSize: 16,
  marginBottom: 12,
  textAlign: 'center',
  color: '#333',
  lineHeight: 22,
},
modalSubtext: {
  fontSize: 14,
  marginBottom: 24,
  textAlign: 'center',
  color: '#666',
  fontStyle: 'italic',
},
modalButtons: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  width: '100%',
  marginTop: 8,
},
modalButton: {
  flex: 1,
  padding: 12,
  borderRadius: 8,
  alignItems: 'center',
  justifyContent: 'center',
  marginHorizontal: 8,
},
cancelButton: {
  backgroundColor: '#f0f0f0',
},
cancelButtonText: {
  color: '#333',
  fontWeight: '600',
  fontSize: 16,
},
deleteModalButton: {
  backgroundColor: '#e74c3c',
},
deleteButtonText: {
  color: '#fff',
  fontWeight: '600',
  fontSize: 16,
},
```

## 2. Erreurs courantes et solutions

### 2.1. Erreur "Unexpected text node"

Si vous rencontrez l'erreur "Unexpected text node: . A text node cannot be a child of a <View>", vérifiez que :

1. Vous n'avez pas de texte libre (non encapsulé dans un composant `<Text>`) à l'intérieur d'un composant `<View>`
2. Tous vos composants JSX sont correctement fermés
3. Il n'y a pas de points ou d'espaces entre les balises JSX

### 2.2. Problème de rendu du bouton de suppression

Si le bouton de suppression n'apparaît pas, vérifiez que :

1. Le style `inlineDeleteButton` est correctement défini
2. La structure JSX est correcte, avec le bouton à l'intérieur du `View` parent
3. L'icône Ionicons est correctement importée et utilisée

## 3. Test de la fonctionnalité

Pour tester la fonctionnalité de suppression :

1. Ouvrez l'application et accédez à l'écran des messages en tant que parent
2. Vérifiez que le bouton de suppression (icône de corbeille) apparaît sur chaque carte de conversation
3. Cliquez sur le bouton de suppression d'une conversation
4. Vérifiez que le modal de confirmation s'affiche correctement
5. Testez les deux options (Annuler et Supprimer)
6. Vérifiez que la conversation est bien supprimée de la liste après confirmation
