import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLessonById, updateLesson } from '../services/lessonService';
import { 
  ArrowLeft, Save, Trash2, Plus, AlertCircle, 
  CheckCircle, Loader2, ChevronUp, ChevronDown, Crop,
  FileText, Eye, EyeOff, Columns, Split, Bold, Italic, 
  Underline, AlignLeft, AlignCenter, AlignRight,
  Table, Image as ImageIcon, Sparkles, Check, X,
  Type, Palette, BookOpen, Layers, Lightbulb, CornerDownLeft
} from 'lucide-react';
import PdfFigureCropperModal from '../components/PdfFigureCropperModal';
import ImageDropZone from '../components/ImageDropZone';
import { renderWithMath } from '../utils/mathRenderer';
import { normalizeLevel } from '../utils/levelHelpers';

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

// Math Formula Templates for fast insertion
const MATH_SNIPPETS = [
  { label: 'a/b', latex: '\\frac{a}{b}', title: 'Fraction' },
  { label: '√x', latex: '\\sqrt{x}', title: 'Racine carrée' },
  { label: 'ⁿ√x', latex: '\\sqrt[n]{x}', title: 'Racine n-ième' },
  { label: 'xⁿ', latex: 'x^{n}', title: 'Puissance' },
  { label: 'uₙ', latex: 'u_{n}', title: 'Suite u_n' },
  { label: 'uₙ₊₁', latex: 'u_{n+1}', title: 'Terme suivant u_{n+1}' },
  { label: 'lim', latex: '\\lim_{x \\to x_0} f(x)', title: 'Limite' },
  { label: '∫', latex: '\\int_{a}^{b} f(x) \\, dx', title: 'Intégrale' },
  { label: '∑', latex: '\\sum_{k=0}^{n} u_k', title: 'Somme' },
  { label: '∞', latex: '+\\infty', title: 'Plus l\'infini' },
  { label: 'ℝ', latex: '\\mathbb{R}', title: 'Ensemble ℝ' },
  { label: 'ℕ', latex: '\\mathbb{N}', title: 'Ensemble ℕ' },
  { label: 'ℤ', latex: '\\mathbb{Z}', title: 'Ensemble ℤ' },
  { label: '⇔', latex: '\\Leftrightarrow', title: 'Équivaut à' },
  { label: '⇒', latex: '\\Rightarrow', title: 'Implique' },
  { label: '∀', latex: '\\forall', title: 'Pour tout' },
  { label: '∃', latex: '\\exists', title: 'Il existe' },
  { label: '∈', latex: '\\in', title: 'Appartient à' },
  { label: '≤', latex: '\\le', title: 'Inférieur ou égal' },
  { label: '≥', latex: '\\ge', title: 'Supérieur ou égal' },
  { label: '≠', latex: '\\neq', title: 'Différent de' },
  { label: '±', latex: '\\pm', title: 'Plus ou moins' },
  { label: 'v⃗', latex: '\\vec{u}', title: 'Vecteur' },
  { label: 'Δ', latex: '\\Delta', title: 'Discriminant Delta' },
  { label: 'Matrix', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', title: 'Matrice 2x2' }
];

export default function AdminLessonEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();

  // Role Guard
  if (!authLoading && user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  // Component States
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // View Mode: 'word' (Live Word Canvas) | 'form' (Classic Forms) | 'split' (Side by Side)
  const [viewMode, setViewMode] = useState('word');
  const [activeRibbonTab, setActiveRibbonTab] = useState('home'); // 'home' | 'math' | 'insert' | 'settings'

  // Header metadata
  const [ficheTitle, setFicheTitle] = useState('');
  const [subject, setSubject] = useState('Algèbre');
  const [chapterNumber, setChapterNumber] = useState('');
  const [teacher, setTeacher] = useState('');
  const [phone, setPhone] = useState('');
  const [prepTitle, setPrepTitle] = useState('Préparation aux concours');
  const [selectedLevel, setSelectedLevel] = useState('2bac_pc_svt');
  const [docType, setDocType] = useState('course');
  const [docLanguage, setDocLanguage] = useState('fr');

  // Pedagogical Objectives (Fiche header fields)
  const [capacitesAttendues, setCapacitesAttendues] = useState('');
  const [contenus, setContenus] = useState('');
  const [leContenu, setLeContenu] = useState('');
  
  // Sections state
  const [sections, setSections] = useState([]);

  // Active focused input/textarea for ribbon insertions
  const [activeFieldTarget, setActiveFieldTarget] = useState(null); // { secIdx, itemIdx, field: 'text'|'title'|'content'|'solution' }

  // PDF Figure Cropper Modal State
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [cropperTarget, setCropperTarget] = useState({ secIdx: 0, itemIdx: null });

  // Keyboard shortcut for quick save
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveLesson();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ficheTitle, subject, chapterNumber, teacher, phone, prepTitle, selectedLevel, docType, docLanguage, sections, capacitesAttendues, contenus, leContenu]);

  const handleCropComplete = ({ url, alt, width_pct, align, targetSectionIdx, targetItemIdx }) => {
    setSections(prev => {
      const next = [...prev];
      const secIdx = targetSectionIdx ?? 0;
      if (!next[secIdx]) return prev;
      const sec = { ...next[secIdx] };
      const items = Array.isArray(sec.items) ? [...sec.items] : [];

      const newImageItem = {
        type: 'image',
        url,
        alt: alt || 'Figure géométrique',
        width_pct: width_pct || 80,
        align: align || 'center'
      };

      if (targetItemIdx !== null && targetItemIdx >= 0 && items[targetItemIdx]?.type === 'image') {
        items[targetItemIdx] = {
          ...items[targetItemIdx],
          url,
          alt: alt || items[targetItemIdx].alt || 'Figure géométrique',
          width_pct: width_pct || items[targetItemIdx].width_pct || 80,
          align: align || items[targetItemIdx].align || 'center'
        };
      } else if (targetItemIdx !== null && targetItemIdx >= 0) {
        items.splice(targetItemIdx + 1, 0, newImageItem);
      } else {
        items.push(newImageItem);
      }

      sec.items = items;
      next[secIdx] = sec;
      return next;
    });
  };

  // Fetch Lesson on mount
  useEffect(() => {
    const fetchLessonData = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getLessonById(id);
        if (!data) {
          setError("Cette fiche de cours n'existe pas ou a été supprimée.");
        } else {
          setLesson(data);
          
          // Populate states
          setFicheTitle(data.title || '');
          setSubject(data.subject || 'Algèbre');
          setChapterNumber(data.chapterNumber || '');
          setTeacher(data.teacher || '');
          setPhone(data.phone || '');
          
          const header = data.content?.header || {};
          setPrepTitle(header.prep_title || 'Préparation aux concours');
          setSelectedLevel(normalizeLevel(data.level || data.content?.level || '2bac_pc_svt'));
          setDocType(data.docType || data.content?.doc_type || 'course');
          setDocLanguage(data.content?.metadata?.language || 'fr');

          setCapacitesAttendues(header.capacites_attendues || '');
          setContenus(header.contenus || '');
          setLeContenu(header.le_contenu || '');
          
          const loadedSections = (data.content?.sections || []).map(sec => {
            const hasAr = /[\u0600-\u06FF]/.test((sec.title || '') + ' ' + (sec.content || '') + ' ' + (sec.solution || '') + ' ' + (sec.items || []).map(it => it.text || '').join(' '));
            return {
              ...sec,
              language: sec.language || (hasAr ? 'ar' : 'fr')
            };
          });
          setSections(loadedSections);
        }
      } catch (err) {
        console.error(err);
        setError("Erreur lors de la récupération de la fiche de cours.");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchLessonData();
  }, [id]);

  // Section manipulation helpers
  const handleAddSection = (type) => {
    const newId = `sec-${Date.now()}`;
    const newSec = type === 'content' 
      ? { id: newId, title: 'Nouvelle Section', type: 'content', section_number: '', section_header: '', accent_text: '', items: [{ type: 'text', text: '' }], language: docLanguage }
      : { id: newId, title: 'Nouvel Exercice', type: 'exercise', section_number: '', section_header: '', content: '', solution: '', interactive_answers: [], language: docLanguage };
    setSections([...sections, newSec]);
  };

  const handleRemoveSection = (index) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette section ?")) {
      setSections(sections.filter((_, i) => i !== index));
    }
  };

  const handleUpdateSection = (index, field, value) => {
    setSections(sections.map((sec, i) => i === index ? { ...sec, [field]: value } : sec));
  };

  const handleMoveSection = (index, direction) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sections.length - 1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newSections = [...sections];
    const temp = newSections[index];
    newSections[index] = newSections[targetIndex];
    newSections[targetIndex] = temp;
    setSections(newSections);
  };

  // Content items manipulation helpers
  const handleAddItemToContentSection = (secIndex, itemType = 'text') => {
    setSections(sections.map((sec, i) => {
      if (i === secIndex) {
        let newItem = { type: itemType, text: '' };
        if (itemType === 'table') {
          newItem = {
            type: 'table',
            table_data: {
              headers: ['Colonne 1', 'Colonne 2', 'Colonne 3'],
              rows: [['Donnée 1', 'Donnée 2', 'Donnée 3']]
            }
          };
        } else if (itemType === 'notation_grid') {
          newItem = {
            type: 'notation_grid',
            notation_columns: [{ title: '• Notation', math_blocks: ['f(x)'] }]
          };
        }
        return {
          ...sec,
          items: [...(sec.items || []), newItem]
        };
      }
      return sec;
    }));
  };

  const handleRemoveItemFromContentSection = (secIndex, itemIndex) => {
    setSections(sections.map((sec, i) => {
      if (i === secIndex) {
        return {
          ...sec,
          items: sec.items.filter((_, idx) => idx !== itemIndex)
        };
      }
      return sec;
    }));
  };

  const handleUpdateContentItem = (secIndex, itemIndex, field, value) => {
    setSections(sections.map((sec, i) => {
      if (i === secIndex) {
        const newItems = sec.items.map((item, idx) => {
          if (idx === itemIndex) {
            return { ...item, [field]: value };
          }
          return item;
        });
        return { ...sec, items: newItems };
      }
      return sec;
    }));
  };

  const handleMoveItem = (secIndex, itemIndex, direction) => {
    const sec = sections[secIndex];
    if (!sec || !sec.items) return;
    if (direction === 'up' && itemIndex === 0) return;
    if (direction === 'down' && itemIndex === sec.items.length - 1) return;
    const targetIdx = direction === 'up' ? itemIndex - 1 : itemIndex + 1;
    const newItems = [...sec.items];
    const temp = newItems[itemIndex];
    newItems[itemIndex] = newItems[targetIdx];
    newItems[targetIdx] = temp;
    
    setSections(sections.map((s, i) => i === secIndex ? { ...s, items: newItems } : s));
  };

  // Insert Text / LaTeX snippet into active focus target
  const insertTextOrSnippet = (snippet) => {
    if (!activeFieldTarget) {
      if (sections.length > 0) {
        const lastIdx = sections.length - 1;
        if (sections[lastIdx].type === 'exercise') {
          handleUpdateSection(lastIdx, 'content', (sections[lastIdx].content || '') + ' ' + snippet);
        } else {
          handleAddItemToContentSection(lastIdx, 'text');
          const lastItemIdx = (sections[lastIdx].items?.length || 0);
          handleUpdateContentItem(lastIdx, lastItemIdx, 'text', snippet);
        }
      }
      return;
    }

    const { secIdx, itemIdx, field } = activeFieldTarget;
    if (field === 'ficheTitle') {
      setFicheTitle(prev => prev + ' ' + snippet);
    } else if (field === 'capacites') {
      setCapacitesAttendues(prev => prev + ' ' + snippet);
    } else if (field === 'contenus') {
      setContenus(prev => prev + ' ' + snippet);
    } else if (field === 'sectionTitle' && secIdx !== undefined) {
      handleUpdateSection(secIdx, 'title', (sections[secIdx]?.title || '') + ' ' + snippet);
    } else if (field === 'exerciseContent' && secIdx !== undefined) {
      handleUpdateSection(secIdx, 'content', (sections[secIdx]?.content || '') + ' ' + snippet);
    } else if (field === 'exerciseSolution' && secIdx !== undefined) {
      handleUpdateSection(secIdx, 'solution', (sections[secIdx]?.solution || '') + ' ' + snippet);
    } else if (field === 'itemText' && secIdx !== undefined && itemIdx !== null && itemIdx !== undefined) {
      const curr = sections[secIdx]?.items?.[itemIdx]?.text || '';
      handleUpdateContentItem(secIdx, itemIdx, 'text', curr + ' ' + snippet);
    }
  };

  // Direct Image Insertion Handler (Paste, Drag&Drop, Upload, Camera)
  const handleDirectImageInsert = (dataUrl, alt = 'Figure') => {
    let targetSecIdx = activeFieldTarget?.secIdx;
    if (targetSecIdx === undefined || targetSecIdx === null || !sections[targetSecIdx]) {
      targetSecIdx = sections.length > 0 ? sections.length - 1 : 0;
    }
    
    if (sections.length === 0) {
      const newSec = {
        id: `sec-${Date.now()}`,
        title: 'Section avec Figure',
        type: 'content',
        section_number: '',
        section_header: '',
        accent_text: '',
        items: [{ type: 'image', url: dataUrl, alt, width_pct: 80, align: 'center' }],
        language: docLanguage
      };
      setSections([newSec]);
      return;
    }

    setSections(prev => {
      const next = [...prev];
      const sec = { ...next[targetSecIdx] };
      const items = Array.isArray(sec.items) ? [...sec.items] : [];
      const newImageItem = {
        type: 'image',
        url: dataUrl,
        alt,
        width_pct: 80,
        align: 'center'
      };
      items.push(newImageItem);
      sec.items = items;
      next[targetSecIdx] = sec;
      return next;
    });
  };

  // Save changes
  const handleSaveLesson = async () => {
    if (!ficheTitle.trim() || !subject.trim()) {
      setError('Le titre et la matière sont obligatoires.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const lessonData = {
        title: ficheTitle,
        subject,
        chapterNumber,
        teacher,
        phone,
        level: selectedLevel,
        docType: docType,
        content: {
          level: selectedLevel,
          doc_type: docType,
          metadata: {
            ...lesson?.content?.metadata,
            language: docLanguage
          },
          header: {
            prep_title: prepTitle,
            schools: [],
            subject,
            fiche_title: ficheTitle,
            teacher,
            phone,
            capacites_attendues: capacitesAttendues,
            contenus: contenus,
            le_contenu: leContenu
          },
          sections
        },
        isActive: lesson ? lesson.isActive : true
      };

      await updateLesson(id, lessonData);
      setSuccess('Fiche de cours enregistrée avec succès ✓');
      setTimeout(() => {
        setSuccess('');
      }, 3500);
    } catch (e) {
      console.error(e);
      setError(`Erreur lors de la modification : ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const isArMode = docLanguage === 'ar' || /[\u0600-\u06FF]/.test(ficheTitle + ' ' + subject + ' ' + (sections || []).map(s => s.title + ' ' + (s.content || '')).join(' '));

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Loader2 className="animate-spin text-violet" size={48} />
        <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Chargement de l'éditeur Office Word...</p>
      </div>
    );
  }

  // ── RENDER LIVE WORD DOCUMENT SHEET ──
  const renderLiveWordDocument = () => {
    return (
      <div className="word-paper-canvas" style={{
        background: '#ffffff',
        color: '#0f172a',
        borderRadius: '8px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.08)',
        padding: isMobile ? '1.25rem' : '2.5rem 3rem',
        minHeight: '1000px',
        border: '1px solid #e2e8f0',
        position: 'relative',
        direction: isArMode ? 'rtl' : 'ltr',
        fontFamily: isArMode ? "'Cairo', 'Amiri', 'Segoe UI', Tahoma, sans-serif" : "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}>
        {/* Paper Watermark / Header Line */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px solid #005086',
          paddingBottom: '0.6rem',
          marginBottom: '1.5rem',
          fontSize: '0.82rem',
          color: '#005086',
          fontWeight: 700
        }}>
          <div>
            <input
              type="text"
              value={prepTitle}
              onChange={e => setPrepTitle(e.target.value)}
              placeholder="Préparation aux concours..."
              style={{ border: 'none', background: 'transparent', color: '#005086', fontWeight: 800, fontSize: '0.85rem', width: '260px', outline: 'none' }}
            />
          </div>
          <div style={{ textAlign: 'center', color: '#dc2626', fontWeight: 900, fontSize: '0.95rem' }}>
            {renderWithMath(ficheTitle || 'Titre du document')}
          </div>
          <div style={{ textAlign: isArMode ? 'left' : 'right' }}>
            <input
              type="text"
              value={teacher}
              onChange={e => setTeacher(e.target.value)}
              placeholder="Professeur..."
              style={{ border: 'none', background: 'transparent', color: '#1e293b', fontWeight: 700, fontSize: '0.85rem', textAlign: isArMode ? 'left' : 'right', width: '160px', outline: 'none' }}
            />
          </div>
        </div>

        {/* Pedagogical Header Block Table (Editable directly) */}
        {docType === 'course' && (
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1.5px solid #005086',
            borderRadius: '6px',
            overflow: 'hidden',
            marginBottom: '1.5rem',
            background: '#ffffff'
          }}>
            <tbody>
              {/* Title row */}
              <tr>
                <td colSpan={2} style={{
                  background: '#005086',
                  color: '#ffffff',
                  textAlign: 'center',
                  padding: '0.6rem 1rem'
                }}>
                  <input
                    type="text"
                    value={ficheTitle}
                    onChange={e => setFicheTitle(e.target.value)}
                    onFocus={() => setActiveFieldTarget({ field: 'ficheTitle' })}
                    placeholder="TITRE DE LA FICHE PÉDAGOGIQUE..."
                    style={{
                      width: '100%',
                      background: 'transparent',
                      color: '#ffffff',
                      border: 'none',
                      textAlign: 'center',
                      fontWeight: 900,
                      fontSize: '1.2rem',
                      outline: 'none',
                      fontFamily: 'inherit'
                    }}
                  />
                </td>
              </tr>
              {/* Objectives 2 columns */}
              <tr>
                <td style={{ width: '50%', padding: '0.5rem', borderRight: '1.5px solid #005086', borderBottom: '1.5px solid #005086', verticalAlign: 'top' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#005086', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                    {isArMode ? 'القدرات المنتظرة' : 'LES CAPACITÉS ATTENDUES'}
                  </div>
                  <textarea
                    value={capacitesAttendues}
                    onChange={e => setCapacitesAttendues(e.target.value)}
                    onFocus={() => setActiveFieldTarget({ field: 'capacites' })}
                    placeholder="Entrez les capacités attendues..."
                    rows={2}
                    style={{ width: '100%', border: '1px dashed #cbd5e1', borderRadius: '4px', padding: '0.35rem', fontSize: '0.8rem', resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
                  />
                </td>
                <td style={{ width: '50%', padding: '0.5rem', borderBottom: '1.5px solid #005086', verticalAlign: 'top' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#005086', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                    {isArMode ? 'المحتويات' : 'CONTENUS'}
                  </div>
                  <textarea
                    value={contenus}
                    onChange={e => setContenus(e.target.value)}
                    onFocus={() => setActiveFieldTarget({ field: 'contenus' })}
                    placeholder="Entrez les contenus..."
                    rows={2}
                    style={{ width: '100%', border: '1px dashed #cbd5e1', borderRadius: '4px', padding: '0.35rem', fontSize: '0.8rem', resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {/* ── Document Body Sections ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {sections.map((sec, secIdx) => {
            const isExercise = sec.type === 'exercise';
            const blockColors = {
              definition: { border: '#0284c7', bg: '#f0f9ff', title: '#0369a1', badge: 'DÉFINITION (تعريف)' },
              property: { border: '#10b981', bg: '#ecfdf5', title: '#047857', badge: 'PROPRIÉTÉ (خاصية)' },
              theorem: { border: '#8b5cf6', bg: '#f5f3ff', title: '#6d28d9', badge: 'THÉORÈME (مبرهنة)' },
              corollary: { border: '#6366f1', bg: '#eef2ff', title: '#4338ca', badge: 'COROLLAIRE (نتيجة)' },
              remark: { border: '#f59e0b', bg: '#fffbeb', title: '#b45309', badge: 'REMARQUE (ملاحظة)' },
              example: { border: '#14b8a6', bg: '#f0fdfa', title: '#0f766e', badge: 'EXEMPLE (مثال)' },
              activity: { border: '#ec4899', bg: '#fdf2f8', title: '#be185d', badge: 'ACTIVITÉ (تطبيق)' },
              exercise: { border: '#ef4444', bg: '#fef2f2', title: '#b91c1c', badge: 'EXERCICE (تمرين)' },
              content: { border: '#005086', bg: '#f8fafc', title: '#005086', badge: 'COURS (درس)' }
            };
            const currentStyle = blockColors[sec.type] || blockColors.content;

            return (
              <div
                key={sec.id || secIdx}
                className="word-section-block"
                style={{
                  border: `1.5px solid ${currentStyle.border}`,
                  borderRadius: '8px',
                  background: currentStyle.bg,
                  padding: '1.25rem',
                  position: 'relative',
                  transition: 'box-shadow 0.2s ease',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                }}
              >
                {/* Section Controls Bar (Pinned Top Right) */}
                <div style={{
                  position: 'absolute',
                  top: '0.6rem',
                  right: isArMode ? 'auto' : '0.6rem',
                  left: isArMode ? '0.6rem' : 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: '#ffffff',
                  padding: '0.2rem 0.4rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}>
                  <select
                    value={sec.type}
                    onChange={e => handleUpdateSection(secIdx, 'type', e.target.value)}
                    style={{ border: 'none', background: 'transparent', fontSize: '0.75rem', fontWeight: 800, color: currentStyle.title, outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="content">Cours (Général)</option>
                    <option value="definition">Définition</option>
                    <option value="property">Propriété</option>
                    <option value="theorem">Théorème</option>
                    <option value="corollary">Corollaire</option>
                    <option value="remark">Remarque</option>
                    <option value="example">Exemple</option>
                    <option value="activity">Activité</option>
                    <option value="exercise">Exercice</option>
                  </select>
                  <span style={{ color: '#cbd5e1' }}>|</span>
                  <button onClick={() => handleMoveSection(secIdx, 'up')} disabled={secIdx === 0} style={{ border: 'none', background: 'transparent', cursor: secIdx === 0 ? 'not-allowed' : 'pointer', opacity: secIdx === 0 ? 0.3 : 1 }}>
                    <ChevronUp size={14} />
                  </button>
                  <button onClick={() => handleMoveSection(secIdx, 'down')} disabled={secIdx === sections.length - 1} style={{ border: 'none', background: 'transparent', cursor: secIdx === sections.length - 1 ? 'not-allowed' : 'pointer', opacity: secIdx === sections.length - 1 ? 0.3 : 1 }}>
                    <ChevronDown size={14} />
                  </button>
                  <button onClick={() => handleRemoveSection(secIdx)} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}>
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Section Title & Pill Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
                  <span style={{
                    background: currentStyle.border,
                    color: '#ffffff',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 900,
                    letterSpacing: '0.04em'
                  }}>
                    {currentStyle.badge}
                  </span>

                  <input
                    type="text"
                    value={sec.title || ''}
                    onChange={e => handleUpdateSection(secIdx, 'title', e.target.value)}
                    onFocus={() => setActiveFieldTarget({ secIdx, field: 'sectionTitle' })}
                    placeholder="Titre de la section / du théorème..."
                    style={{
                      flex: 1,
                      border: 'none',
                      background: 'transparent',
                      fontWeight: 800,
                      fontSize: '1.05rem',
                      color: currentStyle.title,
                      outline: 'none',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                {/* Body Elements (If Course / Theory) */}
                {!isExercise ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {sec.items?.map((item, itemIdx) => (
                      <div key={itemIdx} style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        padding: '0.75rem',
                        position: 'relative'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b' }}>
                            {item.type === 'bullet' ? '• Puce' : item.type === 'highlight_box' ? '📦 Formule Encadrée' : item.type === 'table' ? '📊 Tableau' : item.type === 'image' ? '🖼️ Image' : '📝 Texte'}
                          </span>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button onClick={() => handleMoveItem(secIdx, itemIdx, 'up')} disabled={itemIdx === 0} style={{ border: 'none', background: 'transparent', cursor: 'pointer', opacity: itemIdx === 0 ? 0.3 : 1 }}>
                              <ChevronUp size={13} />
                            </button>
                            <button onClick={() => handleMoveItem(secIdx, itemIdx, 'down')} disabled={itemIdx === sec.items.length - 1} style={{ border: 'none', background: 'transparent', cursor: 'pointer', opacity: itemIdx === sec.items.length - 1 ? 0.3 : 1 }}>
                              <ChevronDown size={13} />
                            </button>
                            <button onClick={() => handleRemoveItemFromContentSection(secIdx, itemIdx)} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Text / Bullet / Highlight content */}
                        {item.type !== 'table' && item.type !== 'image' && item.type !== 'notation_grid' && (
                          <div>
                            <textarea
                              value={item.text || ''}
                              onChange={e => handleUpdateContentItem(secIdx, itemIdx, 'text', e.target.value)}
                              onFocus={() => setActiveFieldTarget({ secIdx, itemIdx, field: 'itemText' })}
                              placeholder="Écrivez le contenu du cours (utilisez $...$ pour les formules LaTeX)..."
                              rows={Math.max(2, (item.text || '').split('\n').length)}
                              style={{
                                width: '100%',
                                border: '1px dashed #cbd5e1',
                                borderRadius: '4px',
                                padding: '0.5rem',
                                fontSize: '0.9rem',
                                outline: 'none',
                                fontFamily: 'inherit',
                                background: item.type === 'highlight_box' ? '#fffbeb' : '#ffffff'
                              }}
                            />
                            {/* Live KaTeX Math Preview beneath */}
                            {item.text && (
                              <div style={{ marginTop: '0.35rem', padding: '0.35rem 0.5rem', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.88rem' }}>
                                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Aperçu direct (KaTeX) :</span>
                                <div>{renderWithMath(item.text)}</div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Image element in Word mode */}
                        {item.type === 'image' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: '0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: item.align === 'left' ? 'flex-start' : item.align === 'right' ? 'flex-end' : 'center', width: '100%' }}>
                              {item.url && (
                                <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', maxWidth: `${item.width_pct || 80}%` }}>
                                  <img
                                    src={item.url}
                                    alt={item.alt || ''}
                                    style={{
                                      width: '100%',
                                      maxHeight: '320px',
                                      borderRadius: '6px',
                                      border: '1px solid #cbd5e1',
                                      objectFit: 'contain'
                                    }}
                                  />
                                  <span style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '0.68rem', padding: '1px 5px', borderRadius: '3px' }}>
                                    {item.width_pct || 80}%
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Caption & Controls */}
                            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                              <input
                                type="text"
                                value={item.alt || ''}
                                onChange={e => handleUpdateContentItem(secIdx, itemIdx, 'alt', e.target.value)}
                                placeholder="Légende / Titre de la figure..."
                                style={{ flex: 1, minWidth: '180px', fontSize: '0.78rem', padding: '0.3rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setCropperTarget({ secIdx, itemIdx });
                                  setIsCropperOpen(true);
                                }}
                                style={{ background: '#059669', color: '#fff', border: 'none', padding: '0.35rem 0.65rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                              >
                                <Crop size={12} /> ✂️ Découper depuis PDF
                              </button>
                            </div>

                            {/* Alignment & Size Controls */}
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', paddingTop: '0.4rem', borderTop: '1px dashed #cbd5e1', fontSize: '0.75rem' }}>
                              {/* Alignment */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span style={{ fontWeight: 700, color: '#475569' }}>الموقع / Position :</span>
                                <div style={{ display: 'inline-flex', borderRadius: '4px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
                                  {[
                                    { id: 'left', label: 'اليسار (Gauche)', icon: <AlignLeft size={13} /> },
                                    { id: 'center', label: 'الوسط (Centré)', icon: <AlignCenter size={13} /> },
                                    { id: 'right', label: 'اليمين (Droite)', icon: <AlignRight size={13} /> }
                                  ].map(pos => {
                                    const isSelected = (item.align || 'center') === pos.id;
                                    return (
                                      <button
                                        key={pos.id}
                                        type="button"
                                        onClick={() => handleUpdateContentItem(secIdx, itemIdx, 'align', pos.id)}
                                        style={{
                                          background: isSelected ? '#005086' : '#ffffff',
                                          color: isSelected ? '#ffffff' : '#475569',
                                          border: 'none',
                                          padding: '0.25rem 0.5rem',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center'
                                        }}
                                        title={pos.label}
                                      >
                                        {pos.icon}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Size Presets & Slider */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: '200px' }}>
                                <span style={{ fontWeight: 700, color: '#475569' }}>الحجم / Largeur :</span>
                                <div style={{ display: 'flex', gap: '0.2rem' }}>
                                  {[30, 50, 75, 100].map(pct => {
                                    const isSelected = (item.width_pct || 80) === pct;
                                    return (
                                      <button
                                        key={pct}
                                        type="button"
                                        onClick={() => handleUpdateContentItem(secIdx, itemIdx, 'width_pct', pct)}
                                        style={{
                                          background: isSelected ? '#4f46e5' : '#ffffff',
                                          color: isSelected ? '#ffffff' : '#334155',
                                          border: '1px solid ' + (isSelected ? '#4338ca' : '#cbd5e1'),
                                          borderRadius: '3px',
                                          padding: '0.15rem 0.35rem',
                                          fontSize: '0.7rem',
                                          fontWeight: isSelected ? 800 : 600,
                                          cursor: 'pointer'
                                        }}
                                      >
                                        {pct}%
                                      </button>
                                    );
                                  })}
                                </div>
                                <input
                                  type="range"
                                  min="20"
                                  max="100"
                                  step="5"
                                  value={item.width_pct || 80}
                                  onChange={e => handleUpdateContentItem(secIdx, itemIdx, 'width_pct', Number(e.target.value))}
                                  style={{ flex: 1, minWidth: '60px', height: '4px', accentColor: '#4f46e5', cursor: 'pointer' }}
                                />
                                <span style={{ fontWeight: 800, color: '#4f46e5', minWidth: '32px', textAlign: 'right' }}>
                                  {item.width_pct || 80}%
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Table element in Word mode */}
                        {item.type === 'table' && (
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}>
                              <thead>
                                <tr style={{ background: '#f1f5f9' }}>
                                  {(item.table_data?.headers || []).map((h, hIdx) => (
                                    <th key={hIdx} style={{ border: '1px solid #cbd5e1', padding: '0.4rem' }}>
                                      <input
                                        type="text"
                                        value={h}
                                        onChange={e => {
                                          const nextHeaders = [...item.table_data.headers];
                                          nextHeaders[hIdx] = e.target.value;
                                          handleUpdateContentItem(secIdx, itemIdx, 'table_data', { ...item.table_data, headers: nextHeaders });
                                        }}
                                        style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontWeight: 800, outline: 'none' }}
                                      />
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {(item.table_data?.rows || []).map((row, rIdx) => (
                                  <tr key={rIdx}>
                                    {row.map((cell, cIdx) => (
                                      <td key={cIdx} style={{ border: '1px solid #cbd5e1', padding: '0.4rem' }}>
                                        <input
                                          type="text"
                                          value={cell}
                                          onChange={e => {
                                            const nextRows = item.table_data.rows.map((r, ri) => ri === rIdx ? r.map((c, ci) => ci === cIdx ? e.target.value : c) : r);
                                            handleUpdateContentItem(secIdx, itemIdx, 'table_data', { ...item.table_data, rows: nextRows });
                                          }}
                                          style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', outline: 'none' }}
                                        />
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Quick Insert Element Toolbar at section footer */}
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.4rem', alignItems: 'center' }}>
                      <button onClick={() => handleAddItemToContentSection(secIdx, 'text')} style={{ background: '#ffffff', border: '1px dashed #cbd5e1', borderRadius: '4px', padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, color: '#005086', cursor: 'pointer' }}>
                        + Paragraphe
                      </button>
                      <button onClick={() => handleAddItemToContentSection(secIdx, 'bullet')} style={{ background: '#ffffff', border: '1px dashed #cbd5e1', borderRadius: '4px', padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, color: '#005086', cursor: 'pointer' }}>
                        + Puce
                      </button>
                      <button onClick={() => handleAddItemToContentSection(secIdx, 'highlight_box')} style={{ background: '#ffffff', border: '1px dashed #cbd5e1', borderRadius: '4px', padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, color: '#b45309', cursor: 'pointer' }}>
                        + Encadré Formule
                      </button>
                      <button onClick={() => handleAddItemToContentSection(secIdx, 'table')} style={{ background: '#ffffff', border: '1px dashed #cbd5e1', borderRadius: '4px', padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, color: '#047857', cursor: 'pointer' }}>
                        + Tableau
                      </button>
                      <button onClick={() => {
                        setCropperTarget({ secIdx, itemIdx: null });
                        setIsCropperOpen(true);
                      }} style={{ background: '#ffffff', border: '1px dashed #cbd5e1', borderRadius: '4px', padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, color: '#6d28d9', cursor: 'pointer' }}>
                        ✂️ + Figure PDF
                      </button>
                      <ImageDropZone
                        compact
                        onImageInsert={(dataUrl, alt) => {
                          setSections(prev => {
                            const next = [...prev];
                            const sec = { ...next[secIdx] };
                            const items = Array.isArray(sec.items) ? [...sec.items] : [];
                            items.push({ type: 'image', url: dataUrl, alt, width_pct: 80, align: 'center' });
                            sec.items = items;
                            next[secIdx] = sec;
                            return next;
                          });
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  /* Exercise and Solution Block */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #fca5a5' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#b91c1c' }}>
                          📌 Énoncé de l'Exercice :
                        </div>
                        {/* Custom Exercise Style Toolbar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', background: '#f8fafc', padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          {/* Background Color */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Palette size={13} style={{ color: '#005086' }} />
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>الخلفية :</span>
                            <div style={{ display: 'flex', gap: '2.5px', alignItems: 'center' }}>
                              {[
                                { label: 'Sans fond', val: 'transparent', color: '#ffffff', border: '#cbd5e1' },
                                { label: 'Bleu doux', val: '#f0f9ff', color: '#f0f9ff', border: '#bae6fd' },
                                { label: 'Jaune doux', val: '#fefce8', color: '#fefce8', border: '#fef08a' },
                                { label: 'Vert menthe', val: '#f0fdf4', color: '#f0fdf4', border: '#bbf7d0' },
                                { label: 'Gris élégant', val: '#f8fafc', color: '#f8fafc', border: '#e2e8f0' },
                                { label: 'Rose pastel', val: '#fff1f2', color: '#fff1f2', border: '#fecdd3' },
                              ].map(c => (
                                <button
                                  key={c.val}
                                  type="button"
                                  onClick={() => handleUpdateSection(secIdx, 'bgColor', (sec.bgColor || 'transparent') === c.val ? 'transparent' : c.val)}
                                  title={c.label}
                                  style={{
                                    width: '16px',
                                    height: '16px',
                                    borderRadius: '50%',
                                    background: c.color,
                                    border: `2px solid ${(sec.bgColor || 'transparent') === c.val ? '#005086' : c.border}`,
                                    cursor: 'pointer',
                                    padding: 0
                                  }}
                                />
                              ))}
                              <input
                                type="color"
                                value={sec.bgColor && sec.bgColor !== 'transparent' ? sec.bgColor : '#ffffff'}
                                onChange={e => handleUpdateSection(secIdx, 'bgColor', e.target.value)}
                                title="Couleur personnalisée"
                                style={{ width: '18px', height: '18px', padding: 0, border: 'none', borderRadius: '3px', cursor: 'pointer', background: 'transparent' }}
                              />
                            </div>
                          </div>

                          <span style={{ color: '#cbd5e1' }}>|</span>

                          {/* Font Size */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Type size={13} style={{ color: '#005086' }} />
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>الحجم :</span>
                            <select
                              value={sec.fontSize || ''}
                              onChange={e => handleUpdateSection(secIdx, 'fontSize', e.target.value)}
                              style={{ fontSize: '0.7rem', padding: '1px 4px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', fontWeight: 600, outline: 'none' }}
                            >
                              <option value="">Standard (9.2pt)</option>
                              <option value="8pt">8pt (Compact)</option>
                              <option value="8.5pt">8.5pt</option>
                              <option value="9.2pt">9.2pt (Normal)</option>
                              <option value="10pt">10pt</option>
                              <option value="11pt">11pt (Grand)</option>
                            </select>
                          </div>

                          <span style={{ color: '#cbd5e1' }}>|</span>

                          {/* Line Spacing */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Layers size={13} style={{ color: '#005086' }} />
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>التباعد :</span>
                            <select
                              value={sec.lineHeight || ''}
                              onChange={e => handleUpdateSection(secIdx, 'lineHeight', e.target.value)}
                              style={{ fontSize: '0.7rem', padding: '1px 4px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', fontWeight: 600, outline: 'none' }}
                            >
                              <option value="">Normal (1.55)</option>
                              <option value="1.3">1.3 (Serré)</option>
                              <option value="1.55">1.55 (Standard)</option>
                              <option value="1.75">1.75 (Aéré)</option>
                              <option value="2.0">2.0 (Spacieux)</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <textarea
                        value={sec.content || ''}
                        onChange={e => handleUpdateSection(secIdx, 'content', e.target.value)}
                        onFocus={() => setActiveFieldTarget({ secIdx, field: 'exerciseContent' })}
                        placeholder="Écrivez l'énoncé de l'exercice..."
                        rows={3}
                        style={{
                          width: '100%',
                          border: '1px dashed #fca5a5',
                          borderRadius: '4px',
                          padding: '0.5rem',
                          fontSize: sec.fontSize || '0.88rem',
                          lineHeight: sec.lineHeight || 1.55,
                          background: sec.bgColor && sec.bgColor !== 'transparent' ? sec.bgColor : '#ffffff',
                          outline: 'none',
                          fontFamily: 'inherit'
                        }}
                      />
                      {sec.content && (
                        <div style={{
                          marginTop: '0.35rem',
                          padding: '0.45rem 0.65rem',
                          background: sec.bgColor && sec.bgColor !== 'transparent' ? sec.bgColor : '#fff5f5',
                          borderRadius: '4px',
                          border: '1px solid ' + (sec.bgColor && sec.bgColor !== 'transparent' ? 'rgba(0,80,134,0.2)' : '#fee2e2'),
                          fontSize: sec.fontSize || '0.85rem',
                          lineHeight: sec.lineHeight || 1.55
                        }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#b91c1c', display: 'block', marginBottom: '2px' }}>Aperçu Énoncé :</span>
                          <div>{renderWithMath(sec.content)}</div>
                        </div>
                      )}
                    </div>

                    <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #86efac' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#15803d', marginBottom: '0.3rem' }}>
                        💡 Corrigé Détaillé :
                      </div>
                      <textarea
                        value={sec.solution || ''}
                        onChange={e => handleUpdateSection(secIdx, 'solution', e.target.value)}
                        onFocus={() => setActiveFieldTarget({ secIdx, field: 'exerciseSolution' })}
                        placeholder="Écrivez la solution détaillée..."
                        rows={4}
                        style={{ width: '100%', border: '1px dashed #86efac', borderRadius: '4px', padding: '0.5rem', fontSize: '0.88rem', outline: 'none', fontFamily: 'inherit' }}
                      />
                      {sec.solution && (
                        <div style={{ marginTop: '0.35rem', padding: '0.35rem 0.5rem', background: '#f0fdf4', borderRadius: '4px', border: '1px solid #dcfce7', fontSize: '0.85rem' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#15803d', display: 'block', marginBottom: '2px' }}>Aperçu Corrigé :</span>
                          <div>{renderWithMath(sec.solution)}</div>
                        </div>
                      )}
                    </div>

                    {/* Exercise Attached Images & Tables */}
                    {Array.isArray(sec.items) && sec.items.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '0.75rem', background: '#f8fafc' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span>🖼️ Figures et Éléments attachés à cet exercice :</span>
                          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{sec.items.filter(i => i.type === 'image').length} figure(s)</span>
                        </div>
                        {sec.items.map((it, itIdx) => {
                          if (it.type === 'image') {
                            return (
                              <div key={itIdx} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', background: '#fff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                                {/* Top Row: Preview, Caption & Delete */}
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                  <div style={{ position: 'relative', width: '90px', height: '65px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <img src={it.url} alt={it.alt || ''} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                    <span style={{ position: 'absolute', bottom: 2, right: 2, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '0.62rem', padding: '1px 4px', borderRadius: '3px' }}>
                                      {it.width_pct || 80}%
                                    </span>
                                  </div>
                                  
                                  <div style={{ flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b' }}>Légende / Titre de la figure :</label>
                                    <input
                                      type="text"
                                      value={it.alt || ''}
                                      onChange={e => handleUpdateContentItem(secIdx, itIdx, 'alt', e.target.value)}
                                      placeholder="Figure géométrique, schéma..."
                                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '4px', width: '100%' }}
                                    />
                                  </div>

                                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCropperTarget({ secIdx, itemIdx: itIdx });
                                        setIsCropperOpen(true);
                                      }}
                                      style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.35rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                                      title="Recadrer depuis PDF"
                                    >
                                      <Crop size={12} /> Recadrer
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveItemFromContentSection(secIdx, itIdx)}
                                      style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#ef4444', borderRadius: '4px', padding: '0.35rem 0.5rem', cursor: 'pointer' }}
                                      title="Supprimer la figure"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>

                                {/* Controls Row: Alignment, Size (Width %) & Position */}
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', paddingTop: '0.5rem', borderTop: '1px dashed #e2e8f0', fontSize: '0.75rem' }}>
                                  {/* Alignment */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <span style={{ fontWeight: 700, color: '#475569' }}>الموقع / Position :</span>
                                    <div style={{ display: 'inline-flex', borderRadius: '4px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
                                      {[
                                        { id: 'left', label: 'اليسار (Gauche)', icon: <AlignLeft size={13} /> },
                                        { id: 'center', label: 'الوسط (Centré)', icon: <AlignCenter size={13} /> },
                                        { id: 'right', label: 'اليمين (Droite)', icon: <AlignRight size={13} /> }
                                      ].map(pos => {
                                        const isSelected = (it.align || 'center') === pos.id;
                                        return (
                                          <button
                                            key={pos.id}
                                            type="button"
                                            onClick={() => handleUpdateContentItem(secIdx, itIdx, 'align', pos.id)}
                                            style={{
                                              background: isSelected ? '#005086' : '#ffffff',
                                              color: isSelected ? '#ffffff' : '#475569',
                                              border: 'none',
                                              padding: '0.25rem 0.5rem',
                                              cursor: 'pointer',
                                              display: 'inline-flex',
                                              alignItems: 'center'
                                            }}
                                            title={pos.label}
                                          >
                                            {pos.icon}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Size / Width Presets & Slider */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: '210px' }}>
                                    <span style={{ fontWeight: 700, color: '#475569' }}>الحجم / Largeur :</span>
                                    <div style={{ display: 'flex', gap: '0.2rem' }}>
                                      {[30, 50, 75, 100].map(pct => {
                                        const isSelected = (it.width_pct || 80) === pct;
                                        return (
                                          <button
                                            key={pct}
                                            type="button"
                                            onClick={() => handleUpdateContentItem(secIdx, itIdx, 'width_pct', pct)}
                                            style={{
                                              background: isSelected ? '#4f46e5' : '#f1f5f9',
                                              color: isSelected ? '#ffffff' : '#334155',
                                              border: '1px solid ' + (isSelected ? '#4338ca' : '#cbd5e1'),
                                              borderRadius: '3px',
                                              padding: '0.15rem 0.35rem',
                                              fontSize: '0.7rem',
                                              fontWeight: isSelected ? 800 : 600,
                                              cursor: 'pointer'
                                            }}
                                          >
                                            {pct}%
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <input
                                      type="range"
                                      min="20"
                                      max="100"
                                      step="5"
                                      value={it.width_pct || 80}
                                      onChange={e => handleUpdateContentItem(secIdx, itIdx, 'width_pct', Number(e.target.value))}
                                      style={{ flex: 1, minWidth: '55px', height: '4px', accentColor: '#4f46e5', cursor: 'pointer' }}
                                    />
                                    <span style={{ fontWeight: 800, color: '#4f46e5', minWidth: '32px', textAlign: 'right' }}>
                                      {it.width_pct || 80}%
                                    </span>
                                  </div>

                                  {/* Position in Exercise: Before / After */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <span style={{ fontWeight: 700, color: '#475569' }}>الموضع :</span>
                                    <select
                                      value={it.position || 'after'}
                                      onChange={e => handleUpdateContentItem(secIdx, itIdx, 'position', e.target.value)}
                                      style={{ fontSize: '0.72rem', padding: '0.2rem 0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', color: '#1e293b' }}
                                    >
                                      <option value="after">🔽 بعد نص التمرين (Bas)</option>
                                      <option value="before">🔼 قبل نص التمرين (Haut)</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    )}

                    {/* Quick Insert Toolbar for Exercises */}
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <button onClick={() => {
                        setCropperTarget({ secIdx, itemIdx: null });
                        setIsCropperOpen(true);
                      }} style={{ background: '#ffffff', border: '1px dashed #cbd5e1', borderRadius: '4px', padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, color: '#6d28d9', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Crop size={12} /> ✂️ + Figure PDF
                      </button>
                      <ImageDropZone
                        compact
                        onImageInsert={(dataUrl, alt) => {
                          setSections(prev => {
                            const next = [...prev];
                            const sec = { ...next[secIdx] };
                            const items = Array.isArray(sec.items) ? [...sec.items] : [];
                            items.push({ type: 'image', url: dataUrl, alt, width_pct: 80, align: 'center' });
                            sec.items = items;
                            next[secIdx] = sec;
                            return next;
                          });
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Big Add Section Button on Canvas */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', margin: '2rem 0' }}>
            <button
              onClick={() => handleAddSection('content')}
              style={{
                background: 'linear-gradient(135deg, #005086, #0284c7)',
                color: '#ffffff',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                fontWeight: 800,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 12px rgba(0,80,134,0.2)'
              }}
            >
              <Plus size={16} /> + Ajouter une Section de Cours
            </button>
            <button
              onClick={() => handleAddSection('exercise')}
              style={{
                background: 'linear-gradient(135deg, #dc2626, #ef4444)',
                color: '#ffffff',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                fontWeight: 800,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 12px rgba(220,38,38,0.2)'
              }}
            >
              <Plus size={16} /> + Ajouter un Exercice
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '5rem' }}>
      
      {/* ── Top Header & View Mode Switcher ── */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
        flexWrap: 'wrap',
        gap: '1rem',
        borderBottom: '1px solid var(--border)',
        paddingBottom: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <button onClick={() => navigate('/admin/lessons')} className="btn-outline" style={{ padding: '0.5rem 0.75rem' }} title="Retour aux cours">
            <ArrowLeft size={16} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>
                Éditeur Complet — {ficheTitle || 'Fiche de Cours'}
              </h1>
              <span style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--violet)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800 }}>
                Word Live
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
              Édition visuelle en direct, formules mathématiques KaTeX et mise en page officielle.
            </p>
          </div>
        </div>

        {/* View Mode Switcher Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <button
            onClick={() => setViewMode('word')}
            style={{
              background: viewMode === 'word' ? 'var(--violet)' : 'transparent',
              color: viewMode === 'word' ? '#ffffff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: '8px',
              padding: '0.45rem 0.9rem',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s ease'
            }}
          >
            <FileText size={15} /> <span>Mode Document Word</span>
          </button>
          
          <button
            onClick={() => setViewMode('split')}
            style={{
              background: viewMode === 'split' ? 'var(--violet)' : 'transparent',
              color: viewMode === 'split' ? '#ffffff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: '8px',
              padding: '0.45rem 0.9rem',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s ease'
            }}
          >
            <Split size={15} /> <span>Écran Divisé</span>
          </button>

          <button
            onClick={() => setViewMode('form')}
            style={{
              background: viewMode === 'form' ? 'var(--violet)' : 'transparent',
              color: viewMode === 'form' ? '#ffffff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: '8px',
              padding: '0.45rem 0.9rem',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s ease'
            }}
          >
            <Columns size={15} /> <span>Mode Formulaire</span>
          </button>
        </div>
      </header>

      {/* ── Status Alerts ── */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', borderRadius: '12px', padding: '0.85rem 1.25rem', color: 'var(--danger)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertCircle size={20} />
          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.88rem' }}>{error}</p>
        </div>
      )}

      {success && (
        <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid var(--emerald)', borderRadius: '12px', padding: '0.85rem 1.25rem', color: 'var(--emerald)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <CheckCircle size={20} />
          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.88rem' }}>{success}</p>
        </div>
      )}

      {/* ── MICROSOFT WORD OFFICE STYLE RIBBON TOOLBAR ── */}
      <div className="word-ribbon-container" style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        marginBottom: '1.5rem',
        overflow: 'hidden',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
      }}>
        {/* Ribbon Tabs Header */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          background: 'rgba(255,255,255,0.02)',
          padding: '0 0.5rem'
        }}>
          {[
            { id: 'home', label: '📌 Accueil & Styles', icon: Type },
            { id: 'math', label: '🧮 Formules & Math (LaTeX)', icon: Sparkles },
            { id: 'insert', label: '➕ Insertion & Éléments', icon: Plus },
            { id: 'settings', label: '⚙️ Mise en Page', icon: BookOpen }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveRibbonTab(tab.id)}
              style={{
                background: activeRibbonTab === tab.id ? 'var(--bg-card)' : 'transparent',
                color: activeRibbonTab === tab.id ? 'var(--violet)' : 'var(--text-muted)',
                border: 'none',
                borderBottom: activeRibbonTab === tab.id ? '2px solid var(--violet)' : '2px solid transparent',
                padding: '0.65rem 1.1rem',
                fontSize: '0.82rem',
                fontWeight: activeRibbonTab === tab.id ? 800 : 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Ribbon Tab Content Panel */}
        <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          
          {/* TAB 1: ACCUEIL / FORMATTING */}
          {activeRibbonTab === 'home' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', width: '100%' }}>
              <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.04)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <button onClick={() => insertTextOrSnippet('**Texte en gras**')} className="btn-outline" style={{ padding: '0.35rem 0.6rem', border: 'none' }} title="Gras (Ctrl+B)">
                  <Bold size={14} />
                </button>
                <button onClick={() => insertTextOrSnippet('*Texte en italique*')} className="btn-outline" style={{ padding: '0.35rem 0.6rem', border: 'none' }} title="Italique (Ctrl+I)">
                  <Italic size={14} />
                </button>
                <button onClick={() => insertTextOrSnippet('$\\underline{texte}$')} className="btn-outline" style={{ padding: '0.35rem 0.6rem', border: 'none' }} title="Souligné">
                  <Underline size={14} />
                </button>
              </div>

              <div style={{ height: '24px', width: '1px', background: 'var(--border)' }} />

              {/* Block Types Fast Creation */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>Ajouter Bloc :</span>
                {[
                  { label: '📘 Définition', type: 'definition' },
                  { label: '📗 Propriété', type: 'property' },
                  { label: '🔮 Théorème', type: 'theorem' },
                  { label: '💡 Remarque', type: 'remark' },
                  { label: '🎯 Activité', type: 'activity' },
                  { label: '📝 Exercice', type: 'exercise' }
                ].map(b => (
                  <button
                    key={b.type}
                    onClick={() => {
                      if (b.type === 'exercise') {
                        handleAddSection('exercise');
                      } else {
                        const newId = `sec-${Date.now()}`;
                        setSections([...sections, { id: newId, title: b.label.split(' ')[1], type: b.type, items: [{ type: 'text', text: '' }], language: docLanguage }]);
                      }
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: MATH FORMULA INSERTION BAR */}
          {activeRibbonTab === 'math' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', width: '100%' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--violet)', marginRight: '0.25rem' }}>
                Insérer une formule :
              </span>
              {MATH_SNIPPETS.map((snip, sIdx) => (
                <button
                  key={sIdx}
                  onClick={() => insertTextOrSnippet(`$${snip.latex}$`)}
                  title={snip.title}
                  style={{
                    background: 'rgba(99, 102, 241, 0.08)',
                    color: 'var(--text-main)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    borderRadius: '6px',
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--violet)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)'}
                >
                  {snip.label}
                </button>
              ))}
            </div>
          )}

          {/* TAB 3: INSERT ELEMENTS */}
          {activeRibbonTab === 'insert' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', width: '100%' }}>
              <button
                onClick={() => {
                  if (sections.length > 0) {
                    handleAddItemToContentSection(sections.length - 1, 'table');
                  } else {
                    handleAddSection('content');
                  }
                }}
                className="btn-outline"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Table size={14} /> Insérer un Tableau
              </button>

              <button
                onClick={() => {
                  setCropperTarget({ secIdx: Math.max(0, sections.length - 1), itemIdx: null });
                  setIsCropperOpen(true);
                }}
                className="btn-outline"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', color: 'var(--emerald)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Crop size={14} /> ✂️ Découper Figure PDF
              </button>

              <ImageDropZone
                compact
                onImageInsert={(dataUrl, alt) => handleDirectImageInsert(dataUrl, alt)}
              />

              <button
                onClick={() => handleAddSection('exercise')}
                className="btn-outline"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Lightbulb size={14} /> + Nouvel Exercice & Corrigé
              </button>
            </div>
          )}

          {/* TAB 4: SETTINGS & METADATA */}
          {activeRibbonTab === 'settings' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', width: '100%' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block' }}>Langue du Document</label>
                <select className="input-control" value={docLanguage} onChange={e => setDocLanguage(e.target.value)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
                  <option value="fr">Français (LTR)</option>
                  <option value="ar">العربية (RTL)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block' }}>Type de Document</label>
                <select className="input-control" value={docType} onChange={e => setDocType(e.target.value)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
                  <option value="course">درس (Cours)</option>
                  <option value="homework">فرض محروس (Devoir)</option>
                  <option value="national">امتحان وطني (National)</option>
                  <option value="exercises">سلسلة تمارين (Série)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block' }}>Niveau Scolaire</label>
                <select className="input-control" value={selectedLevel} onChange={e => setSelectedLevel(e.target.value)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
                  <option value="2bac_pc_svt">2BAC PC / SVT</option>
                  <option value="2bac_sm">2BAC SM</option>
                  <option value="1bac_sm">1BAC SM</option>
                  <option value="1bac_sc_ex">1BAC Sc Ex</option>
                  <option value="tronc_commun">Tronc Commun</option>
                </select>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── MAIN WORKSPACE CONTENT ── */}
      <ImageDropZone onImageInsert={(dataUrl, alt) => handleDirectImageInsert(dataUrl, alt)}>
        {viewMode === 'word' && (
          <div style={{ maxWidth: '960px', margin: '0 auto' }}>
            {renderLiveWordDocument()}
          </div>
        )}
      </ImageDropZone>

      {viewMode === 'split' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.5rem', alignItems: 'flex-start' }}>
          {/* Left Column: Fast Inputs */}
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)', maxHeight: '900px', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--violet)' }}>
              ⚡ Édition Rapide des Données
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="input-group">
                <label>Titre de la Fiche</label>
                <input type="text" className="input-control" value={ficheTitle} onChange={e => setFicheTitle(e.target.value)} />
              </div>
              <div className="input-group">
                <label>Professeur</label>
                <input type="text" className="input-control" value={teacher} onChange={e => setTeacher(e.target.value)} />
              </div>
              {sections.map((sec, i) => (
                <div key={sec.id || i} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                    Section {i + 1} : {sec.title}
                  </div>
                  {sec.type !== 'exercise' ? (
                    sec.items?.map((it, itIdx) => (
                      <textarea
                        key={itIdx}
                        className="input-control"
                        value={it.text || ''}
                        onChange={e => handleUpdateContentItem(i, itIdx, 'text', e.target.value)}
                        rows={2}
                        style={{ marginBottom: '0.35rem', fontSize: '0.82rem' }}
                      />
                    ))
                  ) : (
                    <>
                      <textarea className="input-control" value={sec.content || ''} onChange={e => handleUpdateSection(i, 'content', e.target.value)} rows={2} style={{ marginBottom: '0.35rem', fontSize: '0.82rem' }} placeholder="Énoncé" />
                      <textarea className="input-control" value={sec.solution || ''} onChange={e => handleUpdateSection(i, 'solution', e.target.value)} rows={2} style={{ fontSize: '0.82rem' }} placeholder="Solution" />
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Live Word Preview */}
          <div style={{ maxHeight: '900px', overflowY: 'auto', borderRadius: '8px' }}>
            {renderLiveWordDocument()}
          </div>
        </div>
      )}

      {viewMode === 'form' && (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          {/* Classic Form View */}
          <div className="glass-panel" style={{ padding: '2rem', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              📁 Informations Générales
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Titre</label>
                <input type="text" className="input-control" value={ficheTitle} onChange={e => setFicheTitle(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Matière</label>
                <input type="text" className="input-control" value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Professeur</label>
                <input type="text" className="input-control" value={teacher} onChange={e => setTeacher(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Form Sections */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {sections.map((sec, secIdx) => (
              <div key={sec.id || secIdx} className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <input type="text" className="input-control" value={sec.title || ''} onChange={e => handleUpdateSection(secIdx, 'title', e.target.value)} style={{ fontWeight: 800, fontSize: '1rem', width: '70%' }} />
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button onClick={() => handleMoveSection(secIdx, 'up')} disabled={secIdx === 0} className="btn-outline" style={{ padding: '0.25rem 0.5rem' }}><ChevronUp size={14} /></button>
                    <button onClick={() => handleMoveSection(secIdx, 'down')} disabled={secIdx === sections.length - 1} className="btn-outline" style={{ padding: '0.25rem 0.5rem' }}><ChevronDown size={14} /></button>
                    <button onClick={() => handleRemoveSection(secIdx)} className="btn-outline" style={{ padding: '0.25rem 0.5rem', color: 'var(--danger)' }}><Trash2 size={14} /></button>
                  </div>
                </div>

                {sec.type !== 'exercise' ? (
                  sec.items?.map((item, itemIdx) => (
                    <div key={itemIdx} style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                      <textarea className="input-control" value={item.text || ''} onChange={e => handleUpdateContentItem(secIdx, itemIdx, 'text', e.target.value)} rows={2} style={{ flex: 1 }} />
                      <button onClick={() => handleRemoveItemFromContentSection(secIdx, itemIdx)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', marginTop: '0.5rem' }}><Trash2 size={14} /></button>
                    </div>
                  ))
                ) : (
                  <div>
                    <textarea className="input-control" value={sec.content || ''} onChange={e => handleUpdateSection(secIdx, 'content', e.target.value)} rows={3} placeholder="Énoncé..." style={{ marginBottom: '0.5rem' }} />
                    <textarea className="input-control" value={sec.solution || ''} onChange={e => handleUpdateSection(secIdx, 'solution', e.target.value)} rows={4} placeholder="Solution..." />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── FLOATING QUICK-SAVE BAR ── */}
      <div style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        background: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.15)',
        padding: '0.6rem 1.25rem',
        borderRadius: '50px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        zIndex: 999
      }}>
        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
          {sections.length} sections • Ctrl+S pour sauvegarder
        </span>

        <button
          onClick={handleSaveLesson}
          disabled={saving}
          style={{
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: '#ffffff',
            border: 'none',
            padding: '0.55rem 1.25rem',
            borderRadius: '30px',
            fontWeight: 800,
            fontSize: '0.85rem',
            cursor: saving ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
            transition: 'transform 0.15s ease'
          }}
        >
          {saving ? (
            <><Loader2 className="animate-spin" size={15} /> Sauvegarde...</>
          ) : (
            <><Save size={15} /> Enregistrer</>
          )}
        </button>
      </div>

      {/* PDF Figure Cropper Modal */}
      <PdfFigureCropperModal
        isOpen={isCropperOpen}
        onClose={() => setIsCropperOpen(false)}
        sections={sections}
        targetSectionIdx={cropperTarget.secIdx}
        targetItemIdx={cropperTarget.itemIdx}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}
