import React, { useState, useEffect } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { getCompletePhotoUrl, getEleveById } from '../services/api';

/**
 * Composant pour afficher l'avatar d'un élève
 * @param {Object} props - Les propriétés du composant
 * @param {Object} props.eleve - L'objet élève contenant les informations
 * @param {string} props.size - La taille de l'avatar ('small', 'medium', 'large')
 * @param {Object} props.style - Styles supplémentaires à appliquer au conteneur
 */
const EleveAvatar = ({ eleve, size = 'medium', style }) => {
  const [imageError, setImageError] = useState(false);
  const [eleveComplet, setEleveComplet] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Récupérer les informations complètes de l'élève si nécessaire
  useEffect(() => {
    const fetchEleveDetails = async () => {
      // Vérifier si nous avons déjà les informations nécessaires
      if (eleve?.photo || eleve?.photo_complete || eleveComplet || !eleve?.id || loading) {
        return;
      }
      
      try {
        setLoading(true);
        console.log('Récupération des informations complètes de l\'élève:', eleve.id);
        const eleveDetails = await getEleveById(eleve.id);
        if (eleveDetails) {
          setEleveComplet(eleveDetails);
          console.log('Informations complètes de l\'élève récupérées:', eleveDetails);
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des informations de l\'élève:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchEleveDetails();
  }, [eleve?.id]);
  
  // Déterminer la taille de l'avatar
  const avatarSize = {
    small: 40,
    medium: 50,
    large: 70,
  }[size] || 50;
  
  // Déterminer la source de l'image
  let photoSource = null;
  let photoUrl = null;
  
  // Utiliser les données de l'élève complet si disponibles
  const eleveData = eleveComplet || eleve;
  
  if (eleveData?.photo_complete) {
    photoUrl = eleveData.photo_complete;
  } else if (eleveData?.photo) {
    // Nettoyer l'URL de la photo si nécessaire
    let cleanPhotoUrl = eleveData.photo;
    if (typeof cleanPhotoUrl === 'string') {
      // Supprimer les guillemets si présents
      cleanPhotoUrl = cleanPhotoUrl.replace(/["']/g, '');
    }
    photoUrl = getCompletePhotoUrl(cleanPhotoUrl);
  }
  
  if (photoUrl && !imageError) {
    photoSource = { uri: photoUrl };
    console.log('URL de la photo de l\'élève dans EleveAvatar:', photoUrl);
  }
  
  // Styles dynamiques basés sur la taille
  const dynamicStyles = {
    container: {
      width: avatarSize,
      height: avatarSize,
      borderRadius: avatarSize / 2,
    },
    placeholder: {
      width: avatarSize,
      height: avatarSize,
      borderRadius: avatarSize / 2,
      backgroundColor: '#0066cc',
    },
    placeholderText: {
      fontSize: avatarSize * 0.4,
    }
  };
  
  // Obtenir l'initiale pour le placeholder
  const getInitial = () => {
    if (eleve?.prenom) {
      return eleve.prenom.charAt(0).toUpperCase();
    }
    return '?';
  };
  
  return (
    <View style={[styles.container, dynamicStyles.container, style]}>
      {photoSource && !imageError ? (
        <Image 
          source={photoSource}
          style={[styles.image, dynamicStyles.container]}
          resizeMode="cover"
          onError={(e) => {
            console.log('Erreur de chargement de l\'image dans EleveAvatar:', e.nativeEvent.error);
            console.log('URL de l\'image qui a échoué:', photoSource.uri);
            setImageError(true);
          }}
        />
      ) : (
        <View style={[styles.placeholder, dynamicStyles.placeholder]}>
          <Text style={[styles.placeholderText, dynamicStyles.placeholderText]}>
            {getInitial()}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  image: {
    width: '100%',
    height: '100%',
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#e1e1e1',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  placeholderText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default EleveAvatar;
