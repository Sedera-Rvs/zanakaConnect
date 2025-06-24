import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';

export default function EnfantSelector({ enfants, selectedEnfantId, onSelectEnfant }) {
  if (!enfants || enfants.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Aucun enfant trouvé</Text>
      </View>
    );
  }

  const handleEnfantSelect = (enfant) => {
    if (enfant.id !== selectedEnfantId) {
      onSelectEnfant(enfant);
    }
  };

  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false} 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {enfants.map((enfant) => (
        <TouchableOpacity
          key={enfant.id}
          style={[
            styles.enfantItem,
            enfant.id === selectedEnfantId && styles.selectedEnfantItem,
          ]}
          onPress={() => handleEnfantSelect(enfant)}
        >
          <View style={styles.enfantContent}>
            <View style={[styles.photo, !enfant.photo && styles.photoPlaceholder]}>
              {enfant.photo ? (
                <Image 
                  source={{ uri: enfant.photo }} 
                  style={[styles.photo, styles.photoImage]}
                />
              ) : (
                <Text style={styles.photoPlaceholderText}>
                  {enfant.prenom?.[0] || ''}
                  {enfant.nom?.[0] || ''}
                </Text>
              )}
            </View>
            <View style={styles.enfantInfo}>
              <Text style={[
                styles.enfantName,
                enfant.id === selectedEnfantId && styles.selectedEnfantName
              ]} numberOfLines={1}>
                {enfant.prenom} {enfant.nom}
              </Text>
              <Text style={[
                styles.enfantClasse,
                enfant.id === selectedEnfantId && styles.selectedEnfantClasse
              ]} numberOfLines={1}>
                {enfant.classe?.nom || 'Classe non spécifiée'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 0,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  contentContainer: {
    padding: 10,
  },
  enfantItem: {
    marginRight: 15,
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e1e1e1',
    backgroundColor: '#f8f8f8',
    minWidth: 150, 
  },
  selectedEnfantItem: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  enfantContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  photo: {
    width: 50, 
    height: 50,
    borderRadius: 25,
    marginRight: 10, 
  },
  photoPlaceholder: {
    backgroundColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
  photoImage: {
    resizeMode: 'cover',
  },
  enfantInfo: {
    flex: 1, 
    justifyContent: 'center',
  },
  enfantName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  selectedEnfantName: {
    color: '#007AFF',
  },
  enfantClasse: {
    fontSize: 14,
    color: '#666',
  },
  selectedEnfantClasse: {
    color: '#007AFF',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
  },
});
