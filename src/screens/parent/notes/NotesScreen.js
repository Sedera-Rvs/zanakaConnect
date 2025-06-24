import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { getEnfants, getNotesEleve, getBulletinEleve } from '../../../services/api';

export default function NotesScreen({ navigation }) {
  const [enfants, setEnfants] = useState([]);
  const [selectedEnfant, setSelectedEnfant] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadEnfants();
  }, []);

  useEffect(() => {
    if (selectedEnfant) {
      loadNotes(selectedEnfant.id);
    }
  }, [selectedEnfant]);

  const loadEnfants = async () => {
    try {
      setLoading(true);
      // Charger les enfants depuis l'API
      const response = await getEnfants();
      
      if (response && response.length > 0) {
        setEnfants(response);
        setSelectedEnfant(response[0]);
      } else {
        console.warn('Aucun enfant trouvé ou format de réponse incorrect');
        setEnfants([]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des enfants:', error);
      Alert.alert('Erreur', 'Impossible de charger la liste des enfants');
      setEnfants([]);
    } finally {
      setLoading(false);
    }
  };

  const loadNotes = async (enfantId) => {
    if (!enfantId) {
      setNotes([]);
      return;
    }

    try {
      setLoading(true);
      const response = await getNotesEleve(enfantId);
      
      console.log('Réponse brute des notes:', response);
      
      // Gérer différents formats de réponse possibles
      const notes = response?.results || (Array.isArray(response) ? response : []);
      
      if (!Array.isArray(notes)) {
        console.warn('Format de réponse des notes invalide:', notes);
        setNotes([]);
        return;
      }
      
      console.log(`Chargement des notes pour l'enfant ${enfantId}, ${notes.length} notes trouvées`);
      
      // Filtrer pour ne garder que les notes de l'enfant sélectionné
      const notesEnfant = notes.filter(note => {
        const noteEleveId = String(note.eleve?.id || note.eleve || note.eleve_details?.id || '');
        const enfantIdStr = String(enfantId);
        const matchId = noteEleveId === enfantIdStr;
        
        console.log(`Note ${note.id}: eleve_id=${noteEleveId}, enfantId=${enfantIdStr}, match=${matchId}`);
        return matchId;
      });
      
      console.log(`Après filtrage: ${notesEnfant.length} notes pour l'enfant ${enfantId}`);
      
      // Transformer les données filtrées pour correspondre à notre format d'affichage
      const formattedNotes = notesEnfant.map(note => {
        console.log('Note brute reçue:', note); // Pour déboguer
        
        // Déterminer le type de note
        const isExamen = note.type_note?.toLowerCase() === 'examen' || 
                        note.type?.toLowerCase() === 'examen';
        
        // Récupérer les informations de l'enseignant
        const enseignantNom = note.enseignant_details?.nom || 
                            note.enseignant_details?.prenom ? 
                            `${note.enseignant_details?.prenom || ''} ${note.enseignant_details?.nom || ''}`.trim() :
                            note.enseignant || 'Non spécifié';
        
        return {
          id: note.id?.toString() || Math.random().toString(),
          matiere: note.matiere_details?.nom || note.matiere?.nom || 'Matière non spécifiée',
          classe: note.classe_details?.nom || note.classe?.nom || 'Classe non spécifiée',
          note: note.note?.toString() || '0',
          date: note.date || new Date().toISOString(),
          type: isExamen ? 'examen' : 'test',
          type_display: isExamen ? 'Examen' : 'Test',
          trimestre: note.trimestre,
          trimestre_display: note.trimestre ? `Trimestre ${note.trimestre}` : '',
          coefficient: note.coefficient?.toString() || '1',
          enseignant: enseignantNom,
          commentaire: note.commentaire || ''
        };
      });
      
      // Sort notes by date from most recent to oldest
      formattedNotes.sort((a, b) => new Date(b.date) - new Date(a.date));

      console.log('Notes formatées:', formattedNotes); // Debug log
      setNotes(formattedNotes);
    } catch (error) {
      console.error('Erreur lors du chargement des notes:', error);
      Alert.alert('Erreur', 'Impossible de charger les notes pour le moment');
      setNotes([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadEnfants();
      if (selectedEnfant) {
        await loadNotes(selectedEnfant.id);
      }
    } catch (error) {
      console.error('Erreur lors du rafraîchissement:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSelectEnfant = (enfant) => {
    setSelectedEnfant(enfant);
  };

  const calculateMoyenne = () => {
    if (notes.length === 0) return 0;
    
    let totalPoints = 0;
    let totalCoefficients = 0;
    
    notes.forEach(note => {
      // Vérifier que note.note et note.coefficient sont des nombres valides
      const noteValue = parseFloat(note.note) || 0;
      const coeffValue = parseFloat(note.coefficient) || 1;
      
      totalPoints += noteValue * coeffValue;
      totalCoefficients += coeffValue;
    });
    
    return totalCoefficients > 0 ? (totalPoints / totalCoefficients).toFixed(2) : '0.00';
  };

  const formatDate = (date) => {
    try {
      if (!(date instanceof Date) || isNaN(date)) {
        return 'Date inconnue';
      }
      
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch (error) {
      console.error('Erreur de formatage de date:', error);
      return 'Date inconnue';
    }
  };

  const renderEnfantItem = ({ item }) => {
    // Vérifier que l'objet classe existe et a un nom
    const classeName = item.classe_details?.nom || item.classe?.nom || 'Classe non spécifiée';
    
    return (
      <TouchableOpacity
        style={[
          styles.enfantCard,
          selectedEnfant?.id === item.id && styles.selectedEnfantCard,
        ]}
        onPress={() => handleSelectEnfant(item)}
      >
        <Text style={styles.enfantName}>
          {item.prenom} {item.nom}
        </Text>
        <Text style={styles.enfantClasse}>
          {classeName}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderNoteItem = ({ item }) => {
    console.log('Rendu de la note:', item); // Debug log
    
    return (
      <View style={styles.noteCard}>
        <View style={styles.noteHeader}>
          <Text style={styles.matiereName}>{item.matiere}</Text>
          <View style={styles.noteTypeContainer}>
            <Text style={[
              styles.noteType,
              item.type === 'examen' ? styles.noteTypeExam : styles.noteTypeTest
            ]}>
              {item.type_display}
            </Text>
            {item.trimestre && (
              <Text style={styles.noteTrimestre}>{item.trimestre_display}</Text>
            )}
          </View>
          <View style={styles.noteContainer}>
            <Text style={[
              styles.noteValue,
              parseFloat(item.note) < 10 ? styles.noteValueLow : null
            ]}>
              {parseFloat(item.note).toFixed(1)}
            </Text>
            <Text style={styles.noteMax}>/20</Text>
          </View>
        </View>
        <View style={styles.noteDetails}>
          <Text style={styles.noteDate}>
            Date: {formatDate(new Date(item.date))}
          </Text>
          <Text style={styles.noteCoef}>
            Coefficient: {item.coefficient}
          </Text>
          {item.enseignant && (
            <Text style={styles.noteEnseignant}>
              Enseignant: {item.enseignant}
            </Text>
          )}
          {item.commentaire && (
            <Text style={styles.noteCommentaire}>
              "{item.commentaire}"
            </Text>
          )}
        </View>
      </View>
    );
  };

  if (loading && enfants.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Historique des notes</Text>
      </View>

      {/* Section de sélection d'enfant */}
      <View style={styles.enfantsContainer}>
        <Text style={styles.sectionTitle}>Mes enfants</Text>
        {enfants.length > 0 ? (
          <FlatList
            horizontal
            data={enfants}
            renderItem={renderEnfantItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.enfantsList}
            showsHorizontalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Aucun enfant trouvé</Text>
          </View>
        )}
      </View>

      {/* Section des notes de l'enfant sélectionné */}
      {selectedEnfant && (
        <View style={styles.notesSection}>
          <View style={styles.selectedEnfantHeader}>
            <Text style={styles.selectedEnfantName}>
              Notes de {selectedEnfant.prenom} {selectedEnfant.nom}
            </Text>
            <TouchableOpacity
              style={styles.bulletinButton}
              onPress={() => navigation.navigate('Bulletin', { enfantId: selectedEnfant.id })}
            >
              <Text style={styles.bulletinButtonText}>Voir le bulletin</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0066cc" />
            </View>
          ) : (
            <FlatList
              data={notes}
              renderItem={renderNoteItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.notesList}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Aucune note disponible pour cet élève</Text>
                </View>
              }
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  enfantsContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  enfantsList: {
    paddingVertical: 8,
  },
  enfantCard: {
    backgroundColor: '#f8f8f8',
    padding: 12,
    marginRight: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedEnfantCard: {
    backgroundColor: '#e6f2ff',
    borderColor: '#0066cc',
  },
  enfantName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  enfantClasse: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  notesSection: {
    flex: 1,
    backgroundColor: '#fff',
  },
  selectedEnfantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  selectedEnfantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  bulletinButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  bulletinButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  notesList: {
    padding: 16,
  },
  noteCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  matiereName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  noteContainer: {
    alignItems: 'center',
  },
  noteValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0066cc',
  },
  noteValueLow: {
    color: '#cc3300',
  },
  noteDetails: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 8,
    marginTop: 8,
  },
  noteDate: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  noteEnseignant: {
    fontSize: 13,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
  },
  // Styles pour les types de notes
  noteTypeContainer: {
    alignItems: 'center',
    marginHorizontal: 8,
  },
  noteType: {
    fontSize: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  noteTypeTest: {
    backgroundColor: '#e3f2fd',
    color: '#1976d2',
  },
  noteTypeExam: {
    backgroundColor: '#fff3e0',
    color: '#f57c00',
    fontWeight: '600',
  },
  noteTrimestre: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  }
});
