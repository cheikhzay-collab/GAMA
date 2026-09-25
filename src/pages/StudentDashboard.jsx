import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Trophy, Flame, Target, BrainCircuit,
  Zap, Clock, Camera,
  CheckCircle2, FileText, Sparkles, BookOpen, GraduationCap
} from 'lucide-react';

import StatCard from '../components/dashboard/StatCard';
import OnboardingModal from '../components/dashboard/OnboardingModal';
import WeeklyActivityChart from '../components/dashboard/WeeklyActivityChart';
import MockExamHistoryList from '../components/dashboard/MockExamHistoryList';
import DashboardSkeleton from '../components/dashboard/DashboardSkeleton';

export default function StudentDashboard() {
  const { 
    user, 
    exams, 
    getStudentStats, 
    mockExamHistory, 
    profName, 
    profPhone, 
    profSite, 
    updateProfile,
    trackDownload,
    loadExamQuestions,
    loading: authLoading,
    supabaseEnabled,
    schoolBranding
  } = useAuth();
  
  const navigate = useNavigate();
  const location = useLocation();
  
  const stats = useMemo(() => getStudentStats(), [getStudentStats]);
  const [toastMessage, setToastMessage] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !!(user && user.role === 'student' && (!user.phone || !user.city || !user.school));
  });

  // Auto-trigger onboarding if fields are empty
  useEffect(() => {
    const shouldShow = !!(user && user.role === 'student' && (!user.phone || !user.city || !user.school));
    if (shouldShow !== showOnboarding) {
      const timer = setTimeout(() => {
        setShowOnboarding(shouldShow);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [user, showOnboarding]);

  const handleOnboardingSubmit = useCallback(async ({ phone, city, school }) => {
    await updateProfile({ phone, city, school });
    setShowOnboarding(false);
  }, [updateProfile]);

  useEffect(() => {
    if (location.state?.partialSave) {
      const count = location.state.count || 0;
      const message = `Session enregistrée ! Votre progression sur les ${count} fiches révisées a été sauvegardée avec succès.`;
      
      const timer = setTimeout(() => {
        setToastMessage(message);
        navigate(location.pathname, { replace: true, state: {} });
      }, 0);
      
      const dismissTimer = setTimeout(() => {
        setToastMessage(null);
      }, 5000);
      
      return () => {
        clearTimeout(timer);
        clearTimeout(dismissTimer);
      };
    }
  }, [location, navigate]);

  // Generate pedagogical guidance text based on student progress
  const tip = useMemo(() => {
    if (stats.dueToday > 0) {
      return {
        title: "Session du jour recommandée",
        desc: `Vous avez ${stats.dueToday} fiches en attente de révision aujourd'hui. Une courte session de 10 minutes permettra de consolider votre mémoire à long terme.`,
        icon: Clock,
        color: 'var(--violet)'
      };
    } else if (stats.masteredCards > 0 && stats.weakTopics.length > 0) {
      const mainWeakness = stats.weakTopics[0].name;
      return {
        title: "Recommandation d'apprentissage",
        desc: `Toutes vos révisions sont à jour ! Nous vous conseillons de relire le cours sur "${mainWeakness}" pour renforcer vos lacunes identifiées.`,
        icon: Target,
        color: 'var(--warning)'
      };
    } else {
      return {
        title: "Excellent travail !",
        desc: "Toutes vos fiches sont parfaitement maîtrisées et à jour. Revenez demain pour la prochaine session automatique de l'algorithme.",
        icon: CheckCircle2,
        color: 'var(--emerald)'
      };
    }
  }, [stats.dueToday, stats.masteredCards, stats.weakTopics]);

  const handleGenerateWeaknessPDF = useCallback(async () => {
    const topicsToPrint = stats.weakTopics.map(t => t.name);
    if (topicsToPrint.length === 0) return;

    const activeExams = exams.filter(e => e.isActive !== false && e.isArchived !== true);
    const examsToLoad = activeExams.filter(e => !e.questions || e.questions.length === 0);
    if (examsToLoad.length > 0) {
      try {
        await Promise.all(examsToLoad.map(e => loadExamQuestions(e.id)));
      } catch (err) {
        console.error('Failed to load questions for weakness booklet:', err);
        return;
      }
    }

    const questionsToPrint = [];
    activeExams.forEach(exam => {
      (exam.questions || []).forEach(q => {
        const t = q.subject || q.topic || 'Général';
        if (topicsToPrint.includes(t)) {
          questionsToPrint.push({
            ...q,
            _source: exam.name,
            _year: exam.year
          });
        }
      });
    });

    if (questionsToPrint.length === 0) {
      alert("Aucune question n'a été trouvée pour vos points faibles.");
      return;
    }

    const s = {
      showCover: true,
      showTricks: true,
      showPageNumbers: true,
      startPage: 1,
      questionsPerPage: 3,
      profName: profName || '',
      profPhone: profPhone || '',
      profSite: profSite || 'www.lconq.ma'
    };
    
    const { generateEbookHTML, openPrintWindow } = await import('../utils/generateExamPDF');
    const title = "Fascicule de Révision Personnalisé";
    const html = generateEbookHTML(title, questionsToPrint, s);
    openPrintWindow(html, `cahier-revision-points-faibles`);
  }, [stats.weakTopics, exams, profName, profPhone, profSite, loadExamQuestions]);

  const handleDownloadReport = useCallback(async (item) => {
    // Open print preview window synchronously to bypass pop-up blockers on desktop
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768;
    const win = !isMobile ? window.open('', '_blank') : null;
    if (win) {
      win.document.write('<html><head><title>Génération du PDF...</title></head><body style="background:#09090b;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;margin:0;padding:20px;text-align:center;"><div><h3 style="margin:0 0 10px 0;">L\'CONQ</h3><p style="margin:0;color:#a1a1aa;font-size:0.9rem;">Génération de votre bulletin PDF en cours...</p></div></body></html>');
    }

    try {
      let exam = exams.find(e => e.id === item.examId);
      
      // Try to load exam from database if not in active in-memory list
      if (!exam && supabaseEnabled && item.examId) {
        try {
          const { getExamById } = await import('../services/examService');
          exam = await getExamById(item.examId);
        } catch (err) {
          console.warn('[StudentDashboard] Failed to fetch exam from database:', err);
        }
      }

      // Fallback to a mock exam object if deleted or inaccessible
      if (!exam) {
        exam = {
          id: item.examId || 'fallback',
          name: item.examName || "Examen Blanc",
          school: item.school || "—",
          year: item.date ? new Date(item.date).getFullYear().toString() : "—",
          questions: Array.from({ length: item.maxScore || 20 }, (_, i) => ({
            id: `q-${i + 1}`,
            question: `Question ${i + 1}`,
            correct_answer: '—',
            topic: 'Général'
          }))
        };
      }
      
      let questions = exam.questions;
      if (!questions || questions.length === 0) {
        try {
          questions = await loadExamQuestions(exam.id);
        } catch (err) {
          console.error('Failed to load questions for student report:', err);
          questions = Array.from({ length: item.maxScore || 20 }, (_, i) => ({
            id: `q-${i + 1}`,
            question: `Question ${i + 1}`,
            correct_answer: '—',
            topic: 'Général'
          }));
        }
      }
      
      const totalQuestions = questions.length;
      const indices = Array.from({ length: totalQuestions }, (_, i) => i);
      
      const seedStr = String(item.id || item.examId || 'fallback_seed');
      const seed = seedStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      let currentSeed = seed;
      const random = () => {
        const x = Math.sin(currentSeed++) * 10000;
        return x - Math.floor(x);
      };
      
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        const temp = indices[i];
        indices[i] = indices[j];
        indices[j] = temp;
      }
      
      const statusMap = {};
      let c = item.correctCount || 0;
      let w = item.wrongCount || 0;
      
      indices.forEach(idx => {
        if (c > 0) {
          statusMap[idx] = 'correct';
          c--;
        } else if (w > 0) {
          statusMap[idx] = 'wrong';
          w--;
        } else {
          statusMap[idx] = 'empty';
        }
      });
  
      const corrected = [];
      const LETTERS = ['A', 'B', 'C', 'D', 'E'];
      
      (questions || []).forEach((q, idx) => {
        const correct = q.correct_answer || q.answer || 'A';
        let detected = null;
        const result = statusMap[idx] || 'empty';
        
        if (result === 'correct') {
          detected = correct;
        } else if (result === 'wrong') {
          detected = LETTERS.find(l => l !== correct) || 'A';
        }
        
        corrected.push({
          q: idx + 1,
          question: q.question,
          correct,
          detected,
          result,
          topic: q.topic || 'Général'
        });
      });
      
      const brand = schoolBranding?.[exam.level] || { scoring: { correct: 1, wrong: -0.25, empty: 0 } };
      const rules = brand.scoring || { correct: 1, wrong: -0.25, empty: 0 };
const wrongPenalty = Math.abs(rules.wrong || 0.25);
  
      const scoreObj = {
        pts: item.score,
        neg: (item.wrongCount || 0) * wrongPenalty,
        max: item.maxScore,
        pct: item.pct
      };
      
      const settings = {
        profName: profName || '',
        profPhone: profPhone || '',
        profSite: profSite || 'www.lconq.ma'
      };
      
      const { generateStudentReportHTML, openPrintWindow } = await import('../utils/generateExamPDF');
      const html = generateStudentReportHTML({ ...exam, questions }, scoreObj, corrected, settings);
      localStorage.setItem('print_html', html);
      openPrintWindow(html, `bulletin-${exam.name.toLowerCase().replace(/\s+/g, '-')}`, win);
  
      if (trackDownload) {
        trackDownload({
          type: 'report',
          id: item.examId || 'unknown',
          title: `Bulletin : ${item.examName || 'Examen Blanc'}`
        });
      }
    } catch (err) {
      console.error('Failed to generate student report:', err);
      alert('Erreur de génération : ' + (err.stack || err.message || err));
      if (win) {
        try { win.close(); } catch { /* The print window may already be closed. */ }
      }
    }
  }, [exams, profName, profPhone, profSite, loadExamQuestions, trackDownload, schoolBranding, supabaseEnabled]);

  const onNavigateToLevels = useCallback(() => navigate('/levels'), [navigate]);
  const onNavigateToScanner = useCallback(() => navigate('/scanner'), [navigate]);

  if (authLoading && !user) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="animate-fade-in" style={{ position: 'relative' }}>
      
      {/* Background glow blobs */}
      <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: '350px', height: '350px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(113, 109, 242, 0.05) 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '15%', right: '-5%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16, 185, 129, 0.04) 0%, transparent 70%)', filter: 'blur(90px)', zIndex: 0, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        
        {/* ── HEADER ── */}
        <div className="student-dash-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
              <div style={{ width: 44, height: 44, borderRadius: '14px', background: 'linear-gradient(135deg, var(--violet), var(--emerald))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(113, 109, 242, 0.2)', flexShrink: 0 }}>
                <GraduationCap size={24} color="#fff" />
              </div>
              <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 850, letterSpacing: '-0.02em', margin: 0, color: 'var(--text-main)' }}>
                Bonjour, {user?.name}
              </h1>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', margin: 0 }}>
              Révisez vos cours de mathématiques et préparez vos prochains contrôles.
            </p>
          </div>
          
          {/* Quick Actions Header */}
          <div className="student-dash-actions" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button 
              className="btn student-dash-btn"
              onClick={() => navigate('/study')}
              style={{ 
                background: 'linear-gradient(135deg, var(--violet), #4f46e5)', 
                border: 'none', 
                fontWeight: 800, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.25rem',
                boxShadow: '0 8px 20px rgba(124, 58, 237, 0.25)',
                color: '#fff'
              }}
            >
              <BrainCircuit size={16} /> Révision Guidée
              {stats.dueToday > 0 && (
                <span style={{ 
                  background: 'var(--danger)', 
                  color: '#fff', 
                  borderRadius: '99px', 
                  padding: '0.1rem 0.5rem', 
                  fontSize: '0.7rem', 
                  fontWeight: 900,
                  marginLeft: '0.25rem',
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)'
                }}>
                  {stats.dueToday}
                </span>
              )}
            </button>

            <button 
              className="btn-outline student-dash-btn"
              onClick={onNavigateToScanner}
              style={{ 
                background: 'var(--bg-glass)', 
                border: '1px solid var(--border)', 
                fontWeight: 800, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.25rem',
                color: 'var(--text-main)'
              }}
            >
              <Camera size={16} /> Scanner une Copie
            </button>
          </div>
        </div>

        {/* ── INTERACTIVE LESSONS RECOMMENDATION HUB WIDGET ── */}
        <div className="glass-panel student-dash-banner" style={{ 
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(124, 58, 237, 0.03) 100%)', 
          border: '1.5px solid rgba(16, 185, 129, 0.2)', 
          borderRadius: '20px', 
          marginBottom: '2.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.25rem'
        }}>
          <div style={{ flex: '1 1 280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Sparkles size={16} style={{ color: 'var(--emerald)' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--emerald)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Fiches Interactives IA</span>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 850, color: '#fff', margin: '0 0 0.5rem 0', letterSpacing: '-0.01em' }}>
              Fiches de Cours de Mathématiques
            </h2>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.5', maxWidth: '650px' }}>
              Retrouvez les fiches de cours préparées par votre professeur : résumés, formules en LaTeX, exercices d'application corrigés et QCM interactifs pour chaque chapitre.
            </p>
          </div>

          <button 
            onClick={onNavigateToLevels}
            className="btn student-dash-banner-btn"
            style={{ 
              background: 'linear-gradient(135deg, var(--emerald), #34d399)', 
              color: '#fff',
              fontWeight: 800,
              fontSize: '0.82rem',
              padding: '0.75rem 1.35rem',
              borderRadius: '10px',
              boxShadow: '0 6px 15px rgba(16, 185, 129, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem'
            }}
          >
            <BookOpen size={15} /> Parcourir les fiches de cours
          </button>
        </div>

        {/* ── BENTO STATS GRID ── */}
        <div className="student-dash-stats" style={{ display: 'grid', gap: '1.25rem', marginBottom: '2.5rem' }}>
          <StatCard icon={Trophy} label="Classement National" value={`#${stats.rank} / ${stats.totalStudents}`} colorClass="violet" />
          <StatCard icon={Flame} label="Série de Jours (Streak)" value={`${stats.streak} jours`} colorClass="warning" />
          <StatCard icon={Zap} label="Expérience Accumulée" value={`${user?.xp ?? 0} XP`} colorClass="emerald" />
          <StatCard icon={Target} label="Maîtrise Globale" value={`${stats.globalMasteryPct}%`} colorClass="danger" />
        </div>

        {/* ── MAIN CONTENT GRID ── */}
        <div className="student-dash-grid" style={{ display: 'grid', gap: '1.75rem' }}>
          
          {/* Left Column: Mock Exam History */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <MockExamHistoryList 
              mockExamHistory={mockExamHistory} 
              exams={exams} 
              onDownloadReport={handleDownloadReport} 
              onNavigateToLevels={onNavigateToLevels} 
              onNavigateToScanner={onNavigateToScanner} 
            />
          </div>

          {/* Right Column: Sidebar Analytics & Advice */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Weekly Activity */}
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <WeeklyActivityChart data={stats.weeklyActivity} />
            </div>

            {/* Weak topics & PDF errors booklet generator */}
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontWeight: 800, margin: '0 0 1.25rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
                <Target size={18} color="var(--warning)" /> Analyse des Points Faibles
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                {stats.weakTopics.length === 0 ? (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>
                    Aucun point faible détecté. Continuez vos exercices et examens pour générer l'analyse.
                  </p>
                ) : (
                  stats.weakTopics.map(({ name, masteryPct }) => {
                    const color = masteryPct < 30 ? 'var(--danger)' : masteryPct < 65 ? 'var(--warning)' : 'var(--violet)';
                    return (
                      <div key={name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.83rem' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{name}</span>
                          <span style={{ color, fontWeight: 800 }}>{masteryPct}% maîtrisé</span>
                        </div>
                        <div className="progress-track" style={{ height: 6, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
                          <div className="progress-fill" style={{ width: `${masteryPct}%`, background: color, height: '100%', borderRadius: 99 }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              
              <button
                onClick={handleGenerateWeaknessPDF}
                disabled={stats.weakTopics.length === 0}
                style={{
                  width: '100%',
                  background: stats.weakTopics.length === 0 
                    ? 'var(--bg-glass)' 
                    : 'var(--violet-soft)',
                  border: stats.weakTopics.length === 0 ? '1px solid var(--border)' : '1px solid rgba(99, 102, 241, 0.25)',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.8rem 1.25rem',
                  borderRadius: '12px',
                  color: stats.weakTopics.length === 0 ? 'var(--text-subtle)' : 'var(--violet)',
                  cursor: stats.weakTopics.length === 0 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  fontSize: '0.82rem'
                }}
                onMouseEnter={e => { 
                  if (stats.weakTopics.length > 0) {
                    e.currentTarget.style.transform = 'translateY(-2px)'; 
                    e.currentTarget.style.background = 'var(--violet)';
                    e.currentTarget.style.color = '#fff';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.15)';
                  }
                }}
                onMouseLeave={e => { 
                  if (stats.weakTopics.length > 0) {
                    e.currentTarget.style.transform = 'translateY(0)'; 
                    e.currentTarget.style.background = stats.weakTopics.length === 0 
                      ? 'var(--bg-glass)' 
                      : 'var(--violet-soft)';
                    e.currentTarget.style.color = 'var(--violet)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                <FileText size={15} /> Générer mon Cahier d'Erreurs PDF
              </button>
            </div>

            {/* Dynamic Pedagogical Advice Box */}
            <div 
              className="glass-panel" 
              onClick={() => {
                if (stats.dueToday > 0) navigate('/study');
              }}
              style={{ 
                background: 'var(--violet-soft)', 
                border: '1px solid rgba(99,102,241,0.2)',
                cursor: stats.dueToday > 0 ? 'pointer' : 'default',
                transform: 'translateY(0)',
                transition: 'all 0.2s ease',
                padding: '1.25rem'
              }}
              onMouseEnter={e => {
                if (stats.dueToday > 0) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.15)';
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <tip.icon size={20} color={tip.color} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--text-main)' }}>
                    {tip.title}
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.55, marginBottom: stats.dueToday > 0 ? '0.75rem' : 0 }}>
                    {tip.desc}
                  </p>
                  {stats.dueToday > 0 && (
                    <span style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '0.35rem', 
                      fontSize: '0.75rem', 
                      fontWeight: 800, 
                      color: 'var(--violet)',
                      textDecoration: 'underline'
                    }}>
                      Lancer la révision globale →
                    </span>
                  )}
                </div>
              </div>
            </div>
            
          </div>
        </div>
      </div>

      {/* ── Toast Notification ── */}
      {toastMessage && (
        <div className="dashboard-toast" style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          zIndex: 9999,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: 'var(--radius-xl)',
          padding: '1rem 1.5rem',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3), 0 0 20px rgba(16, 185, 129, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          maxWidth: '420px',
          color: 'var(--text-main)',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--emerald)',
            flexShrink: 0
          }}>
            <CheckCircle2 size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, lineHeight: 1.4 }}>
              {toastMessage}
            </p>
          </div>
          <button 
            onClick={() => setToastMessage(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-subtle)',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 800,
              padding: '0.2rem',
              marginLeft: '0.5rem'
            }}
          >
            Fermer
          </button>
        </div>
      )}

      {/* ── Onboarding Modal ── */}
      {showOnboarding && (
        <OnboardingModal 
          initialPhone={user?.phone || ''} 
          initialCity={user?.city || ''} 
          initialSchool={user?.school || ''}
          onSubmit={handleOnboardingSubmit} 
        />
      )}
    </div>
  );
}
