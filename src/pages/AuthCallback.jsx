import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import LconqLogo from '../components/LconqLogo';

/**
 * AuthCallback page — handles the redirect from Supabase OAuth (Google, etc.)
 * Supabase exchanges the code/token from the URL and calls onAuthStateChange,
 * which AuthContext already listens to. We just wait briefly then redirect.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Finalisation de la connexion…');
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const handleCallback = async () => {
      try {
        if (!supabase) {
          navigate('/login', { replace: true });
          return;
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (session) {
          if (isMounted) {
            setStatus('Connexion réussie ! Redirection…');
            setTimeout(() => {
              const redirectTo = sessionStorage.getItem('redirect_after_auth') || '/dashboard';
              sessionStorage.removeItem('redirect_after_auth');
              navigate(redirectTo, { replace: true });
            }, 800);
          }
        } else {
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
            if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && sess) {
              subscription.unsubscribe();
              if (isMounted) {
                setStatus('Connexion réussie ! Redirection…');
                setTimeout(() => {
                  const redirectTo = sessionStorage.getItem('redirect_after_auth') || '/dashboard';
                  sessionStorage.removeItem('redirect_after_auth');
                  navigate(redirectTo, { replace: true });
                }, 800);
              }
            }
          });

          setTimeout(() => {
            subscription.unsubscribe();
            if (isMounted) {
              navigate('/login', { replace: true });
            }
          }, 8000);
        }
      } catch (err) {
        console.error('[AuthCallback] Error:', err);
        if (isMounted) {
          setError(err.message || 'Une erreur est survenue lors de la connexion.');
        }
      }
    };

    handleCallback();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base)',
      gap: '1.5rem',
    }}>
      <LconqLogo size={64} iconOnly={true} />

      {error ? (
        <>
          <p style={{ color: 'var(--danger)', fontWeight: 600, textAlign: 'center', maxWidth: 360 }}>
            {error}
          </p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, var(--violet), #818cf8)',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Retour à la connexion
          </button>
        </>
      ) : (
        <>
          <div style={{
            width: 40,
            height: 40,
            border: '3px solid var(--border)',
            borderTop: '3px solid var(--violet)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <p style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.95rem' }}>
            {status}
          </p>
        </>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
