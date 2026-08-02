import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FolderOpen, BookOpen, ClipboardList, Camera, Sparkles,
  ChevronRight, Calendar, Clock, Award, TrendingUp, Plus,
  FileText, ArrowLeft, Layers, Users, GraduationCap,
  Activity, BarChart3, ArrowUpRight, Zap, Target, BookMarked
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAllClasses } from '../services/classService';
import { getAllLessons } from '../services/lessonService';
import { getLogbookEntries } from '../services/logbookService';
import { getAllUsers } from '../services/userService';

// ─── HOOKS ─────────────────────────────────────────────────────────────────────

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 900);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

/**
 * Animated counter hook
 */
function useCountUp(target, duration = 1000) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const startTime = useRef(null);

  useEffect(() => {
    if (target <= 0) { setCount(0); return; }
    const ease = (t) => 1 - Math.pow(1 - t, 4);

    const animate = (timestamp) => {
      if (!startTime.current) startTime.current = timestamp;
      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      setCount(Math.round(ease(progress) * target));

      if (progress < 1) {
        ref.current = requestAnimationFrame(animate);
      }
    };

    startTime.current = null;
    ref.current = requestAnimationFrame(animate);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [target, duration]);

  return count;
}

// ─── CONSTANTS ─────────────────────────────────────────────────────────────────

const SYSTEM_LEVELS = [
  { id: 'common_core_sci', label: 'Tronc Commun Scientifique', short: 'TCS' },
  { id: 'common_core_arts', label: 'Tronc Commun Lettres', short: 'TCL' },
  { id: '1bac_sci', label: '1ère Bac Sciences', short: '1Bac Sci' },
  { id: '1bac_arts', label: '1ère Bac Lettres', short: '1Bac Let' },
  { id: '2bac_pc_svt', label: '2ème Bac PC / SVT', short: '2Bac PC' },
  { id: '2bac_sm', label: '2ème Bac Sciences Math', short: '2Bac SM' },
];

const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const getEntryTypeLabel = (type) => {
  switch (type) {
    case 'cours': return { label: 'Cours', color: '#10B981' };
    case 'td': return { label: 'TD / Exercices', color: '#3B82F6' };
    case 'devoir': return { label: 'Devoir', color: '#EF4444' };
    case 'controle': return { label: 'Contrôle', color: '#F59E0B' };
    default: return { label: type || 'Séance', color: '#6B7280' };
  }
};

const LEVEL_COLORS = ['#716DF2', '#10B981', '#F59E0B', '#3B82F6', '#EC4899', '#06B6D4'];

// ─── STAT CARD (uses useCountUp inside) ────────────────────────────────────────

function StatCard({ label, value, sub, Icon, accentColor, accentBg, glowColor, onClick, loading, delay = 0 }) {
  const animatedValue = useCountUp(loading ? 0 : value, 1000);
  return (
    <div
      className="dash-stat"
      onClick={onClick}
      style={{
        '--stat-color': accentColor,
        '--stat-glow': glowColor,
        animationDelay: `${delay}s`,
      }}
    >
      <div className="dash-stat__icon" style={{ background: accentBg, color: accentColor }}>
        <Icon size={22} />
      </div>
      <div className="dash-stat__label">{label}</div>
      <div className="dash-stat__value">
        {loading ? '—' : animatedValue}
      </div>
      <div className="dash-stat__sub">
        <TrendingUp size={12} />
        <span>{sub}</span>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────

export default function AdminOverview() {
  const { user, exams } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Local data states
  const [classes, setClasses] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [logbookEntries, setLogbookEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch all data on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [cls, les, entries] = await Promise.all([
          getAllClasses(),
          getAllLessons(),
          getLogbookEntries(),
          getAllUsers().catch(() => [])
        ]);
        setClasses(cls || []);
        setLessons(les || []);
        setLogbookEntries(entries || []);
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

  // Recent 4 logbook entries (balanced column height)
  const recentEntries = useMemo(() => {
    return [...logbookEntries]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 4);
  }, [logbookEntries]);

  // Today's date formatted in French
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
      };
    }).filter(l => l.classCount > 0 || l.lessonCount > 0 || l.examCount > 0);
  }, [classes, lessons, exams]);

  const profName = useMemo(() => localStorage.getItem('profName') || user?.name || 'Professeur', [user]);
  const profSchool = useMemo(() => localStorage.getItem('profSchool') || '', []);
  const profDirection = useMemo(() => localStorage.getItem('profDirection') || '', []);

  // Today's entries for News Ticker
  const todayEntries = useMemo(() => {
    const todayYMD = new Date().toISOString().split('T')[0];
    return logbookEntries.filter(e => {
      if (!e.date) return false;
      const dYMD = new Date(e.date).toISOString().split('T')[0];
      return dYMD === todayYMD;
    });
  }, [logbookEntries]);

  return (
    <div className="dash-2026">

      {/* Background Orbs */}
      <div className="dash-2026__orb dash-2026__orb--violet" />
      <div className="dash-2026__orb dash-2026__orb--emerald" />
      <div className="dash-2026__orb dash-2026__orb--cyan" />

      <div className="dash-2026__content">

        {/* ── HERO BANNER WITH INTEGRATED SESSIONS TICKER ── */}
        <div className="dash-hero" style={{ paddingBottom: '1.25rem' }}>
          <div className="dash-hero__row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="dash-hero__avatar">
                {profName[0]?.toUpperCase() || 'P'}
                <div className="dash-hero__avatar-dot" />
              </div>
              <div className="dash-hero__info">
                <h1>
                  Tableau de bord — <span>Prof. {profName}</span>
                </h1>
                <p className="dash-hero__subtitle">
                  <Calendar size={13} style={{ flexShrink: 0 }} />
                  <span>{todayStr}</span>
                  {profSchool && (
                    <>
                      <span style={{ margin: '0 0.3rem', opacity: 0.6 }}>•</span>
                      <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{profSchool}</span>
                    </>
                  )}
                  {profDirection && (
                    <>
                      <span style={{ margin: '0 0.3rem', opacity: 0.6 }}>•</span>
                      <span style={{ color: 'var(--text-subtle)', fontWeight: 600 }}>{profDirection}</span>
                    </>
                  )}
                  <span style={{ margin: '0 0.3rem', opacity: 0.6 }}>•</span>
                  <span className="dash-hero__badge">
                    <Activity size={11} />
                    L'CONQ
                  </span>
                </p>
              </div>
            </div>

            <div className="dash-hero__actions">
              <button className="dash-hero__btn-primary" onClick={() => navigate('/scanner')}>
                <Camera size={16} />
                <span>Scanner OMR</span>
              </button>
              <button className="dash-hero__btn-secondary" onClick={() => navigate('/admin/ai-generator')}>
                <Sparkles size={15} />
                <span>Générateur IA</span>
              </button>
              <button className="dash-hero__btn-secondary" onClick={() => navigate('/admin/logbook')}>
                <ClipboardList size={15} />
                <span>Cahier de textes</span>
              </button>
            </div>
          </div>

          {/* Integrated Séances du Jour Ticker inside Hero Header */}
          <div 
            className={`dash-ticker${todayEntries.length === 0 ? ' dash-ticker--empty' : ''}`}
            onClick={() => navigate('/admin/logbook')} 
            title="Cliquez pour ouvrir le cahier de textes"
            style={{ 
              marginTop: '1.25rem', 
              marginBottom: 0,
              background: 'rgba(0, 0, 0, 0.12)',
              backdropFilter: 'blur(16px)',
              borderColor: 'rgba(255, 255, 255, 0.1)',
            }}
          >
            <div className="dash-ticker__badge">
              <div className="dash-ticker__dot" />
              <span>Séances du jour</span>
            </div>
            <div className="dash-ticker__track">
              <div className="dash-ticker__content">
                {todayEntries.length === 0 ? (
                  <div className="dash-ticker__item">
                    <span>Aucune séance aujourd'hui</span>
                  </div>
                ) : (
                  [...todayEntries, ...todayEntries, ...todayEntries].map((entry, idx) => {
                    const cls = classes.find(c => c.id === entry.classId);
                    const typeLabel = getEntryTypeLabel(entry.type);
                    return (
                      <div key={idx} className="dash-ticker__item">
                        <span className="dash-ticker__item-tag" style={{ background: typeLabel.color + '25', color: typeLabel.color, border: `1px solid ${typeLabel.color}40`, fontWeight: 800 }}>
                          {cls?.name || 'Classe'} • {typeLabel.label}
                        </span>
                        <span style={{ fontWeight: 700 }}>{entry.title || 'Séance de cours'}</span>
                        {entry.time && <span style={{ opacity: 0.85, fontWeight: 600 }}>({entry.time})</span>}
                        <span className="dash-ticker__separator">•</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── KPI STAT CARDS ── */}
        <section className="dash-stats">
          <StatCard
            label="Classes & Sections"
            value={totalClasses}
            sub={totalStudents > 0 ? `${totalStudents} élèves inscrits` : 'Accéder aux carnets'}
            Icon={Users}
            accentColor="#10B981"
            accentBg="rgba(16, 185, 129, 0.12)"
            glowColor="rgba(16, 185, 129, 0.08)"
            onClick={() => navigate('/admin/classes')}
            loading={loading}
            delay={0.1}
          />
          <StatCard
            label="QCM & Concours"
            value={totalExams}
            sub={`${totalQuestions} questions crées`}
            Icon={GraduationCap}
            accentColor="#F59E0B"
            accentBg="rgba(245, 158, 11, 0.12)"
            glowColor="rgba(245, 158, 11, 0.08)"
            onClick={() => navigate('/admin/exams')}
            loading={loading}
            delay={0.2}
          />
          <StatCard
            label="Fiches de Cours"
            value={totalLessons}
            sub="Ressources pédagogiques"
            Icon={FileText}
            accentColor="#3B82F6"
            accentBg="rgba(59, 130, 246, 0.12)"
            glowColor="rgba(59, 130, 246, 0.08)"
            onClick={() => navigate('/admin/lessons')}
            loading={loading}
            delay={0.3}
          />
          <StatCard
            label="Cahier de Textes"
            value={currentMonthEntries.length}
            sub={`Séances en ${MONTHS[now.getMonth()]}`}
            Icon={ClipboardList}
            accentColor="#716DF2"
            accentBg="rgba(113, 109, 242, 0.12)"
            glowColor="rgba(113, 109, 242, 0.08)"
            onClick={() => navigate('/admin/logbook')}
            loading={loading}
            delay={0.4}
          />
        </section>

        {/* ── ROW 2: Classes + Studio IA ── */}
        <div className="dash-bento">

          {/* Classes Panel */}
          <div className="dash-card dash-card--delay-1">
            <div className="dash-card__header">
              <div>
                <h3 className="dash-card__title">
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Users size={18} style={{ color: 'var(--emerald)' }} />
                  </div>
                  Classes & Carnets de Notes
                </h3>
                <p className="dash-card__subtitle">Suivi des élèves, résultats des tests et export Massar</p>
              </div>
              <button className="dash-card__action" onClick={() => navigate('/admin/classes')}>
                <span>Gérer</span>
                <ChevronRight size={12} />
              </button>
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {[1,2,3].map(i => <div key={i} className="dash-skeleton" style={{ height: '52px' }} />)}
              </div>
            ) : classes.length === 0 ? (
              <div className="dash-empty">
                <div className="dash-empty__icon"><FolderOpen size={40} /></div>
                <p className="dash-empty__text">Aucune classe configurée</p>
                <button className="dash-empty__btn" onClick={() => navigate('/admin/classes')}>
                  <Plus size={14} />
                  <span>Ajouter une classe</span>
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {classes.slice(0, 5).map((cls, i) => {
                  const lv = SYSTEM_LEVELS.find(l => l.id === cls.level);
                  const avatarColor = LEVEL_COLORS[i % LEVEL_COLORS.length];
                  return (
                    <div
                      key={cls.id || i}
                      className="dash-class-item"
                      onClick={() => navigate(`/admin/classes/${cls.id}`)}
                      style={{ animationDelay: `${0.1 + i * 0.08}s` }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <div
                          className="dash-class-item__avatar"
                          style={{
                            background: `${avatarColor}20`,
                            color: avatarColor,
                            border: `1.5px solid ${avatarColor}40`,
                          }}
                        >
                          {cls.name?.[0]?.toUpperCase() || '—'}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.15rem' }}>
                            {cls.name}
                          </div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-subtle)' }}>
                            {cls.students?.length || 0} élèves • {lv?.label || 'Secondaire'}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          color: 'var(--emerald)',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '8px',
                          background: 'var(--emerald-soft)',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                          boxShadow: '0 1px 4px rgba(16, 185, 129, 0.1)',
                        }}>
                          {cls.competitions?.length || 0} QCMs
                        </span>
                        <ChevronRight size={14} style={{ color: 'var(--text-subtle)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Studio IA Panel */}
          <div className="dash-card dash-ai-card dash-card--delay-2">
            <div className="dash-card__header">
              <div>
                <h3 className="dash-card__title">
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(113, 109, 242, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sparkles size={18} style={{ color: 'var(--violet)' }} />
                  </div>
                  Studio de Création IA
                </h3>
                <p className="dash-card__subtitle">Production intelligente de ressources pédagogiques</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                className="dash-ai-btn dash-ai-btn--warning"
                onClick={() => navigate('/admin/ai-generator?type=exam')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <GraduationCap size={20} />
                  <span>Générer un QCM / Examen</span>
                </div>
                <ArrowUpRight size={15} style={{ opacity: 0.7 }} />
              </button>

              <button
                className="dash-ai-btn dash-ai-btn--emerald"
                onClick={() => navigate('/admin/ai-generator?type=lesson')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <FileText size={20} />
                  <span>Générer une Fiche de Cours</span>
                </div>
                <ArrowUpRight size={15} style={{ opacity: 0.7 }} />
              </button>

              <button
                className="dash-ai-btn dash-ai-btn--violet"
                onClick={() => navigate('/admin/logbook')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <ClipboardList size={20} />
                  <span>Ajouter une séance au cahier</span>
                </div>
                <ArrowUpRight size={15} style={{ opacity: 0.7 }} />
              </button>
            </div>
          </div>
        </div>

        {/* ── ROW 3: Logbook + Level Breakdown & Bilan Insights ── */}
        <div className="dash-bento">

          {/* Logbook Panel (Left Column) */}
          <div className="dash-card dash-card--delay-3">
            <div className="dash-card__header">
              <div>
                <h3 className="dash-card__title">
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(113, 109, 242, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ClipboardList size={18} style={{ color: 'var(--violet)' }} />
                  </div>
                  Cahier de Textes — Séances récentes
                </h3>
                <p className="dash-card__subtitle">Historique des séances de cours et devoirs planifiés</p>
              </div>
              <button className="dash-card__action" onClick={() => navigate('/admin/logbook')}>
                <span>Voir tout</span>
                <ChevronRight size={12} />
              </button>
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {[1,2,3,4].map(i => <div key={i} className="dash-skeleton" style={{ height: '52px' }} />)}
              </div>
            ) : recentEntries.length === 0 ? (
              <div className="dash-empty">
                <div className="dash-empty__icon"><BookOpen size={40} /></div>
                <p className="dash-empty__text">Aucune séance enregistrée</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {recentEntries.map((e, i) => {
                  const d = new Date(e.date);
                  const cls = classes.find(c => c.id === e.classId);
                  const typeLabel = getEntryTypeLabel(e.type);
                  return (
                    <div
                      key={e.id || i}
                      className="dash-feed-item"
                      onClick={() => navigate('/admin/logbook')}
                      style={{ animationDelay: `${0.08 + i * 0.08}s` }}
                    >
                      {/* Date badge */}
                      <div className="dash-feed-item__date">
                        <div className="dash-feed-item__day">{d.getDate()}</div>
                        <div className="dash-feed-item__month">{MONTHS[d.getMonth()]?.slice(0, 3)}</div>
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
                          <span style={{
                            fontSize: '0.9rem',
                            fontWeight: 800,
                            color: 'var(--text-main)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {e.title || 'Séance'}
                          </span>
                          <span
                            className="dash-feed-item__type-badge"
                            style={{
                              background: typeLabel.color + '20',
                              color: typeLabel.color,
                              border: `1px solid ${typeLabel.color}35`,
                              fontWeight: 800,
                            }}
                          >
                            {typeLabel.label}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-subtle)' }}>
                          {cls?.name || 'Classe'} • {d.getDate()} {MONTHS[d.getMonth()]}
                        </div>
                      </div>

                      <ChevronRight size={15} style={{ color: 'var(--text-subtle)', flexShrink: 0 }} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column Container: Level Breakdown + Bilan Widget */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Level Breakdown Panel */}
            <div className="dash-card dash-card--delay-4">
              <div className="dash-card__header">
                <div>
                  <h3 className="dash-card__title">
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <BarChart3 size={18} style={{ color: 'var(--emerald)' }} />
                    </div>
                    Répartition par Niveau
                  </h3>
                  <p className="dash-card__subtitle">Vue synthétique de l'architecture des cours</p>
                </div>
              </div>

              {levelBreakdown.length === 0 ? (
                <div className="dash-empty">
                  <div className="dash-empty__icon"><Layers size={40} /></div>
                  <p className="dash-empty__text">Aucune répartition disponible</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {levelBreakdown.map((lv, i) => (
                    <div
                      key={lv.id || i}
                      className="dash-level-item"
                      style={{
                        '--level-color': LEVEL_COLORS[i % LEVEL_COLORS.length],
                        animationDelay: `${0.1 + i * 0.1}s`,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.15rem' }}>
                          {lv.label}
                        </div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-subtle)' }}>
                          {lv.classCount} classes • {lv.lessonCount} fiches • {lv.examCount} QCMs
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        color: LEVEL_COLORS[i % LEVEL_COLORS.length],
                        padding: '0.22rem 0.65rem',
                        borderRadius: '8px',
                        background: LEVEL_COLORS[i % LEVEL_COLORS.length] + '18',
                        border: `1.5px solid ${LEVEL_COLORS[i % LEVEL_COLORS.length]}35`,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                        cursor: 'pointer',
                      }}>
                        {lv.short}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bilan & Indicateurs Clés Panel (Fills empty bottom-right space) */}
            <div className="dash-card dash-card--delay-5" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(113, 109, 242, 0.05) 100%)' }}>
              <div className="dash-card__header" style={{ marginBottom: '0.85rem' }}>
                <div>
                  <h3 className="dash-card__title">
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Target size={18} style={{ color: '#3B82F6' }} />
                    </div>
                    Bilan & Activité
                  </h3>
                  <p className="dash-card__subtitle">Indicateurs de préparation et ressources</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div style={{
                  padding: '0.75rem 0.85rem',
                  borderRadius: '12px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase' }}>Classes</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--emerald)', marginTop: '0.1rem' }}>{totalClasses}</div>
                </div>
                <div style={{
                  padding: '0.75rem 0.85rem',
                  borderRadius: '12px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase' }}>Ressources</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--violet)', marginTop: '0.1rem' }}>{totalLessons + totalExams}</div>
                </div>
              </div>

              <button
                className="dash-card__action"
                style={{ width: '100%', justifyContent: 'center', padding: '0.6rem 1rem', background: 'rgba(113, 109, 242, 0.08)', borderColor: 'rgba(113, 109, 242, 0.25)', color: 'var(--violet)' }}
                onClick={() => navigate('/admin/classes')}
              >
                <Zap size={14} />
                <span>Exporter le carnet Massar</span>
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
