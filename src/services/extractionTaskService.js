// src/services/extractionTaskService.js
// Client service for Managing Asynchronous Lesson Extraction Tasks
// Highly resilient connector supporting Vite same-origin proxy (/companion-api),
// direct localhost:5002, 127.0.0.1:5002, and Supabase fallback



// Multi-tier candidate base URLs to guarantee connection across all environments
const getCandidateBaseUrls = () => {
  const list = ['']; // 1. Same-origin cloud API (/api/extraction-tasks works on both Vercel and local dev)

  if (typeof window !== 'undefined' && window.location) {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isHttp = window.location.protocol === 'http:';

    // 2. Same-origin Vite proxy to companion (only active in local Vite dev server)
    if (isLocalhost) {
      list.push('/companion-api');
    }

    const host = window.location.hostname;
    // 3. Direct localhost and loopback IPv4
    if (isHttp || isLocalhost) {
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        list.push(`http://${host}:5002`);
      }
      list.push('http://localhost:5002');
      list.push('http://127.0.0.1:5002');
    }
  } else {
    list.push('http://localhost:5002');
    list.push('http://127.0.0.1:5002');
  }
  return Array.from(new Set(list));
};

let activeBaseUrl = null;
let companionOnline = null;
let lastCheckTime = 0;

/**
 * Check if the local companion server (port 5002) is running for detached offline extraction
 */
export const isCompanionAvailable = async (forceCheck = false) => {
  const now = Date.now();
  if (!forceCheck && companionOnline !== null && now - lastCheckTime < 5000) {
    return companionOnline;
  }

  const candidateBases = [];
  if (typeof window !== 'undefined' && window.location) {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost) {
      candidateBases.push('/companion-api');
    }
    candidateBases.push('http://localhost:5002');
    candidateBases.push('http://127.0.0.1:5002');
  } else {
    candidateBases.push('http://localhost:5002');
  }

  for (const base of candidateBases) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 1200);
      const res = await fetch(`${base}/ping`, { signal: ctrl.signal });
      clearTimeout(tid);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json().catch(() => ({}));
        if (data && data.status === 'online') {
          activeBaseUrl = base;
          companionOnline = true;
          lastCheckTime = now;
          return true;
        }
      }
    } catch {
      // continue
    }
  }

  activeBaseUrl = null;
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

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        throw new Error("L'endpoint a renvoyé du HTML au lieu d'une API JSON.");
      }

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
    throw err;
  }
};

/**
 * Update task progress and result directly in DB / Companion
 */
export const updateExtractionTask = async (id, updates = {}) => {
  try {
    const res = await fetchWithFailover(`/api/extraction-tasks?action=update_task&id=${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'update_task', ...updates }),
      timeout: 10000
    });
    return res.ok;
  } catch (err) {
    console.warn('[ExtractionTaskService] updateExtractionTask failed:', err.message);
    return false;
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
    return true;
  }
};
