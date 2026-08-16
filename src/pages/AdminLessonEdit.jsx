import { useState, useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  getLessonById, updateLesson 
} from '../services/lessonService';
import { 
  ArrowLeft, Save, Trash2, Plus, AlertCircle, 
  CheckCircle, Loader2, ChevronUp, ChevronDown, Crop
} from 'lucide-react';
import PdfFigureCropperModal from '../components/PdfFigureCropperModal';

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

import { normalizeLevel } from '../utils/levelHelpers';

export default function AdminLessonEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { schools, user, loading: authLoading } = useAuth();
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

  // Form States (Header metadata)
  const [ficheTitle, setFicheTitle] = useState('');
  const [subject, setSubject] = useState('Algèbre');
  const [chapterNumber, setChapterNumber] = useState('');
  const [teacher, setTeacher] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedSchools, setSelectedSchools] = useState([]);
  const [prepTitle, setPrepTitle] = useState('Préparation aux concours');
  const [selectedLevel, setSelectedLevel] = useState('2bac_pc_svt');
  const [docType, setDocType] = useState('course');
  const [docLanguage, setDocLanguage] = useState('fr');
  
  // Sections state
  const [sections, setSections] = useState([]);

  // PDF Figure Cropper Modal State
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [cropperTarget, setCropperTarget] = useState({ secIdx: 0, itemIdx: null });

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
          setSelectedSchools(data.schools || []);
          
          const header = data.content?.header || {};
          setPrepTitle(header.prep_title || 'Préparation aux concours');
          setSelectedLevel(normalizeLevel(data.level || data.content?.level || '2bac_pc_svt'));
          setDocType(data.docType || data.content?.doc_type || 'course');
          setDocLanguage(data.content?.metadata?.language || 'fr');
          
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
  const handleAddItemToContentSection = (secIndex) => {
    setSections(sections.map((sec, i) => {
      if (i === secIndex) {
        return {
          ...sec,
          items: [...(sec.items || []), { type: 'text', text: '' }]
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

  // Interactive answers manipulation helpers
  const handleAddInteractiveAnswer = (secIndex) => {
    setSections(sections.map((sec, i) => {
      if (i === secIndex) {
        const nextIdx = (sec.interactive_answers?.length || 0) + 1;
        return {
          ...sec,
          interactive_answers: [...(sec.interactive_answers || []), { question_idx: nextIdx, label: '', expected_answer: '' }]
        };
      }
      return sec;
    }));
  };

  const handleRemoveInteractiveAnswer = (secIndex, ansIndex) => {
    setSections(sections.map((sec, i) => {
      if (i === secIndex) {
        return {
          ...sec,
          interactive_answers: sec.interactive_answers.filter((_, idx) => idx !== ansIndex)
        };
      }
      return sec;
    }));
  };

  const handleUpdateInteractiveAnswer = (secIndex, ansIndex, field, value) => {
    setSections(sections.map((sec, i) => {
      if (i === secIndex) {
        const newAns = sec.interactive_answers.map((ans, idx) => {
          if (idx === ansIndex) {
            return { ...ans, [field]: value };
          }
          return ans;
        });
        return { ...sec, interactive_answers: newAns };
      }
      return sec;
    }));
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
            ...lesson?.content?.metadata, // Preserve other metadata if any
            language: docLanguage
          },
          header: {
            prep_title: prepTitle,
            schools: [],
            subject,
            fiche_title: ficheTitle,
            teacher,
            phone
          },
          sections
        },
        isActive: lesson ? lesson.isActive : true
      };

      await updateLesson(id, lessonData);
      setSuccess('Fiche de cours enregistrée avec succès.');
      setTimeout(() => {
        navigate('/admin/lessons');
      }, 1500);
    } catch (e) {
      console.error(e);
      setError(`Erreur lors de la modification : ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleSchool = (sch) => {
    if (selectedSchools.includes(sch)) {
      setSelectedSchools(selectedSchools.filter(s => s !== sch));
    } else {
      setSelectedSchools([...selectedSchools, sch]);
    }
  };

  const isArMode = /[\u0600-\u06FF]/.test(ficheTitle + ' ' + subject + ' ' + (sections || []).map(s => s.title + ' ' + (s.content || '')).join(' '));

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Loader2 className="animate-spin text-violet" size={48} />
        <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Chargement de l'éditeur de cours...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '3rem' }}>
      {isArMode && (
        <style>{`
          @font-face {
            font-family: 'UKIJMerdaneRegular';
            src: url('/fonts/UKIJMerdaneRegular.ttf') format('truetype');
          }
          .input-control, textarea, select {
            font-family: 'UKIJMerdaneRegular', 'Cairo', 'Amiri', Arial, sans-serif !important;
            direction: rtl !important;
            text-align: right !important;
          }
          select.input-control {
            background-position: left 0.75rem center !important;
            padding-left: 2.25rem !important;
            padding-right: 1rem !important;
          }
          label, h2, h3, h4 {
            font-family: 'UKIJMerdaneRegular', 'Cairo', 'Amiri', Arial, sans-serif !important;
            direction: rtl !important;
            text-align: right !important;
          }
        `}</style>
      )}
      
      {/* ── Header ── */}
      <header style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button onClick={() => navigate('/admin/lessons')} className="btn-outline" style={{ padding: '0.5rem 0.75rem' }}>
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>
            Modifier la Fiche de Cours
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Modifiez le contenu théorique, les formules LaTeX, les en-têtes et les exercices.
          </p>
        </div>
      </header>

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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Section 1: Header metadata */}
        <div className="glass-panel" style={{ padding: '2.25rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)' }}>
          <h2 style={{ 
            fontSize: '1.3rem', 
            fontWeight: 800, 
            marginBottom: '1.75rem', 
            borderBottom: '1px solid var(--border)', 
            paddingBottom: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            color: 'var(--text-main)'
          }}>
            <span style={{ fontSize: '1.4rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}>📁</span>
            <span>Informations Générales du Document</span>
          </h2>

          <div className="dashboard-grid">
            <div className="col-span-5 input-group">
              <label style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Titre de la Fiche <span style={{ color: 'var(--text-subtle)', fontWeight: 400 }}>(ex: Fiche 01 : Arithmétique)</span></label>
              <input 
                type="text" 
                className="input-control" 
                value={ficheTitle}
                onChange={e => setFicheTitle(e.target.value)}
                placeholder="Fiche 01 : Arithmétique"
                style={{ width: '100%' }}
              />
            </div>

            <div className="col-span-3 input-group">
              <label style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Type de Document</label>
              <select className="input-control" value={docType} onChange={e => setDocType(e.target.value)} style={{ width: '100%' }}>
                <option value="course">درس (Cours)</option>
                <option value="homework">فرض محروس (Devoir Surveillé)</option>
                <option value="national">امتحان وطني (Examen National)</option>
                <option value="exercises">سلسلة تمارين (Série d'exercices)</option>
                <option value="concours">مباراة (Concours)</option>
              </select>
            </div>

            <div className="col-span-2 input-group">
              <label style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Matière</label>
              <select className="input-control" value={subject} onChange={e => setSubject(e.target.value)} style={{ width: '100%' }}>
                <option value="Algèbre">Algèbre</option>
                <option value="Analyse">Analyse</option>
                <option value="Géométrie">Géométrie</option>
                <option value="Probabilités">Probabilités</option>
                <option value="Physique">Physique</option>
                <option value="Chimie">Chimie</option>
                <option value="SVT">SVT</option>
              </select>
            </div>

            <div className="col-span-2 input-group">
              <label style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Numéro</label>
              <input 
                type="text" 
                className="input-control" 
                value={chapterNumber}
                onChange={e => setChapterNumber(e.target.value)}
                placeholder="01"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div className="dashboard-grid" style={{ marginTop: '1.5rem' }}>
            <div className="col-span-3 input-group">
              <label style={{ color: 'var(--text-muted)', fontWeight: 600 }}>En-tête de préparation</label>
              <input 
                type="text" 
                className="input-control" 
                value={prepTitle}
                onChange={e => setPrepTitle(e.target.value)}
                placeholder="Préparation aux concours"
                style={{ width: '100%' }}
              />
            </div>

            <div className="col-span-3 input-group">
              <label style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Niveau Scolaire</label>
              <select 
                className="input-control" 
                value={selectedLevel} 
                onChange={e => setSelectedLevel(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="common_core_sci">جدع مشترك علوم (Tronc Commun Sci)</option>
                <option value="common_core_arts">جدع مشترك آداب (Tronc Commun Lettres)</option>
                <option value="1bac_sci">أولى باك علوم (1ère Bac Sciences)</option>
                <option value="1bac_arts">أولى باك آداب (1ère Bac Lettres)</option>
                <option value="2bac_sm">ثانية باك علوم رياضية (2ème Bac Sciences Maths)</option>
                <option value="2bac_pc_svt">ثانية باك علوم تجريبية (2ème Bac PC/SVT)</option>
                <option value="2bac_arts">ثانية باك آداب (2ème Bac Lettres)</option>
              </select>
            </div>

            <div className="col-span-2 input-group">
              <label style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Enseignant</label>
              <input 
                type="text" 
                className="input-control" 
                value={teacher}
                onChange={e => setTeacher(e.target.value)}
                placeholder="Prof : FAYSSAL"
                style={{ width: '100%' }}
              />
            </div>

            <div className="col-span-2 input-group">
              <label style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Téléphone</label>
              <input 
                type="text" 
                className="input-control" 
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="0681399067"
                style={{ width: '100%' }}
              />
            </div>

            <div className="col-span-2 input-group">
              <label style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Langue du document / لغة الملف</label>
              <select 
                className="input-control" 
                value={docLanguage} 
                onChange={e => setDocLanguage(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="fr">Français (الفرنسية)</option>
                <option value="ar">Arabe (العربية)</option>
                <option value="en">Anglais (الإنجليزية)</option>
              </select>
            </div>
          </div>


        </div>

        {/* Section 2: Course Contents */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
              📝 Sections du Cours / Exercices
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => handleAddSection('content')} className="btn-outline" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                <Plus size={14} /> + Section Théorique
              </button>
              <button onClick={() => handleAddSection('exercise')} className="btn-outline" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                <Plus size={14} /> + Exercice
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {sections.map((sec, secIdx) => (
              <div 
                key={sec.id || secIdx} 
                className={docLanguage === 'ar' ? 'rtl-section' : 'ltr-section'}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  background: 'rgba(255,255,255,0.02)',
                  position: 'relative'
                }}
              >
                {/* Control Panel (Reordering & Delete) */}
                <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', display: 'flex', gap: '0.35rem' }}>
                  <button
                    onClick={() => handleMoveSection(secIdx, 'up')}
                    disabled={secIdx === 0}
                    style={{
                      background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)',
                      border: '1px solid var(--border)', borderRadius: '6px', padding: '0.3rem', cursor: secIdx === 0 ? 'not-allowed' : 'pointer',
                      opacity: secIdx === 0 ? 0.3 : 1
                    }}
                    title="Monter"
                  >
                    <ChevronUp size={15} />
                  </button>
                  <button
                    onClick={() => handleMoveSection(secIdx, 'down')}
                    disabled={secIdx === sections.length - 1}
                    style={{
                      background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)',
                      border: '1px solid var(--border)', borderRadius: '6px', padding: '0.3rem', cursor: secIdx === sections.length - 1 ? 'not-allowed' : 'pointer',
                      opacity: secIdx === sections.length - 1 ? 0.3 : 1
                    }}
                    title="Descendre"
                  >
                    <ChevronDown size={15} />
                  </button>
                  <button 
                    onClick={() => handleRemoveSection(secIdx)}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)',
                      border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', padding: '0.3rem', cursor: 'pointer'
                    }}
                    title="Supprimer la section"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {/* Section Title */}
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '1rem', width: '100%', marginBottom: '1.25rem', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>Titre du Bloc</label>
                    <input 
                      type="text" 
                      className="input-control" 
                      value={sec.title || ''} 
                      onChange={e => handleUpdateSection(secIdx, 'title', e.target.value)}
                      style={{ fontWeight: 800, fontSize: '1rem', width: '100%' }}
                    />
                  </div>
                  <div style={{ width: isMobile ? '100%' : '150px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>Type</label>
                    <select 
                      className="input-control"
                      value={sec.type}
                      onChange={e => handleUpdateSection(secIdx, 'type', e.target.value)}
                      style={{ width: '100%', fontWeight: 700 }}
                    >
                      <option value="content">Théorie (Général)</option>
                      <option value="definition">Définition (تعريف)</option>
                      <option value="property">Propriété (خاصية)</option>
                      <option value="theorem">Théorème (مبرهنة)</option>
                      <option value="corollary">Corollaire (نتيجة)</option>
                      <option value="example">Exemple (مثال)</option>
                      <option value="remark">Remarque (ملاحظة)</option>
                      <option value="activity">Activité / Application (تطبيق)</option>
                      <option value="exercise">Exercice / Corrigé (تمرين)</option>
                    </select>
                  </div>
                </div>

                {/* Section Metadata Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '80px 1.5fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>N° Section</label>
                    <input 
                      type="text" 
                      className="input-control" 
                      value={sec.section_number || ''} 
                      onChange={e => handleUpdateSection(secIdx, 'section_number', e.target.value)}
                      placeholder="Ex: 1"
                      style={{ padding: '0.35rem', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>En-tête de Section Pill (ex: Résumé : Suites Numériques)</label>
                    <input 
                      type="text" 
                      className="input-control" 
                      value={sec.section_header || ''} 
                      onChange={e => handleUpdateSection(secIdx, 'section_header', e.target.value)}
                      placeholder="Laisse vide pour continuer la section précédente"
                      style={{ padding: '0.35rem', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sous-titre Accent Vert (ex: Définitions-Notations-Vocabulaire)</label>
                    <input 
                      type="text" 
                      className="input-control" 
                      value={sec.accent_text || ''} 
                      onChange={e => handleUpdateSection(secIdx, 'accent_text', e.target.value)}
                      placeholder="Optionnel"
                      style={{ padding: '0.35rem', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                {/* Type 1: Content Block Editor */}
                {sec.type !== 'exercise' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--violet)' }}>Éléments de texte</span>
                      <button onClick={() => handleAddItemToContentSection(secIdx)} className="btn-outline" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>
                        <Plus size={12} /> Ajouter un point
                      </button>
                    </div>

                    {sec.items?.map((item, itemIdx) => (
                      <div key={itemIdx} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '0.75rem', alignItems: isMobile ? 'stretch' : 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.01)', paddingBottom: '0.75rem', width: '100%' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', width: isMobile ? '100%' : 'auto' }}>
                          <select
                            className="input-control"
                            value={item.type}
                            onChange={e => handleUpdateContentItem(secIdx, itemIdx, 'type', e.target.value)}
                            style={{ width: isMobile ? '100%' : '140px', flexShrink: 0, padding: '0.4rem' }}
                          >
                            <option value="text">Texte Standard</option>
                            <option value="bullet">Puce (Bullet)</option>
                            <option value="highlight_box">Formule (Encadré)</option>
                            <option value="notation_grid">Grille de Notations</option>
                            <option value="table">Tableau Comparatif</option>
                            <option value="image">🖼️ Image</option>
                          </select>
                          
                          {/* Reordering content items inside section */}
                          <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem' }}>
                            <button
                              type="button"
                              onClick={() => handleMoveItem(secIdx, itemIdx, 'up')}
                              disabled={itemIdx === 0}
                              style={{ flex: 1, padding: '0.2rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '4px', cursor: itemIdx === 0 ? 'not-allowed' : 'pointer', opacity: itemIdx === 0 ? 0.3 : 1 }}
                            >
                              <ChevronUp size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveItem(secIdx, itemIdx, 'down')}
                              disabled={itemIdx === sec.items.length - 1}
                              style={{ flex: 1, padding: '0.2rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '4px', cursor: itemIdx === sec.items.length - 1 ? 'not-allowed' : 'pointer', opacity: itemIdx === sec.items.length - 1 ? 0.3 : 1 }}
                            >
                              <ChevronDown size={12} />
                            </button>
                          </div>
                        </div>

                        {item.type === 'notation_grid' ? (
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255,255,255,0.01)', padding: '0.75rem', borderRadius: '8px', border: '1px dashed var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong style={{ fontSize: '0.8rem' }}>Colonnes de Notations :</strong>
                              <button
                                type="button"
                                onClick={() => {
                                  const cols = item.notation_columns || [];
                                  handleUpdateContentItem(secIdx, itemIdx, 'notation_columns', [...cols, { title: '', math_blocks: [''] }]);
                                }}
                                className="btn-outline"
                                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                              >
                                + Ajouter Colonne
                              </button>
                            </div>
                            {item.notation_columns?.map((col, colIdx) => (
                              <div key={colIdx} style={{ border: '1px solid var(--border)', padding: '0.5rem', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <input
                                    type="text"
                                    className="input-control"
                                    placeholder="Titre de colonne (ex: • Notation fonctionnelle)"
                                    value={col.title || ''}
                                    onChange={e => {
                                      const newCols = item.notation_columns.map((c, ci) => ci === colIdx ? { ...c, title: e.target.value } : c);
                                      handleUpdateContentItem(secIdx, itemIdx, 'notation_columns', newCols);
                                    }}
                                    style={{ flex: 1, padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newCols = item.notation_columns.filter((_, ci) => ci !== colIdx);
                                      handleUpdateContentItem(secIdx, itemIdx, 'notation_columns', newCols);
                                    }}
                                    style={{ background: 'transparent', color: 'var(--danger)', border: 'none', cursor: 'pointer' }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                                <textarea
                                  className="input-control"
                                  placeholder="Blocs mathématiques (un par ligne, ex: u : E \\rightarrow \\mathbb{R})"
                                  value={col.math_blocks?.join('\n') || ''}
                                  onChange={e => {
                                    const lines = e.target.value.split('\n');
                                    const newCols = item.notation_columns.map((c, ci) => ci === colIdx ? { ...c, math_blocks: lines } : c);
                                    handleUpdateContentItem(secIdx, itemIdx, 'notation_columns', newCols);
                                  }}
                                  rows={2}
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                />
                              </div>
                            ))}
                          </div>
                        ) : item.type === 'table' ? (
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255,255,255,0.01)', padding: '0.75rem', borderRadius: '8px', border: '1px dashed var(--border)' }}>
                            <div>
                              <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>En-têtes du Tableau (séparés par | )</label>
                              <input
                                type="text"
                                className="input-control"
                                placeholder="ex: Concept | une suite arithmétique | une suite géométrique"
                                value={item.table_data?.headers?.join(' | ') || ''}
                                onChange={e => {
                                  const headers = e.target.value.split('|').map(s => s.trim());
                                  const rows = item.table_data?.rows || [[]];
                                  handleUpdateContentItem(secIdx, itemIdx, 'table_data', { headers, rows });
                                }}
                                style={{ padding: '0.35rem', fontSize: '0.8rem' }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>Lignes du Tableau (une ligne par rangée, cellules séparées par | )</label>
                              <textarea
                                className="input-control"
                                placeholder="ex: Définition | U_{n+1} = U_n + r | U_{n+1} = qU_n"
                                value={item.table_data?.rows?.map(r => r.join(' | ')).join('\n') || ''}
                                onChange={e => {
                                  const rows = e.target.value.split('\n').map(line => line.split('|').map(s => s.trim()));
                                  const headers = item.table_data?.headers || [];
                                  handleUpdateContentItem(secIdx, itemIdx, 'table_data', { headers, rows });
                                }}
                                rows={3}
                                style={{ padding: '0.35rem', fontSize: '0.8rem' }}
                              />
                            </div>
                          </div>
                        ) : item.type === 'image' ? (
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255,255,255,0.01)', padding: '0.75rem', borderRadius: '8px', border: '1px dashed var(--border)' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <div style={{ fontSize: '1.5rem' }}>🖼️</div>
                              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>Insérer une image</label>
                            </div>
                            {/* URL input */}
                            <div>
                              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>URL de l'image</label>
                              <input
                                type="url"
                                className="input-control"
                                placeholder="https://... ou coller une URL d'image"
                                value={item.url || ''}
                                onChange={e => handleUpdateContentItem(secIdx, itemIdx, 'url', e.target.value)}
                                style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
                              />
                            </div>
                            {/* OR upload / crop from PDF */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>— ou —</span>
                              <input
                                type="file"
                                accept="image/*"
                                style={{ fontSize: '0.75rem', flex: 1, minWidth: '130px' }}
                                onChange={e => {
                                  const file = e.target.files[0];
                                  if (!file) return;
                                  const reader = new FileReader();
                                  reader.onload = ev => handleUpdateContentItem(secIdx, itemIdx, 'url', ev.target.result);
                                  reader.readAsDataURL(file);
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setCropperTarget({ secIdx, itemIdx });
                                  setIsCropperOpen(true);
                                }}
                                className="btn-outline"
                                style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', color: 'var(--emerald)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}
                                title="قص وتحديد شكل من مستند PDF"
                              >
                                <Crop size={13} /> ✂️ قص من PDF
                              </button>
                            </div>
                            {/* Preview */}
                            {item.url && (
                              <div style={{ textAlign: 'center', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.5rem', background: 'rgba(255,255,255,0.02)' }}>
                                <img
                                  src={item.url}
                                  alt={item.alt || ''}
                                  style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '4px' }}
                                  onError={e => { e.target.style.display = 'none'; }}
                                />
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Aperçu</div>
                              </div>
                            )}
                            {/* Caption / Alt */}
                            <div>
                              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Légende (optionnel)</label>
                              <input
                                type="text"
                                className="input-control"
                                placeholder="ex: Figure 1 — Construction du barycentre G"
                                value={item.alt || ''}
                                onChange={e => handleUpdateContentItem(secIdx, itemIdx, 'alt', e.target.value)}
                                style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
                              />
                            </div>
                            {/* Align & Width */}
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Alignement</label>
                                <select
                                  className="input-control"
                                  value={item.align || 'center'}
                                  onChange={e => handleUpdateContentItem(secIdx, itemIdx, 'align', e.target.value)}
                                  style={{ padding: '0.35rem', fontSize: '0.8rem' }}
                                >
                                  <option value="left">◀ Gauche</option>
                                  <option value="center">▐ Centre</option>
                                  <option value="right">▶ Droite</option>
                                </select>
                              </div>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Largeur (%)</label>
                                <input
                                  type="number"
                                  className="input-control"
                                  min={10}
                                  max={100}
                                  value={item.width_pct || 80}
                                  onChange={e => handleUpdateContentItem(secIdx, itemIdx, 'width_pct', Number(e.target.value))}
                                  style={{ padding: '0.35rem', fontSize: '0.8rem' }}
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <textarea
                            className="input-control"
                            value={item.text || ''}
                            onChange={e => handleUpdateContentItem(secIdx, itemIdx, 'text', e.target.value)}
                            placeholder="Entrez le contenu (LaTeX supporté avec $ ... $)"
                            rows={2}
                            style={{ flex: 1, padding: '0.4rem' }}
                          />
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveItemFromContentSection(secIdx, itemIdx)}
                          style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', marginTop: '0.5rem' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Type 2: Exercise Block Editor */}
                {sec.type === 'exercise' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="input-group">
                      <label>Énoncé de l'Exercice</label>
                      <textarea
                        className="input-control"
                        value={sec.content}
                        onChange={e => handleUpdateSection(secIdx, 'content', e.target.value)}
                        placeholder="Entrez l'énoncé de l'exercice..."
                        rows={4}
                      />
                    </div>
                    <div className="input-group">
                      <label>Solution Détaillée</label>
                      <textarea
                        className="input-control"
                        value={sec.solution}
                        onChange={e => handleUpdateSection(secIdx, 'solution', e.target.value)}
                        placeholder="Entrez la correction rédigée..."
                        rows={6}
                      />
                    </div>

                    {/* Interactive Verification Checks */}
                    <div style={{ marginTop: '0.5rem', borderTop: '1px dashed var(--border)', paddingTop: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                          Champs de vérification interactive (Optionnel - Pour s'entraîner)
                        </span>
                        <button onClick={() => handleAddInteractiveAnswer(secIdx)} className="btn-outline" style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}>
                          <Plus size={12} /> Ajouter une question interactive
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {sec.interactive_answers?.map((ans, ansIdx) => (
                          <div key={ansIdx} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '0.75rem', alignItems: isMobile ? 'stretch' : 'center', width: '100%' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>Q{ans.question_idx} :</span>
                            <input
                              type="text"
                              className="input-control"
                              value={ans.label}
                              onChange={e => handleUpdateInteractiveAnswer(secIdx, ansIdx, 'label', e.target.value)}
                              placeholder="Libellé (ex: Entrez la valeur de x)"
                              style={{ flex: 1, width: isMobile ? '100%' : 'auto', padding: '0.4rem' }}
                            />
                            <input
                              type="text"
                              className="input-control"
                              value={ans.expected_answer}
                              onChange={e => handleUpdateInteractiveAnswer(secIdx, ansIdx, 'expected_answer', e.target.value)}
                              placeholder="Réponse exacte attendue"
                              style={{ width: isMobile ? '100%' : '180px', padding: '0.4rem' }}
                            />
                            <button
                              onClick={() => handleRemoveInteractiveAnswer(secIdx, ansIdx)}
                              style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem', width: '100%' }}>
          <button onClick={() => navigate('/admin/lessons')} className="btn-outline" style={{ padding: '1rem 2rem', width: isMobile ? '100%' : 'auto', justifyContent: 'center', display: 'flex' }} disabled={saving}>
            Annuler
          </button>
          <button onClick={handleSaveLesson} className="btn" style={{ padding: '1rem 2rem', width: isMobile ? '100%' : 'auto', justifyContent: 'center', display: 'flex' }} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="animate-spin" size={18} style={{ marginRight: '0.5rem' }} />
                Enregistrement...
              </>
            ) : (
              <>
                <Save size={18} style={{ marginRight: '0.5rem' }} />
                Enregistrer les modifications
              </>
            )}
          </button>
        </div>
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
