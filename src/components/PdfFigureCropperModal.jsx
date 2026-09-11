// src/components/PdfFigureCropperModal.jsx
// Outil professionnel de rognage de figures géométriques et courbes depuis des PDF

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Crop, ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
  Maximize2, CheckCircle, RefreshCw, Upload, Image as ImageIcon,
  Layers, RotateCcw, Crosshair, Sparkles, Info,
  AlignCenter, AlignLeft, AlignRight
} from 'lucide-react';
import { loadPdfDocument, renderPdfPageToCanvas, cropPdfRegion } from '../utils/pdfFigureExtractor';
import AiFigureEnhancerModal from './AiFigureEnhancerModal';

/* ─── Inline Keyframe Animations ─── */
const STYLE_TAG_ID = 'pdf-cropper-animations';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_TAG_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_TAG_ID;
  style.textContent = `
    @keyframes pdfCropperFadeIn {
      from { opacity: 0; transform: scale(0.97) translateY(8px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes pdfCropperPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.5); }
      50%       { box-shadow: 0 0 0 8px rgba(16,185,129,0); }
    }
    @keyframes pdfCropperSpinner {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    @keyframes pdfCropperSlideIn {
      from { opacity: 0; transform: translateX(10px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes pdfCropperBadgePop {
      0%   { transform: scale(0.7); opacity: 0; }
      70%  { transform: scale(1.1); }
      100% { transform: scale(1);   opacity: 1; }
    }
    .pdf-cropper-spin {
      animation: pdfCropperSpinner 1s linear infinite;
    }
    .pdf-cropper-modal-enter {
      animation: pdfCropperFadeIn 0.28s cubic-bezier(0.34,1.56,0.64,1) forwards;
    }
  `;
  document.head.appendChild(style);
}

/* ─── Step Badge ─── */
function StepBadge({ number, active, done }) {
  const bg = done
    ? 'linear-gradient(135deg,#10b981,#059669)'
    : active
    ? 'linear-gradient(135deg,#6366f1,#8b5cf6)'
    : 'rgba(255,255,255,0.06)';
  const color = done || active ? '#fff' : 'rgba(255,255,255,0.3)';
  return (
    <div style={{
      width: 26, height: 26, borderRadius: '50%',
      background: bg, color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '0.7rem', fontWeight: 800,
      transition: 'all 0.3s ease', flexShrink: 0,
      boxShadow: active ? '0 0 0 3px rgba(99,102,241,0.3)' : 'none'
    }}>
      {done ? <CheckCircle size={13} /> : number}
    </div>
  );
}

/* ─── Toolbar Button ─── */
function ToolbarBtn({ onClick, disabled, title, active, children, danger }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: danger
          ? (hov ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.08)')
          : active
          ? 'rgba(99,102,241,0.22)'
          : hov
          ? 'rgba(255,255,255,0.1)'
          : 'rgba(255,255,255,0.04)',
        border: active
          ? '1px solid rgba(99,102,241,0.5)'
          : '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        padding: '0.35rem 0.55rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: danger ? '#f87171' : active ? '#a5b4fc' : disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.75)',
        display: 'flex', alignItems: 'center', gap: 5,
        fontSize: '0.72rem', fontWeight: 700,
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

/* ─── Info Chip ─── */
function InfoChip({ icon, label, value, accent }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8, padding: '0.4rem 0.65rem',
      display: 'flex', flexDirection: 'column', gap: 1, flex: 1,
    }}>
      <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {icon} {label}
      </span>
      <span style={{ fontSize: '0.78rem', fontWeight: 800, color: accent || 'rgba(255,255,255,0.85)' }}>
        {value}
      </span>
    </div>
  );
}

/* ─── Main Component ─── */
export default function PdfFigureCropperModal({
  isOpen,
  onClose,
  initialPdfDoc = null,
  initialFile = null,
  sections = [],
  targetSectionIdx = 0,
  targetItemIdx = null,
  onCropComplete
}) {
  const [pdfDoc, setPdfDoc] = useState(initialPdfDoc);
  const [totalPages, setTotalPages] = useState(initialPdfDoc?.numPages || 1);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.4);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [selectedSecIdx, setSelectedSecIdx] = useState(targetSectionIdx ?? 0);
  const [selectedItemIdx, setSelectedItemIdx] = useState(targetItemIdx);
  const [figAlt, setFigAlt] = useState('');
  const [figWidth, setFigWidth] = useState(80);
  const [figAlign, setFigAlign] = useState('center');

  const [isSelecting, setIsSelecting] = useState(false);
  const [cropBox, setCropBox] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  const [previewDataUrl, setPreviewDataUrl] = useState(null);
  const [isCroppingAction, setIsCroppingAction] = useState(false);
  const [insertSuccess, setInsertSuccess] = useState(false);
  const [isAiEnhanceOpen, setIsAiEnhanceOpen] = useState(false);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);

  const step = !pdfDoc ? 1 : !cropBox || cropBox.pxW < 10 ? 2 : 3;
  const hasCrop = cropBox && cropBox.pxW > 10 && cropBox.pxH > 10;

  /* ── PDF Loading ── */
  useEffect(() => {
    if (initialPdfDoc) {
      setPdfDoc(initialPdfDoc);
      setTotalPages(initialPdfDoc.numPages);
      setCurrentPage(1);
    } else if (initialFile && (initialFile.type === 'application/pdf' || initialFile.name?.endsWith('.pdf'))) {
      setLoading(true);
      loadPdfDocument(initialFile)
        .then(doc => { setPdfDoc(doc); setTotalPages(doc.numPages); setCurrentPage(1); })
        .catch(err => setErrorMsg('Impossible de lire le fichier PDF : ' + err.message))
        .finally(() => setLoading(false));
    }
  }, [initialPdfDoc, initialFile]);

  useEffect(() => {
    setSelectedSecIdx(targetSectionIdx ?? 0);
    setSelectedItemIdx(targetItemIdx);
    setCropBox(null);
    setPreviewDataUrl(null);
  }, [targetSectionIdx, targetItemIdx, isOpen]);

  /* ── PDF Render ── */
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;
    setLoading(true); setErrorMsg('');
    try {
      await renderPdfPageToCanvas(pdfDoc, currentPage, canvasRef.current, scale);
    } catch (err) {
      setErrorMsg('Erreur lors du rendu : ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [pdfDoc, currentPage, scale]);

  useEffect(() => {
    if (isOpen && pdfDoc) renderPage();
  }, [isOpen, pdfDoc, currentPage, scale, renderPage]);

  /* ── Upload ── */
  const handleUploadNewFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true); setErrorMsg('');
    try {
      const doc = await loadPdfDocument(file);
      setPdfDoc(doc); setTotalPages(doc.numPages); setCurrentPage(1);
      setCropBox(null); setPreviewDataUrl(null);
    } catch (err) {
      setErrorMsg("Impossible d'ouvrir le document : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  /* ── Canvas Pointer Events ── */
  const getCanvasPoint = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    if (clientX === undefined || clientY === undefined) return null;
    return {
      x: Math.max(0, Math.min(rect.width, clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, clientY - rect.top)),
      rw: rect.width, rh: rect.height
    };
  };

  const handlePointerDown = (e) => {
    const pt = getCanvasPoint(e);
    if (!pt) return;
    setIsSelecting(true);
    setDragStart({ x: pt.x, y: pt.y });
    setPreviewDataUrl(null);
    setCropBox({ normX: pt.x / pt.rw, normY: pt.y / pt.rh, normW: 0, normH: 0, pxX: pt.x, pxY: pt.y, pxW: 0, pxH: 0 });
  };

  const handlePointerMove = (e) => {
    if (!isSelecting || !dragStart) return;
    const pt = getCanvasPoint(e);
    if (!pt) return;
    const left = Math.min(dragStart.x, pt.x);
    const top  = Math.min(dragStart.y, pt.y);
    const w    = Math.abs(pt.x - dragStart.x);
    const h    = Math.abs(pt.y - dragStart.y);
    setCropBox({
      normX: left / pt.rw, normY: top / pt.rh,
      normW: w / pt.rw,    normH: h / pt.rh,
      pxX: left, pxY: top, pxW: w, pxH: h
    });
  };

  const handlePointerUp = async () => {
    if (!isSelecting) return;
    setIsSelecting(false);
    if (cropBox && cropBox.pxW > 15 && cropBox.pxH > 15 && pdfDoc) {
      try {
        const previewUrl = await cropPdfRegion(
          pdfDoc, currentPage,
          { x: cropBox.normX, y: cropBox.normY, width: cropBox.normW, height: cropBox.normH },
          true, 1.5
        );
        setPreviewDataUrl(previewUrl);
      } catch { /* silent */ }
    }
  };

  /* ── Confirm & Insert ── */
  const handleConfirmAndInsert = async () => {
    if (!pdfDoc || !cropBox || cropBox.pxW < 10 || cropBox.pxH < 10) return;
    setIsCroppingAction(true);
    try {
      const croppedUrl = await cropPdfRegion(
        pdfDoc, currentPage,
        { x: cropBox.normX, y: cropBox.normY, width: cropBox.normW, height: cropBox.normH },
        true, 2.5
      );
      if (onCropComplete) {
        onCropComplete({
          url: croppedUrl,
          alt: figAlt.trim() || `Figure (Page ${currentPage})`,
          width_pct: figWidth,
          align: figAlign,
          targetSectionIdx: selectedSecIdx,
          targetItemIdx: selectedItemIdx
        });
      }
      setInsertSuccess(true);
      setTimeout(() => { setInsertSuccess(false); onClose(); }, 900);
    } catch (err) {
      setErrorMsg('Erreur lors du rognage : ' + err.message);
    } finally {
      setIsCroppingAction(false);
    }
  };

  const handleReset = () => { setCropBox(null); setPreviewDataUrl(null); };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(12px)',
        zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0.75rem', direction: 'ltr'
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* ══ Modal Container ══ */}
      <div
        className="pdf-cropper-modal-enter"
        style={{
          width: '97vw', maxWidth: 1280, height: '94vh',
          display: 'flex', flexDirection: 'column',
          background: 'linear-gradient(160deg,#13161f 0%,#0f1118 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 22,
          boxShadow: '0 40px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(99,102,241,0.15)',
          overflow: 'hidden',
        }}
      >

        {/* ══ TOP HEADER ══ */}
        <div style={{
          padding: '0.85rem 1.4rem',
          background: 'linear-gradient(90deg,rgba(16,185,129,0.1),rgba(99,102,241,0.08))',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem'
        }}>
          {/* Left: Icon + Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: 'linear-gradient(135deg,#10b981,#0d9488)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(16,185,129,0.35)',
              color: '#fff', flexShrink: 0
            }}>
              <Crop size={21} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
                Capture de figures PDF
              </h2>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.72rem', color: 'rgba(255,255,255,0.42)', fontWeight: 500 }}>
                Glissez sur n'importe quelle figure ou schéma pour l'extraire en haute résolution
              </p>
            </div>
          </div>

          {/* Center: Step Indicators */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: 'rgba(255,255,255,0.04)', borderRadius: 12,
            padding: '0.45rem 0.85rem', border: '1px solid rgba(255,255,255,0.06)'
          }}>
            <StepBadge number={1} active={step === 1} done={step > 1} />
            <span style={{ fontSize: '0.7rem', color: step === 1 ? '#a5b4fc' : step > 1 ? '#6ee7b7' : 'rgba(255,255,255,0.3)', fontWeight: 700 }}>Charger PDF</span>
            <div style={{ width: 20, height: 1, background: step > 1 ? '#10b981' : 'rgba(255,255,255,0.12)', margin: '0 2px' }} />
            <StepBadge number={2} active={step === 2} done={step > 2} />
            <span style={{ fontSize: '0.7rem', color: step === 2 ? '#a5b4fc' : step > 2 ? '#6ee7b7' : 'rgba(255,255,255,0.3)', fontWeight: 700 }}>Sélectionner</span>
            <div style={{ width: 20, height: 1, background: step > 2 ? '#10b981' : 'rgba(255,255,255,0.12)', margin: '0 2px' }} />
            <StepBadge number={3} active={step === 3} done={insertSuccess} />
            <span style={{ fontSize: '0.7rem', color: step === 3 ? '#a5b4fc' : insertSuccess ? '#6ee7b7' : 'rgba(255,255,255,0.3)', fontWeight: 700 }}>Insérer</span>
          </div>

          {/* Right: Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ToolbarBtn onClick={() => fileInputRef.current?.click()} title="Charger un autre fichier PDF">
              <Upload size={13} /> Autre PDF
            </ToolbarBtn>
            <input type="file" ref={fileInputRef} accept="application/pdf" style={{ display: 'none' }} onChange={handleUploadNewFile} />
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 9, padding: '0.42rem', cursor: 'pointer',
                color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center',
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = '#f87171'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
            >
              <X size={19} />
            </button>
          </div>
        </div>

        {/* ══ MAIN BODY ══ */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', overflow: 'hidden', minHeight: 0 }}>

          {/* ── LEFT: PDF Canvas ── */}
          <div style={{
            display: 'flex', flexDirection: 'column',
            background: '#0b0d11',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            overflow: 'hidden'
          }}>

            {/* Toolbar */}
            <div style={{
              padding: '0.5rem 0.85rem',
              background: 'rgba(255,255,255,0.02)',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap'
            }}>
              {/* Zoom */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(255,255,255,0.04)', borderRadius: 9, padding: '0.25rem 0.4rem', border: '1px solid rgba(255,255,255,0.07)' }}>
                <ToolbarBtn onClick={() => setScale(s => Math.max(0.6, s - 0.2))} disabled={scale <= 0.6} title="Zoom arrière"><ZoomOut size={14} /></ToolbarBtn>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#a5b4fc', minWidth: 38, textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
                <ToolbarBtn onClick={() => setScale(s => Math.min(3, s + 0.2))} disabled={scale >= 3} title="Zoom avant"><ZoomIn size={14} /></ToolbarBtn>
              </div>
              <ToolbarBtn onClick={() => setScale(1.3)} title="Réinitialiser le zoom"><Maximize2 size={13} /> 100%</ToolbarBtn>

              <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />

              {/* Page Nav */}
              {pdfDoc && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(255,255,255,0.04)', borderRadius: 9, padding: '0.25rem 0.5rem', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <ToolbarBtn onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); setCropBox(null); setPreviewDataUrl(null); }} disabled={currentPage <= 1} title="Page précédente"><ChevronLeft size={14} /></ToolbarBtn>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#e2e8f0', minWidth: 70, textAlign: 'center' }}>Page {currentPage} / {totalPages}</span>
                  <ToolbarBtn onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); setCropBox(null); setPreviewDataUrl(null); }} disabled={currentPage >= totalPages} title="Page suivante"><ChevronRight size={14} /></ToolbarBtn>
                </div>
              )}

              <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />

              {hasCrop && (
                <ToolbarBtn onClick={handleReset} danger title="Réinitialiser la sélection"><RotateCcw size={13} /> Réinitialiser</ToolbarBtn>
              )}

              {/* Status badge – right */}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {loading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#a5b4fc', fontSize: '0.72rem', fontWeight: 700 }}>
                    <RefreshCw size={13} className="pdf-cropper-spin" /> Rendu…
                  </div>
                )}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  background: hasCrop
                    ? 'linear-gradient(90deg,rgba(16,185,129,0.18),rgba(5,150,105,0.12))'
                    : 'linear-gradient(90deg,rgba(99,102,241,0.12),rgba(139,92,246,0.08))',
                  border: `1px solid ${hasCrop ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.2)'}`,
                  borderRadius: 8, padding: '0.28rem 0.65rem',
                  color: hasCrop ? '#6ee7b7' : '#a5b4fc',
                  fontSize: '0.7rem', fontWeight: 700,
                  transition: 'all 0.3s'
                }}>
                  <Crosshair size={12} />
                  {isSelecting ? 'Sélection en cours…' : hasCrop ? 'Zone sélectionnée ✓' : 'Glissez pour sélectionner'}
                </div>
              </div>
            </div>

            {/* Dimensions info bar */}
            {hasCrop && (
              <div style={{
                display: 'flex', gap: '0.5rem', padding: '0.45rem 0.85rem',
                background: 'linear-gradient(90deg,rgba(16,185,129,0.08),transparent)',
                borderBottom: '1px solid rgba(16,185,129,0.15)',
                animation: 'pdfCropperSlideIn 0.2s ease'
              }}>
                <InfoChip icon="📐" label="Largeur" value={`${Math.round(cropBox.pxW)} px`} accent="#6ee7b7" />
                <InfoChip icon="📏" label="Hauteur" value={`${Math.round(cropBox.pxH)} px`} accent="#6ee7b7" />
                <InfoChip icon="🗂️" label="Page" value={`${currentPage} / ${totalPages}`} accent="#a5b4fc" />
                <InfoChip icon="🔍" label="Zoom" value={`${Math.round(scale * 100)}%`} />
              </div>
            )}

            {/* Canvas Area */}
            <div
              ref={containerRef}
              style={{
                flex: 1, overflow: 'auto',
                padding: '1.5rem',
                display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
                cursor: pdfDoc ? 'crosshair' : 'default',
                userSelect: 'none'
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              {!pdfDoc ? (
                /* Empty State */
                <div style={{ textAlign: 'center', padding: '3rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', maxWidth: 360 }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: '50%',
                    background: 'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(16,185,129,0.1))',
                    border: '1px solid rgba(99,102,241,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'pdfCropperPulse 2s ease infinite'
                  }}>
                    <Upload size={28} color="#a5b4fc" />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: '1rem', color: '#e2e8f0' }}>Aucun document chargé</p>
                    <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
                      Chargez un fichier PDF pour commencer à capturer des figures géométriques ou des courbes.
                    </p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
                      border: 'none', borderRadius: 11,
                      padding: '0.65rem 1.4rem',
                      color: '#fff', fontWeight: 800, fontSize: '0.85rem',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
                      boxShadow: '0 4px 16px rgba(99,102,241,0.35)', transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = ''}
                  >
                    <Upload size={16} /> Charger un fichier PDF
                  </button>
                </div>
              ) : (
                /* PDF Canvas + Selection Overlay */
                <div style={{
                  position: 'relative', display: 'inline-block',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)',
                  borderRadius: 8
                }}>
                  {/* Loading spinner overlay */}
                  {loading && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(13,15,20,0.75)',
                      borderRadius: 8, zIndex: 10,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem'
                    }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        border: '3px solid rgba(99,102,241,0.2)',
                        borderTop: '3px solid #6366f1',
                        animation: 'pdfCropperSpinner 0.8s linear infinite'
                      }} />
                      <span style={{ color: '#a5b4fc', fontSize: '0.78rem', fontWeight: 700 }}>Rendu de la page…</span>
                    </div>
                  )}

                  <canvas ref={canvasRef} style={{ display: 'block', maxWidth: 'none', borderRadius: 6 }} />

                  {/* Selection overlay */}
                  {cropBox && cropBox.pxW > 5 && cropBox.pxH > 5 && (
                    <>
                      {/* Dimming mask */}
                      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 6 }}>
                        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: cropBox.pxY, background: 'rgba(0,0,0,0.52)' }} />
                        <div style={{ position: 'absolute', left: 0, right: 0, top: cropBox.pxY + cropBox.pxH, bottom: 0, background: 'rgba(0,0,0,0.52)' }} />
                        <div style={{ position: 'absolute', top: cropBox.pxY, height: cropBox.pxH, left: 0, width: cropBox.pxX, background: 'rgba(0,0,0,0.52)' }} />
                        <div style={{ position: 'absolute', top: cropBox.pxY, height: cropBox.pxH, left: cropBox.pxX + cropBox.pxW, right: 0, background: 'rgba(0,0,0,0.52)' }} />
                      </div>

                      {/* Selection border + handles */}
                      <div style={{
                        position: 'absolute',
                        left: cropBox.pxX, top: cropBox.pxY,
                        width: cropBox.pxW, height: cropBox.pxH,
                        border: '2px solid #10b981',
                        pointerEvents: 'none',
                        animation: isSelecting ? 'none' : 'pdfCropperPulse 2s ease infinite',
                        boxSizing: 'border-box'
                      }}>
                        {/* Corner handles */}
                        {[{ top: -4, left: -4 }, { top: -4, right: -4 }, { bottom: -4, left: -4 }, { bottom: -4, right: -4 }].map((pos, i) => (
                          <div key={i} style={{ position: 'absolute', width: 10, height: 10, background: '#10b981', borderRadius: 2, border: '2px solid #fff', ...pos }} />
                        ))}

                        {/* Rule-of-thirds grid */}
                        {!isSelecting && (
                          <>
                            {[1/3, 2/3].map((f, i) => (
                              <div key={`h${i}`} style={{ position: 'absolute', top: `${f * 100}%`, left: 0, right: 0, height: 1, background: 'rgba(16,185,129,0.35)' }} />
                            ))}
                            {[1/3, 2/3].map((f, i) => (
                              <div key={`v${i}`} style={{ position: 'absolute', left: `${f * 100}%`, top: 0, bottom: 0, width: 1, background: 'rgba(16,185,129,0.35)' }} />
                            ))}
                          </>
                        )}

                        {/* Dimensions badge */}
                        {cropBox.pxW > 50 && (
                          <div style={{
                            position: 'absolute', bottom: -26, left: '50%', transform: 'translateX(-50%)',
                            background: '#10b981', color: '#fff',
                            fontSize: '0.63rem', fontWeight: 800, padding: '2px 8px',
                            borderRadius: 6, whiteSpace: 'nowrap',
                            animation: 'pdfCropperBadgePop 0.2s ease',
                            boxShadow: '0 2px 8px rgba(16,185,129,0.4)'
                          }}>
                            {Math.round(cropBox.pxW)} × {Math.round(cropBox.pxH)}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT PANE: Settings ── */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '0.85rem',
            padding: '1.1rem', overflowY: 'auto',
            background: 'linear-gradient(180deg,rgba(255,255,255,0.02) 0%,transparent 100%)',
            minWidth: 0
          }}>

            {/* Preview */}
            <div>
              <p style={{ margin: '0 0 0.45rem', fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <ImageIcon size={11} /> Aperçu en temps réel
              </p>
              <div style={{
                minHeight: 150, maxHeight: 210,
                background: '#0e1018',
                border: `1px ${previewDataUrl ? 'solid rgba(16,185,129,0.3)' : 'dashed rgba(255,255,255,0.1)'}`,
                borderRadius: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', padding: '0.5rem', position: 'relative',
                transition: 'border-color 0.3s'
              }}>
                {previewDataUrl ? (
                  <>
                    <img src={previewDataUrl} alt="Aperçu" style={{ maxWidth: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 6 }} />
                    <div style={{
                      position: 'absolute', top: 8, right: 8,
                      background: '#10b981', borderRadius: '50%', width: 22, height: 22,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(16,185,129,0.5)',
                      animation: 'pdfCropperBadgePop 0.3s ease'
                    }}>
                      <CheckCircle size={13} color="#fff" />
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.72rem' }}>
                    <Crop size={26} style={{ marginBottom: '0.45rem', opacity: 0.3 }} />
                    <p style={{ margin: 0, fontWeight: 600, lineHeight: 1.5 }}>Glissez sur le document<br />pour voir l'aperçu ici</p>
                  </div>
                )}
              </div>

              {previewDataUrl && (
                <button
                  type="button"
                  onClick={() => setIsAiEnhanceOpen(true)}
                  style={{
                    width: '100%', marginTop: '0.45rem',
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(168,85,247,0.25))',
                    border: '1px solid rgba(168,85,247,0.5)',
                    borderRadius: 9, padding: '0.45rem 0.6rem',
                    color: '#e9d5ff', fontSize: '0.74rem', fontWeight: 800,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                    boxShadow: '0 2px 8px rgba(168,85,247,0.2)'
                  }}
                  title="Améliorer la netteté ou régénérer en SVG avec l'IA"
                >
                  <Sparkles size={13} style={{ color: '#c084fc' }} /> Régénérer / HD avec l'IA
                </button>
              )}
            </div>

            {/* Destination */}
            <div>
              <p style={{ margin: '0 0 0.45rem', fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Layers size={11} /> Insérer dans la section
              </p>
              <select
                value={selectedSecIdx}
                onChange={e => setSelectedSecIdx(parseInt(e.target.value))}
                style={{
                  width: '100%', padding: '0.55rem 0.7rem',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10, color: '#e2e8f0', fontSize: '0.78rem', fontWeight: 600,
                  cursor: 'pointer', outline: 'none', appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.7rem center', paddingRight: '2rem'
                }}
              >
                {sections.map((s, idx) => (
                  <option key={idx} value={idx}>
                    {s.title ? `${s.title} (${s.type === 'exercise' ? 'Exercice' : 'Paragraphe'})` : `Section ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Caption */}
            <div>
              <p style={{ margin: '0 0 0.45rem', fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                📝 Légende (optionnel)
              </p>
              <input
                type="text"
                placeholder="ex : Figure 1 — Courbe représentative de f"
                value={figAlt}
                onChange={e => setFigAlt(e.target.value)}
                style={{
                  width: '100%', padding: '0.55rem 0.7rem',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10, color: '#e2e8f0', fontSize: '0.78rem',
                  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s'
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            {/* Width + Alignment */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div>
                <p style={{ margin: '0 0 0.4rem', fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📐 Largeur</p>
                <select
                  value={figWidth}
                  onChange={e => setFigWidth(parseInt(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, color: '#e2e8f0', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', outline: 'none', appearance: 'none' }}
                >
                  <option value={100}>100% — Pleine</option>
                  <option value={85}>85% — Grande</option>
                  <option value={70}>70% — Moyenne</option>
                  <option value={50}>50% — Compacte</option>
                </select>
              </div>
              <div>
                <p style={{ margin: '0 0 0.4rem', fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📍 Alignement</p>
                <div style={{ display: 'flex', borderRadius: 9, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {[
                    { value: 'left', icon: <AlignLeft size={13} /> },
                    { value: 'center', icon: <AlignCenter size={13} /> },
                    { value: 'right', icon: <AlignRight size={13} /> },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => setFigAlign(opt.value)} style={{
                      flex: 1, padding: '0.5rem',
                      background: figAlign === opt.value ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.03)',
                      border: 'none', borderRight: '1px solid rgba(255,255,255,0.06)',
                      color: figAlign === opt.value ? '#a5b4fc' : 'rgba(255,255,255,0.35)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s'
                    }}>
                      {opt.icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* How-to guide */}
            {!hasCrop && pdfDoc && (
              <div style={{
                background: 'linear-gradient(135deg,rgba(99,102,241,0.07),rgba(16,185,129,0.05))',
                border: '1px solid rgba(99,102,241,0.15)',
                borderRadius: 13, padding: '0.85rem',
                animation: 'pdfCropperSlideIn 0.25s ease'
              }}>
                <p style={{ margin: '0 0 0.6rem', fontSize: '0.72rem', fontWeight: 800, color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Info size={12} /> Comment capturer une figure
                </p>
                {[
                  { emoji: '🖱️', text: 'Placez le curseur sur la figure dans le document' },
                  { emoji: '↘️', text: 'Glissez pour dessiner un cadre de sélection' },
                  { emoji: '✅', text: 'Relâchez pour voir l\'aperçu instantané' },
                  { emoji: '💾', text: 'Cliquez sur « Valider et insérer »' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>{item.emoji}</span>
                    <span style={{ fontSize: '0.71rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>{item.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {errorMsg && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 10, padding: '0.65rem 0.8rem',
                color: '#fca5a5', fontSize: '0.75rem', fontWeight: 600, lineHeight: 1.4
              }}>
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingTop: '0.5rem' }}>
              <button
                type="button"
                onClick={handleConfirmAndInsert}
                disabled={!hasCrop || isCroppingAction || insertSuccess}
                style={{
                  padding: '0.75rem', borderRadius: 12, border: 'none',
                  fontSize: '0.85rem', fontWeight: 800,
                  cursor: (!hasCrop || isCroppingAction) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  transition: 'all 0.2s',
                  ...(insertSuccess
                    ? { background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', boxShadow: '0 4px 20px rgba(16,185,129,0.45)' }
                    : hasCrop && !isCroppingAction
                    ? { background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', boxShadow: '0 4px 20px rgba(99,102,241,0.4)' }
                    : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.25)' }
                  )
                }}
                onMouseEnter={e => { if (hasCrop && !isCroppingAction && !insertSuccess) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
              >
                {insertSuccess ? (
                  <><CheckCircle size={16} /> Inséré avec succès !</>
                ) : isCroppingAction ? (
                  <><RefreshCw size={16} className="pdf-cropper-spin" /> Extraction en cours…</>
                ) : (
                  <><Sparkles size={16} /> Valider et insérer la figure</>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '0.55rem', borderRadius: 10,
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem', fontWeight: 700,
                  cursor: 'pointer', transition: 'all 0.15s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
              >
                Annuler
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* AI Figure Enhancer Submodal */}
      <AiFigureEnhancerModal
        isOpen={isAiEnhanceOpen}
        onClose={() => setIsAiEnhanceOpen(false)}
        imageSrc={previewDataUrl}
        caption={figAlt}
        onApply={(newHdUrl) => {
          setPreviewDataUrl(newHdUrl);
          setIsAiEnhanceOpen(false);
        }}
      />
    </div>
  );
}
