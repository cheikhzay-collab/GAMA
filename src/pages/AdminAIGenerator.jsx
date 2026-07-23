import React, { useState, useEffect } from 'react';
import { useSearchParams, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Sparkles, BookOpen, FileText, ArrowLeft } from 'lucide-react';
import AdminAIImport from './AdminAIImport';
import AdminLessonsImport from './AdminLessonsImport';

export default function AdminAIGenerator() {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [generatorType, setGeneratorType] = useState(null);

  // Sync state with URL search param '?type=' or pathname
  useEffect(() => {
    const type = searchParams.get('type');
    if (type === 'exam' || type === 'lesson') {
      setGeneratorType(type);
    } else if (location.pathname === '/admin/ai-import') {
      setGeneratorType('exam');
    } else if (location.pathname === '/admin/ai-lessons') {
      setGeneratorType('lesson');
    } else {
      setGeneratorType(null);
    }
  }, [searchParams, location.pathname]);

  // Auth guard: strictly for admins
  if (!authLoading && user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSelect = (type) => {
    setGeneratorType(type);
    setSearchParams({ type });
  };

  const handleBack = () => {
    setGeneratorType(null);
    setSearchParams({});
  };

  // If a generator is selected, render it with onBack callback
  if (generatorType === 'exam') {
    return <AdminAIImport onBack={handleBack} />;
  }

  if (generatorType === 'lesson') {
    return <AdminLessonsImport onBack={handleBack} />;
  }

  // Otherwise, render the choice dashboard with high-end glassmorphic cards
  return (
    <div className="container animate-fade-in" style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
      
      {/* ── Page Header ── */}
      <header style={{ marginBottom: '3.5rem', textAlign: 'center' }}>
        <div style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '0.6rem', 
          marginBottom: '1.25rem', 
          padding: '0.5rem 1.25rem', 
          borderRadius: '30px', 
          background: 'rgba(124, 58, 237, 0.08)', 
          border: '1px solid rgba(124, 58, 237, 0.2)' 
        }}>
          <Sparkles size={18} style={{ color: 'var(--violet)' }} />
          <span style={{ color: 'var(--violet)', fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Suite de Génération IA
          </span>
        </div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: '0 0 0.75rem 0' }}>
          Que souhaitez-vous générer aujourd'hui ?
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', margin: 0, maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto', lineHeight: '1.5' }}>
          Sélectionnez le type de ressource pédagogique à générer. Importez vos documents et laissez nos modèles IA faire le travail.
        </p>
      </header>

      {/* ── Choice Cards Grid ── */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', 
        gap: '2.5rem', 
        marginTop: '1rem',
        perspective: '1000px'
      }}>
        
        {/* Card A: Fiches de Cours */}
        <div 
          onClick={() => handleSelect('lesson')}
          className="glass-panel"
          style={{ 
            padding: '3rem 2.5rem', 
            borderRadius: '24px', 
            cursor: 'pointer', 
            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
            background: 'var(--bg-card)'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
            e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.35)';
            e.currentTarget.style.boxShadow = '0 30px 60px rgba(124, 58, 237, 0.12), 0 0 0 1px rgba(124, 58, 237, 0.1)';
            const iconBg = e.currentTarget.querySelector('.icon-bg');
            if (iconBg) iconBg.style.transform = 'scale(1.1) rotate(-5deg)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.boxShadow = 'none';
            const iconBg = e.currentTarget.querySelector('.icon-bg');
            if (iconBg) iconBg.style.transform = 'none';
          }}
        >
          {/* Subtle Ambient Radial Glow */}
          <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '120%', height: '50%', background: 'radial-gradient(circle, rgba(124, 58, 237, 0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

          <div 
            className="icon-bg"
            style={{ 
              width: '84px', 
              height: '84px', 
              borderRadius: '22px', 
              background: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(139,92,246,0.05) 100%)', 
              border: '1px solid rgba(124, 58, 237, 0.25)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              marginBottom: '2.25rem',
              transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <BookOpen size={38} style={{ color: 'var(--violet)' }} />
          </div>

          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.8rem', letterSpacing: '-0.01em' }}>
            Fiche de Cours IA
          </h2>
          
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: '1.6', marginBottom: '2.5rem', flexGrow: 1 }}>
            Importez des résumés de cours au format PDF ou Image. L'IA extrait, structure et convertit le contenu en fiches interactives rédigées en LaTeX avec des exemples d'application et des solutions détaillées.
          </p>

          <button 
            className="btn" 
            style={{ 
              background: 'linear-gradient(135deg, var(--violet), #818cf8)', 
              width: '100%', 
              justifyContent: 'center', 
              padding: '0.85rem 1.5rem', 
              borderRadius: '14px', 
              fontWeight: 700,
              fontSize: '0.9rem',
              boxShadow: '0 8px 20px rgba(124, 58, 237, 0.2)',
              color: '#fff'
            }}
          >
            Commencer le cours
          </button>
        </div>

        {/* Card B: Examen / QCM */}
        <div 
          onClick={() => handleSelect('exam')}
          className="glass-panel"
          style={{ 
            padding: '3rem 2.5rem', 
            borderRadius: '24px', 
            cursor: 'pointer', 
            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
            background: 'var(--bg-card)'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
            e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.35)';
            e.currentTarget.style.boxShadow = '0 30px 60px rgba(16, 185, 129, 0.12), 0 0 0 1px rgba(16, 185, 129, 0.1)';
            const iconBg = e.currentTarget.querySelector('.icon-bg');
            if (iconBg) iconBg.style.transform = 'scale(1.1) rotate(5deg)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.boxShadow = 'none';
            const iconBg = e.currentTarget.querySelector('.icon-bg');
            if (iconBg) iconBg.style.transform = 'none';
          }}
        >
          {/* Subtle Ambient Radial Glow */}
          <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '120%', height: '50%', background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

          <div 
            className="icon-bg"
            style={{ 
              width: '84px', 
              height: '84px', 
              borderRadius: '22px', 
              background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(52,211,153,0.05) 100%)', 
              border: '1px solid rgba(16, 185, 129, 0.25)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              marginBottom: '2.25rem',
              transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <FileText size={38} style={{ color: 'var(--emerald)' }} />
          </div>

          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.8rem', letterSpacing: '-0.01em' }}>
            Examen & QCM IA
          </h2>
          
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: '1.6', marginBottom: '2.5rem', flexGrow: 1 }}>
            Importez des sujets de concours officiels ou des séries d'exercices. L'IA extrait toutes les questions QCM, les réponses, et formule des astuces de résolution d'inspecteur et des techniques d'élimination rapides.
          </p>

          <button 
            className="btn" 
            style={{ 
              background: 'linear-gradient(135deg, var(--emerald), #34d399)', 
              width: '100%', 
              justifyContent: 'center', 
              padding: '0.85rem 1.5rem', 
              borderRadius: '14px', 
              fontWeight: 700,
              fontSize: '0.9rem',
              boxShadow: '0 8px 20px rgba(16, 185, 129, 0.2)',
              color: '#fff'
            }}
          >
            Commencer l'examen
          </button>
        </div>

      </div>
    </div>
  );
}
