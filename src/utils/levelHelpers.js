// src/utils/levelHelpers.js
// Utility functions for translating level IDs, normalizing level strings, and mapping legacy schools to levels.

/**
 * Normalizes any level string (Arabic, French, abbreviated, or key) to a standard level ID.
 * @param {string} rawLevel - The input level string (e.g. 'TC', 'جدع مشترك', '2bac_pc_svt')
 * @returns {string} One of the standard level IDs
 */
export const normalizeLevel = (rawLevel) => {
  if (!rawLevel) return 'common_core_sci';
  const normalized = String(rawLevel).toLowerCase().trim();
  
  // 1. Tronc Commun / الجدع المشترك (Check FIRST so 'math' / 'sci' don't hijack to 2bac)
  if (
    normalized.includes('common_core') ||
    normalized.includes('common-core') ||
    normalized.includes('tronc') ||
    normalized.includes('commun') ||
    normalized.includes('جدع') ||
    normalized.includes('مشترك') ||
    normalized === 'tc' ||
    normalized === 'tcs' ||
    normalized === 'tca' ||
    normalized === 'tck' ||
    normalized.startsWith('tc_') ||
    normalized.startsWith('tc-') ||
    normalized.startsWith('tc ')
  ) {
    if (
      normalized.includes('art') ||
      normalized.includes('lettre') ||
      normalized.includes('آداب') ||
      normalized.includes('إنسانية') ||
      normalized.includes('_arts') ||
      normalized === 'tca'
    ) {
      return 'common_core_arts';
    }
    return 'common_core_sci';
  }

  // 2. 1ère Bac / الأولى بكالوريا
  if (
    normalized.includes('1bac') ||
    normalized.includes('1_bac') ||
    normalized.includes('1-bac') ||
    normalized.includes('أولى') ||
    normalized.includes('1ère') ||
    normalized.includes('première')
  ) {
    if (
      normalized.includes('art') ||
      normalized.includes('lettre') ||
      normalized.includes('آداب') ||
      normalized.includes('إنسانية')
    ) {
      return '1bac_arts';
    }
    return '1bac_sci';
  }

  // 3. 2ème Bac Sciences Mathématiques
  if (
    normalized.includes('2bac_sm') ||
    normalized.includes('2bac-sm') ||
    normalized.includes('2bac sm') ||
    normalized.includes('علوم رياضية') ||
    normalized.includes('علوم رياضيات')
  ) {
    return '2bac_sm';
  }

  // 4. 2ème Bac Lettres / Arts
  if (
    (normalized.includes('2bac') || normalized.includes('ثانية')) &&
    (normalized.includes('art') || normalized.includes('lettre') || normalized.includes('آداب') || normalized.includes('إنسانية'))
  ) {
    return '2bac_arts';
  }

  // 5. 2ème Bac PC / SVT (Default for 2bac / science)
  if (
    normalized.includes('2bac') ||
    normalized.includes('ثانية') ||
    normalized.includes('pc') ||
    normalized.includes('svt') ||
    normalized.includes('تجريبية')
  ) {
    return '2bac_pc_svt';
  }

  // 6. Concours & School names detection
  if (
    normalized.includes('médecine') ||
    normalized.includes('medecine') ||
    normalized.includes('pharmacie') ||
    normalized.includes('fmp') ||
    normalized.includes('fmd') ||
    normalized.includes('dentaire') ||
    normalized.includes('encg')
  ) {
    return '2bac_pc_svt';
  }

  if (
    normalized.includes('ensa') ||
    normalized.includes('ensam') ||
    normalized.includes('inpt') ||
    normalized.includes('insea') ||
    normalized.includes('prépa') ||
    normalized.includes('prepa') ||
    normalized.includes('cpge') ||
    normalized.includes('cnc') ||
    normalized.includes('apesa')
  ) {
    return '2bac_sm';
  }

  const validKeys = ['common_core_sci', 'common_core_arts', '1bac_sci', '1bac_arts', '2bac_sm', '2bac_pc_svt', '2bac_arts'];
  if (validKeys.includes(rawLevel)) {
    return rawLevel;
  }
  
  return 'common_core_sci';
};

/**
 * Returns the human-readable display name of a level.
 * @param {string} id - The level ID (e.g., '2bac_sm')
 * @param {boolean} isArabic - Whether to return the name in Arabic
 * @returns {string} The display name
 */
export const getLevelDisplayName = (id, isArabic = false) => {
  const normId = normalizeLevel(id);
  switch (normId) {
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
  if (!sch) return 'common_core_sci';
  const s = String(sch).toLowerCase().trim();
  if (
    s.includes('médecine') ||
    s.includes('medecine') ||
    s.includes('pharmacie') ||
    s.includes('fmp') ||
    s.includes('fmd') ||
    s.includes('dentaire') ||
    s.includes('encg')
  ) {
    return '2bac_pc_svt';
  }
  if (
    s.includes('ensa') ||
    s.includes('ensam') ||
    s.includes('inpt') ||
    s.includes('insea') ||
    s.includes('prépa') ||
    s.includes('prepa') ||
    s.includes('cpge') ||
    s.includes('cnc') ||
    s.includes('apesa')
  ) {
    return '2bac_sm';
  }
  return normalizeLevel(sch);
};
