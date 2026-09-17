import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Zap, AlertCircle, Check, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import LconqLogo from '../components/LconqLogo';


export default function Login() {
  const location                          = useLocation();
  const isRegistering                     = location.pathname === '/register';
  const queryParams                       = new URLSearchParams(location.search);
  const isExpired                         = queryParams.get('expired') === '1';
  const isInactive                        = queryParams.get('inactive') === '1';
  const [name, setName]                   = useState('');
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [showPwd, setShowPwd]             = useState(false);
  const [isLoading, setIsLoading]         = useState(false);
  const [errorMsg, setErrorMsg]           = useState('');
  const [successMsg, setSuccessMsg]       = useState('');

  const { login, register, loginWithGoogle } = useAuth();
  const navigate                          = useNavigate();

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (isRegistering) {
        if (!name.trim()) {
          throw new Error('Veuillez saisir votre nom complet.');
        }
        const newUser = await register(name.trim(), email, password);
        if (newUser && newUser.needsConfirmation) {
          setSuccessMsg("Compte créé avec succès ! Un e-mail de confirmation vous a été envoyé. Veuillez cliquer sur le lien dans l'e-mail pour activer votre compte avant de vous connecter.");
          setIsLoading(false);
          return;
        }
        navigate('/dashboard');
      } else {
        const loggedUser = await login(email, password);
        navigate(loggedUser?.role === 'admin' ? '/admin/dashboard' : '/dashboard');
      }
    } catch (err) {
      console.error('[Auth] Error:', err);
      // Clean up Supabase/Firebase native messages for friendly display
      let msg = err.message || 'Une erreur est survenue.';
      if (msg.includes('Invalid login credentials')) {
        msg = 'Identifiants invalides. Veuillez vérifier votre email et mot de passe.';
      } else if (msg.includes('User already registered') || msg.includes('already exists')) {
        msg = 'Cette adresse email est déjà enregistrée. Essayez de vous connecter.';
      } else if (msg.includes('Password should be at least')) {
        msg = 'Le mot de passe doit contenir au moins 6 caractères.';
      } else if (msg.includes('is not valid JSON') || msg.includes('Erreur serveur') || msg.includes('A server error')) {
        msg = 'Impossible de joindre le serveur ou erreur interne. Veuillez réessayer dans quelques instants.';
      }
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      await loginWithGoogle();
      // Note: loginWithGoogle redirects the browser to Google's OAuth page.
      // The browser will navigate away and return via /auth/callback.
      // No navigate() needed here — it would never execute.
    } catch (err) {
      console.error('[Auth] Google Error:', err);
      let msg = err.message || 'Une erreur est survenue lors de la connexion Google.';
      setErrorMsg(msg);
      setIsLoading(false);
    }
    // Don't call setIsLoading(false) in finally since the page will redirect
  };


  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      background: 'var(--bg-base)',
    }}>
      {/* Left — decorative panel (hidden on mobile) */}
      <div style={{
        flex: '0 0 40%', background: 'linear-gradient(145deg, var(--violet) 0%, #312e81 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '3rem', position: 'relative', overflow: 'hidden'
      }} className="login-left-panel">
        {/* Ambient blobs */}
        <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-40px', left: '-40px', width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', color: '#fff' }}>
          <LconqLogo 
            size={64} 
            textSize="2.2rem" 
            variant="light"
            style={{ 
              flexDirection: 'column', 
              gap: '1rem', 
              marginBottom: '1.5rem',
              justifyContent: 'center' 
            }} 
          />
          <p style={{ opacity: 0.75, fontSize: '1rem', lineHeight: 1.65, maxWidth: 260 }}>
            La plateforme de préparation aux concours propulsée par l'IA — Médecine, ENSA, ENSAM.
          </p>
          <div style={{ marginTop: '2.5rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {[
              'Algorithme Spaced Repetition (SRS)',
              'Astuces IA par question',
              'Classement national en temps réel',
            ].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', fontSize: '0.88rem', opacity: 0.85 }}>
                <Zap size={14} color="#34d399" /> {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — auth form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(1.5rem, 5vw, 3rem) clamp(1rem, 4vw, 2rem)' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          {/* Mobile-only Logo */}
          <div className="login-mobile-logo" style={{ display: 'none', marginBottom: '1.75rem', justifyContent: 'center' }}>
            <LconqLogo size={42} textSize="1.5rem" />
          </div>

          {/* Back link */}
          <Link to="/" style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginBottom: '2rem', transition: 'color 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-main)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            ← Retour à l'accueil
          </Link>

          <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 1.75rem)', fontWeight: 800, marginBottom: '0.4rem', letterSpacing: '-0.02em' }}>
            {isRegistering ? 'Créer un compte' : 'Connexion'}
          </h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
            {isRegistering ? 'Rejoignez la plateforme et préparez vos concours.' : 'Accédez à votre espace de révision.'}
          </p>

          {/* Clean Tab Selector */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}>
            <button
              type="button"
              onClick={() => { navigate('/login'); setErrorMsg(''); }}
              style={{
                flex: 1,
                padding: '0.75rem 0',
                background: 'none',
                border: 'none',
                borderBottom: !isRegistering ? '2px solid var(--violet)' : '2px solid transparent',
                color: !isRegistering ? 'var(--text-main)' : 'var(--text-muted)',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => { navigate('/register'); setErrorMsg(''); }}
              style={{
                flex: 1,
                padding: '0.75rem 0',
                background: 'none',
                border: 'none',
                borderBottom: isRegistering ? '2px solid var(--violet)' : '2px solid transparent',
                color: isRegistering ? 'var(--text-main)' : 'var(--text-muted)',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              Inscription
            </button>
          </div>

          {/* Session Expiry or Inactivity Alert */}
          {(isExpired || isInactive) && !errorMsg && !successMsg && (
            <div style={{
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              padding: '0.875rem 1rem',
              borderRadius: '12px',
              color: '#d97706',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              marginBottom: '1.25rem',
              animation: 'fadeInAlert 0.3s ease-out'
            }}>
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes fadeInAlert {
                  from { opacity: 0; transform: translateY(-8px); }
                  to { opacity: 1; transform: translateY(0); }
                }
              `}} />
              <Clock size={18} style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 600 }}>
                {isExpired 
                  ? "Votre session a expiré. Veuillez vous reconnecter."
                  : "Déconnexion automatique après 30 minutes d'inactivité."}
              </span>
            </div>
          )}

          {/* Error Alert Display */}
          {errorMsg && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              padding: '0.875rem 1rem',
              borderRadius: '12px',
              color: 'var(--danger)',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1.25rem'
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 500 }}>{errorMsg}</span>
            </div>
          )}

          {/* Success Alert Display */}
          {successMsg && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              padding: '0.875rem 1rem',
              borderRadius: '12px',
              color: 'var(--emerald)',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1.25rem'
            }}>
              <Check size={18} style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 500 }}>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {isRegistering && (
              <div className="input-group">
                <label>Nom complet</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="Ex: Youssef Alaoui"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
            )}

            <div className="input-group">
              <label>Adresse email</label>
              <input
                type="email"
                className="input-control"
                placeholder="votre@email.ma"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <div className="input-group">
              <label>Mot de passe</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="input-control"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                  style={{ paddingRight: '3rem', width: '100%' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(p => !p)}
                  disabled={isLoading}
                  style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer' }}
                >
                  {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn"
              disabled={isLoading}
              style={{ width: '100%', justifyContent: 'center', padding: '0.875rem', fontSize: '1rem', background: 'linear-gradient(135deg, var(--violet), #818cf8)' }}
            >
              {isLoading ? 'Opération en cours...' : isRegistering ? "S'inscrire" : 'Se connecter'}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', margin: '1.25rem 0', gap: '0.875rem' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', fontWeight: 600 }}>OU</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              padding: '0.875rem',
              fontSize: '0.95rem',
              fontWeight: 600,
              background: 'var(--bg-glass)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              color: 'var(--text-main)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--border-hover)';
              e.currentTarget.style.background = 'var(--bg-hover)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.background = 'var(--bg-glass)';
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6-4.53z" fill="#EA4335" />
            </svg>
            Continuer avec Google
          </button>


        </div>
      </div>
    </div>
  );
}
