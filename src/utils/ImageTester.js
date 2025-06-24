import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { getCompletePhotoUrl } from '../services/api';

/**
 * Composant pour tester l'accès aux images du serveur
 */
const ImageTester = () => {
  const [testResults, setTestResults] = useState([]);
  const [loading, setLoading] = useState(true);

  // Liste des images à tester
  const testImages = [
    { name: 'avatar1.png', path: 'eleves/avatar1.png' },
    { name: 'avatar2.png', path: 'eleves/avatar2.png' },
    { name: 'avatar3.png', path: 'eleves/avatar3.png' },
    { name: 'avatar6.png', path: 'eleves/avatar6.png' },
    { name: 'profile-pic.png', path: 'eleves/profile-pic.png' },
    { name: 'profile-pic_L3m1ekv.png', path: 'eleves/profile-pic_L3m1ekv.png' },
    { name: 'profile-pic_KNWstXe.png', path: 'eleves/profile-pic_KNWstXe.png' },
  ];

  // Tester différentes variantes d'URL du serveur
  const serverUrls = [
    'http://192.168.1.36:8000',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
  ];

  useEffect(() => {
    const testAllImages = async () => {
      const results = [];

      // Tester chaque image avec chaque URL de serveur
      for (const serverUrl of serverUrls) {
        for (const img of testImages) {
          const completeUrl = `${serverUrl}/media/${img.path}`;
          
          try {
            // Tester si l'URL est accessible
            const response = await fetch(completeUrl, { method: 'HEAD' });
            results.push({
              name: img.name,
              path: img.path,
              url: completeUrl,
              success: response.ok,
              status: response.status,
              statusText: response.statusText,
            });
          } catch (error) {
            results.push({
              name: img.name,
              path: img.path,
              url: completeUrl,
              success: false,
              error: error.message,
            });
          }
        }
      }

      setTestResults(results);
      setLoading(false);
    };

    testAllImages();
  }, []);

  // Tester une URL spécifique
  const testSpecificUrl = async (url) => {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      alert(`Test de ${url}: ${response.ok ? 'Succès' : 'Échec'} (${response.status})`);
    } catch (error) {
      alert(`Erreur lors du test de ${url}: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Test d'accès aux images...</Text>
        <Text>Chargement en cours...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Résultats des tests d'accès aux images</Text>
      
      {/* Formulaire de test d'URL */}
      <View style={styles.testUrlContainer}>
        <TouchableOpacity 
          style={styles.testButton}
          onPress={() => testSpecificUrl('http://192.168.1.36:8000/media/eleves/avatar1.png')}
        >
          <Text style={styles.testButtonText}>Tester URL spécifique</Text>
        </TouchableOpacity>
      </View>

      {/* Résultats des tests */}
      {testResults.map((result, index) => (
        <View key={index} style={[styles.resultItem, { backgroundColor: result.success ? '#e6ffe6' : '#ffe6e6' }]}>
          <Text style={styles.resultName}>{result.name}</Text>
          <Text>URL: {result.url}</Text>
          <Text>Statut: {result.success ? 'Accessible ✅' : 'Non accessible ❌'}</Text>
          {result.status && <Text>Code HTTP: {result.status}</Text>}
          {result.error && <Text>Erreur: {result.error}</Text>}
          
          {result.success && (
            <View style={styles.imageContainer}>
              <Image 
                source={{ uri: result.url }}
                style={styles.testImage}
                resizeMode="cover"
                onError={() => console.log(`Erreur de chargement de l'image: ${result.url}`)}
              />
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  resultItem: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  resultName: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  imageContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  testImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#e1e1e1',
  },
  testUrlContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  testButton: {
    backgroundColor: '#0066cc',
    padding: 12,
    borderRadius: 8,
  },
  testButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default ImageTester;
