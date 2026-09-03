// src/utils/generateCourseSummaryPDF.js
// Standalone high-fidelity HTML & PDF print generator for Moroccan 3-Column Course Summary sheets.

import katex from 'katex';

// KaTeX render helper for print HTML
const renderLatexToHtml = (text) => {
  if (!text || typeof text !== 'string') return '';

  // Process math inline $...$ and display $$...$$
  let processed = text;

  // Display math $$...$$
  processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
    } catch {
      return math;
    }
  });

  // Inline math $...$
  processed = processed.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return math;
    }
  });

  return processed;
};

const escapeHtml = (unsafe) => {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export const generateCourseSummaryHTML = (data) => {
  const header = data?.content?.header || data?.header || {};
  const meta = header.summary_meta || {};

  const profName = meta.prof || header.teacher || 'Prof : Fayssal el boutkhili';
  const website = meta.website || header.phone || 'www.elboutkhili.jimdofree.com';
  const summaryTitle = meta.title || header.fiche_title || data?.title || "Résumé de cours : Notion d'arithmétique";
  const levelName = meta.level_name || header.prep_title || header.level || 'Tronc commun science';
  const schoolName = meta.school || (header.schools && header.schools[0]) || 'Lycée ABDE EL MOUMENE';

  const rawSections = data?.content?.sections || data?.sections || [];

  const col1 = [];
  const col2 = [];
  const col3 = [];

  rawSections.forEach((sec, idx) => {
    if (sec.column === 1 || sec.col === 1) col1.push(sec);
    else if (sec.column === 2 || sec.col === 2) col2.push(sec);
    else if (sec.column === 3 || sec.col === 3) col3.push(sec);
    else {
      const third = Math.ceil(rawSections.length / 3);
      if (idx < third) col1.push(sec);
      else if (idx < third * 2) col2.push(sec);
      else col3.push(sec);
    }
  });

  const columns = [col1, col2, col3];

  const renderSectionHtml = (sec) => {
    const rawTitle = (sec.title || '').replace(/\*\*/g, '').trim();
    const titleHtml = rawTitle ? renderLatexToHtml(escapeHtml(rawTitle)) : '';

    let contentHtml = '';
    const items = sec.items || [];

    if (items.length > 0) {
      contentHtml = items.map(it => {
        const text = typeof it === 'string' ? it : (it.text || it.content || '');
        const isHighlight = it.type === 'example' || it.type === 'highlight_box' || it.is_highlight || it.is_example || /^(exemple|exemples|مثال|أمثلة)\s*:/i.test(text.trim());
        const formatted = renderLatexToHtml(escapeHtml(text));
        if (isHighlight) {
          return `<div class="cs-yellow-box">${formatted}</div>`;
        }
        return `<div class="cs-text-p">${formatted}</div>`;
      }).join('');
    } else {
      const lines = (sec.content || sec.description || '').split('\n');
      let currentNormal = [];
      let currentHighlight = [];
      let inHighlight = false;
      let out = '';

      const flush = () => {
        if (currentNormal.length > 0) {
          out += `<div class="cs-text-p">${renderLatexToHtml(escapeHtml(currentNormal.join('<br>')))}</div>`;
          currentNormal = [];
        }
        if (currentHighlight.length > 0) {
          out += `<div class="cs-yellow-box">${renderLatexToHtml(escapeHtml(currentHighlight.join('<br>')))}</div>`;
          currentHighlight = [];
          inHighlight = false;
        }
      };

      lines.forEach(l => {
        const trimmed = l.trim();
        if (!trimmed) return;
        const isEx = /^(exemple|exemples|مثال|أمثلة|propriété|propriétés|comment savoir|\d+\s+est-il)/i.test(trimmed);
        if (isEx) {
          flush();
          inHighlight = true;
          currentHighlight.push(trimmed);
        } else if (inHighlight) {
          if (/^[•\-*]\s+[A-Z\u0600-\u06FF]/.test(trimmed) && !/^(•\s*L'entier|•\s*Exemple)/i.test(trimmed)) {
            flush();
            currentNormal.push(trimmed);
          } else {
            currentHighlight.push(trimmed);
          }
        } else {
          currentNormal.push(trimmed);
        }
      });
      flush();
      contentHtml = out;
    }

    return `
      <div class="cs-section">
        ${titleHtml ? `<div class="cs-badge-header"><span>•</span> <span>${titleHtml}</span></div>` : ''}
        <div style="padding: 0 2px;">
          ${contentHtml}
        </div>
      </div>
    `;
  };

  return `<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(summaryTitle)}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css" />
  <style>
    @page {
      size: A4 landscape;
      margin: 6mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans Arabic', sans-serif;
    }
    .cs-frame {
      border: 2.5px solid #0070ba;
      background: #ffffff;
      padding: 5px;
      width: 100%;
    }
    .cs-header-grid {
      display: grid;
      grid-template-columns: 32% 36% 32%;
      gap: 5px;
      margin-bottom: 5px;
    }
    .cs-header-cell {
      border: 2px solid #0070ba;
      padding: 6px 8px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: #fffde7 !important;
      text-align: center;
    }
    .cs-header-center {
      background: #ffffff !important;
      border: 2px solid #0070ba;
      padding: 6px 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    .cs-columns-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      border: 2px solid #0070ba;
    }
    .cs-col {
      padding: 6px 8px;
    }
    .cs-col:not(:last-child) {
      border-right: 2px solid #0070ba;
    }
    .cs-section {
      margin-bottom: 10px;
    }
    .cs-badge-header {
      background: #bae6fd !important;
      color: #0f172a;
      padding: 3px 6px;
      font-weight: 800;
      font-size: 0.86rem;
      line-height: 1.3;
      margin-bottom: 5px;
      border-radius: 2px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .cs-text-p {
      font-size: 0.83rem;
      line-height: 1.4;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .cs-yellow-box {
      background-color: #ffff00 !important;
      border: 1px solid #ca8a04;
      padding: 5px 6px;
      margin: 5px 0;
      border-radius: 2px;
      font-size: 0.83rem;
      font-weight: 700;
      line-height: 1.38;
    }
    .katex {
      font-size: 1.05em;
    }
  </style>
</head>
<body>
  <div class="cs-frame">
    <div class="cs-header-grid">
      <div class="cs-header-cell">
        <div style="color: #005f73; font-weight: 800; font-size: 0.95rem;">${escapeHtml(profName)}</div>
        <div style="color: #0070ba; font-weight: 700; font-size: 0.82rem; margin-top: 2px;">${escapeHtml(website)}</div>
      </div>
      <div class="cs-header-center">
        <h1 style="margin: 0; color: #dc2626; font-size: 1.15rem; font-weight: 900; line-height: 1.3;">
          ${renderLatexToHtml(escapeHtml(summaryTitle))}
        </h1>
      </div>
      <div class="cs-header-cell">
        <div style="color: #047857; font-weight: 800; font-size: 0.92rem;">${escapeHtml(levelName)}</div>
        <div style="color: #0070ba; font-weight: 800; font-size: 0.88rem; margin-top: 2px;">${escapeHtml(schoolName)}</div>
      </div>
    </div>

    <div class="cs-columns-grid">
      ${columns.map(col => `
        <div class="cs-col">
          ${col.map(renderSectionHtml).join('')}
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>`;
};

export const openCourseSummaryPrintWindow = (data) => {
  const html = generateCourseSummaryHTML(data);
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 800);
  }
};
