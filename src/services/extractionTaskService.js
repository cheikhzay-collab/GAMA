// src/services/extractionTaskService.js
// Client service for Managing Asynchronous Lesson Extraction Tasks
// Highly resilient connector supporting Vite same-origin proxy (/companion-api),
// direct localhost:5002, 127.0.0.1:5002, and Supabase fallback

import { supabase } from '../lib/supabase';

// Multi-tier candidate base URLs to guarantee connection across all environments
const getCandidateBaseUrls = () => {
  const list = [];
  if (typeof window !== 'undefined' && window.location) {
    // 1. Same-origin Vite proxy (zero CORS, zero IPv4/IPv6 mismatch)
    list.push('/companion-api');

    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      list.push(`http://${host}:5002`);
    }
  }
  // 2. Direct localhost and loopback IPv4
  list.push('http://localhost:5002');
  list.push('http://127.0.0.1:5002');
  return Array.from(new Set(list));
};

let activeBaseUrl = null;
let companionOnline = null;
let lastCheckTime = 0;

/**
 * Check if the companion server is available by testing candidate endpoints
 */
export const isCompanionAvailable = async (forceCheck = false) => {
  const now = Date.now();
  if (!forceCheck && companionOnline !== null && now - lastCheckTime < 5000) {
    return companionOnline;
  }

  const bases = activeBaseUrl ? [activeBaseUrl, ...getCandidateBaseUrls()] : getCandidateBaseUrls();
  const uniqueBases = Array.from(new Set(bases));

  for (const base of uniqueBases) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch(`${base}/ping`, { signal: ctrl.signal });
      clearTimeout(tid);
      if (res.ok) {
        activeBaseUrl = base;
        companionOnline = true;
        lastCheckTime = now;
        return true;
      }
    } catch {
      // try next candidate
    }
  }

  companionOnline = false;
  lastCheckTime = now;
  return false;
};

/**
 * Helper to execute a fetch request across candidate companion URLs
 */
const fetchWithFailover = async (endpointPath, options = {}) => {
  const bases = activeBaseUrl ? [activeBaseUrl, ...getCandidateBaseUrls()] : getCandidateBaseUrls();
  const uniqueBases = Array.from(new Set(bases));

  let lastError = null;
  for (const base of uniqueBases) {
    try {
      const url = `${base}${endpointPath}`;
      const ctrl = new AbortController();
      const timeoutMs = options.timeout || 30000;
      const tid = setTimeout(() => ctrl.abort(), timeoutMs);

      const res = await fetch(url, {
        ...options,
        signal: ctrl.signal
      });
      clearTimeout(tid);

      if (res.ok) {
        activeBaseUrl = base;
        companionOnline = true;
        lastCheckTime = Date.now();
        return res;
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Serveur compagnon injoignable.");
};

/**
 * Fetch all extraction tasks metadata (sorted newest first)
 */
export const getExtractionTasks = async () => {
  try {
    const res = await fetchWithFailover('/api/extraction-tasks', { method: 'GET', timeout: 6000 });
    if (res && res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[ExtractionTaskService] Companion fetch error, falling back:', err.message);
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
  try {
    const res = await fetchWithFailover(`/api/extraction-tasks?id=${encodeURIComponent(id)}`, { method: 'GET', timeout: 8000 });
    if (res && res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[ExtractionTaskService] Companion getById error:', err.message);
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
 * Create a new extraction task (with automatic failover across endpoints)
 */
export const createExtractionTask = async (taskPayload) => {
  try {
    const res = await fetchWithFailover('/api/extraction-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskPayload),
      timeout: 60000
    });
    const data = await res.json();
    return data.task;
  } catch (err) {
    console.error('[ExtractionTaskService] Failed to create task:', err);
    const detail = err.message ? ` (${err.message})` : '';
    throw new Error(
      `Le serveur compagnon local (port 5002) est indisponible pour exécuter la tâche d'arrière-plan${detail}.\n` +
      "Veuillez vérifier que le serveur est bien démarré (start-companion.js ou start-all.bat)."
    );
  }
};

/**
 * Retry a failed task
 */
export const retryExtractionTask = async (id, newApiKey = null) => {
  try {
    const res = await fetchWithFailover(`/api/extraction-tasks?action=retry&id=${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, apiKey: newApiKey }),
      timeout: 10000
    });
    const data = await res.json();
    return data.task;
  } catch (err) {
    throw new Error(`Erreur lors de la relance : ${err.message}`);
  }
};

/**
 * Delete a task
 */
export const deleteExtractionTask = async (id) => {
  try {
    const res = await fetchWithFailover(`/api/extraction-tasks?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      timeout: 8000
    });
    return res.ok;
  } catch (err) {
    if (supabase) {
      await supabase.from('extraction_tasks').delete().eq('id', id);
    }
    return true;
  }
};
