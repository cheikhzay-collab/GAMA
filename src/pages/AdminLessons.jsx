import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  getAllLessons, toggleLessonStatus, deleteLesson 
} from '../services/lessonService';
import { getAllClasses } from '../services/classService';
import { 
  BookOpen, Sparkles, Search, Trash2, Eye, Edit, FileText,
  CheckCircle, XCircle, Library, PlusCircle, AlertCircle, Languages 
} from 'lucide-react';
import TranslateModal from '../components/TranslateModal';
import { renderWithMath } from '../utils/mathRenderer';
import { normalizeLevel } from '../utils/levelHelpers';
import { generateFichePedagogiquePDF } from '../utils/generateFichePedagogiquePDF';
import { generateFichePedagogiqueWithAI } from '../utils/aiFicheGenerator';

const getLevelLabel = (rawLevel) => {
  const level = normalizeLevel(rawLevel);
  switch (level) {
    case 'common_core_sci':
      return 'Tronc Commun Scientifique';
    case 'common_core_arts':
      return 'Tronc Commun Lettres';
    case '1bac_sci':
      return '1ère Bac Sciences Expérimentales';
    case '1bac_arts':
      return '1ère Bac Lettres';
    case '2bac_sm':
      return '2ème Bac Sciences Mathématiques';
    case '2bac_pc_svt':
      return '2ème Bac Sciences Expérimentales (PC/SVT)';
    case '2bac_arts':
      return '2ème Bac Lettres';
    default:
      return level || 'Non spécifié';
  }
};

export default function AdminLessons() {
  const { user, loading, profName, profPhone, addExam } = useAuth();
  const navigate = useNavigate();

  // Role Guard
  if (!loading && user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  // Component States
  const [lessons, setLessons] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('Tous');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState('Tous');
  const [selectedDocTypeFilter, setSelectedDocTypeFilter] = useState('Tous');
  const [showConfirmDelete, setShowConfirmDelete] = useState(null); // id of lesson to delete
  const [showTranslateModal, setShowTranslateModal] = useState(null);
  const [generatingQcmLessonId, setGeneratingQcmLessonId] = useState(null);

  const handleGenerateQcmFromLesson = async (lesson) => {
    const geminiKey = localStorage.getItem('geminiApiKey') || '';
    if (!geminiKey) {
      alert("Veuillez d'abord configurer votre clé API Google Gemini dans les paramètres de la plateforme (Espace Paramètres).");
      navigate('/admin/settings');
      return;
    }

    if (!window.confirm(`Voulez-vous générer un QCM de 20 questions de révision pour le cours "${lesson.title}" via l'IA ?`)) {
      return;
    }

    setGeneratingQcmLessonId(lesson.id);
    setError('');
    setSuccess('');

    try {
      // 1. Extract plain text — THEORY ONLY (exclude exercises)
      const sectionsContentText = (lesson.content?.sections || [])
        .filter(sec => sec.type !== 'exercise') // Exclude exercise sections
        .map(sec => {
          const header = sec.section_header ? `[${sec.section_header}] ` : '';
          const title = sec.title ? `${sec.title}\n` : '';
          const itemsText = (sec.items || [])
            .map(it => it.text || '')
            .filter(Boolean)
            .join('\n');
          const bodyContent = sec.content ? `${sec.content}\n` : '';
          return `${header}${title}${itemsText}\n${bodyContent}`;
        })
        .join('\n\n');

      // 2. Call Gemini model
      const storedModel = localStorage.getItem('geminiModel');
      // Validate model name — only accept known valid Gemini models
      const validModels = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash', 'gemini-1.5-pro'];
      const modelToUse = validModels.includes(storedModel) ? storedModel : 'gemini-2.5-flash';
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${geminiKey}`;

      // 3. Detect lesson language (Arabic or French)
      const arabicRegex = /[\u0600-\u06FF]/;
      const lessonSample = (lesson.title || '') + sectionsContentText;
      const isArabicLesson = arabicRegex.test(lessonSample);

      const userText = isArabicLesson
        ? `يجب عليك توليد 20 سؤالاً من نوع اختيار متعدد (QCM) للمراجعة النظرية للدرس التالي.
عنوان الدرس: "${lesson.title}"
المادة: الرياضيات
المستوى: ${getLevelLabel(lesson.level)}

════════════════════════════════════
📖 المحتوى النظري للدرس (المصدر الحصري)
════════════════════════════════════
${sectionsContentText}
════════════════════════════════════

⚠️ قواعد صارمة للتوليد (يجب احترامها دون استثناء):

1. النظرية فقط: يجب أن تتناول جميع الأسئلة العشرين حصراً التعريفات والخصائص والمبرهنات والصيغ والمفاهيم النظرية للدرس أعلاه.
   ❌ محظور: أسئلة من نوع تمارين أو حسابات طويلة أو حل مسائل أو تطبيقات عددية معقدة.
   ✅ مسموح: تحديد التعريف الصحيح، التعرف على صيغة رياضية، تطبيق مبرهنة أساسية، صح/خطأ على خاصية ما.

2. يجب أن يحتوي كل سؤال على 4 خيارات بالضبط على شكل مصفوفة (مثال: ["أ) الخيار 1", "ب) الخيار 2", "ج) الخيار 3", "د) الخيار 4"]).

3. حدد الإجابة الصحيحة بحرف واحد فقط من بين: "A" أو "B" أو "C" أو "D".

4. اكتب شرح التصحيح (astuce) باللغة العربية كاملاً، مع كتابة جميع الصيغ الرياضية بتنسيق LaTeX القياسي ($...$ أو $$...$$).

5. أعد النتيجة بصيغة JSON خالصة وفق مخطط الإخراج المطلوب — 20 عنصراً بالضبط في المصفوفة.`
        : `Tu dois générer exactement 20 questions à choix multiples (QCM) de RÉVISION THÉORIQUE pour le cours suivant.
Titre du cours : "${lesson.title}"
Matière : Mathématiques
Niveau : ${getLevelLabel(lesson.level)}

════════════════════════════════════
📖 CONTENU THÉORIQUE DU COURS (BASE EXCLUSIVE)
════════════════════════════════════
${sectionsContentText}
════════════════════════════════════

⚠️ RÈGLES STRICTES DE GÉNÉRATION (à respecter impérativement) :

1. THÉORIE UNIQUEMENT : Toutes les 20 questions doivent porter EXCLUSIVEMENT sur les définitions, propriétés, théorèmes, formules et concepts théoriques du cours ci-dessus.
   ❌ INTERDIT : questions de type exercice, calcul long, résolution de problème, ou application numérique complexe.
   ✅ AUTORISÉ : identifier la bonne définition, reconnaître une formule, appliquer un théorème de base, vrai/faux sur une propriété.

2. Chaque question doit comporter exactement 4 options sous forme de tableau (ex: ["A) option1", "B) option2", "C) option3", "D) option4"]).

3. Indique la bonne réponse correcte : une seule lettre parmi "A", "B", "C", ou "D".

4. Rédige l'astuce de correction (explication rédigée complète) en français avec toutes les équations mathématiques en LaTeX standard ($...$ ou $$...$$).

5. Retourne le résultat au format JSON pur selon le schéma de sortie exigé — exactement 20 objets dans le tableau.`;

      const promptSchema = {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            question_number: { type: "INTEGER" },
            context: { type: "STRING" },
            subject: { type: "STRING" },
            question: { type: "STRING" },
            options: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            correct_answer: { type: "STRING" },
            astuce: { type: "STRING" },
            trick: { type: "STRING" }
          },
          required: ["question_number", "context", "subject", "question", "options", "correct_answer", "astuce", "trick"]
        }
      };

      const payload = {
        contents: [
          {
            parts: [{ text: userText }]
          }
        ],
        systemInstruction: {
          parts: [{ text: isArabicLesson
            ? "أنت مفتش تربوي مغربي متخصص في الرياضيات. مهمتك هي إنشاء أسئلة اختيار متعدد للمراجعة النظرية — يجب أن يختبر كل سؤال معرفة التعريفات والصيغ والمبرهنات والخصائص من الدرس. لا تولّد أبدًا تمارين حسابية أو مسائل. جميع الصيغ الرياضية تستخدم تنسيق LaTeX القياسي ($...$ أو $$...$$). مستوى اللغة هو مستوى مصحح الامتحانات الرسمية للبكالوريا المغربية. اللغة الوحيدة للأسئلة والخيارات والشرح هي اللغة العربية."
            : "Tu es un inspecteur pédagogique de mathématiques marocain. Ta mission est de créer des QCM de RÉVISION THÉORIQUE — chaque question doit tester la connaissance des définitions, formules, théorèmes et propriétés du cours. Tu ne génères JAMAIS des exercices de calcul ou de résolution de problème. Toutes les formules utilisent la syntaxe LaTeX standard ($...$ ou $$...$$). Le niveau de langue est celui d'un correcteur officiel du Baccalauréat Marocain."
          }]
        },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: promptSchema,
          maxOutputTokens: 65536,
          temperature: 0.2
        }
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Erreur HTTP ${res.status}`);
      }

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      let questions = [];
      try {
        questions = JSON.parse(rawText);
      } catch (err) {
        console.error("Failed to parse JSON:", rawText);
        throw new Error("Le format de réponse de l'IA est invalide.");
      }

      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error("L'IA n'a pas retourné de questions.");
      }

      // 3. Save Exam to Database
      const examName = `QCM : ${lesson.title} (20 Questions)`;
      
      // Determine the level and first class name for the exam if any
      const levelClasses = classes.filter(c => normalizeLevel(c.level) === normalizeLevel(lesson.level));
      const targetSchool = levelClasses.length > 0 ? levelClasses[0].name : getLevelLabel(lesson.level);

      const year = new Date().getFullYear().toString();
      const tier = 'Moyen';

      await addExam(examName, targetSchool, year, tier, questions, null, lesson.level);

      setSuccess(`Le QCM de 20 questions pour "${lesson.title}" a été généré et enregistré !`);
      setTimeout(() => {
        setSuccess('');
        navigate('/admin/exams');
      }, 2000);

    } catch (err) {
      console.error("Failed to generate QCM:", err);
      setError(`Erreur lors de la génération du QCM : ${err.message}`);
    } finally {
      setGeneratingQcmLessonId(null);
    }
  };

  // Fetch Lessons
  const fetchLessonsList = async () => {
    setLoadingLessons(true);
    try {
      const data = await getAllLessons();
      setLessons(data);
    } catch (err) {
      console.error(err);
      setError('Erreur lors du chargement des fiches de cours.');
    } finally {
      setLoadingLessons(false);
    }
  };

  const fetchClassesList = async () => {
    try {
      const data = await getAllClasses();
      setClasses(data);
    } catch (err) {
      console.error('Erreur lors du chargement des classes:', err);
    }
  };

  useEffect(() => {
    fetchLessonsList();
    fetchClassesList();
  }, []);

  // Handle Toggle Active/Inactive Status
  const handleToggleStatus = async (lessonId, currentStatus) => {
    try {
      await toggleLessonStatus(lessonId, currentStatus);
      setLessons(prev => prev.map(l => l.id === lessonId ? { ...l, isActive: !currentStatus } : l));
      setSuccess('Le statut de la fiche a été mis à jour.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError('Impossible de modifier le statut de la fiche.');
      setTimeout(() => setError(''), 4000);
    }
  };

  // Handle Delete
  const handleDeleteLesson = async () => {
    if (!showConfirmDelete) return;
    try {
      await deleteLesson(showConfirmDelete);
      setLessons(prev => prev.filter(l => l.id !== showConfirmDelete));
      setShowConfirmDelete(null);
      setSuccess('La fiche de cours a été supprimée avec succès.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError('Erreur lors de la suppression de la fiche.');
      setTimeout(() => setError(''), 4000);
    }
  };

  // Unique list of subjects for filters
  const subjects = ['Tous', ...new Set(lessons.map(l => l.subject).filter(Boolean))];

  // Filtering Logic
  const filteredLessons = lessons.filter(l => {
    const matchesSearch = l.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          l.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          l.teacher?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSubject = selectedSubject === 'Tous' || l.subject === selectedSubject;
    const matchesLevel = selectedLevelFilter === 'Tous' || normalizeLevel(l.level) === selectedLevelFilter;
    const matchesDocType = selectedDocTypeFilter === 'Tous' || l.docType === selectedDocTypeFilter;
    return matchesSearch && matchesSubject && matchesLevel && matchesDocType;
  });

  // Stats
  const totalCount = lessons.length;
  const activeCount = lessons.filter(l => l.isActive).length;
  const inactiveCount = totalCount - activeCount;
  const uniqueLevelsCount = new Set(lessons.map(l => normalizeLevel(l.level)).filter(Boolean)).size;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>
      
      {/* Background glow blobs */}
      <div style={{
        position: 'absolute', top: '-10%', left: '-5%', width: '350px', height: '350px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(113, 109, 242, 0.05) 0%, transparent 70%)',
        filter: 'blur(70px)', zIndex: 0, pointerEvents: 'none'
      }}></div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        
        {/* ── Page Header ── */}
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
              <div style={{ width: 44, height: 44, borderRadius: '14px', background: 'linear-gradient(135deg, var(--violet), var(--emerald))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(113, 109, 242, 0.15)' }}>
                <Library size={22} color="#fff" />
              </div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0, color: 'var(--text-main)' }}>
                Bibliothèque de Fiches de Cours
              </h1>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>
              Gérez les fiches de cours dynamiques générées par IA avec mise en page LaTeX et impression PDF.
            </p>
          </div>

          <button
            onClick={() => navigate('/admin/ai-lessons')}
            className="btn"
            style={{
              background: 'linear-gradient(135deg, var(--violet), var(--emerald))',
              border: 'none', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.7rem 1.3rem', fontSize: '0.85rem', borderRadius: '12px',
              boxShadow: '0 8px 20px rgba(124, 58, 237, 0.2)'
            }}
          >
            <PlusCircle size={16} /> Générer une fiche (IA)
          </button>
        </header>

        {/* ── Status Notifications ── */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', borderRadius: '12px', padding: '1rem', color: 'var(--danger)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertCircle size={20} />
            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>{error}</p>
          </div>
        )}
        {success && (
          <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid var(--emerald)', borderRadius: '12px', padding: '1rem', color: 'var(--emerald)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <CheckCircle size={20} />
            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>{success}</p>
          </div>
        )}

        {/* ── Stats Indicators ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'var(--violet-soft)', color: 'var(--violet)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Fiches</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900 }}>{totalCount}</div>
            </div>
          </div>
          
          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Fiches Actives</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900 }}>{activeCount}</div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <XCircle size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Fiches Inactives</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900 }}>{inactiveCount}</div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Niveaux Gérés</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900 }}>{uniqueLevelsCount}</div>
            </div>
          </div>
        </div>

        {/* ── Table Controls (Search & Filters) ── */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.5rem', width: '100%' }}>
          
          {/* Search */}
          <div style={{ position: 'relative', flex: '2', minWidth: '240px' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Rechercher une fiche ou enseignant..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ 
                width: '100%', padding: '0.75rem 1rem 0.75rem 3rem', background: 'var(--bg-glass)', 
                border: '1px solid var(--border)', borderRadius: '12px', color: 'white', outline: 'none',
                fontSize: '0.88rem'
              }}
            />
          </div>

          {/* Subject Filter Dropdown */}
          {subjects.length > 2 && (
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="input-control"
              style={{
                fontSize: '0.85rem', minWidth: '160px', flex: '1'
              }}
            >
              {subjects.map(sub => (
                <option key={sub} value={sub}>
                  {sub === 'Tous' ? 'Toutes les matières' : sub}
                </option>
              ))}
            </select>
          )}

          {/* Level Filter Dropdown */}
          <select
            value={selectedLevelFilter}
            onChange={(e) => setSelectedLevelFilter(e.target.value)}
            className="input-control"
            style={{
              fontSize: '0.85rem', minWidth: '165px', flex: '1'
            }}
          >
            <option value="Tous">Tous les niveaux</option>
            <option value="common_core_sci">TC Scientifique</option>
            <option value="common_core_arts">TC Lettres</option>
            <option value="1bac_sci">1ère Bac Sciences</option>
            <option value="1bac_arts">1ère Bac Lettres</option>
            <option value="2bac_sm">2ème Bac SM</option>
            <option value="2bac_pc_svt">2ème Bac PC/SVT</option>
            <option value="2bac_arts">2ème Bac Lettres</option>
          </select>

          {/* DocType Filter Dropdown */}
          <select
            value={selectedDocTypeFilter}
            onChange={(e) => setSelectedDocTypeFilter(e.target.value)}
            className="input-control"
            style={{
              fontSize: '0.85rem', minWidth: '150px', flex: '1'
            }}
          >
            <option value="Tous">Tous les types</option>
            <option value="course">📖 Cours (درس)</option>
            <option value="homework">📑 Devoirs (فرض محروس)</option>
            <option value="national">🇲🇦 Examen National (امتحان وطني)</option>
            <option value="exercises">📝 Exercices (تمارين)</option>
            <option value="concours">🏆 Concours (مباراة)</option>
          </select>

        </div>

        {/* ── Lessons List ── */}
        <div className="glass-panel" style={{ overflow: 'hidden', padding: 0 }}>
          {loadingLessons ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(99,102,241,0.1)', borderTop: '3px solid var(--violet)', animation: 'spinList 1s linear infinite', marginBottom: '1rem' }} />
              <p>Chargement des fiches de cours...</p>
              <style>{`@keyframes spinList { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
          ) : filteredLessons.length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <BookOpen size={44} style={{ margin: '0 auto 1rem', opacity: 0.3, display: 'block' }} />
              <p style={{ fontWeight: 700, margin: 0 }}>Aucune fiche de cours trouvée.</p>
              <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                {searchTerm || selectedSubject !== 'Tous' 
                  ? 'Essayez de réinitialiser vos critères de recherche.' 
                  : 'Générez votre première fiche de cours à l\'aide de l\'IA.'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '1.25rem 1.5rem', fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fiche de Cours</th>
                    <th style={{ padding: '1.25rem 1.5rem', fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Niveau / Classe</th>
                    <th style={{ padding: '1.25rem 1.5rem', fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Type</th>
                    <th style={{ padding: '1.25rem 1.5rem', fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Statut</th>
                    <th style={{ padding: '1.25rem 1.5rem', fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLessons.map(l => (
                    <tr 
                      key={l.id} 
                      style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}
                      className="table-row-hover"
                    >
                      {/* Fiche details */}
                      <td style={{ padding: '1.25rem 1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                          <div style={{ 
                            width: '38px', height: '38px', borderRadius: '10px', 
                            background: l.isActive ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255,255,255,0.04)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: l.isActive ? 'var(--violet)' : 'var(--text-muted)', flexShrink: 0
                          }}>
                            <BookOpen size={16} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.92rem' }}>{renderWithMath(l.title)}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.2rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                              <span>{l.subject}</span>
                              {l.teacher && <span>• {l.teacher}</span>}
                              {l.chapterNumber && <span>• Chapitre {l.chapterNumber}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Niveau / Classe */}
                      <td style={{ padding: '1.25rem 1.5rem' }}>
                        <span style={{ 
                          background: 'rgba(255,255,255,0.04)',
                          color: 'var(--text-subtle)',
                          padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800,
                          border: '1px solid var(--border)'
                        }}>
                          {getLevelLabel(l.level)}
                        </span>
                      </td>

                      {/* Type */}
                      <td style={{ padding: '1.25rem 1.5rem' }}>
                        <span style={{ 
                          background: l.docType === 'homework' ? 'rgba(239, 68, 68, 0.08)' : l.docType === 'exercises' ? 'rgba(245, 158, 11, 0.08)' : l.docType === 'concours' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(59, 130, 246, 0.08)',
                          color: l.docType === 'homework' ? 'var(--danger)' : l.docType === 'exercises' ? 'var(--warning)' : l.docType === 'concours' ? 'var(--emerald)' : '#3B82F6',
                          padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800
                        }}>
                          {l.docType === 'homework' ? 'Devoir surveillé' : l.docType === 'exercises' ? 'Série d\'exercices' : l.docType === 'concours' ? 'Concours' : l.docType === 'national' ? 'Examen National' : 'Cours'}
                        </span>
                      </td>

                      {/* Statut */}
                      <td style={{ padding: '1.25rem 1.5rem' }}>
                        <button
                          onClick={() => handleToggleStatus(l.id, l.isActive)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                            padding: '0.25rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
                            border: 'none', cursor: 'pointer',
                            background: l.isActive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                            color: l.isActive ? 'var(--emerald)' : 'var(--danger)',
                          }}
                        >
                          {l.isActive ? <CheckCircle size={12} /> : <XCircle size={12} />}
                          {l.isActive ? 'Actif' : 'Masqué'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                          <button
                            onClick={() => navigate(`/admin/lessons/${l.id}`)}
                            className="btn-outline"
                            title="Consulter la fiche"
                            style={{ padding: '0.45rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                          >
                            <Eye size={15} />
                          </button>

                          <button
                            onClick={() => navigate(`/admin/lessons/${l.id}/edit`)}
                            className="btn-outline"
                            title="Modifier la fiche"
                            style={{ padding: '0.45rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                          >
                            <Edit size={15} />
                          </button>

                          <button
                            onClick={() => setShowTranslateModal(l)}
                            className="btn-outline"
                            title="Traduction IA (Arabe / Français)"
                            style={{
                              padding: '0.45rem', borderRadius: '8px',
                              border: '1px solid rgba(66,133,244,0.35)',
                              color: '#4285F4',
                              background: 'rgba(66,133,244,0.04)',
                              transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor = '#4285F4';
                              e.currentTarget.style.background = 'rgba(66,133,244,0.12)';
                              e.currentTarget.style.transform = 'scale(1.05)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.borderColor = 'rgba(66,133,244,0.35)';
                              e.currentTarget.style.background = 'rgba(66,133,244,0.04)';
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                          >
                            <Languages size={15} />
                          </button>

                          <button
                            onClick={() => generateFichePedagogiqueWithAI(l, { profName, profPhone, profSchool })}
                            className="btn-outline"
                            title="Générer la Fiche Pédagogique par IA"
                            style={{
                              padding: '0.45rem', borderRadius: '8px',
                              border: 'none',
                              color: '#ffffff',
                              background: 'linear-gradient(135deg, #10b981, #059669)',
                              transition: 'all 0.2s',
                              boxShadow: '0 2px 8px rgba(16,185,129,0.3)'
                            }}
                          >
                            <Sparkles size={15} />
                          </button>

                          <button
                            onClick={() => generateFichePedagogiquePDF(l, { profName, profPhone, profSchool })}
                            className="btn-outline"
                            title="Imprimer Fiche Pédagogique Standard"
                            style={{
                              padding: '0.45rem', borderRadius: '8px',
                              border: '1px solid rgba(16,185,129,0.35)',
                              color: 'var(--emerald)',
                              background: 'var(--emerald-soft)',
                              transition: 'all 0.2s',
                            }}
                          >
                            <FileText size={15} />
                          </button>
                          
                          <button
                            onClick={() => handleGenerateQcmFromLesson(l)}
                            className="btn-outline"
                            title="Générer un QCM de 20 questions via l'IA"
                            style={{
                              padding: '0.45rem', borderRadius: '8px',
                              border: '1px solid rgba(16,185,129,0.35)',
                              color: 'var(--emerald)',
                              background: 'rgba(16,185,129,0.04)',
                              transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor = 'var(--emerald)';
                              e.currentTarget.style.background = 'rgba(16,185,129,0.12)';
                              e.currentTarget.style.transform = 'scale(1.05)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.borderColor = 'rgba(16,185,129,0.35)';
                              e.currentTarget.style.background = 'rgba(16,185,129,0.04)';
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                          >
                            <Sparkles size={15} />
                          </button>
                          
                          <button
                            onClick={() => setShowConfirmDelete(l.id)}
                            className="btn-outline"
                            title="Supprimer"
                            style={{ 
                              padding: '0.45rem', borderRadius: '8px', border: '1px solid var(--border)',
                              color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.02)'
                            }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--danger)'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                          >
                            <Trash2 size={15} />
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

      </div>

      {/* ── Modal Traduction IA ── */}
      {showTranslateModal && (
        <TranslateModal
          lesson={showTranslateModal}
          onClose={() => setShowTranslateModal(null)}
          onSuccess={({ newId, language }) => {
            setShowTranslateModal(null);
            fetchLessonsList(); // Refresh the list to show the new translated lesson
            setSuccess(
              language === 'ar'
                ? '✅ تم إنشاء النسخة العربية بنجاح! يمكنك مراجعتها في القائمة.'
                : `✅ La version traduite a été créée avec succès !`
            );
            setTimeout(() => setSuccess(''), 5000);
          }}
        />
      )}

      {/* ── Confirmation Modal for Deletion ── */}
      {showConfirmDelete && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', 
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', 
          justifyContent: 'center', zIndex: 9999, padding: '1rem'
        }}>
          <div className="glass-panel" style={{ maxWidth: '420px', width: '100%', padding: '2rem', textAlign: 'center' }}>
            <Trash2 size={44} style={{ color: 'var(--danger)', margin: '0 auto 1.25rem', display: 'block' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>Confirmer la suppression</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.5, margin: '0 0 2rem 0' }}>
              Êtes-vous sûr de vouloir supprimer définitivement cette fiche de cours ? Cette action est irréversible et retirera le cours de la base de données.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                onClick={() => setShowConfirmDelete(null)} 
                className="btn-outline" 
                style={{ flex: 1, padding: '0.75rem' }}
              >
                Annuler
              </button>
              <button 
                onClick={handleDeleteLesson} 
                className="btn" 
                style={{ flex: 1, padding: '0.75rem', background: 'linear-gradient(135deg, var(--danger) 0%, #b91c1c 100%)', border: 'none' }}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {generatingQcmLessonId && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(9, 9, 11, 0.7)', backdropFilter: 'blur(5px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, color: 'white'
        }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', border: '4px solid rgba(16, 185, 129, 0.1)', borderTop: '4px solid var(--emerald)', animation: 'spinList 1s linear infinite', marginBottom: '1.5rem' }} />
          <h3 style={{ margin: 0, fontWeight: 800 }}>Génération du QCM de 20 questions par l'IA...</h3>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', maxWidth: '400px', textAlign: 'center' }}>
            L'IA analyse le contenu de la fiche de cours pour formuler des questions à choix multiples de haute qualité avec corrections détaillées en LaTeX. Cela peut prendre environ 30 secondes.
          </p>
        </div>
      )}

    </div>
  );
}
