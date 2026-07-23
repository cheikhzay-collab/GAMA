import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, Camera, CheckCircle2, XCircle, AlertCircle,
  BrainCircuit, Zap, RotateCcw, Loader2, Check, TrendingUp, Printer, Home
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { scanAnswerSheet, readQRCodeFromImage } from '../utils/OMRScanner';
import DiagnosticReport from '../components/DiagnosticReport';
import { renderWithMath } from '../utils/mathRenderer';
import SmartCameraScanner from '../components/SmartCameraScanner';
import { generateStudentReportHTML, openPrintWindow } from '../utils/generateExamPDF';
import { getAllClasses, recordStudentExamGrade } from '../services/classService';
import { getAllUsers } from '../services/userService';

const CHOICES = ['A', 'B', 'C', 'D', 'E'];

/* ── Math Helper ──────────────────────────────────────────────── */
function renderMathSnippet(text) {
  return renderWithMath(text);
}

/* ── Confidence Indicator ────────────────────────────────────────── */
function ConfidenceDot({ confidence }) {
  const color = confidence > 0.6 ? 'var(--emerald)' : confidence > 0.3 ? 'var(--warning)' : 'var(--danger)';
  const label = confidence > 0.6 ? 'Clair' : confidence > 0.3 ? 'À vérifier' : 'Ambigu';
  return (
    <span title={`Confiance : ${Math.round(confidence * 100)}% — ${label}`} style={{
      display:'inline-flex', alignItems:'center', gap:'0.25rem',
      fontSize:'0.7rem', color, fontWeight:700,
    }}>
      <span style={{ width:7, height:7, borderRadius:'50%', background:color, display:'inline-block' }} />
      {Math.round(confidence * 100)}%
    </span>
  );
}

/* ── Verification Row ───────────────────────────────────────────── */
function VerifyGrid({ scanned, questions, onChange, isMobile }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: isMobile ? 320 : 420, overflowY: 'auto', paddingRight: '6px' }}>
      {scanned.map((row, idx) => {
        const qTextRaw = questions[idx]?.question || `Question ${row.q}`;
        const isLowConfidence = row.confidence < 0.35;
        return (
          <div key={row.q} className="verify-grid-row" style={{
            display: 'flex', 
            flexDirection: 'column',
            gap: '0.6rem',
            padding: isMobile ? '0.6rem 0.8rem' : '0.75rem 1rem',
            background: isLowConfidence ? 'rgba(245, 158, 11, 0.05)' : 'rgba(255, 255, 255, 0.02)',
            borderRadius: '1rem',
            border: `1.5px solid ${isLowConfidence ? 'rgba(245, 158, 11, 0.25)' : 'var(--border)'}`,
            transition: 'border-color 0.2s, background-color 0.2s'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-main)' }}>Question {row.q}</span>
              <ConfidenceDot confidence={row.confidence} />
            </div>
            
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', display: 'block', width: '100%' }}>
              {renderMathSnippet(qTextRaw)}
            </span>

            {/* Option selection buttons */}
            <div style={{ display: 'flex', gap: isMobile ? '0.45rem' : '0.35rem', flexWrap: 'wrap', marginTop: '0.2rem', alignItems: 'center' }}>
              {CHOICES.map(opt => (
                <button 
                  key={opt} 
                  onClick={() => onChange(idx, opt)} 
                  style={{
                    width: isMobile ? 38 : 32, 
                    height: isMobile ? 38 : 32, 
                    borderRadius: '50%', 
                    fontWeight: 800, 
                    fontSize: isMobile ? '0.95rem' : '0.85rem',
                    cursor: 'pointer', 
                    transition: 'all 0.2s ease',
                    background: row.answer === opt ? 'var(--violet)' : 'rgba(255,255,255,0.03)',
                    color: row.answer === opt ? '#fff' : 'var(--text-muted)',
                    border: row.answer === opt ? '2px solid var(--violet)' : '1px solid var(--border)',
                    boxShadow: row.answer === opt ? '0 4px 12px var(--violet-glow)' : 'none',
                  }}
                  onMouseEnter={e => {
                    if (row.answer !== opt) {
                      e.currentTarget.style.borderColor = 'var(--violet)';
                      e.currentTarget.style.color = 'var(--text-main)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (row.answer !== opt) {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.color = 'var(--text-muted)';
                    }
                  }}
                >
                  {opt}
                </button>
              ))}
              <button 
                onClick={() => onChange(idx, null)} 
                style={{
                  padding: isMobile ? '0 1rem' : '0 0.75rem', 
                  height: isMobile ? 38 : 32, 
                  borderRadius: '0.5rem', 
                  fontWeight: 800, 
                  fontSize: isMobile ? '0.82rem' : '0.75rem',
                  cursor: 'pointer', 
                  transition: 'all 0.2s ease',
                  background: row.answer === null ? 'var(--danger-soft)' : 'rgba(255,255,255,0.03)',
                  color: row.answer === null ? 'var(--danger)' : 'var(--text-muted)',
                  border: `1px solid ${row.answer === null ? 'var(--danger)' : 'var(--border)'}`,
                }}
              >
                Laisser Vide
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Correction Result Row ───────────────────────────────────────── */
function ResultRow({ row }) {
  const cfg = {
    correct: { bg: 'var(--emerald-soft)', border: 'var(--emerald)', icon: <CheckCircle2 size={16}/>, label: 'Correct', color: 'var(--emerald)' },
    wrong: { bg: 'var(--danger-soft)', border: 'var(--danger)', icon: <XCircle size={16}/>, label: 'Incorrect', color: 'var(--danger)' },
    empty: { bg: 'rgba(255,255,255,0.01)', border: 'var(--border)', icon: <AlertCircle size={16}/>, label: 'Laissé Vide', color: 'var(--text-muted)' },
  };
  const status = row.detected === null ? 'empty' : row.result;
  const c = cfg[status];
  const isDark = document.body.classList.contains('light-theme') === false;

  return (
    <div 
      className="result-row-card-2026"
      style={{
        display: 'flex', 
        flexDirection: 'column', 
        gap: '0.65rem',
        padding: '1.1rem 1.35rem',
        background: c.bg, 
        borderRadius: '1.25rem',
        borderLeft: `4px solid ${c.border}`,
        borderTop: '1px solid var(--border)',
        borderRight: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.015)',
        transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 900, fontSize: '0.98rem', color: 'var(--text-main)' }}>Question {row.q}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: c.color, fontSize: '0.82rem', fontWeight: 800 }}>
          {c.icon} {c.label}
        </span>
      </div>
      
      <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', display: 'block', margin: '0.1rem 0' }}>
        {renderMathSnippet(row.question)}
      </span>
      
      <div className="result-row-details" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.82rem', marginTop: '0.2rem' }}>
        <span style={{ color: 'var(--text-subtle)', fontWeight: 600 }}>Réponse cochée :</span>
        <span style={{ 
          padding: '0.25rem 0.65rem', 
          borderRadius: '0.5rem', 
          background: status === 'correct' ? 'rgba(16, 185, 129, 0.12)' : status === 'wrong' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 255, 255, 0.05)', 
          fontWeight: 900, 
          color: status === 'correct' ? 'var(--emerald)' : status === 'wrong' ? 'var(--danger)' : 'var(--text-muted)',
          border: `1.5px solid ${status === 'correct' ? 'rgba(16, 185, 129, 0.25)' : status === 'wrong' ? 'rgba(239, 68, 68, 0.25)' : 'var(--border)'}`
        }}>
          {row.detected || '—'}
        </span>
        {status !== 'correct' && (
          <>
            <span style={{ color: 'var(--text-subtle)', opacity: 0.5 }}>→</span>
            <span style={{ color: 'var(--text-subtle)', fontWeight: 600 }}>Réponse attendue :</span>
            <span style={{ 
              padding: '0.25rem 0.65rem', 
              borderRadius: '0.5rem', 
              background: 'rgba(16, 185, 129, 0.12)', 
              fontWeight: 900, 
              color: 'var(--emerald)',
              border: '1.5px solid rgba(16, 185, 129, 0.25)'
            }}>
              {row.correct}
            </span>
          </>
        )}
        <span style={{ flexGrow: 1 }} />
        {/* Topic Badge */}
        <span style={{
          fontSize: '0.72rem',
          padding: '0.2rem 0.6rem',
          background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          color: 'var(--text-muted)',
          fontWeight: 700
        }}>
          {row.topic}
        </span>
      </div>
    </div>
  );
}

/* ── Interactive AR OMR Copy Overlay Component ──────────────────────── */
function ARCopyOverlay({ imagePreview, corrected }) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const [hoveredQuestion, setHoveredQuestion] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Redraw overlays on image load, resize, or data changes
  const redraw = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas || !img.complete || img.naturalWidth === 0) return;

    // Match canvas dimensions to the image's displayed size
    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / img.naturalWidth;
    const scaleY = canvas.height / img.naturalHeight;

    // Draw bubbles
    corrected.forEach(row => {
      if (!row.coords) return;

      const correctOpt = row.correct;
      const detectedOpt = row.detected;
      const result = row.result; // 'correct', 'wrong', 'empty'

      // Radius of the overlay circle (approx. 2.6mm on A4)
      const r = (2.8 / 210) * canvas.width;

      // Draw correct bubble (always highlight in green)
      if (row.coords[correctOpt]) {
        const cx = row.coords[correctOpt].x * scaleX;
        const cy = row.coords[correctOpt].y * scaleY;

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        // Soft green fill
        ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
        ctx.fill();
        // Solid green border with a glow
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = Math.max(1.5, canvas.width / 400);
        ctx.shadowColor = 'rgba(16, 185, 129, 0.6)';
        ctx.shadowBlur = 4;
        ctx.stroke();
        // Reset shadow
        ctx.shadowBlur = 0;
      }

      // Draw wrong bubble (highlight in red)
      if (result === 'wrong' && detectedOpt && row.coords[detectedOpt]) {
        const cx = row.coords[detectedOpt].x * scaleX;
        const cy = row.coords[detectedOpt].y * scaleY;

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        // Soft red fill
        ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
        ctx.fill();
        // Solid red border
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = Math.max(1.5, canvas.width / 400);
        ctx.shadowColor = 'rgba(239, 68, 68, 0.6)';
        ctx.shadowBlur = 4;
        ctx.stroke();
        
        // Draw cross/X inside the red bubble
        ctx.shadowBlur = 0;
        ctx.beginPath();
        const size = r * 0.5;
        ctx.moveTo(cx - size, cy - size);
        ctx.lineTo(cx + size, cy + size);
        ctx.moveTo(cx + size, cy - size);
        ctx.lineTo(cx - size, cy + size);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = Math.max(2, canvas.width / 350);
        ctx.stroke();
      }

      // Draw empty reminder (dashed warning/blue circle around expected correct answer)
      if (result === 'empty' && row.coords[correctOpt]) {
        const cx = row.coords[correctOpt].x * scaleX;
        const cy = row.coords[correctOpt].y * scaleY;

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        // Soft orange/yellow fill
        ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
        ctx.fill();
        // Dashed orange border
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = Math.max(1.5, canvas.width / 450);
        ctx.setLineDash([3, 2]);
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash
      }
    });
  }, [corrected]);

  // Handle image load
  const handleImageLoad = () => {
    redraw();
  };

  // Set up resize observer to keep canvas responsive
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    const resizeObserver = new ResizeObserver(() => {
      redraw();
    });
    resizeObserver.observe(img);

    return () => {
      resizeObserver.disconnect();
    };
  }, [redraw]);

  // Track hover to show floating Glassmorphic tooltips
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !img.complete) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const scaleX = canvas.width / img.naturalWidth;
    const scaleY = canvas.height / img.naturalHeight;
    const r = (4.0 / 210) * canvas.width; // slightly larger hit area

    let foundQuestion = null;

    for (const row of corrected) {
      if (!row.coords) continue;
      
      // Check if mouse is near any of the options for this question
      for (const [opt, coord] of Object.entries(row.coords)) {
        const cx = coord.x * scaleX;
        const cy = coord.y * scaleY;
        const distSq = (mx - cx) * (mx - cx) + (my - cy) * (my - cy);
        
        if (distSq <= r * r) {
          foundQuestion = row;
          break;
        }
      }
      if (foundQuestion) break;
    }

    if (foundQuestion) {
      setHoveredQuestion(foundQuestion);
      // Position tooltip near the bubble
      setTooltipPos({
        x: mx + 15,
        y: my - 30
      });
    } else {
      setHoveredQuestion(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredQuestion(null);
  };

  return (
    <div 
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        maxHeight: '650px',
        overflow: 'hidden',
        borderRadius: '1.5rem',
        border: '1px solid var(--border)',
        background: '#09090b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: hoveredQuestion ? 'help' : 'default'
      }}
    >
      {/* Wrapper to constrain canvas overlays precisely to the visible, centered image boundary */}
      <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', maxHeight: '650px' }}>
        <img
          ref={imgRef}
          src={imagePreview}
          alt="Original Scan"
          onLoad={handleImageLoad}
          style={{
            maxWidth: '100%',
            height: 'auto',
            maxHeight: '650px',
            display: 'block'
          }}
        />
        
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'auto'
          }}
        />

        {/* Floating glassmorphic tooltip (relative to wrapper coordinates) */}
        {hoveredQuestion && (
          <div style={{
            position: 'absolute',
            left: tooltipPos.x,
            top: tooltipPos.y,
            background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.15)',
            padding: '0.65rem 1rem',
            borderRadius: '0.75rem',
            color: '#fff',
            fontSize: '0.78rem',
            pointerEvents: 'none',
            zIndex: 50,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.2rem',
            whiteSpace: 'nowrap',
            transition: 'left 0.05s ease, top 0.05s ease'
          }}>
            <div style={{ fontWeight: 800, color: '#a5b4fc', fontSize: '0.82rem' }}>
              Question {hoveredQuestion.q}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', fontWeight: 600 }}>
              <span>Statut :</span>
              <span style={{ 
                color: hoveredQuestion.result === 'correct' ? '#10b981' : hoveredQuestion.result === 'wrong' ? '#ef4444' : '#f59e0b',
                fontWeight: 800
              }}>
                {hoveredQuestion.result === 'correct' ? 'Correct' : hoveredQuestion.result === 'wrong' ? 'Incorrect' : 'Laissé Vide'}
              </span>
            </div>
            <div style={{ fontWeight: 500, color: '#94a3b8' }}>
              Sujet : {hoveredQuestion.topic}
            </div>
            <div style={{ fontWeight: 700, color: '#f8fafc' }}>
              Attendu : {hoveredQuestion.correct} {hoveredQuestion.detected ? `| Coché : ${hoveredQuestion.detected}` : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Global Scanner Page ────────────────────────────────────── */
export default function OMRScannerPage() {
  const { user, theme, mockExamHistory, updateCardProgress, saveMockExamResult, schoolBranding, exams, profName, profPhone, profSite, loadExamQuestions } = useAuth();
  const navigate = useNavigate();

  const isDark = theme === 'dark';
  const textMainColor = isDark ? '#E4E4E7' : '#0F172A';
  const textMutedColor = isDark ? '#A1A1AA' : '#334155';
  const textSubtleColor = isDark ? '#8F8F98' : '#4E5D73';
  const borderCol = isDark ? 'rgba(255, 255, 255, 0.05)' : '#E2E8F0';
  const cardBg = isDark ? 'rgba(24, 24, 27, 0.7)' : '#FFFFFF';

  const emeraldColor = isDark ? '#10B981' : '#059669';
  const dangerColor = isDark ? '#EF4444' : '#DC2626';
  const warningColor = isDark ? '#F59E0B' : '#D97706';
  const emeraldSoftColor = isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(5, 150, 105, 0.08)';
  const dangerSoftColor = isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(220, 38, 38, 0.08)';

  const isPremium = user?.isPremium || user?.role === 'admin' || user?.role === 'prof';
  const omrScansCount = user?.omrScansCount || 0;
  const scanLimit = 50;
  const hasReachedLimit = !isPremium && omrScansCount >= scanLimit;


  const isDirectCaptureEnabled = localStorage.getItem('scanner_direct_capture_enabled') !== 'false';
  const [activeExam,   setActiveExam]   = useState(null);
  const [phase,        setPhase]        = useState('upload');
  const [scanMethod,   setScanMethod]   = useState(() => localStorage.getItem('scanner_direct_capture_enabled') !== 'false' ? 'camera' : 'file');
  const [imagePreview, setImagePreview] = useState(null);
  const [scanned,      setScanned]      = useState([]);
  const [corrected,    setCorrected]    = useState([]);
  const [score,        setScore]        = useState(null);
  const [scanError,    setScanError]    = useState(null);
  const [scanStep,     setScanStep]     = useState(0);
  const [resultsTab,   setResultsTab]   = useState('list');
  const [scannedStudent, setScannedStudent] = useState(null);
  const [assignedClassName, setAssignedClassName] = useState(null);
  const [autoScanNext, setAutoScanNext] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fileRef = useRef(null);

  const handlePrintReport = () => {
    if (!activeExam || !score || !corrected.length) return;
    const settings = {
      profName: profName || '',
      profPhone: profPhone || '',
      profSite: profSite || 'www.lconq.ma'
    };
    const html = generateStudentReportHTML(activeExam, score, corrected, settings);
    openPrintWindow(html);
  };

  const questions = activeExam?.questions || [];
  const Q = questions.length;

  const brand = (activeExam ? schoolBranding[activeExam.school] : null) || { scoring: { correct: 1, wrong: -0.25, empty: 0 } };
  const rules = brand.scoring || { correct: 1, wrong: -0.25, empty: 0 };


  const handleFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setScanError(null);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
    setPhase('scanning');

    // Smooth step animations
    const steps = ['Optimisation', 'Détection QR', 'Calcul Score'];
    for (let i = 0; i < steps.length; i++) {
      await new Promise(r => setTimeout(r, 600));
      setScanStep(i + 1);
    }

    try {
      // 1. Scan and read the QR code on the sheet
      const qrPayload = await readQRCodeFromImage(file);
      if (!qrPayload || !qrPayload.examId) {
        throw new Error("Code QR L'Match introuvable. Veuillez cadrer correctement le haut de la feuille avec une bonne luminosité.");
      }

      if (qrPayload.massarCode || qrPayload.studentName) {
        let foundName = qrPayload.studentName || '';
        let foundClassName = '';
        const massar = qrPayload.massarCode || '';
        
        if (massar) {
          try {
            const classes = await getAllClasses();
            for (const cls of classes) {
              const st = (cls.students || []).find(s => 
                (s.massarCode && s.massarCode.toUpperCase() === massar.toUpperCase()) || 
                (s.id && s.id.toUpperCase() === massar.toUpperCase())
              );
              if (st) {
                foundName = st.name;
                foundClassName = cls.name;
                break;
              }
            }

            if (!foundName) {
              const users = await getAllUsers();
              const u = (users || []).find(usr => 
                (usr.massarCode && usr.massarCode.toUpperCase() === massar.toUpperCase()) ||
                (usr.cne && usr.cne.toUpperCase() === massar.toUpperCase()) ||
                (usr.id && usr.id.toUpperCase() === massar.toUpperCase())
              );
              if (u && u.name) {
                foundName = u.name;
              }
            }
          } catch (e) {
            console.error('Error resolving student name:', e);
          }
        }

        setScannedStudent({
          massarCode: massar,
          name: foundName || '',
          className: foundClassName
        });
      } else {
        setScannedStudent(null);
      }

      // 2. Lookup exam metadata (supports starts-with for 8-char prefixes)
      const found = exams.find(e => 
        qrPayload.examId.length === 8 
          ? e.id.toLowerCase().startsWith(qrPayload.examId.toLowerCase()) 
          : e.id === qrPayload.examId
      );
      if (!found) {
        throw new Error(`Examen introuvable dans la bibliothèque (ID : ${qrPayload.examId.slice(0, 8)})`);
      }

      // Load questions dynamically if they are not preloaded
      const loadedQuestions = await loadExamQuestions(found.id);
      const updatedExam = { ...found, questions: loadedQuestions };
      setActiveExam(updatedExam);

      // 3. Scan the grid bubbles dynamically
      const results = await scanAnswerSheet(file, loadedQuestions?.length || 0);
      setScanned(results);
      setPhase('verify');
    } catch (e) {
      setScanError(e.message);
      setPhase('upload');
    }
  }, [exams, loadExamQuestions]);

  const handleDrop = (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  };

  const handleVerifyChange = (idx, newAnswer) => {
    setScanned(prev => prev.map((r, i) => i === idx ? { ...r, answer: newAnswer } : r));
  };

  const handleConfirmVerify = () => {
    if (!activeExam) return;
    let pts = 0, neg = 0;
    const rows = questions.map((q, idx) => {
      const sc = scanned[idx];
      const correct = q.correct_answer || q.answer;
      const detected = sc?.answer;
      let result;
      if (detected === null) {
        result = 'empty'; pts += rules.empty;
      } else if (detected === correct) {
        result = 'correct'; pts += rules.correct;
      } else {
        result = 'wrong'; neg += Math.abs(rules.wrong); pts += rules.wrong;
      }
      return { q: idx + 1, question: q.question, detected, correct, result, topic: q.topic || 'Général', coords: sc?.coords };
    });
    
    setCorrected(rows);
    const maxPossible = Q * rules.correct;
    const pct = maxPossible > 0 ? Math.max(0, Math.round((pts / maxPossible) * 100)) : 0;
    setScore({ pts, neg, max: Q, pct });
    setResultsTab('list');

    // Push to Spaced Repetition (SRS)
    rows.forEach((row, idx) => {
      const id = questions[idx]?.id || idx;
      updateCardProgress(id, row.result === 'correct' ? 4 : 0);
    });

    // Save OMR exam results to student's mock history
    let correctCount = 0;
    let wrongCount = 0;
    let emptyCount = 0;
    rows.forEach(row => {
      if (row.result === 'correct') correctCount++;
      else if (row.result === 'wrong') wrongCount++;
      else emptyCount++;
    });

    saveMockExamResult({
      examId: activeExam.id,
      examName: activeExam.name,
      school: activeExam.school,
      score: pts,
      maxScore: Q,
      correctCount,
      wrongCount,
      emptyCount,
      pct,
      mode: 'omr'
    });

    // Auto-record grade to class if scannedStudent was identified via QR
    if (scannedStudent && scannedStudent.massarCode) {
      (async () => {
        try {
          const targetMassar = scannedStudent.massarCode.toUpperCase();
          const allClasses = await getAllClasses();
          let targetClass = null;

          for (const cls of allClasses) {
            const hasStudent = (cls.students || []).some(s => 
              (s.massarCode && s.massarCode.toUpperCase() === targetMassar) || 
              (s.id && s.id.toUpperCase() === targetMassar)
            ) || (cls.grades && (cls.grades[targetMassar] !== undefined || cls.grades[scannedStudent.massarCode] !== undefined))
              || (cls.competitionGrades && (cls.competitionGrades[targetMassar] !== undefined || cls.competitionGrades[scannedStudent.massarCode] !== undefined));

            if (hasStudent) {
              targetClass = cls;
              break;
            }
          }

          // Fallback to first class if no specific student match found in arrays
          if (!targetClass && allClasses.length > 0) {
            targetClass = allClasses[0];
          }

          if (targetClass) {
            await recordStudentExamGrade(targetClass.id, scannedStudent.massarCode, activeExam.name, pts, Q);
            setAssignedClassName(targetClass.name);
          }
        } catch (err) {
          console.error('Grade auto-assignment error:', err);
        }
      })();
    }

    setPhase('results');

    if (autoScanNext) {
      setTimeout(() => {
        setPhase('upload');
        setImagePreview(url => { if (url) URL.revokeObjectURL(url); return null; });
        setScanned([]); setCorrected([]); setScore(null); setScanStep(0); setScanError(null); setResultsTab('list');
        setScannedStudent(null); setAssignedClassName(null);
        setScanMethod(localStorage.getItem('scanner_direct_capture_enabled') !== 'false' ? 'camera' : 'file');
      }, 1500);
    }
  };

  const reset = () => {
    setPhase('upload'); setActiveExam(null); setImagePreview(url => { if (url) URL.revokeObjectURL(url); return null; }); setScanned([]);
    setCorrected([]); setScore(null); setScanStep(0); setScanError(null); setResultsTab('list');
    setScannedStudent(null); setAssignedClassName(null);
    setScanMethod(localStorage.getItem('scanner_direct_capture_enabled') !== 'false' ? 'camera' : 'file');
  };

  const ambiguousCount = scanned.filter(r => r.confidence < 0.3).length;
  const wrongCount     = corrected.filter(r => r.result === 'wrong').length;
  const correctCount   = corrected.filter(r => r.result === 'correct').length;

  const phaseLabel = { upload:'Uploader', scanning:'Analyse…', verify:'Vérification', results:'Résultats' };

  const currentStepIndex = ['upload', 'scanning', 'verify', 'results'].indexOf(phase);

  return (
    <div className="animate-fade-in" style={{ padding: isMobile ? '0.5rem 0 5rem 0' : '0.5rem 0 3rem 0', width: '100%', overflowX: 'hidden' }}>
      {/* Page Title & Phase Indicators */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.75rem' : '1.25rem', marginBottom: isMobile ? '1.25rem' : '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: isMobile ? '0.15rem' : '0.4rem' }}>
              <div style={{ 
                width: isMobile ? 34 : 42, 
                height: isMobile ? 34 : 42, 
                borderRadius: isMobile ? '10px' : '12px', 
                background: 'linear-gradient(135deg, var(--violet), var(--emerald))', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                flexShrink: 0,
                boxShadow: '0 4px 14px var(--violet-glow)'
              }}>
                <Camera size={isMobile ? 16 : 20} color="#fff" />
              </div>
              <h1 style={{ fontSize: isMobile ? '1.35rem' : '1.6rem', fontWeight: 900, letterSpacing: '-0.03em', margin: 0, color: 'var(--text-main)' }}>
                Scanner Intelligent
              </h1>
            </div>
            {(!isMobile || phase === 'upload') && (
              <p style={{ color: 'var(--text-muted)', fontSize: isMobile ? '0.8rem' : '0.88rem', margin: 0, lineHeight: 1.5 }}>
                Prenez en photo votre feuille de réponses L'Match. L'IA s'occupe du reste.
              </p>
            )}
          </div>
        </div>
        
        {/* Phase indicators */}
        {isMobile ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            background: 'rgba(255, 255, 255, 0.02)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--border)',
            padding: '0.75rem 1rem',
            borderRadius: '1.25rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--violet), var(--emerald))',
                color: '#fff',
                fontSize: '0.85rem',
                fontWeight: 800,
                boxShadow: '0 4px 10px var(--violet-glow)'
              }}>
                {currentStepIndex + 1}
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Étape {currentStepIndex + 1} sur 4
                </span>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 800 }}>
                  {phaseLabel[phase]}
                </span>
              </div>
            </div>
            
            {/* Mini progress bar on the right */}
            <div style={{ width: '80px', height: '6px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '3px', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div style={{
                width: `${((currentStepIndex + 1) / 4) * 100}%`,
                height: '100%',
                background: 'linear-gradient(90deg, var(--violet), var(--emerald))',
                borderRadius: '3px',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>
        ) : (
          <div className="stepper-container" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            width: '100%', 
            background: 'rgba(255, 255, 255, 0.02)', 
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--border)', 
            padding: '0.75rem 1.25rem', 
            borderRadius: '1.25rem',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {['upload', 'scanning', 'verify', 'results'].map((p, i) => {
              const isActive = phase === p;
              const isCompleted = ['upload', 'scanning', 'verify', 'results'].indexOf(phase) > i;
              return (
                <div key={p} className="step-item" style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  flex: i === 3 ? 'none' : 1,
                  position: 'relative'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    width: 24, 
                    height: 24, 
                    borderRadius: '50%', 
                    background: isActive ? 'var(--violet)' : isCompleted ? 'var(--emerald)' : 'rgba(255,255,255,0.05)',
                    border: `1.5px solid ${isActive ? 'var(--violet)' : isCompleted ? 'var(--emerald)' : 'var(--border)'}`,
                    color: isActive || isCompleted ? '#fff' : 'var(--text-muted)',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    boxShadow: isActive ? '0 0 10px var(--violet-glow)' : 'none',
                    transition: 'all 0.3s ease'
                  }}>
                    {isCompleted ? <Check size={12} strokeWidth={3} /> : i + 1}
                  </div>
                  <span className={`step-label ${isActive ? 'active' : ''}`} style={{ 
                    fontSize: '0.8rem', 
                    fontWeight: isActive ? 800 : 600, 
                    color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.3s ease'
                  }}>
                    {phaseLabel[p]}
                  </span>
                  
                  {i < 3 && (
                    <div className="step-line" style={{ 
                      flex: 1, 
                      height: 2, 
                      background: isCompleted ? 'var(--emerald)' : 'var(--border)', 
                      marginLeft: '0.75rem', 
                      marginRight: '0.75rem',
                      minWidth: 16
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem', width: '100%' }}>
        <div className="glass-panel" style={{ padding: isMobile ? '1rem' : '1.5rem', borderRadius: '1.5rem', border: '1px solid var(--border)', width: '100%', boxSizing: 'border-box' }}>
          
          {/* ── UPLOAD PHASE ── */}
          {phase === 'upload' && (
            <div style={{ maxWidth: 640, margin: '0 auto' }}>
              {hasReachedLimit ? (
                <div style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
                  <div style={{ 
                    width: 72, 
                    height: 72, 
                    borderRadius: '50%', 
                    background: 'var(--violet-soft)', 
                    color: 'var(--violet)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    margin: '0 auto 1.75rem', 
                    boxShadow: '0 8px 32px var(--violet-glow)',
                    border: '1.5px solid rgba(113, 109, 242, 0.2)'
                  }}>
                    <Zap size={32} fill="currentColor" />
                  </div>
                  <h3 style={{ fontWeight: 900, fontSize: '1.35rem', letterSpacing: '-0.02em', marginBottom: '0.75rem', color: 'var(--text-main)' }}>
                    Limite de scans gratuite atteinte
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.6, maxWidth: '440px', margin: '0 auto 2.5rem' }}>
                    Vous avez utilisé vos 3 scans gratuits OMR. Abonnez-vous pour profiter d'analyses de copies et de rapports d'erreurs illimités.
                  </p>
                  <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column', width: '100%', maxWidth: '300px', margin: '0 auto' }}>
                    <button onClick={() => navigate('/subscription')} className="btn" style={{ background: 'var(--btn-primary-bg)', boxShadow: 'var(--btn-primary-shadow)' }}>
                      ✦ Passer à l'offre Premium
                    </button>
                    <button onClick={() => navigate('/dashboard')} className="btn-outline">
                      Retour au Dashboard
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {scanError && (
                    <div style={{ 
                      padding: '1rem 1.25rem', 
                      background: 'var(--danger-soft)', 
                      border: '1px solid rgba(239, 68, 68, 0.2)', 
                      borderRadius: '1rem', 
                      marginBottom: '1.5rem', 
                      color: 'var(--danger)', 
                      fontSize: '0.88rem', 
                      fontWeight: 600, 
                      display: 'flex', 
                      gap: '0.75rem', 
                      alignItems: 'flex-start' 
                    }}>
                      <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start' }}>
                        <span style={{ fontWeight: 700 }}>Erreur d'analyse</span>
                        <span style={{ color: 'var(--text-main)', opacity: 0.95, fontWeight: 500 }}>{scanError}</span>
                        {scanError.includes("Premium") && (
                          <button 
                            onClick={() => navigate('/subscription')} 
                            style={{ background: 'none', border: 'none', color: 'var(--violet)', padding: 0, fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', textAlign: 'left', textDecoration: 'underline', marginTop: '0.2rem' }}
                          >
                            Voir les formules d'abonnement formule Premium
                          </button>
                        )}
                      </div>
                    </div>
                  )}
              
                  {/* Premium Segmented Controller */}
                  {isDirectCaptureEnabled && (
                    <>
                      <div style={{ 
                        display: 'flex', 
                        background: 'rgba(255, 255, 255, 0.02)', 
                        border: '1px solid var(--border)', 
                        padding: '0.3rem', 
                        borderRadius: '1.25rem', 
                        width: '100%',
                        marginBottom: '1.75rem'
                      }}>
                        <button 
                          onClick={() => setScanMethod('camera')}
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            padding: '0.75rem 1rem',
                            borderRadius: '1rem',
                            border: 'none',
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            fontFamily: 'inherit',
                            cursor: 'pointer',
                            transition: 'all 0.25s',
                            background: scanMethod === 'camera' ? 'var(--violet)' : 'transparent',
                            color: scanMethod === 'camera' ? '#fff' : 'var(--text-muted)',
                            boxShadow: scanMethod === 'camera' ? '0 4px 16px var(--violet-glow)' : 'none'
                          }}
                        >
                          <Camera size={16} />
                          Utiliser la caméra
                        </button>
                        <button 
                          onClick={() => setScanMethod('file')}
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            padding: '0.75rem 1rem',
                            borderRadius: '1rem',
                            border: 'none',
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            fontFamily: 'inherit',
                            cursor: 'pointer',
                            transition: 'all 0.25s',
                            background: scanMethod === 'file' ? 'var(--violet)' : 'transparent',
                            color: scanMethod === 'file' ? '#fff' : 'var(--text-muted)',
                            boxShadow: scanMethod === 'file' ? '0 4px 16px var(--violet-glow)' : 'none'
                          }}
                        >
                          <Upload size={16} />
                          Importer un fichier
                        </button>
                      </div>

                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        padding: '0.65rem 1rem',
                        borderRadius: '1rem',
                        border: autoScanNext ? '1.5px solid var(--emerald)' : '1px solid var(--border)',
                        background: autoScanNext ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                        color: autoScanNext ? 'var(--emerald)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        fontWeight: 800,
                        fontSize: '0.82rem',
                        marginTop: '0.75rem',
                        marginBottom: '1rem',
                        transition: 'all 0.2s ease'
                      }}>
                        <input 
                          type="checkbox" 
                          checked={autoScanNext} 
                          onChange={(e) => setAutoScanNext(e.target.checked)} 
                          style={{ cursor: 'pointer', accentColor: 'var(--emerald)', width: 16, height: 16 }} 
                        />
                        <span>⚡ Mode Continu Auto-Next (Correction enchaînée de la classe)</span>
                      </label>
                    </>
                  )}

                  {scanMethod === 'camera' ? (
                    <SmartCameraScanner
                      onCapture={handleFile}
                      onCancel={() => setScanMethod('file')}
                      activeExam={activeExam}
                    />
                  ) : (
                    <div
                      onDrop={handleDrop} onDragOver={e => e.preventDefault()}
                      onClick={() => fileRef.current?.click()}
                      style={{ 
                        border: '2px dashed var(--border)', 
                        borderRadius: '1.5rem', 
                        padding: '3.5rem 1.5rem', 
                        textAlign: 'center', 
                        cursor: 'pointer', 
                        transition: 'all 0.25s', 
                        background: 'rgba(255, 255, 255, 0.01)',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                      onMouseEnter={e => { 
                        e.currentTarget.style.borderColor = 'var(--violet)'; 
                        e.currentTarget.style.background = 'var(--violet-soft)'; 
                      }}
                      onMouseLeave={e => { 
                        e.currentTarget.style.borderColor = 'var(--border)';  
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.01)'; 
                      }}
                    >
                      <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e => handleFile(e.target.files[0])} />
                      <div style={{ 
                        width: 60, 
                        height: 60, 
                        borderRadius: '50%', 
                        background: 'var(--violet-soft)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        margin: '0 auto 1.25rem',
                        border: '1.5px solid rgba(113, 109, 242, 0.15)'
                      }}>
                        <Upload size={24} color="var(--violet)" />
                      </div>
                      <h3 style={{ fontWeight: 800, marginBottom: '0.35rem', fontSize: '1.1rem', color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
                        Sélectionner une photo
                      </h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.6, maxWidth: 380, margin: '0 auto' }}>
                        Faites glisser votre feuille de réponses ici ou cliquez pour parcourir vos dossiers.<br/>
                        <span style={{ color: 'var(--violet)', fontWeight: 700, fontSize: '0.78rem', marginTop: '0.5rem', display: 'inline-block' }}>
                          ⚡ Identification automatique par QR Code
                        </span>
                      </p>
                    </div>
                  )}

                  {/* Pro Tips */}
                  <div style={{ marginTop: '2.5rem' }}>
                    <h4 style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                      💡 Conseils pour un scan parfait :
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                      {[
                        ['💡','Éclairage homogène','Évitez les ombres portées et les reflets directs sur la feuille.'],
                        ['📐','Cadrage parallèle','Tenez votre caméra bien parallèle et au-dessus de la feuille.'],
                        ['🖊️','Remplissage complet','Remplissez entièrement les cercles de réponses au stylo noir ou bleu.'],
                        ['📷','Repères visibles','Les 4 repères carrés aux coins de la feuille doivent être parfaitement visibles.'],
                      ].map(([ic,t,d]) => (
                        <div key={t} style={{ display: 'flex', gap: '0.85rem', padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.015)', borderRadius: '1rem', border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: '1.25rem', flexShrink: 0, marginTop: '0.1rem' }}>{ic}</span>
                          <div>
                            <p style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.15rem', color: 'var(--text-main)' }}>{t}</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.45, margin: 0 }}>{d}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── SCANNING PHASE ── */}
          {phase === 'scanning' && (
            <div style={{ textAlign: 'center', padding: '2.5rem 0', maxWidth: 440, margin: '0 auto' }}>
              {imagePreview && (
                <div style={{ position: 'relative', display: 'inline-block', marginBottom: '2rem', borderRadius: '1.5rem', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
                  <img src={imagePreview} alt="scan" style={{ maxHeight: 250, maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
                  {/* Glowing futuristic scanning beam */}
                  <div style={{
                    position: 'absolute', left: 0, right: 0, height: '3px',
                    background: 'linear-gradient(90deg, transparent, var(--violet), transparent)',
                    boxShadow: '0 0 16px var(--violet)',
                    animation: 'scanBeam 1.8s ease-in-out infinite'
                  }} />
                </div>
              )}
              
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', position: 'relative', width: 80, height: 80, marginBottom: '1.5rem' }}>
                <svg viewBox="0 0 72 72" style={{ position: 'absolute', inset: 0, animation: 'spin 1.2s linear infinite' }}>
                  <circle cx="36" cy="36" r="30" fill="none" stroke="var(--violet)" strokeWidth="3.5" strokeDasharray="60 100" strokeLinecap="round"/>
                </svg>
                <BrainCircuit size={32} color="var(--violet)" />
              </div>
              <h3 style={{ fontWeight: 900, fontSize: '1.3rem', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>Analyse OMR intelligente…</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '2.25rem', lineHeight: 1.5 }}>L'IA calibre la feuille et extrait les réponses détectées.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {[
                  'Traitement numérique & contraste',
                  "Lecture du QR Code & identification QCM",
                  'Extraction des réponses cochées',
                ].map((step, i) => (
                  <div key={step} style={{
                    display: 'flex', alignItems: 'center', gap: '0.85rem',
                    padding: '0.75rem 1.1rem', borderRadius: '1rem',
                    background: scanStep > i ? 'var(--emerald-soft)' : 'rgba(255, 255, 255, 0.01)',
                    border: `1px solid ${scanStep > i ? 'rgba(16, 185, 129, 0.2)' : 'var(--border)'}`,
                    transition: 'all 0.3s ease',
                  }}>
                    {scanStep > i
                      ? <CheckCircle2 size={16} color="var(--emerald)" style={{ flexShrink: 0 }} />
                      : <Loader2 size={16} color="var(--violet)" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />}
                    <span style={{ fontSize: '0.85rem', color: scanStep > i ? 'var(--emerald)' : 'var(--text-muted)', fontWeight: scanStep > i ? 700 : 500 }}>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── VERIFY PHASE ── */}
          {phase === 'verify' && activeExam && (
            <div style={{ maxWidth: 760, margin: '0 auto' }}>
              <div style={{ 
                padding: '1.25rem 1.5rem', 
                borderRadius: '1.25rem', 
                marginBottom: '1.75rem', 
                display: 'flex', 
                gap: '1rem', 
                alignItems: 'flex-start',
                background: ambiguousCount > 0 ? 'var(--warning-soft)' : 'var(--emerald-soft)',
                border: `1px solid ${ambiguousCount > 0 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)'}` 
              }}>
                {ambiguousCount > 0
                  ? <AlertCircle size={22} color="var(--warning)" style={{ flexShrink: 0, marginTop: 2 }} />
                  : <CheckCircle2 size={22} color="var(--emerald)" style={{ flexShrink: 0, marginTop: 2 }} />}
                <div>
                  <h4 style={{ fontWeight: 900, fontSize: '1rem', margin: 0, letterSpacing: '-0.01em' }}>
                    {ambiguousCount > 0
                      ? `${ambiguousCount} réponse${ambiguousCount>1?'s':''} à vérifier`
                      : `Analyse complétée avec succès !`}
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.35rem', lineHeight: 1.5, margin: 0 }}>
                    {ambiguousCount > 0
                      ? 'L\'IA a détecté des signaux plus faibles sur les lignes orange. Cliquez sur la lettre correcte pour corriger avant validation.'
                      : `Toutes les ${Q} questions ont été identifiées avec une très haute confiance. Cliquez sur "Confirmer" pour voir vos notes.`}
                  </p>
                </div>
              </div>

              {/* Exam banner */}
              <div className="exam-banner">
                <div className="exam-banner-left">
                  <span style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--violet)', letterSpacing: '0.12em' }}>Examen Identifié</span>
                  <h3 style={{ fontWeight: 900, fontSize: '1.25rem', margin: '4px 0 0 0', letterSpacing: '-0.02em', color: 'var(--text-main)' }}>{activeExam.name}</h3>
                  <p style={{ color:'var(--text-muted)', fontSize: '0.82rem', margin: '4px 0 0 0', fontWeight: 500 }}>{activeExam.school} · {activeExam.year}</p>
                </div>
                <div className="exam-banner-right">
                  <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-main)' }}>{Q}</span>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0, fontWeight: 500 }}>Questions lues</p>
                </div>
              </div>

              {/* Student identification banner during verification */}
              {scannedStudent && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.12), rgba(16, 185, 129, 0.12))',
                  border: '1px solid rgba(124, 58, 237, 0.3)',
                  borderRadius: '1.25rem',
                  padding: '1.1rem 1.5rem',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  boxShadow: '0 8px 24px rgba(124, 58, 237, 0.08)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
                    <div style={{
                      width: 46, height: 46, borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--violet), var(--emerald))',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 900, fontSize: '1.25rem', boxShadow: '0 4px 12px var(--violet-glow)'
                    }}>
                      {(scannedStudent.name || 'E')[0]}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--violet)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Élève Identifié par QR Code (Attribution Automatique)
                      </div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        {(scannedStudent.name && !scannedStudent.name.startsWith('Élève (')) ? scannedStudent.name : 'Élève'} {scannedStudent.massarCode ? `(${scannedStudent.massarCode})` : ''}
                      </div>
                      {scannedStudent.className && (
                        <div style={{ fontSize: '0.82rem', color: 'var(--emerald)', fontWeight: 700, marginTop: '0.15rem' }}>
                          Classe : <strong>{scannedStudent.className}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                  <span style={{
                    padding: '0.45rem 0.95rem', borderRadius: '20px',
                    background: 'rgba(16, 185, 129, 0.15)', color: 'var(--emerald)',
                    fontWeight: 800, fontSize: '0.85rem', border: '1px solid rgba(16, 185, 129, 0.3)',
                    display: 'flex', alignItems: 'center', gap: '0.4rem'
                  }}>
                    <CheckCircle2 size={15} /> Élève Confirmé
                  </span>
                </div>
              )}

              <VerifyGrid scanned={scanned} questions={questions} onChange={handleVerifyChange} isMobile={isMobile} />

              <div className="actions-row" style={{
                display: 'flex',
                gap: '0.75rem',
                marginTop: '1.5rem',
                justifyContent: isMobile ? 'stretch' : 'flex-end',
                width: '100%'
              }}>
                <button className="btn-outline" onClick={reset} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '0.875rem', flex: isMobile ? 1 : 'none' }}>
                  <RotateCcw size={15} /> Rescanner
                </button>
                <button className="btn" onClick={handleConfirmVerify} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 2rem', borderRadius: '0.875rem', background: 'var(--emerald)', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.2)', flex: isMobile ? 2 : 'none' }}>
                  <Check size={16} strokeWidth={2.5} /> {isMobile ? 'Valider' : 'Confirmer & Calculer la note'}
                </button>
              </div>
            </div>
          )}

          {/* ── RESULTS PHASE ── */}
          {phase === 'results' && score && activeExam && (
            <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              
              {/* Student identification banner */}
              {scannedStudent && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.12), rgba(16, 185, 129, 0.12))',
                  border: '1px solid rgba(124, 58, 237, 0.3)',
                  borderRadius: '1.25rem',
                  padding: '1.1rem 1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  boxShadow: '0 8px 24px rgba(124, 58, 237, 0.08)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--violet), var(--emerald))',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 900, fontSize: '1.2rem', boxShadow: '0 4px 12px var(--violet-glow)'
                    }}>
                      {(scannedStudent.name || 'E')[0]}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--violet)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Élève identifié automatiquement par QR Code
                      </div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        {(scannedStudent.name && !scannedStudent.name.startsWith('Élève (')) ? scannedStudent.name : 'Élève'} {scannedStudent.massarCode ? `(${scannedStudent.massarCode})` : ''}
                      </div>
                      {assignedClassName && (
                        <div style={{ fontSize: '0.82rem', color: 'var(--emerald)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem' }}>
                          <CheckCircle2 size={14} /> Note attribuée et enregistrée automatiquement dans le carnet de classe : <strong>{assignedClassName}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                  <span style={{
                    padding: '0.4rem 0.85rem', borderRadius: '20px',
                    background: 'rgba(16, 185, 129, 0.15)', color: 'var(--emerald)',
                    fontWeight: 800, fontSize: '0.82rem', border: '1px solid rgba(16, 185, 129, 0.3)'
                  }}>
                    Attribution Automatique ✓
                  </span>
                </div>
              )}

              {/* Bento Grid Scorecard */}
              <div className="scorecard-bento-grid">
                
                {/* Main Bento Cell: Score Circle Gauge */}
                <div className="bento-score-main" style={{
                  background: isDark 
                    ? 'radial-gradient(circle at top right, rgba(113, 109, 242, 0.1), rgba(24, 24, 27, 0.7))'
                    : 'radial-gradient(circle at top right, rgba(113, 109, 242, 0.04), #ffffff)',
                  border: '1px solid var(--border)',
                  borderRadius: '2rem',
                  padding: '2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-card)',
                  textAlign: 'center'
                }}>
                  {/* Glowing aura */}
                  <div style={{
                    position: 'absolute',
                    top: '-20%',
                    right: '-20%',
                    width: '180px',
                    height: '180px',
                    background: score.pct >= 70 ? 'var(--emerald-soft)' : score.pct >= 50 ? 'var(--warning-soft)' : 'var(--danger-soft)',
                    filter: 'blur(50px)',
                    borderRadius: '50%',
                    pointerEvents: 'none'
                  }} />

                  <p style={{ 
                    color: 'var(--text-muted)', 
                    fontSize: '0.75rem', 
                    fontWeight: 800, 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.15em', 
                    marginBottom: '1rem',
                    position: 'relative',
                    zIndex: 2
                  }}>
                    Note obtenue
                  </p>

                  {/* Circular Gauge */}
                  <div style={{ position: 'relative', width: 140, height: 140, display: 'flex', alignItems: 'center', justifycontent: 'center', marginBottom: '1.25rem', zIndex: 2 }}>
                    <svg width="140" height="140" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                      {/* Background circle */}
                      <circle 
                        cx="50" 
                        cy="50" 
                        r="42" 
                        fill="none" 
                        stroke={isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'} 
                        strokeWidth="7" 
                      />
                      {/* Progress circle */}
                      <circle 
                        cx="50" 
                        cy="50" 
                        r="42" 
                        fill="none" 
                        stroke={score.pct >= 70 ? 'var(--emerald)' : score.pct >= 50 ? 'var(--warning)' : 'var(--danger)'} 
                        strokeWidth="8" 
                        strokeDasharray="263.89" 
                        strokeDashoffset={263.89 - (263.89 * Math.max(0, Math.min(100, score.pct))) / 100} 
                        strokeLinecap="round" 
                        style={{ 
                          transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
                          filter: `drop-shadow(0 0 8px ${score.pct >= 70 ? 'rgba(16,185,129,0.3)' : score.pct >= 50 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'})`
                        }}
                      />
                    </svg>
                    
                    {/* Score value in the center */}
                    <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ 
                        fontSize: '2rem', 
                        fontWeight: 900, 
                        color: score.pct >= 70 ? 'var(--emerald)' : score.pct >= 50 ? 'var(--warning)' : 'var(--danger)',
                        lineHeight: 1
                      }}>
                        {((score.pts / Q) * 20).toFixed(2)}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', fontWeight: 600, marginTop: '2px' }}>
                        sur 20
                      </span>
                    </div>
                  </div>

                  {/* Score details */}
                  <div style={{ zIndex: 2 }}>
                    <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: 800, margin: 0 }}>
                      Score : {score.pts.toFixed(2)} / {Q} pts
                    </p>
                    <p style={{ color: 'var(--text-subtle)', fontSize: '0.78rem', marginTop: '0.25rem', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                      <span>Pénalités : -{score.neg.toFixed(2)} pts</span>
                      <span style={{ opacity: 0.3 }}>•</span>
                      <span>Faux : {wrongCount}</span>
                    </p>
                  </div>
                </div>

                {/* Sub-grid of stats bento cells */}
                <div className="bento-stats-subgrid">
                  
                  {/* Correct Answers Card */}
                  <div className="bento-card-stat" style={{
                    background: isDark ? 'rgba(16, 185, 129, 0.04)' : 'rgba(16, 185, 129, 0.02)',
                    border: '1px solid rgba(16, 185, 129, 0.12)',
                    borderRadius: '1.5rem',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: 'var(--shadow-card)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--emerald)', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Correctes</span>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={14} strokeWidth={3} />
                      </div>
                    </div>
                    <div style={{ marginTop: '1rem' }}>
                      <h3 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--emerald)', margin: 0 }}>{correctCount}</h3>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', margin: '0.15rem 0 0 0', fontWeight: 500 }}>
                        {((correctCount / Q) * 100).toFixed(0)}% des questions lues
                      </p>
                    </div>
                  </div>

                  {/* Wrong Answers Card */}
                  <div className="bento-card-stat" style={{
                    background: isDark ? 'rgba(239, 68, 68, 0.04)' : 'rgba(239, 68, 68, 0.02)',
                    border: '1px solid rgba(239, 68, 68, 0.12)',
                    borderRadius: '1.5rem',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: 'var(--shadow-card)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--danger)', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fausses</span>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <XCircle size={14} />
                      </div>
                    </div>
                    <div style={{ marginTop: '1rem' }}>
                      <h3 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--danger)', margin: 0 }}>{wrongCount}</h3>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', margin: '0.15rem 0 0 0', fontWeight: 500 }}>
                        {((wrongCount / Q) * 100).toFixed(0)}% des questions lues
                      </p>
                    </div>
                  </div>

                  {/* Empty Answers Card */}
                  <div className="bento-card-stat" style={{
                    background: 'rgba(255, 255, 255, 0.015)',
                    border: '1px solid var(--border)',
                    borderRadius: '1.5rem',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: 'var(--shadow-card)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vides</span>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <AlertCircle size={14} />
                      </div>
                    </div>
                    <div style={{ marginTop: '1rem' }}>
                      <h3 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-main)', margin: 0 }}>{Q - correctCount - wrongCount}</h3>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', margin: '0.15rem 0 0 0', fontWeight: 500 }}>
                        Sans pénalité appliquée
                      </p>
                    </div>
                  </div>

                  {/* Rules / Scale Card */}
                  <div className="bento-card-stat" style={{
                    background: 'rgba(255, 255, 255, 0.015)',
                    border: '1px solid var(--border)',
                    borderRadius: '1.5rem',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: 'var(--shadow-card)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Barème</span>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <TrendingUp size={14} />
                      </div>
                    </div>
                    <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Correcte :</span>
                        <span style={{ color: 'var(--emerald)' }}>+{rules.correct} pt</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Fausse :</span>
                        <span style={{ color: 'var(--danger)' }}>{rules.wrong} pt</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Vide :</span>
                        <span>{rules.empty === 0 ? '0' : rules.empty} pt</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* SRS Reminder Card */}
              {wrongCount > 0 && (
                <div className="srs-reminder-card-futuristic" style={{
                  padding: '1.5rem',
                  background: isDark
                    ? 'linear-gradient(135deg, rgba(113, 109, 242, 0.15) 0%, rgba(24, 24, 27, 0.8) 100%)'
                    : 'linear-gradient(135deg, rgba(113, 109, 242, 0.06) 0%, #ffffff 100%)',
                  border: '1px solid rgba(113, 109, 242, 0.25)',
                  borderRadius: '2rem',
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  justifyContent: 'space-between',
                  alignItems: isMobile ? 'stretch' : 'center',
                  gap: '1.25rem',
                  boxShadow: 'var(--shadow-card)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {/* Subtle blur background icon decoration */}
                  <div style={{
                    position: 'absolute',
                    right: '-5%',
                    bottom: '-15%',
                    opacity: 0.06,
                    color: 'var(--violet)',
                    pointerEvents: 'none'
                  }}>
                    <BrainCircuit size={120} />
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ 
                      width: 48, 
                      height: 48, 
                      borderRadius: '1rem', 
                      background: 'var(--violet-soft)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      flexShrink: 0,
                      boxShadow: '0 4px 12px rgba(113, 109, 242, 0.15)'
                    }}>
                      <BrainCircuit size={22} color="var(--violet)" />
                    </div>
                    <div>
                      <h4 style={{ fontWeight: 800, fontSize: '0.98rem', margin: 0, color: 'var(--text-main)' }}>Planification SRS Activée</h4>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.35rem 0 0 0', lineHeight: 1.5 }}>
                        Les <strong>{wrongCount} questions incorrectes</strong> ont été injectées dans votre cycle d'apprentissage personnalisé pour révision.
                      </p>
                    </div>
                  </div>
                  <button 
                    className="btn" 
                    onClick={() => navigate(`/study?exam=${activeExam.id}`)} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      gap: '0.5rem', 
                      fontSize: '0.85rem', 
                      fontWeight: 800, 
                      whiteSpace: 'nowrap', 
                      padding: '0.75rem 1.5rem', 
                      borderRadius: '1rem',
                      background: 'var(--violet)',
                      boxShadow: '0 4px 14px var(--violet-glow)'
                    }}
                  >
                    <Zap size={14} /> Lancer la révision
                  </button>
                </div>
              )}

              {/* Tab Selector & Corrections List */}
              <div style={{ 
                background: isDark ? 'rgba(24, 24, 27, 0.4)' : '#ffffff', 
                border: '1px solid var(--border)', 
                borderRadius: '2rem', 
                padding: isMobile ? '1rem' : '1.5rem',
                boxShadow: 'var(--shadow-card)' 
              }}>
                <div className="results-tabs-wrapper" style={{ marginBottom: '1.5rem' }}>
                  <div className="results-tabs-container" style={{ 
                    display: 'flex', 
                    gap: '0.4rem', 
                    background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', 
                    padding: '0.3rem', 
                    borderRadius: '1.25rem',
                    border: '1px solid var(--border)',
                    width: '100%'
                  }}>
                    {[
                      { id: 'list', label: isMobile ? 'Correction' : 'Feuille de Correction', icon: <CheckCircle2 size={15}/> },
                      { id: 'overlay', label: isMobile ? 'Copie AR' : 'Copie Numérisée (AR)', icon: <Camera size={15}/> },
                      { id: 'diagnostic', label: isMobile ? 'Analyse' : 'Analyse Thématique', icon: <TrendingUp size={15}/> }
                    ].map(t => (
                      <button 
                        key={t.id} 
                        onClick={() => setResultsTab(t.id)}
                        className="results-tab-button"
                        style={{ 
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: isMobile ? '0.3rem' : '0.5rem',
                          padding: isMobile ? '0.6rem 0.4rem' : '0.75rem 1rem',
                          borderRadius: '1rem',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 800,
                          fontSize: isMobile ? '0.75rem' : '0.85rem',
                          fontFamily: 'inherit',
                          transition: 'all 0.25s',
                          background: resultsTab === t.id ? 'var(--violet)' : 'transparent',
                          color: resultsTab === t.id ? '#fff' : 'var(--text-muted)',
                          boxShadow: resultsTab === t.id ? '0 4px 12px var(--violet-glow)' : 'none'
                        }}
                      >
                        {t.icon}
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {resultsTab === 'overlay' && (
                  <div style={{ padding: '0.25rem 0' }}>
                    <ARCopyOverlay imagePreview={imagePreview} corrected={corrected} />
                  </div>
                )}

                {resultsTab === 'list' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: 440, overflowY: 'auto', paddingRight: '6px' }}>
                    {corrected.map(row => <ResultRow key={row.q} row={row} />)}
                  </div>
                )}

                {resultsTab === 'diagnostic' && (
                  <div style={{ maxHeight: 440, overflowY: 'auto' }}>
                    <DiagnosticReport corrected={corrected} exam={activeExam} onClose={() => {}} />
                  </div>
                )}
              </div>

              {/* Action Buttons Row */}
              <div className="results-actions-row-modern" style={{
                display: 'flex',
                gap: '0.75rem',
                marginTop: '1.5rem',
                justifyContent: isMobile ? 'stretch' : 'flex-end',
                width: '100%'
              }}>
                <button 
                  className="btn-outline" 
                  onClick={reset} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '0.5rem', 
                    padding: '0.85rem 1.5rem', 
                    borderRadius: '1.1rem', 
                    flex: isMobile ? 1 : 'none', 
                    fontSize: '0.88rem',
                    fontWeight: 700
                  }}
                >
                  <RotateCcw size={16} /> {isMobile ? 'Recommencer' : 'Scanner une autre copie'}
                </button>
                <button 
                  className="btn" 
                  onClick={handlePrintReport} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    gap: '0.5rem', 
                    padding: '0.85rem 2rem', 
                    borderRadius: '1.1rem',
                    fontWeight: 800,
                    flex: isMobile ? 2 : 'none',
                    fontSize: '0.88rem'
                  }}
                >
                  <Printer size={16} /> {isMobile ? 'Rapport PDF' : 'Télécharger le Rapport PDF'}
                </button>
                {!isMobile && (
                  <button 
                    className="btn-outline" 
                    onClick={() => navigate('/dashboard')} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      padding: '0.85rem', 
                      borderRadius: '1.1rem', 
                      width: 46, 
                      height: 46, 
                      flexShrink: 0 
                    }}
                    title="Retour à l'accueil"
                  >
                    <Home size={18} />
                  </button>
                )}
              </div>

            </div>
          )}

        </div>
      </div>
      <style>{`
        @keyframes scanBeam {
          0% { top: 0%; opacity: 0.3; }
          50% { top: 100%; opacity: 1; }
          100% { top: 0%; opacity: 0.3; }
        }

        /* Responsive stepper wizard */
        @media (max-width: 768px) {
          .stepper-container {
            padding: 0.6rem 0.8rem !important;
            border-radius: 1rem !important;
          }
          .step-item {
            gap: 0.25rem !important;
          }
          .step-label {
            display: none;
          }
          .step-label.active {
            display: inline;
            font-size: 0.75rem !important;
          }
          .step-line {
            margin-left: 0.4rem !important;
            margin-right: 0.4rem !important;
            min-width: 8px !important;
          }
        }

        /* Responsive Scorecard Header (legacy class cleanups) */
        .scorecard-header {
          display: none;
        }

        /* 2026 Bento grid layouts */
        .scorecard-bento-grid {
          display: grid;
          grid-template-columns: 1fr 1.25fr;
          gap: 1.5rem;
          width: 100%;
        }
        @media (max-width: 768px) {
          .scorecard-bento-grid {
            grid-template-columns: 1fr;
            gap: 1rem;
          }
        }

        .bento-stats-subgrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          gap: 1rem;
        }
        @media (max-width: 480px) {
          .bento-stats-subgrid {
            grid-template-columns: 1fr;
          }
        }

        .bento-card-stat {
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.25s ease, box-shadow 0.25s ease;
        }
        .bento-card-stat:hover {
          transform: translateY(-2px);
          border-color: rgba(113, 109, 242, 0.2) !important;
          box-shadow: 0 8px 20px rgba(0,0,0,0.03) !important;
        }

        .result-row-card-2026 {
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .result-row-card-2026:hover {
          transform: translateX(3px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.02) !important;
        }

        /* Responsive Exam Banner in Verify */
        .exam-banner {
          background: rgba(255, 255, 255, 0.01); 
          border: 1px solid var(--border); 
          border-radius: 1.25rem; 
          padding: 1.25rem 1.5rem; 
          margin-bottom: 1.75rem; 
          display: flex; 
          justify-content: space-between; 
          align-items: center;
          gap: 1rem;
        }
        .exam-banner-left {
          text-align: left;
        }
        .exam-banner-right {
          text-align: right;
          flex-shrink: 0;
        }
        @media (max-width: 480px) {
          .exam-banner {
            flex-direction: column;
            align-items: flex-start;
            padding: 1rem;
          }
          .exam-banner-right {
            text-align: left;
            margin-top: 0.25rem;
          }
        }

        /* Responsive Action Row Buttons */
        .actions-row {
          display: flex;
          gap: 0.85rem;
          margin-top: 2.5rem;
          justify-content: flex-end;
          flex-wrap: wrap;
        }
        @media (max-width: 600px) {
          .actions-row {
            flex-direction: column;
            align-items: stretch;
            width: 100%;
          }
          .actions-row button {
            width: 100%;
            justify-content: center;
          }
        }

        /* Results Tab responsiveness */
        .results-tabs-wrapper {
          display: flex;
          align-items: center;
        }
        .results-tabs-container {
          display: flex;
          gap: 0.3rem;
          background: rgba(255, 255, 255, 0.02);
          padding: 0.25rem;
          border-radius: 0.875rem;
          border: 1px solid var(--border);
          width: 100%;
        }
        .results-tab-button {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          padding: 0.5rem 1rem;
          border-radius: 0.65rem;
          border: none;
          cursor: pointer;
          font-weight: 700;
          font-size: 0.82rem;
          font-family: inherit;
          transition: all 0.2s;
        }
        @media (max-width: 480px) {
          .results-tab-button {
            padding: 0.5rem 0.5rem;
            font-size: 0.75rem;
          }
        }

        .result-row-details {
          display: flex;
          gap: 0.6rem;
          align-items: center;
          font-size: 0.82rem;
          margin-top: 0.2rem;
          flex-wrap: wrap;
        }
      `}</style>
    </div>
  );
}
