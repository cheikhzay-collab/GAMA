import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { BookOpen, RefreshCw, Download, Settings, ChevronDown, ChevronUp, BookMarked, Layers, FileText, Eye } from 'lucide-react';
import { generateEbookHTML, openPrintWindow, generateCompilationEbookHTML } from '../utils/generateExamPDF';
import { getExamQuestionsOnly } from '../services/examService';

const SETTINGS_KEY = 'ebookSettings';

const defaultSettings = () => ({
  showCover: true,
  showTricks: true,
  showPageNumbers: true,
  startPage: 1,
  questionsPerPage: 3,  // Estimate only (for page count display)
});

const loadSettings = () => {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch { return {}; }
};
const saveSettings = (data) => localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));

// Estimated page count (cover=1 + content pages)
const estimatePages = (qCount, qPerPage, hasCover) =>
  (hasCover ? 1 : 0) + Math.max(1, Math.ceil(qCount / Math.max(1, qPerPage)));

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

export default function AdminEbooks() {
  const { exams, profName, profPhone, profSite } = useAuth();
  const isMobile = useIsMobile();
  
  // UI Tabs State
  const [activeTab, setActiveTab] = useState('topics'); // 'topics' | 'compilations'
  
  // Tab 1 (Topics) State
  const [allSettings, setAllSettings] = useState(loadSettings);
  const [expanded, setExpanded] = useState(null);  // which topic is expanded
  const [generated, setGenerated] = useState({});   // { topic: timestamp }

  // Tab 2 (Compilations) State
  const [compTitle, setCompTitle] = useState("CONCOURS D'ACCÈS AUX GRANDES ÉCOLES");
  const [compSubtitle, setCompSubtitle] = useState("ARCHIVES & CORRECTIONS DÉTAILLÉES");
  const [schoolOrder, setSchoolOrder] = useState([]);
  const [selectedExams, setSelectedExams] = useState({}); // { [school]: [examId, ...] }
  
  const [incCover, setIncCover] = useState(true);
  const [incTOC, setIncTOC] = useState(true);
  const [incSubject, setIncSubject] = useState(true);
  const [incOMR, setIncOMR] = useState(true);
  const [incCorrection, setIncCorrection] = useState(true);
  const [incTricks, setIncTricks] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Extract available schools dynamically
  const availableSchools = useMemo(() => {
    return [...new Set(exams.filter(e => e.isArchived !== true).map(e => e.school))].filter(Boolean).sort();
  }, [exams]);

  // Keep schoolOrder synchronized with availableSchools
  useEffect(() => {
    setSchoolOrder(prev => {
      const filteredPrev = prev.filter(s => availableSchools.includes(s));
      const newSchools = availableSchools.filter(s => !filteredPrev.includes(s));
      return [...filteredPrev, ...newSchools];
    });
  }, [availableSchools]);

  // Build topic map from all exams (Tab 1)
  const topicMap = useMemo(() => {
    const map = {};
    exams.filter(exam => exam.isArchived !== true).forEach(exam => {
      (exam.questions || []).forEach(q => {
        const t = q.subject || q.topic || 'Général';
        if (!map[t]) map[t] = [];
        map[t].push({ ...q, _source: exam.name, _year: exam.year });
      });
    });
    return map;
  }, [exams]);

  const topics = useMemo(() =>
    Object.entries(topicMap).sort((a, b) => b[1].length - a[1].length),
    [topicMap]
  );

  const totalQ = useMemo(() => Object.values(topicMap).reduce((s, a) => s + a.length, 0), [topicMap]);
  const totalSources = useMemo(() => new Set(exams.filter(e => e.isArchived !== true).map(e => e.name)).size, [exams]);

  const getSettings = useCallback((topic) => ({ ...defaultSettings(), ...(allSettings[topic] || {}) }), [allSettings]);

  const updateSetting = (topic, key, value) => {
    const next = { ...allSettings, [topic]: { ...getSettings(topic), [key]: value } };
    setAllSettings(next);
    saveSettings(next);
  };

  const handleGenerate = useCallback((topic, questions) => {
    const s = getSettings(topic);
    // Inject branding from AdminSettings (localStorage)
    s.profName  = profName  || '';
    s.profPhone = profPhone || '';
    s.profSite  = profSite  || 'www.lconq.ma';
    const html = generateEbookHTML(topic, questions, s);
    openPrintWindow(html, `ebook-${topic}`);
    setGenerated(prev => ({ ...prev, [topic]: Date.now() }));
  }, [getSettings, profName, profPhone, profSite]);

  // Compilation ordering & selection handlers
  const moveSchool = (index, direction) => {
    const nextOrder = [...schoolOrder];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= nextOrder.length) return;
    
    const temp = nextOrder[index];
    nextOrder[index] = nextOrder[targetIndex];
    nextOrder[targetIndex] = temp;
    setSchoolOrder(nextOrder);
  };

  const toggleSchoolActive = (school) => {
    setSelectedExams(prev => {
      const next = { ...prev };
      if (next[school]) {
        delete next[school];
      } else {
        const schoolExams = exams.filter(e => e.school === school && e.isArchived !== true).map(e => e.id);
        next[school] = schoolExams;
      }
      return next;
    });
  };

  const toggleExamSelected = (school, examId) => {
    setSelectedExams(prev => {
      const next = { ...prev };
      const currentList = next[school] || [];
      if (currentList.includes(examId)) {
        next[school] = currentList.filter(id => id !== examId);
        if (next[school].length === 0) {
          delete next[school];
        }
      } else {
        next[school] = [...currentList, examId];
      }
      return next;
    });
  };

  const handleGenerateCompilation = async () => {
    const activeSchools = schoolOrder.filter(s => selectedExams[s] && selectedExams[s].length > 0);
    if (activeSchools.length === 0) {
      alert("Veuillez sélectionner au moins une école et un concours.");
      return;
    }

    setIsGenerating(true);
    try {
      const allSelectedExamIds = [];
      activeSchools.forEach(s => {
        allSelectedExamIds.push(...(selectedExams[s] || []));
      });

      // Fetch all questions for the selected exams in parallel
      const questionsPromises = allSelectedExamIds.map(async (examId) => {
        const questions = await getExamQuestionsOnly(examId);
        return { examId, questions };
      });

      const results = await Promise.all(questionsPromises);
      const questionsMap = {};
      results.forEach(res => {
        questionsMap[res.examId] = res.questions;
      });

      // Construct full exams data list with questions injected
      const compiledExams = exams.map(e => {
        if (allSelectedExamIds.includes(e.id)) {
          return { ...e, questions: questionsMap[e.id] || [] };
        }
        return e;
      });

      // Generate PDF
      const config = {
        title: compTitle,
        subtitle: compSubtitle,
        selectedSchools: activeSchools,
        selectedExams: selectedExams,
        schoolOrder: activeSchools,
        includeCover: incCover,
        includeTOC: incTOC,
        includeSubject: incSubject,
        includeOMR: incOMR,
        includeCorrection: incCorrection,
        showTricks: incTricks,
        profName: profName || '',
        profPhone: profPhone || '',
        profSite: profSite || 'www.lconq.ma',
      };

      const html = generateCompilationEbookHTML(config, compiledExams, {
        profName,
        profPhone,
        profSite
      });

      openPrintWindow(html, `compilation-${compTitle.toLowerCase().replace(/\s+/g, '-')}`);
    } catch (err) {
      console.error("Failed to generate compilation ebook:", err);
      alert("Une erreur est survenue lors de la génération du livre.");
    } finally {
      setIsGenerating(false);
    }
  };

  const fmtDate = (ts) => ts
    ? new Date(ts).toLocaleString('fr-MA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  const badge = (color, bg, text) => (
    <span style={{ background: bg, color, padding: '0.15rem 0.55rem', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, border: `1px solid ${color}22`, display: 'inline-block' }}>
      {text}
    </span>
  );

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: '3rem' }}>

      {/* ── Header ── */}
      <header style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'linear-gradient(135deg, var(--violet), var(--emerald))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BookMarked size={22} color="#fff" />
              </div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Bibliothèque E-Books</h1>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>
              Générez des guides PDF et des compilations d'annales officielles
            </p>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          {[
            { icon: <Layers size={18} />, val: topics.length, lbl: 'Domaines disponibles', clr: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
            { icon: <FileText size={18} />, val: totalQ, lbl: 'Questions compilées', clr: '#1a56db', bg: 'rgba(30,86,219,0.08)' },
            { icon: <BookOpen size={18} />, val: totalSources, lbl: 'Concours sources', clr: 'var(--emerald)', bg: 'rgba(16,185,129,0.08)' },
            { icon: <Download size={18} />, val: Object.keys(generated).length, lbl: 'E-Books générés (session)', clr: 'var(--warning)', bg: 'rgba(245,158,11,0.08)' },
          ].map((s, i) => (
            <div key={i} style={{ flex: '1 1 180px', background: s.bg, border: `1px solid ${s.clr}33`, borderRadius: 12, padding: '0.9rem 1.2rem', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: s.clr }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: s.clr, lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>{s.lbl}</div>
              </div>
            </div>
          ))}
        </div>
      </header>

      {/* ── Tabs Selector ── */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem', paddingBottom: '0.2rem' }}>
        <button 
          onClick={() => setActiveTab('topics')}
          style={{ 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'topics' ? '3px solid var(--violet)' : '3px solid transparent', 
            color: activeTab === 'topics' ? 'var(--text-main)' : 'var(--text-muted)', 
            padding: '0.5rem 1rem', 
            cursor: 'pointer', 
            fontWeight: 700, 
            fontSize: '0.92rem',
            transition: 'all 0.2s'
          }}
        >
          Livres thématiques (Par Domaines)
        </button>
        <button 
          onClick={() => setActiveTab('compilations')}
          style={{ 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'compilations' ? '3px solid var(--violet)' : '3px solid transparent', 
            color: activeTab === 'compilations' ? 'var(--text-main)' : 'var(--text-muted)', 
            padding: '0.5rem 1rem', 
            cursor: 'pointer', 
            fontWeight: 700, 
            fontSize: '0.92rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s'
          }}
        >
          <Layers size={16} />
          Générateur de Compilations (Livres complets)
        </button>
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'topics' ? (
        topics.length === 0 ? (
          <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <BookOpen size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
            <p style={{ fontSize: '1rem' }}>Aucun domaine trouvé.</p>
            <p style={{ fontSize: '0.82rem', marginTop: 6 }}>Importez des examens via <strong>Import IA</strong> ou <strong>Upload CSV</strong> pour générer des e-books.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 290px), 1fr))', gap: '1rem' }}>
            {topics.map(([topic, questions]) => {
              const s = getSettings(topic);
              const sources = [...new Set(questions.map(q => q._source))];
              const estPages = estimatePages(questions.length, s.questionsPerPage, s.showCover);
              const isExpanded = expanded === topic;
              const lastGen = fmtDate(generated[topic]);

              return (
                <div key={topic} className="glass-panel" style={{ padding: 0, overflow: 'hidden', border: isExpanded ? '1px solid var(--violet)' : '1px solid var(--border)', transition: 'border-color 0.2s' }}>

                  {/* Card Header */}
                  <div style={{ padding: '1.1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <BookOpen size={15} style={{ color: 'var(--violet)', flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topic}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {badge('#1a56db', 'rgba(30,86,219,0.1)', `${questions.length} questions`)}
                          {badge('var(--emerald)', 'rgba(16,185,129,0.1)', `${sources.length} concours`)}
                          {badge('#7c3aed', 'rgba(124,58,237,0.1)', `~${estPages} pages`)}
                        </div>
                      </div>

                      {/* Settings toggle */}
                      <button onClick={() => setExpanded(isExpanded ? null : topic)}
                        style={{ background: isExpanded ? 'rgba(124,58,237,0.1)' : 'var(--bg-glass)', border: `1px solid ${isExpanded ? 'var(--violet)' : 'var(--border)'}`, borderRadius: 8, padding: '0.35rem 0.5rem', cursor: 'pointer', color: isExpanded ? 'var(--violet)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>
                        <Settings size={13} />
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </div>

                    {/* Sources */}
                    <div style={{ marginTop: '0.6rem', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      {sources.slice(0, 3).join(' · ')}{sources.length > 3 ? ` +${sources.length - 3}` : ''}
                    </div>
                  </div>

                  {/* ── Settings Panel ── */}
                  {isExpanded && (
                    <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', background: 'rgba(124,58,237,0.03)' }}>
                      <p style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--violet)', marginBottom: '0.85rem' }}>⚙ Paramètres du livre</p>

                      {/* Questions per page */}
                      <div style={{ marginBottom: '0.85rem' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          Questions par page (estimation)
                          <strong className="text-main">{s.questionsPerPage} Q/page</strong>
                        </label>
                        <input type="range" min={1} max={6} value={s.questionsPerPage}
                          onChange={e => updateSetting(topic, 'questionsPerPage', +e.target.value)}
                          style={{ width: '100%', accentColor: 'var(--violet)' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          <span>Détaillé (1)</span><span>Compact (6)</span>
                        </div>
                      </div>

                      {/* Start page */}
                      <div style={{ marginBottom: '0.85rem' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          Numéro de la 1ère page
                          <strong className="text-main">Page {s.startPage}</strong>
                        </label>
                        <input type="number" min={1} max={999} value={s.startPage}
                          onChange={e => updateSetting(topic, 'startPage', Math.max(1, +e.target.value))}
                          style={{ width: '100%', padding: '0.45rem 0.7rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-glass)', color: 'var(--text-main)', fontSize: '0.85rem', outline: 'none' }} />
                      </div>

                      {/* Toggles */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {[
                          { key: 'showCover', label: '📖 Page de couverture', val: s.showCover },
                          { key: 'showTricks', label: '⚡ Section Coup de Grâce', val: s.showTricks },
                          { key: 'showPageNumbers', label: '🔢 Numérotation des pages', val: s.showPageNumbers },
                        ].map(opt => (
                          <label key={opt.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', cursor: 'pointer', padding: '0.3rem 0' }}>
                            <span className="text-muted">{opt.label}</span>
                            <div onClick={() => updateSetting(topic, opt.key, !opt.val)}
                              style={{ width: 36, height: 20, borderRadius: 10, background: opt.val ? 'var(--violet)' : 'var(--border)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                              <div style={{ position: 'absolute', top: 3, left: opt.val ? 18 : 3, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                            </div>
                          </label>
                        ))}
                      </div>

                      {/* Estimated pages summary */}
                      <div style={{ marginTop: '0.85rem', padding: '0.6rem 0.85rem', borderRadius: 8, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        📐 Estimation : <strong className="text-violet">~{estPages} pages</strong>
                        {s.showCover ? ' (dont 1 couverture)' : ''}
                        · Commence à la page <strong className="text-violet">{s.startPage}</strong>
                      </div>
                    </div>
                  )}

                  {/* Card Footer — Generate */}
                  <div style={{ padding: '0.85rem 1.25rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {lastGen && (
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', flex: 1 }}>
                        ✓ Généré {lastGen}
                      </span>
                    )}
                    <button onClick={() => handleGenerate(topic, questions)}
                      style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '0.55rem 1rem', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#6366f1)', color: '#fff', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,58,237,0.35)', transition: 'transform 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                      {generated[topic] ? <RefreshCw size={13} /> : <Download size={13} />}
                      {generated[topic] ? 'Regénérer' : 'Générer PDF'}
                    </button>

                    <button onClick={() => handleGenerate(topic, questions)}
                      title="Aperçu"
                      style={{ padding: '0.55rem 0.6rem', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-glass)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <Eye size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* ── Compilation Generator UI ── */
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
          
          {/* Left Panel: Structure selection */}
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', color: 'var(--violet)' }}>
              1. Structure et Ordre du Livre
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Sélectionnez les écoles à inclure dans le livre et déterminez leur ordre d'apparition. Cochez ensuite les concours à inclure.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {schoolOrder.map((school, idx) => {
                const schoolExams = exams.filter(e => e.school === school && e.isArchived !== true).sort((a, b) => b.year - a.year);
                const isSchoolActive = !!selectedExams[school];
                const activeCount = selectedExams[school]?.length || 0;
                
                return (
                  <div key={school} style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '0.75rem', background: isSchoolActive ? 'rgba(124, 58, 237, 0.03)' : 'transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
                        <input 
                          type="checkbox" 
                          checked={isSchoolActive} 
                          onChange={() => toggleSchoolActive(school)}
                          style={{ accentColor: 'var(--violet)', width: 16, height: 16 }}
                        />
                        <span>{school}</span>
                        {isSchoolActive && (
                          <span style={{ fontSize: '0.7rem', background: 'var(--violet)', color: '#fff', padding: '2px 8px', borderRadius: 10 }}>
                            {activeCount} concours
                          </span>
                        )}
                      </label>
                      
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button 
                          onClick={() => moveSchool(idx, -1)} 
                          disabled={idx === 0}
                          style={{ padding: '2px 6px', border: '1px solid var(--border)', background: 'var(--bg-glass)', color: 'var(--text-main)', borderRadius: 4, cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.3 : 1 }}
                        >
                          ▲
                        </button>
                        <button 
                          onClick={() => moveSchool(idx, 1)} 
                          disabled={idx === schoolOrder.length - 1}
                          style={{ padding: '2px 6px', border: '1px solid var(--border)', background: 'var(--bg-glass)', color: 'var(--text-main)', borderRadius: 4, cursor: idx === schoolOrder.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === schoolOrder.length - 1 ? 0.3 : 1 }}
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                    
                    {isSchoolActive && (
                      <div style={{ marginTop: '0.75rem', paddingLeft: '1.25rem', borderLeft: '2px solid var(--violet)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '6px' }}>
                        {schoolExams.map(exam => {
                          const isExamChecked = selectedExams[school]?.includes(exam.id);
                          return (
                            <label key={exam.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', cursor: 'pointer', color: isExamChecked ? 'var(--text-main)' : 'var(--text-muted)' }}>
                              <input 
                                type="checkbox" 
                                checked={isExamChecked}
                                onChange={() => toggleExamSelected(school, exam.id)}
                                style={{ accentColor: 'var(--violet)' }}
                              />
                              <span>{exam.year}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Right Panel: Configurations & Actions */}
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', color: 'var(--violet)' }}>
              2. Personnalisation &amp; Impression
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Titre du Livre
                </label>
                <input 
                  type="text" 
                  value={compTitle} 
                  onChange={e => setCompTitle(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-glass)', color: 'var(--text-main)', fontSize: '0.88rem', outline: 'none' }}
                />
              </div>
              
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Sous-titre / Description
                </label>
                <input 
                  type="text" 
                  value={compSubtitle} 
                  onChange={e => setCompSubtitle(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-glass)', color: 'var(--text-main)', fontSize: '0.88rem', outline: 'none' }}
                />
              </div>
            </div>
            
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--violet)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                📖 Options d'Inclusion
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.5rem' }}>
                {[
                  { label: 'Page de Couverture principale', val: incCover, set: setIncCover },
                  { label: 'Sommaire (Fohros)', val: incTOC, set: setIncTOC },
                  { label: 'Sujets des Concours (Mawdo3)', val: incSubject, set: setIncSubject },
                  { label: "Grilles OMR d'entraînement (Vides)", val: incOMR, set: setIncOMR },
                  { label: 'Corrigés et Solutions (Tasshih)', val: incCorrection, set: setIncCorrection },
                  { label: 'Section Coup de Grâce', val: incTricks, set: setIncTricks },
                ].map(opt => (
                  <label key={opt.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer', padding: '0.2rem 0' }}>
                    <input 
                      type="checkbox" 
                      checked={opt.val} 
                      onChange={() => opt.set(!opt.val)}
                      style={{ accentColor: 'var(--violet)', width: 15, height: 15 }}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(124, 58, 237, 0.05)', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid rgba(124, 58, 237, 0.1)' }}>
                ℹ️ Les informations de contact (Nom, Téléphone, Site) configurées dans les paramètres généraux seront injectées pour le branding.
              </div>
              
              <button 
                onClick={handleGenerateCompilation}
                disabled={isGenerating}
                style={{ 
                  width: '100%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: 8, 
                  padding: '0.75rem 1.25rem', 
                  borderRadius: 9, 
                  border: 'none', 
                  background: 'linear-gradient(135deg, var(--violet), var(--emerald))', 
                  color: '#fff', 
                  fontWeight: 800, 
                  fontSize: '0.9rem', 
                  cursor: isGenerating ? 'not-allowed' : 'pointer', 
                  boxShadow: '0 4px 14px rgba(124,58,237,0.35)', 
                  transition: 'transform 0.15s',
                  marginTop: '0.5rem'
                }}
                onMouseEnter={e => !isGenerating && (e.currentTarget.style.transform = 'translateY(-1px)')}
                onMouseLeave={e => !isGenerating && (e.currentTarget.style.transform = 'none')}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Génération du livre en cours...
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    Générer la Compilation PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
