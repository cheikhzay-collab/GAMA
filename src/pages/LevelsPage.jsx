// src/pages/LevelsPage.jsx
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getActiveLessons } from '../services/lessonService';
import { 
  GraduationCap, Search, ArrowLeft, BookOpen, 
  User, ChevronRight, Sparkles, BookOpenCheck, FolderOpen,
  FileDown, Play, Clock, BrainCircuit, Zap
} from 'lucide-react';
import { renderWithMath } from '../utils/mathRenderer';
import { mapLegacySchoolToLevel } from '../utils/levelHelpers';
import { generateSubjectHTML, generateCorrectionHTML, openPrintWindow } from '../utils/generateExamPDF';
import { generateAnswerSheet } from '../utils/generateAnswerSheet';


const normalizeLevel = (rawLevel) => {
  if (!rawLevel) return '2bac_pc_svt';
  const normalized = rawLevel.toLowerCase().trim();
  
  if (normalized.includes('common_core_sci') || normalized.includes('common-core-sci')) return 'common_core_sci';
  if (normalized.includes('common_core_arts') || normalized.includes('common-core-arts')) return 'common_core_arts';
  if (normalized.includes('1bac_sci') || normalized.includes('1bac-sci')) return '1bac_sci';
  if (normalized.includes('1bac_arts') || normalized.includes('1bac-arts')) return '1bac_arts';
  if (normalized.includes('2bac_sm') || normalized.includes('2bac-sm')) return '2bac_sm';
  if (normalized.includes('2bac_pc_svt') || normalized.includes('2bac-pc-svt') || normalized.includes('2bac_pc/svt')) return '2bac_pc_svt';
  if (normalized.includes('2bac_arts') || normalized.includes('2bac-arts')) return '2bac_arts';

  if (normalized.includes('sm') || normalized.includes('math') || normalized.includes('رياضية')) {
    return '2bac_sm';
  }
  if (normalized.includes('pc') || normalized.includes('svt') || normalized.includes('تجريبية')) {
    return '2bac_pc_svt';
  }
  if (normalized.includes('2bac') || normalized.includes('ثانية باك')) {
    if (normalized.includes('letter') || normalized.includes('art') || normalized.includes('آداب') || normalized.includes('إنسانية')) {
      return '2bac_arts';
    }
    return '2bac_pc_svt';
  }
  if (normalized.includes('1bac') || normalized.includes('أولى باك') || normalized.includes('1ère bac') || normalized.includes('première bac')) {
    if (normalized.includes('letter') || normalized.includes('art') || normalized.includes('آداب') || normalized.includes('إنسانية')) {
      return '1bac_arts';
    }
    return '1bac_sci';
  }
  if (normalized.includes('commun') || normalized.includes('tc') || normalized.includes('مشترك')) {
    if (normalized.includes('letter') || normalized.includes('art') || normalized.includes('آداب') || normalized.includes('إنسانية')) {
      return 'common_core_arts';
    }
    return 'common_core_sci';
  }
  
  const validKeys = ['common_core_sci', 'common_core_arts', '1bac_sci', '1bac_arts', '2bac_sm', '2bac_pc_svt', '2bac_arts'];
  if (validKeys.includes(rawLevel)) {
    return rawLevel;
  }
  
  return '2bac_pc_svt';
};

const MAIN_LEVELS = [
  {
    id: 'tc',
    name: 'Tronc Commun',
    subName: 'الجدع المشترك',
    desc: 'Année de tronc commun pour s\'orienter vers les filières du baccalauréat.',
    icon: GraduationCap,
    gradient: 'linear-gradient(135deg, #10B981, #059669)',
    bgSoft: 'rgba(16, 185, 129, 0.05)',
    textColor: '#10B981',
    branches: [
      {
        id: 'common_core_sci',
        name: 'Tronc Commun Scientifique',
        subName: 'جدع مشترك علوم',
        desc: 'Bases en Mathématiques, Physique-Chimie et SVT.'
      },
      {
        id: 'common_core_arts',
        name: 'Tronc Commun Littéraire',
        subName: 'جدع مشترك آداب',
        desc: 'Bases en Langues, Littérature et Sciences Humaines.'
      }
    ]
  },
  {
    id: '1bac',
    name: '1ère Année Baccalauréat',
    subName: 'السنة الأولى بكالوريا',
    desc: 'Préparation aux examens régionaux marocains.',
    icon: Sparkles,
    gradient: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
    bgSoft: 'rgba(59, 130, 246, 0.05)',
    textColor: '#3B82F6',
    branches: [
      {
        id: '1bac_sci',
        name: '1ère Bac Sciences Expérimentales',
        subName: 'أولى باك علوم تجريبية',
        desc: 'Physique-Chimie, SVT, Mathématiques et Français.'
      },
      {
        id: '1bac_arts',
        name: '1ère Bac Littéraire',
        subName: 'أولى باك آداب',
        desc: 'Matières littéraires et examen régional.'
      }
    ]
  },
  {
    id: '2bac',
    name: '2ème Année Baccalauréat',
    subName: 'السنة الثانية بكالوريا',
    desc: 'Dernière ligne droite pour l\'obtention du diplôme national du Baccalauréat.',
    icon: BookOpenCheck,
    gradient: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
    bgSoft: 'rgba(139, 92, 246, 0.05)',
    textColor: '#8B5CF6',
    branches: [
      {
        id: '2bac_sm',
        name: '2ème Bac Sciences Mathématiques',
        subName: 'ثانية باك علوم رياضية',
        desc: 'Préparation intensive aux écoles d\'ingénieurs (Sciences Maths A & B).'
      },
      {
        id: '2bac_pc_svt',
        name: '2ème Bac Sciences Expérimentales',
        subName: 'ثانية باك علوم تجريبية (PC / SVT)',
        desc: 'Préparation au concours de Médecine, ENSA et facultés des sciences.'
      },
      {
        id: '2bac_arts',
        name: '2ème Bac Lettres & Sciences Humaines',
        subName: 'ثانية باك آداب وعلوم إنسانية',
        desc: 'Filière littéraire nationale.'
      }
    ]
  }
];

export default function LevelsPage() {
  const { user, exams, schools, loadExamQuestions, trackDownload } = useAuth();
  const navigate = useNavigate();

  // Navigation states:
  // selectedParentId: 'tc', '1bac', '2bac'
  // selectedBranchId: 'common_core_sci', etc.
  const [selectedParentId, setSelectedParentId] = useState(null);
  const [selectedBranchId, setSelectedBranchId] = useState(null);

  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('Tous');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'course', 'exercises', 'homework'

  // Load active lessons
  useEffect(() => {
    const fetchLessons = async () => {
      setLoading(true);
      try {
        const data = await getActiveLessons();
        setLessons(data || []);
      } catch (err) {
        console.error('[LevelsPage] Error loading lessons:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLessons();
  }, []);

  // Combine lessons and exams into a single resources list
  const allResources = useMemo(() => {
    const rawLessons = lessons;
    const normalizedExams = (exams || [])
      .filter(e => !e.isArchived)
      .map(e => {
        const examLvl = e.level || mapLegacySchoolToLevel(e.school);
        return {
          id: `exam_${e.id}`,
          title: e.name,
          subject: 'Mathématiques', // default subject for filters compatibility
          docType: 'concours',
          teacher: `Annales ${e.year || ''}`,
          isExam: true,
          examId: e.id,
          tier: e.tier,
          level: examLvl,
          year: e.year,
          questions: e.questions,
          pdfUrl: e.pdfUrl,
          schools: e.tier === 'premium' ? ['premium'] : []
        };
      });
    return [...rawLessons, ...normalizedExams];
  }, [lessons, exams]);

  // Compute counts for parent levels
  const parentCounts = useMemo(() => {
    const counts = {};
    MAIN_LEVELS.forEach(parent => {
      const branchIds = parent.branches.map(b => b.id);
      counts[parent.id] = allResources.filter(l => branchIds.includes(normalizeLevel(l.level))).length;
    });
    return counts;
  }, [allResources]);

  // Compute counts for branches
  const branchCounts = useMemo(() => {
    const counts = {};
    MAIN_LEVELS.forEach(parent => {
      parent.branches.forEach(branch => {
        counts[branch.id] = allResources.filter(l => normalizeLevel(l.level) === branch.id).length;
      });
    });
    return counts;
  }, [allResources]);

  // Current active data
  const selectedParent = useMemo(() => {
    return MAIN_LEVELS.find(p => p.id === selectedParentId);
  }, [selectedParentId]);

  const selectedBranch = useMemo(() => {
    if (!selectedParent) return null;
    return selectedParent.branches.find(b => b.id === selectedBranchId);
  }, [selectedParent, selectedBranchId]);

  // Lessons list filtered by the selected branch
  const branchLessons = useMemo(() => {
    if (!selectedBranchId) return [];
    return allResources.filter(l => normalizeLevel(l.level) === selectedBranchId);
  }, [allResources, selectedBranchId]);

  // Subjects filter list
  const subjects = useMemo(() => {
    const subs = branchLessons.map(l => l.subject).filter(Boolean);
    return ['Tous', ...new Set(subs)];
  }, [branchLessons]);

  // Filter lessons search/subject
  const filteredLessons = useMemo(() => {
    return branchLessons.filter(l => {
      const matchesSearch = l.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            l.teacher?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSubject = selectedSubject === 'Tous' || l.subject === selectedSubject || (l.isExam && ['Mathématiques', 'Physique', 'Chimie', 'Sciences'].includes(selectedSubject));
      const matchesTab = activeTab === 'all' || l.docType === activeTab;
      return matchesSearch && matchesSubject && matchesTab;
    });
  }, [branchLessons, searchTerm, selectedSubject, activeTab]);


  const handleDownloadPDF = async (exam) => {
    let questions = exam.questions;
    if (!questions || questions.length === 0) {
      try {
        questions = await loadExamQuestions(exam.examId);
      } catch (err) {
        console.error('Failed to load questions for OMR sheet:', err);
        return;
      }
    }
    await generateAnswerSheet({ id: exam.examId, name: exam.title, school: exam.title, questions }, user);
  };

  const handlePrintExam = async (exam, type) => {
    if (type === 'sujet' && exam.pdfUrl) {
      window.open(exam.pdfUrl, '_blank');
      return;
    }

    const isMobile = window.innerWidth <= 768;
    let win = null;
    if (!isMobile) {
      win = window.open('', '_blank');
      if (win) {
        win.document.write('<html><head><title>Génération du PDF...</title></head><body style="background:#09090b;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;margin:0;padding:20px;text-align:center;"><div><h3 style="margin:0 0 10px 0;">GAMA</h3><p style="margin:0;color:#a1a1aa;font-size:0.9rem;">Génération de votre document PDF en cours...</p></div></body></html>');
      }
    }

    try {
      let questions = exam.questions;
      if (!questions || questions.length === 0) {
        questions = await loadExamQuestions(exam.examId);
      }
      const schoolsList = schools && schools.length > 0 ? schools : Array.from(new Set((exams || []).map(e => e.school))).filter(Boolean);
      
      let html = '';
      if (type === 'corrige') {
        html = generateCorrectionHTML(exam.title, exam.title, exam.year, questions || [], { examId: exam.examId, schoolsList });
      } else {
        html = await generateSubjectHTML(exam.title, exam.title, exam.year, questions || [], { examId: exam.examId, schoolsList });
      }

      // Write to localStorage for PrintView / Mobile sync
      localStorage.setItem('print_html', html);

      if (isMobile) {
        window.open(`/print?examId=${exam.examId}&type=${type}`, '_blank');
      } else {
        openPrintWindow(html, type, win);
      }
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      if (win) win.close();
      alert('Erreur lors de la génération du PDF. Veuillez réessayer.');
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', minHeight: '80vh', paddingBottom: '2rem' }}>
      
      {/* Background radial glow */}
      <div style={{
        position: 'absolute', top: '-10%', right: '-5%', width: '400px', height: '400px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124, 58, 237, 0.04) 0%, transparent 70%)',
        filter: 'blur(80px)', zIndex: 0, pointerEvents: 'none'
      }} />

      {/* ── BREADCRUMBS & NAVIGATION HEADER ── */}
      <header style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          <span 
            onClick={() => { setSelectedParentId(null); setSelectedBranchId(null); }}
            style={{ 
              color: selectedParentId ? 'var(--text-muted)' : 'var(--text-main)', 
              cursor: selectedParentId ? 'pointer' : 'default',
              fontWeight: 800, fontSize: '0.9rem'
            }}
          >
            Niveaux Scolaires
          </span>

          {selectedParentId && (
            <>
              <span style={{ color: 'var(--text-subtle)', fontSize: '0.8rem' }}>/</span>
              <span 
                onClick={() => setSelectedBranchId(null)}
                style={{ 
                  color: selectedBranchId ? 'var(--text-muted)' : 'var(--text-main)', 
                  cursor: selectedBranchId ? 'pointer' : 'default',
                  fontWeight: 800, fontSize: '0.9rem' 
                }}
              >
                {selectedParent?.name}
              </span>
            </>
          )}

          {selectedBranchId && (
            <>
              <span style={{ color: 'var(--text-subtle)', fontSize: '0.8rem' }}>/</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 800, fontSize: '0.9rem' }}>
                {selectedBranch?.name}
              </span>
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.75rem' }}>
          {(selectedParentId || selectedBranchId) && (
            <button 
              onClick={() => {
                if (selectedBranchId) {
                  setSelectedBranchId(null);
                } else {
                  setSelectedParentId(null);
                }
                setSelectedSubject('Tous');
                setSearchTerm('');
              }}
              className="btn-outline" 
              style={{ padding: '0.5rem 0.75rem', borderRadius: '12px' }}
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-main)' }}>
              {selectedBranchId ? (
                <>
                  <FolderOpen size={26} style={{ color: selectedParent?.textColor }} />
                  {selectedBranch?.name}
                </>
              ) : selectedParentId ? (
                <>
                  <GraduationCap size={28} style={{ color: selectedParent?.textColor }} />
                  {selectedParent?.name}
                </>
              ) : (
                <>
                  <GraduationCap size={28} className="text-violet" />
                  Niveaux
                </>
              )}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {selectedBranchId ? (
                <>
                  <span style={{ direction: 'rtl', fontFamily: 'inherit', fontWeight: 700, color: 'var(--text-subtle)' }}>{selectedBranch?.subName}</span>
                  <span>—</span>
                  <span>Explorez et téléchargez les fiches de cours et exercices.</span>
                </>
              ) : selectedParentId ? (
                <>
                  <span style={{ direction: 'rtl', fontFamily: 'inherit', fontWeight: 700, color: 'var(--text-subtle)' }}>{selectedParent?.subName}</span>
                  <span>—</span>
                  <span>Sélectionnez votre filière / spécialité.</span>
                </>
              ) : (
                <span>Choisissez votre niveau puis votre branche pour accéder aux ressources pédagogiques.</span>
              )}
            </p>
          </div>
        </div>
      </header>

      {/* ── STEP 1: MAIN LEVELS SELECTION ── */}
      {!selectedParentId && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '1.5rem',
          marginTop: '1rem'
        }}>
          {MAIN_LEVELS.map((parent) => {
            const IconComponent = parent.icon;
            const count = parentCounts[parent.id] || 0;
            return (
              <div 
                key={parent.id}
                onClick={() => setSelectedParentId(parent.id)}
                className="glass-panel"
                style={{
                  padding: '2.25rem 2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-glass)',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = parent.textColor;
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = `0 12px 30px ${parent.bgSoft}`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '14px',
                    background: parent.gradient, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}>
                    <IconComponent size={22} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>{parent.name}</h3>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', fontWeight: 600 }}>{parent.subName}</span>
                  </div>
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
                  {parent.desc}
                </p>

                <div style={{
                  marginTop: 'auto', paddingTop: '1.25rem', borderTop: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: parent.textColor, background: parent.bgSoft, padding: '0.25rem 0.65rem', borderRadius: '6px' }}>
                    {count} {count > 1 ? 'Ressources' : 'Ressource'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    Voir les sections <ChevronRight size={14} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── STEP 2: BRANCHES/SECTIONS SELECTION (within selected level) ── */}
      {selectedParentId && !selectedBranchId && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1.5rem',
          marginTop: '1rem'
        }}>
          {selectedParent?.branches.map((branch) => {
            const count = branchCounts[branch.id] || 0;
            return (
              <div 
                key={branch.id}
                onClick={() => setSelectedBranchId(branch.id)}
                className="glass-panel"
                style={{
                  padding: '2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-glass)',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = selectedParent.textColor;
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = `0 10px 25px ${selectedParent.bgSoft}`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 0.2rem 0', color: 'var(--text-main)' }}>{branch.name}</h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', fontWeight: 600 }}>{branch.subName}</span>
                </div>

                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  {branch.desc}
                </p>

                <div style={{
                  marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  fontSize: '0.8rem'
                }}>
                  <span style={{ fontWeight: 800, color: selectedParent.textColor }}>
                    {count} Ressources
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>
                    Accéder aux cours <ChevronRight size={13} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── STEP 3: LESSONS LIST (within selected branch) ── */}
      {selectedBranchId && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Controls: Search & Subject Pills */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexWrap: 'wrap', gap: '1rem'
          }}>
            {/* Search Input */}
            <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
              <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="Rechercher un cours ou enseignant..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ 
                  width: '100%', padding: '0.75rem 1rem 0.75rem 3rem', background: 'var(--bg-glass)', 
                  border: '1px solid var(--border)', borderRadius: '12px', color: 'white', outline: 'none',
                  fontSize: '0.88rem'
                }}
              />
            </div>

            {/* Subject Filters */}
            {subjects.length > 2 && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {subjects.map(sub => (
                  <button
                    key={sub}
                    onClick={() => setSelectedSubject(sub)}
                    style={{
                      padding: '0.45rem 1rem', borderRadius: '99px', fontSize: '0.78rem', fontWeight: 700,
                      cursor: 'pointer',
                      border: selectedSubject === sub ? '1px solid var(--violet)' : '1px solid var(--border)',
                      background: selectedSubject === sub ? 'var(--violet-soft)' : 'var(--bg-glass)',
                      color: selectedSubject === sub ? 'var(--violet)' : 'var(--text-muted)',
                      transition: 'all 0.2s'
                    }}
                  >
                    {sub === 'Tous' ? 'Toutes les matières' : sub}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Document Type Tabs */}
          <div style={{ 
            display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', 
            paddingBottom: '0.25rem', margin: '0.5rem 0 1rem 0', flexWrap: 'wrap'
          }}>
            {[
              { id: 'all', label: 'Tous' },
              { id: 'course', label: '📖 Cours' },
              { id: 'exercises', label: '📝 Séries d\'exercices' },
              { id: 'homework', label: '📑 Devoirs Surveillés' },
              { id: 'concours', label: '🏆 Concours' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: 'none', border: 'none', 
                  borderBottom: activeTab === tab.id ? '2px solid var(--violet)' : '2px solid transparent',
                  color: activeTab === tab.id ? 'var(--violet)' : 'var(--text-muted)',
                  padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 800,
                  cursor: 'pointer', transition: 'all 0.2s', paddingBottom: '0.75rem',
                  marginBottom: '-5px'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Lessons List Grid */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6rem 0', color: 'var(--text-muted)' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid rgba(99,102,241,0.1)', borderTop: '3px solid var(--violet)', animation: 'spinLvl 1s linear infinite', marginBottom: '1rem' }} />
              <p>Chargement des fiches de cours...</p>
              <style>{`@keyframes spinLvl { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
          ) : filteredLessons.length === 0 ? (
            <div className="glass-panel" style={{ padding: '5rem 2rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              <BookOpen size={48} style={{ margin: '0 auto 1rem', opacity: 0.25, display: 'block' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>Aucune fiche de cours disponible</h3>
              <p style={{ fontSize: '0.85rem', marginTop: '0.4rem', maxWidth: '380px', margin: '0.4rem auto 0' }}>
                {searchTerm || selectedSubject !== 'Tous'
                  ? 'Aucun cours ne correspond à vos filtres de recherche.'
                  : 'Les enseignants n\'ont pas encore publié de cours pour ce niveau scolaire.'
                }
              </p>
            </div>
          ) : activeTab === 'concours' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {filteredLessons.map((exam, idx) => {
                const qCount = exam.questions?.length || 0;
                const locked = false; // All exams are freely accessible
                const accent = selectedParent?.textColor || 'var(--violet)';
                const accentSoft = selectedParent?.bgSoft || 'rgba(99, 102, 241, 0.08)';

                return (
                  <div
                    key={exam.id}
                    className="exam-list-item"
                    style={{
                      borderLeft: `4px solid ${accent}`,
                      background: 'var(--bg-card)',
                      borderRadius: '12px',
                      padding: '1.25rem 1.5rem',
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '1.25rem',
                      border: '1px solid var(--border)',
                      borderLeftWidth: '4px',
                      borderLeftColor: accent,
                      transition: 'all 0.2s',
                      boxShadow: 'var(--shadow-card)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: '12px', flexShrink: 0,
                        background: accentSoft,
                        border: `1px solid ${accent}33`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1rem', fontWeight: 900, color: accent,
                      }}>
                        {String(idx + 1).padStart(2, '0')}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                          <h3 style={{ fontWeight: 700, fontSize: '0.97rem', margin: 0, color: 'var(--text-main)', lineHeight: 1.35 }}>
                            {exam.title}
                          </h3>

                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.76rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <Clock size={11} /> {exam.year}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <BookOpen size={11} /> {qCount} QCM
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <BrainCircuit size={11} /> Algorithme SRS
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="exam-actions-container" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        className="btn exam-action-btn srs-btn"
                        onClick={() => {
                           navigate(`/study?exam=${exam.examId}`, { state: { from: window.location.pathname } });
                        }}
                        title="Mode révision SRS"
                        style={{ 
                          fontWeight: 800,
                          background: accent,
                          boxShadow: `0 4px 12px ${accent}20`,
                          border: 'none',
                          color: '#fff',
                          padding: '0.5rem 1.15rem',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          cursor: 'pointer',
                          minHeight: '40px'
                        }}
                      >
                        <BrainCircuit size={14} /> SRS
                      </button>
                      
                      <button
                        className="btn-outline exam-action-btn blanc-btn"
                        onClick={() => {
                           navigate(`/exam?exam=${exam.examId}`, { state: { from: window.location.pathname } });
                        }}
                        title="Concours blanc chronométré"
                        style={{ 
                          fontWeight: 700,
                          border: '1.5px solid var(--border)',
                          color: 'var(--text-main)',
                          background: 'transparent',
                          padding: '0.5rem 1.15rem',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          cursor: 'pointer',
                          minHeight: '40px'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = accent;
                          e.currentTarget.style.color = accent;
                          e.currentTarget.style.background = `${accent}0a`;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = 'var(--border)';
                          e.currentTarget.style.color = 'var(--text-main)';
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <Play size={14} /> Blanc
                      </button>

                      <div style={{ height: '20px', width: '1px', background: 'var(--border)', margin: '0 0.25rem' }} />

                      <button
                        className="btn-outline exam-action-btn sujet-btn"
                        onClick={() => {
                           if (typeof trackDownload === 'function') {
                            trackDownload({ type: 'sujet', id: exam.examId, title: `${exam.title} - Sujet` });
                          }
                          handlePrintExam(exam, 'sujet');
                        }}
                        title="Voir le sujet de l'examen"
                        style={{ 
                          color: 'var(--text-muted)',
                          fontWeight: 600,
                          border: '1px solid var(--border)',
                          background: 'var(--bg-glass)',
                          padding: '0.5rem 1.15rem',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          cursor: 'pointer',
                          minHeight: '40px'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = accent;
                          e.currentTarget.style.color = accent;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = 'var(--border)';
                          e.currentTarget.style.color = 'var(--text-muted)';
                        }}
                      >
                        <FileDown size={13} /> Sujet
                      </button>
      
                      <button
                        className="btn-outline exam-action-btn corrige-btn"
                        onClick={() => {
                           if (typeof trackDownload === 'function') {
                            trackDownload({ type: 'corrige', id: exam.examId, title: `${exam.title} - Corrigé` });
                          }
                          handlePrintExam(exam, 'corrige');
                        }}
                        title="Voir le corrigé de l'examen"
                        style={{ 
                          color: 'var(--text-muted)',
                          fontWeight: 600,
                          border: '1px solid var(--border)',
                          background: 'var(--bg-glass)',
                          padding: '0.5rem 1.15rem',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          cursor: 'pointer',
                          minHeight: '40px'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = accent;
                          e.currentTarget.style.color = accent;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = 'var(--border)';
                          e.currentTarget.style.color = 'var(--text-muted)';
                        }}
                      >
                        <FileDown size={13} /> Corrigé
                      </button>
      
                      <button
                        className="btn-outline exam-action-btn grille-btn"
                        onClick={() => {
                           if (typeof trackDownload === 'function') {
                            trackDownload({ type: 'grille', id: exam.examId, title: `${exam.title} - Grille OMR` });
                          }
                          handleDownloadPDF(exam);
                        }}
                        title="Télécharger la grille de réponse OMR"
                        style={{ 
                          color: 'var(--text-muted)',
                          fontWeight: 600,
                          border: '1px solid var(--border)',
                          background: 'var(--bg-glass)',
                          padding: '0.5rem 1.15rem',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          cursor: 'pointer',
                          minHeight: '40px'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = accent;
                          e.currentTarget.style.color = accent;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = 'var(--border)';
                          e.currentTarget.style.color = 'var(--text-muted)';
                        }}
                      >
                        <FileDown size={13} /> Grille
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '1.5rem'
            }}>
              {filteredLessons.map((l) => {
                return (
                  <div
                    key={l.id}
                    onClick={() => {
                       if (l.isExam) {
                        navigate(`/study?exam=${l.examId}`, { state: { from: window.location.pathname } });
                      } else {
                        navigate(`/admin/lessons/${l.id}`);
                      }
                    }}
                    className="glass-panel"
                    style={{
                      padding: '1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      cursor: 'pointer',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-glass)',
                      position: 'relative',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--border-hover)';
                      e.currentTarget.style.background = 'var(--bg-hover)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.background = 'var(--bg-glass)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{ 
                          background: l.subject === 'Physique' || l.subject === 'Chimie' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(99, 102, 241, 0.08)',
                          color: l.subject === 'Physique' || l.subject === 'Chimie' ? 'var(--emerald)' : 'var(--violet)',
                          padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800
                        }}>
                          {l.subject}
                        </span>

                        <span style={{ 
                          background: l.docType === 'homework' ? 'rgba(239, 68, 68, 0.08)' : l.docType === 'exercises' ? 'rgba(245, 158, 11, 0.08)' : l.docType === 'concours' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(59, 130, 246, 0.08)',
                          color: l.docType === 'homework' ? 'var(--danger)' : l.docType === 'exercises' ? 'var(--warning)' : l.docType === 'concours' ? 'var(--emerald)' : '#3B82F6',
                          padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800
                        }}>
                          {l.docType === 'homework' ? 'فرض محروس' : l.docType === 'exercises' ? 'سلسلة تمارين' : l.docType === 'concours' ? 'مباراة' : 'درس'}
                        </span>
                      </div>
                      

                    </div>

                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-main)', lineHeight: 1.45 }}>
                      {renderWithMath(l.title)}
                    </h3>

                    <div style={{ 
                      marginTop: 'auto', paddingTop: '0.85rem', borderTop: '1px solid var(--border)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      fontSize: '0.75rem', color: 'var(--text-subtle)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <User size={13} />
                        <span>{l.teacher || 'Prof. L\'CONQ'}</span>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontWeight: 700, color: selectedParent?.textColor || 'var(--violet)' }}>
                        {l.isExam ? "Commencer le concours" : "Ouvrir le cours"} <ChevronRight size={13} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

    </div>
  );
}
