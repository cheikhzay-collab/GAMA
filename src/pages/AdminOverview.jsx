import { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, BookOpen, FileText, FolderOpen, ClipboardList,
  Sparkles, ChevronRight, Calendar, Clock, Users, Plus, Camera,
  GraduationCap, ArrowRight, BookMarked, PenTool, Award, FileSpreadsheet,
  Download, Zap, CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAllClasses } from '../services/classService';
import { getAllLessons } from '../services/lessonService';
import { getLogbookEntries } from '../services/logbookService';
import { getAllUsers } from '../services/userService';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

const SYSTEM_LEVELS = [
  { id: 'common_core_sci', label: 'Tronc Commun Scientifique', short: 'TCS' },
  { id: 'common_core_arts', label: 'Tronc Commun Lettres', short: 'TCL' },
  { id: '1bac_sci', label: '1ère Bac Sciences', short: '1Bac Sci' },
  { id: '1bac_arts', label: '1ère Bac Lettres', short: '1Bac Let' },
  { id: '2bac_pc_svt', label: '2ème Bac PC / SVT', short: '2Bac PC' },
  { id: '2bac_sm', label: '2ème Bac Sciences Math', short: '2Bac SM' },
];

const LEVEL_COLORS = {
  'common_core_sci': '#3B82F6',
  'common_core_arts': '#8B5CF6',
  '1bac_sci': '#10B981',
  '1bac_arts': '#F59E0B',
  '2bac_pc_svt': '#EC4899',
  '2bac_sm': '#E2B874',
};

const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const getEntryTypeLabel = (type) => {
  switch (type) {
    case 'cours': return { label: 'Cours', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.1)' };
    case 'td': return { label: 'TD / Exercices', color: '#10B981', bg: 'rgba(16, 185, 129, 0.1)' };
    case 'devoir': return { label: 'Devoir', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)' };
    case 'controle': return { label: 'Contrôle', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)' };
    case 'activite': return { label: 'Activité', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.1)' };
    default: return { label: type || 'Séance', color: 'var(--text-muted)', bg: 'var(--bg-glass)' };
  }
};

export default function AdminOverview() {
  const { user, exams } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Local data states
  const [classes, setClasses] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [logbookEntries, setLogbookEntries] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch all data on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [cls, les, entries, usr] = await Promise.all([
          getAllClasses(),
          getAllLessons(),
          getLogbookEntries(),
          getAllUsers().catch(() => [])
        ]);
        setClasses(cls || []);
        setLessons(les || []);
        setLogbookEntries(entries || []);
        setUsers(usr || []);
      } catch (err) {
        console.warn('[AdminOverview] Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Derived stats
  const totalLessons = lessons.length;
  const totalExams = exams?.length || 0;
  const totalQuestions = useMemo(() => (exams || []).reduce((acc, e) => acc + (e.questions?.length || 0), 0), [exams]);
  const totalClasses = classes.length;
  const totalStudents = useMemo(() => {
    return classes.reduce((sum, cls) => sum + (cls.students?.length || 0), 0);
  }, [classes]);

  // Current month logbook entries
  const now = new Date();
  const currentMonthEntries = useMemo(() => {
    const month = now.getMonth();
    const year = now.getFullYear();
    return logbookEntries.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });
  }, [logbookEntries, now]);

  // Recent 5 logbook entries
  const recentEntries = useMemo(() => {
    return [...logbookEntries]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);
  }, [logbookEntries]);

  // Today's date formatted
  const todayStr = `${WEEKDAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  // Per-level breakdown
  const levelBreakdown = useMemo(() => {
    return SYSTEM_LEVELS.map(level => {
      const levelClasses = classes.filter(c => c.level === level.id);
      const levelLessons = lessons.filter(l => {
        const ll = l.level || l.content?.level;
        return ll === level.id;
      });
      const levelExams = (exams || []).filter(e => {
        return e.level === level.id;
      });
      return {
        ...level,
        classCount: levelClasses.length,
        lessonCount: levelLessons.length,
        examCount: levelExams.length,
        color: LEVEL_COLORS[level.id] || '#6B7280',
      };
    }).filter(l => l.classCount > 0 || l.lessonCount > 0 || l.examCount > 0);
  }, [classes, lessons, exams]);

  // Today's sessions count
  const todaySessions = useMemo(() => {
    const todayDate = now.toISOString().split('T')[0];
    return logbookEntries.filter(e => e.date === todayDate).length;
  }, [logbookEntries, now]);

  // Professeur name & schedule logic
  const profName = useMemo(() => localStorage.getItem('profName') || user?.name || 'Professeur', [user]);
  const todayDayName = WEEKDAYS[now.getDay()];

  const todayScheduleList = useMemo(() => {
    const dayIndex = now.getDay();
    if (dayIndex === 0) return []; // Dimanche (repos)

    try {
      const schedule = JSON.parse(localStorage.getItem('teacher_schedule_current') || '{}');
      const list = [];
      const slotLabels = {
        '08-09': '08:00 - 10:00',
        '09-10': '09:00 - 11:00',
        '10-11': '10:00 - 12:00',
        '11-12': '11:00 - 12:00',
        '14-15': '14:30 - 16:30',
        '15-16': '15:30 - 17:30',
        '16-17': '16:30 - 18:30',
        '17-18': '17:00 - 18:00'
      };

      Object.entries(schedule).forEach(([key, val]) => {
        if (key.startsWith(`${dayIndex}_`) && val) {
          const slotId = key.split('_')[1];
          const className = typeof val === 'string' ? val : (val.className || val.name);
          const room = val.room || val.salle || `Salle ${(dayIndex * 2) + 2}`;
          const subject = val.subject || 'Physique-Chimie';
          list.push({
            time: slotLabels[slotId] || '08:30 - 10:30',
            className,
            room,
            subject
          });
        }
      });

      if (list.length > 0) return list;
    } catch (e) {
      console.warn('Error reading schedule:', e);
    }

    if (classes.length > 0) {
      return classes.slice(0, 3).map((cls, idx) => {
        const times = ['08:30 - 10:30', '10:30 - 12:30', '14:30 - 16:30'];
        const rooms = ['Salle 4', 'Salle 12', 'Labo Physique'];
        return {
          time: times[idx % times.length],
          className: cls.name,
          room: rooms[idx % rooms.length],
          subject: 'Physique-Chimie'
        };
      });
    }

    return [];
  }, [classes, now]);

  return (
    <div className="animate-fade-in" style={{ direction: 'ltr', textAlign: 'left', position: 'relative', paddingBottom: '3rem' }}>
      
      {/* Background glow blobs */}
      <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: '350px', height: '350px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59, 130, 246, 0.06) 0%, transparent 70%)', filter: 'blur(70px)', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '15%', right: '-5%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16, 185, 129, 0.04) 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 0, pointerEvents: 'none' }} />
      
      <div style={{ position: 'relative', zIndex: 1 }}>
        
        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 1 — HERO HEADER & STRATEGIC TOOLBAR
        ══════════════════════════════════════════════════════════════════════ */}
        <header style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '0.5rem' }}>
                <div style={{ 
                  width: 52, height: 52, borderRadius: '16px', 
                  background: 'linear-gradient(135deg, var(--violet), var(--emerald))', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  boxShadow: '0 10px 25px rgba(124, 58, 237, 0.25)' 
                }}>
                  <GraduationCap size={28} color="#fff" />
                </div>
                <div>
                  <h1 style={{ fontSize: '1.95rem', fontWeight: 900, letterSpacing: '-0.03em', margin: 0, color: 'var(--text-main)', lineHeight: 1.2 }}>
                    Espace Professeur <span style={{ background: 'linear-gradient(135deg, var(--violet), var(--emerald))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>L'CONQ</span>
                  </h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '0.2rem 0 0', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                    <Calendar size={14} /> {todayStr}
                  </p>
                </div>
              </div>
            </div>

            {/* Strategic Quick Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button 
                className="btn"
                onClick={() => navigate('/scanner')}
                style={{ 
                  background: 'linear-gradient(135deg, var(--violet), var(--emerald))', 
                  border: 'none', 
                  fontWeight: 800, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.55rem',
                  padding: '0.7rem 1.35rem',
                  fontSize: '0.88rem',
                  borderRadius: '12px',
                  boxShadow: '0 8px 24px rgba(124, 58, 237, 0.25)',
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                <Camera size={18} /> Scanner OMR & Auto-Correction
              </button>
              
              <button 
                className="btn-outline"
                onClick={() => navigate('/admin/ai-generator')}
                style={{ 
                  fontWeight: 800, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.45rem',
                  padding: '0.7rem 1.1rem',
                  fontSize: '0.85rem',
                  borderRadius: '12px',
                  borderColor: 'var(--violet)',
                  color: 'var(--violet)',
                  background: 'rgba(124, 58, 237, 0.06)',
                  cursor: 'pointer'
                }}
              >
                <Sparkles size={16} /> Générateur IA
              </button>
            </div>
          </div>
        </header>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 2 — TEACHER WELCOME, TODAY'S SESSIONS & LOGBOOK SUGGESTION
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="bento-hero-card" style={{ padding: '1.75rem 2rem', marginBottom: '2.5rem' }}>
          {/* Welcome Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ position: 'relative' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '18px',
                  background: 'linear-gradient(135deg, #716DF2 0%, #10B981 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.4rem', fontWeight: 900, color: '#fff',
                  boxShadow: '0 10px 25px rgba(113, 109, 242, 0.35)'
                }}>
                  {profName[0]?.toUpperCase() || 'P'}
                </div>
                <div style={{ position: 'absolute', bottom: -2, right: -2 }}>
                  <span className="pulse-dot-active" title="Session Active" />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                    Bienvenue Prof. {profName} 👋
                  </h2>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '0.2rem 0.65rem', borderRadius: '20px', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    🟢 En Ligne
                  </span>
                </div>
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.88rem', color: 'var(--text-subtle)', fontWeight: 600 }} dir="rtl">
                  مرحباً بك في فضائك التعليمي. إليك حصص اليوم، القاعات المخصصة، واقتراح توثيق دفتر النصوص.
                </p>
              </div>
            </div>

            {/* Quick Fill Logbook CTA Button */}
            <button
              onClick={() => navigate('/admin/logbook')}
              className="btn"
              style={{
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                color: '#fff', border: 'none', fontWeight: 800,
                fontSize: '0.9rem', padding: '0.75rem 1.5rem', borderRadius: '14px',
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                boxShadow: '0 8px 25px rgba(16, 185, 129, 0.3)',
                cursor: 'pointer', transition: 'all 0.25s ease'
              }}
            >
              <ClipboardList size={20} /> Remplir le Cahier de Textes (ملء دفتر النصوص)
            </button>
          </div>

          {/* Today's Sessions - Pure Clean Minimal Text Ticker Bar */}
          <div className="news-ticker-container" style={{ marginTop: '1.25rem' }}>
            <div className="news-ticker-badge-text">
              <Clock size={14} style={{ color: 'var(--violet)' }} />
              <span>Programme du jour ({todayDayName}) :</span>
            </div>

            <div className="news-ticker-track-wrapper">
              <div className="news-ticker-track">
                {todayScheduleList.length === 0 ? (
                  <div
                    className="news-ticker-text-item"
                    onClick={() => navigate('/admin/settings')}
                  >
                    <span>Aucun cours aujourd'hui (Repos & Préparation)</span>
                    <span style={{ opacity: 0.5 }}>—</span>
                    <span style={{ color: 'var(--violet)', fontWeight: 700 }}>⚙️ Emploi du temps</span>
                  </div>
                ) : (
                  [...todayScheduleList, ...todayScheduleList, ...todayScheduleList].map((slot, idx) => (
                    <div
                      key={idx}
                      className="news-ticker-text-item"
                      onClick={() => navigate(`/admin/logbook?class=${encodeURIComponent(slot.className)}`)}
                      title="Cliquer pour remplir le Cahier de Textes de cette séance"
                    >
                      <span style={{ fontWeight: 800, color: 'var(--violet)' }}>{slot.time}</span>
                      <span>·</span>
                      <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>{slot.className}</span>
                      <span style={{ color: 'var(--text-subtle)', fontSize: '0.82rem' }}>({slot.room || 'Salle 4'})</span>
                      <span style={{ color: 'var(--text-subtle)' }}>—</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--violet)', opacity: 0.85 }}>✍️ Remplir le Cahier</span>
                      <span style={{ margin: '0 0.5rem', opacity: 0.35, color: 'var(--text-muted)' }}>•</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 2 — STRATEGIC KPI CARDS (4 CORE PILLARS)
        ══════════════════════════════════════════════════════════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
          
          {/* Card 1: Classes & Sections */}
          <div 
            className="glass-panel" 
            onClick={() => navigate('/admin/classes')}
            style={{ display: 'flex', padding: '1.5rem', gap: '1.25rem', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s ease' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(124, 58, 237, 0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
          >
            <div style={{ padding: '0.85rem', borderRadius: '14px', background: 'var(--violet-soft)', color: 'var(--violet)', display: 'flex' }}>
              <FolderOpen size={26} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Classes & Sections</div>
              <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '0.15rem' }}>{loading ? '—' : totalClasses}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--violet)', fontWeight: 800, marginTop: '0.15rem' }}>
                {totalStudents > 0 ? `${totalStudents} élèves inscrits` : 'Gestion des carnets OMR'}
              </div>
            </div>
          </div>

          {/* Card 2: QCM & Concours OMR */}
          <div 
            className="glass-panel" 
            onClick={() => navigate('/admin/exams')}
            style={{ display: 'flex', padding: '1.5rem', gap: '1.25rem', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s ease' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(16, 185, 129, 0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
          >
            <div style={{ padding: '0.85rem', borderRadius: '14px', background: 'var(--emerald-soft)', color: 'var(--emerald)', display: 'flex' }}>
              <Award size={26} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Concours & QCM</div>
              <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '0.15rem' }}>{totalExams}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--emerald)', fontWeight: 800, marginTop: '0.15rem' }}>
                {totalQuestions} questions numérisées
              </div>
            </div>
          </div>

          {/* Card 3: Fiches de Cours */}
          <div 
            className="glass-panel" 
            onClick={() => navigate('/admin/lessons')}
            style={{ display: 'flex', padding: '1.5rem', gap: '1.25rem', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s ease' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(59, 130, 246, 0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
          >
            <div style={{ padding: '0.85rem', borderRadius: '14px', background: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6', display: 'flex' }}>
              <BookOpen size={26} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fiches de Cours</div>
              <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '0.15rem' }}>{loading ? '—' : totalLessons}</div>
              <div style={{ fontSize: '0.72rem', color: '#3B82F6', fontWeight: 800, marginTop: '0.15rem' }}>
                Cours & Exercices imprimables
              </div>
            </div>
          </div>

          {/* Card 4: Cahier de Textes */}
          <div 
            className="glass-panel" 
            onClick={() => navigate('/admin/logbook')}
            style={{ display: 'flex', padding: '1.5rem', gap: '1.25rem', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s ease' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(245, 158, 11, 0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
          >
            <div style={{ padding: '0.85rem', borderRadius: '14px', background: 'var(--warning-soft)', color: 'var(--warning)', display: 'flex' }}>
              <ClipboardList size={26} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cahier de Textes</div>
              <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '0.15rem' }}>{loading ? '—' : currentMonthEntries.length}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--warning)', fontWeight: 800, marginTop: '0.15rem' }}>
                Séances en {MONTHS[now.getMonth()]}
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 3 — TWO COLUMNS: OMR & Class Center + Creation Hub
        ══════════════════════════════════════════════════════════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
          
          {/* ── LEFT: OMR & Carnet de Notes Center ── */}
          <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                  <Award size={22} color="var(--violet)" /> Mes Classes & Carnet des Concours
                </h3>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Accès direct aux résultats scannés et exportations Massar</p>
              </div>
              <button 
                onClick={() => navigate('/admin/classes')}
                className="btn-outline"
                style={{ fontSize: '0.78rem', fontWeight: 800, padding: '0.4rem 0.85rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.3rem', borderColor: 'var(--border)', color: 'var(--text-main)' }}
              >
                Gérer les classes <ArrowRight size={13} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Chargement des classes...
                </div>
              ) : classes.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', color: 'var(--text-subtle)', gap: '0.75rem' }}>
                  <FolderOpen size={36} style={{ opacity: 0.4 }} />
                  <span style={{ fontSize: '0.9rem', fontWeight: 800 }}>Aucune classe configurée</span>
                  <button 
                    onClick={() => navigate('/admin/classes')}
                    className="btn"
                    style={{ marginTop: '0.5rem', fontSize: '0.8rem', padding: '0.5rem 1rem', borderRadius: '8px', background: 'linear-gradient(135deg, var(--violet), var(--emerald))', color: '#fff', fontWeight: 800, border: 'none' }}
                  >
                    <Plus size={14} /> Créer ma première classe
                  </button>
                </div>
              ) : (
                classes.slice(0, 4).map((cls, idx) => {
                  const levelInfo = SYSTEM_LEVELS.find(l => l.id === cls.level);
                  const color = LEVEL_COLORS[cls.level] || 'var(--violet)';
                  const compCount = cls.competitions?.length || 0;

                  return (
                    <div 
                      key={cls.id || idx} 
                      style={{ 
                        padding: '1rem 1.15rem', 
                        background: 'var(--bg-card)', 
                        border: '1px solid var(--border)', 
                        borderRadius: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        transition: 'all 0.15s ease',
                        cursor: 'pointer'
                      }}
                      onClick={() => navigate(`/admin/classes/${cls.id}`)}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = color; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <div style={{ 
                          width: 40, height: 40, borderRadius: '10px', 
                          background: `${color}15`, color: color, 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.9rem' 
                        }}>
                          {cls.name ? cls.name.slice(0, 2).toUpperCase() : 'CL'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-main)' }}>{cls.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem' }}>
                            <span>{cls.students?.length || 0} élèves</span>
                            <span>·</span>
                            <span style={{ color, fontWeight: 700 }}>{levelInfo?.short || 'Secondaire'}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '0.2rem 0.6rem', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.12)', color: 'var(--emerald)' }}>
                          {compCount} Concours OMR
                        </span>
                        <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── RIGHT: Creation & Production Hub ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* AI Generator Hub Card */}
            <div className="glass-panel" style={{ 
              padding: '1.75rem',
              background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.06) 0%, rgba(16, 185, 129, 0.04) 100%)', 
              border: '1.5px solid rgba(124, 58, 237, 0.2)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '1rem' }}>
                  <Sparkles size={20} color="var(--violet)" />
                  <span style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--text-main)' }}>Studio de Création IA</span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* Generate QCM */}
                  <button 
                    onClick={() => navigate('/admin/ai-generator?type=exam')}
                    style={{
                      width: '100%',
                      padding: '0.85rem 1rem',
                      borderRadius: '12px',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      background: 'rgba(16, 185, 129, 0.1)',
                      color: 'var(--emerald)',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      transition: 'all 0.2s ease',
                      textAlign: 'left'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.18)'; e.currentTarget.style.transform = 'translateX(4px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'; e.currentTarget.style.transform = 'translateX(0)'; }}
                  >
                    <FileText size={18} />
                    <span style={{ flex: 1 }}>Générer un QCM / Examen</span>
                    <ChevronRight size={15} />
                  </button>

                  {/* Generate Lesson */}
                  <button 
                    onClick={() => navigate('/admin/ai-generator?type=lesson')}
                    style={{
                      width: '100%',
                      padding: '0.85rem 1rem',
                      borderRadius: '12px',
                      border: '1px solid rgba(124, 58, 237, 0.3)',
                      background: 'rgba(124, 58, 237, 0.1)',
                      color: 'var(--violet)',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      transition: 'all 0.2s ease',
                      textAlign: 'left'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124, 58, 237, 0.18)'; e.currentTarget.style.transform = 'translateX(4px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(124, 58, 237, 0.1)'; e.currentTarget.style.transform = 'translateX(0)'; }}
                  >
                    <BookOpen size={18} />
                    <span style={{ flex: 1 }}>Générer une Fiche de Cours</span>
                    <ChevronRight size={15} />
                  </button>

                  {/* Add Logbook Entry */}
                  <button 
                    onClick={() => navigate('/admin/logbook')}
                    style={{
                      width: '100%',
                      padding: '0.85rem 1rem',
                      borderRadius: '12px',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      background: 'rgba(245, 158, 11, 0.1)',
                      color: 'var(--warning)',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      transition: 'all 0.2s ease',
                      textAlign: 'left'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245, 158, 11, 0.18)'; e.currentTarget.style.transform = 'translateX(4px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)'; e.currentTarget.style.transform = 'translateX(0)'; }}
                  >
                    <Plus size={18} />
                    <span style={{ flex: 1 }}>Ajouter au Cahier de Textes</span>
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 4 — RECENT LOGBOOK SESSIONS & LEVEL OVERVIEW
        ══════════════════════════════════════════════════════════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
          
          {/* Recent Logbook Feed */}
          <div className="glass-panel" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ClipboardList size={20} color="#F59E0B" /> Cahier de Textes — Activités Récentes
                </h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Dernières séances enregistrées pour la classe</p>
              </div>
              <button 
                onClick={() => navigate('/admin/logbook')}
                className="btn-outline"
                style={{ fontSize: '0.78rem', fontWeight: 800, padding: '0.4rem 0.8rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.3rem', borderColor: 'var(--border)', color: 'var(--text-main)' }}
              >
                Voir tout <ArrowRight size={13} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {loading ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>Chargement du cahier...</div>
              ) : recentEntries.length === 0 ? (
                <div style={{ color: 'var(--text-subtle)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>
                  Aucune séance enregistrée récemment.
                </div>
              ) : (
                recentEntries.map((entry, idx) => {
                  const entryDate = new Date(entry.date);
                  const typeInfo = getEntryTypeLabel(entry.type);
                  const cls = classes.find(c => c.id === entry.classId);
                  
                  return (
                    <div 
                      key={entry.id || idx} 
                      style={{ 
                        padding: '0.85rem 1rem', 
                        background: 'var(--bg-card)', 
                        border: '1px solid var(--border)', 
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        transition: 'all 0.15s ease',
                        cursor: 'pointer'
                      }}
                      onClick={() => navigate('/admin/logbook')}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; }}
                    >
                      <div style={{ 
                        minWidth: '50px', 
                        textAlign: 'center', 
                        padding: '0.35rem 0.25rem',
                        borderRadius: '8px',
                        background: 'rgba(59, 130, 246, 0.08)',
                        border: '1px solid rgba(59, 130, 246, 0.15)'
                      }}>
                        <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-main)', lineHeight: 1 }}>{entryDate.getDate()}</div>
                        <div style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase', marginTop: '0.1rem' }}>
                          {entryDate.toLocaleDateString('fr-FR', { month: 'short' })}
                        </div>
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {entry.title || 'Sans titre'}
                          </span>
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.1rem 0.45rem', borderRadius: '6px', background: typeInfo.bg, color: typeInfo.color }}>
                            {typeInfo.label}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <FolderOpen size={11} /> {cls ? cls.name : 'Classe'}
                          {entry.startTime && (
                            <>
                              <span>·</span>
                              <Clock size={11} /> {entry.startTime} – {entry.endTime || '...'}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Level Overview Column */}
          {levelBreakdown.length > 0 && (
            <div className="glass-panel" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <GraduationCap size={20} color="var(--violet)" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-main)' }}>Vue par Niveau Scolaire</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {levelBreakdown.map((level) => {
                  return (
                    <div 
                      key={level.id} 
                      style={{ 
                        padding: '0.85rem 1rem', 
                        borderRadius: '12px',
                        background: 'var(--bg-card)', 
                        border: '1px solid var(--border)',
                        borderLeft: `4px solid ${level.color}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)' }}>{level.label}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          {level.classCount} classe{level.classCount > 1 ? 's' : ''} · {level.lessonCount} fiches · {level.examCount} QCM
                        </div>
                      </div>
                      <span style={{ fontSize: '0.7rem', fontWeight: 900, color: level.color, background: `${level.color}15`, padding: '0.2rem 0.55rem', borderRadius: '6px' }}>
                        {level.short}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
