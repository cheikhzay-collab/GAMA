// src/utils/levelHelpers.js
// Utility functions for translating level IDs and mapping legacy schools to levels.

/**
 * Returns the human-readable display name of a level.
 * @param {string} id - The level ID (e.g., '2bac_sm')
 * @param {boolean} isArabic - Whether to return the name in Arabic
 * @returns {string} The display name
 */
export const getLevelDisplayName = (id, isArabic = false) => {
  switch (id) {
    case 'common_core_sci': return isArabic ? 'جدع مشترك علوم' : 'Tronc Commun Scientifique';
    case 'common_core_arts': return isArabic ? 'جدع مشترك آداب' : 'Tronc Commun Littéraire';
    case '1bac_sci': return isArabic ? 'أولى باك علوم تجريبية' : '1ère Bac Sciences Expérimentales';
    case '1bac_arts': return isArabic ? 'أولى باك آداب' : '1ère Bac Littéraire';
    case '2bac_sm': return isArabic ? 'ثانية باك علوم رياضية' : '2ème Bac Sciences Mathématiques';
    case '2bac_pc_svt': return isArabic ? 'ثانية باك علوم تجريبية (PC/SVT)' : '2ème Bac Sciences Expérimentales (PC/SVT)';
    case '2bac_arts': return isArabic ? 'ثانية باك آداب' : '2ème Bac Lettres & Sciences Humaines';
    default: return id;
  }
};

/**
 * Maps legacy school names (used in L'CONQ) to level IDs.
 * @param {string} sch - The legacy school name
 * @returns {string} The matched level ID
 */
export const mapLegacySchoolToLevel = (sch) => {
  if (!sch) return sch;
  if (sch === 'Médecine / Pharmacie' || sch === 'ENCG') return '2bac_pc_svt';
  if (['ENSA', 'ENSAM', 'INPT', 'INSEA', 'Général (Prépa)'].includes(sch)) return '2bac_sm';
  return sch;
};
