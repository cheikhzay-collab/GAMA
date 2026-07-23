// src/services/userService.js
// CRUD for user profiles, progress, mock exam history, and activity.
// Supports both Supabase and Local Companion API.

import { supabase } from '../lib/supabase';
import { localDb } from '../lib/localDbClient';

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
  class_id: profile.classId || null,
});

// Helper to map snake_case DB columns to camelCase fields
const mapDBToProfile = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    uid: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    tier: row.tier,
    xp: row.xp,
    streak: row.streak,
    rank: row.rank,
    totalStudents: row.total_students,
    joined: row.joined,
    subscription: row.subscription,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    phone: row.phone,
    city: row.city,
    school: row.school,
    downloads: row.downloads,
    crm: row.crm || { stage: 'Lead', notes: [], reminders: [], interactions: [] },
    classId: row.class_id || null,
  };
};

// ─── User Profile ─────────────────────────────────────────────────────────────

/**
 * Create a new user profile.
 */
export const createUserDoc = async (uid, userData) => {
  if (!supabase) {
    try {
      const dbUser = {
        id: uid,
        uid: uid,
        ...mapProfileToDB(userData),
        created_at: userData.joined || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await localDb.post('/users', dbUser);
      return;
    } catch (err) {
      console.error('[LocalDB] Failed to create user profile:', err);
      throw err;
    }
  }

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: uid,
      ...mapProfileToDB(userData),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

  if (error) {
    console.error('[Supabase] Failed to create or upsert user profile:', error);
    throw error;
  }
};

/**
 * Fetch a user profile by UID.
 */
export const getUserDoc = async (uid) => {
  if (!supabase) {
    try {
      const list = await localDb.get('/users');
      const found = list.find(u => u.id === uid || u.uid === uid);
      return found ? mapDBToProfile(found) : null;
    } catch (err) {
      console.error('[LocalDB] Failed to fetch user profile:', err);
      return null;
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .maybeSingle();

  if (error) {
    console.error('[Supabase] Failed to fetch user profile:', error);
    return null;
  }
  return mapDBToProfile(data);
};

/**
 * Update specific fields in a user profile.
 */
export const updateUserDoc = async (uid, updates) => {
  if (!supabase) {
    try {
      const list = await localDb.get('/users');
      const idx = list.findIndex(u => u.id === uid || u.uid === uid);
      if (idx > -1) {
        const current = list[idx];
        const dbUpdates = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.email !== undefined) dbUpdates.email = updates.email;
        if (updates.role !== undefined) dbUpdates.role = updates.role;
        if (updates.tier !== undefined) dbUpdates.tier = updates.tier;
        if (updates.xp !== undefined) dbUpdates.xp = updates.xp;
        if (updates.streak !== undefined) dbUpdates.streak = updates.streak;
        if (updates.rank !== undefined) dbUpdates.rank = updates.rank;
        if (updates.totalStudents !== undefined) dbUpdates.total_students = updates.totalStudents;
        if (updates.subscription !== undefined) dbUpdates.subscription = updates.subscription;
        if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
        if (updates.city !== undefined) dbUpdates.city = updates.city;
        if (updates.school !== undefined) dbUpdates.school = updates.school;
        if (updates.downloads !== undefined) dbUpdates.downloads = updates.downloads;
        if (updates.crm !== undefined) dbUpdates.crm = updates.crm;
        if (updates.classId !== undefined) dbUpdates.class_id = updates.classId;

        const updated = {
          ...current,
          ...dbUpdates,
          updated_at: new Date().toISOString()
        };
        await localDb.post('/users', updated);
      }
      return;
    } catch (err) {
      console.error('[LocalDB] Failed to update user profile:', err);
      throw err;
    }
  }

  const dbUpdates = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.email !== undefined) dbUpdates.email = updates.email;
  if (updates.role !== undefined) dbUpdates.role = updates.role;
  if (updates.tier !== undefined) dbUpdates.tier = updates.tier;
  if (updates.xp !== undefined) dbUpdates.xp = updates.xp;
  if (updates.streak !== undefined) dbUpdates.streak = updates.streak;
  if (updates.rank !== undefined) dbUpdates.rank = updates.rank;
  if (updates.total_students !== undefined) dbUpdates.total_students = updates.totalStudents;
  if (updates.subscription !== undefined) dbUpdates.subscription = updates.subscription;
  if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
  if (updates.city !== undefined) dbUpdates.city = updates.city;
  if (updates.school !== undefined) dbUpdates.school = updates.school;
  if (updates.downloads !== undefined) dbUpdates.downloads = updates.downloads;
  if (updates.crm !== undefined) dbUpdates.crm = updates.crm;
  if (updates.classId !== undefined) dbUpdates.class_id = updates.classId;
  dbUpdates.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('profiles')
    .update(dbUpdates)
    .eq('id', uid);

  if (error) {
    console.error('[Supabase] Failed to update user profile:', error);
    throw error;
  }
};

/**
 * Activate or update a subscription on a user profile.
 */
export const setUserSubscription = async (uid, subscription, tier = 'premium') => {
  if (!supabase) {
    try {
      await updateUserDoc(uid, { subscription, tier });
      return;
    } catch (err) {
      console.error('[LocalDB] Failed to set subscription:', err);
      throw err;
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      tier,
      subscription,
      updated_at: new Date().toISOString(),
    })
    .eq('id', uid);

  if (error) {
    console.error('[Supabase] Failed to set subscription:', error);
    throw error;
  }
};

// ─── Study Progress (SRS cards) ───────────────────────────────────────────────

/**
 * Save/update a single question's SRS progress.
 */
export const saveQuestionProgress = async (uid, questionId, progressData) => {
  if (!supabase) return; // Client-side localStorage fallback used in AuthContext
  
  const { error } = await supabase
    .from('progress')
    .upsert({
      user_id: uid,
      question_id: questionId,
      difficulty: progressData.difficulty,
      stability: progressData.stability,
      repetitions: progressData.repetitions,
      ease_factor: progressData.easeFactor,
      last_review_date: progressData.lastReviewDate,
      next_review_date: progressData.nextReviewDate,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,question_id' });

  if (error) {
    console.error('[Supabase] Failed to save progress:', error);
    throw error;
  }
};

/**
 * Fetch all progress cards.
 */
export const getAllProgress = async (uid) => {
  if (!supabase) return {}; // Loaded from client localStorage fallback
  
  const { data, error } = await supabase
    .from('progress')
    .select('*')
    .eq('user_id', uid);

  if (error) {
    console.error('[Supabase] Failed to fetch all progress:', error);
    return {};
  }

  const result = {};
  data.forEach((row) => {
    result[row.question_id] = {
      difficulty: row.difficulty,
      stability: row.stability,
      repetitions: row.repetitions,
      easeFactor: row.ease_factor,
      lastReviewDate: row.last_review_date,
      nextReviewDate: row.next_review_date,
    };
  });
  return result;
};

// ─── Mock Exam History ────────────────────────────────────────────────────────

/**
 * Save a mock exam result.
 */
export const saveMockResult = async (uid, result) => {
  if (!supabase) return; // Client-side localStorage fallback in AuthContext
  
  const { error } = await supabase
    .from('mock_history')
    .insert({
      user_id: uid,
      exam_id: result.examId,
      exam_name: result.examName,
      school: result.school,
      score: result.score,
      max_score: result.maxScore,
      pct: result.pct,
      correct_count: result.correctCount,
      wrong_count: result.wrongCount,
      empty_count: result.emptyCount,
      mode: result.mode,
      date: result.date || new Date().toISOString(),
    });

  if (error) {
    console.error('[Supabase] Failed to save mock result:', error);
    throw error;
  }
};

/**
 * Fetch all mock exam history.
 */
export const getMockHistory = async (uid) => {
  if (!supabase) return []; // Loaded from client localStorage fallback
  
  const { data, error } = await supabase
    .from('mock_history')
    .select('*')
    .eq('user_id', uid)
    .order('date', { ascending: false });

  if (error) {
    console.error('[Supabase] Failed to fetch mock history:', error);
    return [];
  }

  return data.map((row) => ({
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
  }));
};

// ─── Daily Activity ───────────────────────────────────────────────────────────

/**
 * Increment the daily activity counter.
 */
export const incrementDailyActivity = async (uid) => {
  if (!supabase) return;
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('activity')
    .select('count')
    .eq('user_id', uid)
    .eq('date', today)
    .maybeSingle();

  if (error) {
    console.error('[Supabase] Failed to fetch daily activity:', error);
    return;
  }

  const count = data ? (data.count || 0) + 1 : 1;

  const { error: upsertError } = await supabase
    .from('activity')
    .upsert({
      user_id: uid,
      date: today,
      count,
    }, { onConflict: 'user_id,date' });

  if (upsertError) {
    console.error('[Supabase] Failed to increment daily activity:', upsertError);
    throw upsertError;
  }
};

/**
 * Fetch the last N days of activity.
 */
export const getRecentActivity = async (uid, days = 90) => {
  if (!supabase) return {};
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('activity')
    .select('*')
    .eq('user_id', uid)
    .gte('date', cutoffStr);

  if (error) {
    console.error('[Supabase] Failed to fetch recent activity:', error);
    return {};
  }

  const result = {};
  data.forEach((row) => {
    result[row.date] = row.count || 0;
  });
  return result;
};

/**
 * Delete a user by UID (Admin only).
 */
export const deleteUser = async (uid) => {
  if (!supabase) {
    try {
      await localDb.delete('/users', uid);
      return true;
    } catch (err) {
      console.error('[LocalDB] Failed to delete user:', err);
      return false;
    }
  }

  const { error } = await supabase.rpc('delete_user', { uid });
  if (error) {
    console.error('[Supabase] Failed to delete user:', error);
    return false;
  }
  return true;
};

/**
 * Fetch all registered users (Admin only).
 */
export const getAllUsers = async () => {
  if (!supabase) {
    try {
      const list = await localDb.get('/users');
      return list.map(mapDBToProfile);
    } catch (err) {
      console.error('[LocalDB] Failed to fetch users:', err);
      return [];
    }
  }

  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_all_profiles');
    if (!rpcError && rpcData) {
      return rpcData.map(mapDBToProfile);
    }
  } catch (rpcErr) {
    console.warn('[Supabase] RPC get_all_profiles failed, falling back to direct query:', rpcErr.message);
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('joined', { ascending: false });

  if (error) {
    console.error('[Supabase] Failed to fetch all users:', error);
    return [];
  }
  return data.map(mapDBToProfile);
};

/**
 * Fetch the public leaderboard of top 100 students.
 */
export const getLeaderboard = async () => {
  if (!supabase) {
    try {
      const list = await localDb.get('/users');
      return list
        .filter(u => u.role !== 'admin')
        .map(mapDBToProfile)
        .sort((a, b) => (b.xp || 0) - (a.xp || 0))
        .slice(0, 100);
    } catch (err) {
      console.error('[LocalDB] Failed to fetch leaderboard:', err);
      return [];
    }
  }

  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_leaderboard');
    if (!rpcError && rpcData) {
      return rpcData;
    }
  } catch (err) {
    console.warn('[Supabase] RPC get_leaderboard failed, falling back to direct profiles query:', err.message);
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('name, xp, streak, tier, role')
    .neq('role', 'admin')
    .not('name', 'ilike', 'Directeur')
    .order('xp', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[Supabase] Failed to fetch leaderboard:', error);
    return [];
  }
  return data;
};

/**
 * Log a user login.
 */
export const addLoginLog = async (uid) => {
  if (!supabase) return;
  const { error } = await supabase
    .from('login_logs')
    .insert({
      user_id: uid,
      logged_at: new Date().toISOString()
    });
  if (error) {
    console.error('[Supabase] Failed to log user login:', error);
  }
};

/**
 * Fetch login logs for a user.
 */
export const getLoginLogs = async (uid) => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('login_logs')
    .select('*')
    .eq('user_id', uid)
    .order('logged_at', { ascending: false });

  if (error) {
    console.error('[Supabase] Failed to fetch login logs:', error);
    return [];
  }
  return data.map(row => ({
    id: row.id,
    userId: row.user_id,
    loggedAt: row.logged_at
  }));
};

/**
 * Fetch progress cards deltas.
 */
export const getProgressDeltas = async (uid, sinceTimestamp) => {
  if (!supabase) return {};

  let query = supabase
    .from('progress')
    .select('*')
    .eq('user_id', uid);

  if (sinceTimestamp) {
    query = query.gt('updated_at', sinceTimestamp);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[Supabase] Failed to fetch progress deltas:', error);
    return null;
  }

  const result = {};
  data.forEach((row) => {
    result[row.question_id] = {
      difficulty: row.difficulty,
      stability: row.stability,
      repetitions: row.repetitions,
      easeFactor: row.ease_factor,
      lastReviewDate: row.last_review_date,
      nextReviewDate: row.next_review_date,
      updatedAt: row.updated_at
    };
  });
  return result;
};

/**
 * Synchronize missing auth users (Admin only).
 */
export const syncStudentsWithSupabase = async () => {
  if (!supabase) return { success: false, synchronized_count: 0 };
  const { data, error } = await supabase.rpc('sync_auth_users_to_profiles');
  if (error) {
    console.error('[Supabase] Failed to synchronize students:', error);
    throw error;
  }
  return data;
};

/**
 * Log a document/report download.
 */
export const logUserDownload = async (uid, downloadData) => {
  if (!supabase) return;
  try {
    const { data, error: fetchErr } = await supabase
      .from('profiles')
      .select('downloads')
      .eq('id', uid)
      .maybeSingle();

    if (fetchErr) {
      console.error('[Supabase] Failed to fetch downloads:', fetchErr);
      return;
    }

    const currentDownloads = Array.isArray(data?.downloads) ? data.downloads : [];

    const newEntry = {
      ...downloadData,
      downloadedAt: new Date().toISOString()
    };

    const updatedDownloads = [newEntry, ...currentDownloads].slice(0, 100);

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ downloads: updatedDownloads })
      .eq('id', uid);

    if (updateErr) {
      console.error('[Supabase] Failed to log download:', updateErr);
    }
  } catch (err) {
    console.error('[Supabase] Exception logging download:', err);
  }
};
