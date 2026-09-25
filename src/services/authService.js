// src/services/authService.js
// Supabase Authentication service — email/password sign-in & OAuth
// All functions are resilient and fallback gracefully when Supabase is not configured.

import { supabase } from '../lib/supabase';
import { createUserDoc, getUserDoc } from './userService';

/**
 * Register a new student account and create their profile document.
 * @param {string} name
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{uid, name, email, role, tier}>}
 */
export const registerStudent = async (name, email, password) => {
  if (!supabase) throw new Error('Supabase n\'est pas configuré.');
  
  if (email.toLowerCase().trim() === 'admin@lconq.ma') {
    throw new Error('Inscription impossible avec cette adresse e-mail.');
  }
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
      },
    },
  });

  if (error) throw error;
  if (!data.user) throw new Error('Échec de l\'inscription.');

  const userData = {
    name,
    email,
    role: 'student',
    tier: 'freemium',
    xp: 0,
    streak: 0,
    rank: null,
    totalStudents: 1200,
    joined: new Date().toISOString(),
    subscription: null,
  };

  // Try to create profile in DB as a safety net if trigger didn't fire
  try {
    await createUserDoc(data.user.id, userData);
  } catch (profileErr) {
    console.warn('[Auth] Profile creation warning (safe to ignore if handled by DB trigger):', profileErr.message);
  }

  const needsConfirmation = !data.session;
  return { uid: data.user.id, id: data.user.id, ...userData, needsConfirmation };
};

/**
 * Sign in with email and password.
 * Fetches the Supabase user profile to get role/tier/subscription.
 */
export const loginWithEmail = async (email, password) => {
  if (!supabase) throw new Error('Supabase n\'est pas configuré.');

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  if (!data.user) throw new Error('Échec de la connexion.');

  const profile = await getUserDoc(data.user.id);

  return {
    uid: data.user.id,
    id: data.user.id,
    name: profile?.name || data.user.user_metadata?.name || data.user.user_metadata?.full_name || 'Élève',
    email: data.user.email,
    role: profile?.role || 'student',
    tier: profile?.tier || 'freemium',
    xp: profile?.xp || 0,
    streak: profile?.streak || 0,
    rank: profile?.rank || null,
    totalStudents: profile?.totalStudents || 1200,
    subscription: profile?.subscription || null,
    classId: profile?.classId || null,
    school: profile?.school || null,
  };
};

/**
 * Sign in with Google OAuth.
 */
export const loginWithGoogle = async () => {
  if (!supabase) throw new Error('Supabase n\'est pas configuré.');

  sessionStorage.setItem('_oauth_in_progress', '1');
  const redirectTo = `${window.location.origin}/auth/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) {
    sessionStorage.removeItem('_oauth_in_progress');
    throw error;
  }
  return data;
};

/**
 * Fetch currently verified session from Supabase.
 */
export const getCurrentSessionUser = async () => {
  if (!supabase) return null;

  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.user) return null;

    const user = session.user;
    const profile = await getUserDoc(user.id);

    return {
      uid: user.id,
      id: user.id,
      name: profile?.name || user.user_metadata?.name || user.user_metadata?.full_name || 'Élève',
      email: user.email,
      role: profile?.role || 'student',
      tier: profile?.tier || 'freemium',
      xp: profile?.xp || 0,
      streak: profile?.streak || 0,
      rank: profile?.rank || null,
      totalStudents: profile?.totalStudents || 1200,
      subscription: profile?.subscription || null,
      classId: profile?.classId || null,
      school: profile?.school || null,
    };
  } catch (err) {
    console.warn('[Auth] Error getting session user:', err.message);
    return null;
  }
};

/**
 * Sign out the current user.
 */
export const logoutUser = () => {
  if (supabase) {
    return supabase.auth.signOut();
  }
  return Promise.resolve();
};

/**
 * Subscribe to Supabase auth state changes.
 */
export const onAuthChange = (callback) => {
  if (!supabase) return () => {};

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      callback(event, session);
    }
  );

  return () => {
    if (subscription) {
      subscription.unsubscribe();
    }
  };
};

/** Backward-compatibility helpers */
export const getStoredToken = () => {
  if (!supabase) return null;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const item = JSON.parse(localStorage.getItem(key));
        return item?.access_token || null;
      }
    }
  } catch (_) {}
  return null;
};

export const setStoredToken = () => {};
