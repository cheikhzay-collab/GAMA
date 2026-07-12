import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { 
  ArrowLeft, Download, Check, X, Eye, EyeOff, Edit,
  BookOpen, Calendar, User, Phone, CheckCircle, AlertCircle,
  Calculator, BookOpenCheck, Loader
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getLessonById } from '../services/lessonService';
import { renderWithMath } from '../utils/mathRenderer';
import { openLessonPrintWindow } from '../utils/generateLessonPDF';

/**
 * Convert **bold** markdown to <strong> inline spans, keeping the rest as plain text.
 * Returns a React element (or array of spans).
 */
const parseBold = (text) => {
  if (!text || !text.includes('**')) return text;
  const parts = text.split(/\*\*/);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} style={{ fontWeight: 800 }}>{part}</strong>
      : part
  );
};


const parseExerciseTitle = (title, fallbackIdx, isArabicMode = false) => {
  if (!title) return { number: String(fallbackIdx + 1), label: '' };
  
  let clean = title.trim();

  // Handle Arabic titles: "تمرين 1" or "تمرين: 1" or "تمرين\n1"
  if (isArabicMode || /^\u062a\u0645\u0631\u064a\u0646/.test(clean)) {
    const arabicMatch = clean.match(/^\u062a\u0645\u0631\u064a\u0646[:\s]+([\d\u0661-\u0669]+)\s*(.*)$/);
    if (arabicMatch) {
      return { number: arabicMatch[1], label: arabicMatch[2].trim() };
    }
    const numMatch = clean.match(/([\d]+)/);
    return { number: numMatch ? numMatch[1] : String(fallbackIdx + 1), label: '' };
  }
  
  // Remove "Exercice" prefix if any
  const prefixMatch = clean.match(/^Exercice\s*(?:N?°|N)?\s*/i);
  if (prefixMatch) {
    clean = clean.substring(prefixMatch[0].length).trim();
  }
  
  // Match number (alphanumeric/spaces) and the rest
  const match = clean.match(/^([0-9a-zA-Z\s]+)(.*)$/);
  if (match) {
    const number = match[1].trim();
    let label = match[2].trim();
    
    // Clean leading separators from the label (colons, dashes, etc.)
    label = label.replace(/^[:\-–—\s]+/, '').trim();
    
    return {
      number: number || String(fallbackIdx + 1),
      label: label
    };
  }
  
  return {
    number: clean || String(fallbackIdx + 1),
    label: ''
  };
};

/* ── Render Devoir Surveillé homework body with barème ── */
const renderHomeworkBody = (text, isArabicMode, arabicFont, renderWithMath, secId, onPointsChange) => {
  if (text === null || text === undefined) return null;

  let rawText = String(text)
    .replace(/\\n(?![a-zA-Z])/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const lines = rawText.split('\n');
  const mergedLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^(\*\*)?([a-zA-Z]|\d+)[.)](\*\*)?$/.test(line) && i + 1 < lines.length) {
      let nextNonEmptyIdx = i + 1;
      while (nextNonEmptyIdx < lines.length && lines[nextNonEmptyIdx].trim() === '') {
        nextNonEmptyIdx++;
      }
      if (nextNonEmptyIdx < lines.length) {
        mergedLines.push(line + ' ' + lines[nextNonEmptyIdx].trim());
        i = nextNonEmptyIdx;
        continue;
      }
    }
    mergedLines.push(lines[i]);
  }

  // Regex to detect points: (1,5 pts), (1 pt), (0.5 ن), (2 points)
  const pointsRegex = /\(\s*([\d.,]+)\s*(?:pts?|points?|\u0646|\u0646\u0642\u0637\u0629?|\u0646\u0642\u0637)\s*\)/i;
  const parenthesizedNumRegex = /^(\s*(?:\d+|[a-zA-Z])[.)]\s*)\(([\d.,]+)\)/;

  const rows = [];
  mergedLines.forEach((line, idx) => {
    let cleanLine = line.trim();
    if (!cleanLine) return;

    let pointsStr = '';
    const match = cleanLine.match(pointsRegex);
    if (match) {
      pointsStr = match[0];
      cleanLine = cleanLine.replace(pointsRegex, '').replace(/\s{2,}/g, ' ').trim();
    } else {
      const pMatch = cleanLine.match(parenthesizedNumRegex);
      if (pMatch) {
        const prefix = pMatch[1];
        const val = pMatch[2];
        const ptsWord = isArabicMode ? 'ن' : 'pts';
        pointsStr = `(${val} ${ptsWord})`;
        cleanLine = cleanLine.replace(parenthesizedNumRegex, prefix).trim();
      }
    }

    if (!cleanLine) return;

    let displayPoints = pointsStr;
    if (displayPoints.startsWith('(') && displayPoints.endsWith(')')) {
      displayPoints = displayPoints.slice(1, -1);
    }

    rows.push(
      <div key={idx} className="homework-row">
        <div className="homework-bareme-cell" style={{ position: 'relative' }}>
          <input
            type="text"
            className="homework-bareme-input no-print"
            value={displayPoints}
            onChange={(e) => onPointsChange(secId, idx, e.target.value)}
            placeholder="..."
            style={{
              width: '100%',
              border: 'none',
              background: 'transparent',
              textAlign: 'center',
              fontWeight: 700,
              fontSize: '0.9rem',
              color: '#005086',
              outline: 'none',
              padding: '0.15rem'
            }}
          />
          <span className="print-only" style={{ fontWeight: 700, fontSize: '0.9rem' }}>{pointsStr}</span>
        </div>
        <div className="homework-content-cell" style={isArabicMode ? { textAlign: 'right', direction: 'rtl', fontFamily: arabicFont } : {}}>
          {renderWithMath(cleanLine)}
        </div>
      </div>
    );
  });

  return rows;
};

/* ── Calculate total points for Devoir Surveillé homework ── */
const calculateTotalPoints = (text, isArabicMode) => {
  if (!text) return isArabicMode ? '0 ن' : '0 pts';

  let rawText = String(text)
    .replace(/\\n(?![a-zA-Z])/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const lines = rawText.split('\n');
  let total = 0;

  const pointsRegex = /\(\s*([\d.,]+)\s*(?:pts?|points?|\u0646|\u0646\u0642\u0637\u0629?|\u0646\u0642\u0637)\s*\)/i;
  const parenthesizedNumRegex = /^(\s*(?:\d+|[a-zA-Z])[.)]\s*)\(([\d.,]+)\)/;

  lines.forEach(line => {
    const cleanLine = line.trim();
    if (!cleanLine) return;

    const match = cleanLine.match(pointsRegex);
    if (match) {
      const val = parseFloat(match[1].replace(',', '.'));
      if (!isNaN(val)) total += val;
    } else {
      const pMatch = cleanLine.match(parenthesizedNumRegex);
      if (pMatch) {
        const val = parseFloat(pMatch[2].replace(',', '.'));
        if (!isNaN(val)) total += val;
      }
    }
  });

  const totalStr = String(total).replace('.', ',');
  const ptsWord = isArabicMode ? 'ن' : (total > 1 ? 'pts' : 'pt');
  return `${totalStr} ${ptsWord}`;
};




export default function LessonViewerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading, profName, profPhone, trackDownload } = useAuth();

  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  
  // Ref to the printable content area
  const sheetRef = useRef(null);
  
  // Interactive UI Style Toggle: 'interactive' (Modern UI) or 'classic' (Worksheet Paper UI)
  const [uiStyle, setUiStyle] = useState('interactive');
  
  // Active Tab for Interactive Mode
  const [activeTab, setActiveTab] = useState('theory'); // 'theory' or 'exercises'
  
  // Solutions visibility states (section ID -> boolean)
  const [visibleSolutions, setVisibleSolutions] = useState({});
  
  // Interactive student answers states (sectionID-questionIdx -> string)
  const [studentAnswers, setStudentAnswers] = useState({});
  const [checkResults, setCheckResults] = useState({}); // key -> 'success' | 'error'
  const [includeSolutionsInPdf, setIncludeSolutionsInPdf] = useState(true);

  if (!authLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  useEffect(() => {
    const fetchLesson = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getLessonById(id);
        if (!data) {
          setError("Ce cours n'existe pas ou a été supprimé.");
        } else {
          setLesson(data);
          // Initialise solutions visibility
          const initialSols = {};
          data.content.sections?.forEach(sec => {
            if (sec.type === 'exercise') {
              initialSols[sec.id] = false;
            }
          });
          setVisibleSolutions(initialSols);
        }
      } catch (err) {
        console.error(err);
        setError("Erreur lors de la récupération de la fiche de cours.");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchLesson();
  }, [id]);

  const handlePointsChange = (secId, lineIdx, newPoints) => {
    setLesson(prev => {
      if (!prev) return prev;
      const isArabicMode = prev.content?.metadata?.language === 'ar';
      const updatedSections = prev.content.sections.map(sec => {
        if (sec.id !== secId) return sec;

        let rawText = String(sec.content)
          .replace(/\\n(?![a-zA-Z])/g, '\n')
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n');

        const lines = rawText.split('\n');
        
        const mergedToOriginalMap = [];
        const mergedLines = [];
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (/^(\*\*)?([a-zA-Z]|\d+)[.)](\*\*)?$/.test(line) && i + 1 < lines.length) {
            let nextNonEmptyIdx = i + 1;
            while (nextNonEmptyIdx < lines.length && lines[nextNonEmptyIdx].trim() === '') {
              nextNonEmptyIdx++;
            }
            if (nextNonEmptyIdx < lines.length) {
              mergedToOriginalMap.push({ start: i, end: nextNonEmptyIdx });
              mergedLines.push(line + ' ' + lines[nextNonEmptyIdx].trim());
              i = nextNonEmptyIdx;
              continue;
            }
          }
          mergedToOriginalMap.push({ start: i, end: i });
          mergedLines.push(lines[i]);
        }

        const mapEntry = mergedToOriginalMap[lineIdx];
        if (!mapEntry) return sec;

        const targetOriginalLineIdx = mapEntry.start;
        let originalLine = lines[targetOriginalLineIdx];

        const pointsRegex = /\(\s*([\d.,]+)\s*(?:pts?|points?|\u0646|\u0646\u0642\u0637\u0629?|\u0646\u0642\u0637)\s*\)/i;
        const parenthesizedNumRegex = /^(\s*(?:\d+|[a-zA-Z])[.)]\s*)\(([\d.,]+)\)/;

        let pointsToInsert = newPoints.trim();
        if (pointsToInsert && !pointsToInsert.startsWith('(')) {
          const ptsWord = isArabicMode ? 'ن' : 'pts';
          pointsToInsert = `(${pointsToInsert} ${ptsWord})`;
        }

        if (originalLine.match(pointsRegex)) {
          if (pointsToInsert) {
            originalLine = originalLine.replace(pointsRegex, pointsToInsert);
          } else {
            originalLine = originalLine.replace(pointsRegex, '').trim();
          }
        } else {
          const listPrefixRegex = /^(\s*(?:\d+|[a-zA-Z])[.)]\s*)/;
          const prefixMatch = originalLine.match(listPrefixRegex);
          if (prefixMatch && pointsToInsert) {
            const prefix = prefixMatch[1];
            originalLine = originalLine.replace(listPrefixRegex, `${prefix}${pointsToInsert} `);
          } else if (pointsToInsert) {
            originalLine = `${pointsToInsert} ${originalLine}`;
          }
        }

        lines[targetOriginalLineIdx] = originalLine;
        
        if (mapEntry.start !== mapEntry.end) {
          lines[mapEntry.end] = ''; 
        }

        return {
          ...sec,
          content: lines.join('\n')
        };
      });

      return {
        ...prev,
        content: {
          ...prev.content,
          sections: updatedSections
        }
      };
    });
  };

  const toggleSolution = (secId) => {
    setVisibleSolutions(prev => ({ ...prev, [secId]: !prev[secId] }));
  };

  const handleCheckAnswer = (secId, qIdx, expectedAnswer) => {
    const key = `${secId}-${qIdx}`;
    const userAns = (studentAnswers[key] || '').trim().toLowerCase();
    const expected = expectedAnswer.trim().toLowerCase();

    // Flexible checking: match exact or close matches (e.g. "oui" vs "yes", numbers)
    const isCorrect = userAns === expected;
    setCheckResults(prev => ({ ...prev, [key]: isCorrect ? 'success' : 'error' }));
  };

  /**
   * PDF Export: Opens a standalone, properly formatted HTML document
   * in a new window for clean print/save-as-PDF.
   */
  const handleExportPDF = () => {
    if (isExporting || !lesson) return;
    setIsExporting(true);
    try {
      if (typeof trackDownload === 'function') {
        trackDownload({ type: 'lesson', id: lesson.id, title: lesson.content?.header?.fiche_title || lesson.title || 'Fiche de Cours' });
      }
      openLessonPrintWindow(lesson, { showSolutions: includeSolutionsInPdf });
    } catch (err) {
      console.error('[PDF Export] Error:', err);
      alert('Erreur lors de la génération du PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ width: 50, height: 50, borderRadius: '50%', border: '3px solid rgba(99,102,241,0.1)', borderTop: '3px solid var(--violet)', animation: 'spinViewer 1s linear infinite' }} />
        <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Chargement de la fiche de cours...</p>
        <style>{`
          @keyframes spinViewer {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '2rem', textAlign: 'center' }}>
        <AlertCircle size={48} className="text-danger" style={{ marginBottom: '1rem' }} />
        <h2 style={{ color: 'var(--text-main)', fontWeight: 800 }}>Erreur de chargement</h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: '400px', marginBottom: '1.5rem' }}>{error || "Une erreur inconnue est survenue."}</p>
        <button onClick={() => navigate(user?.role === 'admin' ? '/admin/lessons' : '/levels')} className="btn">Retour aux fiches</button>
      </div>
    );
  }

  const { content } = lesson;
  const { header, sections } = content;
  const theorySections = sections?.filter(s => s.type === 'content') || [];
  const exerciseSections = sections?.filter(s => s.type === 'exercise') || [];

  // دعم RTL للنسخ المترجمة للعربية
  const checkArabicText = () => {
    if (content?.metadata?.language === 'ar') return true;
    const textToTest = [
      lesson.title,
      lesson.subject,
      header?.fiche_title,
      header?.subject,
      ...(sections || []).map(s => s.title)
    ].filter(Boolean).join(' ');
    return /[\u0600-\u06FF]/.test(textToTest);
  };
  const isArabic = checkArabicText();
  const lessonDir = isArabic ? 'rtl' : 'ltr';
  const arabicFont = isArabic ? "'UKIJMerdaneRegular', 'Cairo', 'Amiri', 'Noto Naskh Arabic', Arial, sans-serif" : 'inherit';

  return (
    <div className={`lesson-viewer-container ${uiStyle === 'classic' ? 'classic-view-active' : ''}`} style={{
      minHeight: '100vh',
      padding: '1.5rem 0',
      maxWidth: '1200px',
      margin: '0 auto',
      position: 'relative'
    }}>
      <style>{`
        /* PDF Export Styling overrides to make fonts larger and reduce gaps */
        .exporting-pdf .sheet-body {
          padding: 1.5rem !important;
          gap: 1.2rem !important;
          font-size: 1.25rem !important; /* Larger font size */
        }
        
        .exporting-pdf .sheet-header-banner {
          font-size: 1.8rem !important;
          margin: 0 auto 1.2rem !important;
          padding: 0.5rem 2rem !important;
        }

        .exporting-pdf .subsection-card {
          padding: 1.2rem !important;
          gap: 0.8rem !important;
          border-radius: 8px !important;
        }

        .exporting-pdf .section-header-row {
          margin-top: 0.8rem !important;
          margin-bottom: 0.6rem !important;
          padding-bottom: 0.4rem !important;
        }

        .exporting-pdf .bullet-item {
          margin-bottom: 0.4rem !important;
          line-height: 1.5 !important;
        }

        .exporting-pdf .classic-highlight-box {
          padding: 0.8rem !important;
          margin: 0.3rem 0 !important;
        }

        .exporting-pdf .notation-grid {
          gap: 1rem !important;
          margin: 0.5rem 0 !important;
          padding: 0.5rem !important;
        }

        .exporting-pdf .notation-column {
          gap: 0.3rem !important;
          padding-left: 0.75rem !important;
        }

        .exporting-pdf .sheet-table {
          font-size: 1.1rem !important; /* Larger table font size */
          margin-top: 0.4rem !important;
        }

        .exporting-pdf .sheet-table th, .exporting-pdf .sheet-table td {
          padding: 0.6rem 0.8rem !important;
        }

        .exporting-pdf .exercise-wrapper {
          gap: 0.6rem !important;
        }

        .exporting-pdf .exercise-body-box {
          padding: 1rem !important;
          line-height: 1.6 !important;
        }

        .exporting-pdf .solution-block {
          padding: 1.2rem !important;
          margin-top: 0.5rem !important;
        }
        
        .exporting-pdf .katex {
          font-size: 0.98em !important; /* Match surrounding text size exactly in PDF export */
        }

        .sheet-body .katex {
          font-size: 0.98em !important; /* Match surrounding text size exactly in sheet body */
        }


        /* Loader spin animation */
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* ══ RTL — Arabic Lesson Support ═══════════════════════════════════ */
         .sheet-body[dir="rtl"] {
          font-family: 'UKIJMerdaneRegular', 'Cairo', 'Amiri', 'Noto Naskh Arabic', Arial, sans-serif !important;
          text-align: right;
        }

        /* All rendered text spans in RTL */
        .sheet-body[dir="rtl"] span[style*="display: block"],
        .sheet-body[dir="rtl"] span[style*="display:block"] {
          text-align: right;
          direction: rtl;
          font-family: 'UKIJMerdaneRegular', 'Cairo', 'Amiri', Arial, sans-serif;
        }

        /* Bullet and numbered lists — keep normal row flex direction so numbers are on the right */
        .sheet-body[dir="rtl"] .list-item-row {
          flex-direction: row !important;
          text-align: right;
        }

        /* Number/bullet dot — flip margin, keep LTR for correct '1.' rendering */
        .sheet-body[dir="rtl"] .list-item-row .list-num {
          direction: ltr;
          text-align: center;
          unicode-bidi: embed;
          margin-right: 0;
          margin-left: 0.4rem;
        }

        /* Content span inside list — force RTL */
        .sheet-body[dir="rtl"] .list-item-row .list-content {
          text-align: right !important;
          direction: rtl;
        }

        /* Headings in RTL */
        .sheet-body[dir="rtl"] div[style*="fontWeight: 800"],
        .sheet-body[dir="rtl"] div[style*="font-weight: 800"],
        .sheet-body[dir="rtl"] div[style*="font-weight: 900"] {
          text-align: right;
          direction: rtl;
          font-family: 'UKIJMerdaneRegular', 'Cairo', 'Amiri', Arial, sans-serif;
        }

        /* Response / Attention callout blocks in RTL */
        .sheet-body[dir="rtl"] .mfc-callout-response,
        .sheet-body[dir="rtl"] .mfc-callout-attention {
          border-left: none !important;
          border-right: 4px solid var(--emerald) !important;
          direction: rtl;
          text-align: right;
          font-family: 'UKIJMerdaneRegular', 'Cairo', 'Amiri', Arial, sans-serif;
        }
        .sheet-body[dir="rtl"] .mfc-callout-attention {
          border-right-color: var(--warning) !important;
        }

        /* KaTeX stays LTR always — math direction is always LTR */
        .sheet-body[dir="rtl"] .katex,
        .sheet-body[dir="rtl"] .katex-display {
          direction: ltr !important;
          text-align: center;
        }
        .sheet-body[dir="rtl"] .inline-math-container {
          direction: ltr;
          unicode-bidi: embed;
          display: inline-block;
        }

        /* ═══════════════════════════════════════
           HOMEWORK EXAM LAYOUT (Devoir Surveillé)
           ═══════════════════════════════════════ */
        .homework-table {
          width: 100%;
          border-collapse: collapse;
          border: 1.5px solid #005086;
          border-radius: 6px;
          overflow: hidden;
          margin-bottom: 0.65rem;
          box-shadow: 0 4px 12px rgba(0,0,0,0.02);
          background: var(--bg-card);
          display: flex;
          flex-direction: column;
        }
        .homework-header-row {
          display: flex;
          background: #005086;
          color: #ffffff;
          font-weight: 800;
          border-bottom: 2px solid #005086;
          align-items: stretch;
        }
        .homework-row {
          display: flex;
          border-bottom: 1px solid var(--border);
          align-items: stretch;
        }
        .homework-row:last-child {
          border-bottom: none;
        }
        .homework-bareme-cell, .homework-bareme-header {
          width: 55px;
          flex-shrink: 0;
          padding: 0.35rem 0.2rem;
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.85rem;
          font-weight: 700;
        }
         .homework-bareme-header {
           background: rgba(255, 255, 255, 0.12);
           color: #ffffff;
           border-right: 2px solid #ffffff;
         }
        .homework-bareme-cell {
          background: rgba(0, 80, 134, 0.02);
          color: var(--text-muted);
          border-right: 2px solid #005086;
          font-family: inherit;
        }
        .homework-content-cell, .homework-content-header {
          flex: 1;
          padding: 0.4rem 0.75rem;
        }
        .homework-content-header {
          font-size: 1.05rem;
          display: flex;
          align-items: center;
          font-weight: 800;
        }
        /* RTL support for homework table */
        .sheet-body[dir="rtl"] .homework-header-row,
        .sheet-body[dir="rtl"] .homework-row {
          flex-direction: row-reverse;
        }
        .sheet-body[dir="rtl"] .homework-bareme-cell {
          border-right: none;
          border-left: 2px solid #005086;
        }
        .sheet-body[dir="rtl"] .homework-bareme-header {
          border-right: none;
          border-left: 2px solid #ffffff;
        }



        /* Styles scoped specifically for this page sheet */
        .sheet-container {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          display: flex;
          flex-direction: column;
          min-height: 80vh;
          box-shadow: var(--shadow-card);
          overflow: hidden;
          transition: all 0.3s ease;
        }
        
        .classic-view-active .sheet-container {
          background: #ffffff !important;
          border: 2px solid #005086 !important;
          border-radius: 12px !important;
          color: #1a202c !important;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08) !important;
        }

        /* Worksheet Body */
        .sheet-body {
          flex: 1;
          padding: 2.5rem;
          display: flex;
          flex-direction: column;
          gap: 2rem;
          overflow-y: auto;
          transition: all 0.3s ease;
        }

        .sections-list-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
        }

        @media (min-width: 768px) {
          .exercises-two-columns-layout {
            display: block !important;
            column-count: 2 !important;
            column-gap: 1.5rem !important;
            column-rule: 1px solid var(--border) !important;
            width: 100% !important;
          }
          .classic-view-active .exercises-two-columns-layout {
            column-rule: 1px solid rgba(0, 80, 134, 0.2) !important;
          }
          .exercises-two-columns-layout > * {
            break-inside: avoid-column !important;
            page-break-inside: avoid !important;
            margin-bottom: 1rem !important;
          }
          
          /* Prevent math formulas from overflowing two-column layouts */
          .exercises-two-columns-layout .katex-display {
            max-width: 100% !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            font-size: 0.85em !important;
          }
          .exercises-two-columns-layout .katex,
          .exercises-two-columns-layout .katex-html {
            white-space: normal !important;
            display: inline !important;
          }
          .exercises-two-columns-layout .katex .base {
            white-space: nowrap !important;
            display: inline-block !important;
            margin-top: 2px;
            margin-bottom: 2px;
          }
        }
        
        .classic-view-active .sheet-body {
          background: #ffffff !important;
          color: #1a202c !important;
          font-family: 'Times New Roman', Times, serif !important;
        }

        /* Force all text to dark in classic mode */
        .classic-view-active *:not(.sheet-header-banner):not(.section-badge-circle):not(.exercise-pill):not(.section-title-pill):not(.accent-green-text):not(.solution-link-btn) {
          color: #1a202c !important;
        }
        /* Restore intentional colors */
        .classic-view-active .sheet-header-banner { color: #ffffff !important; }
        .classic-view-active .section-badge-circle { color: #ffffff !important; }
        .classic-view-active .exercise-pill { color: #ffffff !important; }
        .classic-view-active .section-title-pill { color: #005086 !important; }
        .classic-view-active .accent-green-text { color: #009688 !important; }
        .classic-view-active .solution-link-btn { color: #b91c1c !important; }

        /* Sheet top header */
        .sheet-header-banner {
          background: linear-gradient(135deg, #005086, #007cc6);
          border-radius: 99px;
          padding: 0.75rem 2.5rem;
          color: #ffffff;
          display: inline-flex;
          align-self: center;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 1.6rem;
          box-shadow: 0 4px 15px rgba(0, 80, 134, 0.2);
          letter-spacing: 0.02em;
          border: 2px solid rgba(255, 255, 255, 0.1);
        }
        
        .classic-view-active .sheet-header-banner {
          background: #005086 !important;
          border: none !important;
          box-shadow: none !important;
          border-radius: 20px !important;
          padding: 0.6rem 3rem !important;
        }

        /* Section badges */
        .section-badge-circle {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #005086;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 0.95rem;
          flex-shrink: 0;
          box-shadow: 0 2px 5px rgba(0, 80, 134, 0.25);
        }
        
        .section-header-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          border-bottom: 2px solid rgba(0, 80, 134, 0.1);
          padding-bottom: 0.5rem;
          margin-bottom: 1rem;
        }
        
        .section-title-pill {
          font-size: 1.15rem;
          font-weight: 800;
          color: #005086;
          border: 1px solid rgba(0, 80, 134, 0.3);
          border-radius: 99px;
          padding: 0.25rem 1.25rem;
          display: inline-flex;
          background: rgba(0, 80, 134, 0.02);
        }
        
        .classic-view-active .section-title-pill {
          border: 1.5px solid #005086 !important;
          background: none !important;
          color: #005086 !important;
        }

        /* Subsection boxes */
        .subsection-card {
          border: 1.5px solid #005086;
          border-radius: 12px;
          padding: 1.5rem;
          background: rgba(0, 80, 134, 0.01);
          display: flex;
          flex-direction: column;
          gap: 1rem;
          transition: all 0.3s ease;
        }
        
        .classic-view-active .subsection-card {
          border: 1.5px solid #005086 !important;
          background: #ffffff !important;
          border-radius: 8px !important;
          box-shadow: none !important;
        }
        
        .subsection-header-inline {
          font-size: 1.05rem;
          font-weight: 800;
          color: #2d3748;
          border-bottom: 1px dashed rgba(0, 80, 134, 0.25);
          padding-bottom: 0.5rem;
          margin-bottom: 0.5rem;
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        
        .classic-view-active .subsection-header-inline {
          color: #1a202c !important;
        }
        
        .accent-green-text {
          color: #10B981;
          font-weight: 800;
        }
        
        .classic-view-active .accent-green-text {
          color: #009688 !important; /* Muted corporate green from the original print */
        }

        /* Classic style bullet points */
        .bullet-item {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          line-height: 1.6;
          margin-bottom: 0.5rem;
        }
        
        .bullet-dot {
          color: #005086;
          font-size: 1.2rem;
          line-height: 1;
          margin-top: -0.1rem;
        }

        /* Columns for Notations */
        .notation-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          margin: 0.75rem 0;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 8px;
        }
        
        .classic-view-active .notation-grid {
          background: #f8fafc !important;
          border: 1px solid rgba(0,80,134,0.1) !important;
        }
        
        @media (max-width: 640px) {
          .notation-grid {
            grid-template-columns: 1fr;
            gap: 1rem;
          }
        }
        
        .notation-column {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          border-left: 2px solid rgba(0, 80, 134, 0.15);
          padding-left: 1rem;
        }
        
        .classic-view-active .notation-column {
          border-left-color: #005086 !important;
        }

        /* Worksheet Math Table */
        .sheet-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 0.5rem;
          overflow: hidden;
          border-radius: 8px;
          border: 1px solid rgba(0, 80, 134, 0.2);
          font-size: 0.9rem;
        }
        
        .classic-view-active .sheet-table {
          border: 1.5px solid #1a202c !important;
        }
        
        .sheet-table th, .sheet-table td {
          border: 1px solid rgba(0, 80, 134, 0.2);
          padding: 0.75rem 1rem;
          text-align: center;
        }
        
        .classic-view-active .sheet-table th, 
        .classic-view-active .sheet-table td {
          border: 1.5px solid #1a202c !important;
          color: #1a202c !important;
        }
        
        .sheet-table th {
          background: rgba(0, 80, 134, 0.05);
          font-weight: 800;
          color: #005086;
        }
        
        .classic-view-active .sheet-table th {
          background: #f7fafc !important;
          color: #005086 !important;
        }

        /* Exercises design */
        .exercise-wrapper {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        
        .exercise-banner-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        /* RTL: pill group moves to the right, solution button to the left */
        .sheet-body[dir="rtl"] .exercise-banner-row {
          flex-direction: row !important;
        }
        
        .exercise-pill {
          background: #005086;
          color: #ffffff;
          padding: 0.35rem 1.25rem;
          border-radius: 99px;
          font-weight: 800;
          font-size: 0.9rem;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          box-shadow: 0 2px 4px rgba(0, 80, 134, 0.15);
        }
        
        .solution-link-btn {
          background: none;
          border: none;
          color: #b91c1c; /* Maroon/reddish */
          cursor: pointer;
          font-weight: 700;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          gap: 0.25rem;
          text-decoration: underline;
          transition: all 0.2s;
        }
        
        .solution-link-btn:hover {
          color: #ef4444;
          transform: translateX(2px);
        }
        
        .exercise-body-box {
          border-left: 4px solid #005086;
          background: rgba(0, 80, 134, 0.02);
          border-top: 1px solid rgba(0, 80, 134, 0.1);
          border-right: 1px solid rgba(0, 80, 134, 0.1);
          border-bottom: 1px solid rgba(0, 80, 134, 0.1);
          border-radius: 4px 8px 8px 4px;
          padding: 1.25rem;
          line-height: 1.7;
          transition: all 0.3s ease;
        }
        
        .classic-view-active .exercise-body-box {
          background: #ffffff !important;
          border: 1.5px solid #005086 !important;
          border-left: 5px solid #005086 !important;
          border-radius: 4px !important;
        }
        
        /* Interactive features */
        .interactive-form {
          margin-top: 1rem;
          padding: 1rem;
          background: var(--bg-glass);
          border: 1px dashed var(--border);
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        
        .classic-view-active .interactive-form {
          border: 1px dashed #cbd5e1 !important;
          background: #f8fafc !important;
        }

        .print-only {
          display: none !important;
        }

        /* ── Print / PDF Export styles ── */
        @media print {
          .print-only {
            display: inline !important;
          }
          /* Page setup */
          @page {
            size: A4 portrait;
            margin: 15mm 12mm 15mm 12mm;
          }

          /* ── Override dark-mode CSS variables: target body directly ── */
          /* :root has same specificity as the dark theme :root so target body instead */
          html, body, body * {
            --text-main: #1a202c;
            --text-muted: #4a5568;
            --bg-card: #ffffff;
            --bg-glass: #f8fafc;
            --bg-base: #ffffff;
            --border: rgba(0,80,134,0.2);
            --violet: #4F46E5;
            --violet-soft: rgba(79,70,229,0.08);
            --emerald: #059669;
            --emerald-soft: rgba(5,150,105,0.08);
            --warning: #d97706;
            --danger: #dc2626;
            --shadow-card: none;
          }

          /* Root resets */
          html, body {
            background: #ffffff !important;
            color: #1a202c !important;
            font-family: 'Segoe UI', Arial, sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide everything that should not print */
          .no-print,
          nav, aside,
          .interactive-form {
            display: none !important;
          }

          /* Show print-only header */
          .print-only-header {
            display: grid !important;
          }

          /* Always show solutions in print */
          .solution-block {
            display: block !important;
            margin-top: 0.75rem !important;
            break-inside: avoid !important;
          }
          .hide-solutions-print .solution-block {
            display: none !important;
          }

          /* Page container */
          .lesson-viewer-container {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }

          /* Remove card box-shadow and border for print */
          .sheet-container {
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: #ffffff !important;
            color: #1a202c !important;
            overflow: visible !important;
            min-height: auto !important;
          }

          /* Sheet body — critical: remove overflow:auto so full content prints */
          .sheet-body {
            padding: 1rem 0 !important;
            background: #ffffff !important;
            color: #1a202c !important;
            gap: 1.25rem !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
          }

          .exercises-two-columns-layout {
            display: block !important;
            column-count: 2 !important;
            column-gap: 1.5rem !important;
            column-rule: 1px solid rgba(0, 80, 134, 0.2) !important;
            width: 100% !important;
          }
          .exercises-two-columns-layout > * {
            break-inside: avoid-column !important;
            page-break-inside: avoid !important;
            margin-bottom: 1rem !important;
          }
          
          /* Prevent math formulas from overflowing two-column layouts in print */
          .exercises-two-columns-layout .katex-display {
            max-width: 100% !important;
            overflow-x: visible !important;
            overflow-y: visible !important;
            font-size: 0.82em !important;
          }
          .exercises-two-columns-layout .katex,
          .exercises-two-columns-layout .katex-html {
            white-space: normal !important;
            display: inline !important;
          }
          .exercises-two-columns-layout .katex .base {
            white-space: nowrap !important;
            display: inline-block !important;
            margin-top: 2px;
            margin-bottom: 2px;
          }

          /* Force ALL text elements inside sheet-body to dark color */
          .sheet-body,
          .sheet-body span,
          .sheet-body div,
          .sheet-body p,
          .sheet-body li,
          .sheet-body h1,
          .sheet-body h2,
          .sheet-body h3,
          .sheet-body h4,
          .sheet-body strong,
          .sheet-body em {
            color: #1a202c !important;
          }

          /* Blue gradient banner - keep it */
          .sheet-header-banner {
            background: #005086 !important;
            color: #ffffff !important;
            border-radius: 20px !important;
            padding: 0.5rem 2.5rem !important;
            font-size: 1.25rem !important;
            box-shadow: none !important;
            border: none !important;
          }

          /* Section header row */
          .section-header-row {
            border-bottom: 2px solid rgba(0,80,134,0.15) !important;
          }

          /* Section number badge */
          .section-badge-circle {
            background: #005086 !important;
            color: #ffffff !important;
            box-shadow: none !important;
          }

          /* Section title pill */
          .section-title-pill {
            color: #005086 !important;
            border-color: rgba(0,80,134,0.4) !important;
            background: rgba(0,80,134,0.04) !important;
            font-size: 1rem !important;
          }

          /* Subsection card */
          .subsection-card {
            border: 1.5px solid #005086 !important;
            background: #ffffff !important;
            border-radius: 8px !important;
            color: #1a202c !important;
            break-inside: avoid !important;
          }

          /* Subsection inline header */
          .subsection-header-inline {
            color: #1a202c !important;
          }

          /* Green accent */
          .accent-green-text { color: #009688 !important; }

          /* Bullet items */
          .bullet-dot { color: #005086 !important; }

          /* Notation grid */
          .notation-grid {
            background: #f8fafc !important;
            border: 1px solid rgba(0,80,134,0.1) !important;
          }
          .notation-column {
            border-left-color: rgba(0,80,134,0.3) !important;
          }

          /* Tables */
          .sheet-table {
            border: 1.5px solid #005086 !important;
          }
          .sheet-table th, .sheet-table td {
            border: 1px solid rgba(0,80,134,0.25) !important;
            color: #1a202c !important;
          }
          .sheet-table th {
            background: rgba(0,80,134,0.06) !important;
            color: #005086 !important;
          }

          /* Exercises */
          .exercise-wrapper { break-inside: avoid !important; }
          .exercise-pill {
            background: #005086 !important;
            color: #ffffff !important;
          }
          .exercise-body-box {
            background: rgba(0,80,134,0.02) !important;
            border: 1px solid rgba(0,80,134,0.15) !important;
            border-left: 4px solid #005086 !important;
            color: #1a202c !important;
          }

          /* Solution block in print */
          .solution-block h4 { color: #059669 !important; }

          /* Classic highlight box */
          .classic-highlight-box {
            background: rgba(0,80,134,0.04) !important;
            border: 1.5px solid #005086 !important;
            color: #1a202c !important;
          }

          /* KaTeX math — always dark on white */
          .katex, .katex * { color: #1a202c !important; }
          .katex { font-size: 0.98em !important; }

          /* Response/attention callouts */
          .mfc-callout-response {
            background: rgba(16,185,129,0.06) !important;
            border-left-color: #009688 !important;
          }
          .mfc-callout-attention {
            background: rgba(245,158,11,0.06) !important;
          }

          /* Markdown headings rendered by renderWithMath */
          .sheet-body div[style*='#005086'] { color: #005086 !important; }
        }
      `}</style>

      {/* ── Action Header (No Print) ── */}
      <div className="no-print" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <button 
          onClick={() => navigate(user?.role === 'admin' ? '/admin/lessons' : '/levels')}
          className="btn-outline"
          style={{ 
            padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 800, 
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem' 
          }}
        >
          <ArrowLeft size={16} /> Retour aux fiches
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* View Mode Switcher */}
          <div className="glass-panel" style={{
            padding: '0.25rem',
            borderRadius: '99px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.1rem',
            margin: 0,
            border: '1px solid var(--border)'
          }}>
            <button 
              onClick={() => setUiStyle('interactive')}
              style={{
                background: uiStyle === 'interactive' ? 'var(--violet)' : 'transparent',
                color: uiStyle === 'interactive' ? '#ffffff' : 'var(--text-muted)',
                border: 'none',
                padding: '0.4rem 0.85rem',
                borderRadius: '99px',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              🚀 Mode Interactif
            </button>
            <button 
              onClick={() => setUiStyle('classic')}
              style={{
                background: uiStyle === 'classic' ? '#005086' : 'transparent',
                color: uiStyle === 'classic' ? '#ffffff' : 'var(--text-muted)',
                border: 'none',
                padding: '0.4rem 0.85rem',
                borderRadius: '99px',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              📄 Style Papier
            </button>
          </div>

          {/* Solutions Print Option Toggle */}
          <label style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
            userSelect: 'none',
            color: 'var(--text-main)',
            marginRight: '0.25rem',
            background: 'var(--bg-glass)',
            border: '1px solid var(--border)',
            padding: '0.4rem 0.85rem',
            borderRadius: '99px',
            transition: 'all 0.2s'
          }}>
            <input 
              type="checkbox"
              checked={includeSolutionsInPdf}
              onChange={(e) => setIncludeSolutionsInPdf(e.target.checked)}
              style={{
                width: '14px',
                height: '14px',
                accentColor: 'var(--violet)',
                cursor: 'pointer',
                margin: 0
              }}
            />
            <span>Imprimer les réponses</span>
          </label>

          {/* PDF Download button */}
          <button 
            onClick={handleExportPDF}
            disabled={isExporting}
            className="btn"
            style={{
              padding: '0.5rem 1.1rem',
              fontSize: '0.85rem',
              fontWeight: 800,
              background: isExporting
                ? 'linear-gradient(135deg, #4a6a85, #5a8aab)'
                : 'linear-gradient(135deg, #005086, #007cc6)',
              opacity: isExporting ? 0.8 : 1,
              cursor: isExporting ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            {isExporting
              ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Génération...</>
              : <><Download size={16} /> Télécharger PDF</>}
          </button>

          {/* Edit button */}
          {user?.role === 'admin' && (
            <button 
              onClick={() => navigate(`/admin/lessons/${id}/edit`)}
              className="btn-outline"
              style={{
                padding: '0.5rem 1.1rem',
                fontSize: '0.85rem',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                border: '1px solid var(--border)'
              }}
            >
              <Edit size={16} /> Modifier
            </button>
          )}
        </div>
      </div>

      {/* ── MAIN WORKsheet CONTAINER — ref used by html2canvas PDF export ── */}
      <div ref={sheetRef} className={`sheet-container ${includeSolutionsInPdf ? '' : 'hide-solutions-print'}`}>
        
        {/* Print-only header row (3 columns) — hidden on screen, shows on print */}
        <header className="print-only-header" style={{
          display: 'none',
          gridTemplateColumns: '1fr 1.5fr 1fr',
          borderBottom: '2px solid #005086',
          marginBottom: '1.5rem',
          paddingBottom: '0.75rem',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', fontSize: '0.75rem', color: '#1a202c', fontWeight: 700 }}>
            <span>{header.prep_title}</span>
            <span style={{ color: '#005086' }}>{header.schools?.join(' - ')}</span>
          </div>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.15rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{header.subject}</span>
            <span style={{ fontWeight: 900, fontSize: '1rem', color: '#b91c1c', textDecoration: 'underline' }}>{renderWithMath(header.fiche_title)}</span>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#1a202c', fontWeight: 700, display: 'flex', flexDirection: 'column', gap: '0.1rem', alignItems: 'flex-end' }}>
            <span>{header.teacher || profName}</span>
            {(header.phone || profPhone) && <span style={{ color: '#4b5563' }}>{header.phone || profPhone}</span>}
          </div>
        </header>

        {/* Screen-only header: interactive mode top bar or classic paper header */}
        {uiStyle === 'classic' ? (
          <div className="paper-header" style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.5fr 1fr',
            borderBottom: '2px solid #005086',
            textAlign: 'center',
            background: '#ffffff'
          }}>
            <div className="paper-header-cell" style={{ padding: '1rem', borderRight: '1.5px solid #005086', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '0.25rem', color: '#111827', fontSize: '0.8rem', fontWeight: 'bold' }}>
              <div>{header.prep_title}</div>
              <div style={{ color: '#005086' }}>{header.schools?.join(' - ')}</div>
            </div>
            <div className="paper-header-cell" style={{ padding: '1rem', borderRight: '1.5px solid #005086', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '0.25rem', color: '#111827' }}>
              <div style={{ fontSize: '0.9rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {header.subject}
              </div>
              <div className="paper-header-title" style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#005086' }}>
                <span className="paper-header-title-underline" style={{ color: '#b91c1c', textDecoration: 'underline', fontWeight: 900 }}>{renderWithMath(header.fiche_title)}</span>
              </div>
            </div>
            <div className="paper-header-cell" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '0.25rem', color: '#111827', fontSize: '0.8rem', fontWeight: 'bold' }}>
              <div>{header.teacher || profName}</div>
              {(header.phone || profPhone) && <div style={{ color: '#4b5563' }}>{header.phone || profPhone}</div>}
            </div>
          </div>
        ) : (
          <div className="no-print" style={{
            padding: '2rem 2.5rem 1rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <span style={{
                background: 'var(--violet-soft)',
                color: 'var(--violet)',
                padding: '0.2rem 0.65rem',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'inline-block',
                marginBottom: '0.5rem'
              }}>
                {header.subject}
              </span>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                {renderWithMath(header.fiche_title)}
              </h1>
            </div>
            
            {/* Meta badges */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {(header.teacher || profName) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'var(--bg-glass)', border: '1px solid var(--border)', padding: '0.3rem 0.75rem', borderRadius: '8px' }}>
                  <User size={14} />
                  <span>{header.teacher || profName}</span>
                </div>
              )}
              {(header.phone || profPhone) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'var(--bg-glass)', border: '1px solid var(--border)', padding: '0.3rem 0.75rem', borderRadius: '8px' }}>
                  <Phone size={14} />
                  <span>{header.phone || profPhone}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* WORKBOOK MAIN BODY */}
        <div className="sheet-body" dir={lessonDir} style={isArabic ? { fontFamily: arabicFont } : {}}>
          {/* Arabic badge for translated lessons */}
          {isArabic && (
            <div style={{
              display: 'inline-flex', alignSelf: 'center', alignItems: 'center', gap: '0.5rem',
              background: 'rgba(66,133,244,0.08)', border: '1px solid rgba(66,133,244,0.2)',
              borderRadius: '99px', padding: '0.3rem 1rem', marginBottom: '-0.5rem',
              fontSize: '0.75rem', fontWeight: 700, color: '#4285F4',
              direction: 'rtl', fontFamily: arabicFont,
            }}>
              🌐 نسخة عربية — مترجمة بالذكاء الاصطناعي
            </div>
          )}
          {/* Centered blue banner title for both modes */}
          <div className="sheet-header-banner" style={{
            margin: '0 auto 2rem', display: 'inline-flex',
            fontFamily: isArabic ? arabicFont : 'inherit',
            direction: lessonDir,
          }}>
            {renderWithMath(header.fiche_title || header.subject || "Fiche de Cours")}
          </div>

          <div className={`sections-list-container ${lesson?.docType === 'exercises' ? 'exercises-two-columns-layout' : ''}`}>
            {sections?.map((sec, idx) => {
              const isTheory = sec.type === 'content';
              const { number: exeNumber, label: exeLabel } = !isTheory 
                ? parseExerciseTitle(sec.title, idx, isArabic)
                : { number: '', label: '' };
              
              // Decide whether to show section header row
              const prevSec = idx > 0 ? sections[idx - 1] : null;
              const showSectionHeader = sec.section_header && (!prevSec || prevSec.section_header !== sec.section_header);
              
              return (
                <div key={sec.id || idx} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
                  {showSectionHeader && (
                    <div
                      className="section-header-row"
                      style={{
                        marginTop: idx > 0 ? '1.5rem' : '0',
                        flexDirection: isArabic ? 'row-reverse' : 'row',
                      }}
                    >
                      <div className="section-badge-circle">{sec.section_number || '1'}</div>
                      <div
                        className="section-title-pill"
                        style={{ fontFamily: isArabic ? arabicFont : 'inherit', direction: lessonDir }}
                      >
                        {sec.section_header}
                      </div>
                    </div>
                  )}
                  
                  {isTheory ? (
                    <div className="subsection-card" style={isArabic ? { fontFamily: arabicFont } : {}}>
                      <div
                        className="subsection-header-inline"
                        style={{
                          flexDirection: isArabic ? 'row-reverse' : 'row',
                          textAlign: isArabic ? 'right' : 'left',
                          fontFamily: isArabic ? arabicFont : 'inherit',
                        }}
                      >
                        <span>{parseBold(sec.title)}</span>
                        {sec.accent_text && <span className="accent-green-text">{sec.accent_text}</span>}
                      </div>

                      {sec.items?.map((item, itemIdx) => {
                        if (item.type === 'highlight_box') {
                          return (
                            <div
                              key={itemIdx}
                              className="classic-highlight-box"
                              style={isArabic ? { direction: 'rtl', textAlign: 'right', fontFamily: arabicFont } : {}}
                            >
                              {renderWithMath(item.text)}
                            </div>
                          );
                        }
                        if (item.type === 'notation_grid') {
                          return (
                            <div key={itemIdx} className="notation-grid">
                              {item.notation_columns?.map((col, colIdx) => (
                                <div
                                  key={colIdx}
                                  className="notation-column"
                                  style={isArabic ? {
                                    borderLeft: 'none',
                                    borderRight: '2px solid rgba(0,80,134,0.15)',
                                    paddingLeft: 0,
                                    paddingRight: '1rem',
                                  } : {}}
                                >
                                  <strong style={{ fontSize: '0.85rem', color: '#005086', fontFamily: isArabic ? arabicFont : 'inherit' }}>{col.title}</strong>
                                  {col.math_blocks?.map((block, bIdx) => (
                                    <div key={bIdx} style={{ display: 'block', margin: '0.5rem 0' }}>
                                      {renderWithMath(block)}
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          );
                        }
                        if (item.type === 'table') {
                          return (
                            <div key={itemIdx} style={{ overflowX: 'auto', width: '100%', margin: '0.5rem 0' }}>
                              <table className="sheet-table" style={isArabic ? { direction: 'rtl' } : {}}>
                                <thead>
                                  <tr>
                                    {item.table_data?.headers?.map((h, hIdx) => (
                                      <th key={hIdx} style={isArabic ? { fontFamily: arabicFont } : {}}>{renderWithMath(h)}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {item.table_data?.rows?.map((row, rIdx) => (
                                    <tr key={rIdx}>
                                      {row.map((cell, cIdx) => (
                                        <td key={cIdx} style={isArabic ? { fontFamily: arabicFont } : {}}>{renderWithMath(cell)}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        }
                        // text / bullet
                        return (
                          <div
                            key={itemIdx}
                            className="bullet-item"
                            style={isArabic ? {
                              flexDirection: 'row-reverse',
                              textAlign: 'right',
                              fontFamily: arabicFont,
                            } : {}}
                          >
                            {item.type === 'bullet' && (
                              <span className="bullet-dot" style={isArabic ? { marginLeft: '0.5rem', marginRight: 0 } : {}}>•</span>
                            )}
                            <span style={{ flex: 1 }}>{renderWithMath(item.text)}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    (() => {
                      const isHomework = lesson.docType === 'homework' || lesson.content?.doc_type === 'homework';
                      if (isHomework) {
                        return (
                          <div className="homework-table" style={isArabic ? { fontFamily: arabicFont } : {}}>
                            <div className="homework-header-row">
                              <div className="homework-bareme-header">{calculateTotalPoints(sec.content, isArabic)}</div>
                              <div className="homework-content-header">
                                {isArabic ? 'تمرين' : 'Exercice'} {exeNumber} {exeLabel ? ` : ${exeLabel}` : ''}
                              </div>
                            </div>
                            
                            {renderHomeworkBody(sec.content, isArabic, arabicFont, renderWithMath, sec.id, handlePointsChange)}

                            {/* Interactive student checks inside homework row */}
                            {sec.interactive_answers?.length > 0 && (
                              <div className="homework-row no-print" style={{ background: 'rgba(0,80,134,0.01)' }}>
                                <div className="homework-bareme-cell" style={{ color: '#005086' }}><Calculator size={18} /></div>
                                <div className="homework-content-cell">
                                  <form 
                                    onSubmit={(e) => {
                                      e.preventDefault();
                                      sec.interactive_answers.forEach(ans => {
                                        handleCheckAnswer(sec.id, ans.question_idx, ans.expected_answer);
                                      });
                                    }}
                                    className="interactive-form no-print"
                                    style={{ margin: 0 }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.85rem', color: '#005086', marginBottom: '0.5rem' }}>
                                      <Calculator size={16} /> Mode interactif : Calculez et valisez vos résultats
                                    </div>
                                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                      {sec.interactive_answers.map((ans, ansIdx) => {
                                        const ansKey = `${sec.id}-${ans.question_idx}`;
                                        return (
                                          <div key={ansIdx} style={{ flex: 1, minWidth: '120px' }}>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                                              {ans.label}
                                            </label>
                                            <input 
                                              type="text" 
                                              placeholder="Votre réponse"
                                              value={studentAnswers[ansKey] || ''} 
                                              onChange={(e) => setStudentAnswers(prev => ({ ...prev, [ansKey]: e.target.value }))}
                                              className="input-control" 
                                              style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', width: '100%' }}
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>
                                    
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                      <button type="submit" className="btn" style={{ padding: '0.4rem 1rem', fontSize: '0.75rem', width: 'fit-content' }}>
                                        Vérifier mes réponses
                                      </button>

                                      {sec.interactive_answers.every(ans => checkResults[`${sec.id}-${ans.question_idx}`] === 'success') && (
                                        <span style={{ color: '#059669', fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                          <Check size={16} strokeWidth={3} /> Réponses correctes !
                                        </span>
                                      )}
                                      {sec.interactive_answers.some(ans => checkResults[`${sec.id}-${ans.question_idx}`] === 'error') && (
                                        <span style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                          <X size={16} strokeWidth={3} /> Mauvaise réponse, réessayez.
                                        </span>
                                      )}
                                    </div>
                                  </form>
                                </div>
                              </div>
                            )}

                            {/* Solution block in homework row */}
                            {sec.solution && (
                              <div className="homework-row no-print" style={{ background: 'rgba(16,185,129,0.01)' }}>
                                <div className="homework-bareme-cell" style={{ background: 'rgba(16,185,129,0.03)', color: '#059669', cursor: 'pointer', borderTop: '1px solid rgba(16,185,129,0.12)' }} onClick={() => toggleSolution(sec.id)}>
                                  📖
                                </div>
                                <div className="homework-content-cell" style={{ borderTop: '1px solid rgba(16,185,129,0.12)' }}>
                                  <button 
                                    className="solution-link-btn"
                                    onClick={() => toggleSolution(sec.id)}
                                    style={{ padding: '0.25rem 0', fontFamily: isArabic ? arabicFont : 'inherit', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#059669', fontWeight: 700, fontSize: '0.85rem' }}
                                  >
                                    {visibleSolutions[sec.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                                    {isArabic
                                      ? (visibleSolutions[sec.id] ? 'إخفاء الحل' : 'إظهار الحل المفصل')
                                      : (visibleSolutions[sec.id] ? 'Masquer la solution' : 'Afficher la solution rédigée')
                                    }
                                  </button>

                                  {visibleSolutions[sec.id] && (
                                    <div className="solution-block" style={{ marginTop: '0.65rem', padding: '0.75rem 0 0', borderTop: '1px dashed rgba(16,185,129,0.2)' }}>
                                      <h4 style={{ color: '#059669', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.95rem', flexDirection: isArabic ? 'row-reverse' : 'row', fontFamily: isArabic ? arabicFont : 'inherit' }}>
                                        <BookOpenCheck size={16} />
                                        {isArabic ? 'الحل المفصل' : 'Démonstration rédigée'}
                                      </h4>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.9rem', lineHeight: 1.8, textAlign: isArabic ? 'right' : 'left', fontFamily: isArabic ? arabicFont : 'inherit', direction: isArabic ? 'rtl' : 'ltr' }}>
                                        {renderWithMath(sec.solution)}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div className="exercise-wrapper" style={isArabic ? { fontFamily: arabicFont } : {}}>
                          <div
                            className="exercise-banner-row"
                            style={isArabic ? { flexDirection: 'row' } : {}}
                          >
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
                              flexDirection: isArabic ? 'row' : 'row',
                            }}>
                              <div className="exercise-pill" style={isArabic ? { fontFamily: arabicFont, flexDirection: 'row' } : {}}>
                                <span>
                                  {isArabic ? 'تمرين' : 'Exercice N°'}
                                </span>
                                <span style={{
                                  background: '#ffffff', color: '#005086',
                                  minWidth: '20px', height: '20px', borderRadius: '10px',
                                  padding: '0 5px',
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '0.75rem', fontWeight: 900,
                                  whiteSpace: 'nowrap'
                                }}>{exeNumber}</span>
                              </div>
                              {exeLabel && (
                                <span style={{
                                  fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)',
                                  display: 'inline-flex', alignItems: 'center',
                                  fontFamily: isArabic ? arabicFont : 'inherit',
                                }}>
                                  {exeLabel}
                                </span>
                              )}
                            </div>

                            <button
                              className="solution-link-btn no-print"
                              onClick={() => toggleSolution(sec.id)}
                              style={isArabic ? { fontFamily: arabicFont, flexDirection: 'row' } : {}}
                            >
                              {visibleSolutions[sec.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                              {isArabic
                                ? (visibleSolutions[sec.id] ? 'إخفاء الحل' : 'إظهار الحل المفصل')
                                : (visibleSolutions[sec.id] ? 'Masquer la solution' : 'Afficher la solution rédigée')
                              }
                            </button>
                          </div>

                          <div
                            className="exercise-body-box"
                            style={isArabic ? {
                              borderLeft: 'none',
                              borderRight: '4px solid #005086',
                              borderRadius: '8px 4px 4px 8px',
                              textAlign: 'right',
                              fontFamily: arabicFont,
                              direction: 'rtl',
                            } : {}}
                          >
                            {renderWithMath(sec.content)}
                          </div>

                          {/* Interactive student checks */}
                          {sec.interactive_answers?.length > 0 && (
                            <form 
                              onSubmit={(e) => {
                                e.preventDefault();
                                sec.interactive_answers.forEach(ans => {
                                  handleCheckAnswer(sec.id, ans.question_idx, ans.expected_answer);
                                });
                              }}
                              className="interactive-form no-print"
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.85rem', color: '#005086' }}>
                                <Calculator size={16} /> Mode interactif : Calculez et valisez vos résultats
                              </div>
                              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                {sec.interactive_answers.map((ans, ansIdx) => {
                                  const ansKey = `${sec.id}-${ans.question_idx}`;
                                  return (
                                    <div key={ansIdx} style={{ flex: 1, minWidth: '120px' }}>
                                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                                        {ans.label}
                                      </label>
                                      <input 
                                        type="text" 
                                        placeholder="Votre réponse"
                                        value={studentAnswers[ansKey] || ''} 
                                        onChange={(e) => setStudentAnswers(prev => ({ ...prev, [ansKey]: e.target.value }))}
                                        className="input-control" 
                                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', width: '100%' }}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                              
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <button type="submit" className="btn" style={{ padding: '0.4rem 1rem', fontSize: '0.75rem', width: 'fit-content' }}>
                                  Vérifier mes réponses
                                </button>

                                {sec.interactive_answers.every(ans => checkResults[`${sec.id}-${ans.question_idx}`] === 'success') && (
                                  <span style={{ color: '#059669', fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <Check size={16} strokeWidth={3} /> Réponses correctes !
                                  </span>
                                )}
                                {sec.interactive_answers.some(ans => checkResults[`${sec.id}-${ans.question_idx}`] === 'error') && (
                                  <span style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <X size={16} strokeWidth={3} /> Mauvaise réponse, réessayez.
                                  </span>
                                )}
                              </div>
                            </form>
                          )}

                          {/* Solution block: always rendered, hidden by CSS, shown in print */}
                          <div
                            className="solution-block"
                            style={{
                              display: visibleSolutions[sec.id] ? 'block' : 'none',
                              marginTop: '0.5rem',
                              background: 'rgba(16, 185, 129, 0.02)',
                              border: '1px solid rgba(16, 185, 129, 0.15)',
                              borderRadius: '12px',
                              padding: '1.5rem'
                            }}
                          >
                            <h4 style={{
                              color: '#059669', fontWeight: 800,
                              display: 'flex', alignItems: 'center', gap: '0.5rem',
                              marginBottom: '0.75rem', fontSize: '1rem',
                              flexDirection: isArabic ? 'row-reverse' : 'row',
                              fontFamily: isArabic ? arabicFont : 'inherit',
                            }}>
                              <BookOpenCheck size={18} />
                              {isArabic ? 'الحل المفصل' : 'Démonstration rédigée'}
                            </h4>
                            <div style={{
                              display: 'flex', flexDirection: 'column', gap: '1rem',
                              fontSize: '0.92rem', lineHeight: 1.85,
                              textAlign: isArabic ? 'right' : 'left',
                              fontFamily: isArabic ? arabicFont : 'inherit',
                              direction: isArabic ? 'rtl' : 'ltr',
                            }}>
                              {renderWithMath(sec.solution)}
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
