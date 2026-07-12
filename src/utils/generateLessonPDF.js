import katex from 'katex';

/* ── RTL mode flag — set per render call ── */
let _rtlMode = false;

/* ── Level key to display name mapping ── */
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

/* ── Math renderer: same tokenizer as generateExamPDF.js ── */
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

const LATEX_COMMAND_RE = /\\(?:lim|frac|dfrac|left|right|cdot|sqrt|sum|int|prod|infty|to|ln|log|exp|sin|cos|tan|arcsin|arccos|arctan|alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega|mathbb|mathcal|mathbf|mathrm|text|vec|hat|bar|tilde|overline|underline|widehat|widetilde|dot|ddot|pm|mp|times|div|cap|cup|in|notin|subset|supset|leq|geq|le|ge|neq|approx|equiv|sim|forall|exists|partial|nabla|rightarrow|leftarrow|Rightarrow|Leftarrow|Leftrightarrow|iff|implies|quad|qquad|ell|Re|Im|max|min|sup|inf|det|dim|ker|rank|mod|circ|bullet|star|oplus|otimes|begin|end)\b/;

function autoWrapLatex(text) {
  if (text.includes('$')) return text;
  
  // Don't auto-wrap if it's a markdown bullet point or contains markdown bold/italic
  if (/^\s*[\*\-+]\s+/.test(text) || text.includes('**') || /(?<!\*)\*[^*]+\*/.test(text)) {
    return text;
  }
  
  // Check if it looks like a sentence (contains spaces and regular alphabetic words)
  if (text.includes(' ')) {
    const words = text.split(/\s+/);
    const mathCommands = new Set(['sin', 'cos', 'tan', 'lim', 'log', 'ln', 'exp', 'max', 'min', 'det', 'dim', 'ker', 'mod']);
    for (const word of words) {
      if (/^[a-zA-Z]{3,}$/.test(word) && !mathCommands.has(word.toLowerCase())) {
        return text; // Do not wrap sentences!
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
  
  // 1. Repair missing backslashes for Greek letters and standard functions
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

  // 2. Convert sqrt(xxx) to \sqrt{xxx}
  repaired = repaired.replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}');
  
  // Convert parenthesized powers ^(xxx) to ^{xxx}
  repaired = repaired.replace(/\^\(([^)]+)\)/g, '^{$1}');
  
  // 3. Convert multiplication asterisk * to \cdot
  repaired = repaired.replace(/\*/g, '\\cdot');
  
  // 4. Convert division slashes to textbook fractions (\frac)
  // Case A: number/var / (expr) -> \frac{number/var}{expr}
  repaired = repaired.replace(/(?<![a-zA-Z0-9\\_])([a-zA-Z0-9\\_]+)\s*\/\s*\(([^)]+)\)/g, '\\frac{$1}{$2}');
  
  // Case B: (expr) / (expr) -> \frac{expr}{expr}
  repaired = repaired.replace(/\(([^)]+)\)\s*\/\s*\(([^)]+)\)/g, '\\frac{$1}{$2}');
  
  // Case C: (expr) / number/var -> \frac{expr}{number/var}
  repaired = repaired.replace(/\(([^)]+)\)\s*\/\s*([a-zA-Z0-9\\_]+)(?![a-zA-Z0-9\\_])/g, '\\frac{$1}{$2}');
  
  // Case D: number/var / number/var -> \frac{number/var}{number/var}
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

const renderTextWithBold = (text) => {
  let html = esc(text);
  html = html.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([\s\S]+?)\*/g, '<em>$1</em>');
  return html;
};

const renderLineContent = (text) => {
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

const repairCorruptedLatex = (text) => {
  if (!text) return text;
  return text
    .replace(/(?<![a-zA-Z\\])ight\b/g, '\\right')
    .replace(/(?<!\\)right\b/g, '\\right')
    .replace(/(?<!\\)left\b/g, '\\left')
    // Replace "frac{" (not preceded by letter/backslash) with "\frac{"
    .replace(/(?<![a-zA-Z\\])frac\{/g, '\\frac{')
    // Replace "dfrac{" (not preceded by letter/backslash) with "\dfrac{"
    .replace(/(?<![a-zA-Z\\])dfrac\{/g, '\\dfrac{')
    // Replace "rac{" (not preceded by letter/backslash) with "\frac{" (in case f was stripped as form feed)
    .replace(/(?<![a-zA-Z\\])rac\{/g, '\\frac{');
};

const renderLine = (line) => {
  const cleaned = line.replace(/\t/g, ' ')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/ {2,}/g, ' ')
    .trim();
  if (!cleaned) return '';

  // Bare LaTeX block: Line starts with \ and does not contain $
  if (cleaned.startsWith('\\') && !cleaned.includes('$')) {
    return renderBlockKatex(repairCorruptedLatex(cleaned));
  }

  // Markdown Headings: ### ## #
  if (/^###\s+/.test(cleaned)) {
    const text = cleaned.replace(/^###\s+/, '');
    return `<div style="font-weight:800;font-size:0.95rem;color:#005086;border-bottom:1px solid rgba(0,80,134,0.15);padding-bottom:0.25rem;margin:0.75rem 0 0.4rem">${renderLineContent(text)}</div>`;
  }
  if (/^##\s+/.test(cleaned)) {
    const text = cleaned.replace(/^##\s+/, '');
    return `<div style="font-weight:900;font-size:1.05rem;color:#005086;border-bottom:1.5px solid rgba(0,80,134,0.2);padding-bottom:0.3rem;margin:1rem 0 0.5rem">${renderLineContent(text)}</div>`;
  }
  if (/^#\s+/.test(cleaned)) {
    const text = cleaned.replace(/^#\s+/, '');
    return `<div style="font-weight:900;font-size:1.2rem;color:#005086;border-bottom:2px solid rgba(0,80,134,0.3);padding-bottom:0.4rem;margin:1rem 0 0.6rem">${renderLineContent(text)}</div>`;
  }

  // Response Block
  if (cleaned.toLowerCase().startsWith('**réponse') || cleaned.toLowerCase().startsWith('réponse') ||
      cleaned.toLowerCase().startsWith('**reponse') || cleaned.toLowerCase().startsWith('reponse')) {
    const contentText = cleaned.replace(/^(\*\*)?r[eé]ponse\s*:?\s*/i, '').replace(/\*\*$/, '');
    return `<span style="display:block;line-height:1.75"><strong>Réponse :</strong> ${renderLineContent(contentText)}</span>`;
  }

  // Attention Block
  if (cleaned.toLowerCase().startsWith('**attention') || cleaned.toLowerCase().startsWith('attention')) {
    const contentText = cleaned.replace(/^(\*\*)?attention\s*:?\s*/i, '').replace(/\*\*$/, '');
    return `<span style="display:block;line-height:1.75"><strong>Attention :</strong> ${renderLineContent(contentText)}</span>`;
  }

  // Step Block
  const stepRegex = /^(\*\*)?(Étape|Step|الخطوة)\s*(\d+)\s*(?:—|-|:)?\s*(.*)$/i;
  const stepMatch = cleaned.match(stepRegex);
  if (stepMatch) {
    const stepLabel = stepMatch[2];
    const stepNum = stepMatch[3];
    const stepText = stepMatch[4].replace(/\*\*$/, '');
    const formattedLabel = stepLabel.toLowerCase().includes('خطوة') ? `الخطوة ${stepNum}` : `${stepLabel} ${stepNum}`;
    return `<span style="display:block;line-height:1.75;margin-top:0.5rem"><strong>${formattedLabel} :</strong> ${stepText ? renderLineContent(stepText) : ''}</span>`;
  }

  // Markdown unordered list: - item or • item
  if (/^[-•]\s+/.test(cleaned) || (/^\*\s+/.test(cleaned) && !cleaned.startsWith('**'))) {
    const text = cleaned.replace(/^[-•*]\s+/, '');
    if (_rtlMode) {
      return `<div style="display:flex;align-items:flex-start;flex-direction:row;gap:0.4rem;margin:0.2rem 0;line-height:1.7;text-align:right">
        <span style="color:#005086;font-weight:800;flex-shrink:0;margin-top:0.05em">•</span>
        <span style="flex:1;direction:rtl;text-align:right">${renderLineContent(text)}</span>
      </div>`;
    }
    return `<div style="display:flex;align-items:flex-start;gap:0.5rem;margin:0.2rem 0;line-height:1.7">
      <span style="color:#005086;font-weight:800;flex-shrink:0;margin-top:0.05em">•</span>
      <span style="flex:1">${renderLineContent(text)}</span>
    </div>`;
  }

  // Markdown numbered list: 1. or 1)
  const numberedMatch = cleaned.match(/^(\d+)[.)]/); 
  if (numberedMatch && /^\d+[.)\s]/.test(cleaned)) {
    const num = numberedMatch[1];
    const text = cleaned.replace(/^\d+[.)\s]+/, '');
    if (_rtlMode) {
      return `<div style="display:flex;align-items:flex-start;flex-direction:row;gap:0.4rem;margin:0.2rem 0;line-height:1.7;text-align:right">
        <span style="color:#005086;font-weight:800;flex-shrink:0;min-width:1.4em;text-align:center">${num}.</span>
        <span style="flex:1;direction:rtl;text-align:right">${renderLineContent(text)}</span>
      </div>`;
    }
    return `<div style="display:flex;align-items:flex-start;gap:0.5rem;margin:0.2rem 0;line-height:1.7">
      <span style="color:#005086;font-weight:800;flex-shrink:0;min-width:1.4em">${num}.</span>
      <span style="flex:1">${renderLineContent(text)}</span>
    </div>`;
  }

  if (_rtlMode) {
    return `<span style="display:block;line-height:1.75;direction:rtl;text-align:right">${renderLineContent(cleaned)}</span>`;
  }
  return `<span style="display:block;line-height:1.75">${renderLineContent(cleaned)}</span>`;
};

const extractTablesAndText = (text) => {
  if (!text) return [];
  const lines = text.split('\n');
  const segments = [];
  let currentTextLines = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Check if it's the start of a table
    if (line.startsWith('|') && line.endsWith('|') && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      if (nextLine.startsWith('|') && nextLine.endsWith('|') && /^[|\-:\s]+$/.test(nextLine)) {
        // First push any accumulated text segment
        if (currentTextLines.length > 0) {
          segments.push({ type: 'text', content: currentTextLines.join('\n') });
          currentTextLines = [];
        }
        
        // Accumulate all consecutive table rows
        const headerRow = line;
        const separatorRow = nextLine;
        const dataRows = [];
        i += 2;
        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          dataRows.push(lines[i].trim());
          i++;
        }
        
        segments.push({
          type: 'table',
          headerRow,
          separatorRow,
          dataRows
        });
        continue;
      }
    }
    
    currentTextLines.push(lines[i]);
    i++;
  }
  
  if (currentTextLines.length > 0) {
    segments.push({ type: 'text', content: currentTextLines.join('\n') });
  }
  
  return segments;
};

const renderTableSegmentHTML = (segment) => {
  const parseRowCells = (rowText) => {
    const cells = rowText.split('|').map(c => c.trim());
    if (cells[0] === '') cells.shift();
    if (cells[cells.length - 1] === '') cells.pop();
    return cells;
  };
  
  const headerCells = parseRowCells(segment.headerRow);
  const sepCells = parseRowCells(segment.separatorRow);
  
  const alignments = sepCells.map(cell => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    return 'left';
  });
  
  const headerHtml = `
    <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
      ${headerCells.map((cell, idx) => `
        <th style="padding: 14px 22px; border: 1px solid #cbd5e1; font-weight: 800; color: #005086; text-align: ${alignments[idx] || 'center'};">
          ${renderLineContent(cell)}
        </th>
      `).join('')}
    </tr>`;
    
  const rowsHtml = segment.dataRows.map((row, rIdx) => {
    const cells = parseRowCells(row);
    const isAlt = rIdx % 2 === 1 ? 'background-color: #f8fafc;' : 'background-color: #ffffff;';
    return `
      <tr style="${isAlt}">
        ${cells.map((cell, idx) => `
          <td style="padding: 14px 22px; border: 1px solid #cbd5e1; text-align: ${alignments[idx] || 'center'}; color: #334155;">
            ${renderLineContent(cell)}
          </td>
        `).join('')}
      </tr>`;
  }).join('');
  
  return `
    <div style="display: flex; justify-content: center; margin: 2rem 0; width: 100%;">
      <table style="border-collapse: collapse; min-width: 70%; max-width: 100%; border: 1px solid #cbd5e1; font-size: 1.15rem; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.04); border-radius: 12px; overflow: hidden; background: #ffffff;">
        <thead>
          ${headerHtml}
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>`;
};

const renderMath = (text) => {
  if (text === null || text === undefined) return '';
  
  // Unify literal '\\n' and CRLF newlines first to split correctly
  let rawText = String(text)
    .replace(/\\n(?![a-zA-Z])/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const lines = rawText.split('\n');
  const mergedLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Match prefix like "1.", "a)", "B.", "**1.**", "**a)**" on its own line
    if (/^(\*\*)?([a-zA-Z]|\d+)[.)](\*\*)?$/.test(line) && i + 1 < lines.length) {
      let nextNonEmptyIdx = i + 1;
      while (nextNonEmptyIdx < lines.length && lines[nextNonEmptyIdx].trim() === '') {
        nextNonEmptyIdx++;
      }
      if (nextNonEmptyIdx < lines.length) {
        mergedLines.push(line + ' ' + lines[nextNonEmptyIdx].trim());
        i = nextNonEmptyIdx;
        continue;
      }
    }
    mergedLines.push(lines[i]);
  }
  rawText = mergedLines.join('\n');

  const repaired = repairCorruptedLatex(rawText);
  const raw = repaired;
  if (!raw.trim()) return '';

  const segments = extractTablesAndText(raw);
  
  if (segments.length === 1 && segments[0].type === 'text') {
    return renderMathInternal(segments[0].content);
  }
  
  return segments.map(seg => {
    if (seg.type === 'table') {
      return renderTableSegmentHTML(seg);
    }
    return renderMathInternal(seg.content);
  }).join('');
};

const renderMathInternal = (text) => {
  if (text === null || text === undefined) return '';
  const repaired = text;
  if (!repaired.trim()) return '';

  // Image shorthand
  if (repaired.trim().startsWith('img:')) {
    const url = repaired.trim().slice(4).trim();
    return `<div style="text-align:center;margin:0.5rem 0"><img src="${url}" alt="" style="max-width:100%;max-height:200px;border-radius:8px;object-fit:contain" /></div>`;
  }

  // SVG shorthand (for physics/chemistry curves, graphs, and schemas)
  if (repaired.trim().startsWith('svg:')) {
    const svgCode = repaired.trim().slice(4).trim();
    return `<div style="display:flex;justify-content:center;align-items:center;margin:0.5rem 0;width:100%;overflow-x:auto;">${svgCode}</div>`;
  }

  // Normalize line endings & escaped \n → real newlines (outside math blocks only)
  let normalised = repaired.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  normalised = normalised.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g)
    .map((part, idx) => {
      if (idx % 2 === 1) return part; // inside math — leave as-is
      let p = part.replace(/\\n(?![a-zA-Z])/g, '\n');
      
      // Force line break after period followed by space and uppercase letter/backslash/math delimiter
      // NOTE: exclude when preceded by a digit (numbered list item like "1. Calculer")
      p = p.replace(/(?<!\d|^|\n|\b\d\.[a-zA-Z]|\bex|\betc|\bvs)\.\s+([A-ZÀ-ÖØ-ß]|\\|\$)/g, '.\n$1');

      // Force line break before Step / Response / Attention blocks
      if (idx > 0) p = p.replace(/^\s*(\*\*)?(étape|etape|step|الخطوة)\b/gi, '\n$1$2');
      p = p.replace(/(?<=[.!?$;:\-)\]}»*])\s+(\*\*)?(étape|etape|step|الخطوة)\b/gi, '\n$1$2');
      if (idx > 0) p = p.replace(/^\s*(\*\*)?(réponse|reponse|attention)\b/gi, '\n$1$2');
      p = p.replace(/(?<=[.!?$;:\-)\]}»*])\s+(\*\*)?(réponse|reponse|attention)\b/gi, '\n$1$2');
      return p;
    }).join('');

  const tokens = tokenizeMath(normalised);

  let lines = [[]];
  for (const tok of tokens) {
    if (tok.type === 'block') {
      if (lines[lines.length - 1].length > 0) {
        lines.push([]);
      }
      lines[lines.length - 1].push(tok);
      lines.push([]);
    } else if (tok.type === 'inline') {
      lines[lines.length - 1].push(tok);
    } else {
      const parts = tok.content.split('\n');
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          lines.push([]);
        }
        if (parts[i]) {
          lines[lines.length - 1].push({ type: 'text', content: parts[i] });
        }
      }
    }
  }

  let html = '';
  for (const lineTokens of lines) {
    if (lineTokens.length === 0) continue;

    if (lineTokens.length === 1 && lineTokens[0].type === 'block') {
      html += renderBlockKatex(lineTokens[0].content);
      continue;
    }

    const reconstructedLine = lineTokens.map(t => {
      if (t.type === 'inline') return `$${t.content}$`;
      if (t.type === 'block') return `$$${t.content}$$`;
      return t.content;
    }).join('');
    
    html += renderLine(reconstructedLine);
  }

  return html || '';
};


/* ── Parse exercise title helper ── */
const parseExerciseTitle = (title, fallbackIdx, isArabicMode = false) => {
  if (!title) return { number: String(fallbackIdx + 1), label: '' };
  let clean = title.trim();

  // Handle Arabic titles: "تمرين 1" or "تمرين: 1"
  if (isArabicMode || /^\u062a\u0645\u0631\u064a\u0646/.test(clean)) {
    const arabicMatch = clean.match(/^\u062a\u0645\u0631\u064a\u0646[:\s]*([\d١-٩]+)\s*(.*)$/);
    if (arabicMatch) {
      return { number: arabicMatch[1], label: arabicMatch[2].trim() };
    }
    // fallback: extract any number from the title
    const numMatch = clean.match(/([\d]+)/);
    return { number: numMatch ? numMatch[1] : String(fallbackIdx + 1), label: '' };
  }

  // Original French parsing
  const prefixMatch = clean.match(/^Exercice\s*(?:N?°|N)?\s*/i);
  if (prefixMatch) clean = clean.substring(prefixMatch[0].length).trim();
  const match = clean.match(/^([0-9a-zA-Z\s]+)(.*)$/);
  if (match) {
    const number = match[1].trim();
    let label = match[2].trim().replace(/^[:\-–—\s]+/, '').trim();
    return { number: number || String(fallbackIdx + 1), label };
  }
  return { number: clean || String(fallbackIdx + 1), label: '' };
};

/* ── Render Devoir Surveillé homework body with barème ── */
const renderHomeworkBody = (text, isArabicMode) => {
  if (text === null || text === undefined) return '';

  let rawText = String(text)
    .replace(/\\n(?![a-zA-Z])/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const lines = rawText.split('\n');
  const mergedLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^(\*\*)?([a-zA-Z]|\d+)[.)](\*\*)?$/.test(line) && i + 1 < lines.length) {
      let nextNonEmptyIdx = i + 1;
      while (nextNonEmptyIdx < lines.length && lines[nextNonEmptyIdx].trim() === '') {
        nextNonEmptyIdx++;
      }
      if (nextNonEmptyIdx < lines.length) {
        mergedLines.push(line + ' ' + lines[nextNonEmptyIdx].trim());
        i = nextNonEmptyIdx;
        continue;
      }
    }
    mergedLines.push(lines[i]);
  }

  // Regex to detect points: (1,5 pts), (1 pt), (0.5 ن), (2 points)
  const pointsRegex = /\(\s*([\d.,]+)\s*(?:pts?|points?|\u0646|\u0646\u0642\u0637\u0629?|\u0646\u0642\u0637)\s*\)/i;
  const parenthesizedNumRegex = /^(\s*(?:\d+|[a-zA-Z])[.)]\s*)\(([\d.,]+)\)/;

  const rows = mergedLines.map(line => {
    let cleanLine = line.trim();
    if (!cleanLine) return '';

    let pointsStr = '';
    const match = cleanLine.match(pointsRegex);
    if (match) {
      pointsStr = match[0];
      cleanLine = cleanLine.replace(pointsRegex, '').replace(/\s{2,}/g, ' ').trim();
    } else {
      const pMatch = cleanLine.match(parenthesizedNumRegex);
      if (pMatch) {
        const prefix = pMatch[1];
        const val = pMatch[2];
        const ptsWord = isArabicMode ? 'ن' : 'pts';
        pointsStr = `(${val} ${ptsWord})`;
        cleanLine = cleanLine.replace(parenthesizedNumRegex, prefix).trim();
      }
    }

    if (!cleanLine) return '';

    return `
      <div class="homework-row">
        <div class="homework-bareme-cell">${esc(pointsStr)}</div>
        <div class="homework-content-cell">${renderMath(cleanLine)}</div>
      </div>`;
  }).join('');

  return rows;
};

/* ── Calculate total points for Devoir Surveillé homework ── */
const calculateTotalPoints = (text, isArabicMode) => {
  if (!text) return isArabicMode ? '0 ن' : '0 pts';

  let rawText = String(text)
    .replace(/\\n(?![a-zA-Z])/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const lines = rawText.split('\n');
  let total = 0;

  const pointsRegex = /\(\s*([\d.,]+)\s*(?:pts?|points?|\u0646|\u0646\u0642\u0637\u0629?|\u0646\u0642\u0637)\s*\)/i;
  const parenthesizedNumRegex = /^(\s*(?:\d+|[a-zA-Z])[.)]\s*)\(([\d.,]+)\)/;

  lines.forEach(line => {
    const cleanLine = line.trim();
    if (!cleanLine) return;

    const match = cleanLine.match(pointsRegex);
    if (match) {
      const val = parseFloat(match[1].replace(',', '.'));
      if (!isNaN(val)) total += val;
    } else {
      const pMatch = cleanLine.match(parenthesizedNumRegex);
      if (pMatch) {
        const val = parseFloat(pMatch[2].replace(',', '.'));
        if (!isNaN(val)) total += val;
      }
    }
  });

  const totalStr = String(total).replace('.', ',');
  const ptsWord = isArabicMode ? 'ن' : (total > 1 ? 'pts' : 'pt');
  return `${totalStr} ${ptsWord}`;
};





/* ═══════════════════════════════════════════════════════════
   GENERATE LESSON / FICHE PDF HTML
   ═══════════════════════════════════════════════════════════ */
export const generateLessonHTML = (lesson, settings = {}) => {
  const showSolutions = settings.showSolutions !== undefined ? settings.showSolutions : true;
  const { content } = lesson;
  const { header, sections } = content;
  const isHomework = lesson.docType === 'homework' || lesson.content?.doc_type === 'homework';

  const title = header?.fiche_title || lesson?.title || 'Fiche de Cours';
  const subject = header?.subject || '';
  const globalProfName = (typeof window !== 'undefined' && window.localStorage) ? localStorage.getItem('profName') || '' : '';
  const globalProfPhone = (typeof window !== 'undefined' && window.localStorage) ? localStorage.getItem('profPhone') || '' : '';
  const teacher = header?.teacher || globalProfName || '';
  const phone = header?.phone || globalProfPhone || '';
  const prepTitle = header?.prep_title || '';
  const schools = header?.schools || [];
  const isExercises = lesson.docType === 'exercises' || lesson.content?.doc_type === 'exercises';
  const isConcours = lesson.docType === 'concours' || lesson.content?.doc_type === 'concours';
  const checkArabicText = () => {
    if (lesson.content?.metadata?.language === 'ar') return true;
    const textToTest = [
      lesson.title,
      subject,
      header?.fiche_title,
      header?.subject,
      ...(lesson.content?.sections || []).map(s => s.title)
    ].filter(Boolean).join(' ');
    return /[\u0600-\u06FF]/.test(textToTest);
  };
  const isArabic = checkArabicText();
  const levelKey = lesson.level || lesson.content?.level || '';
  const levelDisplayName = getLevelDisplayName(levelKey, isArabic);
  const levelText = levelDisplayName || prepTitle || '';
  const qrData = (typeof window !== 'undefined' && window.location)
    ? `${window.location.origin}/admin/lessons/${lesson.id}`
    : `https://lconq.vercel.app/admin/lessons/${lesson.id}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}&color=005086&bgcolor=ffffff`;
  const docTypeFilename = isHomework
    ? (isArabic ? 'فرض محروس' : 'Devoir Surveille')
    : isExercises
      ? (isArabic ? 'سلسلة تمارين' : 'Serie d exercices')
      : isConcours
        ? (isArabic ? 'مباراة' : 'Concours')
        : (isArabic ? 'درس' : 'Cours');

  const langFilename = isArabic ? 'AR' : 'FR';
  const cleanLevelKey = levelKey || 'Niveau';
  const cleanTitle = title.replace(/[\\\/:\*\?"<>\|]/g, '');
  const pdfDocumentTitle = `${cleanLevelKey} - ${docTypeFilename} - ${langFilename} - ${cleanTitle}`;
  const dir = isArabic ? 'rtl' : 'ltr';
  const arabicFontFamily = "'UKIJMerdaneRegular', 'Cairo', 'Amiri', 'Noto Naskh Arabic', Arial, sans-serif";
  const bodyFont = isArabic ? arabicFontFamily : "'Computer Modern Serif', 'STIX Two Text', 'Times New Roman', serif";

  // Set module-level RTL flag for renderLine
  _rtlMode = isArabic;

  /* ── Build sections HTML ── */
  let sectionsHtml = '';
  let prevSectionHeader = null;

  sections?.forEach((sec, idx) => {
    const isTheory = sec.type === 'content';

    // Section header row — shown only for theory/lesson docs, not exercise sheets
    if (!isExercises && sec.section_header && sec.section_header !== prevSectionHeader) {
      sectionsHtml += `
        <div class="section-header-row" ${isArabic ? 'style="flex-direction:row"' : (idx > 0 ? 'style="margin-top:0.6rem"' : '')}>
          <div class="section-badge">${sec.section_number || '1'}</div>
          <div class="section-title-pill" ${isArabic ? `style="font-family:${arabicFontFamily};direction:rtl"` : ''}>${esc(sec.section_header)}</div>
        </div>`;
      prevSectionHeader = sec.section_header;
    }

    if (isTheory) {
      // Theory/content subsection
      let itemsHtml = '';
      sec.items?.forEach((item) => {
        if (item.type === 'highlight_box') {
          itemsHtml += `<div class="highlight-box">${renderMath(item.text)}</div>`;
        } else if (item.type === 'notation_grid') {
          let colsHtml = '';
          item.notation_columns?.forEach((col) => {
            let blocksHtml = '';
            col.math_blocks?.forEach((block) => {
              blocksHtml += `<div style="display:block;margin:0.2rem 0">${renderMath(block)}</div>`;
            });
            colsHtml += `<div class="notation-column">
              <strong style="font-size:0.9rem;color:#005086">${esc(col.title)}</strong>
              ${blocksHtml}
            </div>`;
          });
          itemsHtml += `<div class="notation-grid">${colsHtml}</div>`;
        } else if (item.type === 'table') {
          let headersHtml = '';
          item.table_data?.headers?.forEach(h => { headersHtml += `<th>${renderMath(h)}</th>`; });
          let rowsHtml = '';
          item.table_data?.rows?.forEach(row => {
            let cellsHtml = '';
            row.forEach(cell => { cellsHtml += `<td>${renderMath(cell)}</td>`; });
            rowsHtml += `<tr>${cellsHtml}</tr>`;
          });
          itemsHtml += `<div style="overflow-x:auto;width:100%;margin:0.5rem 0">
            <table class="sheet-table">
              <thead><tr>${headersHtml}</tr></thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>`;
        } else {
          // bullet or text
          const bulletDot = item.type === 'bullet'
            ? `<span class="bullet-dot" style="${isArabic ? 'margin-left:0.4rem;margin-right:0' : ''}">•</span>`
            : '';
          const bulletStyle = isArabic
            ? 'flex-direction:row;text-align:right;'
            : '';
          itemsHtml += `<div class="bullet-item" style="${bulletStyle}">${bulletDot}<span style="flex:1;font-family:${isArabic ? arabicFontFamily : 'inherit'}">${renderMath(item.text)}</span></div>`;
        }
      });

      sectionsHtml += `
        <div class="subsection-card" ${isArabic ? `style="font-family:${arabicFontFamily};direction:rtl"` : ''}>
          <div class="subsection-header" ${isArabic ? 'style="flex-direction:row;text-align:right"' : ''}>
            <span>${esc(sec.title || '')}</span>
            ${sec.accent_text ? `<span class="accent-green">${esc(sec.accent_text)}</span>` : ''}
          </div>
          ${itemsHtml}
        </div>`;

    } else {
      // Exercise section
      const { number: exeNumber, label: exeLabel } = parseExerciseTitle(sec.title, idx, isArabic);
      const isHomework = lesson.docType === 'homework' || lesson.content?.doc_type === 'homework';

      if (isHomework) {
        sectionsHtml += `
          <div class="homework-table" ${isArabic ? `style="font-family:${arabicFontFamily}"` : ''}>
            <div class="homework-header-row">
              <div class="homework-bareme-header">${calculateTotalPoints(sec.content, isArabic)}</div>
              <div class="homework-content-header">
                ${isArabic ? 'تمرين' : 'Exercice'} ${esc(exeNumber)} ${exeLabel ? ` : ${esc(exeLabel)}` : ''}
              </div>
            </div>
            ${renderHomeworkBody(sec.content, isArabic)}
            ${(sec.solution && showSolutions) ? `
            <div class="homework-row" style="background: rgba(16,185,129,0.01);">
              <div class="homework-bareme-cell" style="background: rgba(16,185,129,0.03); color: #059669; border-top: 1px solid rgba(16,185,129,0.15)">📖</div>
              <div class="homework-content-cell" style="border-top: 1px solid rgba(16,185,129,0.15)">
                <div class="solution-block" style="margin-top: 0; padding: 0.5rem 0;">
                  <h4 class="solution-title" ${isArabic ? `style="flex-direction:row;font-family:${arabicFontFamily}"` : ''}>📖 ${isArabic ? 'الحل المفصل' : 'Démonstration rédigée'}</h4>
                  <div class="solution-content" ${isArabic ? `style="text-align:right;direction:rtl;font-family:${arabicFontFamily}"` : ''}>${renderMath(sec.solution)}</div>
                </div>
              </div>
            </div>` : ''}
          </div>`;
      } else {
        sectionsHtml += `
          <div class="exercise-wrapper" ${isArabic ? `style="font-family:${arabicFontFamily}"` : ''}>
            <div class="exercise-banner" ${isArabic ? 'style="flex-direction:row"' : ''}>
              <div class="exercise-pill" ${isArabic ? 'style="flex-direction:row"' : ''}>
                <span>${isArabic ? 'تمرين' : 'Exercice N°'}</span>
                <span class="exercise-num">${esc(exeNumber)}</span>
              </div>
              ${exeLabel ? `<span class="exercise-label" ${isArabic ? `style="font-family:${arabicFontFamily}"` : ''}>${esc(exeLabel)}</span>` : ''}
            </div>
            <div class="exercise-body" ${isArabic ? 'style="border-left:none;border-right:4px solid #005086;border-radius:6px 4px 4px 6px;text-align:right;direction:rtl"' : ''}>${renderMath(sec.content)}</div>
            ${(sec.solution && showSolutions) ? `
            <div class="solution-block">
              <h4 class="solution-title" ${isArabic ? `style="flex-direction:row;font-family:${arabicFontFamily}"` : ''}>📖 ${isArabic ? 'الحل المفصل' : 'Démonstration rédigée'}</h4>
              <div class="solution-content" ${isArabic ? `style="text-align:right;direction:rtl;font-family:${arabicFontFamily}"` : ''}>${renderMath(sec.solution)}</div>
            </div>` : ''}
          </div>`;
      }
    }
  });


  /* ── Full HTML document ── */
  return `<!DOCTYPE html>
<html lang="${isArabic ? 'ar' : 'fr'}" dir="${dir}">
<head>
<meta charset="UTF-8">
<base href="${(typeof window !== 'undefined') ? window.location.origin : ''}/">
<title>${esc(pdfDocumentTitle)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Inter:wght@300;400;500;600;700;800;900&family=STIX+Two+Text:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/dreampulse/computer-modern-web-font@master/fonts.css">
<style>
@font-face {
  font-family: 'UKIJMerdaneRegular';
  src: url('/fonts/UKIJMerdaneRegular.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
}
/* ═══════════════════════════════════════
   BASE RESET & PAGE SETUP
   ═══════════════════════════════════════ */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

@page {
  size: A4 portrait;
  margin: ${isHomework ? '8mm 8mm 8mm 8mm' : '12mm 12mm 14mm 12mm'};
  @bottom-center {
    content: "— " counter(page) " —";
    font-family: 'Computer Modern Serif', 'STIX Two Text', 'Times New Roman', serif;
    font-size: 8pt;
    color: #94a3b8;
  }
}

@page :first {
  @bottom-center { content: none; }
}

html {
  font-size: ${isHomework ? '9.8pt' : '11pt'};
}

body {
  font-family: 'Computer Modern Serif', 'STIX Two Text', 'Times New Roman', serif;
  color: #1a202c;
  background: #ffffff;
  line-height: ${isHomework ? '1.42' : '1.7'};
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
  font-feature-settings: 'liga' 1, 'kern' 1;
}

/* ═══════════════════════════════════════
   PRINT HINT BAR (hidden on print)
   ═══════════════════════════════════════ */
.print-hint {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  background: linear-gradient(135deg, #0f172a, #1e293b);
  color: #fff;
  padding: 0.85rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 9.5pt;
  gap: 1rem;
  font-family: 'Inter', sans-serif;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
}
.print-hint-msg {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.print-hint-icon { font-size: 1.4rem; }
.print-hint-text strong { font-size: 10pt; color: #38bdf8; }
.print-hint-text span { color: rgba(255,255,255,0.7); font-size: 8.5pt; }
.hint-badge {
  background: #0284c7;
  color: #fff;
  font-size: 8.5pt;
  font-weight: 700;
  padding: 6px 18px;
  border-radius: 20px;
  white-space: nowrap;
  cursor: pointer;
  border: none;
  font-family: inherit;
  letter-spacing: 0.5px;
  transition: all 0.2s;
}
.hint-badge:hover { background: #0369a1; }

@media print {
  .print-hint { display: none !important; }
  body { padding-top: 0 !important; }
}

@media screen {
  body { padding-top: 52px; }
}

/* ═══════════════════════════════════════
   CONTENT WRAPPER (screen preview only)
   ═══════════════════════════════════════ */
@media screen {
  .page-content {
    max-width: 210mm;
    margin: 0 auto;
    padding: 12mm 12mm;
    background: #fff;
    box-shadow: 0 0 40px rgba(0,0,0,0.08);
  }
}

/* ═══════════════════════════════════════
   HEADER — Modern 2026 4-zone grid
   ═══════════════════════════════════════ */
.fiche-header {
  display: grid;
  grid-template-columns: 1.15fr 1.6fr 1.15fr 0.45fr;
  background-color: #005086;
  gap: 1.5px;
  border: 1.5px solid #005086;
  border-radius: 6px;
  margin-bottom: 0.75rem;
  overflow: hidden;
  font-family: inherit;
}
.fiche-header .hcell {
  padding: 6px 12px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  background-color: #ffffff;
}

/* LEFT — prof info */
.fiche-header .h-left {
  background-color: #f8fafc;
  font-size: 0.8rem;
  font-weight: 500;
  color: #475569;
  line-height: 1.45;
}
.fiche-header .h-left span { display: block; }
.fiche-header .h-left strong {
  color: #005086;
  font-weight: 700;
}

/* CENTER — subject + title */
.fiche-header .h-center {
  background-color: #ffffff;
  align-items: center;
  text-align: center;
}
.fiche-header .h-center .doc-subject {
  font-size: 0.68rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.07em;
}
.fiche-header .h-center .header-banner-pill {
  background: none;
  color: #005086;
  padding: 0.2rem 0;
  font-weight: 800;
  font-size: 1.25rem;
  display: inline-block;
  text-align: center;
  box-shadow: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.fiche-header .h-center .doc-type {
  font-size: 0.72rem;
  color: #475569;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 0.2rem;
}

/* RIGHT — school name */
.fiche-header .h-right {
  background-color: #f8fafc;
  align-items: flex-end;
  text-align: right;
  font-size: 0.8rem;
  color: #475569;
}
.fiche-header .h-right .school-label {
  font-size: 0.68rem;
  color: #64748b;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.04em;
}
.fiche-header .h-right .school-name {
  font-size: 0.9rem;
  font-weight: 700;
  color: #005086;
  line-height: 1.25;
}
.fiche-header .h-right .level-name {
  font-size: 0.8rem;
  font-weight: 500;
  color: #475569;
  margin-top: 2px;
}
.fiche-header .h-right .level-name strong {
  color: #005086;
  font-weight: 700;
}

/* PAGE badge (QR Code) */
.fiche-header .h-page {
  background-color: #005086;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 4px;
}
.fiche-header .h-page .qr-wrapper {
  background-color: #ffffff;
  padding: 3px;
  border-radius: 4px;
  display: inline-block;
  margin: 0 auto;
}
.fiche-header .h-page .qr-img {
  width: 44px;
  height: 44px;
  display: block;
}
.fiche-header .h-page .qr-label {
  font-size: 0.5rem;
  font-weight: 800;
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-top: 2px;
  line-height: 1;
}

/* ═══════════════════════════════════════
   CLASSIC HEADER (lessons / courses)
   ═══════════════════════════════════════ */
.fiche-header-classic {
  display: grid;
  grid-template-columns: 1fr 1.5fr 1fr;
  border-bottom: 2.5px solid #005086;
  padding-bottom: 0.4rem;
  margin-bottom: 0.6rem;
  align-items: center;
}
.fiche-header-classic .left-classic {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  font-size: 0.82rem;
  font-weight: 700;
  color: #1a202c;
}
.fiche-header-classic .left-classic .schools-classic {
  color: #005086;
  font-weight: 800;
}
.fiche-header-classic .center-classic {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  align-items: center;
}
.fiche-header-classic .center-classic .subject-label-classic {
  font-size: 0.72rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.fiche-header-classic .center-classic .fiche-title-classic {
  font-weight: 900;
  font-size: 1.1rem;
  color: #b91c1c;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.fiche-header-classic .right-classic {
  text-align: right;
  font-size: 0.82rem;
  font-weight: 700;
  color: #1a202c;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  align-items: flex-end;
}
.fiche-header-classic .right-classic .phone-classic {
  color: #4b5563;
  font-weight: 600;
}

/* ═══════════════════════════════════════
   BANNER TITLE
   ═══════════════════════════════════════ */
.banner-title {
  background: #005086;
  color: #ffffff;
  border-radius: 20px;
  padding: 0.3rem 2rem;
  font-weight: 800;
  font-size: 1.2rem;
  display: inline-block;
  margin: 0 auto;
  text-align: center;
  letter-spacing: 0.02em;
}
.banner-wrapper {
  text-align: center;
  margin-bottom: 0.6rem;
}

/* ═══════════════════════════════════════
   SECTION HEADER ROW (numbering + title)
   ═══════════════════════════════════════ */
.section-header-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 2px solid rgba(0,80,134,0.15);
  padding-bottom: 0.25rem;
  margin-bottom: 0.4rem;
  page-break-after: avoid;
}
.section-badge {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #005086;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 0.85rem;
  flex-shrink: 0;
}
.section-title-pill {
  font-size: 1.05rem;
  font-weight: 800;
  color: #005086;
  border: 1.5px solid rgba(0,80,134,0.4);
  border-radius: 99px;
  padding: 0.2rem 1.1rem;
  display: inline-flex;
  background: rgba(0,80,134,0.03);
}

/* ═══════════════════════════════════════
   SUBSECTION CARD (theory blocks)
   ═══════════════════════════════════════ */
.subsection-card {
  border: 1.5px solid #005086;
  border-radius: 6px;
  padding: 0.6rem 0.8rem;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin-bottom: 0.4rem;
}
.subsection-header {
  font-size: 0.95rem;
  font-weight: 800;
  color: #1a202c;
  border-bottom: 1px dashed rgba(0,80,134,0.25);
  padding-bottom: 0.2rem;
  margin-bottom: 0.15rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.accent-green {
  color: #009688;
  font-weight: 800;
}

/* ═══════════════════════════════════════
   BULLET ITEMS
   ═══════════════════════════════════════ */
.bullet-item {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  line-height: 1.55;
  margin-bottom: 0.15rem;
}
.bullet-dot {
  color: #005086;
  font-size: 1.1rem;
  line-height: 1;
  margin-top: 0.15rem;
  flex-shrink: 0;
}

/* ═══════════════════════════════════════
   HIGHLIGHT BOX
   ═══════════════════════════════════════ */
.highlight-box {
  background: rgba(0,80,134,0.04);
  border: 1.5px solid #005086;
  border-radius: 5px;
  padding: 0.5rem 0.7rem;
  margin: 0.2rem 0;
  line-height: 1.6;
}

/* ═══════════════════════════════════════
   NOTATION GRID
   ═══════════════════════════════════════ */
.notation-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
  margin: 0.2rem 0;
  padding: 0.4rem;
  background: #f8fafc;
  border: 1px solid rgba(0,80,134,0.1);
  border-radius: 5px;
}
.notation-column {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  border-left: 2px solid #005086;
  padding-left: 0.8rem;
}

/* ═══════════════════════════════════════
   TABLES
   ═══════════════════════════════════════ */
.sheet-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0.4rem;
  border: 1.5px solid #005086;
  font-size: 0.92rem;
}
.sheet-table th,
.sheet-table td {
  border: 1px solid rgba(0,80,134,0.25);
  padding: 0.55rem 0.8rem;
  text-align: center;
  color: #1a202c;
}
.sheet-table th {
  background: rgba(0,80,134,0.06);
  font-weight: 800;
  color: #005086;
}

/* ═══════════════════════════════════════
   EXERCISES
   ═══════════════════════════════════════ */
.exercise-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin-bottom: 0.4rem;
}
.exercise-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.exercise-pill {
  background: #005086;
  color: #ffffff;
  padding: 0.3rem 1.1rem;
  border-radius: 99px;
  font-weight: 800;
  font-size: 0.85rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}
.exercise-num {
  background: #ffffff;
  color: #005086;
  min-width: 20px;
  height: 20px;
  border-radius: 10px;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
  font-weight: 900;
  white-space: nowrap;
}
.exercise-label {
  font-weight: 800;
  font-size: 0.95rem;
  color: #1a202c;
}
.exercise-body {
  border-left: 4px solid #005086;
  background: rgba(0,80,134,0.02);
  border-top: 1px solid rgba(0,80,134,0.1);
  border-right: 1px solid rgba(0,80,134,0.1);
  border-bottom: 1px solid rgba(0,80,134,0.1);
  border-radius: 4px 6px 6px 4px;
  padding: 0.6rem 0.8rem;
  line-height: 1.6;
}

/* ═══════════════════════════════════════
   SOLUTION BLOCK
   ═══════════════════════════════════════ */
.solution-block {
  background: rgba(16,185,129,0.03);
  border: 1.5px solid rgba(16,185,129,0.2);
  border-radius: 6px;
  padding: 0.6rem 0.8rem;
  margin-top: 0.2rem;
}
.solution-title {
  color: #059669;
  font-weight: 800;
  font-size: 0.9rem;
  margin-bottom: 0.3rem;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
.solution-content {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.9rem;
  line-height: 1.6;
}

/* ═══════════════════════════════════════
   CALLOUTS (response / attention)
   ═══════════════════════════════════════ */
.mfc-callout-response {
  background: rgba(16,185,129,0.06);
  border-left: 4px solid #009688;
  padding: 0.5rem 0.8rem;
  border-radius: 0 6px 6px 0;
  margin: 0.3rem 0;
}
.mfc-callout-attention {
  background: rgba(245,158,11,0.06);
  border-left: 4px solid #d97706;
  padding: 0.5rem 0.8rem;
  border-radius: 0 6px 6px 0;
  margin: 0.3rem 0;
}

/* ═══════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════ */
.fiche-footer {
  margin-top: 1rem;
  padding-top: 0.3rem;
  border-top: 1.5px solid #e2e8f0;
  text-align: center;
  font-size: 0.7rem;
  color: #94a3b8;
  font-family: 'Inter', sans-serif;
}

/* ═══════════════════════════════════════
   KATEX OVERRIDES
   ═══════════════════════════════════════ */
.katex {
  color: #1a202c !important;
  font-size: 0.98em !important;
}
.katex .mord, .katex .mbin, .katex .mrel,
.katex .mopen, .katex .mclose, .katex .mpunct,
.katex .minner, .katex .mop { color: #1a202c !important; }

/* Display-mode KaTeX blocks need margin */
.katex-display {
  margin: 0.25rem 0 !important;
}

/* ═══════════════════════════════════════
   SECTIONS CONTAINER
   ═══════════════════════════════════════ */
.sections-container {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  width: 100%;
}

.exercises-two-columns {
  display: block !important;
  column-count: 2 !important;
  column-gap: 1.5rem !important;
  column-rule: 1px solid rgba(0, 80, 134, 0.2) !important;
}

.exercises-two-columns > * {
  break-inside: auto;
  page-break-inside: auto;
  margin-bottom: 0.6rem !important;
}

/* Keep exercise header attached to its body — never break between banner and body */
.exercises-two-columns .exercise-banner {
  break-after: avoid;
  page-break-after: avoid;
}

/* Solution block can break freely too */
.exercises-two-columns .solution-block {
  break-inside: auto;
  page-break-inside: auto;
}

/* Prevent math formulas from overflowing two-column layouts in compiled PDF */
.exercises-two-columns .katex-display {
  max-width: 100% !important;
  overflow-x: visible !important;
  overflow-y: visible !important;
  font-size: 0.82em !important;
}
.exercises-two-columns .katex,
.exercises-two-columns .katex-html {
  white-space: normal !important;
  display: inline !important;
}
.exercises-two-columns .katex .base {
  white-space: nowrap !important;
  display: inline-block !important;
  margin-top: 2px;
  margin-bottom: 2px;
}


/* ═══════════════════════════════════════
   RTL — Arabic Language Support
   ═══════════════════════════════════════ */
html[dir="rtl"] body {
  font-family: 'UKIJMerdaneRegular', 'Cairo', 'Amiri', 'Noto Naskh Arabic', Arial, sans-serif;
  direction: rtl;
  text-align: right;
}
html[dir="rtl"] .sections-container,
html[dir="rtl"] .section-header-row,
html[dir="rtl"] .subsection-header,
html[dir="rtl"] .exercise-banner,
html[dir="rtl"] .fiche-header,
html[dir="rtl"] .fiche-header-classic,
html[dir="rtl"] .fiche-footer,
html[dir="rtl"] .print-hint {
  direction: rtl;
  font-family: 'UKIJMerdaneRegular', 'Cairo', 'Amiri', 'Noto Naskh Arabic', Arial, sans-serif !important;
}
html[dir="rtl"] span[style*="display:block"],
html[dir="rtl"] span[style*="display: block"] {
  text-align: right;
  direction: rtl;
  font-family: 'UKIJMerdaneRegular', 'Cairo', 'Amiri', Arial, sans-serif;
}
/* Bullet and numbered lists reverse in RTL */
html[dir="rtl"] div[style*="display:flex"][style*="align-items:flex-start"],
html[dir="rtl"] div[style*="display: flex"][style*="align-items: flex-start"] {
  flex-direction: row !important;
  text-align: right;
}
/* KaTeX stays LTR inside RTL */
html[dir="rtl"] .katex,
html[dir="rtl"] .katex-display {
  direction: ltr !important;
  unicode-bidi: isolate;
}
/* Arabic badge in translated lessons */
html[dir="rtl"] .banner-title {
  font-family: 'UKIJMerdaneRegular', 'Cairo', 'Amiri', Arial, sans-serif;
  direction: rtl;
}
/* Callout blocks — flip border */
html[dir="rtl"] .mfc-callout-response {
  border-left: none !important;
  border-right: 4px solid #009688 !important;
  border-radius: 6px 0 0 6px !important;
}
html[dir="rtl"] .mfc-callout-attention {
  border-left: none !important;
  border-right: 4px solid #d97706 !important;
  border-radius: 6px 0 0 6px !important;
}
/* Section title pill in RTL */
html[dir="rtl"] .section-header-row {
  flex-direction: row;
}

/* ═══════════════════════════════════════
   HOMEWORK EXAM LAYOUT (Devoir Surveillé)
   ═══════════════════════════════════════ */
.homework-table {
  width: 100%;
  border-collapse: collapse;
  border: 1.5px solid #005086;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 0.6rem;
  box-shadow: 0 4px 10px rgba(0,0,0,0.02);
  page-break-inside: auto;
}
.homework-header-row {
  display: flex;
  background: #005086;
  color: #ffffff;
  font-weight: 800;
  border-bottom: 2px solid #005086;
  align-items: stretch;
}
.homework-row {
  display: flex;
  border-bottom: 1px solid #e2e8f0;
  align-items: stretch;
}
.homework-row:last-child {
  border-bottom: none;
}
.homework-bareme-cell, .homework-bareme-header {
  width: 55px;
  flex-shrink: 0;
  padding: 0.35rem 0.2rem;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 700;
}
.homework-bareme-header {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  border-right: 2px solid #ffffff;
}
.homework-bareme-cell {
  background: rgba(0, 80, 134, 0.02);
  color: #475569;
  border-right: 2px solid #005086;
  font-family: inherit;
}
.homework-content-cell, .homework-content-header {
  flex: 1;
  padding: 0.4rem 0.75rem;
}
.homework-content-header {
  font-size: 1.02rem;
  display: flex;
  align-items: center;
  font-weight: 800;
}
/* RTL support for homework table */
html[dir="rtl"] .homework-header-row,
html[dir="rtl"] .homework-row {
  flex-direction: row-reverse;
}
html[dir="rtl"] .homework-bareme-cell {
  border-right: none;
  border-left: 2px solid #005086;
}
html[dir="rtl"] .homework-bareme-header {
  border-right: none;
  border-left: 2px solid #ffffff;
}


</style>
</head>
<body style="font-family:${bodyFont}">

<!-- Print Hint Bar (visible on screen only) -->
<div class="print-hint" id="printHint">
  <div class="print-hint-msg">
    <span class="print-hint-icon">🖨️</span>
    <div class="print-hint-text">
      ${isArabic
        ? '<strong style="color:#38bdf8">الملف جاهز للطباعة</strong><br><span>اضغط على <b>Ctrl+P</b> لطباعة أو حفظ PDF. اختر "حفظ كـ PDF" كوجهة.</span>'
        : '<strong>Fiche de Cours Pr\u00eate</strong><br><span>Appuyez sur <b>Ctrl+P</b> pour imprimer ou enregistrer en PDF. Choisissez "Enregistrer en PDF" comme destination.</span>'
      }
    </div>
  </div>
  <button class="hint-badge" onclick="printNow()">${isArabic ? '⚡ طباعة' : '⚡ Imprimer'}</button>
</div>

<div class="page-content">
  <!-- HEADER -->
  ${(isExercises || isHomework) ? `
  <!-- NEW 2026 HEADER: exercises and homework -->
  <div class="fiche-header">
    <div class="hcell h-left">
      ${teacher ? `<span>${isArabic ? 'الأستاذ' : 'Prof'} : <strong>${esc(teacher)}</strong></span>` : ''}
      <span>${isArabic ? 'السنة الدراسية' : 'A.S'} : <strong>${new Date().getFullYear() - 1}/${new Date().getFullYear()}</strong></span>
      ${schools.length ? `<span><strong>${esc(schools[0])}</strong></span>` : ''}
    </div>
    <div class="hcell h-center">
      <div class="header-banner-pill">${esc(title)}</div>
      <span class="doc-type">${isArabic ? (isHomework ? 'فرض محروس' : 'سلسلة تمارين') : (isHomework ? 'Devoir Surveill\u00e9' : 'S\u00e9rie d\'exercices')}</span>
    </div>
    <div class="hcell h-right">
      ${schools.length ? `<span class="school-label">${isArabic ? 'المؤسسة' : 'Lyc\u00e9e'} :</span><span class="school-name">${schools.length > 1 ? esc(schools[1]) : esc(schools[0])}</span>` : ''}
      ${levelText ? `<span class="level-name">${isArabic ? 'المستوى' : 'Niveau'} : <strong>${esc(levelText)}</strong></span>` : ''}
    </div>
    <div class="hcell h-page">
      <div class="qr-wrapper">
        <img src="${qrImageUrl}" class="qr-img" alt="QR" />
      </div>
      <span class="qr-label">${isArabic ? 'التصحيح' : 'Solution'}</span>
    </div>
  </div>
  ` : `
  <!-- CLASSIC HEADER: lessons / courses -->
  <div class="fiche-header-classic">
    <div class="left-classic">
      <span>${esc(prepTitle)}</span>
      <span class="schools-classic">${esc(schools.join(' - '))}</span>
    </div>
    <div class="center-classic">
      <span class="subject-label-classic">${esc(subject)}</span>
      <span class="fiche-title-classic">${esc(title)}</span>
    </div>
    <div class="right-classic">
      <span>${esc(teacher)}</span>
      ${phone ? `<span class="phone-classic">${esc(phone)}</span>` : ''}
    </div>
  </div>
  `}

  <!-- BANNER: only for classic (non-exercise/non-homework) docs -->
  ${(!isExercises && !isHomework) ? `
  <div class="banner-wrapper">
    <div class="banner-title">${esc(title)}</div>
  </div>
  ` : ''}

  <!-- SECTIONS -->
  <div class="sections-container ${(lesson.docType === 'exercises' || lesson.content?.doc_type === 'exercises') ? 'exercises-two-columns' : ''}">
    ${sectionsHtml}
  </div>

  <!-- FOOTER -->
  <div class="fiche-footer">
    © ${new Date().getFullYear()} L'CONQ — Plateforme de Préparation aux Concours d'Excellence
    ${teacher ? ` · Préparé par : <strong>${esc(teacher)}</strong>` : ''}
    ${phone ? ` · ${esc(phone)}` : ''}
  </div>
</div>

<script>
async function printNow() {
  await document.fonts.ready;
  await new Promise(r => setTimeout(r, 600));
  var hint = document.getElementById('printHint');
  if (hint) hint.style.display = 'none';
  window.print();
  if (hint) hint.style.display = 'flex';
}
// Auto-print when ready
printNow();
</script>
</body>
</html>`;
};


/* ── Open the lesson HTML in a new window ── */
export const openLessonPrintWindow = (lesson, settings = {}) => {
  const html = generateLessonHTML(lesson, settings);
  const title = lesson?.content?.header?.fiche_title || lesson?.title || 'Fiche_de_cours';

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
