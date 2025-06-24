import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { getStudents, addGrade, editGrade, deleteNote, getMatieres, getMatieresEnseignant, getBulletinEleve } from '../../../services/api';

export default function AddNoteScreen({ route, navigation }) {
  // S'assurer que route.params existe pour éviter les erreurs
  const params = route.params || {};
  const { classeId, className, matiereId, matiereName } = params;
  
  console.log('AddNoteScreen - Paramètres reçus:', params);
  
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]); // État pour les élèves filtrés
  const [loading, setLoading] = useState(true);
  const [loadingMatieres, setLoadingMatieres] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [note, setNote] = useState('');
  const [matiere, setMatiere] = useState(null);
  const [matieres, setMatieres] = useState([]);
  const [bulletinModalVisible, setBulletinModalVisible] = useState(false);
  const [bulletinData, setBulletinData] = useState([]);
  const [loadingBulletin, setLoadingBulletin] = useState(false);
  const [selectedMatiereOnly, setSelectedMatiereOnly] = useState(!!matiereId);
  const [editingNote, setEditingNote] = useState(null);
  const [editNoteModalVisible, setEditNoteModalVisible] = useState(false);
  const [editNoteValue, setEditNoteValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false); // État pour désactiver le bouton pendant la soumission
  const [confirmModalVisible, setConfirmModalVisible] = useState(false); // État pour la boîte de confirmation
  const [noteToDelete, setNoteToDelete] = useState(null); // Note à supprimer
  const [deletingNoteId, setDeletingNoteId] = useState(null); // ID de la note en cours de suppression
  const [noteType, setNoteType] = useState('test'); // Type de note (test ou examen)
  const [trimestre, setTrimestre] = useState(null); // Trimestre pour les examens
  const [searchQuery, setSearchQuery] = useState(''); // État pour la recherche d'élèves

  useEffect(() => {
    if (classeId) {
      loadStudents();
    }
    loadMatieres();
  }, []);

  // Effet pour filtrer les élèves selon la recherche
  useEffect(() => {
    if (students.length > 0) {
      const filtered = students.filter(student =>
        `${student.prenom} ${student.nom}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase().trim())
      );
      setFilteredStudents(filtered);
    } else {
      setFilteredStudents([]);
    }
  }, [searchQuery, students]);

  // Si une matière spécifique est sélectionnée, la définir comme matière active
  useEffect(() => {
    if (matiereId && matieres && matieres.length > 0) {
      console.log('Recherche de la matière avec ID:', matiereId, 'dans', matieres);
      // Convertir matiereId en nombre si c'est une chaîne
      const matiereIdNum = typeof matiereId === 'string' ? parseInt(matiereId, 10) : matiereId;
      console.log('ID de matière converti en nombre:', matiereIdNum);
      
      // Vérifier que l'ID est un nombre valide
      if (!isNaN(matiereIdNum)) {
        const selectedMatiere = matieres.find(m => m.id === matiereIdNum);
        console.log('Matière trouvée:', selectedMatiere);
        if (selectedMatiere) {
          setMatiere(selectedMatiere);
          setSelectedMatiereOnly(true);
        } else {
          console.log('Matière non trouvée dans la liste des matières disponibles');
        }
      } else {
        console.log('ID de matière invalide:', matiereId);
      }
    }
  }, [matiereId, matieres]);

  const loadStudents = async () => {
    try {
      setLoading(true);
      // Charger les élèves depuis l'API
      const response = await getStudents(classeId);
      setStudents(response);
    } catch (error) {
      console.error('Erreur lors du chargement des élèves:', error);
      Alert.alert('Erreur', 'Impossible de charger la liste des élèves');
    } finally {
      setLoading(false);
    }
  };
  
  const loadMatieres = async () => {
    try {
      setLoadingMatieres(true);
      // Charger uniquement les matières enseignées par l'enseignant connecté
      const response = await getMatieresEnseignant();
      console.log('Réponse API getMatieresEnseignant:', response);
      console.log('Type de réponse:', typeof response);
      console.log('Est-ce un tableau?', Array.isArray(response));
      
      if (Array.isArray(response) && response.length > 0) {
        console.log('Première matière:', response[0]);
        console.log('ID de la première matière:', response[0].id);
        console.log('Nom de la première matière:', response[0].nom);
      } else {
        console.log('Aucune matière trouvée ou format incorrect');
      }
      
      setMatieres(response);
    } catch (error) {
      console.error('Erreur lors du chargement des matières:', error);
      Alert.alert('Erreur', 'Impossible de charger la liste des matières');
    } finally {
      setLoadingMatieres(false);
    }
  };
  
  const loadBulletin = async (studentId) => {
    try {
      setLoadingBulletin(true);
      console.log('Chargement du bulletin pour l\'élève ID:', studentId);
      
      // Charger les notes de l'élève depuis l'API en s'assurant que nous avons les dernières notes
      const response = await getBulletinEleve(studentId);
      console.log(`Reçu ${response.length} notes pour l'élève ${studentId}`);
      
      // Vérifier que les notes appartiennent bien à cet élève
      const filteredNotes = response.filter(note => note.eleve.toString() === studentId.toString());
      console.log(`Après filtrage: ${filteredNotes.length} notes pour l'élève ${studentId}`);
      
      // Mettre à jour l'affichage avec les notes filtrées
      setBulletinData(filteredNotes);
      setBulletinModalVisible(true);
    } catch (error) {
      console.error('Erreur lors du chargement du bulletin:', error);
      Alert.alert('Erreur', 'Impossible de charger le bulletin de l\'élève');
    } finally {
      setLoadingBulletin(false);
    }
  };

  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
  };

  const handleSelectMatiere = (selectedMatiere) => {
    setMatiere(selectedMatiere);
  };
  
  const handleViewBulletin = (student) => {
    loadBulletin(student.id);
  };

  const handleSubmit = () => {
    // Vérification des données obligatoires
    if (!selectedStudent) {
      Alert.alert('Erreur', 'Veuillez sélectionner un élève');
      return;
    }
    
    if (!matiere) {
      Alert.alert('Erreur', 'Veuillez sélectionner une matière');
      return;
    }
    
    if (!note || isNaN(parseFloat(note))) {
      Alert.alert('Erreur', 'Veuillez entrer une note valide');
      return;
    }
    
    const noteValue = parseFloat(note);
    if (noteValue < 0 || noteValue > 20) {
      Alert.alert('Erreur', 'La note doit être comprise entre 0 et 20');
      return;
    }
    
    // Validation spécifique pour les examens
    if (noteType === 'examen' && !trimestre) {
      Alert.alert('Erreur', 'Veuillez sélectionner un trimestre pour cet examen');
      return;
    }
    
    // Préparer les données pour l'API
    const noteData = {
      note: noteValue,
      matiere: matiere.id,
      type: noteType,
      trimestre: noteType === 'examen' ? trimestre : null,
    };
    
    // Désactiver le bouton pendant l'ajout pour éviter les doublons
    setIsSubmitting(true);
    console.log('Début de l\'ajout de note');
    
    // Utiliser une fonction auto-exécutée pour l'async/await
    (async () => {
      try {
        console.log('Envoi de la note à l\'API:', noteData);
        
        // Envoyer la note à l'API
        const result = await addGrade(selectedStudent.id, noteData);
        console.log('Résultat de l\'ajout:', result);
        
        // Réinitialiser la note mais pas la matière
        setNote('');
        
        // Afficher le message de succès - NE PAS UTILISER setTimeout ICI
        Alert.alert(
          'Succès',
          `Note de ${noteValue}/20 ajoutée pour ${selectedStudent.prenom} ${selectedStudent.nom} en ${matiere.nom}\n\nCoefficient de la matière: ${matiere.coefficient}`,
          [
            { 
              text: 'Voir le bulletin', 
              onPress: async () => {
                try {
                  // Charger et afficher le bulletin de l'élève
                  await loadBulletin(selectedStudent.id);
                } catch (e) {
                  console.error('Erreur lors du chargement du bulletin:', e);
                  Alert.alert('Erreur', 'Impossible de charger le bulletin');
                }
              }
            },
            { 
              text: 'OK', 
              onPress: async () => {
                // Recharger le bulletin si déjà ouvert
                if (bulletinModalVisible && selectedStudent) {
                  try {
                    await loadBulletin(selectedStudent.id);
                  } catch (e) {
                    console.error('Erreur lors du rechargement du bulletin:', e);
                  }
                }
              },
              style: 'default'
            }
          ]
        );
      } catch (error) {
        console.error('Erreur lors de l\'ajout de la note:', error);
        Alert.alert('Erreur', 'Impossible d\'ajouter la note: ' + (error.response?.data?.detail || error.message));
      } finally {
        // Réactiver le bouton quoi qu'il arrive
        setIsSubmitting(false);
      }
    })();
  };

  const renderStudentItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.studentCard,
        selectedStudent?.id === item.id && styles.selectedStudentCard,
      ]}
      onPress={() => handleSelectStudent(item)}
    >
      <Text style={styles.studentName}>
        {item.prenom} {item.nom}
      </Text>
      <TouchableOpacity
        style={styles.bulletinButton}
        onPress={() => handleViewBulletin(item)}
      >
        <Text style={styles.bulletinButtonText}>Bulletin</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderMatiereItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.matiereCard,
        matiere?.id === item.id && styles.selectedMatiereCard,
      ]}
      onPress={() => handleSelectMatiere(item)}
    >
      <Text style={styles.matiereName}>{item.nom}</Text>
      <Text style={styles.matiereCoef}>Coef. {item.coefficient}</Text>
    </TouchableOpacity>
  );
  
  // Vérifier si l'enseignant enseigne cette matière
  const isTeachingMatiere = (matiereId) => {
    return matieres.some(m => m.id === matiereId);
  };

  // Gérer l'édition d'une note
  const handleEditNote = (note) => {
    setEditingNote(note);
    setEditNoteValue(note.note.toString());
    setEditNoteModalVisible(true);
  };

  // Sauvegarder la note modifiée
  const saveEditedNote = async () => {
    if (!editingNote) return;
    
    const noteValue = parseFloat(editNoteValue);
    if (isNaN(noteValue) || noteValue < 0 || noteValue > 20) {
      Alert.alert('Erreur', 'La note doit être un nombre entre 0 et 20');
      return;
    }
    
    try {
      await editGrade(editingNote.id, { note: noteValue });
      setEditNoteModalVisible(false);
      setEditingNote(null);
      setEditNoteValue('');
      
      // Recharger le bulletin
      if (selectedStudent) {
        loadBulletin(selectedStudent.id);
      }
      
      Alert.alert('Succès', 'La note a été modifiée avec succès');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de modifier la note: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Supprimer une note
  const handleDeleteNote = (note) => {
    console.log('handleDeleteNote - note:', note);
    
    // Vérifier que la note est valide avant de tenter de la supprimer
    if (!note || !note.id) {
      console.error('Erreur: note invalide pour la suppression', note);
      Alert.alert('Erreur', 'Impossible de supprimer cette note: données invalides');
      return;
    }
    
    // Stocker la note à supprimer et afficher la boîte de confirmation
    setNoteToDelete(note);
    setConfirmModalVisible(true);
  };
  
  // Fonction pour effectuer la suppression après confirmation
  const confirmDeleteNote = async () => {
    if (!noteToDelete) return;
    
    try {
      // Garder une copie des notes actuelles au cas où on aurait besoin de les restaurer
      const notesAvantSuppression = [...bulletinData];
      
      // Indiquer quelle note est en cours de suppression
      setDeletingNoteId(noteToDelete.id);
      console.log(`Suppression de la note ${noteToDelete.id}...`);
      
      // IMPORTANT: Supprimer la note de l'interface AVANT même d'appeler l'API
      // Cela garantit que l'utilisateur voit la note disparaître immédiatement
      setBulletinData(prevNotes => prevNotes.filter(n => n.id !== noteToDelete.id));
      
      // Fermer le modal de confirmation
      setConfirmModalVisible(false);
      
      // Appeler l'API pour supprimer la note du backend
      const result = await deleteNote(noteToDelete.id);
      console.log(`Résultat de la suppression:`, result);
      
      if (result && result.success) {
        // Afficher un message de confirmation
        Alert.alert('Succès', 'La note a été supprimée avec succès.');
        
        // Attendre un court instant puis recharger le bulletin
        // pour s'assurer qu'il est synchronisé avec le backend
        setTimeout(() => {
          if (selectedStudent) {
            loadBulletin(selectedStudent.id);
          }
        }, 500);
      } else {
        // En cas d'erreur, restaurer les notes dans le bulletin
        setBulletinData(notesAvantSuppression);
        
        // Afficher le message d'erreur
        Alert.alert('Erreur', result.message || 'Une erreur est survenue lors de la suppression');
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      
      // En cas d'erreur, restaurer la note dans le bulletin
      setBulletinData([...bulletinData]);
      
      // Afficher le message d'erreur
      const errorMessage = error.message || 'Une erreur est survenue lors de la suppression';
      Alert.alert('Erreur', `Impossible de supprimer la note: ${errorMessage}`);
    } finally {
      // Réinitialiser l'ID de la note en cours de suppression
      setDeletingNoteId(null);
      setNoteToDelete(null);
    }
  };

  const renderBulletinItem = ({ item }) => {
    // Trouver la matière correspondante pour afficher le coefficient
    const matiereInfo = matieres.find(m => m.id === item.matiere) || { nom: 'Inconnue', coefficient: 1 };
    const canEditDelete = isTeachingMatiere(item.matiere);
    
    // Déterminer le type de note et le trimestre à afficher
    const noteType = item.type || 'test';
    const noteTypeDisplay = noteType === 'examen' ? 'Examen' : 'Test';
    const trimestreDisplay = item.trimestre ? `Trimestre ${item.trimestre}` : '';
    
    // Style conditionnel selon le type de note
    const noteTypeStyle = noteType === 'examen' ? styles.examLabel : styles.testLabel;
    
    return (
      <View style={[styles.bulletinItem, canEditDelete && styles.bulletinItemEditable]}>
        <View style={styles.bulletinItemHeader}>
          <Text style={styles.bulletinMatiere}>{matiereInfo.nom}</Text>
          <Text style={styles.bulletinCoef}>Coef. {matiereInfo.coefficient}</Text>
        </View>
        <View style={styles.bulletinItemContent}>
          <View style={styles.bulletinInfoRow}>
            <Text style={styles.bulletinNote}>{item.note}/20</Text>
            <Text style={styles.bulletinDate}>{new Date(item.date).toLocaleDateString()}</Text>
          </View>
          
          <View style={styles.bulletinInfoRow}>
            <View style={styles.typeContainer}>
              <Text style={noteTypeStyle}>{noteTypeDisplay}</Text>
              {noteType === 'examen' && item.trimestre && (
                <Text style={styles.trimestreLabel}>{trimestreDisplay}</Text>
              )}
            </View>
            
            {canEditDelete && (
              <View style={styles.bulletinActions}>
                <TouchableOpacity 
                  style={styles.bulletinEditButton}
                  onPress={() => handleEditNote(item)}
                >
                  <Text style={styles.bulletinActionText}>Modifier</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.bulletinDeleteButton}
                  onPress={() => handleDeleteNote(item)}
                >
                  <Text style={styles.bulletinActionText}>Supprimer</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };
  
  const calculateAverage = () => {
    if (!bulletinData || bulletinData.length === 0) return 'N/A';
    
    let totalPoints = 0;
    let totalCoef = 0;
    
    bulletinData.forEach(note => {
      const matiereInfo = matieres.find(m => m.id === note.matiere) || { coefficient: 1 };
      totalPoints += note.note * matiereInfo.coefficient;
      totalCoef += parseFloat(matiereInfo.coefficient);
    });
    
    return totalCoef > 0 ? (totalPoints / totalCoef).toFixed(2) : 'N/A';
  };

  if ((classeId && loading) || loadingMatieres) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {matiereId ? (
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>Notes de {matiereName}</Text>
          <Text style={styles.headerSubtitle}>Coefficient: {matiere?.coefficient || '-'}</Text>
          {!classeId && (
            <Text style={styles.headerInfo}>Sélectionnez un élève dans une classe pour ajouter une note</Text>
          )}
        </View>
      ) : (
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>Classe: {className || 'Nouvelle note'}</Text>
          {!classeId && (
            <Text style={styles.headerInfo}>Sélectionnez une classe pour voir les élèves</Text>
          )}
        </View>
      )}
      
      {classeId ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sélectionnez un élève</Text>
          
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un élève..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
          </View>

          <FlatList
            data={filteredStudents.length > 0 ? filteredStudents : students}
            renderItem={renderStudentItem}
            keyExtractor={(item) => item.id.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.studentsList}
            ListEmptyComponent={() => (
              <View style={styles.emptySearchContainer}>
                <Text style={styles.emptySearchText}>
                  {searchQuery ? "Aucun élève trouvé" : "Aucun élève dans cette classe"}
                </Text>
              </View>
            )}
          />
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sélectionnez une classe</Text>
          <TouchableOpacity 
            style={styles.selectClassButton}
            onPress={() => navigation.navigate('Notes')}
          >
            <Text style={styles.selectClassButtonText}>Choisir une classe</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{selectedMatiereOnly ? 'Matière sélectionnée' : 'Sélectionnez une matière'}</Text>
        {selectedMatiereOnly && matiere ? (
          <View style={styles.selectedMatiereContainer}>
            <Text style={styles.selectedMatiereName}>{matiere.nom}</Text>
            <Text style={styles.selectedMatiereCoef}>Coefficient: {matiere.coefficient}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.debugText}>Nombre de matières: {matieres ? matieres.length : 'undefined'}</Text>
            {matieres && matieres.length > 0 ? (
              <FlatList
                data={matieres}
                renderItem={renderMatiereItem}
                keyExtractor={(item) => item.id.toString()}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.matieresList}
              />
            ) : (
              <View style={styles.emptyMatieres}>
                <Text style={styles.emptyMatieresText}>Aucune matière disponible</Text>
              </View>
            )}
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Type de note</Text>
        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[styles.typeButton, noteType === 'test' && styles.selectedTypeButton]}
            onPress={() => {
              setNoteType('test');
              setTrimestre(null); // Réinitialiser le trimestre si on revient à test
            }}
          >
            <Text style={[styles.typeButtonText, noteType === 'test' && styles.selectedTypeText]}>Test</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, noteType === 'examen' && styles.selectedTypeButton]}
            onPress={() => setNoteType('examen')}
          >
            <Text style={[styles.typeButtonText, noteType === 'examen' && styles.selectedTypeText]}>Examen</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {noteType === 'examen' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trimestre</Text>
          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[styles.typeButton, trimestre === 1 && styles.selectedTypeButton]}
              onPress={() => setTrimestre(1)}
            >
              <Text style={[styles.typeButtonText, trimestre === 1 && styles.selectedTypeText]}>1er Trimestre</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, trimestre === 2 && styles.selectedTypeButton]}
              onPress={() => setTrimestre(2)}
            >
              <Text style={[styles.typeButtonText, trimestre === 2 && styles.selectedTypeText]}>2ème Trimestre</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, trimestre === 3 && styles.selectedTypeButton]}
              onPress={() => setTrimestre(3)}
            >
              <Text style={[styles.typeButtonText, trimestre === 3 && styles.selectedTypeText]}>3ème Trimestre</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Note (sur 20)</Text>
        <TextInput
          style={styles.noteInput}
          value={note}
          onChangeText={setNote}
          placeholder="Ex: 15.5"
          keyboardType="numeric"
          maxLength={4}
        />
      </View>

      <TouchableOpacity 
        style={[styles.submitButton, isSubmitting && styles.disabledButton]}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        <Text style={styles.submitButtonText}>
          {isSubmitting ? 'Ajout en cours...' : 'Ajouter la note'}
        </Text>
      </TouchableOpacity>
      </ScrollView>

      {/* Modal pour afficher le bulletin */}
      <Modal
        visible={bulletinModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setBulletinModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Bulletin de notes</Text>
              {selectedStudent && (
                <Text style={styles.modalSubtitle}>
                  {selectedStudent.prenom} {selectedStudent.nom}
                </Text>
              )}
              <Text style={styles.modalAverage}>
                Moyenne générale: {calculateAverage()}
              </Text>
            </View>
            
            {loadingBulletin ? (
              <ActivityIndicator size="large" color="#0066cc" />
            ) : bulletinData.length > 0 ? (
              <FlatList
                data={bulletinData}
                renderItem={renderBulletinItem}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.bulletinList}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Aucune note pour cet élève.</Text>
              </View>
            )}
            
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setBulletinModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal pour éditer une note */}
      <Modal
        visible={editNoteModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditNoteModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Éditer la note</Text>
              {editingNote && matieres.find(m => m.id === editingNote.matiere) && (
                <Text style={styles.modalSubtitle}>
                  Matière: {matieres.find(m => m.id === editingNote.matiere).nom}
                </Text>
              )}
            </View>
            
            <TextInput
              style={styles.editNoteInput}
              value={editNoteValue}
              onChangeText={setEditNoteValue}
              placeholder="Nouvelle note (sur 20)"
              keyboardType="numeric"
              maxLength={4}
            />
            
            <View style={styles.editNoteButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setEditNoteModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveEditedNote}
              >
                <Text style={styles.saveButtonText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de confirmation de suppression */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={confirmModalVisible}
        onRequestClose={() => {
          setConfirmModalVisible(false);
          setNoteToDelete(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContainer}>
            <Text style={styles.modalTitle}>Confirmation de suppression</Text>
            
            {noteToDelete && (
              <View style={styles.modalContent}>
                <Text style={styles.modalText}>
                  Êtes-vous sûr de vouloir supprimer cette note ?
                </Text>
                
                <View style={styles.modalDetails}>
                  <Text style={styles.modalDetailText}>
                    <Text style={styles.modalDetailLabel}>Note :</Text> {noteToDelete.note}/20
                  </Text>
                  <Text style={styles.modalDetailText}>
                    <Text style={styles.modalDetailLabel}>Matière :</Text> {noteToDelete.matiere_nom || 'Non spécifiée'}
                  </Text>
                  <Text style={styles.modalDetailText}>
                    <Text style={styles.modalDetailLabel}>Date :</Text> {new Date(noteToDelete.date).toLocaleDateString()}
                  </Text>
                </View>
                
                <Text style={styles.modalWarning}>
                  Cette action est irréversible.
                </Text>
                
                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => {
                      setConfirmModalVisible(false);
                      setNoteToDelete(null);
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Annuler</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.deleteModalButton]}
                    onPress={confirmDeleteNote}
                    disabled={deletingNoteId !== null}
                  >
                    {deletingNoteId === (noteToDelete?.id) ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.deleteButtonText}>Supprimer</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    marginBottom: 16,
    width: '100%',
  },
  searchInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  studentsGrid: {
    padding: 8,
  },
  studentRow: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  emptySearchContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySearchText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginTop: 12,
    marginBottom: 8,
  },
  typeButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f5f5f5',
    margin: 6,
    minWidth: 110,
    width: '45%',
    maxWidth: 150,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  selectedTypeButton: {
    borderColor: '#0066cc',
    backgroundColor: 'rgba(0, 102, 204, 0.1)',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#333',
  },
  selectedTypeText: {
    fontWeight: 'bold',
    color: '#0066cc',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    padding: '4%',
    paddingBottom: 30,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  headerSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  headerInfo: {
    fontSize: 14,
    color: '#f44336',
    fontStyle: 'italic',
    marginTop: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  emptyMatieres: {
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    alignItems: 'center',
  },
  emptyMatieresText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  selectClassButton: {
    backgroundColor: '#0066cc',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectClassButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: '4%',
    marginBottom: '3%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    width: '100%',
    alignSelf: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  studentsList: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    flexDirection: 'row',
  },
  studentCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 14,
    marginRight: 12,
    minWidth: 160,
    maxWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  selectedStudentCard: {
    backgroundColor: '#e6f2ff',
    borderColor: '#0066cc',
    borderWidth: 1,
  },
  studentName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  bulletinButton: {
    backgroundColor: '#4caf50',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  bulletinButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  matieresList: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  matiereCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 14,
    margin: 8,
    minWidth: 130,
    maxWidth: 180,
    width: '45%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  selectedMatiereCard: {
    backgroundColor: '#e6f7e6',
    borderColor: '#4caf50',
    borderWidth: 1,
  },
  matiereName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  matiereCoef: {
    fontSize: 14,
    color: '#666',
  },
  selectedMatiereContainer: {
    backgroundColor: '#e6f7e6',
    borderRadius: 8,
    padding: 16,
    borderColor: '#4caf50',
    borderWidth: 1,
  },
  selectedMatiereName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  selectedMatiereCoef: {
    fontSize: 16,
    color: '#666',
  },
  noteInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    fontSize: 18,
    width: '100%',
    alignSelf: 'center',
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  submitButton: {
    backgroundColor: '#0066cc',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  disabledButton: {
    backgroundColor: '#84a9d1', // Couleur plus claire pour indiquer l'état désactivé
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    width: '100%',
    maxHeight: '80%',
  },
  modalHeader: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  modalAverage: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4caf50',
  },
  bulletinList: {
    paddingVertical: 8,
  },
  bulletinItem: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#0066cc',
  },
  bulletinItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  bulletinMatiere: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  bulletinCoef: {
    fontSize: 14,
    color: '#666',
  },
  bulletinItemContent: {
    flexDirection: 'column',
    marginTop: 6,
  },
  bulletinInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bulletinNote: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0066cc',
  },
  bulletinDate: {
    fontSize: 14,
    color: '#666',
  },
  bulletinItemEditable: {
    borderLeftColor: '#4caf50',
  },
  bulletinActions: {
    flexDirection: 'row',
    marginTop: 8,
  },
  bulletinEditButton: {
    backgroundColor: '#2196f3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  bulletinDeleteButton: {
    backgroundColor: '#f44336',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  bulletinActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  editNoteInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    marginBottom: 16,
  },
  editNoteButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#4caf50',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginLeft: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  closeButton: {
    backgroundColor: '#f44336',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Styles pour la boîte de confirmation de suppression
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 20,
  },
  confirmModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalText: {
    fontSize: 16,
    color: '#444',
    textAlign: 'center',
    marginBottom: 15,
    lineHeight: 22,
  },
  modalDetails: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  modalDetailText: {
    fontSize: 15,
    color: '#555',
    marginBottom: 8,
  },
  modalDetailLabel: {
    fontWeight: 'bold',
    color: '#333',
  },
  modalWarning: {
    color: '#f44336',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    fontStyle: 'italic',
  },
  // Styles pour l'affichage du type de note et du trimestre
  bulletinMetaData: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    flex: 1,
    marginLeft: 10,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    flexWrap: 'wrap',
  },
  testLabel: {
    backgroundColor: '#e3f2fd',
    color: '#1976d2',
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 6,
  },
  examLabel: {
    backgroundColor: '#fff8e1',
    color: '#ff8f00',
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 6,
  },
  trimestreLabel: {
    backgroundColor: '#f1f1f1',
    color: '#616161',
    fontSize: 11,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  deleteModalButton: {
    backgroundColor: '#f44336',
    marginLeft: 10,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
