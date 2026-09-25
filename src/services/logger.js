// src/services/logger.js
import { supabase } from '../lib/supabase';

/**
 * Safely logs an application error to console and Supabase error_logs table.
 * 
 * @param {Error|any} error The error object or message
 * @param {Object} [extraInfo] Additional info (e.g. React componentStack)
 */
export async function logError(error, extraInfo = {}) {
  console.error('[ErrorLogger]', error, extraInfo);

  if (supabase) {
    try {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : null;
      await supabase.from('error_logs').insert({
        message: errorMsg,
        stack: stack,
        extra_info: extraInfo,
        created_at: new Date().toISOString()
      });
    } catch (_) {}
  }
}

export const logErrorToSupabase = logError;
export default logError;
