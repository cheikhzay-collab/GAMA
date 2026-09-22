// src/services/logger.js

/**
 * Safely logs an application error.
 * 
 * @param {Error|any} error The error object or message
 * @param {Object} [extraInfo] Additional info (e.g. React componentStack)
 */
export async function logError(error, extraInfo = {}) {
  // Always log to console as developer review
  console.error('[ErrorLogger]', error, extraInfo);
}

// Compatibility aliases
export const logErrorToNeon = logError;
export const logErrorToSupabase = logError;
export default logError;
