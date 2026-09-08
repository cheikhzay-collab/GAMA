import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLessonById, updateLesson } from '../services/lessonService';
import { getAllClasses } from '../services/classService';
import { 
  ArrowLeft, Save, Trash2, Plus, AlertCircle, 
  CheckCircle, Loader2, ChevronUp, ChevronDown, Crop,
  FileText, Eye, EyeOff, Bold, Italic, 
  Underline, AlignLeft, AlignCenter, AlignRight,
  Table, Image as ImageIcon, Sparkles, Check, X,
  Type, Palette, BookOpen, Layers, Lightbulb, CornerDownLeft,
  GraduationCap, School, Phone, Globe, Tag, Bookmark, CheckSquare, Settings2, Users, Languages,
  Zap, Award, Search, Target, MessageSquare, Link2, HelpCircle, Info, Pin
} from 'lucide-react';
import PdfFigureCropperModal from '../components/PdfFigureCropperModal';
import ImageDropZone from '../components/ImageDropZone';
import FloatingLatexPalette from '../components/FloatingLatexPalette';
import { solveExerciseWithAI } from '../utils/aiExerciseSolver';
import { renderWithMath } from '../utils/mathRenderer';
import { normalizeLevel, getLevelDisplayName } from '../utils/levelHelpers';

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

const MOROCCAN_LEVELS = [
  { id: 'common_core_sci', labelFr: 'Tronc Commun Scientifique', labelAr: 'جدع مشترك علمي' },
  { id: 'common_core_arts', labelFr: 'Tronc Commun Lettres & Humanités', labelAr: 'جدع مشترك آداب وعلوم إنسانية' },
  { id: '1bac_sci', labelFr: '1ère Bac Sciences Expérimentales', labelAr: 'أولى باك علوم تجريبية' },
  { id: '1bac_sm', labelFr: '1ère Bac Sciences Mathématiques', labelAr: 'أولى باك علوم رياضية' },
  { id: '1bac_arts', labelFr: '1ère Bac Lettres & Sciences Humaines', labelAr: 'أولى باك آداب وعلوم إنسانية' },
  { id: '2bac_pc_svt', labelFr: '2ème Bac Sciences Expérimentales (PC/SVT)', labelAr: 'ثانية باك علوم تجريبية (PC/SVT)' },
  { id: '2bac_sm', labelFr: '2ème Bac Sciences Mathématiques (A/B)', labelAr: 'ثانية باك علوم رياضية (أ/ب)' },
  { id: '2bac_arts', labelFr: '2ème Bac Lettres & Sciences Humaines', labelAr: 'ثانية باك آداب وعلوم إنسانية' }
];

const DOC_TYPES = [
  { id: 'course', labelFr: 'Cours théorique (Fiche)', labelAr: 'درس نظري (جذاذة تربوية)' },
  { id: 'exercises', labelFr: 'Série d\'exercices', labelAr: 'سلسلة تمارين تطبيقية' },
  { id: 'homework', labelFr: 'Devoir surveillé (Contrôle)', labelAr: 'فرض محروس (مراقبة مستمرة)' },
  { id: 'national', labelFr: 'Examen National', labelAr: 'امتحان وطني موحد' },
  { id: 'summary', labelFr: 'Résumé de cours', labelAr: 'ملخص درس ومركز' },
  { id: 'concours', labelFr: 'Concours d\'accès', labelAr: 'مباراة ولوج المعاهد والمدارس' }
];

const COMMON_SUBJECTS = [
  'Mathématiques',
  'Physique-Chimie',
  'Sciences de la Vie et de la Terre (SVT)',
  'Philosophie',
  'Français',
  'Anglais',
  'Informatique',
  'Éducation Islamique'
];

const autoRepairMathText = (str) => {
  if (!str || typeof str !== 'string') return str;
  let res = str;
  // Repair unclosed math environments missing trailing $ (e.g. "$... \begin{cases} ... \end{cases}" with no closing $)
  res = res.replace(/(\$(?:(?!\$).)*?\\begin\{(?:cases|aligned|matrix|pmatrix|vmatrix|array|gather)\}[\s\S]*?\\end\{(?:cases|aligned|matrix|pmatrix|vmatrix|array|gather)\})(?!\$)/g, '$1$');
  // Wrap bare math environments without any dollar delimiters
  res = res.replace(/(?<![\$\\])(\\begin\{(?:cases|aligned|matrix|pmatrix|vmatrix|array|gather)\}[\s\S]*?\\end\{(?:cases|aligned|matrix|pmatrix|vmatrix|array|gather)\})(?!\$)/g, '$$$1$$');
  return res;
};

export default function AdminLessonEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();

  const goBack = () => {
    if (location.state?.from) {
      navigate(location.state.from);
      return;
    }
    const savedOrigin = sessionStorage.getItem('last_lessons_origin');
    if (savedOrigin) {
      navigate(savedOrigin);
      return;
    }
    if (window.history.length > 2) {
      navigate(-1);
      return;
    }
    navigate('/admin/lessons');
  };

  // Component States
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [activeRibbonTab, setActiveRibbonTab] = useState('home'); // 'home' | 'math' | 'insert' | 'settings'

  // Header metadata
  const [ficheTitle, setFicheTitle] = useState('');
  const [subject, setSubject] = useState('Mathématiques');
  const [chapterNumber, setChapterNumber] = useState('');
  const [teacher, setTeacher] = useState('');
  const [phone, setPhone] = useState('');
  const [prepTitle, setPrepTitle] = useState('Préparation aux concours');
  const [selectedLevel, setSelectedLevel] = useState('2bac_pc_svt');
  const [docType, setDocType] = useState('course');
  const [docLanguage, setDocLanguage] = useState('fr');
  const [schools, setSchools] = useState([]);
  const [isActiveStatus, setIsActiveStatus] = useState(true);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [customClassInput, setCustomClassInput] = useState('');
  const [isGeneralInfoExpanded, setIsGeneralInfoExpanded] = useState(true);
  const [columnsCount, setColumnsCount] = useState(2);

  // Pedagogical Objectives (Fiche header fields)
  const [capacitesAttendues, setCapacitesAttendues] = useState('');
  const [contenus, setContenus] = useState('');
  const [leContenu, setLeContenu] = useState('');

  // Load registered classes
  useEffect(() => {
    getAllClasses().then(cls => setAvailableClasses(cls || [])).catch(() => {});
  }, []);
  
  // Sections state
  const [sections, setSections] = useState([]);

  // Active focused input/textarea for ribbon insertions
  const [activeFieldTarget, setActiveFieldTarget] = useState(null); // { secIdx, itemIdx, field: 'text'|'title'|'content'|'solution' }
  const activeTextareaRef = useRef(null);

  // Floating LaTeX Math Palette State
  const [isLatexPaletteOpen, setIsLatexPaletteOpen] = useState(false);
  const [solvingSecIdx, setSolvingSecIdx] = useState(null);

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
          setSubject(data.subject || 'Mathématiques');
          setChapterNumber(data.chapterNumber || '');
          setTeacher(data.teacher || '');
          setPhone(data.phone || '');
          setSchools(Array.isArray(data.schools) ? data.schools : (data.content?.header?.schools || []));
          setIsActiveStatus(data.isActive !== undefined ? data.isActive : (data.is_active !== undefined ? data.is_active : true));
          
          const header = data.content?.header || {};
          setPrepTitle(header.prep_title || 'Préparation aux concours');
          setSelectedLevel(normalizeLevel(data.level || data.content?.level || '2bac_pc_svt'));
          setDocType(data.docType || data.content?.doc_type || 'course');
          setDocLanguage(data.content?.metadata?.language || header.metadata?.language || 'fr');
          setColumnsCount(Number(data.content?.columns_count || data.columnsCount || 2));

          setCapacitesAttendues(header.capacites_attendues || '');
          setContenus(header.contenus || '');
          setLeContenu(header.le_contenu || '');
          
          const loadedSections = (data.content?.sections || []).map(sec => {
            const hasAr = /[\u0600-\u06FF]/.test((sec.title || '') + ' ' + (sec.content || '') + ' ' + (sec.solution || '') + ' ' + (sec.items || []).map(it => it.text || '').join(' '));
            const rawContent = (sec.content && sec.content.trim())
              ? sec.content
              : (Array.isArray(sec.items)
                  ? sec.items.filter(it => it.type !== 'image').map(it => it.text || it.content || '').filter(Boolean).join('\n\n')
                  : '');
            return {
              ...sec,
              content: autoRepairMathText(rawContent),
              solution: autoRepairMathText(sec.solution || ''),
              items: (sec.items || []).map(it => ({
                ...it,
                text: autoRepairMathText(it.text || it.content)
              })),
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
  const handleAddSection = (type = 'exercise') => {
    const newId = `sec-${Date.now()}`;
    const titles = {
      exercise: 'Nouvel Exercice',
      content: 'Nouvelle Section de Cours',
      definition: 'Nouvelle Définition',
      property: 'Nouvelle Propriété',
      theorem: 'Nouveau Théorème',
      remark: 'Nouvelle Remarque',
      example: 'Nouvel Exemple',
      activity: 'Nouvelle Activité',
      corollary: 'Nouveau Corollaire'
    };
    const newSec = {
      id: newId,
      title: titles[type] || 'Nouvelle Section',
      type: type,
      section_number: '',
      section_header: '',
      content: '',
      solution: '',
      items: [],
      language: docLanguage
    };
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

  // Smart cursor-aware LaTeX / Text insertion
  const insertTextOrSnippet = (snippet) => {
    const el = activeTextareaRef.current;
    
    // Check if target is a valid input/textarea element in the DOM
    if (el && document.body.contains(el)) {
      const start = el.selectionStart ?? el.value?.length ?? 0;
      const end = el.selectionEnd ?? el.value?.length ?? 0;
      const val = el.value || '';
      
      // Check if cursor is currently inside math mode ($...$)
      const prefix = val.substring(0, start);
      const dollarCount = (prefix.match(/(?<!\\)\$/g) || []).length;
      const isInsideMath = (dollarCount % 2 === 1);

      let textToInsert = snippet;
      const isFormulaSnippet = snippet.startsWith('\\') || snippet.startsWith('$') || snippet.includes('\\');

      if (isFormulaSnippet) {
        if (isInsideMath) {
          // If already inside $...$, strip outer $ if present
          if (textToInsert.startsWith('$') && textToInsert.endsWith('$') && textToInsert.length >= 2) {
            textToInsert = textToInsert.slice(1, -1);
          }
        } else {
          // If outside $...$, ensure it is wrapped in $
          if (!textToInsert.startsWith('$') && !textToInsert.endsWith('$')) {
            textToInsert = `$${textToInsert}$`;
          }
        }
      }

      // If user had text selected, see if we can wrap it (e.g. \frac, \sqrt)
      const selected = val.substring(start, end);
      if (selected) {
        if (textToInsert.includes('{a}')) {
          textToInsert = textToInsert.replace('{a}', `{${selected}}`);
        } else if (textToInsert.includes('{x}')) {
          textToInsert = textToInsert.replace('{x}', `{${selected}}`);
        }
      }

      const newVal = val.substring(0, start) + textToInsert + val.substring(end);
      
      // Update relevant state
      if (activeFieldTarget) {
        const { secIdx, itemIdx, field } = activeFieldTarget;
        if (field === 'ficheTitle') {
          setFicheTitle(newVal);
        } else if (field === 'capacites') {
          setCapacitesAttendues(newVal);
        } else if (field === 'contenus') {
          setContenus(newVal);
        } else if (field === 'sectionTitle' && secIdx !== undefined) {
          handleUpdateSection(secIdx, 'title', newVal);
        } else if ((field === 'exerciseContent' || field === 'sectionContent') && secIdx !== undefined) {
          handleUpdateSection(secIdx, 'content', newVal);
        } else if ((field === 'exerciseSolution' || field === 'sectionSolution') && secIdx !== undefined) {
          handleUpdateSection(secIdx, 'solution', newVal);
        } else if (field === 'itemText' && secIdx !== undefined && itemIdx !== null && itemIdx !== undefined) {
          handleUpdateContentItem(secIdx, itemIdx, 'text', newVal);
        }
      } else {
        el.value = newVal;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Restore focus and cursor position right after insertion
      requestAnimationFrame(() => {
        el.focus();
        const nextPos = start + textToInsert.length;
        el.setSelectionRange(nextPos, nextPos);
      });
      return;
    }

    // Fallback if no ref or active element
    if (!activeFieldTarget) {
      if (sections.length > 0) {
        const lastIdx = sections.length - 1;
        handleUpdateSection(lastIdx, 'content', (sections[lastIdx].content || '') + ' ' + snippet);
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
    } else if ((field === 'exerciseContent' || field === 'sectionContent') && secIdx !== undefined) {
      handleUpdateSection(secIdx, 'content', (sections[secIdx]?.content || '') + ' ' + snippet);
    } else if ((field === 'exerciseSolution' || field === 'sectionSolution') && secIdx !== undefined) {
      handleUpdateSection(secIdx, 'solution', (sections[secIdx]?.solution || '') + ' ' + snippet);
    } else if (field === 'itemText' && secIdx !== undefined && itemIdx !== null && itemIdx !== undefined) {
      const curr = sections[secIdx]?.items?.[itemIdx]?.text || '';
      handleUpdateContentItem(secIdx, itemIdx, 'text', curr + ' ' + snippet);
    }
  };

  // AI-Powered Exercise Solver
  const handleAiSolveExercise = async (secIdx) => {
    const sec = sections[secIdx];
    if (!sec) return;
    
    const contentToSolve = (sec.content || '').trim();
    if (!contentToSolve) {
      alert(isArMode ? 'يرجى كتابة نص التمرين أولاً ليتمكن الذكاء الاصطناعي من حله.' : "Veuillez d'abord rédiger l'énoncé de l'exercice avant de demander sa résolution par IA.");
      return;
    }

    if (sec.solution && sec.solution.trim()) {
      const confirmOverwrite = window.confirm(
        isArMode
          ? 'يوجد حل مسجل بالفعل لهذا التمرين. هل تريد استبداله بحل مفصل جديد تم توليده بالذكاء الاصطناعي؟'
          : 'Un corrigé existe déjà pour cet exercice. Voulez-vous le remplacer par une nouvelle solution détaillée générée par IA ?'
      );
      if (!confirmOverwrite) return;
    }

    setSolvingSecIdx(secIdx);
    setError('');
    try {
      const generatedSolution = await solveExerciseWithAI(contentToSolve, {
        level: selectedLevel,
        subject: subject || 'Mathématiques',
        language: docLanguage || 'fr',
        docTitle: ficheTitle || ''
      });

      const repairedSolution = autoRepairMathText(generatedSolution);
      handleUpdateSection(secIdx, 'solution', repairedSolution);
      setSuccess(isArMode ? 'تم حل التمرين بالذكاء الاصطناعي بنجاح ✓' : 'Corrigé généré par IA avec succès ✓');
      setTimeout(() => setSuccess(''), 3500);
    } catch (err) {
      console.error('AI Solving Error:', err);
      alert(err.message || 'فشل توليد الحل بالذكاء الاصطناعي.');
    } finally {
      setSolvingSecIdx(null);
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
      const cleanedSections = sections.map(sec => ({
        ...sec,
        content: autoRepairMathText(sec.content),
        solution: autoRepairMathText(sec.solution),
        items: (sec.items || []).map(it => ({
          ...it,
          text: autoRepairMathText(it.text || it.content)
        }))
      }));
      setSections(cleanedSections);

      const lessonData = {
        title: ficheTitle,
        subject,
        chapterNumber,
        teacher,
        phone,
        schools,
        level: selectedLevel,
        docType: docType,
        columnsCount: Number(columnsCount),
        isActive: isActiveStatus,
        content: {
          level: selectedLevel,
          doc_type: docType,
          columns_count: Number(columnsCount),
          metadata: {
            ...lesson?.content?.metadata,
            language: docLanguage
          },
          header: {
            prep_title: prepTitle,
            schools,
            subject,
            fiche_title: ficheTitle,
            teacher,
            phone,
            capacites_attendues: capacitesAttendues,
            contenus: contenus,
            le_contenu: leContenu
          },
          sections: cleanedSections
        }
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

  const handleToggleClass = (className) => {
    if (!className) return;
    setSchools(prev => {
      const exists = prev.includes(className);
      if (exists) {
        return prev.filter(c => c !== className);
      } else {
        return [...prev, className];
      }
    });
  };

  const handleAddCustomClass = () => {
    const trimmed = customClassInput.trim();
    if (trimmed && !schools.includes(trimmed)) {
      setSchools(prev => [...prev, trimmed]);
      setCustomClassInput('');
    }
  };

  // ── RENDER SIMPLIFIED DOCUMENT METADATA PANEL ──
  const renderGeneralInfoPanel = () => {
    return (
      <div 
        style={{ 
          background: 'var(--bg-card)', 
          border: '1px solid var(--border)', 
          borderRadius: '12px', 
          padding: '0.85rem 1.25rem', 
          marginBottom: '1.25rem',
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)'
        }}
      >
        {/* Top summary bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Settings2 size={16} style={{ color: 'var(--violet)' }} />
              Informations du document
            </span>
            <span style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--violet)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>
              {getLevelDisplayName(selectedLevel, isArMode)}
            </span>
            <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--emerald)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>
              {DOC_TYPES.find(d => d.id === docType)?.[isArMode ? 'labelAr' : 'labelFr'] || docType}
            </span>
            <span style={{ background: isActiveStatus ? 'rgba(16, 185, 129, 0.1)' : 'rgba(148, 163, 184, 0.1)', color: isActiveStatus ? 'var(--emerald)' : 'var(--text-muted)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>
              {isActiveStatus ? '● Active' : '○ Masquée'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsGeneralInfoExpanded(prev => !prev)}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '0.3rem 0.65rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--text-main)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem'
            }}
          >
            {isGeneralInfoExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            <span>{isGeneralInfoExpanded ? 'Réduire' : 'Modifier'}</span>
          </button>
        </div>

        {/* Simplified Collapsible Body */}
        {isGeneralInfoExpanded && (
          <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* ROW 1: Titre, Niveau, Type, Colonnes */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : (docType === 'exercises' ? '2.2fr 1.2fr 1fr 1.1fr' : '2.5fr 1.3fr 1.2fr'), gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem', display: 'block' }}>
                  Titre du document
                </label>
                <input 
                  type="text" 
                  className="input-control" 
                  value={ficheTitle} 
                  onChange={e => setFicheTitle(e.target.value)}
                  placeholder="Ex : Limites et continuité" 
                  style={{ width: '100%', fontSize: '0.85rem', padding: '0.4rem 0.6rem', fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem', display: 'block' }}>
                  Niveau scolaire
                </label>
                <select 
                  className="input-control" 
                  value={selectedLevel} 
                  onChange={e => setSelectedLevel(e.target.value)}
                  style={{ width: '100%', fontSize: '0.82rem', padding: '0.4rem 0.5rem' }}
                >
                  {MOROCCAN_LEVELS.map(lvl => (
                    <option key={lvl.id} value={lvl.id}>
                      {lvl.labelFr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem', display: 'block' }}>
                  Type de document
                </label>
                <select 
                  className="input-control" 
                  value={docType} 
                  onChange={e => setDocType(e.target.value)}
                  style={{ width: '100%', fontSize: '0.82rem', padding: '0.4rem 0.5rem' }}
                >
                  {DOC_TYPES.map(dt => (
                    <option key={dt.id} value={dt.id}>
                      {dt.labelFr}
                    </option>
                  ))}
                </select>
              </div>

              {docType === 'exercises' && (
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem', display: 'block' }}>
                    Colonnes (Série)
                  </label>
                  <select 
                    className="input-control" 
                    value={columnsCount} 
                    onChange={e => setColumnsCount(Number(e.target.value))}
                    style={{ width: '100%', fontSize: '0.82rem', padding: '0.4rem 0.5rem', fontWeight: 700 }}
                  >
                    <option value={3}>3 Colonnes (Compact)</option>
                    <option value={2}>2 Colonnes (Standard)</option>
                    <option value={1}>1 Colonne (Pleine page)</option>
                  </select>
                </div>
              )}
            </div>

            {/* ROW 2: Professeur, Téléphone, Chapitre, Langue, Statut */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr 0.8fr 1fr 1.2fr', gap: '0.75rem', alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem', display: 'block' }}>
                  Professeur
                </label>
                <input 
                  type="text" 
                  className="input-control" 
                  value={teacher} 
                  onChange={e => setTeacher(e.target.value)}
                  placeholder="Ex : Pr. Zayani" 
                  style={{ width: '100%', fontSize: '0.82rem', padding: '0.4rem 0.6rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem', display: 'block' }}>
                  Téléphone
                </label>
                <input 
                  type="text" 
                  className="input-control" 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)}
                  placeholder="06XXXXXXXX" 
                  style={{ width: '100%', fontSize: '0.82rem', padding: '0.4rem 0.6rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem', display: 'block' }}>
                  Chapitre
                </label>
                <input 
                  type="text" 
                  className="input-control" 
                  value={chapterNumber} 
                  onChange={e => setChapterNumber(e.target.value)}
                  placeholder="Ex : 01" 
                  style={{ width: '100%', fontSize: '0.82rem', padding: '0.4rem 0.6rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Languages size={12} /> Langue
                </label>
                <select 
                  className="input-control" 
                  value={docLanguage} 
                  onChange={e => setDocLanguage(e.target.value)}
                  style={{ width: '100%', fontSize: '0.82rem', padding: '0.4rem 0.5rem' }}
                >
                  <option value="fr">Français</option>
                  <option value="ar">Arabe</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem', display: 'block' }}>
                  Statut
                </label>
                <button
                  type="button"
                  onClick={() => setIsActiveStatus(prev => !prev)}
                  style={{
                    width: '100%',
                    padding: '0.42rem 0.6rem',
                    borderRadius: '6px',
                    border: isActiveStatus ? '1px solid var(--emerald)' : '1px solid var(--border)',
                    background: isActiveStatus ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255,255,255,0.03)',
                    color: isActiveStatus ? 'var(--emerald)' : 'var(--text-muted)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isActiveStatus ? 'var(--emerald)' : 'var(--text-muted)' }} />
                  {isActiveStatus ? 'Active' : 'Masquée'}
                </button>
              </div>
            </div>

            {/* ROW 3: Classes (Compact Selector) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', paddingTop: '0.5rem', borderTop: '1px dashed var(--border)' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <School size={13} /> Classes :
              </span>

              {/* Class Dropdown to add */}
              {availableClasses.length > 0 && (
                <select
                  value=""
                  onChange={e => {
                    if (e.target.value) handleToggleClass(e.target.value);
                  }}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', cursor: 'pointer' }}
                >
                  <option value="">+ Assigner une classe...</option>
                  {availableClasses.map(c => (
                    <option key={c.id || c.name} value={c.name} disabled={schools.includes(c.name)}>
                      {schools.includes(c.name) ? `✓ ${c.name}` : c.name}
                    </option>
                  ))}
                </select>
              )}

              {/* Quick custom class input */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <input
                  type="text"
                  placeholder="+ Classe personnalisée..."
                  value={customClassInput}
                  onChange={e => setCustomClassInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomClass(); } }}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '5px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-main)', width: '150px' }}
                />
                {customClassInput && (
                  <button
                    type="button"
                    onClick={handleAddCustomClass}
                    style={{ background: 'var(--violet)', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.25rem 0.5rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    +
                  </button>
                )}
              </div>

              {/* Selected class badges */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center' }}>
                {schools.map(sch => (
                  <span
                    key={sch}
                    style={{
                      background: 'rgba(99, 102, 241, 0.12)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      color: 'var(--violet)',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '12px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}
                  >
                    {sch}
                    <X
                      size={11}
                      onClick={() => handleToggleClass(sch)}
                      style={{ cursor: 'pointer', opacity: 0.7 }}
                    />
                  </span>
                ))}
                {schools.length === 0 && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    (Toutes les classes)
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Role Guard (Must run after all hooks to strictly adhere to React rules of hooks)
  if (!authLoading && user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

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

        {/* Pedagogical Header Block Table (Editable directly for ALL document types) */}
        {(() => {
          const docTypeConfig = {
            course: {
              badge: 'COURS (درس)',
              placeholder: 'TITRE DU COURS / FICHE PÉDAGOGIQUE...',
              col1Title: isArMode ? 'القدرات المنتظرة' : 'LES CAPACITÉS ATTENDUES',
              col1Placeholder: 'Entrez les capacités attendues...',
              col2Title: isArMode ? 'المحتويات' : 'CONTENUS DU COURS',
              col2Placeholder: 'Entrez les contenus du cours...'
            },
            summary: {
              badge: 'RÉSUMÉ (ملخص)',
              placeholder: 'TITRE DU RÉSUMÉ DE COURS...',
              col1Title: isArMode ? 'المفاهيم والخاصيات الأساسية' : 'NOTIONS & FORMULES CLÉS',
              col1Placeholder: 'Entrez les notions essentielles...',
              col2Title: isArMode ? 'المكتسبات القبلية' : 'PRÉREQUIS & RAPPELS',
              col2Placeholder: 'Entrez les prérequis...'
            },
            exercises: {
              badge: 'EXERCICES (تمارين)',
              placeholder: 'TITRE DE LA SÉRIE D\'EXERCICES...',
              col1Title: isArMode ? 'الأهداف والكفايات' : 'OBJECTIFS & COMPÉTENCES',
              col1Placeholder: 'Entrez les objectifs de la série...',
              col2Title: isArMode ? 'المفاهيم المستهدفة' : 'NOTIONS COUVERTES',
              col2Placeholder: 'Entrez les notions couvertes...'
            },
            homework: {
              badge: 'DEVOIR (فرض)',
              placeholder: 'TITRE DU DEVOIR SURVEILLÉ...',
              col1Title: isArMode ? 'تعليمات وإرشادات' : 'CONSIGNES & BARÈME',
              col1Placeholder: 'Entrez les consignes, durée, calculatrice...',
              col2Title: isArMode ? 'المحاور والدروس' : 'CHAPITRES ÉVALUÉS',
              col2Placeholder: 'Entrez les chapitres du devoir...'
            },
            national: {
              badge: 'EXAMEN (امتحان)',
              placeholder: 'TITRE DE L\'EXAMEN NATIONAL...',
              col1Title: isArMode ? 'الدورة والشعبة' : 'SESSION & FILIÈRE',
              col1Placeholder: 'Session normale / rattrapage, filière...',
              col2Title: isArMode ? 'المدة والمعامل' : 'DURÉE & COEFFICIENT',
              col2Placeholder: 'Durée de l\'épreuve, coefficient, consignes...'
            },
            concours: {
              badge: 'CONCOURS (مباراة)',
              placeholder: 'TITRE DU CONCOURS D\'ACCÈS...',
              col1Title: isArMode ? 'المؤسسة والاختبار' : 'ÉCOLE & ÉPREUVE',
              col1Placeholder: 'ENSA, ENSAM, Médecine, CNC...',
              col2Title: isArMode ? 'شروط وإرشادات' : 'CONSIGNES & DURÉE',
              col2Placeholder: 'Durée, barème négatif, calculatrice...'
            }
          };
          const cfg = docTypeConfig[docType] || docTypeConfig.course;

          return (
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
                      <span style={{
                        background: 'rgba(255,255,255,0.2)',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        letterSpacing: '0.04em'
                      }}>
                        {cfg.badge}
                      </span>
                      <input
                        type="text"
                        value={ficheTitle}
                        onChange={e => setFicheTitle(e.target.value)}
                        onFocus={() => setActiveFieldTarget({ field: 'ficheTitle' })}
                        placeholder={cfg.placeholder}
                        style={{
                          flex: 1,
                          background: 'transparent',
                          color: '#ffffff',
                          border: 'none',
                          textAlign: 'center',
                          fontWeight: 900,
                          fontSize: '1.15rem',
                          outline: 'none',
                          fontFamily: 'inherit'
                        }}
                      />
                    </div>
                  </td>
                </tr>
                {/* Objectives 2 columns */}
                <tr>
                  <td style={{ width: '50%', padding: '0.5rem', borderRight: '1.5px solid #005086', borderBottom: '1.5px solid #005086', verticalAlign: 'top' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#005086', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                      {cfg.col1Title}
                    </div>
                    <textarea
                      value={capacitesAttendues}
                      onChange={e => setCapacitesAttendues(e.target.value)}
                      onFocus={() => setActiveFieldTarget({ field: 'capacites' })}
                      placeholder={cfg.col1Placeholder}
                      rows={2}
                      style={{ width: '100%', border: '1px dashed #cbd5e1', borderRadius: '4px', padding: '0.35rem', fontSize: '0.8rem', resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
                    />
                  </td>
                  <td style={{ width: '50%', padding: '0.5rem', borderBottom: '1.5px solid #005086', verticalAlign: 'top' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#005086', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                      {cfg.col2Title}
                    </div>
                    <textarea
                      value={contenus}
                      onChange={e => setContenus(e.target.value)}
                      onFocus={() => setActiveFieldTarget({ field: 'contenus' })}
                      placeholder={cfg.col2Placeholder}
                      rows={2}
                      style={{ width: '100%', border: '1px dashed #cbd5e1', borderRadius: '4px', padding: '0.35rem', fontSize: '0.8rem', resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          );
        })()}

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

                {/* ── Unified Section Body (All Section Types) ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  
                  {/* Primary Statement / Content Block */}
                  <div style={{
                    background: '#ffffff',
                    padding: '0.85rem',
                    borderRadius: '6px',
                    border: `1.5px solid ${currentStyle.border}35`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 900, color: currentStyle.title, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {sec.type === 'exercise' ? <><FileText size={14} /> <span>Énoncé de l'Exercice :</span></> :
                         sec.type === 'definition' ? <><BookOpen size={14} /> <span>Énoncé de la Définition :</span></> :
                         sec.type === 'property' ? <><Zap size={14} /> <span>Énoncé de la Propriété :</span></> :
                         sec.type === 'theorem' ? <><Award size={14} /> <span>Énoncé du Théorème :</span></> :
                         sec.type === 'corollary' ? <><Link2 size={14} /> <span>Énoncé du Corollaire :</span></> :
                         sec.type === 'remark' ? <><MessageSquare size={14} /> <span>Remarque :</span></> :
                         sec.type === 'example' ? <><Search size={14} /> <span>Exemple d'application :</span></> :
                         sec.type === 'activity' ? <><Target size={14} /> <span>Énoncé de l'Activité :</span></> :
                         <><BookOpen size={14} /> <span>Contenu de la Section :</span></>}
                      </div>

                      {/* Custom Section Style Toolbar (Palette, Font Size, Spacing) */}
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

                        <span style={{ color: '#cbd5e1' }}>|</span>

                        {/* LaTeX Palette Trigger Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveFieldTarget({ secIdx, field: 'sectionContent' });
                            setIsLatexPaletteOpen(prev => !prev);
                          }}
                          title="نافذة رموز وصيغ لاتك (LaTeX Palette)"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            background: isLatexPaletteOpen && activeFieldTarget?.secIdx === secIdx ? '#005086' : '#eff6ff',
                            color: isLatexPaletteOpen && activeFieldTarget?.secIdx === secIdx ? '#ffffff' : '#005086',
                            border: '1px solid #bfdbfe',
                            borderRadius: '4px',
                            padding: '0.15rem 0.5rem',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <Sparkles size={12} style={{ color: isLatexPaletteOpen && activeFieldTarget?.secIdx === secIdx ? '#fef08a' : '#2563eb' }} />
                          <span>رموز LaTeX</span>
                        </button>
                      </div>
                    </div>

                    <textarea
                      value={sec.content || ''}
                      onChange={e => handleUpdateSection(secIdx, 'content', e.target.value)}
                      onFocus={e => {
                        activeTextareaRef.current = e.target;
                        setActiveFieldTarget({ secIdx, field: 'sectionContent' });
                        if (sec.type === 'exercise') {
                          setIsLatexPaletteOpen(true);
                        }
                      }}
                      onClick={e => { activeTextareaRef.current = e.target; }}
                      onKeyUp={e => { activeTextareaRef.current = e.target; }}
                      onSelect={e => { activeTextareaRef.current = e.target; }}
                      placeholder={sec.type === 'exercise' ? "Écrivez l'énoncé de l'exercice (utilisez $...$ pour les formules KaTeX)..." : "Écrivez le contenu, la définition ou le théorème (utilisez $...$ pour les formules KaTeX)..."}
                      rows={Math.max(3, (sec.content || '').split('\n').length)}
                      style={{
                        width: '100%',
                        border: `1px dashed ${currentStyle.border}70`,
                        borderRadius: '4px',
                        padding: '0.55rem',
                        fontSize: sec.fontSize || '0.88rem',
                        lineHeight: sec.lineHeight || 1.55,
                        background: sec.bgColor && sec.bgColor !== 'transparent' ? sec.bgColor : '#ffffff',
                        outline: 'none',
                        fontFamily: 'inherit'
                      }}
                    />
                    {sec.content && (
                      <div style={{
                        marginTop: '0.4rem',
                        padding: '0.45rem 0.65rem',
                        background: sec.bgColor && sec.bgColor !== 'transparent' ? sec.bgColor : currentStyle.bg,
                        borderRadius: '4px',
                        border: `1px solid ${currentStyle.border}35`,
                        fontSize: sec.fontSize || '0.85rem',
                        lineHeight: sec.lineHeight || 1.55
                      }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: currentStyle.title, display: 'block', marginBottom: '2px' }}>
                          Aperçu direct (KaTeX) :
                        </span>
                        <div>{renderWithMath(sec.content)}</div>
                      </div>
                    )}
                  </div>

                  {/* Secondary Card: Corrigé Détaillé / Démonstration / Remarque */}
                  <div style={{
                    background: '#ffffff',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    border: sec.type === 'exercise' ? '1px solid #86efac' : '1px solid #e2e8f0'
                  }}>
                    <div style={{
                      fontSize: '0.75rem',
                      fontWeight: 900,
                      color: sec.type === 'exercise' ? '#15803d' : '#475569',
                      marginBottom: '0.35rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.35rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        {sec.type === 'exercise' ? <><CheckCircle size={14} style={{ color: '#15803d' }} /> <span>Corrigé Détaillé :</span></> :
                         sec.type === 'theorem' || sec.type === 'property' || sec.type === 'corollary' ? <><HelpCircle size={14} style={{ color: '#475569' }} /> <span>Démonstration (Preuve) :</span></> :
                         <><Info size={14} style={{ color: '#475569' }} /> <span>Démonstration / Remarques :</span></>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <button
                          type="button"
                          onClick={() => handleAiSolveExercise(secIdx)}
                          disabled={solvingSecIdx === secIdx}
                          style={{
                            background: solvingSecIdx === secIdx
                              ? '#e2e8f0'
                              : 'linear-gradient(135deg, #059669, #10b981)',
                            border: 'none',
                            borderRadius: '5px',
                            padding: '0.25rem 0.7rem',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            color: solvingSecIdx === secIdx ? '#64748b' : '#ffffff',
                            cursor: solvingSecIdx === secIdx ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            boxShadow: solvingSecIdx === secIdx ? 'none' : '0 2px 8px rgba(16, 185, 129, 0.3)',
                            transition: 'all 0.15s ease'
                          }}
                          title={isArMode ? "حل التمرين خطوة بخطوة بالذكاء الاصطناعي مع التعليل والصيغ" : "Résoudre l'exercice étape par étape par IA"}
                        >
                          {solvingSecIdx === secIdx ? (
                            <>
                              <Loader2 className="animate-spin" size={12} />
                              <span>{isArMode ? 'جاري حل التمرين...' : 'Résolution IA...'}</span>
                            </>
                          ) : (
                            <>
                              <Sparkles size={12} style={{ color: '#fef08a' }} />
                              <span>
                                {sec.type === 'exercise' 
                                  ? (isArMode ? 'حل التمرين بالذكاء' : 'Résoudre avec l\'IA') 
                                  : (isArMode ? 'برهان بالذكاء' : 'Démontrer par IA')}
                              </span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveFieldTarget({ secIdx, field: 'sectionSolution' });
                            setIsLatexPaletteOpen(true);
                          }}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '5px',
                            padding: '0.22rem 0.45rem',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            color: '#64748b',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}
                          title="نافذة رموز لاتك للحل"
                        >
                          <span>رموز LaTeX</span>
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={sec.solution || ''}
                      onChange={e => handleUpdateSection(secIdx, 'solution', e.target.value)}
                      onFocus={e => {
                        activeTextareaRef.current = e.target;
                        setActiveFieldTarget({ secIdx, field: 'sectionSolution' });
                        if (sec.type === 'exercise') {
                          setIsLatexPaletteOpen(true);
                        }
                      }}
                      onClick={e => { activeTextareaRef.current = e.target; }}
                      onKeyUp={e => { activeTextareaRef.current = e.target; }}
                      onSelect={e => { activeTextareaRef.current = e.target; }}
                      placeholder={sec.type === 'exercise' ? "Écrivez la solution détaillée..." : "Écrivez la démonstration, remarques ou compléments (optionnel)..."}
                      rows={sec.solution ? Math.max(3, (sec.solution || '').split('\n').length) : 2}
                      style={{
                        width: '100%',
                        border: sec.type === 'exercise' ? '1px dashed #86efac' : '1px dashed #cbd5e1',
                        borderRadius: '4px',
                        padding: '0.5rem',
                        fontSize: '0.88rem',
                        outline: 'none',
                        fontFamily: 'inherit',
                        background: sec.type === 'exercise' ? '#f0fdf4' : '#fafafa'
                      }}
                    />
                    {sec.solution && (
                      <div style={{
                        marginTop: '0.35rem',
                        padding: '0.45rem 0.65rem',
                        background: sec.type === 'exercise' ? '#f0fdf4' : '#f8fafc',
                        borderRadius: '4px',
                        border: '1px solid ' + (sec.type === 'exercise' ? '#dcfce7' : '#e2e8f0'),
                        fontSize: '0.85rem'
                      }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: sec.type === 'exercise' ? '#15803d' : '#64748b', display: 'block', marginBottom: '2px' }}>
                          Aperçu (KaTeX) :
                        </span>
                        <div>{renderWithMath(sec.solution)}</div>
                      </div>
                    )}
                  </div>

                  {/* Attached Figures & PDF Cropper for ALL sections */}
                  {Array.isArray(sec.items) && sec.items.filter(i => i.type === 'image').length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '0.75rem', background: '#f8fafc' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <ImageIcon size={14} style={{ color: '#005086' }} /> Figures et Graphiques attachés :
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{sec.items.filter(i => i.type === 'image').length} figure(s)</span>
                      </div>
                      {sec.items.map((it, itIdx) => {
                        if (it.type !== 'image') return null;
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

                              {/* Position in Section: Before / After */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span style={{ fontWeight: 700, color: '#475569' }}>الموضع :</span>
                                <select
                                  value={it.position || 'after'}
                                  onChange={e => handleUpdateContentItem(secIdx, itIdx, 'position', e.target.value)}
                                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', color: '#1e293b' }}
                                >
                                  <option value="after">En bas (بعد النص)</option>
                                  <option value="before">En haut (قبل النص)</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Section Bottom Media Insertion Bar */}
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setCropperTarget({ secIdx, itemIdx: null });
                        setIsCropperOpen(true);
                      }}
                      style={{
                        background: '#ffffff',
                        border: '1px dashed #cbd5e1',
                        borderRadius: '4px',
                        padding: '0.3rem 0.6rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: '#6d28d9',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <Crop size={13} /> + Figure PDF
                    </button>
                    <ImageDropZone
                      compact
                      onImageInsert={(dataUrl, alt) => {
                        setSections(prev => {
                          const next = [...prev];
                          const sec = { ...next[secIdx] };
                          const items = Array.isArray(sec.items) ? [...sec.items] : [];
                          items.push({ type: 'image', url: dataUrl, alt, width_pct: 80, align: 'center', position: 'after' });
                          sec.items = items;
                          next[secIdx] = sec;
                          return next;
                        });
                      }}
                    />
                  </div>

                </div>
              </div>
            );
          })}

          {/* Quick Add Section Buttons on Canvas */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', margin: '2rem 0', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleAddSection('content')}
              style={{
                background: 'linear-gradient(135deg, #005086, #0284c7)',
                color: '#ffffff',
                border: 'none',
                padding: '0.7rem 1.3rem',
                borderRadius: '8px',
                fontWeight: 800,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
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
          <button onClick={goBack} className="btn-outline" style={{ padding: '0.5rem 0.75rem' }} title="Retour aux cours">
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={handleSaveLesson}
            disabled={saving}
            className="btn-primary"
            style={{ padding: '0.5rem 1.1rem', fontSize: '0.85rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            {saving ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}
            <span>{saving ? 'Enregistrement...' : 'Enregistrer'}</span>
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
            { id: 'home', label: 'Accueil & Styles', icon: Type },
            { id: 'insert', label: 'Insertion & Éléments', icon: Plus }
          ].map(tab => {
            const TabIcon = tab.icon;
            return (
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
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.15s ease'
                }}
              >
                <TabIcon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
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
                  { label: 'Définition', type: 'definition', icon: BookOpen, color: '#0284c7' },
                  { label: 'Propriété', type: 'property', icon: Zap, color: '#10b981' },
                  { label: 'Théorème', type: 'theorem', icon: Award, color: '#8b5cf6' },
                  { label: 'Remarque', type: 'remark', icon: MessageSquare, color: '#f59e0b' },
                  { label: 'Activité', type: 'activity', icon: Target, color: '#ec4899' },
                  { label: 'Exercice', type: 'exercise', icon: FileText, color: '#ef4444' }
                ].map(b => {
                  const BIcon = b.icon;
                  return (
                    <button
                      key={b.type}
                      onClick={() => handleAddSection(b.type)}
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <BIcon size={13} style={{ color: b.color }} />
                      <span>{b.label}</span>
                    </button>
                  );
                })}
              </div>
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
                <Crop size={14} /> Découper Figure PDF
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



        </div>
      </div>

      {/* ── MAIN WORKSPACE CONTENT (Live Document Canvas) ── */}
      <ImageDropZone onImageInsert={(dataUrl, alt) => handleDirectImageInsert(dataUrl, alt)}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          {/* General Info Panel in Word Mode */}
          {renderGeneralInfoPanel(true)}
          {renderLiveWordDocument()}
        </div>
      </ImageDropZone>

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

      {/* Floating LaTeX Math Palette */}
      <FloatingLatexPalette
        isOpen={isLatexPaletteOpen}
        onClose={() => setIsLatexPaletteOpen(false)}
        onInsert={insertTextOrSnippet}
        activeTargetLabel={
          activeFieldTarget?.field === 'sectionContent'
            ? `Exercice #${(activeFieldTarget?.secIdx ?? 0) + 1} (Énoncé)`
            : activeFieldTarget?.field === 'sectionSolution'
            ? `Exercice #${(activeFieldTarget?.secIdx ?? 0) + 1} (Corrigé)`
            : 'Fiche Word'
        }
        isArMode={isArMode}
      />
    </div>
  );
}
