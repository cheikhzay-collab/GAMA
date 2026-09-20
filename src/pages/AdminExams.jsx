import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Library,
  Eye,
  EyeOff,
  Edit,
  X,
  FileText,
  CheckCircle2,
  Download,
  Search,
  BookOpen,
  Trash2,
  Archive,
  MoreVertical,
  Calendar,
  Layers,
  Sparkles,
  RotateCcw,
  GraduationCap,
  Plus,
  ChevronDown,
  FileCheck
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { generateSubjectHTML, generateCorrectionHTML, generateEbookHTML, openPrintWindow } from '../utils/generateExamPDF';
import { generateAnswerSheet } from '../utils/generateAnswerSheet';
import { getLevelDisplayName, mapLegacySchoolToLevel } from '../utils/levelHelpers';

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

// Helper to get formatted level badge metadata
function getLevelBadgeInfo(levelKey, rawSchool) {
  const normalized = levelKey || mapLegacySchoolToLevel(rawSchool);
  if (normalized === '2bac_pc_svt') {
    return {
      label: '2BAC PC / SVT',
      full: '2ème Bac Sciences Expérimentales (PC/SVT)',
      bg: 'rgba(16, 185, 129, 0.08)',
      color: '#059669',
      border: 'rgba(16, 185, 129, 0.25)',
      dot: '#10B981'
    };
  }
  if (normalized === '2bac_sm') {
    return {
      label: '2BAC SM',
      full: '2ème Bac Sciences Mathématiques (A/B)',
      bg: 'rgba(113, 109, 242, 0.08)',
      color: 'var(--violet)',
      border: 'rgba(113, 109, 242, 0.25)',
      dot: '#716DF2'
    };
  }
  if (normalized === 'common_core_sci') {
    return {
      label: 'Tronc Commun',
      full: 'Tronc Commun Scientifique',
      bg: 'rgba(14, 165, 233, 0.08)',
      color: '#0284c7',
      border: 'rgba(14, 165, 233, 0.25)',
      dot: '#0ea5e9'
    };
  }
  const display = getLevelDisplayName(rawSchool || levelKey) || 'Général';
  return {
    label: display.length > 20 ? `${display.slice(0, 18)}…` : display,
    full: display,
    bg: 'rgba(100, 116, 139, 0.08)',
    color: 'var(--text-muted)',
    border: 'var(--border)',
    dot: 'var(--text-subtle)'
  };
}

export default function AdminExams() {
  const { exams, toggleExamStatus, schools, deleteExam, toggleArchiveExam, loadExamQuestions, refreshExams, isRefreshingExams } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [showEbook, setShowEbook] = useState(false);
  const [loadingEbookData, setLoadingEbookData] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [archiveTab, setArchiveTab] = useState('active'); // 'active' | 'archived'
  const [deleteConfirmExam, setDeleteConfirmExam] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [openOmrMenuId, setOpenOmrMenuId] = useState(null);
  const [downloadingOmrId, setDownloadingOmrId] = useState(null);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState('');

  // Auto-refresh from Supabase on mount
  useEffect(() => {
    if (refreshExams) {
      refreshExams({ forceRefresh: true });
    }
  }, []);

  const handleManualSync = async () => {
    if (refreshExams) {
      const res = await refreshExams({ forceRefresh: true });
      setSyncSuccessMsg(`Base de données synchronisée (${res?.length || 0} QCM)`);
      setTimeout(() => setSyncSuccessMsg(''), 3500);
    }
  };

  // Close dropdown menu when clicking outside
  useEffect(() => {
    if (!openMenuId && !openOmrMenuId) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('.action-menu-container') && !e.target.closest('.omr-menu-container')) {
        setOpenMenuId(null);
        setOpenOmrMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId, openOmrMenuId]);

  const handleDownloadOMR = async (exam, withAnswers = false) => {
    const opKey = `${exam.id}-${withAnswers ? 'ans' : 'blank'}`;
    setDownloadingOmrId(opKey);
    try {
      let questions = exam.questions;
      if (!questions || questions.length === 0) {
        questions = await loadExamQuestions(exam.id);
      }
      const fullExam = { ...exam, questions: questions || [] };
      await generateAnswerSheet(fullExam, null, { withAnswers });
    } catch (err) {
      console.error('Failed to generate answer sheet:', err);
    } finally {
      setDownloadingOmrId(null);
    }
  };

  // Load questions for all active exams when opening the Ebook Modal
  useEffect(() => {
    if (showEbook) {
      const examsToLoad = exams.filter(e => !e.isArchived && (!e.questions || e.questions.length === 0));
      if (examsToLoad.length > 0) {
        setLoadingEbookData(true);
        Promise.all(examsToLoad.map(e => loadExamQuestions(e.id)))
          .catch(err => console.error('Failed to load exam questions for E-book:', err))
          .finally(() => setLoadingEbookData(false));
      }
    }
  }, [showEbook, exams, loadExamQuestions]);

  // All unique topics + question count across all exams
  const topicMap = useMemo(() => {
    const map = {};
    exams.filter(e => !e.isArchived).forEach(exam => {
      (exam.questions || []).forEach(q => {
        const t = q.subject || q.topic || 'Général';
        if (!map[t]) map[t] = [];
        map[t].push({ ...q, _source: exam.name, _year: exam.year });
      });
    });
    return map;
  }, [exams]);
  const topicList = Object.entries(topicMap).sort((a, b) => b[1].length - a[1].length);

  const handleGenerateEbook = () => {
    if (!selectedTopic || !topicMap[selectedTopic]?.length) return;
    const html = generateEbookHTML(selectedTopic, topicMap[selectedTopic]);
    openPrintWindow(html, `ebook-${selectedTopic}`);
    setShowEbook(false);
  };

  // ── Filters ──
  const [search, setSearch]         = useState('');
  const [filterSchool, setFilterSchool] = useState('');
  const [filterYear, setFilterYear]     = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTier, setFilterTier]     = useState('');

  // Unique years from exams
  const years = useMemo(() => [...new Set(exams.map(e => e.year).filter(Boolean))].sort().reverse(), [exams]);

  // Filtered list
  const filtered = useMemo(() => exams.filter(e => {
    if (archiveTab === 'active' && e.isArchived) return false;
    if (archiveTab === 'archived' && !e.isArchived) return false;
    if (search && !e.name?.toLowerCase().includes(search.toLowerCase())) return false;
    const itemLevel = e.level || mapLegacySchoolToLevel(e.school);
    if (filterSchool && itemLevel !== filterSchool) return false;
    if (filterYear && e.year !== filterYear) return false;
    if (filterStatus === 'active' && e.isActive === false) return false;
    if (filterStatus === 'inactive' && e.isActive !== false) return false;
    if (filterTier && e.tier !== filterTier) return false;
    return true;
  }), [exams, archiveTab, search, filterSchool, filterYear, filterStatus, filterTier]);

  const activeCount = useMemo(() => exams.filter(e => !e.isArchived).length, [exams]);
  const archivedCount = useMemo(() => exams.filter(e => e.isArchived).length, [exams]);
  const totalQuestions = useMemo(() => exams.filter(e => !e.isArchived).reduce((acc, e) => acc + (e.questionsCount || e.questions?.length || 0), 0), [exams]);
  const freeCount = useMemo(() => exams.filter(e => !e.isArchived && (e.tier === 'freemium' || !e.tier)).length, [exams]);
  const premiumCount = useMemo(() => exams.filter(e => !e.isArchived && e.tier === 'premium').length, [exams]);

  const hasFilters = Boolean(search || filterSchool || filterYear || filterStatus || filterTier);
  const clearFilters = () => {
    setSearch('');
    setFilterSchool('');
    setFilterYear('');
    setFilterStatus('');
    setFilterTier('');
  };

  // ── CSV Export ──
  const downloadCSV = async (exam) => {
    let questions = exam.questions;
    if (!questions || questions.length === 0) {
      try {
        questions = await loadExamQuestions(exam.id);
      } catch (err) {
        console.error('Failed to load questions for CSV export:', err);
        return;
      }
    }
    const esc = (v = '') => {
      const s = String(v).replace(/"/g, '""');
      return /[,"\n]/.test(s) ? `"${s}"` : s;
    };
    const rows = [
      ['Context', 'Topic', 'Question', 'Options', 'Réponse', 'Astuce', 'Trick'],
      ...(questions || []).map(q => [
        esc(q.context || ''),
        esc(q.subject || q.topic || 'Général'),
        esc(q.question || ''),
        esc((q.options || []).map((o, i) => `${['A','B','C','D','E'][i]}) ${typeof o === 'string' ? o.replace(/^[A-E]\)\s*/, '') : (o?.text || '')}`).join(', ')),
        esc(q.correct_answer || ''),
        esc(q.astuce || ''),
        esc(q.trick || '')
      ])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${exam.name || 'exam'}_${exam.year || ''}.csv`.replace(/\s+/g, '_');
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="animate-fade-in admin-exams-container" style={{ maxWidth: '1240px', margin: '0 auto', position: 'relative', paddingBottom: '3rem' }}>
      <style>{`
        .admin-exams-container {
          font-family: inherit;
        }
        .kpi-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 1.1rem 1.25rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          box-shadow: var(--shadow-card);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .kpi-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px -6px rgba(0,0,0,0.12);
        }
        .kpi-icon-box {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .filter-input-unified {
          height: 40px;
          padding: 0 0.85rem;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--bg-card);
          color: var(--text-main);
          font-size: 0.83rem;
          outline: none;
          transition: all 0.15s ease;
          width: 100%;
        }
        .filter-input-unified:focus {
          border-color: var(--violet);
          box-shadow: 0 0 0 3px var(--violet-soft);
        }
        .table-row-item {
          border-bottom: 1px solid var(--border);
          transition: background 0.15s ease;
        }
        .table-row-item:hover {
          background: rgba(113, 109, 242, 0.035);
        }
        .btn-action-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 0.38rem 0.65rem;
          border-radius: 8px;
          font-size: 0.76rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
          text-decoration: none;
          white-space: nowrap;
          border: 1px solid transparent;
        }
        .btn-action-sujet {
          background: rgba(30, 86, 219, 0.08);
          color: #1a56db;
          border-color: rgba(30, 86, 219, 0.22);
        }
        .btn-action-sujet:hover {
          background: rgba(30, 86, 219, 0.16);
          border-color: #1a56db;
          transform: translateY(-1px);
        }
        .btn-action-corrige {
          background: rgba(124, 58, 237, 0.08);
          color: #7c3aed;
          border-color: rgba(124, 58, 237, 0.22);
        }
        .btn-action-corrige:hover {
          background: rgba(124, 58, 237, 0.16);
          border-color: #7c3aed;
          transform: translateY(-1px);
        }
        .btn-action-omr {
          background: rgba(16, 185, 129, 0.08);
          color: var(--emerald);
          border-color: rgba(16, 185, 129, 0.22);
        }
        .btn-action-omr:hover, .btn-action-omr.active {
          background: rgba(16, 185, 129, 0.16);
          border-color: var(--emerald);
          transform: translateY(-1px);
        }
        .btn-action-edit {
          background: var(--bg-card);
          color: var(--text-main);
          border-color: var(--border);
        }
        .btn-action-edit:hover {
          background: var(--bg-hover);
          border-color: var(--text-subtle);
          transform: translateY(-1px);
        }
        .btn-action-more {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--bg-card);
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }
        .btn-action-more:hover, .btn-action-more.active {
          background: var(--bg-hover);
          color: var(--text-main);
          border-color: var(--violet);
        }
        .menu-item-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 0.55rem 0.75rem;
          border: none;
          background: transparent;
          color: var(--text-main);
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          border-radius: 7px;
          text-align: left;
          transition: background 0.12s ease;
        }
        .menu-item-btn:hover {
          background: var(--bg-hover);
        }
        .menu-item-btn.danger {
          color: var(--danger);
        }
        .menu-item-btn.danger:hover {
          background: rgba(239, 68, 68, 0.08);
        }
        .segmented-tab {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 0.5rem 1rem;
          border-radius: 9px;
          border: none;
          font-size: 0.82rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* ── Top Header ── */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '0.25rem' }}>
            <div style={{ width: 42, height: 42, borderRadius: '12px', background: 'linear-gradient(135deg, var(--violet), #4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px var(--violet-glow)' }}>
              <Library size={22} color="#fff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.025em', margin: 0, color: 'var(--text-main)' }}>
                  Bibliothèque QCM
                </h1>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0.2rem 0.65rem',
                  borderRadius: '999px',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  color: '#059669',
                  fontSize: '0.72rem',
                  fontWeight: 700
                }}>
                  <span style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: '#10B981',
                    boxShadow: '0 0 6px #10B981',
                    display: 'inline-block'
                  }} />
                  Base de données connectée ({exams?.length || 0} QCM)
                </span>
                {syncSuccessMsg && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                    background: 'rgba(113, 109, 242, 0.1)',
                    border: '1px solid rgba(113, 109, 242, 0.25)',
                    color: 'var(--violet)',
                    fontSize: '0.72rem',
                    fontWeight: 700
                  }}>
                    <CheckCircle2 size={12} /> {syncSuccessMsg}
                  </span>
                )}
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', margin: 0, marginTop: '4px' }}>
                Gestion centralisée des concours, annales, corrections et banques d'exercices
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', width: isMobile ? '100%' : 'auto', flexWrap: 'wrap' }}>
          <button
            onClick={handleManualSync}
            disabled={isRefreshingExams}
            title="Synchroniser immédiatement avec la base de données Supabase"
            style={{
              flex: isMobile ? 1 : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              padding: '0.65rem 1.05rem',
              borderRadius: 11,
              background: 'var(--bg-card)',
              color: 'var(--text-main)',
              border: '1px solid var(--border)',
              fontWeight: 700,
              fontSize: '0.86rem',
              cursor: isRefreshingExams ? 'wait' : 'pointer',
              boxShadow: 'var(--shadow-card)',
              transition: 'all 0.15s ease'
            }}
          >
            <RotateCcw
              size={15}
              style={{
                color: 'var(--violet)',
                animation: isRefreshingExams ? 'spin 1s linear infinite' : 'none'
              }}
            />
            <span>{isRefreshingExams ? 'Synchronisation...' : (isMobile ? 'Sync' : 'Actualiser DB')}</span>
          </button>

          <button
            onClick={() => setShowEbook(true)}
            style={{
              flex: isMobile ? 1 : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              padding: '0.65rem 1.15rem',
              borderRadius: 11,
              background: 'var(--bg-card)',
              color: 'var(--text-main)',
              border: '1px solid var(--border)',
              fontWeight: 700,
              fontSize: '0.86rem',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-card)',
              transition: 'all 0.15s ease'
            }}
          >
            <BookOpen size={16} style={{ color: 'var(--violet)' }} />
            <span>{isMobile ? 'E-Book' : 'Générer E-Book'}</span>
          </button>

          <Link
            to="/admin/upload"
            style={{
              flex: isMobile ? 1 : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              padding: '0.65rem 1.25rem',
              borderRadius: 11,
              background: 'var(--btn-primary-bg)',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.86rem',
              cursor: 'pointer',
              textDecoration: 'none',
              boxShadow: 'var(--btn-primary-shadow)',
              transition: 'all 0.15s ease'
            }}
          >
            <Plus size={16} strokeWidth={2.8} />
            <span>{isMobile ? 'Nouveau' : 'Nouveau Concours'}</span>
          </Link>
        </div>
      </header>

      {/* ── KPI Summary Cards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
        gap: '0.85rem',
        marginBottom: '1.5rem'
      }}>
        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ background: 'rgba(113, 109, 242, 0.12)', color: 'var(--violet)' }}>
            <Layers size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-subtle)' }}>
              Total des Épreuves
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-main)', lineHeight: 1.2 }}>
              {exams.length} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>concours</span>
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {activeCount} actifs · {archivedCount} archivés
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ background: 'rgba(16, 185, 129, 0.12)', color: 'var(--emerald)' }}>
            <Sparkles size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-subtle)' }}>
              Questions Indexées
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-main)', lineHeight: 1.2 }}>
              {totalQuestions} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>questions</span>
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Prêtes pour entraînement & examens blancs
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ background: 'rgba(245, 158, 11, 0.12)', color: 'var(--warning)' }}>
            <GraduationCap size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-subtle)' }}>
              Modèle d'Accès
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-main)', lineHeight: 1.2 }}>
              {freeCount} <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--emerald)' }}>Gratuits</span> · {premiumCount} <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--warning)' }}>VIP</span>
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Gestion des abonnements & autorisations
            </div>
          </div>
        </div>
      </div>

      {/* ── Segmented Tabs: Actifs vs Archivés ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{
          display: 'inline-flex',
          background: 'var(--bg-card)',
          padding: '4px',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <button
            onClick={() => setArchiveTab('active')}
            className="segmented-tab"
            style={{
              background: archiveTab === 'active' ? 'var(--violet)' : 'transparent',
              color: archiveTab === 'active' ? '#fff' : 'var(--text-muted)',
              boxShadow: archiveTab === 'active' ? '0 2px 8px var(--violet-glow)' : 'none'
            }}
          >
            <Library size={14} />
            <span>Concours Actifs</span>
            <span style={{
              background: archiveTab === 'active' ? 'rgba(255,255,255,0.22)' : 'rgba(100,116,139,0.12)',
              color: archiveTab === 'active' ? '#fff' : 'var(--text-muted)',
              fontSize: '0.7rem',
              padding: '1px 6px',
              borderRadius: '6px',
              fontWeight: 800
            }}>
              {activeCount}
            </span>
          </button>

          <button
            onClick={() => setArchiveTab('archived')}
            className="segmented-tab"
            style={{
              background: archiveTab === 'archived' ? 'var(--violet)' : 'transparent',
              color: archiveTab === 'archived' ? '#fff' : 'var(--text-muted)',
              boxShadow: archiveTab === 'archived' ? '0 2px 8px var(--violet-glow)' : 'none'
            }}
          >
            <Archive size={14} />
            <span>Concours Archivés</span>
            <span style={{
              background: archiveTab === 'archived' ? 'rgba(255,255,255,0.22)' : 'rgba(100,116,139,0.12)',
              color: archiveTab === 'archived' ? '#fff' : 'var(--text-muted)',
              fontSize: '0.7rem',
              padding: '1px 6px',
              borderRadius: '6px',
              fontWeight: 800
            }}>
              {archivedCount}
            </span>
          </button>
        </div>

        <div style={{ fontSize: '0.82rem', color: 'var(--text-subtle)', fontWeight: 600 }}>
          Affichage de <strong style={{ color: 'var(--text-main)' }}>{filtered.length}</strong> concours
          {hasFilters && ' (filtrés)'}
        </div>
      </div>

      {/* ── Filter Toolbar ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'minmax(220px, 1.35fr) repeat(4, minmax(130px, 1fr)) auto',
        gap: '0.65rem',
        alignItems: 'center',
        background: 'var(--bg-card)',
        padding: '0.85rem 1rem',
        borderRadius: '14px',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)',
        marginBottom: '1.25rem'
      }}>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Rechercher un concours..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="filter-input-unified"
            style={{ paddingLeft: '32px' }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', padding: 2 }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* School / Level filter */}
        <div>
          <select
            value={filterSchool}
            onChange={e => setFilterSchool(e.target.value)}
            className="filter-input-unified"
            style={{ cursor: 'pointer' }}
          >
            <option value="">🎓 Tous les niveaux</option>
            {schools.map(s => (
              <option key={s} value={s}>{getLevelDisplayName(s)}</option>
            ))}
          </select>
        </div>

        {/* Year filter */}
        <div>
          <select
            value={filterYear}
            onChange={e => setFilterYear(e.target.value)}
            className="filter-input-unified"
            style={{ cursor: 'pointer' }}
          >
            <option value="">📅 Toutes les années</option>
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="filter-input-unified"
            style={{ cursor: 'pointer' }}
          >
            <option value="">👁 Tous les statuts</option>
            <option value="active">Actifs uniquement</option>
            <option value="inactive">Désactivés</option>
          </select>
        </div>

        {/* Tier filter */}
        <div>
          <select
            value={filterTier}
            onChange={e => setFilterTier(e.target.value)}
            className="filter-input-unified"
            style={{ cursor: 'pointer' }}
          >
            <option value="">🔓 Tous abonnements</option>
            <option value="freemium">Gratuit</option>
            <option value="premium">Premium</option>
          </select>
        </div>

        {/* Reset button */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="btn-action-pill"
            style={{
              height: 40,
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.22)',
              color: 'var(--danger)',
              justifyContent: 'center'
            }}
          >
            <RotateCcw size={13} />
            <span>Réinitialiser</span>
          </button>
        )}
      </div>

      {/* ── Table Container ── */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '16px',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden'
      }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <Library size={28} style={{ opacity: 0.5, color: 'var(--violet)' }} />
            </div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
              {exams.length === 0
                ? 'La bibliothèque est encore vide'
                : archiveTab === 'archived'
                  ? 'Aucun concours archivé'
                  : 'Aucun concours ne correspond à vos filtres'}
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto 1.25rem' }}>
              {exams.length === 0
                ? 'Commencez par ajouter un concours ou importer des questions pour démarrer.'
                : 'Modifiez vos critères de recherche ou réinitialisez les filtres.'}
            </p>
            {hasFilters && (
              <button onClick={clearFilters} className="btn-action-pill btn-action-edit" style={{ padding: '0.5rem 1rem' }}>
                <RotateCcw size={14} /> Effacer les filtres
              </button>
            )}
          </div>
        ) : isMobile ? (
          /* Mobile cards list */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.85rem' }}>
            {filtered.map(exam => {
              const lvl = getLevelBadgeInfo(exam.level, exam.school);
              return (
                <div
                  key={exam.id}
                  style={{
                    background: 'var(--bg-base)',
                    borderRadius: '14px',
                    padding: '1rem',
                    border: '1px solid var(--border)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                    opacity: exam.isActive === false ? 0.75 : 1
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.65rem' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--text-main)', lineHeight: 1.35 }} dir="auto">
                      {exam.name}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flexShrink: 0 }}>
                      {exam.tier === 'premium' ? (
                        <span style={{ fontSize: '0.66rem', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 5, padding: '1px 6px', fontWeight: 800 }}>VIP</span>
                      ) : (
                        <span style={{ fontSize: '0.66rem', background: 'rgba(16, 185, 129, 0.08)', color: 'var(--emerald)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 5, padding: '1px 6px', fontWeight: 800 }}>Gratuit</span>
                      )}
                      {exam.isActive === false && (
                        <span style={{ fontSize: '0.66rem', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 5, padding: '1px 6px', fontWeight: 800 }}>Désactivé</span>
                      )}
                    </div>
                  </div>

                  {/* Metadata tags */}
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
                    <span style={{ background: lvl.bg, color: lvl.color, border: `1px solid ${lvl.border}`, borderRadius: 6, padding: '0.2rem 0.5rem', fontSize: '0.73rem', fontWeight: 700 }}>
                      {lvl.label}
                    </span>
                    {exam.year && (
                      <span style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.2rem 0.5rem', fontSize: '0.73rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        📅 {exam.year}
                      </span>
                    )}
                    <span style={{ background: 'rgba(124, 58, 237, 0.08)', color: '#7c3aed', border: '1px solid rgba(124, 58, 237, 0.2)', borderRadius: 6, padding: '0.2rem 0.5rem', fontSize: '0.73rem', fontWeight: 800 }}>
                      {exam.questionsCount || exam.questions?.length || 0} Q
                    </span>
                  </div>

                  {/* Actions buttons */}
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={async () => {
                        let questions = exam.questions;
                        if (!questions || questions.length === 0) {
                          try { questions = await loadExamQuestions(exam.id); } catch (err) { return; }
                        }
                        const html = await generateSubjectHTML(exam.name, exam.school, exam.year, questions || [], { examId: exam.id, schoolsList: schools });
                        openPrintWindow(html, 'sujet');
                      }}
                      className="btn-action-pill btn-action-sujet"
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      <FileText size={13} /> Sujet
                    </button>

                    <button
                      onClick={async () => {
                        let questions = exam.questions;
                        if (!questions || questions.length === 0) {
                          try { questions = await loadExamQuestions(exam.id); } catch (err) { return; }
                        }
                        openPrintWindow(generateCorrectionHTML(exam.name, exam.school, exam.year, questions || [], { schoolsList: schools }), 'corrigé');
                      }}
                      className="btn-action-pill btn-action-corrige"
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      <CheckCircle2 size={13} /> Corrigé
                    </button>

                    <button
                      onClick={() => navigate(`/admin/exams/${exam.id}/edit`)}
                      className="btn-action-pill btn-action-edit"
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      <Edit size={13} /> Éditer
                    </button>

                    <button
                      onClick={() => setDeleteConfirmExam(exam)}
                      style={{
                        padding: '0.4rem 0.6rem',
                        borderRadius: 8,
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        background: 'rgba(239, 68, 68, 0.08)',
                        color: 'var(--danger)',
                        cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* OMR Options Row in Mobile */}
                  <div style={{ display: 'flex', gap: '0.4rem', width: '100%', marginTop: '0.35rem' }}>
                    <button
                      onClick={() => handleDownloadOMR(exam, false)}
                      className="btn-action-pill btn-action-omr"
                      style={{ flex: 1, justifyContent: 'center', fontSize: '0.73rem' }}
                    >
                      <FileText size={12} /> OMR Vierge
                    </button>
                    <button
                      onClick={() => handleDownloadOMR(exam, true)}
                      className="btn-action-pill btn-action-omr"
                      style={{ flex: 1, justifyContent: 'center', fontSize: '0.73rem' }}
                    >
                      <CheckCircle2 size={12} /> OMR Corrigée (Clé)
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Desktop Clean Table */
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 920 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-hover)' }}>
                  <th style={{ padding: '0.85rem 1.15rem', fontWeight: 800, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-subtle)' }}>
                    Concours
                  </th>
                  <th style={{ padding: '0.85rem 1.15rem', fontWeight: 800, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-subtle)' }}>
                    Niveau & Branche
                  </th>
                  <th style={{ padding: '0.85rem 1.15rem', fontWeight: 800, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-subtle)', textAlign: 'center' }}>
                    Année
                  </th>
                  <th style={{ padding: '0.85rem 1.15rem', fontWeight: 800, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-subtle)', textAlign: 'center' }}>
                    Questions
                  </th>
                  <th style={{ padding: '0.85rem 1.15rem', fontWeight: 800, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-subtle)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(exam => {
                  const lvl = getLevelBadgeInfo(exam.level, exam.school);
                  const isMenuOpen = openMenuId === exam.id;

                  return (
                    <tr key={exam.id} className="table-row-item" style={{ opacity: exam.isActive === false ? 0.6 : 1 }}>
                      {/* Name & Badges */}
                      <td style={{ padding: '0.95rem 1.15rem', maxWidth: 300 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                          <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            background: 'linear-gradient(135deg, rgba(113, 109, 242, 0.1), rgba(16, 185, 129, 0.1))',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--violet)',
                            flexShrink: 0,
                            marginTop: 1
                          }}>
                            <FileText size={17} />
                          </div>

                          <div>
                            <Link
                              to={`/admin/exams/${exam.id}/edit`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: '0.89rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.35, textDecoration: 'none', transition: 'color 0.15s ease' }}
                              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--violet)'}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-main)'}
                              title="Modifier ce concours (Ouvrir dans une nouvelle page)"
                              dir="auto"
                            >
                              {exam.name}
                            </Link>
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                              {exam.tier === 'premium' ? (
                                <span style={{ fontSize: '0.66rem', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 5, padding: '1px 6px', fontWeight: 800 }}>
                                  ★ VIP
                                </span>
                              ) : (
                                <span style={{ fontSize: '0.66rem', background: 'rgba(16, 185, 129, 0.08)', color: 'var(--emerald)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 5, padding: '1px 6px', fontWeight: 800 }}>
                                  Gratuit
                                </span>
                              )}

                              {exam.isActive === false && (
                                <span style={{ fontSize: '0.66rem', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 5, padding: '1px 6px', fontWeight: 800 }}>
                                  Désactivé
                                </span>
                              )}

                              {exam.isArchived && (
                                <span style={{ fontSize: '0.66rem', color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 5, padding: '1px 6px', fontWeight: 800 }}>
                                  Archivé
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Level */}
                      <td style={{ padding: '0.95rem 1.15rem' }}>
                        <span
                          title={lvl.full}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            background: lvl.bg,
                            color: lvl.color,
                            border: `1px solid ${lvl.border}`,
                            borderRadius: '7px',
                            padding: '0.25rem 0.6rem',
                            fontSize: '0.76rem',
                            fontWeight: 700
                          }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: lvl.dot }} />
                          {lvl.label}
                        </span>
                      </td>

                      {/* Year */}
                      <td style={{ padding: '0.95rem 1.15rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {exam.year ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: 'var(--bg-hover)',
                            border: '1px solid var(--border)',
                            borderRadius: 6,
                            padding: '0.2rem 0.55rem',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            color: 'var(--text-main)'
                          }}>
                            <Calendar size={11} color="var(--text-subtle)" />
                            {exam.year}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-subtle)', fontSize: '0.85rem' }} title="Concours intemporel / non lié à une année">—</span>
                        )}
                      </td>

                      {/* Questions Count */}
                      <td style={{ padding: '0.95rem 1.15rem', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          background: 'rgba(113, 109, 242, 0.08)',
                          color: 'var(--violet)',
                          border: '1px solid rgba(113, 109, 242, 0.2)',
                          borderRadius: 6,
                          padding: '0.2rem 0.55rem',
                          fontSize: '0.78rem',
                          fontWeight: 800
                        }}>
                          {exam.questionsCount || exam.questions?.length || 0} Q
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '0.95rem 1.15rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '0.45rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                          {/* Sujet */}
                          <button
                            onClick={async () => {
                              let questions = exam.questions;
                              if (!questions || questions.length === 0) {
                                try {
                                  questions = await loadExamQuestions(exam.id);
                                } catch (err) {
                                  console.error('Failed to load questions for PDF:', err);
                                  return;
                                }
                              }
                              const html = await generateSubjectHTML(exam.name, exam.school, exam.year, questions || [], { examId: exam.id, schoolsList: schools });
                              openPrintWindow(html, 'sujet');
                            }}
                            title="Imprimer ou prévisualiser le Sujet Blanc PDF"
                            className="btn-action-pill btn-action-sujet"
                          >
                            <FileText size={13} />
                            <span>Sujet</span>
                          </button>

                          {/* Corrigé */}
                          <button
                            onClick={async () => {
                              let questions = exam.questions;
                              if (!questions || questions.length === 0) {
                                try {
                                  questions = await loadExamQuestions(exam.id);
                                } catch (err) {
                                  console.error('Failed to load questions for PDF:', err);
                                  return;
                                }
                              }
                              openPrintWindow(generateCorrectionHTML(exam.name, exam.school, exam.year, questions || [], { schoolsList: schools }), 'corrigé');
                            }}
                            title="Imprimer ou prévisualiser le Corrigé Détaillé PDF"
                            className="btn-action-pill btn-action-corrige"
                          >
                            <CheckCircle2 size={13} />
                            <span>Corrigé</span>
                          </button>

                          {/* Feuille OMR (Vierge ou Corrigée) */}
                          <div className="omr-menu-container" style={{ position: 'relative' }}>
                            <button
                              onClick={() => setOpenOmrMenuId(openOmrMenuId === exam.id ? null : exam.id)}
                              title="Télécharger la feuille de réponses OMR (Vierge ou Corrigée)"
                              className={`btn-action-pill btn-action-omr ${openOmrMenuId === exam.id ? 'active' : ''}`}
                            >
                              <FileCheck size={13} />
                              <span>Feuille OMR</span>
                              <ChevronDown size={11} style={{ opacity: 0.7 }} />
                            </button>

                            {openOmrMenuId === exam.id && (
                              <div style={{
                                position: 'absolute',
                                right: 0,
                                top: 'calc(100% + 6px)',
                                zIndex: 70,
                                minWidth: 235,
                                background: 'var(--bg-card)',
                                backdropFilter: 'blur(16px)',
                                borderRadius: '12px',
                                border: '1px solid var(--border)',
                                boxShadow: '0 12px 28px -6px rgba(0,0,0,0.28), 0 4px 10px rgba(0,0,0,0.08)',
                                padding: '0.45rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px',
                                textAlign: 'left'
                              }}>
                                <div style={{ padding: '0.25rem 0.55rem 0.15rem', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-subtle)', letterSpacing: '0.04em' }}>
                                  Format de la Feuille OMR
                                </div>

                                {/* Vierge */}
                                <button
                                  onClick={() => {
                                    handleDownloadOMR(exam, false);
                                    setOpenOmrMenuId(null);
                                  }}
                                  disabled={downloadingOmrId === `${exam.id}-blank`}
                                  className="menu-item-btn"
                                  style={{ padding: '0.5rem 0.6rem' }}
                                >
                                  <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(14, 165, 233, 0.12)', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <FileText size={13} />
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.81rem', color: 'var(--text-main)' }}>
                                      {downloadingOmrId === `${exam.id}-blank` ? 'Génération...' : 'Feuille Vierge (Élèves)'}
                                    </div>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                      Grille vide pour passer l'épreuve
                                    </div>
                                  </div>
                                </button>

                                {/* Corrigée */}
                                <button
                                  onClick={() => {
                                    handleDownloadOMR(exam, true);
                                    setOpenOmrMenuId(null);
                                  }}
                                  disabled={downloadingOmrId === `${exam.id}-ans`}
                                  className="menu-item-btn"
                                  style={{ padding: '0.5rem 0.6rem' }}
                                >
                                  <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(16, 185, 129, 0.12)', color: 'var(--emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <CheckCircle2 size={13} />
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.81rem', color: 'var(--emerald)' }}>
                                      {downloadingOmrId === `${exam.id}-ans` ? 'Génération...' : 'Feuille Corrigée (Clé)'}
                                    </div>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                      Grille avec bonnes réponses noircies
                                    </div>
                                  </div>
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Éditer */}
                          <Link
                            to={`/admin/exams/${exam.id}/edit`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Modifier ce concours et ses questions (Ouvrir dans une nouvelle page)"
                            className="btn-action-pill btn-action-edit"
                            style={{ textDecoration: 'none' }}
                          >
                            <Edit size={13} />
                            <span>Éditer</span>
                          </Link>

                          {/* More Options Dropdown */}
                          <div className="action-menu-container" style={{ position: 'relative' }}>
                            <button
                              onClick={() => setOpenMenuId(isMenuOpen ? null : exam.id)}
                              title="Plus d'actions"
                              className={`btn-action-more ${isMenuOpen ? 'active' : ''}`}
                            >
                              <MoreVertical size={15} />
                            </button>

                            {isMenuOpen && (
                              <div style={{
                                position: 'absolute',
                                right: 0,
                                top: 'calc(100% + 6px)',
                                zIndex: 60,
                                minWidth: 215,
                                background: 'var(--bg-card)',
                                backdropFilter: 'blur(16px)',
                                borderRadius: '12px',
                                border: '1px solid var(--border)',
                                boxShadow: '0 12px 28px -6px rgba(0,0,0,0.28), 0 4px 10px rgba(0,0,0,0.08)',
                                padding: '0.4rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                                textAlign: 'left'
                              }}>
                                {/* OMR Vierge */}
                                <button
                                  onClick={() => {
                                    handleDownloadOMR(exam, false);
                                    setOpenMenuId(null);
                                  }}
                                  className="menu-item-btn"
                                >
                                  <FileText size={14} color="#0284c7" />
                                  <span>Grille OMR Vierge</span>
                                </button>

                                {/* OMR Corrigée */}
                                <button
                                  onClick={() => {
                                    handleDownloadOMR(exam, true);
                                    setOpenMenuId(null);
                                  }}
                                  className="menu-item-btn"
                                >
                                  <CheckCircle2 size={14} color="var(--emerald)" />
                                  <span>Grille OMR Corrigée (Clé)</span>
                                </button>

                                <div style={{ height: 1, background: 'var(--border)', margin: '4px 4px' }} />

                                {/* Export CSV */}
                                <button
                                  onClick={() => {
                                    downloadCSV(exam);
                                    setOpenMenuId(null);
                                  }}
                                  disabled={!(exam.questionsCount || exam.questions?.length)}
                                  className="menu-item-btn"
                                  style={{ opacity: (exam.questionsCount || exam.questions?.length) ? 1 : 0.4 }}
                                >
                                  <Download size={14} color="var(--emerald)" />
                                  <span>Télécharger CSV</span>
                                </button>

                                {/* Toggle Active */}
                                <button
                                  onClick={() => {
                                    toggleExamStatus(exam.id);
                                    setOpenMenuId(null);
                                  }}
                                  className="menu-item-btn"
                                >
                                  {exam.isActive === false ? (
                                    <>
                                      <Eye size={14} color="var(--emerald)" />
                                      <span>Rendre Actif</span>
                                    </>
                                  ) : (
                                    <>
                                      <EyeOff size={14} color="var(--warning)" />
                                      <span>Désactiver l'accès</span>
                                    </>
                                  )}
                                </button>

                                {/* Archive */}
                                <button
                                  onClick={() => {
                                    toggleArchiveExam(exam.id);
                                    setOpenMenuId(null);
                                  }}
                                  className="menu-item-btn"
                                >
                                  <Archive size={14} color="var(--violet)" />
                                  <span>{exam.isArchived ? 'Désarchiver' : 'Archiver'}</span>
                                </button>

                                <div style={{ height: 1, background: 'var(--border)', margin: '4px 4px' }} />

                                {/* Delete */}
                                <button
                                  onClick={() => {
                                    setDeleteConfirmExam(exam);
                                    setOpenMenuId(null);
                                  }}
                                  className="menu-item-btn danger"
                                >
                                  <Trash2 size={14} color="var(--danger)" />
                                  <span>Supprimer définitivement</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── E-Book Modal ── */}
      {showEbook && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: 560, padding: '2rem', borderRadius: '18px', boxShadow: '0 30px 60px -12px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-main)' }}>
                  <BookOpen size={20} style={{ color: 'var(--violet)' }} /> Générer un E-Book
                </h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Compilez toutes les questions d'un domaine en un livret complet imprimable
                </p>
              </div>
              <button
                onClick={() => setShowEbook(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {loadingEbookData ? (
              <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ width: 40, height: 40, border: '3px solid rgba(124,58,237,0.15)', borderTopColor: 'var(--violet)', borderRadius: '50%', animation: 'spinEbook 1s linear infinite', margin: '0 auto 1.25rem' }} />
                <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>Chargement des données de l'E-book...</p>
                <style dangerouslySetInnerHTML={{__html: `@keyframes spinEbook { to { transform: rotate(360deg); } }`}} />
              </div>
            ) : topicList.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                Aucun topic trouvé. Importez d'abord des examens avec questions.
              </p>
            ) : (
              <>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-subtle)', marginBottom: '0.75rem', fontWeight: 700 }}>
                  Sélectionnez un domaine à compiler :
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.5rem', maxHeight: 320, overflowY: 'auto', paddingRight: 4, marginBottom: '1.5rem' }}>
                  {topicList.map(([topic, qs]) => (
                    <button
                      key={topic}
                      onClick={() => setSelectedTopic(topic)}
                      style={{
                        padding: '0.75rem 0.95rem',
                        borderRadius: 11,
                        border: `1.5px solid ${selectedTopic === topic ? 'var(--violet)' : 'var(--border)'}`,
                        background: selectedTopic === topic ? 'var(--violet-soft)' : 'var(--bg-base)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: '0.84rem', color: selectedTopic === topic ? 'var(--violet)' : 'var(--text-main)' }}>
                        {topic}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {qs.length} Q · {[...new Set(qs.map(q => q._source))].length} concours
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleGenerateEbook}
                  disabled={!selectedTopic}
                  style={{
                    width: '100%',
                    padding: '0.85rem',
                    borderRadius: 12,
                    border: 'none',
                    background: selectedTopic ? 'var(--btn-primary-bg)' : 'var(--bg-glass)',
                    color: selectedTopic ? '#fff' : 'var(--text-subtle)',
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    cursor: selectedTopic ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: selectedTopic ? 'var(--btn-primary-shadow)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <BookOpen size={18} />
                  {selectedTopic ? `Générer "Guide ${selectedTopic}" (${topicMap[selectedTopic]?.length} Q)` : 'Choisissez un domaine'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteConfirmExam && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', zIndex: 1010, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: 430, padding: '2rem', borderRadius: '20px', border: '1px solid var(--border)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', border: '1px solid rgba(239,68,68,0.2)' }}>
              <Trash2 size={24} color="var(--danger)" />
            </div>
            <h3 style={{ fontWeight: 800, fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
              Supprimer ce concours ?
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1.75rem' }}>
              Êtes-vous sûr de vouloir supprimer définitivement le concours <strong>{deleteConfirmExam.name}</strong> ? Cette action est irréversible et supprimera toutes les questions associées.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmExam(null)}
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteExam(deleteConfirmExam.id);
                  setDeleteConfirmExam(null);
                }}
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  background: 'var(--danger)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  boxShadow: '0 4px 14px rgba(239,68,68,0.3)'
                }}
              >
                <Trash2 size={14} /> Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
