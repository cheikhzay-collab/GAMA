// src/services/schoolService.js
// Service for schools list and per-school branding (logos, colors)
// Supports both Supabase and Local Companion API.

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
  if (!supabase) {
    try {
      const config = await localDb.get('/config');
      const val = config['schools_config'] || {};
      return {
        schools: val.schools || config.schools || DEFAULT_SCHOOLS,
        branding: val.branding || config.schoolBranding || {},
      };
    } catch (err) {
      console.error('[LocalDB] Failed to fetch schools config:', err);
      return { schools: DEFAULT_SCHOOLS, branding: {} };
    }
  }

  const { data, error } = await supabase
    .from('config')
    .select('value')
    .eq('key', 'schools')
    .maybeSingle();

  if (error || !data) {
    return { schools: DEFAULT_SCHOOLS, branding: {} };
  }

  const val = data.value || {};
  return {
    schools:  val.schools  || DEFAULT_SCHOOLS,
    branding: val.branding || {},
  };
};

/**
 * Save the full schools config.
 */
export const saveSchoolsConfig = async (schools, branding) => {
  if (!supabase) {
    try {
      await localDb.post('/config', { schools_config: { schools, branding } });
      return;
    } catch (err) {
      console.error('[LocalDB] Failed to save schools config:', err);
      throw err;
    }
  }

  const { error } = await supabase
    .from('config')
    .upsert({
      key: 'schools',
      value: { schools, branding },
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('[Supabase] Failed to save schools config:', error);
    throw error;
  }
};

/**
 * Fetch general platform branding.
 */
export const getBrandingConfig = async () => {
  if (!supabase) {
    try {
      const config = await localDb.get('/config');
      return config['branding'] || null;
    } catch (err) {
      console.error('[LocalDB] Failed to fetch branding config:', err);
      return null;
    }
  }

  const { data, error } = await supabase
    .from('config')
    .select('value')
    .eq('key', 'branding')
    .maybeSingle();

  if (error || !data) return null;
  return data.value;
};

/**
 * Save general platform branding.
 */
export const saveBrandingConfig = async (branding) => {
  if (!supabase) {
    try {
      await localDb.post('/config', { branding });
      return;
    } catch (err) {
      console.error('[LocalDB] Failed to save branding config:', err);
      throw err;
    }
  }

  const { error } = await supabase
    .from('config')
    .upsert({
      key: 'branding',
      value: branding,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('[Supabase] Failed to save branding config:', error);
    throw error;
  }
};

/**
 * Fetch flashcard settings.
 */
export const getFlashcardSettingsConfig = async () => {
  if (!supabase) {
    try {
      const config = await localDb.get('/config');
      return config['flashcard_settings'] || null;
    } catch (err) {
      console.error('[LocalDB] Failed to fetch flashcard settings config:', err);
      return null;
    }
  }

  const { data, error } = await supabase
    .from('config')
    .select('value')
    .eq('key', 'flashcard_settings')
    .maybeSingle();

  if (error || !data) return null;
  return data.value;
};

/**
 * Save flashcard settings.
 */
export const saveFlashcardSettingsConfig = async (settings) => {
  if (!supabase) {
    try {
      await localDb.post('/config', { flashcard_settings: settings });
      return;
    } catch (err) {
      console.error('[LocalDB] Failed to save flashcard settings:', err);
      throw err;
    }
  }

  const { error } = await supabase
    .from('config')
    .upsert({
      key: 'flashcard_settings',
      value: settings,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('[Supabase] Failed to save flashcard settings config:', error);
    throw error;
  }
};

/**
 * Fetch PDF styling settings.
 */
export const getPdfSettingsConfig = async () => {
  if (!supabase) {
    try {
      const config = await localDb.get('/config');
      return config['pdf_settings'] || null;
    } catch (err) {
      console.error('[LocalDB] Failed to fetch PDF settings config:', err);
      return null;
    }
  }

  const { data, error } = await supabase
    .from('config')
    .select('value')
    .eq('key', 'pdf_settings')
    .maybeSingle();

  if (error || !data) return null;
  return data.value;
};

/**
 * Save PDF styling settings.
 */
export const savePdfSettingsConfig = async (settings) => {
  if (!supabase) {
    try {
      await localDb.post('/config', { pdf_settings: settings });
      return;
    } catch (err) {
      console.error('[LocalDB] Failed to save PDF settings:', err);
      throw err;
    }
  }

  const { error } = await supabase
    .from('config')
    .upsert({
      key: 'pdf_settings',
      value: settings,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('[Supabase] Failed to save PDF settings config:', error);
    throw error;
  }
};

/**
 * Fetch OMR scanner settings.
 */
export const getOmrScannerSettingsConfig = async () => {
  if (!supabase) {
    try {
      const config = await localDb.get('/config');
      return config['omr_scanner_settings'] || null;
    } catch (err) {
      console.error('[LocalDB] Failed to fetch OMR scanner settings:', err);
      return null;
    }
  }

  const { data, error } = await supabase
    .from('config')
    .select('value')
    .eq('key', 'omr_scanner_settings')
    .maybeSingle();

  if (error || !data) return null;
  return data.value;
};

/**
 * Save OMR scanner settings.
 */
export const saveOmrScannerSettingsConfig = async (settings) => {
  if (!supabase) {
    try {
      await localDb.post('/config', { omr_scanner_settings: settings });
      return;
    } catch (err) {
      console.error('[LocalDB] Failed to save OMR scanner settings:', err);
      throw err;
    }
  }

  const { error } = await supabase
    .from('config')
    .upsert({
      key: 'omr_scanner_settings',
      value: settings,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('[Supabase] Failed to save OMR scanner settings config:', error);
    throw error;
  }
};

/**
 * Fetch WhatsApp floating button settings.
 */
export const getWhatsAppSettingsConfig = async () => {
  if (!supabase) {
    try {
      const config = await localDb.get('/config');
      return config['whatsapp_settings'] || null;
    } catch (err) {
      console.error('[LocalDB] Failed to fetch WhatsApp settings:', err);
      return null;
    }
  }

  const { data, error } = await supabase
    .from('config')
    .select('value')
    .eq('key', 'whatsapp_settings')
    .maybeSingle();

  if (error || !data) return null;
  return data.value;
};

/**
 * Save WhatsApp floating button settings.
 */
export const saveWhatsAppSettingsConfig = async (settings) => {
  if (!supabase) {
    try {
      await localDb.post('/config', { whatsapp_settings: settings });
      return;
    } catch (err) {
      console.error('[LocalDB] Failed to save WhatsApp settings:', err);
      throw err;
    }
  }

  const { error } = await supabase
    .from('config')
    .upsert({
      key: 'whatsapp_settings',
      value: settings,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('[Supabase] Failed to save WhatsApp settings config:', error);
    throw error;
  }
};

/**
 * Fetch subscription plans shared by the admin dashboard and sales pages.
 */
export const getPlansConfig = async () => {
  if (!supabase) {
    try {
      const config = await localDb.get('/config');
      return Array.isArray(config.plans) ? config.plans : null;
    } catch (err) {
      console.error('[LocalDB] Failed to fetch plans config:', err);
      return null;
    }
  }

  const { data, error } = await supabase
    .from('config')
    .select('value')
    .eq('key', 'plans')
    .maybeSingle();

  return error || !data || !Array.isArray(data.value) ? null : data.value;
};

// Aliases to avoid "getPlans is not defined" runtime errors
export const getPlans = getPlansConfig;

/**
 * Persist subscription plans in the active data source.
 */
export const savePlansConfig = async (plans) => {
  if (!supabase) {
    await localDb.post('/config', { plans });
    return;
  }

  const { error } = await supabase
    .from('config')
    .upsert({
      key: 'plans',
      value: plans,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('[Supabase] Failed to save plans config:', error);
    throw error;
  }
};

export const savePlans = savePlansConfig;

/**
 * Fetch dynamic Arabic sales page config.
 */
export const getLandingArConfig = async () => {
  if (!supabase) {
    try {
      const config = await localDb.get('/config');
      return config['landing_ar_settings'] || null;
    } catch (err) {
      console.error('[LocalDB] Failed to fetch landing AR settings:', err);
      return null;
    }
  }

  const { data, error } = await supabase
    .from('config')
    .select('value')
    .eq('key', 'landing_ar_settings')
    .maybeSingle();

  if (error || !data) return null;
  return data.value;
};

/**
 * Save dynamic Arabic sales page config.
 */
export const saveLandingArConfig = async (landingConfig) => {
  if (!supabase) {
    try {
      await localDb.post('/config', { landing_ar_settings: landingConfig });
      return;
    } catch (err) {
      console.error('[LocalDB] Failed to save landing AR settings:', err);
      throw err;
    }
  }

  const { error } = await supabase
    .from('config')
    .upsert({
      key: 'landing_ar_settings',
      value: landingConfig,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('[Supabase] Failed to save landing AR settings:', error);
    throw error;
  }
};
