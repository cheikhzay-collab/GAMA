import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft, BrainCircuit, Play, Zap, Lock,
  BookOpen, Clock, GraduationCap, FileDown,
  Stethoscope, Cpu, Wrench, BarChart3, Wifi, TrendingUp, Compass
} from 'lucide-react';
import { generateAnswerSheet } from '../utils/generateAnswerSheet';
import ScanUploadModal from '../components/ScanUploadModal';
import { generateSubjectHTML, generateCorrectionHTML, openPrintWindow } from '../utils/generateExamPDF';

/* ─── Icon Mapping ─── */
const ICON_MAP = {
  'stethoscope': Stethoscope,
  'cpu': Cpu,
  'wrench': Wrench,
  'barchart': BarChart3,
  'wifi': Wifi,
  'trendingup': TrendingUp,
  'compass': Compass,
  'graduationcap': GraduationCap
};

const SCHOOL_BRANDS_DEFAULTS = {
  '2bac_sm': { iconKey:'compass', gradient:'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)', accent:'#8B5CF6', accentSoft:'rgba(139, 92, 246, 0.08)', tag:'Sciences Mathématiques' },
  '2bac_pc_svt': { iconKey:'stethoscope', gradient:'linear-gradient(135deg, #EF4444 0%, #991B1B 100%)', accent:'#EF4444', accentSoft:'rgba(239, 68, 68, 0.08)', tag:'Sciences Expérimentales' },
  '1bac_sci': { iconKey:'cpu', gradient:'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)', accent:'#3B82F6', accentSoft:'rgba(59, 130, 246, 0.08)', tag:'Sciences' },
  'common_core_sci': { iconKey:'wrench', gradient:'linear-gradient(135deg, #0EA5E9 0%, #0369A1 100%)', accent:'#0EA5E9', accentSoft:'rgba(14, 165, 233, 0.08)', tag:'Tronc Commun' },
  '2bac_arts': { iconKey:'barchart', gradient:'linear-gradient(135deg, #10B981 0%, #047857 100%)', accent:'var(--emerald)', accentSoft:'rgba(16, 185, 129, 0.08)', tag:'Lettres' },
  '1bac_arts': { iconKey:'wifi', gradient:'linear-gradient(135deg, #F97316 0%, #C2410C 100%)', accent:'#F97316', accentSoft:'rgba(249, 115, 22, 0.08)', tag:'Lettres' },
  'common_core_arts': { iconKey:'trendingup', gradient:'linear-gradient(135deg, #14B8A6 0%, #0F766E 100%)', accent:'#14B8A6', accentSoft:'rgba(20, 184, 166, 0.08)', tag:'Tronc Commun' }
};

const DEFAULT_BRAND = { iconKey:'graduationcap', gradient:'linear-gradient(135deg, #6366F1 0%, #4338CA 100%)', accent:'#818CF8', accentSoft:'rgba(129, 140, 248, 0.08)', tag:'Niveau' };

export const getLevelDisplayName = (id, isArabic = false) => {
  switch (id) {
    case 'common_core_sci': return isArabic ? 'جدع مشترك علوم' : 'Tronc Commun Scientifique';
    case 'common_core_arts': return isArabic ? 'جدع مشترك آداب' : 'Tronc Commun Littéraire';
    case '1bac_sci': return isArabic ? 'أولى باك علوم تجريبية' : '1ère Bac Sciences Expérimentales';
    case '1bac_arts': return isArabic ? 'أولى باك آداب' : '1ère Bac Littéraire';
    case '2bac_sm': return isArabic ? 'ثانية باك علوم رياضية' : '2ème Bac Sciences Mathématiques';
    case '2bac_pc_svt': return isArabic ? 'ثانية باك علوم تجريبية (PC/SVT)' : '2ème Bac Sciences Expérimentales (PC/SVT)';
    case '2bac_arts': return isArabic ? 'ثانية باك آداب' : '2ème Bac Lettres & Sciences Humaines';
    default: return id;
  }
};

export const mapLegacySchoolToLevel = (sch) => {
  if (!sch) return sch;
  if (sch === 'Médecine / Pharmacie' || sch === 'ENCG') return '2bac_pc_svt';
  if (['ENSA', 'ENSAM', 'INPT', 'INSEA', 'Général (Prépa)'].includes(sch)) return '2bac_sm';
  return sch;
};

function getBrand(name, schoolBranding) {
  const custom = schoolBranding?.[name] || {};
  const base   = SCHOOL_BRANDS_DEFAULTS[name] || { ...DEFAULT_BRAND, tag: name };
  return { ...base, ...custom };
}

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

export default function SchoolExamsPage() {
  const { schoolName } = useParams();
  const school = decodeURIComponent(schoolName);
  const { exams, user, schoolBranding, schools, isExamLocked, loadExamQuestions, trackDownload } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [scanExam, setScanExam] = useState(null);
  const isMobile = useIsMobile();

  const brand = getBrand(school, schoolBranding);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (brand && brand.isActive === false && !isAdmin) {
      navigate('/schools', { replace: true });
    }
  }, [brand, isAdmin, navigate]);
  const schoolExams = exams
    .filter(e => (e.level === school || mapLegacySchoolToLevel(e.school) === school) && e.isActive !== false && e.isArchived !== true)
    .sort((a, b) => (parseInt(b.year) || 0) - (parseInt(a.year) || 0));

  const handleDownloadPDF = async (exam) => {
    let questions = exam.questions;
    if (!questions || questions.length === 0) {
      try {
        questions = await loadExamQuestions(exam.id);
      } catch (err) {
        console.error('Failed to load questions for OMR sheet:', err);
        return;
      }
    }
    await generateAnswerSheet({ ...exam, questions }, user);
  };

  const IconComponent = ICON_MAP[brand.iconKey] || GraduationCap;

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      {/* ── School Hero Header ── */}
      <div style={{
        borderRadius: '1.5rem',
        overflow: 'hidden',
        marginBottom: '2rem',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)',
      }}>
        {/* Gradient Hero Section */}
        <div style={{
          background: brand.gradient,
          padding: 'clamp(1.5rem, 5vw, 3rem) clamp(1.25rem, 4vw, 2.5rem)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Watermark Logo Background */}
          <div style={{ 
            position:'absolute', right:'-5%', top:'-5%', 
            width:'320px', height:'320px', 
            opacity: brand.logoUrl ? 0.08 : 0.12, transform:'rotate(-15deg)', 
            display:'flex', alignItems:'center', justifyContent:'center',
            pointerEvents:'none', zIndex:0,
            color: '#fff'
          }}>
            {brand.logoUrl ? (
              <img 
                src={brand.logoUrl} 
                style={{ 
                  width:'100%', 
                  height:'100%', 
                  objectFit:'contain',
                  filter: 'grayscale(100%) contrast(0.8)' 
                }} 
                alt="" 
              />
            ) : (
              <div style={{ transform: 'scale(2.2)' }}>
                <IconComponent size={140} />
              </div>
            )}
          </div>

          <div style={{ position:'absolute', top:-60, left:-60, width:220, height:220, borderRadius:'50%', background:'rgba(255,255,255,0.06)', pointerEvents:'none' }} />

          <div style={{ position:'relative', zIndex:2 }}>
            <button
              onClick={() => navigate('/schools')}
              style={{
                background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.25)',
                color:'#fff', borderRadius:'10px', padding:'0.45rem 1.15rem',
                cursor:'pointer', display:'flex', alignItems:'center', gap:'0.5rem',
                fontSize:'0.82rem', fontWeight:700, marginBottom:'2rem',
                backdropFilter:'blur(12px)', transition:'all 0.2s',
                minHeight: '44px' // Touch Target Optimization
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; e.currentTarget.style.transform = 'translateX(-4px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.transform = 'translateX(0)'; }}
            >
              <ArrowLeft size={16} /> Retour aux niveaux
            </button>

            <div style={{ display:'flex', alignItems:'center', gap:'1.5rem', flexWrap:'wrap' }}>
              {brand.logoUrl ? (
                <img src={brand.logoUrl} alt="" style={{ width:88, height:88, objectFit:'contain', filter:'drop-shadow(0 12px 24px rgba(0,0,0,0.3))' }} />
              ) : (
                <div style={{
                  width: 80, height: 80, borderRadius: '20px',
                  background: 'rgba(255, 255, 255, 0.18)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 12px 24px rgba(0,0,0,0.2)',
                  color: '#fff'
                }}>
                  <IconComponent size={36} />
                </div>
              )}
              
              <div>
                <div style={{
                  display:'inline-flex', alignItems:'center',
                  background:'rgba(255,255,255,0.15)', backdropFilter:'blur(12px)',
                  border:'1px solid rgba(255,255,255,0.3)',
                  padding:'0.28rem 0.95rem', borderRadius:'99px',
                  fontSize:'0.72rem', fontWeight:800, color:'#fff',
                  textTransform:'uppercase', letterSpacing:'0.12em',
                  marginBottom:'0.75rem',
                }}>
                  {brand.tag}
                </div>
                <h1 style={{ fontSize:'2.5rem', fontWeight:900, color:'#fff', letterSpacing:'-0.03em', lineHeight:1.1, margin: 0 }}>
                  {getLevelDisplayName(school)}
                </h1>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid Under Hero */}
        <div style={{
          background: 'var(--bg-card)',
          padding: isMobile ? '0.75rem 1rem' : '1.25rem 2rem',
          display: 'flex',
          flexDirection: isMobile ? 'row' : 'row',
          justifyContent: isMobile ? 'space-between' : 'flex-start',
          gap: isMobile ? '0.5rem' : '2.5rem',
          flexWrap: 'wrap',
        }}>
          {[
            { icon: BookOpen, label: 'Concours', value: schoolExams.length, color: brand.accent },
            { icon: Zap,      label: 'Premium', value: schoolExams.filter(e => e.tier === 'premium').length, color: 'var(--violet)' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: isMobile ? '1' : 'none', minWidth: 0 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '8px', background: 'var(--bg-glass)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0
              }}>
                <Icon size={15} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</p>
                <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {schoolExams.length === 0 ? (
        <div className="glass-panel text-center" style={{ padding:'4rem 2rem' }}>
          <div style={{
            width: '80px', height: '80px', background: brand.accentSoft, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem',
            color: brand.accent,
          }}>
            <BookOpen size={36} />
          </div>
          <h3 style={{ marginBottom:'0.5rem', fontSize:'1.1rem' }}>Aucun examen pour le moment</h3>
          <p style={{ fontSize:'0.88rem', color: 'var(--text-muted)' }}>
            L'administrateur n'a pas encore mis en ligne d'examens pour <strong>{school}</strong>.
          </p>
          <button className="btn" style={{ marginTop:'1.5rem', minHeight: '44px' }} onClick={() => navigate('/dashboard')}>
            Retour au Dashboard
          </button>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'0.875rem' }}>
          {schoolExams.map((exam, idx) => {
            const qCount    = exam.questions?.length || 0;
            const locked    = isExamLocked(exam);

            return (
              <div
                key={exam.id}
                className="exam-list-item"
                style={{
                  borderLeft: `4px solid ${brand.accent}`,
                  background: 'var(--bg-card)',
                  borderRadius: '12px',
                  padding: isMobile ? '1.25rem' : '1.25rem 1.5rem',
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'stretch' : 'center',
                  justifyContent: 'space-between',
                  gap: isMobile ? '1.25rem' : '1.25rem',
                  border: '1px solid var(--border)',
                  borderLeftWidth: '4px',
                  borderLeftColor: brand.accent,
                  transition: 'all 0.2s',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                {/* Left side: Badge & Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }}>
                  {/* Number badge */}
                  <div style={{
                    width: 42, height: 42, borderRadius: '12px', flexShrink: 0,
                    background: brand.accentSoft,
                    border: `1px solid ${brand.accent}33`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1rem', fontWeight: 900, color: brand.accent,
                  }}>
                    {String(idx + 1).padStart(2, '0')}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                      <h3 style={{ fontWeight: 700, fontSize: '0.97rem', margin: 0, color: 'var(--text-main)', lineHeight: 1.35 }}>
                        {exam.name}
                      </h3>
                      {exam.tier === 'premium' && (
                        <span className="badge badge-pro" style={{ flexShrink: 0 }}><Zap size={9} /> PRO</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.76rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        <Clock size={11} /> {exam.year}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        <BookOpen size={11} /> {qCount} QCM
                      </span>
                      {!isMobile && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <BrainCircuit size={11} /> Algorithme SRS
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Cohesive, Premium Actions Grid */}
                <div className="exam-actions-container">
                  {/* 1. Primary Actions (SRS & Blanc Exam) */}
                  <button
                    className="btn exam-action-btn srs-btn"
                    onClick={() => {
                      if (locked) {
                        navigate(user ? '/subscription' : '/login');
                      } else {
                        navigate(`/study?exam=${exam.id}`, { state: { from: location.pathname } });
                      }
                    }}
                    title="Mode révision SRS"
                    style={{ 
                      fontWeight: 800,
                      background: brand.accent, // Dynamic Brand Coloring
                      boxShadow: `0 4px 12px ${brand.accent}20`,
                      border: 'none',
                    }}
                    onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.95)'}
                    onMouseLeave={e => e.currentTarget.style.filter = 'none'}
                  >
                    {locked ? <Lock size={15} /> : <BrainCircuit size={15} />} SRS
                  </button>
                  
                  <button
                    className="btn-outline exam-action-btn blanc-btn"
                    onClick={() => {
                      if (locked) {
                        navigate(user ? '/subscription' : '/login');
                      } else {
                        navigate(`/exam?exam=${exam.id}`, { state: { from: location.pathname } });
                      }
                    }}
                    title="Concours blanc chronométré"
                    style={{ 
                      fontWeight: 700,
                      border: '1.5px solid var(--border)',
                      color: 'var(--text-main)',
                      background: 'transparent',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = brand.accent;
                      e.currentTarget.style.color = brand.accent;
                      e.currentTarget.style.background = `${brand.accent}0a`;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.color = 'var(--text-main)';
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {locked ? <Lock size={15} /> : <Play size={15} />} Blanc
                  </button>

                  {/* Vertical Divider (Desktop Only) */}
                  <div className="exam-actions-divider" />

                  {/* 2. Secondary Utility Actions (Sujet, Corrigé, Grille) */}
                  <button
                    className="btn-outline exam-action-btn sujet-btn"
                    onClick={() => {
                      if (locked) {
                        navigate(user ? '/subscription' : '/login');
                        return;
                      }
                      if (typeof trackDownload === 'function') {
                        trackDownload({ type: 'sujet', id: exam.id, title: `${exam.name} - Sujet` });
                      }
                      if (exam.pdfUrl) {
                        window.open(exam.pdfUrl, '_blank');
                      } else {
                        if (isMobile) {
                          // On mobile, open the dedicated print view in a new tab synchronously to bypass popup blockers
                          window.open(`/print?examId=${exam.id}&type=sujet`, '_blank');
                        } else {
                          // On desktop, open a print preview popup synchronously and write contents dynamically
                          const win = window.open('', '_blank');
                          if (win) {
                            win.document.write('<html><head><title>Génération du PDF...</title></head><body style="background:#09090b;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;margin:0;padding:20px;text-align:center;"><div><h3 style="margin:0 0 10px 0;">L\'CONQ</h3><p style="margin:0;color:#a1a1aa;font-size:0.9rem;">Génération de votre sujet PDF en cours...</p></div></body></html>');
                          }
                          (async () => {
                            try {
                              let questions = exam.questions;
                              if (!questions || questions.length === 0) {
                                questions = await loadExamQuestions(exam.id);
                              }
                              const schoolsList = schools && schools.length > 0 ? schools : Array.from(new Set(exams.map(e => e.school))).filter(Boolean);
                              const html = await generateSubjectHTML(exam.name, exam.school, exam.year, questions || [], { examId: exam.id, schoolsList });
                              openPrintWindow(html, 'sujet', win);
                            } catch (err) {
                              console.error('Failed to generate subject PDF:', err);
                              if (win) win.close();
                            }
                          })();
                        }
                      }
                    }}
                    title="Voir le sujet de l'examen"
                    style={{ 
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-glass)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = brand.accent;
                      e.currentTarget.style.color = brand.accent;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.color = 'var(--text-muted)';
                    }}
                  >
                    {locked ? <Lock size={14} /> : <FileDown size={14} />} Sujet
                  </button>
  
                  <button
                    className="btn-outline exam-action-btn corrige-btn"
                    onClick={() => {
                      if (locked) {
                        navigate(user ? '/subscription' : '/login');
                        return;
                      }
                      if (typeof trackDownload === 'function') {
                        trackDownload({ type: 'corrige', id: exam.id, title: `${exam.name} - Corrigé` });
                      }
                      if (isMobile) {
                        // On mobile, open the dedicated print view in a new tab synchronously to bypass popup blockers
                        window.open(`/print?examId=${exam.id}&type=corrige`, '_blank');
                      } else {
                        // On desktop, open a print preview popup synchronously and write contents dynamically
                        const win = window.open('', '_blank');
                        if (win) {
                          win.document.write('<html><head><title>Génération du PDF...</title></head><body style="background:#09090b;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;margin:0;padding:20px;text-align:center;"><div><h3 style="margin:0 0 10px 0;">L\'CONQ</h3><p style="margin:0;color:#a1a1aa;font-size:0.9rem;">Génération de votre corrigé PDF en cours...</p></div></body></html>');
                        }
                        (async () => {
                          try {
                            let questions = exam.questions;
                            if (!questions || questions.length === 0) {
                              questions = await loadExamQuestions(exam.id);
                            }
                            const schoolsList = schools && schools.length > 0 ? schools : Array.from(new Set(exams.map(e => e.school))).filter(Boolean);
                            const html = generateCorrectionHTML(exam.name, exam.school, exam.year, questions || [], { examId: exam.id, schoolsList });
                            openPrintWindow(html, 'corrigé', win);
                          } catch (err) {
                            console.error('Failed to generate correction PDF:', err);
                            if (win) win.close();
                          }
                        })();
                      }
                    }}
                    title="Voir le corrigé de l'examen"
                    style={{ 
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-glass)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = brand.accent;
                      e.currentTarget.style.color = brand.accent;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.color = 'var(--text-muted)';
                    }}
                  >
                    {locked ? <Lock size={14} /> : <FileDown size={14} />} Corrigé
                  </button>
 
                  <button
                    className="btn-outline exam-action-btn grille-btn"
                    onClick={() => {
                      if (locked) {
                        navigate(user ? '/subscription' : '/login');
                        return;
                      }
                      if (typeof trackDownload === 'function') {
                        trackDownload({ type: 'grille', id: exam.id, title: `${exam.name} - Grille OMR` });
                      }
                      handleDownloadPDF(exam);
                    }}
                    title="Télécharger la grille de réponse OMR"
                    style={{ 
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-glass)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = brand.accent;
                      e.currentTarget.style.color = brand.accent;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.color = 'var(--text-muted)';
                    }}
                  >
                    {locked ? <Lock size={14} /> : <FileDown size={14} />} Grille
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Scan Upload Modal */}
      {scanExam && (
        <ScanUploadModal
          exam={scanExam}
          onClose={() => setScanExam(null)}
          onSRSLaunch={() => navigate(`/study?exam=${scanExam.id}`, { state: { from: location.pathname } })}
        />
      )}
    </div>
  );
}
