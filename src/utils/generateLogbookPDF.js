import katex from 'katex';

const KATEX_OPTIONS = {
  strict: 'ignore',
  throwOnError: false,
  trust: false,
};

const esc = (s) => {
  if (typeof s !== 'string') return String(s ?? '');
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

const getLevelDisplayName = (levelKey, isArabic) => {
  const mapping = {
    'common_core_sci': {
      fr: 'Tronc Commun Scientifique',
      ar: 'جدع مشترك علوم'
    },
    'common_core_arts': {
      fr: 'Tronc Commun Lettres',
      ar: 'جدع مشترك آداب'
    },
    '1bac_sci': {
      fr: '1ère Bac Sciences',
      ar: 'أولى باك علوم'
    },
    '1bac_arts': {
      fr: '1ère Bac Lettres',
      ar: 'أولى باك آداب'
    },
    '2bac_sm': {
      fr: '2ème Bac Sciences Maths',
      ar: 'ثانية باك علوم رياضية'
    },
    '2bac_pc_svt': {
      fr: '2ème Bac PC/SVT',
      ar: 'ثانية باك علوم تجريبية'
    },
    '2bac_arts': {
      fr: '2ème Bac Lettres',
      ar: 'ثانية باك آداب'
    }
  };
  const match = mapping[levelKey];
  if (match) return isArabic ? match.ar : match.fr;
  return levelKey || '';
};

const LATEX_COMMAND_RE = /\\(?:lim|frac|dfrac|left|right|cdot|sqrt|sum|int|prod|infty|to|ln|log|exp|sin|cos|tan|arcsin|arccos|arctan|alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega|mathbb|mathcal|mathbf|mathrm|text|vec|hat|bar|tilde|overline|underline|widehat|widetilde|dot|ddot|pm|mp|times|div|cap|cup|in|notin|subset|supset|leq|geq|le|ge|neq|approx|equiv|sim|forall|exists|partial|nabla|rightarrow|leftarrow|Rightarrow|Leftarrow|Leftrightarrow|iff|implies|quad|qquad|ell|Re|Im|max|min|sup|inf|det|dim|ker|rank|mod|circ|bullet|star|oplus|otimes|begin|end)\b/;

function autoWrapLatex(text) {
  if (text.includes('$')) return text;
  if (/^\s*[\*\-+]\s+/.test(text) || text.includes('**') || /(?<!\*)\*[^*]+\*/.test(text)) {
    return text;
  }
  if (text.includes(' ')) {
    const words = text.split(/\s+/);
    const mathCommands = new Set(['sin', 'cos', 'tan', 'lim', 'log', 'ln', 'exp', 'max', 'min', 'det', 'dim', 'ker', 'mod']);
    for (const word of words) {
      if (/^[a-zA-Z]{3,}$/.test(word) && !mathCommands.has(word.toLowerCase())) {
        return text;
      }
    }
  }
  const mathWords = /\b(?:sqrt|pi|theta|infty|sin|cos|tan|ln|log|exp|lim)\b/i;
  const hasDivision = /\b\d+\s*\/\s*\d+\b/.test(text) || 
                      /\b[a-zA-Z0-9_]\s*\/\s*[a-zA-Z0-9(]/.test(text) ||
                      /\)\s*\/\s*[\d(a-zA-Z]/.test(text) ||
                      /[\d(a-zA-Z]\s*\/\s*\(/.test(text);

  if (/[\\^_{}]/.test(text) || 
      LATEX_COMMAND_RE.test(text) || 
      mathWords.test(text) || 
      text.includes('*') || 
      hasDivision) {
    return `$${text}$`;
  }
  return text;
}

function tokenizeMath(text) {
  const tokens = [];
  let i = 0;
  let buf = '';

  while (i < text.length) {
    if (text[i] === '$' && text[i + 1] === '$') {
      if (buf) { tokens.push({ type: 'text', content: buf }); buf = ''; }
      const start = i + 2;
      const end = text.indexOf('$$', start);
      if (end === -1) { buf += text.slice(i); i = text.length; }
      else { tokens.push({ type: 'block', content: text.slice(start, end) }); i = end + 2; }
      continue;
    }
    if (text[i] === '\\' && text[i + 1] === '$') { buf += '$'; i += 2; continue; }
    if (text[i] === '$') {
      let j = i + 1; let found = false;
      while (j < text.length) { if (text[j] === '\\') { j += 2; continue; } if (text[j] === '$') { found = true; break; } j++; }
      if (!found || j === i + 1) { buf += '$'; i++; }
      else { if (buf) { tokens.push({ type: 'text', content: buf }); buf = ''; } tokens.push({ type: 'inline', content: text.slice(i + 1, j) }); i = j + 1; }
      continue;
    }
    buf += text[i]; i++;
  }
  if (buf) tokens.push({ type: 'text', content: buf });
  return tokens;
}

const repairMathExpression = (latex) => {
  if (!latex) return '';
  let repaired = latex;
  repaired = repaired
    .replace(/(?<![a-zA-Z\\])pi\b/g, '\\pi')
    .replace(/(?<![a-zA-Z\\])theta\b/g, '\\theta')
    .replace(/(?<![a-zA-Z\\])infty\b/g, '\\infty')
    .replace(/(?<![a-zA-Z\\])sin\b/g, '\\sin')
    .replace(/(?<![a-zA-Z\\])cos\b/g, '\\cos')
    .replace(/(?<![a-zA-Z\\])tan\b/g, '\\tan')
    .replace(/(?<![a-zA-Z\\])ln\b/g, '\\ln')
    .replace(/(?<![a-zA-Z\\])log\b/g, '\\log')
    .replace(/(?<![a-zA-Z\\])exp\b/g, '\\exp')
    .replace(/(?<![a-zA-Z\\])lim\b/g, '\\lim');

  repaired = repaired.replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}');
  repaired = repaired.replace(/\^\(([^)]+)\)/g, '^{$1}');
  repaired = repaired.replace(/\*/g, '\\cdot');
  repaired = repaired.replace(/(?<![a-zA-Z0-9\\_])([a-zA-Z0-9\\_]+)\s*\/\s*\(([^)]+)\)/g, '\\frac{$1}{$2}');
  repaired = repaired.replace(/\(([^)]+)\)\s*\/\s*\(([^)]+)\)/g, '\\frac{$1}{$2}');
  repaired = repaired.replace(/\(([^)]+)\)\s*\/\s*([a-zA-Z0-9\\_]+)(?![a-zA-Z0-9\\_])/g, '\\frac{$1}{$2}');
  repaired = repaired.replace(/(?<![a-zA-Z0-9\\_])([a-zA-Z0-9\\_]+)\s*\/\s*([a-zA-Z0-9\\_]+)(?![a-zA-Z0-9\\_])/g, '\\frac{$1}{$2}');
  return repaired;
};

const renderInlineKatex = (latex) => {
  try {
    const repaired = repairMathExpression(latex);
    return katex.renderToString(repaired, { ...KATEX_OPTIONS, displayMode: false });
  }
  catch { return `<span style="font-style:italic;opacity:0.75">${esc(latex)}</span>`; }
};

const renderBlockKatex = (latex) => {
  try {
    const repaired = repairMathExpression(latex);
    return katex.renderToString(repaired, { ...KATEX_OPTIONS, displayMode: true });
  }
  catch { return `<span style="font-style:italic;opacity:0.75;display:block">${esc(latex)}</span>`; }
};

const renderLineContent = (text, isArabic) => {
  const toParse = autoWrapLatex(text);
  const tokens = tokenizeMath(toParse);
  const html = tokens.map((tok) => {
    if (tok.type === 'block') return renderBlockKatex(tok.content);
    if (tok.type === 'inline') return renderInlineKatex(tok.content);
    return esc(tok.content);
  }).join('');
  return html
    .replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([\s\S]+?)\*/g, '<em>$1</em>');
};

const startsWithArabic = (str) => {
  if (!str) return false;
  const clean = str.trim();
  if (!clean) return false;
  const cleanFormatting = clean.replace(/^[\*\s_#\-✏■›✏]+/, '').trim();
  if (!cleanFormatting) return false;
  const firstChar = cleanFormatting.charAt(0);
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(firstChar);
};

const getLineStyle = (raw, isHeader, index, totalLines, colors) => {
  const trimmed = raw.trim();
  if (trimmed === '') return { type: 'empty', text: '' };

  const line = raw.replace(/^•\s*/, '').trim();

  if ((raw.startsWith('===') && raw.endsWith('===')) || (isHeader && index === 0)) {
    return { type: 'chapter', text: line.replace(/===/g, '').trim() };
  }
  if (/^(I{1,3}|IV|V?I{0,3}|IX|X{0,3})\.\s+/i.test(line)) {
    return { type: 'axis', text: line };
  }
  if (/^\d+\.(\d+\.)*\s+/.test(line) || /^[a-zA-Z]\.\s+/.test(line)) {
    return { type: 'sub', text: line };
  }

  const lower = line.toLowerCase();
  const pedagKeywords = {
    activité: { color: '#d97706', bg: 'rgba(245,158,11,0.05)', label: '▸' },
    نشاط:     { color: '#d97706', bg: 'rgba(245,158,11,0.05)', label: '▸' },
    définition: { color: '#4f46e5', bg: 'rgba(79,70,229,0.05)', label: '▸' },
    تعريف:      { color: '#4f46e5', bg: 'rgba(79,70,229,0.05)', label: '▸' },
    propriété: { color: '#7c3aed', bg: 'rgba(124,58,237,0.05)', label: '▸' },
    خاصية:     { color: '#7c3aed', bg: 'rgba(124,58,237,0.05)', label: '▸' },
    théorème: { color: '#db2777', bg: 'rgba(219,39,119,0.05)', label: '▸' },
    مبرهنة:   { color: '#db2777', bg: 'rgba(219,39,119,0.05)', label: '▸' },
    remarque: { color: '#475569', bg: 'rgba(71,85,105,0.05)', label: '▸' },
    ملاحظة:   { color: '#475569', bg: 'rgba(71,85,105,0.05)', label: '▸' },
    application: { color: '#059669', bg: 'rgba(5,150,105,0.05)', label: '▸' },
    تطبيق:       { color: '#059669', bg: 'rgba(5,150,105,0.05)', label: '▸' },
    correction: { color: '#dc2626', bg: 'rgba(220,38,38,0.05)', label: '▸' },
    تصحيح:      { color: '#dc2626', bg: 'rgba(220,38,38,0.05)', label: '▸' },
    exemple: { color: '#0284c7', bg: 'rgba(2,132,199,0.05)', label: '▸' },
    مثال:    { color: '#0284c7', bg: 'rgba(2,132,199,0.05)', label: '▸' },
  };

  for (const [kw, style] of Object.entries(pedagKeywords)) {
    if (lower.startsWith(`**${kw}`) || lower.startsWith(kw)) {
      return { type: 'block', text: line, ...style };
    }
  }

  if (/^(exercice|تمرين)\s*n?°?\s*\d*/i.test(line)) {
    return { type: 'exercise', text: line };
  }

  return { type: 'bullet', text: line };
};

const renderActivityCellHTML = (content, isHeader, isArMode, styleConfig) => {
  if (!content) return '';
  const lines = content.split('\n');
  const gridLineHeight = styleConfig.gridLineHeight || 20;

  let html = `<div class="activities-wrapper" style="display:flex;flex-direction:column;gap:0px;">`;

  lines.forEach((raw, idx) => {
    const { type, text, color, bg } = getLineStyle(raw, isHeader, idx, lines.length, styleConfig);

    if (type === 'empty') {
      html += `<div style="min-height:${gridLineHeight}px;height:${gridLineHeight}px;"></div>`;
      return;
    }

    const isArabic = isArMode || startsWithArabic(text);
    const direction = isArabic ? 'rtl' : 'ltr';
    const align = isArabic ? 'right' : 'left';
    const font = isArabic ? styleConfig.arFont : styleConfig.frFont;

    const commonStyle = `direction:${direction};text-align:${align};font-family:'${font}',sans-serif;margin:0;line-height:${gridLineHeight}px;min-height:${gridLineHeight}px;box-sizing:border-box;`;

    if (type === 'chapter') {
      html += `<div style="${commonStyle}font-size:calc(${styleConfig.baseFontSize} * 1.35);font-weight:800;color:${styleConfig.colorChapter};text-transform:uppercase;display:flex;align-items:flex-end;justify-content:${isArabic ? 'center' : 'flex-start'};transform:translateY(3px);">${renderLineContent(text, isArabic)}</div>`;
    } 
    else if (type === 'axis') {
      const borderSide = direction === 'ltr' ? 'border-left' : 'border-right';
      html += `<div style="${commonStyle}font-size:calc(${styleConfig.baseFontSize} * 1.15);font-weight:700;color:${styleConfig.colorAxis};${borderSide}:3px solid ${styleConfig.colorAxis};padding-left:${direction === 'ltr' ? '0.65rem' : '0'};padding-right:${direction === 'rtl' ? '0.65rem' : '0'};display:flex;align-items:flex-end;transform:translateY(3px);">${renderLineContent(text, isArabic)}</div>`;
    } 
    else if (type === 'sub') {
      html += `<div style="${commonStyle}font-size:calc(${styleConfig.baseFontSize} * 1.05);font-weight:600;color:${styleConfig.colorInk};display:flex;align-items:center;gap:0.35rem;transform:translateY(3px);"><span style="color:#4f46e5;font-weight:900;">›</span><span>${renderLineContent(text, isArabic)}</span></div>`;
    } 
    else if (type === 'block') {
      const borderSide = direction === 'ltr' ? 'border-left' : 'border-right';
      html += `<div style="${commonStyle}font-size:${styleConfig.baseFontSize};font-weight:600;color:${color};background:${bg};${borderSide}:2px solid ${color};border-radius:0px;padding:0 0.55rem;display:flex;align-items:center;gap:0.3rem;transform:translateY(3px);">${renderLineContent(text, isArabic)}</div>`;
    } 
    else if (type === 'exercise') {
      const borderSide = direction === 'ltr' ? 'border-left' : 'border-right';
      html += `<div style="${commonStyle}font-size:${styleConfig.baseFontSize};font-weight:600;color:${styleConfig.colorExercise};background:rgba(217,119,6,0.04);${borderSide}:2px solid ${styleConfig.colorExercise};border-radius:0px;padding:0 0.55rem;display:flex;align-items:center;gap:0.3rem;transform:translateY(3px);"><span style="font-weight:900;">✏</span><span>${renderLineContent(text, isArabic)}</span></div>`;
    } 
    else {
      // Default bullet
      html += `<div style="${commonStyle}font-size:${styleConfig.baseFontSize};color:${styleConfig.colorInk};display:flex;align-items:center;gap:0.35rem;transform:translateY(3px);"><span style="color:#64748b;font-size:0.55rem;flex-shrink:0;">■</span><span style="flex:1;">${renderLineContent(text, isArabic)}</span></div>`;
    }
  });

  html += `</div>`;
  return html;
};

const getTranslatedComponent = (comp, isAr) => {
  if (!comp) return '';
  const map = {
    'Cours': isAr ? 'درس' : 'Cours',
    'Exercices': isAr ? 'تمارين' : 'Exercices',
    'Contrôle': isAr ? 'فرض' : 'Contrôle',
    'Activité': isAr ? 'نشاط' : 'Activité'
  };
  return comp.split(/\s*\+\s*/).map(c => map[c] || c).join(isAr ? ' + ' : ' + ');
};

const getAcademicYear = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  return month >= 9 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
};

export const generateLogbookHTML = (selectedClass, entries, profName, styleConfig = {}) => {
  const isArMode = selectedClass.language === 'ar';
  const academicYear = getAcademicYear();
  const dir = isArMode ? 'rtl' : 'ltr';
  const alignment = isArMode ? 'right' : 'left';
  const logoText = "L'CONQ";
  const titleText = isArMode ? "دفتر النصوص الإلكتروني" : "Cahier de Textes Électronique";
  
  const arFont = styleConfig.arFont || 'Cairo';
  const frFont = styleConfig.frFont || 'Outfit';
  const mainFont = isArMode ? arFont : frFont;
  
  const gridLineHeight = styleConfig.gridLineHeight || 20;

  // Build rows HTML
  const rowsHtml = entries.map(e => {
    const isHolidayOrAbsence = e.isHolidayEntry || e.isAbsenceEntry;
    
    // Determine cell borders and background for grid
    const cellClass = isHolidayOrAbsence ? 'normal-cell' : 'seyes-grid-cell';
    const signatureText = isHolidayOrAbsence ? '—' : (isArMode ? 'موقّع' : 'Signé');
    const signatureStyle = isHolidayOrAbsence ? 'color:#94a3b8;font-style:italic;' : 'color:#10b981;font-weight:bold;font-size:0.75rem;';

    const componentText = getTranslatedComponent(e.component, isArMode);

    return `
      <tr>
        <td style="width:11%;text-align:center;font-weight:800;color:#0f172a;border:1px solid #cbd5e1;padding:8px 6px;">
          ${new Date(e.date).toLocaleDateString('fr-FR')}
        </td>
        <td style="width:11%;text-align:center;font-weight:600;color:#475569;border:1px solid #cbd5e1;padding:8px 6px;font-size:0.8rem;">
          ${esc(e.time)}
        </td>
        <td style="width:12%;text-align:center;font-weight:700;color:#1e3a8a;border:1px solid #cbd5e1;padding:8px 6px;font-size:0.82rem;">
          <span class="comp-badge ${e.component.toLowerCase().includes('contrôle') ? 'contrôle' : ''}">${esc(componentText)}</span>
        </td>
        <td class="${cellClass}" style="width:54%;border:1px solid #cbd5e1;vertical-align:top;position:relative;text-align:${alignment};">
          ${isHolidayOrAbsence 
            ? `<div class="holiday-absence-banner ${e.isHolidayEntry ? 'holiday' : 'absence'}">${esc(e.customContent)}</div>`
            : renderActivityCellHTML(e.customContent, e.isHeaderSéance, isArMode, styleConfig)
          }
        </td>
        <td style="width:12%;text-align:center;border:1px solid #cbd5e1;vertical-align:middle;padding:8px 6px;${signatureStyle}">
          ${signatureText}
        </td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="${isArMode ? 'ar' : 'fr'}" dir="${dir}">
<head>
  <meta charset="utf-8">
  <title>${esc(selectedClass.name)} - ${esc(titleText)}</title>
  
  <!-- Modern fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Outfit:wght@400;500;600;700;800;900&family=Amiri:ital,wght@0,400;0,700;1,400&family=Noto+Naskh+Arabic:wght@400;700&display=swap" rel="stylesheet">
  
  <!-- KaTeX CSS -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">

  <style>
    /* A4 Portrait dimensions & base resets */
    @page {
      size: A4 portrait;
      margin: 15mm 12mm 15mm 12mm;
    }
    
    * {
      box-sizing: border-box;
    }
    
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
      font-family: '${mainFont}', 'Cairo', 'Outfit', sans-serif;
      font-size: 13px;
      line-height: 1.4;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .print-page-wrapper {
      max-width: 210mm;
      margin: 0 auto;
      background: #ffffff;
    }

    /* Print Hint Toast */
    .print-hint {
      position: fixed;
      top: 15px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #1e1b4b 0%, #311042 100%);
      color: #ffffff;
      padding: 10px 24px;
      border-radius: 30px;
      font-size: 0.85rem;
      font-weight: 700;
      box-shadow: 0 10px 25px rgba(0,0,0,0.25);
      z-index: 99999;
      display: flex;
      align-items: center;
      gap: 10px;
      border: 1px solid rgba(255,255,255,0.15);
      animation: slideDownHint 0.4s ease;
    }
    @media print {
      .print-hint {
        display: none !important;
      }
    }
    @keyframes slideDownHint {
      from { top: -50px; opacity: 0; }
      to { top: 15px; opacity: 1; }
    }

    /* =========================================================================
       PREMIUM OFFICIAL HEADER (ذو رأس راقي)
       ========================================================================= */
    .official-header {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-family: 'Cairo', 'Outfit', sans-serif;
      direction: ${dir};
    }
    
    .official-header td {
      border: none !important;
      padding: 0 !important;
      vertical-align: top;
    }

    /* Ministry block */
    .header-dept-block {
      width: 33%;
      font-size: 8.5px;
      line-height: 1.4;
      font-weight: 700;
      color: #334155;
      text-align: ${isArMode ? 'right' : 'left'};
    }
    .header-dept-block span {
      display: block;
    }

    /* Middle Emblem & Document Title */
    .header-center-block {
      width: 34%;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 5px 0;
    }
    .header-emblem-text {
      font-size: 1.7rem;
      font-weight: 950;
      letter-spacing: -0.04em;
      background: linear-gradient(135deg, #1e3a8a, #4f46e5);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin: 0 0 2px 0;
    }
    .header-document-title {
      font-size: 11px;
      font-weight: 800;
      color: #0f172a;
      border: 1.5px solid #0f172a;
      padding: 3px 12px;
      border-radius: 6px;
      background: #f8fafc;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 4px;
    }

    /* Coordinates details block */
    .header-coords-block {
      width: 33%;
      font-size: 9px;
      font-weight: 700;
      text-align: ${isArMode ? 'left' : 'right'};
      line-height: 1.5;
      color: #0f172a;
    }
    .coord-item {
      display: block;
    }
    .coord-value {
      font-weight: 800;
      color: #1e3a8a;
    }

    /* Metadata Badge Grid under header */
    .coords-badge-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1px;
      background: #cbd5e1;
      border: 1px solid #94a3b8;
      border-radius: 6px;
      overflow: hidden;
      margin-top: 10px;
      margin-bottom: 25px;
      font-size: 11px;
      direction: ${dir};
    }
    .coords-badge-cell {
      background: #f8fafc;
      padding: 6px 10px;
      text-align: center;
    }
    .coords-badge-label {
      font-size: 8px;
      color: #64748b;
      font-weight: 800;
      display: block;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .coords-badge-val {
      font-weight: 900;
      color: #0f172a;
    }

    /* =========================================================================
       TABLE STYLING
       ========================================================================= */
    .logbook-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #0f172a !important;
      font-family: inherit;
    }

    .logbook-table th {
      border: 1.5px solid #0f172a !important;
      background: #0f172a !important;
      color: #ffffff !important;
      padding: 10px 8px !important;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      text-align: center;
      print-color-adjust: exact !important;
      -webkit-print-color-adjust: exact !important;
    }

    /* Repeating print page header row inside thead */
    .print-page-header-row th {
      background: #f8fafc !important;
      color: #0f172a !important;
      border-bottom: 1.5px solid #0f172a !important;
      padding: 10px 16px !important;
    }

    .logbook-table td {
      border: 1px solid #cbd5e1 !important;
      color: #0f172a;
      font-size: 12px;
    }

    .logbook-table tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    .comp-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      background: rgba(59, 130, 246, 0.08);
      border: 1px solid rgba(59, 130, 246, 0.15);
      color: #1e3a8a;
      font-weight: 800;
    }
    .comp-badge.contrôle {
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.15);
      color: #b91c1c;
    }

    /* Seyes-like squared notebook lines background */
    .seyes-grid-cell {
      background-color: #ffffff;
      background-image: 
        linear-gradient(rgba(186, 230, 253, 0.5) 1px, transparent 1px);
      background-size: 100% ${gridLineHeight}px;
      padding: ${gridLineHeight}px 12px !important;
      line-height: ${gridLineHeight}px !important;
      vertical-align: top;
      position: relative;
    }
    .seyes-grid-cell * {
      background: transparent !important;
    }
    
    .normal-cell {
      padding: 12px 14px !important;
      vertical-align: middle;
      background-color: #fafbfc !important;
    }

    /* Holiday & Absence banner blocks */
    .holiday-absence-banner {
      width: 100%;
      text-align: center;
      font-weight: 800;
      font-size: 11px;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px dashed;
      line-height: 1.5;
    }
    .holiday-absence-banner.holiday {
      color: #15803d;
      background: rgba(22, 163, 74, 0.05);
      border-color: rgba(22, 163, 74, 0.25);
    }
    .holiday-absence-banner.absence {
      color: #b91c1c;
      background: rgba(220, 38, 38, 0.05);
      border-color: rgba(220, 38, 38, 0.25);
    }

    /* =========================================================================
       SIGNATURE BLOCKS AT BOTTOM
       ========================================================================= */
    .signatures-block {
      margin-top: 35px;
      width: 100%;
      border-spacing: 12px 0;
      border-collapse: separate;
    }
    
    .signatures-block td {
      border: 1px dashed #cbd5e1 !important;
      border-radius: 8px;
      padding: 12px;
      text-align: center;
      background: #f8fafc !important;
      width: 33%;
      vertical-align: top;
    }
    
    .signature-title {
      font-weight: 800;
      font-size: 11px;
      color: #0f172a;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .signature-teacher-name {
      font-size: 11px;
      color: #1e3a8a;
      font-weight: 800;
      margin-top: 15px;
      margin-bottom: 5px;
    }
    .signature-dots {
      font-size: 11px;
      color: #94a3b8;
      margin-top: 45px;
    }

    .fiche-footer {
      margin-top: 40px;
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
      text-align: center;
      font-size: 8px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* Hide elements in print dialog */
    @media print {
      .print-hint {
        display: none !important;
      }
      body {
        margin: 0;
        padding: 0;
      }
    }
  </style>
</head>
<body>

  <!-- Screen Top Notification -->
  <div id="printHint" class="print-hint">
    <span>💡</span>
    <span>
      ${isArMode 
        ? "اضغط على Ctrl+P للطباعة. تأكد من تمكين 'خيارات الخلفية' (Background Graphics) للحصول على أفضل جودة للشبكة والألوان." 
        : "Appuyez sur Ctrl+P pour lancer l'impression. Activez 'Graphismes d'arrière-plan' pour imprimer les couleurs et la grille."
      }
    </span>
  </div>

  <div class="print-page-wrapper">
    
    <!-- ── OFFICIAL TOP HEADER (First Page Only) ── -->
    <table class="official-header">
      <tr>
        <!-- Left: Ministry (AR or FR depending on locale) -->
        <td class="header-dept-block">
          ${isArMode ? `
            <span>المملكة المغربية</span>
            <span>وزارة التربية الوطنية والتعليم الأولي والرياضة</span>
            <span>الأكاديمية الجهوية للتربية والتكوين</span>
            <span>مؤسسة التميز للتعليم الخصوصي</span>
          ` : `
            <span>Royaume du Maroc</span>
            <span>Ministère de l'Éducation Nationale, du Préscolaire et des Sports</span>
            <span>Académie Régionale de l'Éducation et de la Formation</span>
            <span>Établissement L'CONQ d'Excellence</span>
          `}
        </td>
        
        <!-- Center Emblem / Logo & Title -->
        <td class="header-center-block">
          <span style="font-family:'Outfit',sans-serif;" class="header-emblem-text">${logoText}</span>
          <div class="header-document-title">
            ${isArMode ? 'دفتر النصوص الإلكتروني' : 'Cahier de Textes'}
          </div>
        </td>
        
        <!-- Right: Print Metadata Coordinates -->
        <td class="header-coords-block">
          <span class="coord-item">
            ${isArMode ? 'السنة الدراسية: ' : 'Année Scolaire : '}
            <span class="coord-value">${academicYear}</span>
          </span>
          <span class="coord-item">
            ${isArMode ? 'تاريخ الاستخراج: ' : 'Date d\'impression : '}
            <span class="coord-value">${new Date().toLocaleDateString('fr-FR')}</span>
          </span>
          <span class="coord-item">
            ${isArMode ? 'البرنامج المستعمل: ' : 'Généré via : '}
            <span class="coord-value" style="color:#4f46e5;">L'CONQ OS 2026</span>
          </span>
        </td>
      </tr>
    </table>

    <!-- ── BADGES GRID COORDINATES ── -->
    <div class="coords-badge-grid">
      <div class="coords-badge-cell">
        <span class="coords-badge-label">${isArMode ? 'المستوى' : 'Niveau'}</span>
        <span class="coords-badge-val">${esc(getLevelDisplayName(selectedClass.level, isArMode))}</span>
      </div>
      <div class="coords-badge-cell">
        <span class="coords-badge-label">${isArMode ? 'القسم / الفوج' : 'Classe / Groupe'}</span>
        <span class="coords-badge-val" style="color:#4f46e5;">${esc(selectedClass.name)}</span>
      </div>
      <div class="coords-badge-cell">
        <span class="coords-badge-label">${isArMode ? 'المادة الدراسية' : 'Matière'}</span>
        <span class="coords-badge-val" style="color:#10b981;">${esc(selectedClass.subject || (isArMode ? 'الرياضيات' : 'Mathématiques'))}</span>
      </div>
      <div class="coords-badge-cell">
        <span class="coords-badge-label">${isArMode ? 'الأستاذ المؤطر' : 'Enseignant'}</span>
        <span class="coords-badge-val">${esc(profName || 'Professeur')}</span>
      </div>
    </div>

    <!-- ── MAIN LOGBOOK TIMELINE TABLE ── -->
    <table class="logbook-table">
      <thead>
        
        <!-- Print-only page header repeating row inside table -->
        <tr class="print-page-header-row">
          <th colspan="5">
            <div style="display:flex;justify-content:space-between;align-items:center;width:100%;font-family:'Outfit','Cairo',sans-serif;direction:${dir};">
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="color:#ffffff;background:#4f46e5;font-weight:900;font-size:0.8rem;padding:2px 6px;border-radius:4px;">${logoText}</span>
                <span style="color:#334155;font-size:0.75rem;font-weight:700;margin-left:5px;">| ${isArMode ? 'دفتر النصوص المنجزة' : 'Cahier de Textes'}</span>
              </div>
              <div style="display:flex;gap:20px;font-size:0.78rem;font-weight:800;color:#0f172a;">
                <div>
                  <span style="color:#64748b;font-weight:700;">${isArMode ? 'القسم:' : 'Classe :'}</span>
                  <span style="${isArMode ? 'margin-right:4px;' : 'margin-left:4px;'}color:#1e3a8a;background:rgba(30,58,138,0.06);padding:1px 6px;border-radius:4px;">${esc(selectedClass.name)}</span>
                </div>
                <div>
                  <span style="color:#64748b;font-weight:700;">${isArMode ? 'المادة:' : 'Matière :'}</span>
                  <span style="${isArMode ? 'margin-right:4px;' : 'margin-left:4px;'}color:#10b981;background:rgba(16,185,129,0.06);padding:1px 6px;border-radius:4px;">${esc(selectedClass.subject || (isArMode ? 'الرياضيات' : 'Mathématiques'))}</span>
                </div>
              </div>
            </div>
          </th>
        </tr>

        <!-- Column Headers -->
        <tr>
          <th style="width:11%;">${isArMode ? 'التاريخ' : 'Date'}</th>
          <th style="width:11%;">${isArMode ? 'التوقيت' : 'Horaire'}</th>
          <th style="width:12%;">${isArMode ? 'المكون' : 'Composant'}</th>
          <th style="width:54%;text-align:${alignment};">${isArMode ? 'طبيعة الأنشطة والدروس المنجزة تفصيلاً' : 'Nature des activités réalisées'}</th>
          <th style="width:12%;">${isArMode ? 'توقيع المراقبة' : 'Signature'}</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <!-- ── SIGNATURES BLOCK ── -->
    <table class="signatures-block">
      <tr>
        <td>
          <div class="signature-title">${isArMode ? 'توقيع المفتش التربوي' : 'Signature de l\'Inspecteur'}</div>
          <div class="signature-dots">..........................................</div>
        </td>
        <td>
          <div class="signature-title">${isArMode ? 'توقيع رئيس المؤسسة' : 'Signature du Directeur'}</div>
          <div class="signature-dots">..........................................</div>
        </td>
        <td>
          <div class="signature-title">${isArMode ? 'توقيع الأستاذ المؤطر' : 'Signature de l\'Enseignant'}</div>
          <div class="signature-teacher-name">${esc(profName || 'Professeur')}</div>
          <div class="signature-dots" style="margin-top:10px;">..........................................</div>
        </td>
      </tr>
    </table>

    <!-- ── FOOTER CORPORATE BRAND ── -->
    <div class="fiche-footer">
      © ${new Date().getFullYear()} ${logoText} • SYSTEM OF ACADEMIC EXCELLENCE • ALL RIGHTS RESERVED
    </div>

  </div>

  <script>
    async function printNow() {
      // Wait for math equations & Google Fonts to load
      await document.fonts.ready;
      await new Promise(r => setTimeout(r, 800));
      
      const hint = document.getElementById('printHint');
      if (hint) hint.style.display = 'none';
      
      window.print();
      
      if (hint) {
        setTimeout(() => {
          hint.style.display = 'flex';
        }, 1000);
      }
    }
    printNow();
  </script>
</body>
</html>
  `;
};

export const openLogbookPrintWindow = (selectedClass, entries, profName, styleConfig = {}) => {
  const html = generateLogbookHTML(selectedClass, entries, profName, styleConfig);
  const title = `Cahier_de_textes_${selectedClass.name.replace(/\s+/g, '_')}`;

  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768;

  if (isMobile) {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'width=960,height=720,scrollbars=yes');
  if (!win) {
    URL.revokeObjectURL(url);
    alert('Veuillez autoriser les popups pour ce site.');
    return;
  }
  win.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
};
