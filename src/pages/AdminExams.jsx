import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Unlock, Library, Eye, EyeOff, Edit, X, FileText, Download, Search, BookOpen, Trash2, Archive } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { generateSubjectHTML, generateCorrectionHTML, generateEbookHTML, openPrintWindow } from '../utils/generateExamPDF';
import { getLevelDisplayName, mapLegacySchoolToLevel } from './SchoolsPage';

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

export default function AdminExams() {
  const { exams, toggleExamStatus, schools, deleteExam, toggleArchiveExam, loadExamQuestions } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [showEbook, setShowEbook] = useState(false);
  const [loadingEbookData, setLoadingEbookData] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [archiveTab, setArchiveTab] = useState('active'); // 'active' | 'archived'
  const [deleteConfirmExam, setDeleteConfirmExam] = useState(null);

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

  const hasFilters = search || filterSchool || filterYear || filterStatus || filterTier;
  const clearFilters = () => { setSearch(''); setFilterSchool(''); setFilterYear(''); setFilterStatus(''); setFilterTier(''); };

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

  const sel = { padding: '0.55rem 0.75rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-glass)', color: 'var(--text-main)', fontSize: '0.82rem', cursor: 'pointer', outline: 'none' };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'linear-gradient(135deg, var(--violet), var(--emerald))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Library size={22} color="#fff" />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Bibliothèque QCM</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            {filtered.length} / {exams.filter(e => archiveTab === 'active' ? !e.isArchived : e.isArchived).length} concours{hasFilters ? ' (filtrés)' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', width: isMobile ? '100%' : 'auto' }}>
          <button onClick={() => setShowEbook(true)}
            style={{ flex: isMobile ? 1 : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0.6rem 1rem', borderRadius: 10, background: 'linear-gradient(135deg,#7c3aed,#6366f1)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,58,237,0.35)' }}>
            <BookOpen size={16} /> {isMobile ? 'E-Book' : 'Générer E-Book'}
          </button>
          <Link to="/admin/upload" className="btn" style={{ flex: isMobile ? 1 : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '44px' }}>
            + {isMobile ? 'Nouveau' : 'Nouveau Concours'}
          </Link>
        </div>
      </header>

      {/* ── Tabs for Active vs Archived ── */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '1rem', width: '100%' }}>
        <button
          onClick={() => setArchiveTab('active')}
          style={{
            flex: isMobile ? 1 : 'none',
            justifyContent: 'center',
            padding: '0.55rem 1.1rem', borderRadius: '10px', border: '1px solid var(--border)',
            background: archiveTab === 'active' ? 'linear-gradient(135deg, var(--violet), #6366f1)' : 'var(--bg-glass)',
            color: archiveTab === 'active' ? '#fff' : 'var(--text-muted)',
            fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: archiveTab === 'active' ? '0 4px 14px rgba(124,58,237,0.25)' : 'none'
          }}
        >
          <Library size={14} /> {isMobile ? 'Actifs' : 'Concours Actifs'} ({exams.filter(e => !e.isArchived).length})
        </button>
        <button
          onClick={() => setArchiveTab('archived')}
          style={{
            flex: isMobile ? 1 : 'none',
            justifyContent: 'center',
            padding: '0.55rem 1.1rem', borderRadius: '10px', border: '1px solid var(--border)',
            background: archiveTab === 'archived' ? 'linear-gradient(135deg, var(--violet), #6366f1)' : 'var(--bg-glass)',
            color: archiveTab === 'archived' ? '#fff' : 'var(--text-muted)',
            fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: archiveTab === 'archived' ? '0 4px 14px rgba(124,58,237,0.25)' : 'none'
          }}
        >
          <Archive size={14} /> {isMobile ? 'Archivés' : 'Concours Archivés'} ({exams.filter(e => e.isArchived).length})
        </button>
      </div>

      {/* ── Filter Bar ── */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Rechercher un concours..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...sel, width: '100%', paddingLeft: 30 }}
          />
        </div>
        <select value={filterSchool} onChange={e => setFilterSchool(e.target.value)} style={{ ...sel, flex: '1 1 160px' }}>
          <option value="">🎓 Tous les niveaux</option>
          {schools.map(s => <option key={s} value={s}>{getLevelDisplayName(s)}</option>)}
        </select>
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)} style={{ ...sel, flex: isMobile ? '1 1 130px' : '0 0 auto' }}>
          <option value="">📅 Toutes les années</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...sel, flex: isMobile ? '1 1 130px' : '0 0 auto' }}>
          <option value="">👁 Tous les statuts</option>
          <option value="active">✅ Actifs</option>
          <option value="inactive">🔴 Désactivés</option>
        </select>
        <select value={filterTier} onChange={e => setFilterTier(e.target.value)} style={{ ...sel, flex: isMobile ? '1 1 130px' : '0 0 auto' }}>
          <option value="">🔓 Tous les abonnements</option>
          <option value="freemium">Gratuit</option>
          <option value="premium">Premium</option>
        </select>
        {hasFilters && (
          <button onClick={clearFilters}
            style={{ ...sel, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--danger)', fontWeight: 700, whiteSpace: 'nowrap' }}>
            ✕ Effacer
          </button>
        )}
      </div>

      {/* ── Table / Cards ── */}
      <div className="glass-panel" style={{ overflow: 'hidden', padding: isMobile ? '0.5rem 0' : 0, background: isMobile ? 'transparent' : 'var(--bg-glass)', border: isMobile ? 'none' : '1px solid var(--border)', boxShadow: isMobile ? 'none' : 'var(--shadow-card)' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: '12px' }}>
            <Library size={48} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
            <p>
              {exams.length === 0
                ? 'La bibliothèque est vide.'
                : archiveTab === 'archived'
                  ? 'Aucun concours archivé.'
                  : 'Aucun résultat pour ces filtres.'}
            </p>
          </div>
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {filtered.map(exam => (
              <div
                key={exam.id}
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: '16px',
                  padding: '1.25rem',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-card)',
                  opacity: exam.isActive === false ? 0.75 : 1,
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem'
                }}
              >
                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: 1.35 }}>
                    {exam.name}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flexShrink: 0 }}>
                    {exam.tier === 'premium' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--warning)', background: 'rgba(245,158,11,0.1)', padding: '0.15rem 0.5rem', borderRadius: '1rem', fontSize: '0.7rem', fontWeight: 700 }}>
                        <Lock size={10} /> Pro
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--emerald)', background: 'rgba(16,185,129,0.1)', padding: '0.15rem 0.5rem', borderRadius: '1rem', fontSize: '0.7rem', fontWeight: 700 }}>
                        <Unlock size={10} /> Free
                      </span>
                    )}
                    {exam.isActive === false && (
                      <span style={{ fontSize: '0.65rem', color: 'var(--danger)', padding: '0.1rem 0.35rem', border: '1px solid var(--danger)', borderRadius: 4, display: 'inline-block', fontWeight: 700 }}>Désactivé</span>
                    )}
                    {exam.isArchived && (
                      <span style={{ fontSize: '0.65rem', color: 'var(--warning)', padding: '0.1rem 0.35rem', border: '1px solid var(--warning)', borderRadius: 4, display: 'inline-block', fontWeight: 700 }}>Archivé</span>
                    )}
                  </div>
                </div>

                {/* Metadata badges */}
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  <span style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.2rem 0.5rem' }}>
                    🎓 {getLevelDisplayName(exam.level || mapLegacySchoolToLevel(exam.school)) || '—'}
                  </span>
                  <span style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.2rem 0.5rem' }}>
                    📅 {exam.year || '—'}
                  </span>
                  <span style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.2rem 0.5rem', fontWeight: 700 }}>
                    ❓ {exam.questionsCount || exam.questions?.length || 0} Q
                  </span>
                </div>

                {/* Document Actions Row */}
                <div style={{ display: 'flex', gap: '0.4rem', width: '100%' }}>
                  <button
                    onClick={() => downloadCSV(exam)}
                    disabled={!(exam.questionsCount || exam.questions?.length)}
                    style={{
                      flex: 1,
                      padding: '0.45rem 0.5rem',
                      borderRadius: 8,
                      border: '1px solid rgba(16,185,129,0.3)',
                      background: 'rgba(16,185,129,0.08)',
                      color: 'var(--emerald)',
                      cursor: (exam.questionsCount || exam.questions?.length) ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      opacity: (exam.questionsCount || exam.questions?.length) ? 1 : 0.35
                    }}
                  >
                    <Download size={13} /> CSV
                  </button>

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
                    style={{
                      flex: 1,
                      padding: '0.45rem 0.5rem',
                      borderRadius: 8,
                      border: '1px solid rgba(30,86,219,0.3)',
                      background: 'rgba(30,86,219,0.08)',
                      color: '#1a56db',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      fontSize: '0.74rem',
                      fontWeight: 700
                    }}
                  >
                    <FileText size={13} /> Sujet
                  </button>

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
                    style={{
                      flex: 1,
                      padding: '0.45rem 0.5rem',
                      borderRadius: 8,
                      border: '1px solid rgba(124,58,237,0.3)',
                      background: 'rgba(124,58,237,0.08)',
                      color: '#7c3aed',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      fontSize: '0.74rem',
                      fontWeight: 700
                    }}
                  >
                    <FileText size={13} /> Corrigé
                  </button>
                </div>

                {/* Management Actions Row */}
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <button
                    onClick={() => navigate(`/admin/exams/${exam.id}/edit`)}
                    className="btn-outline"
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      padding: '0.45rem',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      borderRadius: 8
                    }}
                  >
                    <Edit size={14} /> Éditer
                  </button>

                  <button
                    onClick={() => toggleExamStatus(exam.id)}
                    title={exam.isActive === false ? 'Activer' : 'Désactiver'}
                    style={{
                      padding: '0.5rem',
                      borderRadius: 8,
                      border: 'none',
                      cursor: 'pointer',
                      background: exam.isActive === false ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                      color: exam.isActive === false ? 'var(--danger)' : 'var(--emerald)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {exam.isActive === false ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>

                  <button
                    onClick={() => toggleArchiveExam(exam.id)}
                    title={exam.isArchived ? 'Désarchiver' : 'Archiver'}
                    style={{
                      padding: '0.5rem',
                      borderRadius: 8,
                      border: 'none',
                      cursor: 'pointer',
                      background: exam.isArchived ? 'rgba(245,158,11,0.1)' : 'rgba(124,58,237,0.1)',
                      color: exam.isArchived ? 'var(--warning)' : '#7c3aed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Archive size={15} />
                  </button>

                  <button
                    onClick={() => setDeleteConfirmExam(exam)}
                    title="Supprimer définitivement"
                    style={{
                      padding: '0.5rem',
                      borderRadius: 8,
                      border: 'none',
                      cursor: 'pointer',
                      background: 'rgba(239,68,68,0.1)',
                      color: 'var(--danger)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 900 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Concours</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>École</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>Année</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', textAlign: 'center' }}>Q</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>Abonnement</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(exam => (
                  <tr key={exam.id} style={{ borderBottom: '1px solid var(--border)', opacity: exam.isActive === false ? 0.55 : 1, transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                    {/* Name */}
                    <td style={{ padding: '0.9rem 1rem', fontWeight: 600, maxWidth: 200 }}>
                      <div style={{ fontSize: '0.9rem' }}>{exam.name}</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                        {exam.isActive === false && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--danger)', padding: '0.1rem 0.35rem', border: '1px solid var(--danger)', borderRadius: 4, display: 'inline-block' }}>Désactivé</span>
                        )}
                        {exam.isArchived && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--warning)', padding: '0.1rem 0.35rem', border: '1px solid var(--warning)', borderRadius: 4, display: 'inline-block' }}>Archivé</span>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '0.9rem 1rem', color: 'var(--text-muted)', fontSize: '0.82rem', maxWidth: 130 }}>{getLevelDisplayName(exam.level || mapLegacySchoolToLevel(exam.school)) || '—'}</td>

                    {/* Year */}
                    <td style={{ padding: '0.9rem 1rem', color: 'var(--text-muted)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{exam.year || '—'}</td>

                    {/* Questions count */}
                    <td style={{ padding: '0.9rem 1rem', textAlign: 'center', fontWeight: 700, fontSize: '0.9rem' }}>
                      <span style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.15rem 0.5rem', fontSize: '0.8rem' }}>
                        {exam.questionsCount || exam.questions?.length || 0}
                      </span>
                    </td>

                    {/* Tier */}
                    <td style={{ padding: '0.9rem 1rem', whiteSpace: 'nowrap' }}>
                      {exam.tier === 'premium' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--warning)', background: 'rgba(245,158,11,0.1)', padding: '0.2rem 0.65rem', borderRadius: '1rem', fontSize: '0.78rem', fontWeight: 700 }}>
                          <Lock size={12} /> Premium
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--emerald)', background: 'rgba(16,185,129,0.1)', padding: '0.2rem 0.65rem', borderRadius: '1rem', fontSize: '0.78rem', fontWeight: 700 }}>
                          <Unlock size={12} /> Free
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '0.9rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'nowrap' }}>

                        {/* CSV */}
                        <button onClick={() => downloadCSV(exam)} disabled={!(exam.questionsCount || exam.questions?.length)}
                          title="Télécharger CSV"
                          style={{ padding: '0.3rem 0.55rem', borderRadius: 6, border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.08)', color: 'var(--emerald)', cursor: (exam.questionsCount || exam.questions?.length) ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.72rem', fontWeight: 700, opacity: (exam.questionsCount || exam.questions?.length) ? 1 : 0.35 }}>
                          <Download size={12} /> CSV
                        </button>

                        {/* Sujet PDF */}
                        <button onClick={async () => {
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
                          title="Sujet Blanc PDF"
                          style={{ padding: '0.3rem 0.55rem', borderRadius: 6, border: '1px solid rgba(30,86,219,0.3)', background: 'rgba(30,86,219,0.08)', color: '#1a56db', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.72rem', fontWeight: 700 }}>
                          <FileText size={12} /> Sujet
                        </button>

                        {/* Corrigé PDF */}
                        <button onClick={async () => {
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
                          title="Corrigé Détaillé PDF"
                          style={{ padding: '0.3rem 0.55rem', borderRadius: 6, border: '1px solid rgba(124,58,237,0.3)', background: 'rgba(124,58,237,0.08)', color: '#7c3aed', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.72rem', fontWeight: 700 }}>
                          <FileText size={12} /> Corrigé
                        </button>

                        {/* Toggle active */}
                        <button onClick={() => toggleExamStatus(exam.id)}
                          title={exam.isActive === false ? 'Activer' : 'Désactiver'}
                          style={{ padding: '0.35rem 0.45rem', borderRadius: 6, border: 'none', cursor: 'pointer', background: exam.isActive === false ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: exam.isActive === false ? 'var(--danger)' : 'var(--emerald)', display: 'flex', alignItems: 'center' }}>
                          {exam.isActive === false ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>

                        {/* Edit → navigate to full edit page */}
                        <button onClick={() => navigate(`/admin/exams/${exam.id}/edit`)} className="btn-outline"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Edit size={12} /> Éditer
                        </button>

                        {/* Toggle archive */}
                        <button onClick={() => toggleArchiveExam(exam.id)}
                          title={exam.isArchived ? 'Désarchiver' : 'Archiver'}
                          style={{ padding: '0.35rem 0.45rem', borderRadius: 6, border: 'none', cursor: 'pointer', background: exam.isArchived ? 'rgba(245,158,11,0.1)' : 'rgba(124,58,237,0.1)', color: exam.isArchived ? 'var(--warning)' : '#7c3aed', display: 'flex', alignItems: 'center' }}>
                          <Archive size={14} />
                        </button>

                        {/* Delete */}
                        <button onClick={() => setDeleteConfirmExam(exam)}
                          title="Supprimer définitivement"
                          style={{ padding: '0.35rem 0.45rem', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', display: 'flex', alignItems: 'center' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── E-Book Modal ── */}
      {showEbook && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: 560, padding: '2rem', boxShadow: '0 30px 60px -12px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BookOpen size={20} style={{ color: 'var(--violet)' }} /> Générer un E-Book
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>Compilez toutes les questions d'un domaine en un guide PDF illustré</p>
              </div>
              <button onClick={() => setShowEbook(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={22} /></button>
            </div>

            {loadingEbookData ? (
              <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ width: 40, height: 40, border: '3px solid rgba(124,58,237,0.15)', borderTopColor: 'var(--violet)', borderRadius: '50%', animation: 'spinEbook 1s linear infinite', margin: '0 auto 1.25rem' }} />
                <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>Chargement des données de l'E-book...</p>
                <style dangerouslySetInnerHTML={{__html: `
                  @keyframes spinEbook { to { transform: rotate(360deg); } }
                `}} />
              </div>
            ) : topicList.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Aucun topic trouvé. Importez d'abord des examens avec sujets.</p>
            ) : (
              <>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: 600 }}>Sélectionnez un domaine :</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', maxHeight: 320, overflowY: 'auto', paddingRight: 4, marginBottom: '1.5rem' }}>
                  {topicList.map(([topic, qs]) => (
                    <button key={topic} onClick={() => setSelectedTopic(topic)}
                      style={{ padding: '0.65rem 0.9rem', borderRadius: 10, border: `2px solid ${selectedTopic === topic ? 'var(--violet)' : 'var(--border)'}`, background: selectedTopic === topic ? 'rgba(124,58,237,0.12)' : 'var(--bg-glass)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', color: selectedTopic === topic ? 'var(--violet)' : 'var(--text-main)' }}>{topic}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {qs.length} Q · {[...new Set(qs.map(q => q._source))].length} concours
                      </div>
                    </button>
                  ))}
                </div>
                <button onClick={handleGenerateEbook} disabled={!selectedTopic}
                  style={{ width: '100%', padding: '0.9rem', borderRadius: 12, border: 'none', background: selectedTopic ? 'linear-gradient(135deg,#7c3aed,#6366f1)' : 'var(--bg-glass)', color: selectedTopic ? '#fff' : 'var(--text-muted)', fontWeight: 800, fontSize: '0.9rem', cursor: selectedTopic ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: selectedTopic ? '0 8px 24px rgba(124,58,237,0.4)' : 'none', transition: 'all 0.2s' }}>
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
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: 420, padding: '2rem', borderRadius: '20px', border: '1px solid var(--border)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', border: '1px solid rgba(239,68,68,0.2)' }}>
              <Trash2 size={24} color="var(--danger)" />
            </div>
            <h3 style={{ fontWeight: 800, fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Supprimer ce concours ?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1.75rem' }}>
              Êtes-vous sûr de vouloir supprimer définitivement le concours <strong>{deleteConfirmExam.name}</strong> ? Cette action est irréversible et supprimera toutes les questions associées.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="btn-outline" type="button" onClick={() => setDeleteConfirmExam(null)} style={{ flex: 1, padding: '0.6rem' }}>
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteExam(deleteConfirmExam.id);
                  setDeleteConfirmExam(null);
                }}
                style={{ flex: 1, padding: '0.6rem', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
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
