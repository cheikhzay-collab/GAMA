// src/services/extractionTaskService.js
// Client service for Managing Asynchronous Lesson Extraction Tasks
// Bridges Frontend UI with Companion Server (port 5002) and Supabase fallback

import { supabase } from '../lib/supabase';

const getHost = () => (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : '127.0.0.1';
const COMPANION_URL = `http://${getHost()}:5002/api/extraction-tasks`;
const COMPANION_PING = `http://${getHost()}:5002/ping`;

let companionOnline = null;
let lastCheckTime = 0;

export const isCompanionAvailable = async () => {
  const now = Date.now();
  if (companionOnline !== null && now - lastCheckTime < 15000) {
    return companionOnline;
  }
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 1200);
    const res = await fetch(COMPANION_PING, { signal: ctrl.signal });
    clearTimeout(tid);
    companionOnline = res.ok;
  } catch {
    companionOnline = false;
  }
  lastCheckTime = now;
  return companionOnline;
};

/**
 * Fetch all extraction tasks metadata (sorted newest first)
 */
export const getExtractionTasks = async () => {
  const isLocal = await isCompanionAvailable();
  if (isLocal) {
    try {
      const res = await fetch(COMPANION_URL);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[ExtractionTaskService] Companion fetch error, falling back:', err);
    }
  }

  // Fallback: Supabase DB if enabled
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('extraction_tasks')
        .select('id, file_name, file_type, page_count, provider, model, status, progress_percent, progress_message, attempts, max_attempts, error_message, created_at, updated_at, completed_at')
        .order('created_at', { ascending: false });
      if (!error && data) {
        return data.map(row => ({
          id: row.id,
          fileName: row.file_name,
          fileType: row.file_type,
          pageCount: row.page_count,
          provider: row.provider,
          model: row.model,
          status: row.status,
          progressPercent: row.progress_percent,
          progressMessage: row.progress_message,
          attempts: row.attempts,
          maxAttempts: row.max_attempts,
          error: row.error_message,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          completedAt: row.completed_at,
          hasResult: row.status === 'completed'
        }));
      }
    } catch (sbErr) {
      console.warn('[ExtractionTaskService] Supabase tasks query failed:', sbErr);
    }
  }

  // Fallback: localStorage
  try {
    const raw = localStorage.getItem('lconq_extraction_tasks') || '[]';
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

/**
 * Fetch full detail of a task including extracted JSON result
 */
export const getExtractionTaskById = async (id) => {
  const isLocal = await isCompanionAvailable();
  if (isLocal) {
    try {
      const res = await fetch(`${COMPANION_URL}?id=${encodeURIComponent(id)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[ExtractionTaskService] Companion getById error:', err);
    }
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('extraction_tasks')
        .select('*')
        .eq('id', id)
        .single();
      if (!error && data) {
        return {
          id: data.id,
          fileName: data.file_name,
          fileType: data.file_type,
          pageCount: data.page_count,
          provider: data.provider,
          model: data.model,
          status: data.status,
          progressPercent: data.progress_percent,
          progressMessage: data.progress_message,
          attempts: data.attempts,
          maxAttempts: data.max_attempts,
          error: data.error_message,
          result: data.result_json,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          completedAt: data.completed_at
        };
      }
    } catch (sbErr) {
      console.warn('[ExtractionTaskService] Supabase single task query failed:', sbErr);
    }
  }

  return null;
};

/**
 * Create a new extraction task
 */
export const createExtractionTask = async (taskPayload) => {
  const isLocal = await isCompanionAvailable();
  if (isLocal) {
    const res = await fetch(COMPANION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskPayload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erreur lors de la création de la tâche (HTTP ${res.status})`);
    }
    const data = await res.json();
    return data.task;
  }

  throw new Error(
    "Le serveur compagnon local (port 5002) est indisponible pour exécuter la tâche d'arrière-plan. " +
    "Veuillez démarrer start-all.bat ou start-companion.js."
  );
};

/**
 * Retry a failed task
 */
export const retryExtractionTask = async (id, newApiKey = null) => {
  const isLocal = await isCompanionAvailable();
  if (isLocal) {
    const res = await fetch(`${COMPANION_URL}?action=retry&id=${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, apiKey: newApiKey })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erreur lors de la relance (HTTP ${res.status})`);
    }
    const data = await res.json();
    return data.task;
  }

  throw new Error("Serveur d'arrière-plan indisponible pour relancer la tâche.");
};

/**
 * Delete a task
 */
export const deleteExtractionTask = async (id) => {
  const isLocal = await isCompanionAvailable();
  if (isLocal) {
    const res = await fetch(`${COMPANION_URL}?id=${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erreur de suppression`);
    }
    return true;
  }

  if (supabase) {
    await supabase.from('extraction_tasks').delete().eq('id', id);
  }
  return true;
};
