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
  Switch,
  ScrollView,
} from 'react-native';
import { getStudents, markAttendance, getMatieresEnseignant } from '../../../services/api';

export default function AddAbsenceScreen({ route, navigation }) {
  const { classeId, className } = route.params;
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [matieres, setMatieres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedMatiere, setSelectedMatiere] = useState(null);
  const [absenceType, setAbsenceType] = useState('absence'); // 'absence' ou 'retard'
  const [justification, setJustification] = useState('');
  const [date, setDate] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);
  
  useEffect(() => {
    if (students.length > 0) {
      const filtered = students.filter(student =>
        student.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.prenom.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredStudents(filtered);
    }
  }, [searchQuery, students]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadStudents(), loadMatieres()]);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      Alert.alert('Erreur', 'Impossible de charger les données nécessaires');
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async () => {
    try {
      // Charger les élèves depuis l'API
      const response = await getStudents(classeId);
      console.log('Élèves chargés:', response);
      setStudents(response);
      return response;
    } catch (error) {
      console.error('Erreur lors du chargement des élèves:', error);
      Alert.alert('Erreur', 'Impossible de charger la liste des élèves');
      throw error;
    }
  };
  
  const loadMatieres = async () => {
    try {
      // Charger les matières enseignées par l'enseignant
      const response = await getMatieresEnseignant();
      console.log('Matières chargées:', response);
      setMatieres(response);
      
      // Sélectionner la première matière par défaut si disponible
      if (response.length > 0) {
        setSelectedMatiere(response[0]);
      }
      
      return response;
    } catch (error) {
      console.error('Erreur lors du chargement des matières:', error);
      Alert.alert('Erreur', 'Impossible de charger la liste des matières');
      throw error;
    }
  };

  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
  };
  
  const handleSelectMatiere = (matiere) => {
    setSelectedMatiere(matiere);
  };

  const toggleAbsenceType = () => {
    setAbsenceType(absenceType === 'absence' ? 'retard' : 'absence');
  };

  const handleSubmit = async () => {
    if (!selectedStudent) {
      Alert.alert('Erreur', 'Veuillez sélectionner un élève');
      return;
    }
    
    if (!selectedMatiere) {
      Alert.alert('Erreur', 'Veuillez sélectionner une matière');
      return;
    }
    
    try {
      setSubmitting(true);
      
      // Préparer les données pour l'API
      const absenceData = {
        type: absenceType,
        date: new Date().toISOString(),
        justification: justification || null,
        matiere: selectedMatiere.id,
        classe: parseInt(classeId)
      };
      
      console.log('Données d\'absence à envoyer:', absenceData);
      
      // Envoyer l'absence à l'API
      await markAttendance(selectedStudent.id, absenceData);
      
      Alert.alert(
        'Succès',
        `${absenceType === 'absence' ? 'Absence' : 'Retard'} enregistré(e) pour ${selectedStudent.prenom} ${selectedStudent.nom} en ${selectedMatiere.nom}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de l\'absence:', error);
      Alert.alert('Erreur', 'Impossible d\'enregistrer l\'absence: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSubmitting(false);
    }
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
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  const renderMatiereItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.matiereCard,
        selectedMatiere?.id === item.id && styles.selectedMatiereCard,
      ]}
      onPress={() => handleSelectMatiere(item)}
    >
      <Text style={styles.matiereName}>{item.nom}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.className}>{className}</Text>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un élève..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      <FlatList
        data={filteredStudents}
        renderItem={renderStudentItem}
        keyExtractor={(item) => item.id.toString()}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.studentsList}
      />
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Matière</Text>
        <Text style={styles.sectionSubtitle}>Sélectionnez une matière</Text>
        <FlatList
          data={matieres}
          renderItem={renderMatiereItem}
          keyExtractor={(item) => item.id.toString()}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.matieresList}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Type</Text>
        <View style={styles.absenceTypeContainer}>
          <Text style={styles.absenceTypeText}>Absence</Text>
          <Switch
            value={absenceType === 'retard'}
            onValueChange={toggleAbsenceType}
            trackColor={{ false: '#ff6b6b', true: '#ffa500' }}
            thumbColor={absenceType === 'retard' ? '#ff9500' : '#ff4757'}
          />
          <Text style={styles.absenceTypeText}>Retard</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Justification (optionnelle)</Text>
        <TextInput
          style={styles.justificationInput}
          value={justification}
          onChangeText={setJustification}
          placeholder="Raison de l'absence..."
          multiline
          numberOfLines={4}
        />
      </View>

      <TouchableOpacity
        style={[styles.submitButton, submitting && styles.disabledButton]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        <Text style={styles.submitButtonText}>
          {submitting 
            ? 'Enregistrement en cours...' 
            : `Enregistrer ${absenceType === 'absence' ? 'l\'absence' : 'le retard'}`}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 12,
    paddingBottom: 24,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  searchContainer: {
    marginBottom: 6,
  },
  searchInput: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 6,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  studentsList: {
    height: 32,
    marginBottom: 8,
  },
  studentCard: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginRight: 10,
    borderRadius: 8,
    minWidth: 140,
    height: 32,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  selectedStudentCard: {
    backgroundColor: '#e6f2ff',
    borderColor: '#0066cc',
    borderWidth: 2,
    shadowColor: '#0066cc',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2c3e50',
    textAlign: 'center',
  },
  className: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
    textAlign: 'center',
  },
  matieresList: {
    paddingVertical: 4,
  },
  matiereCard: {
    backgroundColor: '#fff',
    padding: 8,
    marginRight: 6,
    borderRadius: 6,
    minWidth: 110,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  selectedMatiereCard: {
    backgroundColor: '#e6f2ff',
    borderColor: '#0066cc',
    borderWidth: 1,
  },
  matiereName: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  absenceTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  absenceTypeText: {
    fontSize: 16,
    marginHorizontal: 8,
  },
  justificationInput: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 6,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    textAlignVertical: 'top',
    minHeight: 80,
  },
  submitButton: {
    backgroundColor: '#0066cc',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 12,
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
