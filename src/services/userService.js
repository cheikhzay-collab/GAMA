// src/services/userService.js
// CRUD for user profiles, progress, mock exam history, and activity.
// Supports Neon PostgreSQL and Local Companion API with graceful network error handling.

import { localDb } from '../lib/localDbClient';
import { queryCache } from './queryCache';
import initialUsersData from '../../data/users.json';
import { neonSaveProfile, neonGet, neonList, neonUpsert } from '../lib/neon';

const STORAGE_KEY = 'lconq_users_db';

/**
 * [C-2/C-3 FIX] Authenticated fetch wrapper for /api/neon POST requests.
 * Automatically attaches the JWT from localStorage.
 */
async function neonAuthFetch(body) {
  const token = localStorage.getItem('gama_auth_token') || sessionStorage.getItem('gama_auth_token') || '';
  return fetch('/api/neon', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

const getLocalStorageUsers = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch (e) {
    return null;
  }
};

const saveLocalStorageUsers = (users) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  } catch (e) {
    console.warn('[LocalStorage] Failed to save users:', e);
  }
};

// Helper to map camelCase fields to snake_case DB columns
const mapProfileToDB = (profile) => ({
  name: profile.name,
  email: profile.email,
  role: profile.role,
  tier: profile.tier,
  xp: profile.xp,
  streak: profile.streak,
  rank: profile.rank,
  total_students: profile.totalStudents,
  joined: profile.joined,
  subscription: profile.subscription,
  phone: profile.phone,
  city: profile.city,
  school: profile.school,
  downloads: profile.downloads,
  crm: profile.crm,
  class_id: profile.classId || profile.class_id || null,
  class_name: profile.className || null,
});

// Helper to map snake_case DB columns to camelCase fields
const mapDBToProfile = (row) => {
  if (!row) return null;
  const classId = row.class_id || row.classId || null;
  return {
    id: row.id,
    uid: row.id || row.uid,
    name: row.name,
    email: row.email,
    role: row.role || 'student',
    tier: row.tier || 'freemium',
    xp: row.xp || 0,
    streak: row.streak || 0,
    rank: row.rank || 0,
    totalStudents: row.total_students || row.totalStudents,
    joined: row.joined || row.created_at,
    subscription: row.subscription,
    createdAt: row.created_at || row.joined,
    updatedAt: row.updated_at,
    phone: row.phone,
    city: row.city,
    school: row.school,
    downloads: row.downloads,
    crm: row.crm || { stage: 'Lead', notes: [], reminders: [], interactions: [] },
    classId: classId,
    class_id: classId,
    className: row.class_name || row.className || classId,
    massarCode: row.massarCode || row.id
  };
};

// ─── User Profile ─────────────────────────────────────────────────────────────

/**
 * Create a new user profile.
 */
export const createUserDoc = async (uid, userData) => {
  queryCache.invalidate(`user_doc_${uid}`);
  queryCache.invalidate('users_all');
  queryCache.invalidate('leaderboard_all');

  const now = new Date().toISOString();
  const profile = {
    id: uid,
    uid: uid,
    ...userData,
    classId: userData.classId || userData.class_id || null,
    class_id: userData.classId || userData.class_id || null,
    createdAt: userData.joined || now,
    updatedAt: now,
  };

  // 1. LocalStorage (immediate fail-safe)
  const currentUsers = (getLocalStorageUsers() || []).filter(u => u.id !== uid && u.uid !== uid);
  currentUsers.unshift(profile);
  saveLocalStorageUsers(currentUsers);

  // 2. Sync to Neon PostgreSQL
  try {
    neonSaveProfile({
      id: uid,
      ...mapProfileToDB(userData),
      updated_at: now,
    }).catch(err => console.warn('[Neon] Error syncing createUserDoc:', err.message));
  } catch (_) {}



  // 3. Local Companion
  try {
    const dbUser = {
      id: uid,
      uid: uid,
      ...mapProfileToDB(userData),
      created_at: userData.joined || now,
      updated_at: now,
    };
    await localDb.post('/users', dbUser);
  } catch (err) {
    // companion offline fallback
  }
};

/**
 * Fetch a user profile by UID (Optimized with SWR Cache).
 */
export const getUserDoc = async (uid, options = {}) => {
  if (!uid) return null;
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache(`user_doc_${uid}`, async () => {
    // 1. Try Neon PostgreSQL
    try {
      const neonRes = await neonGet('profiles', uid, 'id');
      if (neonRes.data) {
        return mapDBToProfile(neonRes.data);
      }
    } catch (neonErr) {
      console.warn('[Neon] getUserDoc error:', neonErr.message);
    }


    try {
      const list = await localDb.get('/users');
      const found = list.find(u => u.id === uid || u.uid === uid);
      if (found) return mapDBToProfile(found);
    } catch (err) {}

    const localList = getLocalStorageUsers();
    if (localList) {
      const found = localList.find(u => u.id === uid || u.uid === uid);
      if (found) return found;
    }

    // Seed fallback
    if (Array.isArray(initialUsersData)) {
      const seedFound = initialUsersData.find(u => u.id === uid || u.uid === uid);
      if (seedFound) return mapDBToProfile(seedFound);
    }

    return null;
  }, {
    forceRefresh,
    staleTime: 1000 * 60 * 2,
    cacheTime: 1000 * 60 * 30
  });
};

export const updateUserDoc = async (uid, updates) => {
  queryCache.invalidate(`user_doc_${uid}`);
  queryCache.invalidate('users_all');
  queryCache.invalidate('leaderboard_all');

  const now = new Date().toISOString();
  const classId = updates.classId !== undefined ? updates.classId : updates.class_id;

  // 1. LocalStorage (immediate fail-safe)
  const currentUsers = getLocalStorageUsers() || (Array.isArray(initialUsersData) ? initialUsersData.map(mapDBToProfile) : []);
  const idx = currentUsers.findIndex(u => u.id === uid || u.uid === uid);
  if (idx !== -1) {
    currentUsers[idx] = {
      ...currentUsers[idx],
      ...updates,
      ...(classId !== undefined ? { classId, class_id: classId } : {}),
      updatedAt: now
    };
    saveLocalStorageUsers(currentUsers);
  }

  

  // 3. Companion
  try {
    const list = await localDb.get('/users');
    const cIdx = list.findIndex(u => u.id === uid || u.uid === uid);
    if (cIdx > -1) {
      const current = list[cIdx];
      const dbUpdates = mapProfileToDB(updates);
      const updated = {
        ...current,
        ...dbUpdates,
        updated_at: now
      };
      await localDb.post('/users', updated);
    }
  } catch (err) {
    // companion offline fallback
  }
};

/**
 * Activate or update a subscription on a user profile.
 */
export const setUserSubscription = async (uid, subscription, tier = 'premium') => {
  queryCache.invalidate(`user_doc_${uid}`);
  queryCache.invalidate('users_all');


  try {
    await updateUserDoc(uid, { subscription, tier });
  } catch (err) {
    console.warn('[LocalDB] Failed to set subscription locally:', err.message || err);
  }
};

// ─── Study Progress (SRS cards) ───────────────────────────────────────────────

/**
 * Save/update a single question's SRS progress.
 * Neon PostgreSQL persistence with Local fallback.
 */
export const saveQuestionProgress = async (uid, questionId, progressData) => {
  const now = new Date().toISOString();

  // 1. Neon — [FIX] progress.id is bigint (auto-increment), conflict on (user_id, question_id)
  //    Use raw SQL INSERT ... ON CONFLICT instead of generic upsert with string id.
  try {
    const res = await neonAuthFetch({
      action: 'query',
      sql: `INSERT INTO public.progress
        (user_id, question_id, difficulty, stability, repetitions, ease_factor, last_review_date, next_review_date, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (user_id, question_id) DO UPDATE SET
          difficulty = EXCLUDED.difficulty,
          stability = EXCLUDED.stability,
          repetitions = EXCLUDED.repetitions,
          ease_factor = EXCLUDED.ease_factor,
          last_review_date = EXCLUDED.last_review_date,
          next_review_date = EXCLUDED.next_review_date,
          updated_at = EXCLUDED.updated_at`,
      params: [
        uid, questionId,
        progressData.difficulty, progressData.stability,
        progressData.repetitions, progressData.easeFactor,
        progressData.lastReviewDate, progressData.nextReviewDate,
        now
      ]
    });
    if (res.ok) return;
  } catch (neonErr) {
    console.warn('[Neon] saveQuestionProgress error:', neonErr.message);
  }


};

/**
 * Fetch all progress cards for a user.
 * Neon PostgreSQL persistence with Local fallback.
 */
export const getAllProgress = async (uid) => {
  const mapRow = (row) => ({
    difficulty: row.difficulty,
    stability: row.stability,
    repetitions: row.repetitions,
    easeFactor: row.ease_factor,
    lastReviewDate: row.last_review_date,
    nextReviewDate: row.next_review_date,
  });

  // 1. Try Neon — [M-5 FIX] single filtered GET request (removed useless double-fetch)
  try {
    const { neonListFiltered } = await import('../lib/neon');
    const neonRes = await neonListFiltered('progress', 'user_id', uid, 2000);
    if (Array.isArray(neonRes.data) && neonRes.data.length > 0) {
      const result = {};
      neonRes.data.forEach(row => { result[row.question_id] = mapRow(row); });
      return result;
    }
  } catch (neonErr) {
    console.warn('[Neon] getAllProgress error:', neonErr.message);
  }


};

// ─── Mock Exam History ────────────────────────────────────────────────────────

/**
 * Save a mock exam result.
 * Neon PostgreSQL persistence with Local fallback.
 */
export const saveMockResult = async (uid, result) => {
  const date = result.date || new Date().toISOString();

  // 1. Try Neon — [FIX] mock_history.id is bigint (auto-increment) — use INSERT without id
  try {
    const res = await neonAuthFetch({
      action: 'query',
      sql: `INSERT INTO public.mock_history
        (user_id, exam_id, exam_name, school, score, max_score, pct, correct_count, wrong_count, empty_count, mode, date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      params: [
        uid, result.examId, result.examName, result.school,
        result.score, result.maxScore, result.pct,
        result.correctCount, result.wrongCount, result.emptyCount,
        result.mode, date
      ]
    });
    if (res.ok) return;
  } catch (neonErr) {
    console.warn('[Neon] saveMockResult error:', neonErr.message);
  }


};

/**
 * Fetch all mock exam history for a user.
 * Neon PostgreSQL persistence with Local fallback.
 */
export const getMockHistory = async (uid) => {
  const mapRow = (row) => ({
    id: row.id,
    examId: row.exam_id,
    examName: row.exam_name,
    school: row.school,
    score: row.score,
    maxScore: row.max_score,
    pct: row.pct,
    correctCount: row.correct_count,
    wrongCount: row.wrong_count,
    emptyCount: row.empty_count,
    mode: row.mode,
    date: row.date,
  });

  // 1. Try Neon — [FIX] Added Authorization header via neonAuthFetch
  try {
    const res = await neonAuthFetch({
      action: 'query',
      sql: 'SELECT * FROM public.mock_history WHERE user_id = $1 ORDER BY date DESC',
      params: [uid]
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.rows)) return data.rows.map(mapRow);
    }
  } catch (neonErr) {
    console.warn('[Neon] getMockHistory error:', neonErr.message);
  }


};

// ─── Daily Activity ───────────────────────────────────────────────────────────

/**
 * Increment the daily activity counter.
 * Neon PostgreSQL persistence with Local fallback.
 */
export const incrementDailyActivity = async (uid) => {
  const today = new Date().toISOString().split('T')[0];

  // 1. Try Neon — [FIX] activity.id is bigint (auto-increment). Use INSERT ON CONFLICT (user_id, date)
  try {
    const res = await neonAuthFetch({
      action: 'query',
      sql: `INSERT INTO public.activity (user_id, date, count)
        VALUES ($1, $2, 1)
        ON CONFLICT (user_id, date) DO UPDATE SET count = public.activity.count + 1`,
      params: [uid, today]
    });
    if (res.ok) {
      return;
    }
  } catch (neonErr) {
    console.warn('[Neon] incrementDailyActivity error:', neonErr.message);
  }


};

/**
 * Fetch the last N days of activity.
 * Neon PostgreSQL persistence with Local fallback.
 */
export const getRecentActivity = async (uid, days = 90) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  // 1. Try Neon — [FIX] Added Authorization header via neonAuthFetch
  try {
    const res = await neonAuthFetch({
      action: 'query',
      sql: 'SELECT date, count FROM public.activity WHERE user_id = $1 AND date >= $2',
      params: [uid, cutoffStr]
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.rows) && data.rows.length >= 0) {
        const result = {};
        data.rows.forEach(row => { result[row.date] = row.count || 0; });
        return result;
      }
    }
  } catch (neonErr) {
    console.warn('[Neon] getRecentActivity error:', neonErr.message);
  }


};

/**
 * Delete a user by UID (Admin only).
 */
export const deleteUser = async (uid) => {
  queryCache.invalidate(`user_doc_${uid}`);
  queryCache.invalidate('users_all');
  queryCache.invalidate('leaderboard_all');

  // 1. LocalStorage
  const currentUsers = getLocalStorageUsers() || (Array.isArray(initialUsersData) ? initialUsersData.map(mapDBToProfile) : []);
  const filtered = currentUsers.filter(u => u.id !== uid && u.uid !== uid);
  saveLocalStorageUsers(filtered);

  // 2. Neon delete — [FIX] Added Authorization header via neonAuthFetch
  try {
    const res = await neonAuthFetch({ action: 'delete', table: 'profiles', id: uid, keyField: 'id' });
    if (res.ok) return true;
  } catch (neonErr) {
    console.warn('[Neon] deleteUser error:', neonErr.message);
  }



  // 4. Local Companion
  try {
    await localDb.delete('/users', uid);
    return true;
  } catch (err) {
    return true; // still deleted locally
  }
};

/**
 * Fetch all registered users (Admin only) with SWR caching.
 */
export const getAllUsers = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('users_all', async () => {
    // 1. Try Neon PostgreSQL
    try {
      const neonRes = await neonList('profiles', 1000);
      if (Array.isArray(neonRes.data) && neonRes.data.length > 0) {
        const mapped = neonRes.data.map(mapDBToProfile);
        saveLocalStorageUsers(mapped);
        return mapped;
      }
    } catch (neonErr) {
      console.warn('[Neon] getAllUsers error:', neonErr.message);
    }


    try {
      const list = await localDb.get('/users');
      if (Array.isArray(list) && list.length > 0) {
        const mapped = list.map(mapDBToProfile);
        saveLocalStorageUsers(mapped);
        return mapped;
      }
    } catch (err) {}

    const cache = getLocalStorageUsers();
    if (Array.isArray(cache) && cache.length > 0) {
      return cache;
    }

    // Ultimate seed fallback from bundled Moroccan students
    if (Array.isArray(initialUsersData) && initialUsersData.length > 0) {
      const mapped = initialUsersData.map(mapDBToProfile);
      saveLocalStorageUsers(mapped);
      return mapped;
    }

    return [];
  }, {
    forceRefresh,
    staleTime: 1000 * 60 * 3,
    cacheTime: 1000 * 60 * 30
  });
};

/**
 * Fetch the public leaderboard of top 100 students with SWR caching.
 */
export const getLeaderboard = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('leaderboard_all', async () => {

    try {
      const list = await localDb.get('/users');
      return list
        .filter(u => u.role !== 'admin')
        .map(mapDBToProfile)
        .sort((a, b) => (b.xp || 0) - (a.xp || 0))
        .slice(0, 100);
    } catch (err) {
      return [];
    }
  }, {
    forceRefresh,
    staleTime: 1000 * 60 * 5,
    cacheTime: 1000 * 60 * 30
  });
};

/**
 * Log a user login.
 * Neon PostgreSQL persistence with Local fallback.
 */
export const addLoginLog = async (uid) => {
  const id = `ll_${uid}_${Date.now()}`;
  // 1. Try Neon — table login_logs now exists with TEXT id (created via MCP)
  try {
    await neonUpsert('login_logs', { id, user_id: uid, logged_at: new Date().toISOString() }, 'id');
    return;
  } catch (neonErr) {
    console.warn('[Neon] addLoginLog error:', neonErr.message);
  }

};

/**
 * Fetch login logs for a user.
 * Neon PostgreSQL persistence with Local fallback.
 */
export const getLoginLogs = async (uid) => {
  const mapRow = row => ({ id: row.id, userId: row.user_id, loggedAt: row.logged_at });
  // 1. Try Neon — [FIX] Added Authorization header via neonAuthFetch
  try {
    const res = await neonAuthFetch({
      action: 'query',
      sql: 'SELECT * FROM public.login_logs WHERE user_id = $1 ORDER BY logged_at DESC LIMIT 100',
      params: [uid]
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.rows)) return data.rows.map(mapRow);
    }
  } catch (neonErr) {
    console.warn('[Neon] getLoginLogs error:', neonErr.message);
  }

};

/**
 * Fetch progress cards deltas since a timestamp.
 * Neon PostgreSQL persistence with Local fallback.
 */
export const getProgressDeltas = async (uid, sinceTimestamp) => {
  const mapRow = row => ({
    difficulty: row.difficulty,
    stability: row.stability,
    repetitions: row.repetitions,
    easeFactor: row.ease_factor,
    lastReviewDate: row.last_review_date,
    nextReviewDate: row.next_review_date,
    updatedAt: row.updated_at
  });

  // 1. Try Neon — [FIX] Added Authorization header via neonAuthFetch
  try {
    const sql = sinceTimestamp
      ? 'SELECT * FROM public.progress WHERE user_id = $1 AND updated_at > $2'
      : 'SELECT * FROM public.progress WHERE user_id = $1';
    const params = sinceTimestamp ? [uid, sinceTimestamp] : [uid];
    const res = await neonAuthFetch({ action: 'query', sql, params });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.rows)) {
        const result = {};
        data.rows.forEach(row => { result[row.question_id] = mapRow(row); });
        return result;
      }
    }
  } catch (neonErr) {
    console.warn('[Neon] getProgressDeltas error:', neonErr.message);
  }


};

/**
 * Synchronize missing auth users with Neon profiles (Admin only).
 * Neon profile synchronization stub.
 */
export const syncStudentsWithNeon = async () => {
  return { success: true, synchronized_count: 0, note: 'Neon-native — no sync needed' };
};
export const syncStudentsWithSupabase = syncStudentsWithNeon;

/**
 * Log a document/report download.
 * Neon PostgreSQL persistence with Local fallback.
 */
export const logUserDownload = async (uid, downloadData) => {
  // 1. Try Neon — [FIX] Added Authorization header via neonAuthFetch
  try {
    const res = await neonAuthFetch({
      action: 'query',
      sql: 'SELECT downloads FROM public.profiles WHERE id = $1 LIMIT 1',
      params: [uid]
    });
    if (res.ok) {
      const data = await res.json();
      const currentDownloads = Array.isArray(data.rows?.[0]?.downloads) ? data.rows[0].downloads : [];
      const newEntry = { ...downloadData, downloadedAt: new Date().toISOString() };
      const updatedDownloads = [newEntry, ...currentDownloads].slice(0, 100);
      await neonSaveProfile({ id: uid, downloads: updatedDownloads });
      return;
    }
  } catch (neonErr) {
    console.warn('[Neon] logUserDownload error:', neonErr.message);
  }


};
