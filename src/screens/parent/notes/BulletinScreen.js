import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Share,
  Alert,
} from 'react-native';
import { getBulletinEleve, getEnfants } from '../../../services/api';
import EnfantSelector from '../../../components/EnfantSelector';

export default function BulletinScreen({ route, navigation }) {
  const [enfants, setEnfants] = useState([]);
  const [selectedEnfantId, setSelectedEnfantId] = useState(null);
  const [bulletin, setBulletin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Charger la liste des enfants au démarrage
  useEffect(() => {
    loadEnfants();
  }, []);

  // Charger le bulletin quand un enfant est sélectionné
  useEffect(() => {
    if (selectedEnfantId) {
      loadBulletinDetails(selectedEnfantId);
    }
  }, [selectedEnfantId]);

  const loadEnfants = async () => {
    try {
      const enfantsData = await getEnfants();
      // Formater les données des enfants pour inclure correctement les informations de classe
      const formattedEnfants = enfantsData.map(enfant => {
        let classeInfo = { id: '1', nom: 'Classe non spécifiée' };
        if (enfant.classe_details && enfant.classe_details.nom) {
          classeInfo = enfant.classe_details;
        } else if (enfant.classe && enfant.classe.nom) {
          classeInfo = enfant.classe;
        } else if (enfant.classe && typeof enfant.classe === 'string') {
          classeInfo = { id: '1', nom: enfant.classe };
        }
        return {
          ...enfant,
          classe: classeInfo
        };
      });
      setEnfants(formattedEnfants);
      
      // Sélectionner le premier enfant par défaut ou celui spécifié dans les paramètres de route
      const defaultEnfantId = route.params?.enfantId || (formattedEnfants.length > 0 ? formattedEnfants[0].id : null);
      if (defaultEnfantId) {
        setSelectedEnfantId(defaultEnfantId);
      } else if (formattedEnfants.length === 0) {
        setError('Aucun enfant trouvé');
      }
    } catch (error) {
      console.error('Erreur lors du chargement des enfants:', error);
      setError('Impossible de charger la liste des enfants');
    }
  };

  const loadBulletinDetails = async (enfantId) => {
    if (!enfantId) return;
    
    try {
      setLoading(true);
      setError(null);
      setBulletin(null); // Réinitialiser le bulletin précédent
      
      // Charger les notes de l'élève depuis l'API
      const notesResponse = await getBulletinEleve(enfantId);
      
      if (!notesResponse || !Array.isArray(notesResponse)) {
        throw new Error('Aucune note disponible pour cet élève');
      }
      
      // S'assurer que nous ne prenons que les notes de l'élève sélectionné
      const notesEleve = notesResponse.filter(note => 
        note.eleve?.toString() === enfantId?.toString() ||
        note.eleve_details?.id?.toString() === enfantId?.toString()
      );
      
      if (notesEleve.length === 0) {
        throw new Error('Aucune note disponible pour cet élève');
      }

      // Filtrer pour ne garder que les examens avec un trimestre assigné
      const examensAvecTrimestre = notesEleve.filter(note => 
        note.type === 'examen' && note.trimestre !== null && note.trimestre !== undefined
      );
      
      if (examensAvecTrimestre.length === 0) {
        throw new Error('Aucun examen avec trimestre disponible pour cet élève');
      }

      // Récupérer les informations de l'élève à partir de la première note
      const firstNote = notesEleve[0];
      const eleve = firstNote.eleve_details || {};
      
      // Déterminer la classe de l'élève en vérifiant plusieurs sources possibles
      let classeInfo = { id: '1', nom: 'Classe non spécifiée' };
      if (eleve.classe_details && eleve.classe_details.nom) {
        classeInfo = eleve.classe_details;
      } else if (eleve.classe && eleve.classe.nom) {
        classeInfo = eleve.classe;
      } else if (eleve.classe && typeof eleve.classe === 'string') {
        classeInfo = { id: '1', nom: eleve.classe };
      }
      
      // Regrouper les notes par trimestre
      const trimestres = {};
      
      // Initialiser les trois trimestres
      for (let i = 1; i <= 3; i++) {
        trimestres[i] = {
          id: i,
          trimestre_display: `Trimestre ${i}`,
          date_publication: new Date(),
          enfant: {
            id: enfantId,
            nom: eleve.nom || 'Nom inconnu',
            prenom: eleve.prenom || 'Prénom inconnu',
            classe: classeInfo,
          },
          moyenne_generale: 0,
          totalPoints: 0,
          totalCoefficients: 0,
          notes: [],
          absences: null,
          retards: null,
          matieres: {}
        };
      }
      
      // Regrouper les notes par trimestre et par matière
      examensAvecTrimestre.forEach(note => {
        const trimestreId = parseInt(note.trimestre, 10);
        if (trimestreId < 1 || trimestreId > 3 || isNaN(trimestreId)) return;
        
        const matiereName = note.matiere_details?.nom || 'Matière inconnue';
        const noteValue = parseFloat(note.note) || 0;
        const coefficient = parseFloat(note.matiere_details?.coefficient || 1);
        
        // Pour la moyenne générale du trimestre
        trimestres[trimestreId].totalPoints += noteValue * coefficient;
        trimestres[trimestreId].totalCoefficients += coefficient;
        
        // Initialiser la matière si elle n'existe pas encore pour ce trimestre
        if (!trimestres[trimestreId].matieres[matiereName]) {
          trimestres[trimestreId].matieres[matiereName] = {
            matiere: matiereName,
            notes: [],
            totalPoints: 0,
            totalCoefficients: 0,
          };
        }
        
        // Ajouter la note à la matière pour ce trimestre
        trimestres[trimestreId].matieres[matiereName].notes.push({
          note: noteValue,
          coefficient: coefficient,
          date: note.date ? new Date(note.date) : new Date(),
          type: note.type || 'Examen',
          enseignant: note.enseignant_details ? 
            `${note.enseignant_details.prenom || ''} ${note.enseignant_details.nom || ''}` : 
            'Enseignant non spécifié',
          id: note.id
        });
        
        // Ajouter pour la moyenne de la matière
        trimestres[trimestreId].matieres[matiereName].totalPoints += noteValue * coefficient;
        trimestres[trimestreId].matieres[matiereName].totalCoefficients += coefficient;
      });
      
      // Calculer les moyennes par matière et générale pour chaque trimestre
      Object.values(trimestres).forEach(trimestre => {
        // Convertir les matières en tableau et calculer les moyennes
        trimestre.notes = Object.values(trimestre.matieres).map(matiere => ({
          ...matiere,
          moyenne: matiere.totalCoefficients > 0 
            ? (matiere.totalPoints / matiere.totalCoefficients) 
            : 0
        }));
        
        // Calculer la moyenne générale du trimestre
        if (trimestre.totalCoefficients > 0) {
          trimestre.moyenne_generale = trimestre.totalPoints / trimestre.totalCoefficients;
        }
      });
      
      // Préparer l'objet bulletin avec les trois trimestres
      const bulletin = {
        annee_scolaire: `${new Date().getFullYear() - 1}-${new Date().getFullYear()}`,
        enfant: {
          id: enfantId,
          nom: eleve.nom || 'Nom inconnu',
          prenom: eleve.prenom || 'Prénom inconnu',
          classe: classeInfo,
        },
        trimestres: Object.values(trimestres),
      };
      
      setBulletin(bulletin);
    } catch (error) {
      console.error('Erreur lors du chargement du bulletin:', error);
      setError(error.message || 'Impossible de charger le bulletin');
      Alert.alert('Erreur', error.message || 'Impossible de charger le bulletin');
    } finally {
      setLoading(false);
    }
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

  const formatMoyenne = (moyenne) => {
    try {
      const moyenneValue = parseFloat(moyenne);
      return isNaN(moyenneValue) ? '0.0' : moyenneValue.toFixed(1);
    } catch (error) {
      console.error('Erreur de formatage de moyenne:', error);
      return '0.0';
    }
  };

  // Fonction pour déterminer le style en fonction de la note
  const getMoyenneStyle = (note) => {
    const noteValue = parseFloat(note);
    if (isNaN(noteValue)) return styles.moyenneNeutral;
    
    if (noteValue >= 14) return styles.moyenneExcellent;
    if (noteValue >= 12) return styles.moyenneBien;
    if (noteValue >= 10) return styles.moyenneAssezBien;
    if (noteValue >= 8) return styles.moyenneMoyen;
    return styles.moyenneInsuffisant;
  };

  const handleShareBulletin = async () => {
    try {
      if (!bulletin || !bulletin.trimestres) {
        Alert.alert('Erreur', 'Aucun bulletin disponible à partager');
        return;
      }
      
      // Préparer le contenu du partage pour chaque trimestre
      let fullMessage = `Bulletins ${bulletin.annee_scolaire} - ${bulletin.enfant.prenom} ${bulletin.enfant.nom}\n`;
      fullMessage += `Classe: ${bulletin.enfant.classe?.nom || 'Non spécifiée'}\n\n`;
      
      // Ajouter les informations de chaque trimestre
      bulletin.trimestres.forEach(trimestre => {
        if (trimestre.notes && trimestre.notes.length > 0) {
          fullMessage += `\n--- ${trimestre.trimestre_display} ---\n`;
          fullMessage += `Moyenne générale: ${formatMoyenne(trimestre.moyenne_generale)}/20\n\n`;
          
          // Ajouter les moyennes par matière
          fullMessage += `Moyennes par matière:\n`;
          trimestre.notes.forEach(matiere => {
            fullMessage += `${matiere.matiere}: ${formatMoyenne(matiere.moyenne)}/20\n`;
          });
        }
      });
      
      const shareContent = {
        title: `Bulletins ${bulletin.annee_scolaire} - ${bulletin.enfant.prenom} ${bulletin.enfant.nom}`,
        message: fullMessage
      };

      const result = await Share.share(shareContent);
      if (result.action === Share.sharedAction) {
        console.log('Bulletins partagés avec succès');
      }
    } catch (error) {
      console.error('Erreur lors du partage du bulletin:', error);
      Alert.alert('Erreur', 'Impossible de partager le bulletin');
    }
  };

  const handleEnfantChange = (enfantId) => {
    setSelectedEnfantId(enfantId);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Chargement du bulletin...</Text>
      </View>
    );
  }
  
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }
  
  if (!bulletin) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Aucune donnée de bulletin disponible</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={loadBulletinDetails}
        >
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!bulletin) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Impossible de charger le bulletin</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadBulletinDetails}>
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <EnfantSelector
        enfants={enfants}
        selectedEnfantId={selectedEnfantId}
        onSelectEnfant={(enfant) => setSelectedEnfantId(enfant.id)}
      />
      
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text style={styles.loadingText}>Chargement du bulletin...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && !error && bulletin && (
        <ScrollView style={styles.bulletinContainer}>
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Bulletins scolaires</Text>
              <Text style={styles.headerSubtitle}>
                {bulletin.annee_scolaire} - {bulletin.enfant.prenom} {bulletin.enfant.nom}
              </Text>
              <Text style={styles.classeInfo}>
                {bulletin.enfant.classe?.nom || 'Classe non spécifiée'}
              </Text>
            </View>
            <TouchableOpacity style={styles.shareButton} onPress={handleShareBulletin}>
              <Text style={styles.shareButtonText}>Partager</Text>
            </TouchableOpacity>
          </View>

          {bulletin.trimestres.map((trimestre, trimestreIndex) => (
            <View key={trimestreIndex} style={styles.trimestreSection}>
              <View style={styles.trimestreHeader}>
                <Text style={styles.trimestreTitle}>{trimestre.trimestre_display}</Text>
                <Text style={styles.trimestreDate}>
                  {formatDate(trimestre.date_publication)}
                </Text>
              </View>

              <View style={styles.summarySection}>
                <Text style={styles.sectionTitle}>Résumé du trimestre</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Moyenne générale:</Text>
                  <Text style={[styles.summaryValue, getMoyenneStyle(trimestre.moyenne_generale)]}>
                    {formatMoyenne(trimestre.moyenne_generale)}/20
                  </Text>
                </View>
              </View>

              <View style={styles.notesSection}>
                <Text style={styles.sectionTitle}>Notes par matière</Text>
                {trimestre.notes.length > 0 ? (
                  trimestre.notes.map((matiere, index) => (
                    <View key={index} style={styles.matiereCard}>
                      <View style={styles.matiereHeader}>
                        <Text style={styles.matiereTitle}>{matiere.matiere}</Text>
                        <Text style={[styles.matiereMoyenne, getMoyenneStyle(matiere.moyenne)]}>
                          Moyenne: {formatMoyenne(matiere.moyenne)}/20
                        </Text>
                      </View>
                      <View style={styles.notesList}>
                        {matiere.notes.map((note, noteIndex) => (
                          <View key={noteIndex} style={styles.noteItem}>
                            <Text style={styles.noteType}>{note.type}</Text>
                            <Text style={styles.noteDate}>{formatDate(note.date)}</Text>
                            <Text style={[styles.noteValue, getMoyenneStyle(note.note)]}>
                              {note.note} ({note.coefficient}x)
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyStateContainer}>
                    <Text style={styles.emptyStateText}>Aucune note disponible pour ce trimestre</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
  },
  bulletinContainer: {
    flex: 1,
    padding: 15,
  },
  retryButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 4,
  },
  headerDate: {
    fontSize: 14,
    color: '#999',
  },
  shareButton: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#0066cc',
  },
  shareButtonText: {
    color: '#0066cc',
    fontWeight: 'bold',
  },
  summarySection: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#666',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  notesSection: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
  },
  matiereCard: {
    marginBottom: 16,
  },
  matiereHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  matiereTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  matiereMoyenne: {
    fontSize: 16,
    color: '#666',
  },
  notesList: {
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderRadius: 4,
  },
  noteItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  noteType: {
    fontSize: 14,
    color: '#333',
  },
  noteDate: {
    fontSize: 12,
    color: '#999',
  },
  noteValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  appreciationsSection: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
  },
  appreciationCard: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
  appreciationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  appreciationText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  appreciationAuthor: {
    fontSize: 12,
    color: '#666',
  },
  conseilSection: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
  },
  conseilAppreciation: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  conseilOrientation: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  
  // Styles pour l'affichage des trimestres
  trimestreSection: {
    marginTop: 20,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  trimestreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 8,
  },
  trimestreTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0066cc',
  },
  trimestreDate: {
    fontSize: 14,
    color: '#666',
  },
  classeInfo: {
    fontSize: 15,
    color: '#555',
    marginTop: 4,
  },
  
  // Styles pour les moyennes
  moyenneExcellent: {
    color: '#2e7d32', // Vert foncé
    fontWeight: 'bold',
  },
  moyenneBien: {
    color: '#388e3c', // Vert moyen
  },
  moyenneAssezBien: {
    color: '#43a047', // Vert clair
  },
  moyenneMoyen: {
    color: '#ffa000', // Ambre/Orange
  },
  moyenneInsuffisant: {
    color: '#d32f2f', // Rouge
  },
  moyenneNeutral: {
    color: '#555',
  },
  
  // État vide
  emptyStateContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginTop: 10,
  },
  emptyStateText: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
  },
  enfantSelector: {
    marginTop: 16,
    marginBottom: 16,
  },
});
