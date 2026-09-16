// src/lib/neon.js
// Client library for saving and loading data directly from Neon PostgreSQL
// Runs safely through /api/neon (Serverless Function on Vercel or Vite Dev Middleware)

const API_ENDPOINT = '/api/neon';

/**
 * Low-level API call to /api/neon
 */
async function callNeonApi(options = {}) {
  const { method = 'POST', body = null, query = null } = options;
  let url = API_ENDPOINT;

  if (query && typeof query === 'object') {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) params.append(k, String(v));
    }
    const qStr = params.toString();
    if (qStr) url += `?${qStr}`;
  }

  const fetchOptions = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);
  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorJson.error || `Neon API HTTP ${response.status}`);
  }

  return await response.json();
}

/**
 * Generic Upsert (Insert or Update on conflict) into any table on Neon
 * @param {string} table - Table name (e.g. 'config', 'lessons', 'exams', 'classes', 'profiles')
 * @param {Object} data - Row data
 * @param {string} keyField - Conflict target column (default 'id')
 */
export async function neonUpsert(table, data, keyField = 'id') {
  try {
    const result = await callNeonApi({
      method: 'POST',
      body: {
        action: 'upsert',
        table,
        data,
        keyField,
      },
    });
    return { data: result.row, error: null };
  } catch (err) {
    console.warn(`[Neon Upsert ${table}] Warning:`, err.message || err);
    return { data: null, error: err };
  }
}

/**
 * Generic Delete from any table on Neon
 */
export async function neonDelete(table, id, keyField = 'id') {
  try {
    const result = await callNeonApi({
      method: 'POST',
      body: {
        action: 'delete',
        table,
        id,
        keyField,
      },
    });
    return { success: result.deleted, error: null };
  } catch (err) {
    console.warn(`[Neon Delete ${table}] Warning:`, err.message || err);
    return { success: false, error: err };
  }
}

/**
 * Generic Get single row by key
 */
export async function neonGet(table, id, keyField = 'id') {
  try {
    const result = await callNeonApi({
      method: 'GET',
      query: { table, id, keyField },
    });
    return { data: result.row, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * Generic List table rows
 */
export async function neonList(table, limit = 200) {
  try {
    const result = await callNeonApi({
      method: 'GET',
      query: { table, limit },
    });
    return { data: result.rows || [], error: null };
  } catch (err) {
    return { data: [], error: err };
  }
}

// ─── High-Level Helpers for Settings & Modules ────────────────────────────────

/**
 * Save configuration to public.config in Neon
 * @param {string} key - Config key ('schools', 'branding', 'flashcard_settings', etc.)
 * @param {any} value - JSON value to store
 */
export async function neonSaveConfig(key, value) {
  return await neonUpsert(
    'config',
    {
      key,
      value,
      updated_at: new Date().toISOString(),
    },
    'key'
  );
}

/**
 * Fetch configuration from public.config in Neon
 */
export async function neonGetConfig(key) {
  const res = await neonGet('config', key, 'key');
  return res.data?.value || null;
}

/**
 * Save Lesson to public.lessons in Neon
 */
export async function neonSaveLesson(lesson) {
  return await neonUpsert('lessons', lesson, 'id');
}

/**
 * Delete Lesson from public.lessons in Neon
 */
export async function neonDeleteLesson(lessonId) {
  return await neonDelete('lessons', lessonId, 'id');
}

/**
 * Save Exam to public.exams in Neon
 */
export async function neonSaveExam(exam) {
  return await neonUpsert('exams', exam, 'id');
}

/**
 * Delete Exam from public.exams in Neon
 */
export async function neonDeleteExam(examId) {
  return await neonDelete('exams', examId, 'id');
}

/**
 * Save Class to public.classes in Neon
 */
export async function neonSaveClass(classData) {
  return await neonUpsert('classes', classData, 'id');
}

/**
 * Delete Class from public.classes in Neon
 */
export async function neonDeleteClass(classId) {
  return await neonDelete('classes', classId, 'id');
}

/**
 * Save User Profile to public.profiles in Neon
 */
export async function neonSaveProfile(profile) {
  return await neonUpsert('profiles', profile, 'id');
}

export default {
  neonUpsert,
  neonDelete,
  neonGet,
  neonList,
  neonSaveConfig,
  neonGetConfig,
  neonSaveLesson,
  neonDeleteLesson,
  neonSaveExam,
  neonDeleteExam,
  neonSaveClass,
  neonDeleteClass,
  neonSaveProfile,
};
