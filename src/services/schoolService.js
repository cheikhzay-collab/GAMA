// src/services/schoolService.js
// Supabase service for schools list and per-school branding (logos, colors)
// Returns defaults when supabase is null (no Supabase configured).

import { supabase } from '../lib/supabase';

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
 * Fetch schools config from Supabase.
 * Returns { schools: string[], branding: Record<string, Object> }
 */
export const getSchoolsConfig = async () => {
  if (!supabase) return { schools: DEFAULT_SCHOOLS, branding: {} };

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
 * Save the full schools config back to Supabase.
 * @param {string[]} schools
 * @param {Record<string, Object>} branding
 */
export const saveSchoolsConfig = async (schools, branding) => {
  if (!supabase) return;
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
 * Fetch general platform branding (profName, profPhone, profSite) from Supabase.
 */
export const getBrandingConfig = async () => {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('config')
    .select('value')
    .eq('key', 'branding')
    .maybeSingle();

  if (error || !data) return null;
  return data.value;
};

/**
 * Save general platform branding (profName, profPhone, profSite) to Supabase.
 */
export const saveBrandingConfig = async (branding) => {
  if (!supabase) return;
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
 * Fetch flashcard settings (reveal mode, flip animation, swipe gesture) from Supabase.
 */
export const getFlashcardSettingsConfig = async () => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('config')
    .select('value')
    .eq('key', 'flashcard_settings')
    .maybeSingle();

  if (error || !data) return null;
  return data.value;
};

/**
 * Save flashcard settings to Supabase.
 */
export const saveFlashcardSettingsConfig = async (settings) => {
  if (!supabase) return;
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
 * Fetch PDF styling settings from Supabase.
 */
export const getPdfSettingsConfig = async () => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('config')
    .select('value')
    .eq('key', 'pdf_settings')
    .maybeSingle();

  if (error || !data) return null;
  return data.value;
};

/**
 * Save PDF styling settings to Supabase.
 */
export const savePdfSettingsConfig = async (settings) => {
  if (!supabase) return;
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
 * Fetch OMR scanner settings from Supabase.
 */
export const getOmrScannerSettingsConfig = async () => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('config')
    .select('value')
    .eq('key', 'omr_scanner_settings')
    .maybeSingle();

  if (error || !data) return null;
  return data.value;
};

/**
 * Save OMR scanner settings to Supabase.
 */
export const saveOmrScannerSettingsConfig = async (settings) => {
  if (!supabase) return;
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
 * Fetch WhatsApp floating button settings from Supabase.
 */
export const getWhatsAppSettingsConfig = async () => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('config')
    .select('value')
    .eq('key', 'whatsapp_settings')
    .maybeSingle();

  if (error || !data) return null;
  return data.value;
};

/**
 * Save WhatsApp floating button settings to Supabase.
 */
export const saveWhatsAppSettingsConfig = async (settings) => {
  if (!supabase) return;
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
 * Fetch dynamic Arabic sales page config from Supabase.
 */
export const getLandingArConfig = async () => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('config')
    .select('value')
    .eq('key', 'landing_ar_settings')
    .maybeSingle();

  if (error || !data) return null;
  return data.value;
};

/**
 * Save dynamic Arabic sales page config to Supabase.
 */
export const saveLandingArConfig = async (config) => {
  if (!supabase) return;
  const { error } = await supabase
    .from('config')
    .upsert({
      key: 'landing_ar_settings',
      value: config,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('[Supabase] Failed to save landing AR settings:', error);
    throw error;
  }
};





