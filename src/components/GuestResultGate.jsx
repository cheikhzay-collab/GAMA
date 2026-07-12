import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, AlertCircle, Check, Lock, Trophy, Zap, Users, Crown } from 'lucide-react';

/**
 * GuestResultGate — displayed to unauthenticated guests after finishing an exam.
 * Shows a teaser of the result and prompts registration/login to unlock full results.
 *
 * Props:
 *   totalCount      {number}  — total number of questions
 *   examId          {string}  — exam ID for redirect after auth
 *   answers         {object}  — full answers map to persist across OAuth redirect
 *   isPremiumExam   {boolean} — whether the exam requires a premium subscription
 *   onAuthSuccess   {function}— called when user logs in / registers successfully (email flow)
 */
export default function GuestResultGate({ 
  totalCount, 
  examId, 
  answers, 
  isPremiumExam = false, 
  onAuthSuccess,
  score = 0,
  correctCount = 0,
  wrongCount = 0,
  pct = 0
}) {
  const { login, register, loginWithGoogle } = useAuth();

  // For premium exams: after auth, redirect to subscription page
  // For free exams: redirect back to the exam to show results
  const postAuthRedirect = isPremiumExam
    ? `/subscription?returnTo=/exam?exam=${examId}&guest=true`
    : `/exam?exam=${examId}&guest=true`;

  // Persist all guest data to sessionStorage so it survives OAuth redirects
  const saveGuestData = () => {
    sessionStorage.setItem('guest_exam_answers', JSON.stringify(answers));
    sessionStorage.setItem('guest_exam_id', examId);
    sessionStorage.setItem('redirect_after_auth', postAuthRedirect);
  };

  const [mode, setMode]             = useState('register'); // 'register' | 'login'
  const [name, setName]             = useState('');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPwd, setShowPwd]       = useState(false);
  const [isLoading, setIsLoading]   = useState(false);
  const [errorMsg, setErrorMsg]     = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const circumference = 2 * Math.PI * 42;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    // Persist data before any async operation
    saveGuestData();

    try {
      if (mode === 'register') {
        if (!name.trim()) throw new Error('Veuillez saisir votre nom complet.');
        const newUser = await register(name.trim(), email, password);
        if (newUser?.needsConfirmation) {
          setSuccessMsg("Compte créé ! Vérifiez votre email pour confirmer, puis connectez-vous.");
          setMode('login');
          setIsLoading(false);
          return;
        }
        onAuthSuccess?.();
      } else {
        await login(email, password);
        onAuthSuccess?.();
      }
    } catch (err) {
      let msg = err.message || 'Une erreur est survenue.';
      if (msg.includes('Invalid login credentials')) msg = 'Email ou mot de passe incorrect.';
      else if (msg.includes('already registered') || msg.includes('already exists')) msg = 'Cet email est déjà enregistré. Connectez-vous.';
      else if (msg.includes('Password should be at least')) msg = 'Le mot de passe doit contenir au moins 6 caractères.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    setIsLoading(true);
    setErrorMsg('');
    // Persist data BEFORE redirect — sessionStorage survives Google OAuth
    saveGuestData();
    try {
      await loginWithGoogle();
      // Page redirects to Google — AuthCallback will read redirect_after_auth
    } catch (err) {
      setErrorMsg(err.message || 'Erreur Google.');
      setIsLoading(false);
    }
  };

  return (
    <div className="guest-gate-overlay animate-fade-in">
      {/* Animated gradient background */}
      <div className="guest-gate-bg" />

      <div className="guest-gate-card">

        {/* ── TOP: Score teaser ── */}
        <div className="guest-gate-teaser">

          {/* Blurred score circle */}
          <div className="guest-gate-score-wrap">
            <div className="guest-gate-score-blur">
              <svg width="130" height="130" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke="url(#gGrad)" strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - pct / 100)}
                  style={{ transition: 'stroke-dashoffset 1.2s ease', filter: 'blur(3px)' }}
                />
                <defs>
                  <linearGradient id="gGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="var(--violet)" />
                    <stop offset="100%" stopColor="var(--emerald)" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="guest-gate-score-inner">
                <span className="guest-gate-score-val">{score}</span>
                <span className="guest-gate-score-sub">/{totalCount}</span>
              </div>
            </div>
            <div className="guest-gate-lock-badge">
              <Lock size={16} />
            </div>
          </div>

          {/* Headline */}
          <div className="guest-gate-headline">
            {isPremiumExam ? (
              <>
                <div className="guest-gate-premium-badge">
                  <Crown size={14} /> Concours Premium
                </div>
                <h2>Votre résultat est prêt&nbsp;! 🎯</h2>
                <p>
                  Ce concours est <strong>Premium</strong>. Créez un compte gratuit, puis abonnez-vous
                  pour débloquer votre correction complète et votre rapport diagnostique.
                </p>
              </>
            ) : (
              <>
                <h2>Votre résultat est prêt&nbsp;! 🎯</h2>
                <p>
                  Créez un compte <strong>gratuit</strong> pour débloquer votre correction complète,
                  les astuces IA par question et votre rapport diagnostique.
                </p>
              </>
            )}
          </div>

          {/* Quick stats */}
          <div className="guest-gate-stats-row" style={{ flexWrap: 'wrap', justifyContent: 'center', gap: '0.8rem 1.2rem' }}>
            <div className="guest-gate-stat">
              <Check size={14} color="var(--emerald)" />
              <span style={{ color: 'var(--emerald)', fontWeight: 700 }}>{correctCount} Correctes</span>
            </div>
            <div className="guest-gate-stat-dot" />
            <div className="guest-gate-stat">
              <AlertCircle size={14} color="var(--danger)" />
              <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{wrongCount} Incorrectes</span>
            </div>
            <div className="guest-gate-stat-dot" />
            <div className="guest-gate-stat">
              <Trophy size={14} color="var(--warning, #f59e0b)" />
              <span style={{ color: 'var(--warning)', fontWeight: 700 }}>Score: {score}/{totalCount}</span>
            </div>
          </div>

          {/* Social proof */}
          <div className="guest-gate-social-proof">
            <Users size={13} />
            <span>+1 200 élèves préparent leurs concours sur L'CONQ</span>
          </div>
        </div>

        {/* ── DIVIDER ── */}
        <div className="guest-gate-divider" />

        {/* ── BOTTOM: Auth form ── */}
        <div className="guest-gate-form-area">

          {/* Tab switcher */}
          <div className="guest-gate-tabs">
            <button
              className={`guest-gate-tab${mode === 'register' ? ' active' : ''}`}
              onClick={() => { setMode('register'); setErrorMsg(''); }}
              type="button"
            >
              Créer un compte
            </button>
            <button
              className={`guest-gate-tab${mode === 'login' ? ' active' : ''}`}
              onClick={() => { setMode('login'); setErrorMsg(''); }}
              type="button"
            >
              Se connecter
            </button>
          </div>

          {/* Google OAuth */}
          <button
            className="guest-gate-google-btn"
            onClick={handleGoogle}
            disabled={isLoading}
            type="button"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84-.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.52z" fill="#EA4335"/>
            </svg>
            Continuer avec Google
          </button>

          <div className="guest-gate-or">
            <div className="guest-gate-or-line" />
            <span>ou</span>
            <div className="guest-gate-or-line" />
          </div>

          {/* Alerts */}
          {errorMsg && (
            <div className="guest-gate-alert error">
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="guest-gate-alert success">
              <Check size={14} style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="guest-gate-form">
            {mode === 'register' && (
              <input
                className="input-control"
                type="text"
                placeholder="Nom complet"
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={isLoading}
                required
              />
            )}
            <input
              className="input-control"
              type="email"
              placeholder="Adresse email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={isLoading}
              required
            />
            <div style={{ position: 'relative' }}>
              <input
                className="input-control"
                type={showPwd ? 'text' : 'password'}
                placeholder="Mot de passe (min. 6 caractères)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={isLoading}
                required
                style={{ paddingRight: '3rem', width: '100%', boxSizing: 'border-box' }}
              />
              <button
                type="button"
                onClick={() => setShowPwd(p => !p)}
                style={{
                  position: 'absolute', right: '0.875rem', top: '50%',
                  transform: 'translateY(-50%)', background: 'none', border: 'none',
                  color: 'var(--text-subtle)', cursor: 'pointer', padding: 0,
                }}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <button
              type="submit"
              className="guest-gate-submit-btn"
              disabled={isLoading}
            >
              {isLoading ? 'Chargement...' : (
                <>
                  {isPremiumExam ? <Crown size={16} fill="currentColor" /> : <Zap size={16} fill="currentColor" />}
                  {mode === 'register'
                    ? (isPremiumExam ? 'Créer mon compte et voir les offres' : 'Créer mon compte et voir ma note')
                    : (isPremiumExam ? 'Se connecter et voir les offres' : 'Se connecter et voir ma note')}
                </>
              )}
            </button>
          </form>

          <p className="guest-gate-disclaimer">
            Gratuit · Sans carte bancaire · Annulable à tout moment
          </p>
        </div>
      </div>
    </div>
  );
}
