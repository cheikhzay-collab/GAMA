// src/components/PdfFigureCropperModal.jsx
// Outil professionnel de rognage de figures géométriques et courbes depuis des PDF

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Crop, ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
  Maximize2, CheckCircle, RefreshCw, Upload, Image as ImageIcon,
  Layers
} from 'lucide-react';
import { loadPdfDocument, renderPdfPageToCanvas, cropPdfRegion } from '../utils/pdfFigureExtractor';

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

  // Target Destination & Attributes
  const [selectedSecIdx, setSelectedSecIdx] = useState(targetSectionIdx ?? 0);
  const [selectedItemIdx, setSelectedItemIdx] = useState(targetItemIdx);
  const [figAlt, setFigAlt] = useState('');
  const [figWidth, setFigWidth] = useState(80);
  const [figAlign, setFigAlign] = useState('center');

  // Cropping Canvas State
  const [isSelecting, setIsSelecting] = useState(false);
  const [cropBox, setCropBox] = useState(null); // { normX, normY, normW, normH, pxX, pxY, pxW, pxH }
  const [dragStart, setDragStart] = useState(null);
  const [previewDataUrl, setPreviewDataUrl] = useState(null);
  const [isCroppingAction, setIsCroppingAction] = useState(false);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Sync initial PDF doc or file
  useEffect(() => {
    if (initialPdfDoc) {
      setPdfDoc(initialPdfDoc);
      setTotalPages(initialPdfDoc.numPages);
      setCurrentPage(1);
    } else if (initialFile && (initialFile.type === 'application/pdf' || initialFile.name?.endsWith('.pdf'))) {
      setLoading(true);
      loadPdfDocument(initialFile).then(doc => {
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(1);
      }).catch(err => {
        setErrorMsg('Impossible de lire le fichier PDF : ' + err.message);
      }).finally(() => {
        setLoading(false);
      });
    }
  }, [initialPdfDoc, initialFile]);

  // Sync target section / item when props change
  useEffect(() => {
    setSelectedSecIdx(targetSectionIdx ?? 0);
    setSelectedItemIdx(targetItemIdx);
    setCropBox(null);
    setPreviewDataUrl(null);
  }, [targetSectionIdx, targetItemIdx, isOpen]);

  // Render current PDF page
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;
    setLoading(true);
    setErrorMsg('');
    try {
      await renderPdfPageToCanvas(pdfDoc, currentPage, canvasRef.current, scale);
    } catch (err) {
      console.error('Error rendering PDF page:', err);
      setErrorMsg('Erreur lors du rendu de la page : ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [pdfDoc, currentPage, scale]);

  useEffect(() => {
    if (isOpen && pdfDoc) {
      renderPage();
    }
  }, [isOpen, pdfDoc, currentPage, scale, renderPage]);

  // Handle local PDF upload from within modal
  const handleUploadNewFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const doc = await loadPdfDocument(file);
      setPdfDoc(doc);
      setTotalPages(doc.numPages);
      setCurrentPage(1);
      setCropBox(null);
      setPreviewDataUrl(null);
    } catch (err) {
      setErrorMsg('Impossible d\'ouvrir le document : ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Mouse / Touch Selection Handlers on Canvas
  const handlePointerDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || e.touches?.[0]?.clientX;
    const clientY = e.clientY || e.touches?.[0]?.clientY;
    if (clientX === undefined || clientY === undefined) return;

    const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const clickY = Math.max(0, Math.min(rect.height, clientY - rect.top));

    setIsSelecting(true);
    setDragStart({ x: clickX, y: clickY });
    setCropBox({
      normX: clickX / rect.width,
      normY: clickY / rect.height,
      normW: 0,
      normH: 0,
      pxX: clickX,
      pxY: clickY,
      pxW: 0,
      pxH: 0
    });
  };

  const handlePointerMove = (e) => {
    if (!isSelecting || !dragStart) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || e.touches?.[0]?.clientX;
    const clientY = e.clientY || e.touches?.[0]?.clientY;
    if (clientX === undefined || clientY === undefined) return;

    const curX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const curY = Math.max(0, Math.min(rect.height, clientY - rect.top));

    const left = Math.min(dragStart.x, curX);
    const top = Math.min(dragStart.y, curY);
    const width = Math.abs(curX - dragStart.x);
    const height = Math.abs(curY - dragStart.y);

    setCropBox({
      normX: left / rect.width,
      normY: top / rect.height,
      normW: width / rect.width,
      normH: height / rect.height,
      pxX: left,
      pxY: top,
      pxW: width,
      pxH: height
    });
  };

  const handlePointerUp = async () => {
    if (!isSelecting) return;
    setIsSelecting(false);

    // Generate real-time preview if selection is significant
    if (cropBox && cropBox.pxW > 15 && cropBox.pxH > 15 && pdfDoc) {
      try {
        const normRect = {
          x: cropBox.normX,
          y: cropBox.normY,
          width: cropBox.normW,
          height: cropBox.normH
        };
        const previewUrl = await cropPdfRegion(pdfDoc, currentPage, normRect, true, 1.5);
        setPreviewDataUrl(previewUrl);
      } catch (err) {
        console.warn('Failed to generate quick preview:', err);
      }
    }
  };

  // Perform Final High-DPI Crop & Insert
  const handleConfirmAndInsert = async () => {
    if (!pdfDoc || !cropBox || cropBox.pxW < 10 || cropBox.pxH < 10) {
      alert('Veuillez d\'abord sélectionner une zone en glissant la souris sur la figure.');
      return;
    }

    setIsCroppingAction(true);
    try {
      const normRect = {
        x: cropBox.normX,
        y: cropBox.normY,
        width: cropBox.normW,
        height: cropBox.normH
      };

      // High-res crop at 300 DPI+ (renderScale = 2.5)
      const croppedHighResUrl = await cropPdfRegion(pdfDoc, currentPage, normRect, true, 2.5);

      if (onCropComplete) {
        onCropComplete({
          url: croppedHighResUrl,
          alt: figAlt.trim() || `Figure (Page ${currentPage})`,
          width_pct: figWidth,
          align: figAlign,
          targetSectionIdx: selectedSecIdx,
          targetItemIdx: selectedItemIdx
        });
      }

      onClose();
    } catch (err) {
      console.error('Error during final crop:', err);
      alert('Erreur lors du rognage : ' + err.message);
    } finally {
      setIsCroppingAction(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        direction: 'ltr'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-card"
        style={{
          width: '96vw',
          maxWidth: '1200px',
          height: '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-surface, #1e222b)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
          overflow: 'hidden'
        }}
      >
        {/* Modal Top Header */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255,255,255,0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff'
              }}
            >
              <Crop size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Outil de capture et rognage de figures PDF
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                Glissez la souris sur n'importe quel schéma, figure ou courbe pour l'extraire en haute résolution
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-outline"
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              title="Ouvrir un autre fichier PDF"
            >
              <Upload size={14} /> Autre PDF
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept="application/pdf"
              style={{ display: 'none' }}
              onChange={handleUploadNewFile}
            />

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: 'none',
                borderRadius: '8px',
                padding: '0.45rem',
                cursor: 'pointer',
                color: 'var(--text-muted)'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Main Body (2 Columns Layout) */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 340px', overflow: 'hidden' }}>
          
          {/* Left/Center Pane: Interactive PDF Canvas Viewport */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: '#121418',
              borderRight: '1px solid var(--border)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Viewport Control Bar */}
            <div
              style={{
                padding: '0.6rem 1rem',
                background: 'rgba(255,255,255,0.03)',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                direction: 'ltr'
              }}
            >
              {/* Zoom Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button
                  className="btn-outline"
                  style={{ padding: '0.25rem 0.5rem' }}
                  onClick={() => setScale(s => Math.min(2.6, s + 0.2))}
                  title="Zoom avant"
                >
                  <ZoomIn size={15} />
                </button>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, minWidth: '42px', textAlign: 'center' }}>
                  {Math.round(scale * 100)}%
                </span>
                <button
                  className="btn-outline"
                  style={{ padding: '0.25rem 0.5rem' }}
                  onClick={() => setScale(s => Math.max(0.7, s - 0.2))}
                  title="Zoom arrière"
                >
                  <ZoomOut size={15} />
                </button>
                <button
                  className="btn-outline"
                  style={{ padding: '0.25rem 0.5rem' }}
                  onClick={() => setScale(1.3)}
                  title="Réinitialiser le zoom"
                >
                  <Maximize2 size={14} />
                </button>
              </div>

              {/* Page Selector & Navigation */}
              {pdfDoc ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    className="btn-outline"
                    style={{ padding: '0.25rem 0.5rem' }}
                    disabled={currentPage <= 1}
                    onClick={() => {
                      setCurrentPage(p => Math.max(1, p - 1));
                      setCropBox(null);
                      setPreviewDataUrl(null);
                    }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Page {currentPage} sur {totalPages}
                  </span>
                  <button
                    className="btn-outline"
                    style={{ padding: '0.25rem 0.5rem' }}
                    disabled={currentPage >= totalPages}
                    onClick={() => {
                      setCurrentPage(p => Math.min(totalPages, p + 1));
                      setCropBox(null);
                      setPreviewDataUrl(null);
                    }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              ) : (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Aucun document sélectionné</span>
              )}

              {/* Hint badge */}
              <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>
                🖱️ Glissez pour sélectionner
              </div>
            </div>

            {/* Canvas Scroll Area */}
            <div
              ref={containerRef}
              style={{
                flex: 1,
                overflow: 'auto',
                padding: '1.5rem',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
                cursor: 'crosshair',
                userSelect: 'none'
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              {!pdfDoc ? (
                <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
                  <ImageIcon size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                  <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>Aucun document PDF chargé</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="btn"
                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)', padding: '0.5rem 1.25rem' }}
                  >
                    <Upload size={16} /> Charger un fichier PDF
                  </button>
                </div>
              ) : (
                <div style={{ position: 'relative', display: 'inline-block', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', borderRadius: '6px', overflow: 'hidden' }}>
                  <canvas ref={canvasRef} style={{ display: 'block', maxWidth: 'none' }} />

                  {/* Highlighting Overlay Crop Box */}
                  {cropBox && cropBox.pxW > 5 && cropBox.pxH > 5 && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${cropBox.pxX}px`,
                        top: `${cropBox.pxY}px`,
                        width: `${cropBox.pxW}px`,
                        height: `${cropBox.pxH}px`,
                        border: '2px solid #10b981',
                        background: 'rgba(16, 185, 129, 0.22)',
                        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
                        pointerEvents: 'none',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'flex-end',
                        padding: '4px'
                      }}
                    >
                      <span
                        style={{
                          background: '#10b981',
                          color: '#fff',
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          padding: '1px 5px',
                          borderRadius: '4px',
                          direction: 'ltr'
                        }}
                      >
                        {Math.round(cropBox.pxW)} × {Math.round(cropBox.pxH)} px
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Pane: Live Preview & Insertion Settings */}
          <div
            style={{
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              overflowY: 'auto',
              background: 'rgba(255,255,255,0.015)'
            }}
          >
            {/* Live Cropped Preview Section */}
            <div className="input-group">
              <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>🖼️</span> Aperçu de la capture
              </label>
              <div
                style={{
                  minHeight: '160px',
                  maxHeight: '220px',
                  background: '#15181e',
                  border: '1px dashed var(--border)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  padding: '0.5rem',
                  position: 'relative'
                }}
              >
                {previewDataUrl ? (
                  <img
                    src={previewDataUrl}
                    alt="Preview"
                    style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain', borderRadius: '6px' }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-subtle)', fontSize: '0.75rem' }}>
                    <Crop size={24} style={{ opacity: 0.3, marginBottom: '0.4rem' }} />
                    <p style={{ margin: 0 }}>Glissez sur le document à gauche pour afficher l'aperçu ici</p>
                  </div>
                )}
              </div>
            </div>

            {/* Destination Selector */}
            <div className="input-group">
              <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Layers size={14} color="var(--violet)" /> Insérer dans l'exercice / section :
              </label>
              <select
                className="input-control"
                value={selectedSecIdx}
                onChange={e => setSelectedSecIdx(parseInt(e.target.value))}
                style={{ padding: '0.45rem', fontSize: '0.8rem' }}
              >
                {sections.map((s, idx) => (
                  <option key={idx} value={idx}>
                    {s.title ? `${s.title} (${s.type === 'exercise' ? 'Exercice' : 'Paragraphe'})` : `Section ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Figure Legend / Alt text */}
            <div className="input-group">
              <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                Légende / Titre de la figure (optionnel)
              </label>
              <input
                type="text"
                className="input-control"
                placeholder="ex: Figure 1 — Courbe représentative de f(x)"
                value={figAlt}
                onChange={e => setFigAlt(e.target.value)}
                style={{ padding: '0.4rem', fontSize: '0.8rem' }}
              />
            </div>

            {/* Display Width & Alignment */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div className="input-group">
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>📐 Largeur dans la page</label>
                <select
                  className="input-control"
                  value={figWidth}
                  onChange={e => setFigWidth(parseInt(e.target.value))}
                  style={{ padding: '0.35rem', fontSize: '0.8rem' }}
                >
                  <option value={100}>100% (Pleine largeur)</option>
                  <option value={85}>85% (Grand)</option>
                  <option value={70}>70% (Moyen)</option>
                  <option value={50}>50% (Compact)</option>
                </select>
              </div>

              <div className="input-group">
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>📍 Alignement</label>
                <select
                  className="input-control"
                  value={figAlign}
                  onChange={e => setFigAlign(e.target.value)}
                  style={{ padding: '0.35rem', fontSize: '0.8rem' }}
                >
                  <option value="center">Centré</option>
                  <option value="left">À gauche</option>
                  <option value="right">À droite</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingTop: '1rem' }}>
              <button
                type="button"
                onClick={handleConfirmAndInsert}
                disabled={!cropBox || cropBox.pxW < 10 || isCroppingAction}
                className="btn"
                style={{
                  padding: '0.65rem',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  background: (!cropBox || cropBox.pxW < 10) ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #10b981, #059669)',
                  color: (!cropBox || cropBox.pxW < 10) ? 'var(--text-subtle)' : '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  cursor: (!cropBox || cropBox.pxW < 10) ? 'not-allowed' : 'pointer'
                }}
              >
                {isCroppingAction ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> Rognage et traitement en cours...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} /> Valider et insérer la figure
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="btn-outline"
                style={{ padding: '0.45rem', fontSize: '0.8rem' }}
              >
                إلغاء
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
