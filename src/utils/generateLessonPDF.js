import katex from 'katex';
import { openNationalExamPrintWindow } from './generateNationalExamPDF';

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

  // 5. Convert multi-letter vectors to \overrightarrow for standard textbook styling
  repaired = repaired
    .replace(/\\vec\{([a-zA-Z0-9]{2,})\}/g, '\\overrightarrow{$1}')
    .replace(/(?<![a-zA-Z\\])vec\{([a-zA-Z0-9]{2,})\}/g, '\\overrightarrow{$1}');

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
  
  let rawText = String(text);
  
  // Split by math blocks to safely replace literal \n outside math without corrupting LaTeX commands like \neq
  const parts = rawText.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);
  const processedParts = parts.map((part, idx) => {
    if (idx % 2 === 1) {
      // Inside math block: only replace literal \n if NOT followed by letters (e.g. KaTeX commands)
      return part.replace(/\\n(?![a-zA-Z])/g, '\n');
    } else {
      // Outside math block: replace all literal \n with real newlines safely
      return part.replace(/\\n/g, '\n');
    }
  });
  rawText = processedParts.join('');

  rawText = rawText
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

const generateSignTableHtml = (altText) => {
  const alt = (altText || '').toLowerCase();
  
  if (alt.includes('ax+b') || alt.includes('ax + b') || (alt.includes('signe') && (alt.includes('1er degré') || alt.includes('1er degre')))) {
    return `<div style="margin:0.85rem 0;padding:0.95rem;border-radius:12px;border:1px solid #cbd5e1;background:#ffffff;box-shadow:0 4px 16px rgba(0,0,0,0.04)">
      <div style="font-weight:800;font-size:0.88rem;color:#1e3a8a;margin-bottom:0.65rem;display:flex;align-items:center;gap:0.4rem">📊 Tableaux de signe de f(x) = ax + b (a &ne; 0)</div>
      <div style="display:flex;gap:0.85rem;flex-wrap:wrap">
        <div style="flex:1;min-width:220px">
          <div style="font-size:0.78rem;font-weight:700;color:#059669;margin-bottom:0.3rem">Premier cas : a &gt; 0</div>
          <table class="sheet-table" style="width:100%;border-collapse:collapse;text-align:center;font-size:0.84rem">
            <thead>
              <tr style="background:rgba(124,58,237,0.07)">
                <th>${renderMath('$x$')}</th>
                <th>${renderMath('$-\\infty$')}</th>
                <th></th>
                <th>${renderMath('$-\\frac{b}{a}$')}</th>
                <th></th>
                <th>${renderMath('$+\\infty$')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight:800;background:#f8fafc">${renderMath('$ax+b$')}</td>
                <td></td>
                <td style="color:#ef4444;font-weight:900;font-size:1.05rem">&minus;</td>
                <td><span style="background:linear-gradient(135deg, #fef3c7, #fde68a);color:#92400e;border:1px solid #fcd34d;padding:1px 6px;border-radius:4px;font-weight:900;font-size:0.82rem;display:inline-block">0</span></td>
                <td style="color:#10b981;font-weight:900;font-size:1.05rem">+</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style="flex:1;min-width:220px">
          <div style="font-size:0.78rem;font-weight:700;color:#d97706;margin-bottom:0.3rem">Deuxième cas : a &lt; 0</div>
          <table class="sheet-table" style="width:100%;border-collapse:collapse;text-align:center;font-size:0.84rem">
            <thead>
              <tr style="background:rgba(124,58,237,0.07)">
                <th>${renderMath('$x$')}</th>
                <th>${renderMath('$-\\infty$')}</th>
                <th></th>
                <th>${renderMath('$-\\frac{b}{a}$')}</th>
                <th></th>
                <th>${renderMath('$+\\infty$')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight:800;background:#f8fafc">${renderMath('$ax+b$')}</td>
                <td></td>
                <td style="color:#10b981;font-weight:900;font-size:1.05rem">+</td>
                <td><span style="background:linear-gradient(135deg, #fef3c7, #fde68a);color:#92400e;border:1px solid #fcd34d;padding:1px 6px;border-radius:4px;font-weight:900;font-size:0.82rem;display:inline-block">0</span></td>
                <td style="color:#ef4444;font-weight:900;font-size:1.05rem">&minus;</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  }

  if (alt.includes('ax^2') || alt.includes('ax2') || alt.includes('delta') || alt.includes('trinôme') || alt.includes('trinome') || alt.includes('2nd degré') || alt.includes('2ème degré')) {
    return `<div style="margin:0.85rem 0;padding:0.95rem;border-radius:12px;border:1px solid #cbd5e1;background:#ffffff;box-shadow:0 4px 16px rgba(0,0,0,0.04)">
      <div style="font-weight:800;font-size:0.88rem;color:#059669;margin-bottom:0.65rem;display:flex;align-items:center;gap:0.4rem">📊 Tableaux de signe du trinôme f(x) = ax&sup2; + bx + c (a &ne; 0)</div>
      <div style="display:flex;flex-direction:column;gap:0.75rem">
        <div>
          <div style="font-size:0.78rem;font-weight:700;color:#7c3aed;margin-bottom:0.25rem">${renderMath('1er cas : $\\Delta > 0$ ($x_1 < x_2$ deux racines distinctes)')}</div>
          <table class="sheet-table" style="width:100%;border-collapse:collapse;text-align:center;font-size:0.84rem">
            <thead>
              <tr style="background:rgba(124,58,237,0.07)">
                <th>${renderMath('$x$')}</th>
                <th>${renderMath('$-\\infty$')}</th>
                <th></th>
                <th>${renderMath('$x_1$')}</th>
                <th></th>
                <th>${renderMath('$x_2$')}</th>
                <th></th>
                <th>${renderMath('$+\\infty$')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight:800;background:#f8fafc">${renderMath('$ax^2+bx+c$')}</td>
                <td></td>
                <td style="font-weight:700">Signe de ${renderMath('$a$')}</td>
                <td><span style="background:linear-gradient(135deg, #fef3c7, #fde68a);color:#92400e;border:1px solid #fcd34d;padding:1px 6px;border-radius:4px;font-weight:900;font-size:0.82rem;display:inline-block">0</span></td>
                <td style="color:#7c3aed;font-weight:800">Signe de ${renderMath('$-a$')}</td>
                <td><span style="background:linear-gradient(135deg, #fef3c7, #fde68a);color:#92400e;border:1px solid #fcd34d;padding:1px 6px;border-radius:4px;font-weight:900;font-size:0.82rem;display:inline-block">0</span></td>
                <td style="font-weight:700">Signe de ${renderMath('$a$')}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <div style="font-size:0.78rem;font-weight:700;color:#059669;margin-bottom:0.25rem">${renderMath('2ème cas : $\\Delta = 0$ ($x_0 = -\\frac{b}{2a}$ racine double)')}</div>
          <table class="sheet-table" style="width:100%;border-collapse:collapse;text-align:center;font-size:0.84rem">
            <thead>
              <tr style="background:rgba(16,185,129,0.07)">
                <th>${renderMath('$x$')}</th>
                <th>${renderMath('$-\\infty$')}</th>
                <th></th>
                <th>${renderMath('$x_0$')}</th>
                <th></th>
                <th>${renderMath('$+\\infty$')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight:800;background:#f8fafc">${renderMath('$ax^2+bx+c$')}</td>
                <td></td>
                <td style="font-weight:700">Signe de ${renderMath('$a$')}</td>
                <td><span style="background:linear-gradient(135deg, #fef3c7, #fde68a);color:#92400e;border:1px solid #fcd34d;padding:1px 6px;border-radius:4px;font-weight:900;font-size:0.82rem;display:inline-block">0</span></td>
                <td style="font-weight:700">Signe de ${renderMath('$a$')}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <div style="font-size:0.78rem;font-weight:700;color:#d97706;margin-bottom:0.25rem">${renderMath('3ème cas : $\\Delta < 0$ (aucune racine réelle)')}</div>
          <table class="sheet-table" style="width:100%;border-collapse:collapse;text-align:center;font-size:0.84rem">
            <thead>
              <tr style="background:rgba(245,158,11,0.07)">
                <th>${renderMath('$x$')}</th>
                <th>${renderMath('$-\\infty$')}</th>
                <th></th>
                <th>${renderMath('$+\\infty$')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight:800;background:#f8fafc">${renderMath('$ax^2+bx+c$')}</td>
                <td></td>
                <td style="font-weight:700">Signe de ${renderMath('$a$')} sur ${renderMath('$\\mathbb{R}$')} tout entier</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  }

  return `<div style="text-align:center;margin:0.5rem 0;font-style:italic;color:#64748b">${renderMath(altText)}</div>`;
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
      let p = part.replace(/\\n/g, '\n');
      
      // Force line break after period followed by space and uppercase letter/backslash/math delimiter
      // NOTE: exclude when preceded by a digit (numbered list item like "1. Calculer") or single letter (like "A. Calculer")
      p = p.replace(/(?<!\d|^|\n|\b\d\.[a-zA-Z]|\bex|\betc|\bvs|\b[a-zA-Z])\.\s+([A-ZÀ-ÖØ-ß]|\\|\$)/g, '.\n$1');

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
    if (tok.type === 'block' || tok.type === 'inline') {
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

  // Strip markdown bold markers
  clean = clean.replace(/\*\*/g, '').trim();

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

  let rawText = String(text);
  
  // Split by math blocks to safely replace literal \n outside math without corrupting LaTeX commands like \neq
  const parts = rawText.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);
  const processedParts = parts.map((part, idx) => {
    if (idx % 2 === 1) {
      // Inside math block: only replace literal \n if NOT followed by letters (e.g. KaTeX commands)
      return part.replace(/\\n(?![a-zA-Z])/g, '\n');
    } else {
      // Outside math block: replace all literal \n with real newlines safely
      return part.replace(/\\n/g, '\n');
    }
  });
  rawText = processedParts.join('');

  // Collapse colon followed by newline and math formula into a single line
  rawText = rawText.replace(/(:\s*)\n+\s*(\$\$|\$)/g, ' : $2');

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

  const pointsRegex = /\(\s*([\d.,]+)\s*(?:pts?|points?|\u0646|\u0646\u0642\u0637\u0629?|\u0646\u0642\u0637)\s*\)/i;
  const parenthesizedNumRegex = /^(\s*(?:\d+|[a-zA-Z])[.)]\s*)\(([\d.,]+)\)/;
  const isSubQRegex = /^(\s*(?:\d+|[a-zA-Z])[.)]\s*)/;

  const parsedItems = [];
  mergedLines.forEach(line => {
    let cleanLine = line.trim();
    if (!cleanLine) return;

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

    if (!cleanLine) return;

    const isSubQ = isSubQRegex.test(cleanLine);
    parsedItems.push({
      cleanLine,
      pointsStr,
      isSubQ
    });
  });

  const blocks = [];
  let i = 0;
  while (i < parsedItems.length) {
    const item = parsedItems[i];
    if (item.pointsStr || !item.isSubQ) {
      const block = { headerItem: item, subItems: [] };
      i++;
      while (i < parsedItems.length && parsedItems[i].isSubQ && !parsedItems[i].pointsStr) {
        block.subItems.push(parsedItems[i]);
        i++;
      }
      blocks.push(block);
    } else {
      const block = { headerItem: null, subItems: [] };
      while (i < parsedItems.length && parsedItems[i].isSubQ && !parsedItems[i].pointsStr) {
        block.subItems.push(parsedItems[i]);
        i++;
      }
      if (block.subItems.length === 0) {
        block.subItems.push(item);
        i++;
      }
      blocks.push(block);
    }
  }

  const rows = blocks.map(b => {
    const ptsStr = b.headerItem ? b.headerItem.pointsStr : '';
    const headerHtml = b.headerItem ? `<div>${renderMath(b.headerItem.cleanLine)}</div>` : '';

    let subHtml = '';
    if (b.subItems.length >= 2) {
      const allShort = b.subItems.every(si => si.cleanLine.length < 50);
      const cols = allShort && b.subItems.length >= 3 ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)';
      subHtml = `
        <div class="homework-subquestions-grid" style="display: grid; grid-template-columns: ${cols}; gap: 0.35rem 1.0rem; margin-top: 0.35rem;">
          ${b.subItems.map((si, idx) => {
            const cleanText = si.cleanLine.trim();
            const needsSemi = allShort && idx < b.subItems.length - 1 && !cleanText.endsWith(';') && !cleanText.endsWith(':');
            const displayText = needsSemi ? `${cleanText} ;` : cleanText;
            return `<div class="homework-subq-item" style="padding: 0.1rem 0;">${renderMath(displayText)}</div>`;
          }).join('')}
        </div>`;
    } else if (b.subItems.length === 1) {
      subHtml = `<div style="margin-top: 0.25rem;">${renderMath(b.subItems[0].cleanLine)}</div>`;
    }

    return `
      <div class="homework-row">
        <div class="homework-bareme-cell">${esc(ptsStr)}</div>
        <div class="homework-content-cell">${headerHtml}${subHtml}</div>
      </div>`;
  }).join('');

  return rows;
};

/* ── Calculate total points for Devoir Surveillé homework ── */
const calculateTotalPoints = (text, isArabicMode) => {
  if (!text) return isArabicMode ? '0 ن' : '0 pts';

  let rawText = String(text);
  
  // Split by math blocks to safely replace literal \n outside math without corrupting LaTeX commands like \neq
  const parts = rawText.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);
  const processedParts = parts.map((part, idx) => {
    if (idx % 2 === 1) {
      // Inside math block: only replace literal \n if NOT followed by letters (e.g. KaTeX commands)
      return part.replace(/\\n(?![a-zA-Z])/g, '\n');
    } else {
      // Outside math block: replace all literal \n with real newlines safely
      return part.replace(/\\n/g, '\n');
    }
  });
  rawText = processedParts.join('');

  rawText = rawText
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
  const content = lesson?.content || lesson || {};
  const header = content?.header || {};
  const sections = Array.isArray(content?.sections) ? content.sections : (Array.isArray(lesson?.sections) ? lesson.sections : (Array.isArray(content) ? content : []));
  const isHomework = lesson.docType === 'homework' || content?.doc_type === 'homework';

  const title = header?.fiche_title || lesson?.title || 'Fiche de Cours';
  const subject = header?.subject || '';
  const globalProfName = (typeof window !== 'undefined' && window.localStorage) ? localStorage.getItem('profName') || '' : '';
  const globalProfPhone = (typeof window !== 'undefined' && window.localStorage) ? localStorage.getItem('profPhone') || '' : '';
  const teacher = header?.teacher || globalProfName || '';
  const phone = header?.phone || globalProfPhone || '';
  const prepTitle = header?.prep_title || '';
  const schools = header?.schools || [];
  const isExercises = lesson.docType === 'exercises' || content?.doc_type === 'exercises';
  const isConcours = lesson.docType === 'concours' || content?.doc_type === 'concours';
  const checkArabicText = () => {
    if (content?.metadata?.language === 'ar') return true;
    const textToTest = [
      lesson.title,
      subject,
      header?.fiche_title,
      header?.subject,
      ...(sections || []).map(s => s?.title)
    ].filter(Boolean).join(' ');
    return /[\u0600-\u06FF]/.test(textToTest);
  };
  const isArabic = checkArabicText();
  const levelKey = lesson.level || content?.level || '';
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
  const cleanTitle = (title || 'Fiche').replace(/[\\\/:\*\?"<>\|]/g, '');
  const pdfDocumentTitle = `${cleanLevelKey} - ${docTypeFilename} - ${langFilename} - ${cleanTitle}`;
  const dir = isArabic ? 'rtl' : 'ltr';
  const arabicFontFamily = "'UKIJMerdaneRegular', 'Cairo', 'Amiri', 'Noto Naskh Arabic', Arial, sans-serif";
  const bodyFont = isArabic ? arabicFontFamily : "'Computer Modern Serif', 'STIX Two Text', 'Times New Roman', serif";

  // Set module-level RTL flag for renderLine
  _rtlMode = isArabic;

  const formatTeacherName = (name) => {
    if (!name) return '';
    return name.replace(/^prof[:.\s]*/i, '').replace(/^pr[:.\s]*/i, '').replace(/^أستاذ[:.\s]*/i, '').trim();
  };

  const renderItemHtml = (item) => {
    if (!item) return '';
    if (item.type === 'highlight_box') {
      return `<div class="highlight-box">${renderMath(item.text)}</div>`;
    } else if (item.type === 'notation_grid') {
      let colsHtml = '';
      item.notation_columns?.forEach((col) => {
        let blocksHtml = '';
        col.math_blocks?.forEach((block) => {
          blocksHtml += `<div style="display:block;margin:0.2rem 0">${renderMath(block)}</div>`;
        });
        colsHtml += `<div class="notation-column">
          <strong style="font-size:0.85rem;color:#005086">${esc(col.title)}</strong>
          ${blocksHtml}
        </div>`;
      });
      return `<div class="notation-grid">${colsHtml}</div>`;
    } else if (item.type === 'table') {
      let headersHtml = '';
      item.table_data?.headers?.forEach(h => { headersHtml += `<th>${renderMath(h)}</th>`; });
      let rowsHtml = '';
      item.table_data?.rows?.forEach(row => {
        let cellsHtml = '';
        row.forEach(cell => { cellsHtml += `<td>${renderMath(cell)}</td>`; });
        rowsHtml += `<tr>${cellsHtml}</tr>`;
      });
      return `<div style="overflow-x:auto;width:100%;margin:0.4rem 0">
        <table class="sheet-table">
          <thead><tr>${headersHtml}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
    } else if (item.type === 'image') {
      const align = item.align || 'center';
      const widthPct = item.width_pct || 80;
      const textAlign = align;
      const rawUrl = (item.url || '').trim();
      const altText = item.alt || item.description || '';
      const altLower = altText.toLowerCase();
      const urlLower = rawUrl.toLowerCase();

      const isInvalidUrl = !rawUrl || rawUrl.length < 5 || rawUrl.includes('placeholder') || rawUrl.includes('example.com') || rawUrl === 'none' || rawUrl === 'url' || rawUrl === 'image';
      const isSignTable = altLower.includes('tableau de signe') || altLower.includes('sign_table') || urlLower.includes('sign_table');

      if (isSignTable) {
        return generateSignTableHtml(altText || rawUrl);
      } else if (isInvalidUrl) {
        return `<div style="text-align:${textAlign};margin:0.75rem 0">
          <div style="display:inline-block;padding:0.75rem 1rem;background:#f8fafc;border:1px solid #cbd5e1;border-radius:12px;box-shadow:0 3px 12px rgba(0,0,0,0.04);max-width:${widthPct}%;">
            <div style="font-size:1.5rem;margin-bottom:0.25rem">📈</div>
            <div style="font-size:0.82rem;font-weight:700;color:#334155;">${altText ? renderMath(altText) : (isArabic ? 'شكل هندسي / منحنى دالة' : 'Figure / Courbe représentative')}</div>
          </div>
        </div>`;
      } else {
        return `<div style="text-align:${textAlign};margin:0.75rem 0">
          <div style="display:inline-block;padding:0.6rem;background:#ffffff;border:1px solid #cbd5e1;border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,0.05);max-width:${widthPct}%;">
            <img src="${esc(item.url)}" alt="${esc(altText)}"
              style="width:100%;max-width:100%;border-radius:8px;object-fit:contain;"
            />
            ${altText ? `<div style="font-size:0.8rem;font-weight:700;color:#475569;margin-top:0.4rem;text-align:center">${renderMath(altText)}</div>` : ''}
          </div>
        </div>`;
      }
    } else if (item.type === 'grid_items' || Array.isArray(item.grid_items)) {
      const gList = item.grid_items || item.items || [];
      let tableRows = '';
      for (let i = 0; i < gList.length; i += 2) {
        const item1 = gList[i];
        const item2 = gList[i + 1];
        const text1 = typeof item1 === 'string' ? item1 : (item1?.text || '');
        const text2 = item2 ? (typeof item2 === 'string' ? item2 : (item2?.text || '')) : '';
        tableRows += `
          <tr>
            <td style="width:50%; padding: 6px 10px; vertical-align: top; border: none;">
              <div style="display:flex; align-items:flex-start; gap:0.4rem;">
                <span style="color:#6366f1; font-weight:800;">•</span>
                <div style="flex:1;">${renderMath(text1)}</div>
              </div>
            </td>
            <td style="width:50%; padding: 6px 10px; vertical-align: top; border: none;">
              ${text2 ? `
              <div style="display:flex; align-items:flex-start; gap:0.4rem;">
                <span style="color:#6366f1; font-weight:800;">•</span>
                <div style="flex:1;">${renderMath(text2)}</div>
              </div>` : ''}
            </td>
          </tr>
        `;
      }
      return `<table style="width:100%; border-collapse:collapse; margin: 8px 0; border: none;"><tbody>${tableRows}</tbody></table>`;
    } else {
      // bullet or text
      const bulletDot = item.type === 'bullet'
        ? `<span class="bullet-dot" style="${isArabic ? 'margin-left:0.4rem;margin-right:0' : ''}">•</span>`
        : '';
      const bulletStyle = isArabic
        ? 'flex-direction:row;text-align:right;'
        : '';
      return `<div class="bullet-item" style="${bulletStyle}">${bulletDot}<span style="flex:1;font-family:${isArabic ? arabicFontFamily : 'inherit'}">${renderMath(item.text)}</span></div>`;
    }
  };

  /* ── Build sections HTML ── */
  let sectionsHtml = '';
  let prevSectionHeader = null;

  sections?.forEach((sec, idx) => {
    const isTheory = sec.type !== 'exercise';

    // Section header row — shown only for theory/lesson docs, not exercise sheets
    if (!isExercises && sec.section_header && sec.section_header !== prevSectionHeader) {
      sectionsHtml += `
        <div style="text-align: center; margin: 0.7rem 0 0.3rem; page-break-after: avoid;">
          <h2 style="font-size: 1.05rem; font-weight: 800; font-style: italic; color: #0f172a; margin: 0; font-family: ${isArabic ? arabicFontFamily : 'inherit'}">
            ${renderLineContent(sec.section_header || '')}
          </h2>
        </div>`;
      prevSectionHeader = sec.section_header;
    }

    if (isTheory) {
      // Theory/content subsection
      const hasImageItem = sec.items?.some(item => item.type === 'image');
      let itemsHtml = '';

      if (hasImageItem) {
        const imageItem = sec.items.find(item => item.type === 'image');
        const nonImageItems = sec.items.filter(item => item.type !== 'image');
        const widthPct = imageItem.width_pct || 80;
        const align = imageItem.align || 'center';

        if (nonImageItems.length === 0 || align === 'center' || widthPct >= 70) {
          // Full-width / Centered Figure Block
          sec.items.forEach((item) => {
            itemsHtml += renderItemHtml(item);
          });
        } else {
          // Side-by-Side layout for small side images (widthPct < 70)
          let nonImageHtml = '';
          nonImageItems.forEach((item) => {
            nonImageHtml += renderItemHtml(item);
          });

          const rawUrl = (imageItem.url || '').trim();
          const altText = imageItem.alt || imageItem.description || '';
          const altLower = altText.toLowerCase();
          const urlLower = rawUrl.toLowerCase();

          const isInvalidUrl = !rawUrl || rawUrl.length < 5 || rawUrl.includes('placeholder') || rawUrl.includes('example.com') || rawUrl === 'none' || rawUrl === 'url' || rawUrl === 'image';
          const isSignTable = altLower.includes('tableau de signe') || altLower.includes('sign_table') || urlLower.includes('sign_table');

          let imgHtml = '';
          if (isSignTable) {
            imgHtml = generateSignTableHtml(altText || rawUrl);
          } else if (isInvalidUrl) {
            imgHtml = `
              <div class="side-image-wrapper" style="min-width:220px; max-width:400px; flex-shrink:0; text-align:center;">
                <div style="padding:0.75rem 1rem;background:#f8fafc;border:1px solid #cbd5e1;border-radius:12px;box-shadow:0 3px 12px rgba(0,0,0,0.04);">
                  <div style="font-size:1.5rem;margin-bottom:0.2rem">📈</div>
                  <div style="font-size:0.8rem;font-weight:700;color:#334155">${altText ? renderMath(altText) : (isArabic ? 'شكل هندسي / منحنى دالة' : 'Figure / Courbe')}</div>
                </div>
              </div>`;
          } else {
            imgHtml = `
              <div class="side-image-wrapper" style="min-width:220px; max-width:420px; flex-shrink:0; text-align:center;">
                <div style="padding:0.6rem;background:#ffffff;border:1px solid #cbd5e1;border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,0.05)">
                  <img src="${esc(imageItem.url)}" alt="${esc(altText)}"
                    style="width:100%; max-width:100%; border-radius:8px; object-fit:contain;"
                  />
                  ${altText ? `<div style="font-size:0.8rem; font-weight:700; color:#475569; margin-top:0.35rem">${renderMath(altText)}</div>` : ''}
                </div>
              </div>`;
          }

          const flexDir = isArabic ? 'row-reverse' : 'row';
          itemsHtml = `
            <div class="side-by-side-container" style="display:flex; flex-direction:${flexDir}; gap:1.2rem; align-items:center; width:100%; justify-content:space-between;">
              <div style="flex:1; display:flex; flex-direction:column; gap:0.25rem;">
                ${nonImageHtml}
              </div>
              ${imgHtml}
            </div>`;
        }
      } else {
        sec.items?.forEach((item) => {
          itemsHtml += renderItemHtml(item);
        });
      }

      const type = sec.type || 'content';
      let cleanTitleText = (sec.title || '').trim();
      const titleLower = cleanTitleText.toLowerCase();
      const isDefinition = type === 'definition' || titleLower.includes('définition') || titleLower.includes('definition') || titleLower.includes('تعريف');
      const isProperty = type === 'property' || titleLower.includes('propriété') || titleLower.includes('propriete') || titleLower.includes('خاصية');
      const isTheorem = type === 'theorem' || titleLower.includes('théorème') || titleLower.includes('theoreme') || titleLower.includes('مبرهنة');
      const isCorollary = type === 'corollary' || titleLower.includes('corollaire') || titleLower.includes('نتيجة');
      const isExample = type === 'example' || titleLower.includes('exemple') || titleLower.includes('مثال');
      const isRemark = type === 'remark' || titleLower.includes('remarque') || titleLower.includes('ملاحظة');
      const isActivity = type === 'activity' || titleLower.includes('activité') || titleLower.includes('activite') || titleLower.includes('تطبيق');
      const isTechnique = type === 'technique' || titleLower.includes('technique');

      let prefix = '';
      const isBoxed = isDefinition || isProperty || isTheorem || isCorollary;
      let borderAccentColor = '#0284c7';

      const stripSectionKeyword = (text, keywordRegex) => {
        if (!text) return '';
        let cleaned = text.replace(/^[*\s_#.\-0-9📌🔍💡✨⚖️🎯🚀🛠️]+/gu, '').trim();
        cleaned = cleaned.replace(keywordRegex, '').trim();
        cleaned = cleaned.replace(/^[*_:\-\s]+|[*_:\-\s]+$/g, '').trim();
        return cleaned;
      };

      if (isDefinition) {
        prefix = `<span class="doc-badge-pill badge-def">${isArabic ? '📌 تعريف :' : '📌 Définition :'}</span>`;
        cleanTitleText = stripSectionKeyword(cleanTitleText, /^(D[ée]finitions?|definition|تعريف)\s*[:\-]*\s*/i);
        borderAccentColor = '#7c3aed';
      } else if (isProperty) {
        prefix = `<span class="doc-badge-pill badge-prop">${isArabic ? '✨ خاصية :' : '✨ Propriété :'}</span>`;
        cleanTitleText = stripSectionKeyword(cleanTitleText, /^(Propri[ée]t[ée]s?|propriete|خاصية)\s*[:\-]*\s*/i);
        borderAccentColor = '#0284c7';
      } else if (isTheorem) {
        prefix = `<span class="doc-badge-pill badge-thm">${isArabic ? '⚖️ مبرهنة :' : '⚖️ Théorème :'}</span>`;
        cleanTitleText = stripSectionKeyword(cleanTitleText, /^(Th[ée]or[èe]mes?|theoreme|مبرهنة)\s*[:\-]*\s*/i);
        borderAccentColor = '#10b981';
      } else if (isCorollary) {
        prefix = `<span class="doc-badge-pill badge-cor">${isArabic ? '🎯 نتيجة :' : '🎯 Corollaire :'}</span>`;
        cleanTitleText = stripSectionKeyword(cleanTitleText, /^(Corollaires?|نتيجة)\s*[:\-]*\s*/i);
        borderAccentColor = '#f59e0b';
      } else if (isExample) {
        prefix = `<span class="doc-badge-pill badge-ex">${isArabic ? '💡 مثال :' : '💡 Exemple :'}</span>`;
        cleanTitleText = stripSectionKeyword(cleanTitleText, /^(Exemples?|مثال)\s*[:\-]*\s*/i);
      } else if (isRemark) {
        prefix = `<span class="doc-badge-pill badge-rem">${isArabic ? '🔍 ملاحظة :' : '🔍 Remarque :'}</span>`;
        cleanTitleText = stripSectionKeyword(cleanTitleText, /^(Remarques?|ملاحظة)\s*[:\-]*\s*/i);
      } else if (isActivity) {
        prefix = `<span class="doc-badge-pill badge-act">${isArabic ? '🚀 نشاط :' : '🚀 Activité :'}</span>`;
        cleanTitleText = stripSectionKeyword(cleanTitleText, /^(Activit[ée]s?|activite|نشاط|تطبيق)\s*[:\-]*\s*/i);
      } else if (isTechnique) {
        prefix = `<span class="doc-badge-pill badge-tech">🛠️ Technique :</span>`;
        cleanTitleText = stripSectionKeyword(cleanTitleText, /^(Techniques?)\s*[:\-]*\s*/i);
      }

      let cardStyles = `margin-bottom: 0.5rem; padding: 0.2rem 0; display: flex; flex-direction: column; gap: 0.2rem; page-break-inside: avoid;`;
      let headerStyles = `font-size: 0.95rem; font-weight: 800; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;`;

      if (isArabic) {
        cardStyles += ` font-family: ${arabicFontFamily}; direction: rtl; text-align: right;`;
      }

      if (isBoxed) {
        sectionsHtml += `
          <div style="${cardStyles}">
            <div style="${headerStyles}">${prefix}${cleanTitleText ? ' ' + renderLineContent(cleanTitleText) : ''}</div>
            ${sec.accent_text ? `<div style="color:#0f766e;font-weight:700;font-style:italic;margin-bottom:0.2rem">${renderMath((sec.accent_text || '').replace(/\\n/g, '\n'))}</div>` : ''}
            <div style="border: 1px solid #cbd5e1; border-left: 4px solid ${borderAccentColor}; border-radius: 8px; background: #ffffff; box-shadow: 0 2px 10px rgba(0,0,0,0.03); padding: 0.6rem 0.85rem; margin-top: 0.1rem;">
              ${itemsHtml}
            </div>
          </div>`;
      } else {
        // Examples, Remarks, Activities, Technique: NO frame, just content flows below the title
        sectionsHtml += `
          <div style="${cardStyles}">
            <div style="${headerStyles}">${prefix}${cleanTitleText ? ' ' + renderLineContent(cleanTitleText) : ''}</div>
            ${sec.accent_text ? `<div style="color:#009688;font-weight:700;font-style:italic;margin-bottom:0.1rem">${renderMath((sec.accent_text || '').replace(/\\n/g, '\n'))}</div>` : ''}
            ${itemsHtml}
          </div>`;
      }

    } else {
      // Exercise section
      const { number: exeNumber, label: exeLabel } = parseExerciseTitle(sec.title, idx, isArabic);
      const isHomework = lesson.docType === 'homework' || content?.doc_type === 'homework';

      // Render any attached images or tables in exercise items
      let exerciseBeforeHtml = '';
      let exerciseAfterHtml = '';
      if (Array.isArray(sec.items)) {
        sec.items.forEach(it => {
          if (it.type === 'image' || it.type === 'table') {
            if (it.position === 'before') {
              exerciseBeforeHtml += renderItemHtml(it);
            } else {
              exerciseAfterHtml += renderItemHtml(it);
            }
          }
        });
      }

      if (isHomework) {
        sectionsHtml += `
          <div class="homework-table" ${isArabic ? `style="font-family:${arabicFontFamily}"` : ''}>
            <div class="homework-header-row">
              <div class="homework-bareme-header">${calculateTotalPoints(sec.content, isArabic)}</div>
              <div class="homework-content-header">
                ${isArabic ? 'تمرين' : 'Exercice'} ${esc(exeNumber)} ${exeLabel ? ` : ${esc(exeLabel)}` : ''}
              </div>
            </div>
            ${exerciseBeforeHtml ? `<div class="homework-row" style="padding: 0.5rem 1rem;">${exerciseBeforeHtml}</div>` : ''}
            ${renderHomeworkBody(sec.content, isArabic)}
            ${exerciseAfterHtml ? `<div class="homework-row" style="padding: 0.5rem 1rem;">${exerciseAfterHtml}</div>` : ''}
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
            <div class="exercise-body" ${isArabic ? 'style="border-left:none;border-right:4px solid #005086;border-radius:6px 4px 4px 6px;text-align:right;direction:rtl"' : ''}>
              ${exerciseBeforeHtml}
              ${renderMath(sec.content)}
              ${exerciseAfterHtml}
            </div>
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
  margin: 6mm 8mm;
  @bottom-left {
    content: "${esc(teacher || (isArabic ? 'زياتي محمد' : 'Pr. LATRACH ABDELKBIR'))}";
    font-family: 'Computer Modern Serif', 'STIX Two Text', 'Times New Roman', serif;
    font-size: 8pt;
    color: #475569;
  }
  @bottom-right {
    content: "Page | " counter(page);
    font-family: 'Computer Modern Serif', 'STIX Two Text', 'Times New Roman', serif;
    font-size: 8pt;
    color: #475569;
    font-weight: bold;
  }
}

@page :first {
  @bottom-left { content: none; }
  @bottom-right { content: none; }
}

html {
  font-size: 10pt;
}

body {
  font-family: 'Cambria', 'STIX Two Text', 'Liberation Serif', 'Times New Roman', serif;
  color: #0f172a;
  background: #ffffff;
  line-height: 1.6;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
  font-feature-settings: 'liga' 1, 'kern' 1;
}

@media print {
  body {
    border: none !important;
    padding: 0 !important;
    min-height: auto;
  }
}

/* Fiche pedagogique header grid — royal blue layout */
.fiche-pedagogique-header {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  border: 1.5px solid #005086;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 0.75rem;
  font-size: 8.5pt;
  line-height: 1.35;
  color: #1e293b;
  background-color: #ffffff;
  box-shadow: 0 2px 8px rgba(0,80,134,0.06);
  font-family: inherit;
}
.fiche-pedagogique-header td {
  border-right: 1.5px solid #005086;
  border-bottom: 1.5px solid #005086;
  vertical-align: top;
}
.fiche-pedagogique-header td:last-child {
  border-right: none;
}
.fiche-pedagogique-header tr:last-child td {
  border-bottom: none;
}
.fiche-pedagogique-header .title-cell {
  background: #005086;
  text-align: center;
  font-weight: 900;
  font-size: 13.5pt;
  color: #ffffff;
  padding: 10px 14px;
  letter-spacing: 0.04em;
  border-bottom: 1.5px solid #005086;
}
.fiche-pedagogique-header .header-section-title {
  font-weight: 800;
  text-align: center;
  background-color: #f8fafc;
  border-bottom: 1.5px solid #005086;
  padding: 5px 8px;
  font-size: 8.2pt;
  color: #005086;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.fiche-pedagogique-header .right-info-table td {
  padding: 5px 8px;
  font-size: 8pt;
  border-bottom: 1.5px solid #005086;
  color: #1e293b;
}
.fiche-pedagogique-header .right-info-table tr:last-child td {
  border-bottom: none;
}

/* Badge pill styles for definitions, properties, theorems, etc. */
.doc-badge-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 800;
  margin-right: 6px;
  text-decoration: none !important;
}
.badge-def { background: #f3e8ff; color: #6b21a8; border: 1px solid #d8b4fe; }
.badge-prop { background: #e0f2fe; color: #0369a1; border: 1px solid #7dd3fc; }
.badge-thm { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
.badge-cor { background: #fef3c7; color: #b45309; border: 1px solid #fcd34d; }
.badge-ex { background: #ffe4e6; color: #be123c; border: 1px solid #fca5a5; }
.badge-rem { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; }
.badge-act { background: #ccfbf1; color: #0f766e; border: 1px solid #5eead4; }
.badge-tech { background: #fae8ff; color: #86198f; border: 1px solid #f0abfc; }


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

.katex-display {
  display: inline-block !important;
  margin: 0.15em 0.35em !important;
  vertical-align: middle !important;
  text-align: left !important;
}
.katex-display > .katex {
  display: inline-block !important;
  text-align: left !important;
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
    padding: 6mm 8mm;
    background: #fff;
    box-shadow: 0 0 40px rgba(0,0,0,0.08);
  }
}

/* ═══════════════════════════════════════
   HEADER — Designer 2026 Academic Grid
   ═══════════════════════════════════════ */
.fiche-header {
  display: grid;
  grid-template-columns: 1.18fr 1.68fr 1.18fr auto;
  background-color: #005086;
  gap: 1.5px;
  border: 1.5px solid #005086;
  border-radius: 7px;
  margin-bottom: 0.8rem;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 80, 134, 0.08);
}

.fiche-header .hcell {
  padding: 6px 12px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  background-color: #ffffff;
}

/* Left & Right Info Cells */
.fiche-header .h-left {
  background-color: #f8fafc;
  justify-content: center;
}

.fiche-header .h-right {
  background-color: #f8fafc;
  justify-content: center;
  align-items: flex-end;
  text-align: right;
}

.header-info-row {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 8.5pt;
  line-height: 1.35;
  color: #334155;
  white-space: nowrap;
}

.header-info-row .info-label {
  font-size: 8pt;
  color: #64748b;
  font-weight: 600;
}

.header-info-row .info-val {
  color: #0f172a;
  font-weight: 700;
  font-size: 8.5pt;
}

.header-info-row .info-val-level {
  color: #005086;
  font-weight: 800;
  font-size: 8.8pt;
}

/* Center Hero Title */
.fiche-header .h-center {
  background-color: #ffffff;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 4px;
  padding: 6px 8px;
}

.header-title-text {
  color: #005086;
  font-weight: 900;
  font-size: 13pt;
  line-height: 1.2;
  letter-spacing: -0.01em;
  text-align: center;
  max-width: 100%;
}

.header-badge-type {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 80, 134, 0.07);
  color: #005086;
  font-size: 7.2pt;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 1.5px 10px;
  border-radius: 12px;
  border: 1px solid rgba(0, 80, 134, 0.2);
}

/* QR Code Cell */
.fiche-header .h-page {
  background-color: #005086;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 5px 8px;
  gap: 2px;
}

.fiche-header .h-page .qr-wrapper {
  background-color: #ffffff;
  padding: 2.5px;
  border-radius: 4px;
  display: inline-flex;
  box-shadow: 0 1px 4px rgba(0,0,0,0.15);
}

.fiche-header .h-page .qr-img {
  width: 42px;
  height: 42px;
  display: block;
}

.fiche-header .h-page .qr-label {
  font-size: 6pt;
  font-weight: 900;
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  line-height: 1;
}

/* RTL Layout support for Header */
html[dir="rtl"] .fiche-header .h-left {
  align-items: flex-start;
  text-align: right;
}

html[dir="rtl"] .fiche-header .h-right {
  align-items: flex-end;
  text-align: left;
}

html[dir="rtl"] .header-info-row {
  flex-direction: row;
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
   BULLET ITEMS
   ═══════════════════════════════════════ */
.bullet-item {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  line-height: 1.55;
  margin-bottom: 0.1rem;
}
.bullet-dot {
  color: #005086;
  font-size: 1.1rem;
  line-height: 1;
  margin-top: 0.15rem;
  flex-shrink: 0;
}

/* ═══════════════════════════════════════
   HIGHLIGHT BOX (green tint like reference)
   ═══════════════════════════════════════ */
.highlight-box {
  background: rgba(144, 238, 144, 0.25);
  border: none;
  padding: 0.3rem 0.6rem;
  margin: 0.15rem 0;
  line-height: 1.55;
  text-align: center;
  font-style: italic;
  font-weight: 500;
}

/* ═══════════════════════════════════════
   NOTATION GRID
   ═══════════════════════════════════════ */
.notation-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
  margin: 0.2rem 0;
  padding: 0.2rem 0;
  background: transparent;
  border: none;
}
.notation-column {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  border-left: none;
  padding-left: 0.5rem;
}

/* ═══════════════════════════════════════
   TABLES
   ═══════════════════════════════════════ */
.sheet-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0.4rem;
  border: none;
  font-size: 0.92rem;
}
.sheet-table th,
.sheet-table td {
  border: none;
  border-bottom: 1px solid #cbd5e1;
  padding: 0.45rem 0.6rem;
  text-align: center;
  color: #1a202c;
}
.sheet-table th {
  background: transparent;
  font-weight: 800;
  color: #005086;
  border-bottom: 2px solid #005086;
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
  border: none;
  background: transparent;
  padding: 0.2rem 0;
  line-height: 1.6;
}

/* ═══════════════════════════════════════
   SOLUTION BLOCK
   ═══════════════════════════════════════ */
.solution-block {
  background: transparent;
  border: none;
  border-top: 1px dashed rgba(16,185,129,0.3);
  padding: 0.4rem 0;
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
  background: transparent;
  border: none;
  padding: 0.25rem 0;
  margin: 0.3rem 0;
  color: #059669;
}
.mfc-callout-attention {
  background: transparent;
  border: none;
  padding: 0.25rem 0;
  margin: 0.3rem 0;
  color: #d97706;
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
   KATEX — PREMIUM ACADEMIC TYPOGRAPHY
   ═══════════════════════════════════════ */

/* Base: all KaTeX elements inherit color, never bold from context */
.katex,
.katex *,
.katex .mathnormal,
.katex .mord,
.katex .mbin,
.katex .mrel,
.katex .mopen,
.katex .mclose,
.katex .mpunct,
.katex .minner,
.katex .mop {
  color: #0f172a !important;
  font-weight: normal !important;
}

/* Explicit \mathbf{} remains bold — by design */
.katex .mathbf,
.katex .mathbf * {
  font-weight: bold !important;
}

/* Inline math containers: crisp, no-wrap, elegant */
.inline-math-container,
.katex-inline {
  white-space: nowrap !important;
  display: inline-block !important;
  vertical-align: -0.04em !important;
  font-weight: normal !important;
}

/* KaTeX base spans */
.inline-math-container .katex .base {
  white-space: nowrap !important;
  display: inline !important;
  font-weight: normal !important;
}

/* Inline math size: perfectly matches 10pt text size and optical weight */
.inline-math-container .katex,
.katex-inline .katex {
  font-size: 0.95em !important;
  color: #0f172a !important;
  font-weight: normal !important;
}

/* Block display-mode math: visible breathing room */
.katex-display {
  margin: 0.45rem 0 !important;
  white-space: normal !important;
  font-size: 1.0em !important;
  color: #0f172a !important;
}

/* Strong / bold context must NOT propagate weight into math */
strong .katex,
b .katex,
strong .katex *,
b .katex * {
  font-weight: normal !important;
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
  font-size: 0.92em !important;
}
.exercises-two-columns .katex,
.exercises-two-columns .katex-html {
  white-space: normal !important;
  display: inline !important;
  font-size: 0.93em !important;
}
.exercises-two-columns .katex .base {
  white-space: nowrap !important;
  display: inline-block !important;
  margin-top: 1px;
  margin-bottom: 1px;
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
  border-radius: 4px;
  overflow: visible;
  margin-bottom: 0.8rem;
  page-break-inside: auto;
  break-inside: auto;
  box-shadow: 0 2px 8px rgba(0,80,134,0.04);
}
.homework-header-row {
  display: flex;
  background: #005086;
  color: #ffffff;
  font-weight: 800;
  border-bottom: 1.5px solid #005086;
  align-items: stretch;
  page-break-after: avoid;
  break-after: avoid;
}
.homework-bareme-header {
  width: 75px;
  min-width: 75px;
  background: #005086;
  color: #ffffff;
  border-right: 1.5px solid #ffffff;
  text-align: center;
  font-size: 0.88rem;
  padding: 0.45rem 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
.homework-content-header {
  flex: 1;
  background: #005086;
  color: #ffffff;
  font-weight: 800;
  font-size: 0.95rem;
  padding: 0.45rem 0.85rem;
  display: flex;
  align-items: center;
}
.homework-row {
  display: flex;
  border-bottom: 1px solid #cbd5e1;
  align-items: stretch;
  page-break-inside: avoid;
  break-inside: avoid;
}
.homework-row:last-child {
  border-bottom: none;
}
.homework-bareme-cell {
  width: 75px;
  min-width: 75px;
  background: #f8fafc;
  color: #475569;
  border-right: 1.5px solid #005086;
  font-weight: 600;
  font-size: 0.82rem;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 0.3rem;
}
.homework-content-cell {
  flex: 1;
  padding: 0.55rem 0.85rem;
  font-size: 0.92rem;
  line-height: 1.6;
  color: #0f172a;
}

@media print {
  .sections-container, .sections-list-container {
    overflow: visible !important;
  }
  .homework-table {
    display: table !important;
    width: 100% !important;
    border-collapse: collapse !important;
    border: 1.5px solid #005086 !important;
    overflow: visible !important;
    page-break-inside: auto !important;
    break-inside: auto !important;
  }
  .homework-header-row {
    display: table-row !important;
    background: #005086 !important;
    color: #ffffff !important;
    page-break-after: avoid !important;
    break-after: avoid !important;
  }
  .homework-row {
    display: table-row !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  .homework-bareme-cell, .homework-bareme-header {
    display: table-cell !important;
    width: 75px !important;
    min-width: 75px !important;
    max-width: 75px !important;
    vertical-align: middle !important;
    background: #f8fafc !important;
    border-right: 1.5px solid #005086 !important;
  }
  .homework-bareme-header {
    background: #005086 !important;
    color: #ffffff !important;
    border-right: 1.5px solid #ffffff !important;
  }
  .homework-content-cell, .homework-content-header {
    display: table-cell !important;
    vertical-align: top !important;
    padding: 0.45rem 0.75rem !important;
  }
  .homework-content-header {
    background: #005086 !important;
    color: #ffffff !important;
  }
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
  <!-- NEW 2026 DESIGNER HEADER: exercises and homework -->
  <div class="fiche-header" ${isArabic ? `style="font-family:${arabicFontFamily}"` : ''}>
    <div class="hcell h-left">
      ${teacher ? `<div class="header-info-row"><span class="info-label">${isArabic ? 'الأستاذ' : 'Prof'} :</span><strong class="info-val">${esc(formatTeacherName(teacher))}</strong></div>` : ''}
      <div class="header-info-row"><span class="info-label">${isArabic ? 'السنة الدراسية' : 'A.S'} :</span><span class="info-val">${new Date().getFullYear() - 1}/${new Date().getFullYear()}</span></div>
      ${schools.length ? `<div class="header-info-row"><span class="info-label">${isArabic ? 'المؤسسة' : 'Établissement'} :</span><span class="info-val">${esc(schools[0])}</span></div>` : ''}
    </div>
    <div class="hcell h-center">
      <div class="header-title-text">${esc(title)}</div>
      <div class="header-badge-type">${isArabic ? (isHomework ? 'فرض محروس' : 'سلسلة تمارين') : (isHomework ? 'Devoir Surveillé' : 'Série d\'exercices')}</div>
    </div>
    <div class="hcell h-right">
      ${levelText ? `<div class="header-info-row"><span class="info-label">${isArabic ? 'المستوى' : 'Niveau'} :</span><strong class="info-val-level">${esc(levelText)}</strong></div>` : ''}
      ${schools.length > 1 ? `<div class="header-info-row"><span class="info-label">${isArabic ? 'المؤسسة' : 'Lycée'} :</span><span class="info-val">${esc(schools[1])}</span></div>` : ''}
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
  <table class="fiche-pedagogique-header">
    <tr>
      <!-- Left Side (73% width) -->
      <td style="width: 73%; padding: 0;" rowspan="1">
        <table style="width: 100%; border-collapse: collapse; height: 100%;">
          <tr>
            <td colspan="2" class="title-cell">
              ${esc(title)}
            </td>
          </tr>
          <tr>
            <td style="width: 50%; padding: 0;">
              <div class="header-section-title">${isArabic ? 'القدرات المنتظرة' : 'Les capacités attendues'}</div>
              <div style="padding: 6px 10px; font-size: 8.2pt; min-height: 50px; font-family: ${isArabic ? arabicFontFamily : 'inherit'}">
                ${renderMath(lesson.header?.capacites_attendues || lesson.header?.capacites || lesson.content?.capacites_attendues || '')}
              </div>
            </td>
            <td style="width: 50%; padding: 0;">
              <div class="header-section-title">${isArabic ? 'المحتويات' : 'Contenus'}</div>
              <div style="padding: 6px 10px; font-size: 8.2pt; min-height: 50px; font-family: ${isArabic ? arabicFontFamily : 'inherit'}">
                ${renderMath(lesson.header?.contenus || lesson.header?.prerequisites || lesson.content?.contenus || '')}
              </div>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding: 0;">
              <div class="header-section-title">${isArabic ? 'المحتوى' : 'Le contenu'}</div>
              <div style="padding: 6px 10px; font-size: 8.2pt; min-height: 40px; font-family: ${isArabic ? arabicFontFamily : 'inherit'}">
                ${renderMath(lesson.header?.le_contenu || lesson.header?.overview || lesson.content?.le_contenu || '')}
              </div>
            </td>
          </tr>
        </table>
      </td>
      
      <!-- Right Side (27% width) -->
      <td style="width: 27%; padding: 0;">
        <table class="right-info-table" style="width: 100%; border-collapse: collapse; height: 100%;">
          <tr>
            <td style="font-family: ${isArabic ? arabicFontFamily : 'inherit'}"><strong>${isArabic ? 'الأكاديمية' : 'Académie'} :</strong><br/>${esc(lesson.header?.academie || (isArabic ? 'فاس - مكناس' : 'FES-MEKNES'))}</td>
          </tr>
          <tr>
            <td style="font-family: ${isArabic ? arabicFontFamily : 'inherit'}"><strong>${isArabic ? 'المديرية الإقليمية' : 'Direction Provinciale'} :</strong><br/>${esc(lesson.header?.direction || (isArabic ? 'مكناس' : 'MY'))}</td>
          </tr>
          <tr>
            <td style="font-family: ${isArabic ? arabicFontFamily : 'inherit'}"><strong>${isArabic ? 'المؤسسة' : 'Etablissement'} :</strong><br/>${esc(lesson.header?.etablissement || schools[0] || (isArabic ? '18 نونبر' : '18 NOVEMBRE'))}</td>
          </tr>
          <tr>
            <td style="font-family: ${isArabic ? arabicFontFamily : 'inherit'}">
              <strong>${isArabic ? 'الأهمية' : "Degré d'importance"} :</strong><br/>
              <span style="background-color: #fef08a; padding: 1px 5px; font-weight: 800; color: #854d0e; font-size: 8.5pt; display: inline-block; margin-top: 2px;">${esc(lesson.header?.degre_importance || '40%')}</span>
            </td>
          </tr>
          <tr>
            <td style="font-family: ${isArabic ? arabicFontFamily : 'inherit'}; border-bottom: none;">
              <strong>${isArabic ? 'ملاحظات' : 'Remarques'} :</strong><br/>
              ${renderMath(lesson.header?.remarques || '')}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  `}

  <!-- BANNER: only for classic (non-exercise/non-homework) docs -->
  ${/* No duplicate banner — title is already in the header table */''}

  <!-- SECTIONS -->
  <div class="sections-container ${(lesson.docType === 'exercises' || lesson.content?.doc_type === 'exercises') ? 'exercises-two-columns' : ''}">
    ${sectionsHtml}
  </div>

  <!-- FOOTER (teacher name left, page number right — handled by @page CSS) -->
  <div class="fiche-footer" style="display:none"></div>
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
  const isSeriesOrHomework = lesson?.docType === 'exercises' || lesson?.docType === 'homework' || lesson?.content?.doc_type === 'exercises' || lesson?.content?.doc_type === 'homework' || /سلسلة|s[ée]rie|devoir|فرض/i.test(lesson?.title || '');
  const isNat = !isSeriesOrHomework && Boolean(lesson?.docType === 'national' || lesson?.content?.doc_type === 'national' || lesson?.content?.header?.is_national_exam || lesson?.is_national_exam);
  if (isNat) {
    return openNationalExamPrintWindow(lesson?.content || lesson, settings);
  }
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

  const win = window.open('', '_blank', 'width=960,height=720,scrollbars=yes');
  if (!win) {
    alert('Veuillez autoriser les popups pour ce site.');
    return;
  }
  try {
    win.document.open();
    win.document.write(html);
    win.document.close();
  } catch (err) {
    console.error('Error writing to print window:', err);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    win.location.href = url;
  }
};
