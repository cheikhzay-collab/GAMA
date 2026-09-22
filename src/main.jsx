import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { logError } from './services/logger'
import { queryCache } from './services/queryCache'

// ── Global Error Listeners ─────────────────────────────────────────────────
window.addEventListener('error', (event) => {
  const errorObj = event.error || new Error(event.message || 'Global Window Error');
  logError(errorObj);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const errorObj = reason instanceof Error
    ? reason
    : new Error(reason ? String(reason) : 'Unhandled Promise Rejection');
  logError(errorObj);
});

// ── Cache Warm-up (non-blocking) ───────────────────────────────────────────
// Pre-populate memory cache from IndexedDB before first render.
// This ensures 0ms reads for frequently accessed data on app startup.
queryCache.warmUp([
  'classes_all',
  'lessons_all',
  'users_all',
  'school_config',
]).then(() => {
  // After warm-up, evict stale entries in background (runs once per session)
  return queryCache.evictExpired();
}).catch(() => {
  // Non-critical — ignore if IndexedDB is unavailable
});

// ── Mount React ────────────────────────────────────────────────────────────
const root = createRoot(document.getElementById('root'));
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// ── Hide Splash Screen once React has mounted ──────────────────────────────
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    if (typeof window.__hideSplash === 'function') {
      window.__hideSplash();
    }
  });
});
