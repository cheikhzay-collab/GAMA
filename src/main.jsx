import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { logErrorToSupabase } from './services/logger'

// ── Global Error Listeners (captures unhandled runtime errors & promise rejections) ──
window.addEventListener('error', (event) => {
  // Only log if it's an actual unhandled error (some third party libraries throw non-Error objects)
  const errorObj = event.error || new Error(event.message || 'Global Window Error');
  logErrorToSupabase(errorObj);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const errorObj = reason instanceof Error 
    ? reason 
    : new Error(reason ? String(reason) : 'Unhandled Promise Rejection');
  logErrorToSupabase(errorObj);
});

// ── Mount React normally ──
const root = createRoot(document.getElementById('root'));
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// ── Hide Splash Screen once React has mounted ──
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    if (typeof window.__hideSplash === 'function') {
      window.__hideSplash();
    }
  });
});


