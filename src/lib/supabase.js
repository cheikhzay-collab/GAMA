// src/lib/supabase.js
// Supabase initialization — config values come from Vercel environment variables or .env.local
//
// If VITE_SUPABASE_URL is absent (local dev without .env.local),
// Supabase is NOT initialized and the client is null.
// AuthContext checks SUPABASE_ENABLED before using these exports.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // ── FIX (mobile cache bug): Use the default localStorage (NOT sessionStorage).
      //    On mobile PWA (iOS Safari / Android Chrome), sessionStorage is NOT reliably
      //    cleared between app backgrounding/foregrounding. This causes Supabase to
      //    find expired JWT tokens in storage → every API request returns 401 →
      //    the client freezes for 15s per request until timeout.
      //    localStorage tokens are refreshed automatically via autoRefreshToken.
      persistSession:      true,
      autoRefreshToken:    true,   // silently renews tokens before expiry
      detectSessionInUrl:  true,   // handles OAuth /auth/callback redirects
    },
    global: {
      // Fast timeout and resilient network handling
      fetch: (url, options = {}) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 30_000); // 30s timeout

        // Link caller's signal to AbortController
        if (options.signal) {
          if (options.signal.aborted) {
            controller.abort();
          } else {
            options.signal.addEventListener('abort', () => controller.abort());
          }
        }

        const newOptions = {
          ...options,
          signal: controller.signal
        };

        return fetch(url, newOptions)
          .then(response => {
            // Intercept 401 responses (except refresh token requests) to signal invalid auth session
            if (response.status === 401 && !url.includes('/auth/v1/token')) {
              console.warn('[Supabase API] 401 Unauthorized response detected. Dispatching unauthorized event.');
              window.dispatchEvent(new CustomEvent('supabase-auth-unauthorized'));
            }
            return response;
          })
          .finally(() => clearTimeout(id));
      },
    },
  });
} else {
  console.warn(
    '[Supabase] No VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY found — running in localStorage-only mode.\n' +
    'To enable Supabase, copy .env.example to .env.local and fill in your credentials.'
  );
}

export { supabase };
export default supabase;
