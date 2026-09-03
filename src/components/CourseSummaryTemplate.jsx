import React from 'react';
import { renderWithMath } from '../utils/mathRenderer';

// Teacher / Education SVG Icon for left header cell
const TeacherBadgeSVG = () => (
  <svg width="36" height="36" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <circle cx="24" cy="24" r="23" stroke="#0070ba" strokeWidth="2" fill="#e0f2fe" />
    {/* Teacher silhouette with graduation cap & board */}
    <path d="M24 10 L36 16 L24 22 L12 16 Z" fill="#0070ba" />
    <path d="M34 18 V25 C34 25 31 28 24 28 C17 28 14 25 14 25 V18" stroke="#0070ba" strokeWidth="2" fill="none" />
    <circle cx="24" cy="33" r="4" fill="#0284c7" />
    <path d="M16 42 C16 38 19 36 24 36 C29 36 32 38 32 42" stroke="#0284c7" strokeWidth="2" fill="none" />
  </svg>
);

// Helper to clean raw text and format LaTeX
const cleanLatex = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/\\n([a-zA-Z])/g, '\n $1')
    .replace(/\\\\([a-zA-Z]+)/g, '\\$1')
    .trim();
};

/**
 * Parses raw text or structured items of a section into blocks:
 * - normal text paragraphs
 * - yellow highlight / example boxes
 */
const parseSectionBlocks = (section) => {
  const blocks = [];

  // 1. If explicit items exist
  if (Array.isArray(section.items) && section.items.length > 0) {
    section.items.forEach((item, idx) => {
      const text = typeof item === 'string' ? item : (item.text || item.content || '');
      const type = item.type || 'text';
      const isExampleOrHighlight = type === 'example' || type === 'highlight_box' || item.is_highlight || item.is_example || /^(exemple|exemples|مثال|أمثلة)\s*:/i.test(text.trim());
      
      blocks.push({
        id: `it-${idx}`,
        type: isExampleOrHighlight ? 'highlight' : type,
        text: cleanLatex(text),
        title: item.title || null
      });
    });
    return blocks;
  }

  // 2. Parse from section.content raw string
  const raw = cleanLatex(section.content || section.description || section.text || '');
  if (!raw) return blocks;

  // Split by double newlines or highlight markers
  const lines = raw.split('\n');
  let currentNormal = [];
  let currentHighlight = [];
  let inHighlight = false;

  const flushNormal = () => {
    if (currentNormal.length > 0) {
      blocks.push({ type: 'text', text: currentNormal.join('\n') });
      currentNormal = [];
    }
  };

  const flushHighlight = () => {
    if (currentHighlight.length > 0) {
      blocks.push({ type: 'highlight', text: currentHighlight.join('\n') });
      currentHighlight = [];
      inHighlight = false;
    }
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inHighlight) currentHighlight.push('');
      else currentNormal.push('');
      return;
    }

    // Check if line triggers an example / highlight block
    const isExampleStart = /^(exemple|exemples|مثال|أمثلة|propriété|propriétés|خاصية|تطبيق|application)\s*:/i.test(trimmed) ||
                           /^(comment savoir qu'un nombre est premier|\d+\s+est-il un nombre premier\s*\?)/i.test(trimmed);

    if (isExampleStart) {
      flushNormal();
      inHighlight = true;
      currentHighlight.push(trimmed);
    } else if (inHighlight) {
      // Check if another regular section or numbered list ends the highlight
      if (/^[•\-*]\s+[A-Z\u0600-\u06FF]/.test(trimmed) && !/^(•\s*L'entier|•\s*Exemple)/i.test(trimmed)) {
        flushHighlight();
        currentNormal.push(trimmed);
      } else {
        currentHighlight.push(trimmed);
      }
    } else {
      currentNormal.push(trimmed);
    }
  });

  flushNormal();
  flushHighlight();

  return blocks;
};

export default function CourseSummaryTemplate({ data, printable = false }) {
  const header = data?.content?.header || data?.header || {};
  const meta = header.summary_meta || {};

  // Extract Header Info matching the reference template
  const profName = meta.prof || header.teacher || 'Prof : Fayssal el boutkhili';
  const website = meta.website || header.phone || header.contact || 'www.elboutkhili.jimdofree.com';
  const summaryTitle = meta.title || header.fiche_title || data?.title || "Résumé de cours : Notion d'arithmétique";
  const levelName = meta.level_name || header.prep_title || header.level || 'Tronc commun science';
  const schoolName = meta.school || (header.schools && header.schools[0]) || 'Lycée ABDE EL MOUMENE';

  // Extract raw sections
  const rawSections = data?.content?.sections || data?.sections || [];

  // Distribute sections across 3 columns
  const col1 = [];
  const col2 = [];
  const col3 = [];

  rawSections.forEach((sec, idx) => {
    // If explicitly tagged with column
    if (sec.column === 1 || sec.col === 1) {
      col1.push(sec);
    } else if (sec.column === 2 || sec.col === 2) {
      col2.push(sec);
    } else if (sec.column === 3 || sec.col === 3) {
      col3.push(sec);
    } else {
      // Automatic balanced distribution
      const total = rawSections.length;
      const third = Math.ceil(total / 3);
      if (idx < third) {
        col1.push(sec);
      } else if (idx < third * 2) {
        col2.push(sec);
      } else {
        col3.push(sec);
      }
    }
  });

  const columns = [col1, col2, col3];

  return (
    <div className="course-summary-root" style={{
      width: '100%',
      maxWidth: printable ? '100%' : '1100px',
      margin: '0 auto',
      boxSizing: 'border-box',
      fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans Arabic', sans-serif",
      color: '#000000',
      backgroundColor: '#ffffff'
    }}>
      <style>{`
        .cs-frame {
          border: 2.5px solid #0070ba;
          box-sizing: border-box;
          background: #ffffff;
          padding: 6px;
        }

        .cs-header-grid {
          display: grid;
          grid-template-columns: 32% 36% 32%;
          gap: 6px;
          margin-bottom: 6px;
        }

        .cs-header-cell {
          border: 2px solid #0070ba;
          padding: 6px 10px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          box-sizing: border-box;
          background: #fffde7;
          text-align: center;
        }

        .cs-header-center {
          background: #ffffff;
          border: 2px solid #0070ba;
          padding: 6px 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .cs-columns-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          border: 2px solid #0070ba;
          box-sizing: border-box;
        }

        .cs-col {
          padding: 6px 8px;
          box-sizing: border-box;
        }

        .cs-col:not(:last-child) {
          border-right: 2px solid #0070ba;
        }

        .cs-section {
          margin-bottom: 12px;
        }

        /* Blue / Cyan Header Banner */
        .cs-badge-header {
          background: #bae6fd;
          color: #0f172a;
          padding: 4px 6px;
          font-weight: 800;
          font-size: 0.88rem;
          line-height: 1.3;
          margin-bottom: 5px;
          border-radius: 2px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .cs-sub-header {
          font-weight: 800;
          font-size: 0.86rem;
          text-decoration: underline;
          margin: 4px 0 2px 0;
          color: #000000;
          text-align: center;
        }

        .cs-text-p {
          font-size: 0.85rem;
          line-height: 1.42;
          font-weight: 600;
          color: #000000;
          margin-bottom: 4px;
        }

        /* Yellow Highlight Callout Box (Signature feature) */
        .cs-yellow-box {
          background-color: #ffff00;
          border: 1px solid #ca8a04;
          padding: 5px 7px;
          margin: 5px 0;
          border-radius: 2px;
          font-size: 0.84rem;
          font-weight: 700;
          color: #000000;
          line-height: 1.4;
          box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        }

        .cs-bullet-item {
          font-size: 0.84rem;
          line-height: 1.4;
          font-weight: 600;
          margin-bottom: 3px;
          padding-left: 4px;
        }

        @media screen and (max-width: 768px) {
          .cs-header-grid {
            grid-template-columns: 1fr;
          }
          .cs-columns-grid {
            grid-template-columns: 1fr;
          }
          .cs-col:not(:last-child) {
            border-right: none;
            border-bottom: 2px solid #0070ba;
          }
        }

        @media print {
          @page {
            size: A4 landscape;
            margin: 6mm;
          }
          body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .course-summary-root {
            max-width: 100% !important;
            width: 100% !important;
          }
          .cs-frame {
            border: 2px solid #0070ba !important;
            padding: 4px !important;
          }
          .cs-columns-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr 1fr !important;
          }
          .cs-col:not(:last-child) {
            border-right: 2px solid #0070ba !important;
            border-bottom: none !important;
          }
          .cs-badge-header {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: #bae6fd !important;
          }
          .cs-yellow-box {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background-color: #ffff00 !important;
          }
          .cs-header-cell {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: #fffde7 !important;
          }
        }
      `}</style>

      {/* Main Outer Box Frame */}
      <div className="cs-frame">

        {/* ════════════════════ TOP HEADER ════════════════════ */}
        <div className="cs-header-grid">
          
          {/* Left Cell: Teacher & Site */}
          <div className="cs-header-cell">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'center' }}>
              <TeacherBadgeSVG />
              <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'center' }}>
                <span style={{ color: '#005f73', fontWeight: 800, fontSize: '0.95rem', letterSpacing: '-0.01em' }}>
                  {profName}
                </span>
                <span style={{ color: '#0070ba', fontWeight: 700, fontSize: '0.82rem', marginTop: '2px', wordBreak: 'break-all' }}>
                  {website}
                </span>
              </div>
            </div>
          </div>

          {/* Center Cell: Title (Red Bold) */}
          <div className="cs-header-center">
            <h1 style={{
              margin: 0,
              color: '#dc2626',
              fontSize: '1.12rem',
              fontWeight: 900,
              lineHeight: 1.3,
              letterSpacing: '-0.01em'
            }}>
              {renderWithMath(summaryTitle)}
            </h1>
          </div>

          {/* Right Cell: Level & School */}
          <div className="cs-header-cell">
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#047857', fontWeight: 800, fontSize: '0.92rem' }}>
                {levelName}
              </span>
              <span style={{ color: '#0070ba', fontWeight: 800, fontSize: '0.88rem', marginTop: '3px' }}>
                {schoolName}
              </span>
            </div>
          </div>

        </div>

        {/* ════════════════════ 3-COLUMN CONTENT ════════════════════ */}
        <div className="cs-columns-grid">
          {columns.map((colSections, colIdx) => (
            <div key={`col-${colIdx}`} className="cs-col">
              {colSections.map((sec, secIdx) => {
                const cleanTitle = (sec.title || '').replace(/\*\*/g, '').trim();
                const blocks = parseSectionBlocks(sec);

                return (
                  <div key={`sec-${colIdx}-${secIdx}`} className="cs-section">
                    
                    {/* Section Badge Header (Cyan / Sky Blue) */}
                    {cleanTitle && (
                      <div className="cs-badge-header">
                        <span>•</span>
                        <span>{renderWithMath(cleanTitle)}</span>
                      </div>
                    )}

                    {/* Section Content & Highlights */}
                    <div style={{ padding: '0 2px' }}>
                      {blocks.map((block, bIdx) => {
                        if (block.type === 'highlight') {
                          return (
                            <div key={`b-${bIdx}`} className="cs-yellow-box">
                              {renderWithMath(block.text)}
                            </div>
                          );
                        }

                        if (block.type === 'bullet') {
                          return (
                            <div key={`b-${bIdx}`} className="cs-bullet-item">
                              {renderWithMath(block.text)}
                            </div>
                          );
                        }

                        // Regular text paragraphs
                        return (
                          <div key={`b-${bIdx}`} className="cs-text-p">
                            {renderWithMath(block.text)}
                          </div>
                        );
                      })}
                    </div>

                  </div>
                );
              })}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
