// src/services/schoolService.js
// Service for schools list and per-school branding (logos, colors)
// Supports both Supabase and Local Companion API with graceful network error handling.

import { supabase } from '../lib/supabase';
import { localDb } from '../lib/localDbClient';

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
 * Fetch schools config.
 * Returns { schools: string[], branding: Record<string, Object> }
 */
export const getSchoolsConfig = async () => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'schools')
        .maybeSingle();

      if (!error && data?.value) {
        const val = data.value || {};
        return {
          schools: val.schools || DEFAULT_SCHOOLS,
          branding: val.branding || {},
        };
      }
    } catch (err) {
      console.warn('[Supabase] Failed to fetch schools config (offline or network error):', err.message || err);
    }
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
};

/**
 * Save the full schools config.
 */
export const saveSchoolsConfig = async (schools, branding) => {
  if (supabase) {
    try {
      const { error } = await supabase
        .from('config')
        .upsert({
          key: 'schools',
          value: { schools, branding },
          updated_at: new Date().toISOString(),
        });

      if (!error) return;
      console.warn('[Supabase] Failed to save schools config remote, falling back locally:', error.message || error);
    } catch (err) {
      console.warn('[Supabase] Network error saving schools config:', err.message || err);
    }
  }

  try {
    await localDb.post('/config', { schools_config: { schools, branding } });
  } catch (err) {
    console.warn('[LocalDB] Failed to save schools config locally:', err.message || err);
  }
};

/**
 * Fetch general platform branding.
 */
export const getBrandingConfig = async () => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'branding')
        .maybeSingle();

      if (!error && data) return data.value;
    } catch (err) {
      console.warn('[Supabase] Failed to fetch branding config (offline or network error):', err.message || err);
    }
  }

  try {
    const config = await localDb.get('/config');
    return config['branding'] || null;
  } catch (err) {
    return null;
  }
};

/**
 * Save general platform branding.
 */
export const saveBrandingConfig = async (branding) => {
  if (supabase) {
    try {
      const { error } = await supabase
        .from('config')
        .upsert({
          key: 'branding',
          value: branding,
          updated_at: new Date().toISOString(),
        });

      if (!error) return;
      console.warn('[Supabase] Failed to save branding remote, falling back locally:', error.message || error);
    } catch (err) {
      console.warn('[Supabase] Network error saving branding config:', err.message || err);
    }
  }

  try {
    await localDb.post('/config', { branding });
  } catch (err) {
    console.warn('[LocalDB] Failed to save branding config locally:', err.message || err);
  }
};

/**
 * Fetch flashcard settings.
 */
export const getFlashcardSettingsConfig = async () => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'flashcard_settings')
        .maybeSingle();

      if (!error && data) return data.value;
    } catch (err) {
      console.warn('[Supabase] Failed to fetch flashcard settings (offline or network error):', err.message || err);
    }
  }

  try {
    const config = await localDb.get('/config');
    return config['flashcard_settings'] || null;
  } catch (err) {
    return null;
  }
};

/**
 * Save flashcard settings.
 */
export const saveFlashcardSettingsConfig = async (settings) => {
  if (supabase) {
    try {
      const { error } = await supabase
        .from('config')
        .upsert({
          key: 'flashcard_settings',
          value: settings,
          updated_at: new Date().toISOString(),
        });

      if (!error) return;
      console.warn('[Supabase] Failed to save flashcard settings remote, falling back locally:', error.message || error);
    } catch (err) {
      console.warn('[Supabase] Network error saving flashcard settings:', err.message || err);
    }
  }

  try {
    await localDb.post('/config', { flashcard_settings: settings });
  } catch (err) {
    console.warn('[LocalDB] Failed to save flashcard settings locally:', err.message || err);
  }
};

/**
 * Fetch PDF styling settings.
 */
export const getPdfSettingsConfig = async () => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'pdf_settings')
        .maybeSingle();

      if (!error && data) return data.value;
    } catch (err) {
      console.warn('[Supabase] Failed to fetch PDF settings (offline or network error):', err.message || err);
    }
  }

  try {
    const config = await localDb.get('/config');
    return config['pdf_settings'] || null;
  } catch (err) {
    return null;
  }
};

/**
 * Save PDF styling settings.
 */
export const savePdfSettingsConfig = async (settings) => {
  if (supabase) {
    try {
      const { error } = await supabase
        .from('config')
        .upsert({
          key: 'pdf_settings',
          value: settings,
          updated_at: new Date().toISOString(),
        });

      if (!error) return;
      console.warn('[Supabase] Failed to save PDF settings remote, falling back locally:', error.message || error);
    } catch (err) {
      console.warn('[Supabase] Network error saving PDF settings:', err.message || err);
    }
  }

  try {
    await localDb.post('/config', { pdf_settings: settings });
  } catch (err) {
    console.warn('[LocalDB] Failed to save PDF settings locally:', err.message || err);
  }
};

/**
 * Fetch OMR scanner settings.
 */
export const getOmrScannerSettingsConfig = async () => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'omr_scanner_settings')
        .maybeSingle();

      if (!error && data) return data.value;
    } catch (err) {
      console.warn('[Supabase] Failed to fetch OMR scanner settings (offline or network error):', err.message || err);
    }
  }

  try {
    const config = await localDb.get('/config');
    return config['omr_scanner_settings'] || null;
  } catch (err) {
    return null;
  }
};

/**
 * Save OMR scanner settings.
 */
export const saveOmrScannerSettingsConfig = async (settings) => {
  if (supabase) {
    try {
      const { error } = await supabase
        .from('config')
        .upsert({
          key: 'omr_scanner_settings',
          value: settings,
          updated_at: new Date().toISOString(),
        });

      if (!error) return;
      console.warn('[Supabase] Failed to save OMR scanner settings remote, falling back locally:', error.message || error);
    } catch (err) {
      console.warn('[Supabase] Network error saving OMR scanner settings:', err.message || err);
    }
  }

  try {
    await localDb.post('/config', { omr_scanner_settings: settings });
  } catch (err) {
    console.warn('[LocalDB] Failed to save OMR scanner settings locally:', err.message || err);
  }
};

/**
 * Fetch WhatsApp floating button settings.
 */
export const getWhatsAppSettingsConfig = async () => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'whatsapp_settings')
        .maybeSingle();

      if (!error && data) return data.value;
    } catch (err) {
      console.warn('[Supabase] Failed to fetch WhatsApp settings (offline or network error):', err.message || err);
    }
  }

  try {
    const config = await localDb.get('/config');
    return config['whatsapp_settings'] || null;
  } catch (err) {
    return null;
  }
};

/**
 * Save WhatsApp floating button settings.
 */
export const saveWhatsAppSettingsConfig = async (settings) => {
  if (supabase) {
    try {
      const { error } = await supabase
        .from('config')
        .upsert({
          key: 'whatsapp_settings',
          value: settings,
          updated_at: new Date().toISOString(),
        });

      if (!error) return;
      console.warn('[Supabase] Failed to save WhatsApp settings remote, falling back locally:', error.message || error);
    } catch (err) {
      console.warn('[Supabase] Network error saving WhatsApp settings:', err.message || err);
    }
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
export const getPlansConfig = async () => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'plans')
        .maybeSingle();

      if (!error && data && Array.isArray(data.value)) return data.value;
    } catch (err) {
      console.warn('[Supabase] Failed to fetch plans config (offline or network error):', err.message || err);
    }
  }

  try {
    const config = await localDb.get('/config');
    return Array.isArray(config.plans) ? config.plans : null;
  } catch (err) {
    return null;
  }
};

export const getPlans = getPlansConfig;

/**
 * Persist subscription plans in the active data source.
 */
export const savePlansConfig = async (plans) => {
  if (supabase) {
    try {
      const { error } = await supabase
        .from('config')
        .upsert({
          key: 'plans',
          value: plans,
          updated_at: new Date().toISOString(),
        });

      if (!error) return;
      console.warn('[Supabase] Failed to save plans remote, falling back locally:', error.message || error);
    } catch (err) {
      console.warn('[Supabase] Network error saving plans config:', err.message || err);
    }
  }

  try {
    await localDb.post('/config', { plans });
  } catch (err) {
    console.warn('[LocalDB] Failed to save plans config locally:', err.message || err);
  }
};

export const savePlans = savePlansConfig;

/**
 * Fetch dynamic Arabic sales page config.
 */
export const getLandingArConfig = async () => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'landing_ar_settings')
        .maybeSingle();

      if (!error && data) return data.value;
    } catch (err) {
      console.warn('[Supabase] Failed to fetch landing AR settings (offline or network error):', err.message || err);
    }
  }

  try {
    const config = await localDb.get('/config');
    return config['landing_ar_settings'] || null;
  } catch (err) {
    return null;
  }
};

/**
 * Save dynamic Arabic sales page config.
 */
export const saveLandingArConfig = async (landingConfig) => {
  if (supabase) {
    try {
      const { error } = await supabase
        .from('config')
        .upsert({
          key: 'landing_ar_settings',
          value: landingConfig,
          updated_at: new Date().toISOString(),
        });

      if (!error) return;
      console.warn('[Supabase] Failed to save landing AR settings remote, falling back locally:', error.message || error);
    } catch (err) {
      console.warn('[Supabase] Network error saving landing AR settings:', err.message || err);
    }
  }

  try {
    await localDb.post('/config', { landing_ar_settings: landingConfig });
  } catch (err) {
    console.warn('[LocalDB] Failed to save landing AR settings locally:', err.message || err);
  }
};
