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
      // Use default localStorage for reliable persistence on mobile PWA and desktop
      persistSession:      true,
      autoRefreshToken:    true,   // silently renews tokens before expiry
      detectSessionInUrl:  true,   // handles OAuth /auth/callback redirects
    },
    global: {
      // Resilient network handling with 30s timeout
      fetch: (url, options = {}) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 30_000);

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
            if (response.status === 401 && !url.includes('/auth/v1/token')) {
              console.warn('[Supabase API] 401 Unauthorized detected.');
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
    'To enable Supabase, check .env.local and fill in your credentials.'
  );
}

export { supabase };
export default supabase;
