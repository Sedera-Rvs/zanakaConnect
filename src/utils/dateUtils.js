/**
 * Formatte une date au format relatif (il y a X minutes, heures, etc.)
 * @param {Date} date - La date à formater
 * @returns {string} - Le texte formaté
 */
export const formatRelativeTime = (date) => {
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'À l\'instant';
  } else if (diffMin < 60) {
    return `Il y a ${diffMin} min`;
  } else if (diffHour < 24) {
    return `Il y a ${diffHour}h`;
  } else if (diffDay < 7) {
    return `Il y a ${diffDay}j`;
  } else {
    return formatDate(date);
  }
};

/**
 * Formatte une date au format court (JJ/MM/AAAA)
 * @param {Date} date - La date à formater
 * @returns {string} - Le texte formaté
 */
export const formatDate = (date) => {
  // Vérifier si date est définie
  if (!date) {
    return '';
  }
  
  // Convertir en objet Date si c'est une chaîne de caractères
  let dateObj;
  try {
    dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Vérifier si la date est valide
    if (isNaN(dateObj.getTime())) {
      console.warn('Date invalide:', date);
      return '';
    }
    
    return dateObj.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch (error) {
    console.error('Erreur lors du formatage de la date:', error, date);
    return '';
  }
};

/**
 * Formatte une date pour afficher seulement l'heure (HH:MM)
 * @param {Date} date - La date à formater
 * @returns {string} - L'heure formatée
 */
export const formatTime = (date) => {
  // Vérifier si date est définie
  if (!date) {
    return '';
  }
  
  // Convertir en objet Date si c'est une chaîne de caractères
  let dateObj;
  try {
    dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Vérifier si la date est valide
    if (isNaN(dateObj.getTime())) {
      console.warn('Date invalide:', date);
      return '';
    }
    
    return dateObj.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    console.error('Erreur lors du formatage de l\'heure:', error, date);
    return '';
  }
};

/**
 * Vérifie si deux dates sont le même jour
 * @param {Date} date1 - Première date
 * @param {Date} date2 - Deuxième date
 * @returns {boolean} - True si les dates sont le même jour
 */
export const isSameDay = (date1, date2) => {
  // Vérifier si les dates sont définies
  if (!date1 || !date2) {
    return false;
  }
  
  try {
    // Convertir en objets Date si ce sont des chaînes de caractères
    const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
    const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
    
    // Vérifier si les dates sont valides
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
      console.warn('Dates invalides:', date1, date2);
      return false;
    }
    
    return (
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear()
    );
  } catch (error) {
    console.error('Erreur lors de la comparaison des dates:', error, date1, date2);
    return false;
  }
};

/**
 * Formatte une date pour l'affichage dans un en-tête de section
 * @param {Date} date - La date à formater
 * @returns {string} - Le texte formaté
 */
export const formatMessageDate = (date) => {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(date, now)) {
    return 'Aujourd\'hui';
  } else if (isSameDay(date, yesterday)) {
    return 'Hier';
  } else {
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }
};
