// src/services/logbookService.js
// Logbook CRUD utilities with Neon PostgreSQL cloud persistence and localStorage caching.
import { neonGetConfig, neonSaveConfig } from '../lib/neon';
import { supabase } from '../lib/supabase';

const LOGBOOK_CONFIG_KEY = 'logbook_entries';

/**
 * Get all logbook entries from Neon cloud database, falling back to local cache.
 * @param {string} [classId] - Optional class ID to filter by
 * @returns {Promise<Array>}
 */
export const getLogbookEntries = async (classId) => {
  let entries = null;

  // 1. Try fetching from Neon Cloud Database
  try {
    const remote = await neonGetConfig(LOGBOOK_CONFIG_KEY);
    if (Array.isArray(remote)) {
      entries = remote;
      localStorage.setItem(LOGBOOK_CONFIG_KEY, JSON.stringify(remote));
    }
  } catch (err) {
    console.warn('[logbookService] Neon fetch failed, trying fallbacks:', err.message || err);
  }

  // 2. Fallback to Supabase if Neon did not return data
  if (!entries && supabase) {
    try {
      const { data } = await supabase
        .from('config')
        .select('value')
        .eq('key', LOGBOOK_CONFIG_KEY)
        .single();
      if (data && Array.isArray(data.value)) {
        entries = data.value;
        localStorage.setItem(LOGBOOK_CONFIG_KEY, JSON.stringify(entries));
      }
    } catch (_) {}
  }

  // 3. Fallback to localStorage cache
  if (!entries) {
    try {
      const saved = localStorage.getItem(LOGBOOK_CONFIG_KEY);
      entries = saved ? JSON.parse(saved) : [];
    } catch (_) {
      entries = [];
    }
  }

  if (classId) {
    return entries
      .filter(e => e.classId === classId)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }
  return entries;
};

/**
 * Persist all entries to cloud database and local cache
 */
const persistLogbookEntries = async (all) => {
  // Local cache
  try {
    localStorage.setItem(LOGBOOK_CONFIG_KEY, JSON.stringify(all));
  } catch (_) {}

  // Cloud Neon
  try {
    await neonSaveConfig(LOGBOOK_CONFIG_KEY, all);
  } catch (err) {
    console.warn('[logbookService] Neon save warning:', err.message || err);
  }

  // Cloud Supabase
  if (supabase) {
    try {
      await supabase.from('config').upsert({
        key: LOGBOOK_CONFIG_KEY,
        value: all,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
    } catch (_) {}
  }
};

export const addLogbookEntry = async (entryData) => {
  let all = [];
  try {
    const saved = localStorage.getItem(LOGBOOK_CONFIG_KEY);
    all = saved ? JSON.parse(saved) : [];
  } catch (_) {
    all = [];
  }

  const newEntry = {
    id: 'entry_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11),
    ...entryData,
    createdAt: new Date().toISOString()
  };

  all.push(newEntry);
  await persistLogbookEntries(all);
  return newEntry;
};

export const updateLogbookEntry = async (entryId, updates) => {
  let all = [];
  try {
    const saved = localStorage.getItem(LOGBOOK_CONFIG_KEY);
    all = saved ? JSON.parse(saved) : [];
  } catch (_) {
    all = [];
  }

  const idx = all.findIndex(e => e.id === entryId);
  if (idx > -1) {
    all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
    await persistLogbookEntries(all);
    return all[idx];
  }
  throw new Error("Entrée non trouvée");
};

export const deleteLogbookEntry = async (entryId) => {
  let all = [];
  try {
    const saved = localStorage.getItem(LOGBOOK_CONFIG_KEY);
    all = saved ? JSON.parse(saved) : [];
  } catch (_) {
    all = [];
  }

  all = all.filter(e => e.id !== entryId);
  await persistLogbookEntries(all);
  return true;
};

