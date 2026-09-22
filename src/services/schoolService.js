// src/services/schoolService.js
// Service for schools list and per-school branding with SWR caching.
// Supports Neon PostgreSQL and Local Companion API with graceful network error handling.

import { localDb } from '../lib/localDbClient';
import { queryCache } from './queryCache';
import { neonSaveConfig, neonGetConfig } from '../lib/neon';

const DEFAULT_SCHOOLS = [
  '2bac_sm',
  '2bac_pc_svt',
  '1bac_sci',
  'common_core_sci',
  '2bac_arts',
  '1bac_arts',
  'common_core_arts'
];

/**
 * Fetch schools config with SWR caching.
 */
export const getSchoolsConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('config_schools', async () => {
    // 1. Try Neon
    try {
      const neonVal = await neonGetConfig('schools');
      if (neonVal) {
        return {
          schools: neonVal.schools || DEFAULT_SCHOOLS,
          branding: neonVal.branding || {},
        };
      }
    } catch (neonErr) {
      console.warn('[Neon] getSchoolsConfig error:', neonErr.message);
    }


    try {
      const config = await localDb.get('/config');
      const val = config['schools_config'] || {};
      return {
        schools: val.schools || config.schools || DEFAULT_SCHOOLS,
        branding: val.branding || config.schoolBranding || {},
      };
    } catch (err) {
      return { schools: DEFAULT_SCHOOLS, branding: {} };
    }
  }, {
    forceRefresh,
    staleTime: 1000 * 60 * 10,
    cacheTime: 1000 * 60 * 60
  });
};

/**
 * Save the full schools config.
 */
export const saveSchoolsConfig = async (schools, branding) => {
  queryCache.invalidate('config_schools');

  // 1. Sync to Neon PostgreSQL
  try {
    await neonSaveConfig('schools', { schools, branding });
  } catch (err) {
    console.warn('[Neon] Error saving schools config:', err);
  }


  try {
    await localDb.post('/config', { schools_config: { schools, branding } });
  } catch (err) {
    console.warn('[LocalDB] Failed to save schools config locally:', err.message || err);
  }
};

/**
 * Fetch general platform branding with SWR caching.
 */
export const getBrandingConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('config_branding', async () => {
    // 1. Try Neon
    try {
      const neonVal = await neonGetConfig('branding');
      if (neonVal) return neonVal;
    } catch (neonErr) {
      console.warn('[Neon] getBrandingConfig error:', neonErr.message);
    }


    try {
      const config = await localDb.get('/config');
      return config['branding'] || null;
    } catch (err) {
      return null;
    }
  }, {
    forceRefresh,
    staleTime: 1000 * 60 * 10,
    cacheTime: 1000 * 60 * 60
  });
};

/**
 * Save general platform branding.
 */
export const saveBrandingConfig = async (branding) => {
  queryCache.invalidate('config_branding');

  // 1. Sync to Neon PostgreSQL
  try {
    await neonSaveConfig('branding', branding);
  } catch (err) {
    console.warn('[Neon] Error saving branding config:', err);
  }


  try {
    await localDb.post('/config', { branding });
  } catch (err) {
    console.warn('[LocalDB] Failed to save branding config locally:', err.message || err);
  }
};

/**
 * Fetch flashcard settings with SWR caching.
 */
export const getFlashcardSettingsConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('config_flashcard_settings', async () => {
    // 1. Try Neon PostgreSQL
    try {
      const neonVal = await neonGetConfig('flashcard_settings');
      if (neonVal !== null && neonVal !== undefined) return neonVal;
    } catch (neonErr) {
      console.warn('[Neon] Error fetching flashcard_settings:', neonErr.message);
    }

    try {
      const config = await localDb.get('/config');
      return config['flashcard_settings'] || null;
    } catch (err) {
      return null;
    }
  }, {
    forceRefresh,
    staleTime: 1000 * 60 * 10,
    cacheTime: 1000 * 60 * 60
  });
};

/**
 * Save flashcard settings.
 */
export const saveFlashcardSettingsConfig = async (settings) => {
  queryCache.invalidate('config_flashcard_settings');

  // 1. Sync to Neon PostgreSQL
  try {
    await neonSaveConfig('flashcard_settings', settings);
  } catch (err) {
    console.warn('[Neon] Error saving flashcard settings:', err);
  }


  try {
    await localDb.post('/config', { flashcard_settings: settings });
  } catch (err) {
    console.warn('[LocalDB] Failed to save flashcard settings locally:', err.message || err);
  }
};

/**
 * Fetch PDF styling settings with SWR caching.
 */
export const getPdfSettingsConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('config_pdf_settings', async () => {
    // 1. Try Neon PostgreSQL
    try {
      const neonVal = await neonGetConfig('pdf_settings');
      if (neonVal !== null && neonVal !== undefined) return neonVal;
    } catch (neonErr) {
      console.warn('[Neon] Error fetching pdf_settings:', neonErr.message);
    }

    try {
      const config = await localDb.get('/config');
      return config['pdf_settings'] || null;
    } catch (err) {
      return null;
    }
  }, {
    forceRefresh,
    staleTime: 1000 * 60 * 10,
    cacheTime: 1000 * 60 * 60
  });
};

/**
 * Save PDF styling settings.
 */
export const savePdfSettingsConfig = async (settings) => {
  queryCache.invalidate('config_pdf_settings');

  // 1. Sync to Neon PostgreSQL
  try {
    await neonSaveConfig('pdf_settings', settings);
  } catch (err) {
    console.warn('[Neon] Error saving PDF settings:', err);
  }


  try {
    await localDb.post('/config', { pdf_settings: settings });
  } catch (err) {
    console.warn('[LocalDB] Failed to save PDF settings locally:', err.message || err);
  }
};

/**
 * Fetch OMR scanner settings with SWR caching.
 */
export const getOmrScannerSettingsConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('config_omr_scanner_settings', async () => {
    // 1. Try Neon PostgreSQL
    try {
      const neonVal = await neonGetConfig('omr_scanner_settings');
      if (neonVal !== null && neonVal !== undefined) return neonVal;
    } catch (neonErr) {
      console.warn('[Neon] Error fetching omr_scanner_settings:', neonErr.message);
    }

    try {
      const config = await localDb.get('/config');
      return config['omr_scanner_settings'] || null;
    } catch (err) {
      return null;
    }
  }, {
    forceRefresh,
    staleTime: 1000 * 60 * 10,
    cacheTime: 1000 * 60 * 60
  });
};

/**
 * Save OMR scanner settings.
 */
export const saveOmrScannerSettingsConfig = async (settings) => {
  queryCache.invalidate('config_omr_scanner_settings');

  // 1. Sync to Neon PostgreSQL
  try {
    await neonSaveConfig('omr_scanner_settings', settings);
  } catch (err) {
    console.warn('[Neon] Error saving OMR scanner settings:', err);
  }


  try {
    await localDb.post('/config', { omr_scanner_settings: settings });
  } catch (err) {
    console.warn('[LocalDB] Failed to save OMR scanner settings locally:', err.message || err);
  }
};

/**
 * Fetch WhatsApp floating button settings with SWR caching.
 */
export const getWhatsAppSettingsConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('config_whatsapp_settings', async () => {
    // 1. Try Neon PostgreSQL
    try {
      const neonVal = await neonGetConfig('whatsapp_settings');
      if (neonVal !== null && neonVal !== undefined) return neonVal;
    } catch (neonErr) {
      console.warn('[Neon] Error fetching whatsapp_settings:', neonErr.message);
    }

    try {
      const config = await localDb.get('/config');
      return config['whatsapp_settings'] || null;
    } catch (err) {
      return null;
    }
  }, {
    forceRefresh,
    staleTime: 1000 * 60 * 10,
    cacheTime: 1000 * 60 * 60
  });
};

/**
 * Save WhatsApp floating button settings.
 */
export const saveWhatsAppSettingsConfig = async (settings) => {
  queryCache.invalidate('config_whatsapp_settings');

  // 1. Sync to Neon PostgreSQL
  try {
    await neonSaveConfig('whatsapp_settings', settings);
  } catch (err) {
    console.warn('[Neon] Error saving WhatsApp settings:', err);
  }


  try {
    await localDb.post('/config', { whatsapp_settings: settings });
  } catch (err) {
    console.warn('[LocalDB] Failed to save WhatsApp settings locally:', err.message || err);
  }
};

/**
 * Fetch subscription plans shared by the admin dashboard and sales pages.
 */
export const getPlansConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('config_plans', async () => {
    // 1. Try Neon PostgreSQL
    try {
      const neonVal = await neonGetConfig('plans');
      if (neonVal !== null && neonVal !== undefined) return neonVal;
    } catch (neonErr) {
      console.warn('[Neon] Error fetching plans:', neonErr.message);
    }

    try {
      const config = await localDb.get('/config');
      return Array.isArray(config.plans) ? config.plans : null;
    } catch (err) {
      return null;
    }
  }, {
    forceRefresh,
    staleTime: 1000 * 60 * 10,
    cacheTime: 1000 * 60 * 60
  });
};

export const getPlans = getPlansConfig;

/**
 * Persist subscription plans in the active data source.
 */
export const savePlansConfig = async (plans) => {
  queryCache.invalidate('config_plans');

  // 1. Sync to Neon PostgreSQL
  try {
    await neonSaveConfig('plans', plans);
  } catch (err) {
    console.warn('[Neon] Error saving plans config:', err);
  }


  try {
    await localDb.post('/config', { plans });
  } catch (err) {
    console.warn('[LocalDB] Failed to save plans config locally:', err.message || err);
  }
};

export const savePlans = savePlansConfig;

/**
 * Fetch dynamic Arabic sales page config with SWR caching.
 */
export const getLandingArConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('config_landing_ar', async () => {
    // 1. Try Neon PostgreSQL
    try {
      const neonVal = await neonGetConfig('landing_ar_settings');
      if (neonVal !== null && neonVal !== undefined) return neonVal;
    } catch (neonErr) {
      console.warn('[Neon] Error fetching landing_ar_settings:', neonErr.message);
    }

    try {
      const config = await localDb.get('/config');
      return config['landing_ar_settings'] || null;
    } catch (err) {
      return null;
    }
  }, {
    forceRefresh,
    staleTime: 1000 * 60 * 10,
    cacheTime: 1000 * 60 * 60
  });
};

/**
 * Save dynamic Arabic sales page config.
 */
export const saveLandingArConfig = async (landingConfig) => {
  queryCache.invalidate('config_landing_ar');

  // 1. Sync to Neon PostgreSQL
  try {
    await neonSaveConfig('landing_ar_settings', landingConfig);
  } catch (err) {
    console.warn('[Neon] Error saving landing AR config:', err);
  }


  try {
    await localDb.post('/config', { landing_ar_settings: landingConfig });
  } catch (err) {
    console.warn('[LocalDB] Failed to save landing AR settings locally:', err.message || err);
  }
};

/**
 * Fetch AI Engine & API Keys settings with SWR caching.
 */
export const getAiSettingsConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('config_ai_settings', async () => {
    // 1. Try Neon PostgreSQL
    try {
      const neonVal = await neonGetConfig('ai_settings');
      if (neonVal !== null && neonVal !== undefined) return neonVal;
    } catch (neonErr) {
      console.warn('[Neon] Error fetching ai_settings:', neonErr.message);
    }

    try {
      const config = await localDb.get('/config');
      return config['ai_settings'] || null;
    } catch (err) {
      return null;
    }
  }, {
    forceRefresh,
    staleTime: 1000 * 60 * 10,
    cacheTime: 1000 * 60 * 60
  });
};

/**
 * Save AI Engine & API Keys settings to Neon PostgreSQL config table.
 */
export const saveAiSettingsConfig = async (settings) => {
  queryCache.invalidate('config_ai_settings');

  // 1. Sync to Neon PostgreSQL
  try {
    await neonSaveConfig('ai_settings', settings);
  } catch (err) {
    console.warn('[Neon] Error saving AI settings:', err);
  }


  try {
    await localDb.post('/config', { ai_settings: settings });
  } catch (err) {
    console.warn('[LocalDB] Failed to save AI settings locally:', err.message || err);
  }
};

/**
 * Fetch School Holidays with Cloud DB sync & local fallback.
 */
export const getSchoolHolidaysConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('config_school_holidays', async () => {
    // 1. Neon PostgreSQL
    try {
      const neonVal = await neonGetConfig('school_holidays');
      if (Array.isArray(neonVal) && neonVal.length > 0) {
        try { localStorage.setItem('school_holidays', JSON.stringify(neonVal)); } catch (_) {}
        return neonVal;
      }
    } catch (neonErr) {
      console.warn('[Neon] getSchoolHolidaysConfig error:', neonErr.message);
    }


    // 3. Companion DB (Local Database)
    try {
      const config = await localDb.get('/config');
      if (config && Array.isArray(config.school_holidays) && config.school_holidays.length > 0) {
        try { localStorage.setItem('school_holidays', JSON.stringify(config.school_holidays)); } catch (_) {}
        return config.school_holidays;
      }
    } catch (_) {}

    // 4. LocalStorage fallback
    try {
      const raw = localStorage.getItem('school_holidays');
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }, {
    forceRefresh,
    staleTime: 1000 * 60 * 10,
    cacheTime: 1000 * 60 * 60
  });
};

/**
 * Standard official Moroccan school holidays preset for an academic year.
 */
export const getOfficialMoroccanHolidays = (academicYear = '2026-2027') => {
  const startYear = parseInt(String(academicYear).split(/[-/]/)[0], 10) || 2026;
  const nextYear = startYear + 1;

  return [
    {
      id: `hol-mowlid-${startYear}`,
      label: 'عيد المولد النبوي الشريف',
      startDate: `${startYear}-09-15`,
      endDate: `${startYear}-09-16`
    },
    {
      id: `hol-bainiya-1-${startYear}`,
      label: 'عطلة الفترة البينية الأولى',
      startDate: `${startYear}-10-20`,
      endDate: `${startYear}-10-27`
    },
    {
      id: `hol-marche-verte-${startYear}`,
      label: 'ذكرى المسيرة الخضراء',
      startDate: `${startYear}-11-06`,
      endDate: `${startYear}-11-06`
    },
    {
      id: `hol-independance-${startYear}`,
      label: 'عيد الاستقلال',
      startDate: `${startYear}-11-18`,
      endDate: `${startYear}-11-18`
    },
    {
      id: `hol-bainiya-2-${startYear}`,
      label: 'عطلة الفترة البينية الثانية',
      startDate: `${startYear}-12-08`,
      endDate: `${startYear}-12-15`
    },
    {
      id: `hol-nouvel-an-${nextYear}`,
      label: 'رأس السنة الميلادية',
      startDate: `${nextYear}-01-01`,
      endDate: `${nextYear}-01-01`
    },
    {
      id: `hol-manifeste-${nextYear}`,
      label: 'ذكرى تقديم وثيقة الاستقلال',
      startDate: `${nextYear}-01-11`,
      endDate: `${nextYear}-01-11`
    },
    {
      id: `hol-yennayer-${nextYear}`,
      label: 'رأس السنة الأمازيغية',
      startDate: `${nextYear}-01-14`,
      endDate: `${nextYear}-01-14`
    },
    {
      id: `hol-mi-semestre-${nextYear}`,
      label: 'عطلة منتصف السنة الدراسية',
      startDate: `${nextYear}-01-26`,
      endDate: `${nextYear}-02-02`
    },
    {
      id: `hol-bainiya-3-${nextYear}`,
      label: 'عطلة الفترة البينية الثالثة',
      startDate: `${nextYear}-03-16`,
      endDate: `${nextYear}-03-23`
    },
    {
      id: `hol-aid-fitr-${nextYear}`,
      label: 'عطلة عيد الفطر السعيد',
      startDate: `${nextYear}-03-30`,
      endDate: `${nextYear}-04-02`
    },
    {
      id: `hol-travail-${nextYear}`,
      label: 'عيد الشغل',
      startDate: `${nextYear}-05-01`,
      endDate: `${nextYear}-05-01`
    },
    {
      id: `hol-bainiya-4-${nextYear}`,
      label: 'عطلة الفترة البينية الرابعة',
      startDate: `${nextYear}-05-04`,
      endDate: `${nextYear}-05-11`
    },
    {
      id: `hol-aid-adha-${nextYear}`,
      label: 'عطلة عيد الأضحى المبارك',
      startDate: `${nextYear}-06-06`,
      endDate: `${nextYear}-06-10`
    },
    {
      id: `hol-1er-moharram-${nextYear}`,
      label: 'فاتح محرم - رأس السنة الهجرية',
      startDate: `${nextYear}-06-26`,
      endDate: `${nextYear}-06-26`
    }
  ];
};

/**
 * Save School Holidays to Cloud DB (Neon PostgreSQL) and LocalStorage.
 */
export const saveSchoolHolidaysConfig = async (holidays) => {
  try { localStorage.setItem('school_holidays', JSON.stringify(holidays)); } catch (_) {}

  try {
    await queryCache.set('config_school_holidays', holidays);
  } catch (_) {
    queryCache.invalidate('config_school_holidays');
  }

  const tasks = [];

  // 1. Sync to Neon PostgreSQL
  tasks.push(
    neonSaveConfig('school_holidays', holidays).catch(err => {
      console.warn('[Neon] Error saving school holidays:', err);
    })
  );


  // 3. Companion DB
  tasks.push(
    localDb.post('/config', { school_holidays: holidays }).catch(() => {})
  );

  await Promise.allSettled(tasks);
  return { success: true };
};

/**
 * Fetch Teacher Absences / Leaves (الرخص والغيابات) with Cloud DB sync.
 */
export const getTeacherAbsencesConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('config_teacher_absences', async () => {
    // 1. Neon PostgreSQL
    try {
      const neonVal = await neonGetConfig('teacher_absences');
      if (Array.isArray(neonVal) && neonVal.length > 0) {
        try { localStorage.setItem('teacher_absences', JSON.stringify(neonVal)); } catch (_) {}
        return neonVal;
      }
    } catch (neonErr) {
      console.warn('[Neon] getTeacherAbsencesConfig error:', neonErr.message);
    }


    // 3. Companion DB (Local Database)
    try {
      const config = await localDb.get('/config');
      if (config && Array.isArray(config.teacher_absences) && config.teacher_absences.length > 0) {
        try { localStorage.setItem('teacher_absences', JSON.stringify(config.teacher_absences)); } catch (_) {}
        return config.teacher_absences;
      }
    } catch (_) {}

    // 4. LocalStorage fallback
    try {
      const raw = localStorage.getItem('teacher_absences');
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }, {
    forceRefresh,
    staleTime: 1000 * 60 * 10,
    cacheTime: 1000 * 60 * 60
  });
};

/**
 * Save Teacher Absences / Leaves (الرخص والغيابات) to Cloud DB.
 */
export const saveTeacherAbsencesConfig = async (absences) => {
  try { localStorage.setItem('teacher_absences', JSON.stringify(absences)); } catch (_) {}

  try {
    await queryCache.set('config_teacher_absences', absences);
  } catch (_) {
    queryCache.invalidate('config_teacher_absences');
  }

  const tasks = [];

  // 1. Sync to Neon PostgreSQL
  tasks.push(
    neonSaveConfig('teacher_absences', absences).catch(err => {
      console.warn('[Neon] Error saving teacher absences:', err);
    })
  );


  // 3. Companion DB
  tasks.push(
    localDb.post('/config', { teacher_absences: absences }).catch(() => {})
  );

  await Promise.allSettled(tasks);
  return { success: true };
};

/**
 * Fetch Teacher Schedule / Timetable (جدول حصص الأستاذ) with Cloud DB sync.
 */
export const getTeacherScheduleConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  // Check local cache & last local update timestamp
  let localSchedule = null;
  let localUpdatedAt = 0;
  try {
    const raw = localStorage.getItem('teacher_schedule_current');
    if (raw) localSchedule = JSON.parse(raw);
    localUpdatedAt = parseInt(localStorage.getItem('teacher_schedule_updated_at') || '0', 10);
  } catch (_) {}

  return queryCache.fetchWithCache('config_teacher_schedule', async () => {
    let cloudVal = null;

    // 1. Neon PostgreSQL
    try {
      const neonVal = await neonGetConfig('teacher_schedule_current');
      if (neonVal && typeof neonVal === 'object' && Object.keys(neonVal).length > 0) {
        cloudVal = neonVal;
      }
    } catch (neonErr) {
      console.warn('[Neon] getTeacherScheduleConfig error:', neonErr.message);
    }


    // 3. Companion DB (Local Database)
    if (!cloudVal) {
      try {
        const config = await localDb.get('/config');
        if (config && config.teacher_schedule_current && typeof config.teacher_schedule_current === 'object' && Object.keys(config.teacher_schedule_current).length > 0) {
          cloudVal = config.teacher_schedule_current;
        }
      } catch (_) {}
    }

    // Guard against race condition: if local was updated recently (< 5 mins) and not forceRefresh,
    // preserve local changes so an in-flight or stale cloud query does not wipe them out.
    const isRecentlyUpdatedLocally = localSchedule && (Date.now() - localUpdatedAt < 1000 * 60 * 5);
    if (isRecentlyUpdatedLocally && !forceRefresh) {
      return localSchedule;
    }

    if (cloudVal) {
      try {
        localStorage.setItem('teacher_schedule_current', JSON.stringify(cloudVal));
      } catch (_) {}
      return cloudVal;
    }

    // 4. LocalStorage fallback
    return localSchedule || {};
  }, {
    forceRefresh,
    staleTime: 1000 * 60 * 5,
    cacheTime: 1000 * 60 * 30
  });
};

/**
 * Save Teacher Schedule / Timetable (جدول حصص الأستاذ) to Cloud DB.
 */
export const saveTeacherScheduleConfig = async (schedule) => {
  const now = Date.now();
  try {
    localStorage.setItem('teacher_schedule_current', JSON.stringify(schedule));
    localStorage.setItem('teacher_schedule_updated_at', String(now));
  } catch (_) {}

  // Update queryCache directly with fresh data
  try {
    await queryCache.set('config_teacher_schedule', schedule);
  } catch (_) {
    queryCache.invalidate('config_teacher_schedule');
  }

  const tasks = [];

  // 1. Sync to Neon PostgreSQL
  tasks.push(
    neonSaveConfig('teacher_schedule_current', schedule).catch(err => {
      console.warn('[Neon] Error saving teacher schedule:', err);
    })
  );


  // 3. Companion DB
  tasks.push(
    localDb.post('/config', { teacher_schedule_current: schedule }).catch(() => {})
  );

  await Promise.allSettled(tasks);
  return { success: true };
};

/**
 * Fetch Logbook Styling & Typography Settings (إعدادات دفتر النصوص).
 */
export const getLogbookStyleConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('config_logbook_style', async () => {
    // 1. Neon PostgreSQL
    try {
      const neonVal = await neonGetConfig('logbook_style_settings');
      if (neonVal && typeof neonVal === 'object') {
        return neonVal;
      }
    } catch (neonErr) {
      console.warn('[Neon] getLogbookStyleConfig error:', neonErr.message);
    }


    // 3. Companion DB (Local Database)
    try {
      const config = await localDb.get('/config');
      if (config && config.logbook_style_settings && typeof config.logbook_style_settings === 'object') {
        return config.logbook_style_settings;
      }
    } catch (_) {}

    // 4. Fallback to localStorage individual keys
    try {
      return {
        arFont: localStorage.getItem('logbook_ar_font') || 'UKIJ Merdane',
        frFont: localStorage.getItem('logbook_fr_font') || 'Outfit',
        fontSize: localStorage.getItem('logbook_font_size') || '0.8rem',
        lineHeight: parseInt(localStorage.getItem('logbook_line_height') || '20', 10),
        colorInk: localStorage.getItem('logbook_color_ink') || '#334155',
        colorChapter: localStorage.getItem('logbook_color_chapter') || '#0f172a',
        colorAxis: localStorage.getItem('logbook_color_axis') || '#2563eb',
        colorExercise: localStorage.getItem('logbook_color_exercise') || '#d97706',
      };
    } catch (_) {
      return null;
    }
  }, {
    forceRefresh,
    staleTime: 1000 * 60 * 10,
    cacheTime: 1000 * 60 * 60
  });
};

/**
 * Save Logbook Styling & Typography Settings to Cloud DB.
 */
export const saveLogbookStyleConfig = async (settings) => {
  // Update localStorage keys
  try {
    if (settings.arFont) localStorage.setItem('logbook_ar_font', settings.arFont);
    if (settings.frFont) localStorage.setItem('logbook_fr_font', settings.frFont);
    if (settings.fontSize) localStorage.setItem('logbook_font_size', settings.fontSize);
    if (settings.lineHeight) localStorage.setItem('logbook_line_height', String(settings.lineHeight));
    if (settings.colorInk) localStorage.setItem('logbook_color_ink', settings.colorInk);
    if (settings.colorChapter) localStorage.setItem('logbook_color_chapter', settings.colorChapter);
    if (settings.colorAxis) localStorage.setItem('logbook_color_axis', settings.colorAxis);
    if (settings.colorExercise) localStorage.setItem('logbook_color_exercise', settings.colorExercise);
  } catch (_) {}

  try {
    await queryCache.set('config_logbook_style', settings);
  } catch (_) {
    queryCache.invalidate('config_logbook_style');
  }

  const tasks = [];

  // 1. Sync to Neon PostgreSQL
  tasks.push(
    neonSaveConfig('logbook_style_settings', settings).catch(err => {
      console.warn('[Neon] Error saving logbook style settings:', err);
    })
  );


  // 3. Companion DB
  tasks.push(
    localDb.post('/config', { logbook_style_settings: settings }).catch(() => {})
  );

  await Promise.allSettled(tasks);
  return { success: true };
};

/**
 * Fetch Classes Settings (إعدادات الأقسام).
 */
export const getClassesSettingsConfig = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('config_classes_settings', async () => {
    // 1. Neon PostgreSQL
    try {
      const neonVal = await neonGetConfig('classes_settings');
      if (neonVal && typeof neonVal === 'object') {
        return neonVal;
      }
    } catch (neonErr) {
      console.warn('[Neon] getClassesSettingsConfig error:', neonErr.message);
    }


    // 3. LocalStorage fallback
    try {
      const raw = localStorage.getItem('classes_settings');
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }, {
    forceRefresh,
    staleTime: 1000 * 60 * 10,
    cacheTime: 1000 * 60 * 60
  });
};

/**
 * Save Classes Settings (إعدادات الأقسام) to Cloud DB.
 */
export const saveClassesSettingsConfig = async (settings) => {
  queryCache.invalidate('config_classes_settings');
  try { localStorage.setItem('classes_settings', JSON.stringify(settings)); } catch (_) {}

  // 1. Sync to Neon PostgreSQL
  try {
    await neonSaveConfig('classes_settings', settings);
  } catch (err) {
    console.warn('[Neon] Error saving classes settings:', err);
  }


  // 3. Companion DB
  try {
    await localDb.post('/config', { classes_settings: settings });
  } catch (_) {}
};

/**
 * Master Bidirectional Synchronization for Schedule & All System Settings
 * Synchronizes Neon PostgreSQL and LocalStorage / Companion DB in one unified operation.
 */
export const syncAllConfigsAndSchedule = async () => {
  const syncResults = {
    scheduleSlots: 0,
    holidaysCount: 0,
    syncedKeys: [],
    errors: []
  };

  try {
    // 1. Force refresh configurations from primary Cloud DB (Neon)
    const [cloudSched, cloudHols, cloudStyle, cloudAi, cloudBranding, cloudPdf, cloudFlash, cloudWa] = await Promise.allSettled([
      getTeacherScheduleConfig({ forceRefresh: true }),
      getSchoolHolidaysConfig({ forceRefresh: true }),
      getLogbookStyleConfig({ forceRefresh: true }),
      getAiSettingsConfig({ forceRefresh: true }),
      getBrandingConfig({ forceRefresh: true }),
      getPdfSettingsConfig({ forceRefresh: true }),
      getFlashcardSettingsConfig({ forceRefresh: true }),
      getWhatsAppSettingsConfig({ forceRefresh: true })
    ]);

    // 2. Save & mirror to Companion DB
    if (cloudSched.status === 'fulfilled' && cloudSched.value) {
      await saveTeacherScheduleConfig(cloudSched.value);
      syncResults.scheduleSlots = Object.keys(cloudSched.value).length;
      syncResults.syncedKeys.push('teacher_schedule_current');
    }

    if (cloudHols.status === 'fulfilled' && Array.isArray(cloudHols.value)) {
      await saveSchoolHolidaysConfig(cloudHols.value);
      syncResults.holidaysCount = cloudHols.value.length;
      syncResults.syncedKeys.push('school_holidays');
    }

    if (cloudStyle.status === 'fulfilled' && cloudStyle.value) {
      await saveLogbookStyleConfig(cloudStyle.value);
      syncResults.syncedKeys.push('logbook_style_settings');
    }

    if (cloudAi.status === 'fulfilled' && cloudAi.value) {
      await saveAiSettingsConfig(cloudAi.value);
      syncResults.syncedKeys.push('ai_settings');
    }

    if (cloudBranding.status === 'fulfilled' && cloudBranding.value) {
      await saveBrandingConfig(cloudBranding.value);
      syncResults.syncedKeys.push('branding');
    }

    if (cloudPdf.status === 'fulfilled' && cloudPdf.value) {
      await savePdfSettingsConfig(cloudPdf.value);
      syncResults.syncedKeys.push('pdf_settings');
    }

    if (cloudFlash.status === 'fulfilled' && cloudFlash.value) {
      await saveFlashcardSettingsConfig(cloudFlash.value);
      syncResults.syncedKeys.push('flashcard_settings');
    }

    if (cloudWa.status === 'fulfilled' && cloudWa.value) {
      await saveWhatsAppSettingsConfig(cloudWa.value);
      syncResults.syncedKeys.push('whatsapp_settings');
    }

    return { success: true, ...syncResults };
  } catch (err) {
    console.error('[syncAllConfigsAndSchedule] Error:', err);
    return { success: false, error: err.message, ...syncResults };
  }
};


