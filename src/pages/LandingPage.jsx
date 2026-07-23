import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Zap, CheckCircle2, ArrowRight, Sparkles, 
  Sun, Moon, ClipboardList, Camera, FileText, 
  Users, BookOpen, GraduationCap, LayoutDashboard,
  MessageSquare, ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import WhatsAppButton from '../components/WhatsAppButton';

export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLight, setIsLight] = useState(() => localStorage.getItem('theme') === 'light');

  const toggleTheme = () => {
    const next = !isLight;
    setIsLight(next);
    localStorage.setItem('theme', next ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', next ? 'light' : 'dark');
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark');
  }, [isLight]);

  // If already logged in, helper to redirect to correct dashboard
  const getDashboardLink = () => {
    if (!user) return '/login';
    return user.role === 'admin' ? '/admin/dashboard' : '/dashboard';
  };

  return (
    <div className="animate-fade-in" style={{ 
      minHeight: '100vh', 
      background: 'var(--bg-main)', 
      color: 'var(--text-main)',
      fontFamily: 'Outfit, sans-serif',
      position: 'relative',
      overflow: 'hidden'
    }}>
      
      {/* Ambient background glow */}
      <div style={{
        position: 'absolute', top: '-10%', left: '-10%', width: '600px', height: '600px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124, 58, 237, 0.08) 0%, transparent 70%)',
        filter: 'blur(100px)', zIndex: 0, pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', top: '40%', right: '-10%', width: '500px', height: '500px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.05) 0%, transparent 70%)',
        filter: 'blur(100px)', zIndex: 0, pointerEvents: 'none'
      }} />

      {/* Header / Navigation */}
      <header style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '1.5rem 1.25rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '12px',
            background: 'linear-gradient(135deg, var(--violet), var(--emerald))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)'
          }}>
            <GraduationCap size={22} />
          </div>
          <span style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.03em', background: 'linear-gradient(135deg, var(--text-main), var(--text-muted))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            GAMA
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Light/Dark Toggle */}
          <button 
            onClick={toggleTheme} 
            style={{
              width: '40px', height: '40px', borderRadius: '12px', border: '1px solid var(--border)',
              background: 'var(--bg-glass)', color: 'var(--text-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
            }}
          >
            {isLight ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          {user ? (
            <Link to={getDashboardLink()} className="btn" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
              <LayoutDashboard size={16} />
              Tableau de bord
            </Link>
          ) : (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Link to="/login" style={{ textDecoration: 'none', color: 'var(--text-muted)', fontWeight: 700, padding: '0.6rem 1.25rem', borderRadius: '12px', transition: 'all 0.2s' }} className="hover-light">
                Connexion
              </Link>
              <Link to="/register" className="btn" style={{ textDecoration: 'none', fontWeight: 800 }}>
                Créer un compte
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '5rem 1.25rem 4rem',
        textAlign: 'center',
        position: 'relative',
        zIndex: 5
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          background: 'var(--violet-soft)', border: '1px solid rgba(124, 58, 237, 0.15)',
          padding: '0.45rem 1rem', borderRadius: '99px', color: 'var(--violet)',
          fontSize: '0.8rem', fontWeight: 800, marginBottom: '2rem'
        }}>
          <Sparkles size={13} fill="currentColor" />
          Copilote Intelligent pour Enseignants de Mathématiques
        </div>

        <h1 style={{
          fontSize: 'clamp(2.2rem, 6.5vw, 4.2rem)',
          fontWeight: 900,
          lineHeight: 1.1,
          letterSpacing: '-0.04em',
          maxWidth: '900px',
          margin: '0 auto 1.5rem',
          color: 'var(--text-main)'
        }}>
          Gagnez du temps.<br />
          <span style={{ background: 'linear-gradient(135deg, var(--violet), var(--emerald))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Inspirez vos élèves.
          </span>
        </h1>

        <p style={{
          fontSize: 'clamp(1rem, 2.5vw, 1.2rem)',
          color: 'var(--text-muted)',
          lineHeight: 1.6,
          maxWidth: '750px',
          margin: '0 auto 2.5rem'
        }}>
          GAMA est la plateforme moderne tout-en-un conçue pour simplifier la vie des enseignants de mathématiques au Maroc. De la préparation des cours à la correction instantanée des QCM, orchestrez tout depuis un seul espace.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '4rem' }}>
          <button 
            onClick={() => navigate(getDashboardLink())}
            className="btn" 
            style={{ padding: '0.85rem 2rem', fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            Accéder à l&apos;Espace Professeur <ArrowRight size={18} />
          </button>
          <a 
            href="#features" 
            className="btn-outline" 
            style={{ padding: '0.85rem 2rem', fontSize: '1rem', fontWeight: 800, textDecoration: 'none' }}
          >
            Découvrir les fonctionnalités
          </a>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section id="features" style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '2rem 1.25rem 6rem',
        position: 'relative',
        zIndex: 5
      }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--text-main)', marginBottom: '0.75rem' }}>
            Un espace de travail unifié & puissant
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', maxWidth: '600px', margin: '0 auto' }}>
            Des outils conçus spécifiquement pour automatiser les tâches administratives et sublimer vos cours de mathématiques.
          </p>
        </div>

        {/* Bento Grid layout */}
        <div className="pricing-grid" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', 
          gap: '1.5rem',
          alignItems: 'stretch'
        }}>
          {/* Card 1: Cahier de textes */}
          <div className="glass-panel" style={{
            padding: '2.5rem 2.25rem',
            borderRadius: '24px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            boxShadow: 'var(--shadow-card)',
            transition: 'transform 0.2s'
          }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '14px',
              background: 'rgba(124, 58, 237, 0.1)', color: 'var(--violet)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <ClipboardList size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                Cahier de Textes Intelligent
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.6 }}>
                Saisissez vos séances en quelques secondes selon votre emploi du temps configuré. Le système gère automatiquement les vacances scolaires et génère des PDF impeccables prêts pour l&apos;inspection.
              </p>
            </div>
          </div>

          {/* Card 2: Correcteur QCM (OMR) */}
          <div className="glass-panel" style={{
            padding: '2.5rem 2.25rem',
            borderRadius: '24px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            boxShadow: 'var(--shadow-card)',
            transition: 'transform 0.2s'
          }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '14px',
              background: 'rgba(16, 185, 129, 0.1)', color: 'var(--emerald)',
              display: 'flex', alignItems: 'center', justifycontent: 'center'
            }}>
              <Camera size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                Correction de QCM par Caméra (OMR)
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.6 }}>
                Corrigez instantanément les copies de vos élèves à l&apos;aide de votre webcam ou smartphone. Le système scanne la grille de réponses, calcule la note et enregistre les résultats en temps réel.
              </p>
            </div>
          </div>

          {/* Card 3: Générateur de Fiches & Documents */}
          <div className="glass-panel" style={{
            padding: '2.5rem 2.25rem',
            borderRadius: '24px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            boxShadow: 'var(--shadow-card)',
            transition: 'transform 0.2s'
          }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '14px',
              background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6',
              display: 'flex', alignItems: 'center', justifycontent: 'center'
            }}>
              <FileText size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                Fiches de Cours & LaTeX
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.6 }}>
                Préparez vos fiches de cours, séries d&apos;exercices progressives et devoirs surveillés. Toutes les équations et formules mathématiques sont rendues de manière professionnelle et élégante.
              </p>
            </div>
          </div>

          {/* Card 4: Niveaux & Sections */}
          <div className="glass-panel" style={{
            padding: '2.5rem 2.25rem',
            borderRadius: '24px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            boxShadow: 'var(--shadow-card)',
            transition: 'transform 0.2s'
          }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '14px',
              background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b',
              display: 'flex', alignItems: 'center', justifycontent: 'center'
            }}>
              <Users size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                Gestion des Niveaux & Classes
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.6 }}>
                Gérz facilement vos classes de Tronc Commun, 1ère Bac et 2ème Bac (Sciences Maths, PC, SVT). Associez chaque élève à son groupe pour un suivi statistique optimal de sa progression.
              </p>
            </div>
          </div>

          {/* Card 5: Import & Traitement IA */}
          <div className="glass-panel" style={{
            padding: '2.5rem 2.25rem',
            borderRadius: '24px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            boxShadow: 'var(--shadow-card)',
            transition: 'transform 0.2s'
          }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '14px',
              background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899',
              display: 'flex', alignItems: 'center', justifycontent: 'center'
            }}>
              <Sparkles size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                Importation Assistée par IA (QCM)
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.6 }}>
                Importez des énoncés bruts d&apos;examens ou de questions au format PDF. Notre IA (Gemini/DeepSeek) extrait, sépare les questions et convertit les formules mathématiques en syntaxe propre instantanément.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Free Platform Banner */}
      <section style={{
        maxWidth: '1200px',
        margin: '0 auto 6rem',
        padding: '0 1.25rem'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(16, 185, 129, 0.15) 100%)',
          border: '1px solid var(--border)',
          borderRadius: '24px',
          padding: '3rem 2rem',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
            Un outil 100% gratuit & indépendant
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', maxWidth: '650px', margin: '0 auto 2rem', lineHeight: 1.6 }}>
            Conçu pour soutenir le corps enseignant, GAMA ne nécessite aucun abonnement payant ni hébergement complexe. Toutes vos données sont hébergées et traitées localement en toute confidentialité.
          </p>
          <button 
            onClick={() => navigate('/register')}
            className="btn" 
            style={{ padding: '0.75rem 2rem', fontWeight: 800 }}
          >
            Créer mon compte enseignant
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '3rem 1.25rem',
        textAlign: 'center',
        color: 'var(--text-subtle)',
        fontSize: '0.85rem'
      }}>
        <p style={{ margin: 0 }}>
          GAMA © 2026 — Plateforme d&apos;aide à la gestion et d&apos;accompagnement pour l&apos;enseignant de mathématiques.
        </p>
      </footer>

      {/* Float WhatsApp */}
      <WhatsAppButton />
    </div>
  );
}
