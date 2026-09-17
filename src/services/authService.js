// src/services/authService.js
// Native Authentication service connected directly to Neon PostgreSQL via /api/auth
// Fully replaces Supabase Auth with zero external third-party dependencies.

const TOKEN_KEY = 'gama_auth_token';

export const getStoredToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch (_) {
    return null;
  }
};

export const setStoredToken = (token) => {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch (_) {}
};

const parseJsonResponse = async (response) => {
  try {
    const text = await response.text();
    return JSON.parse(text);
  } catch (_) {
    return { error: `Erreur serveur (${response.status})` };
  }
};

/**
 * Register a new student account directly in Neon.
 */
export const registerStudent = async (name, email, password) => {
  const response = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'register',
      name,
      email,
      password,
    }),
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.error || "Échec de l'inscription");
  }

  if (data.token) {
    setStoredToken(data.token);
  }

  return {
    ...data.user,
    needsConfirmation: false,
  };
};

/**
 * Sign in with email and password directly against Neon.
 */
export const loginWithEmail = async (email, password) => {
  const response = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'login',
      email,
      password,
    }),
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.error || 'Échec de la connexion');
  }

  if (data.token) {
    setStoredToken(data.token);
  }

  return data.user;
};

/**
 * Fetch currently verified session from Neon.
 */
export const getCurrentSessionUser = async () => {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const response = await fetch('/api/auth', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        setStoredToken(null);
      }
      return null;
    }

    const data = await parseJsonResponse(response);
    return data.user || null;
  } catch (err) {
    console.warn('[Auth] Error verifying session:', err.message);
    return null;
  }
};

/**
 * Google OAuth fallback
 */
export const loginWithGoogle = async () => {
  throw new Error("Connexion Google non configurée. Veuillez vous connecter avec votre adresse email et mot de passe.");
};

/**
 * Sign out the current user.
 */
export const logoutUser = async () => {
  setStoredToken(null);
  return Promise.resolve();
};

/**
 * Listen for auth changes (local storage token updates or custom events).
 */
export const onAuthChange = (callback) => {
  const handleAuthChange = async () => {
    const user = await getCurrentSessionUser();
    callback(user ? 'SIGNED_IN' : 'SIGNED_OUT', user ? { user } : null);
  };

  window.addEventListener('storage', (e) => {
    if (e.key === TOKEN_KEY) {
      handleAuthChange();
    }
  });

  return () => {};
};
