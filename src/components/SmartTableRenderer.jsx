import React, { useState } from 'react';
import { SafeInlineMath } from '../utils/mathRenderer';
import { Table, Copy, Check } from 'lucide-react';

/**
 * SmartTableRenderer.jsx
 * Composant de rendu haute-précision pour les tableaux scientifiques,
 * tableaux de valeurs, et tableaux de variations (Maths / Physique / Chimie).
 */

/**
 * Convertit une chaîne de caractères Markdown en structure de tableau
 */
export function parseMarkdownTable(text) {
  if (!text || typeof text !== 'string') return null;

  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  // Vérifier si la ligne ressemble à une ligne de tableau (|...|)
  const isTableLine = (l) => l.startsWith('|') && l.endsWith('|');
  const tableLines = lines.filter(isTableLine);

  if (tableLines.length < 2) return null;

  const splitRow = (rowStr) => {
    return rowStr
      .slice(1, -1) // enlever les | du début et de la fin
      .split(/(?<!\\)\|/) // splitter par | non échappé
      .map(c => c.trim());
  };

  const headers = splitRow(tableLines[0]);
  let alignment = [];
  let startIndex = 1;

  // Ligne de séparation (|:---|:---:|---:|)
  if (tableLines.length > 1 && /^\|(?:\s*:?-+:?\s*\|)+$/.test(tableLines[1])) {
    const sepParts = splitRow(tableLines[1]);
    alignment = sepParts.map(part => {
      const left = part.startsWith(':');
      const right = part.endsWith(':');
      if (left && right) return 'center';
      if (right) return 'right';
      return 'left';
    });
    startIndex = 2;
  } else {
    alignment = headers.map(() => 'center');
  }

  const rows = [];
  for (let i = startIndex; i < tableLines.length; i++) {
    const cells = splitRow(tableLines[i]);
    if (cells.length > 0) {
      while (cells.length < headers.length) cells.push('');
      rows.push(cells.slice(0, headers.length));
    }
  }

  // Détecter s'il s'agit d'un tableau de variations
  const isVariationTable = headers.some(h => /\bf['"]?\s*\(x\)|\bsigne\b|\bvariation/i.test(h)) ||
    rows.some(r => r.some(c => /\\nearrow|\\searrow|\+|—|-|0|\|\|/.test(c)));

  return {
    headers,
    alignment,
    rows,
    isVariationTable
  };
}

/**
 * Rendu intelligent et sécurisé du contenu de chaque cellule
 * (supporte LaTeX pur, mixed text + LaTeX avec $, et double barres ||)
 */
export function renderCellContent(content) {
  if (content === null || content === undefined) return '';
  const str = String(content).trim();
  if (!str) return '';

  // Double bar for forbidden values or vertical asymptote
  if (str === '||' || str === '\\parallel' || str === '\\Vert' || str === '|') {
    return <span style={{ color: 'var(--danger, #EF4444)', fontWeight: 800 }}>||</span>;
  }

  // Strip wrapping $$...$$ or $...$
  let cleanMath = str;
  if (cleanMath.startsWith('$$') && cleanMath.endsWith('$$') && cleanMath.length >= 4) {
    cleanMath = cleanMath.slice(2, -2).trim();
    return <SafeInlineMath math={cleanMath} />;
  }
  if (cleanMath.startsWith('$') && cleanMath.endsWith('$') && cleanMath.length >= 2 && (cleanMath.match(/(?<!\\)\$/g) || []).length === 2) {
    cleanMath = cleanMath.slice(1, -1).trim();
    return <SafeInlineMath math={cleanMath} />;
  }

  // If it has inline dollars like "Pour $x > 0$"
  if (cleanMath.includes('$')) {
    const parts = cleanMath.split(/(\$[^$]+\$)/g);
    return (
      <span>
        {parts.map((p, pi) => {
          if (p.startsWith('$') && p.endsWith('$') && p.length >= 2) {
            return <SafeInlineMath key={pi} math={p.slice(1, -1)} />;
          }
          return <span key={pi}>{p}</span>;
        })}
      </span>
    );
  }

  // If it contains typical LaTeX math syntax (e.g. \lim, \infty, \frac, +, -, numbers/variables with subscripts)
  if (/^\\|[\\_^{}=+<>]|\b(lim|infty|frac|sqrt|alpha|beta|pi|theta|sin|cos|tan|ln|exp|searrow|nearrow|to)\b/.test(cleanMath)) {
    return <SafeInlineMath math={cleanMath} />;
  }

  // Plain text (e.g. "F.I.", "Indéterminée", "Signe de f")
  return <span>{cleanMath}</span>;
}

export default function SmartTableRenderer({
  table,
  title = '',
  className = '',
  style = {}
}) {
  const [copied, setCopied] = useState(false);

  let parsedData = null;

  if (typeof table === 'string') {
    parsedData = parseMarkdownTable(table);
  } else if (table && typeof table === 'object') {
    if (Array.isArray(table.headers) && Array.isArray(table.rows)) {
      parsedData = {
        title: table.title || title,
        headers: table.headers,
        rows: table.rows,
        alignment: table.alignment || table.headers.map(() => 'center'),
        isVariationTable: table.isVariationTable ?? (
          table.headers?.some(h => /x|f['"]?\(x\)/i.test(String(h))) &&
          table.rows?.some(r => r.some?.(c => /\\nearrow|\\searrow|\+|—|-|0|\|\|/.test(String(c))))
        )
      };
    }
  }

  if (!parsedData || !parsedData.headers || parsedData.headers.length === 0) {
    return null;
  }

  const { headers, rows, alignment, isVariationTable } = parsedData;
  const tableTitle = parsedData.title || title;

  const handleCopyMarkdown = () => {
    const headerLine = `| ${headers.join(' | ')} |`;
    const sepLine = `| ${headers.map((_, i) => (alignment[i] === 'center' ? ':---:' : alignment[i] === 'right' ? '---:' : ':---')).join(' | ')} |`;
    const rowLines = rows.map(r => `| ${r.join(' | ')} |`).join('\n');
    const md = `${headerLine}\n${sepLine}\n${rowLines}`;

    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`smart-table-wrapper ${className}`}
      style={{
        margin: '1.25rem 0',
        borderRadius: '8px',
        border: '1.5px solid #000000',
        background: '#ffffff',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
        overflow: 'hidden',
        color: '#000000',
        ...style
      }}
    >
      {/* Header bar / Title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.6rem 1rem',
          background: '#f1f5f9',
          borderBottom: '1.5px solid #000000',
          fontSize: '0.85rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a', fontWeight: 800 }}>
          <Table size={16} />
          <span>{tableTitle || (isVariationTable ? 'Tableau de variation / signes' : 'Données du tableau')}</span>
        </div>

        <button
          type="button"
          onClick={handleCopyMarkdown}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.3rem 0.6rem',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: 700,
            background: copied ? '#ecfdf5' : '#ffffff',
            color: copied ? '#059669' : '#334155',
            border: copied ? '1px solid #10b981' : '1px solid #cbd5e1',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          title="Copier le tableau en Markdown"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span>{copied ? 'Copié !' : 'Copier'}</span>
        </button>
      </div>

      {/* Responsive Horizontal Scroll Container */}
      <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.94rem',
            textAlign: 'center',
            color: '#000000',
            background: '#ffffff'
          }}
        >
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #000000' }}>
              {headers.map((h, idx) => (
                <th
                  key={idx}
                  style={{
                    padding: '0.75rem 1rem',
                    fontWeight: 800,
                    color: '#000000',
                    textAlign: alignment[idx] || 'center',
                    borderRight: idx < headers.length - 1 ? '1.5px solid #000000' : 'none',
                    borderBottom: '1.5px solid #000000',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {renderCellContent(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => {
              const isFirstColHeader = isVariationTable;
              return (
                <tr
                  key={rIdx}
                  style={{
                    background: rIdx % 2 === 0 ? '#ffffff' : '#fcfcfd',
                    borderBottom: rIdx < rows.length - 1 ? '1.5px solid #000000' : 'none',
                    transition: 'background 0.15s'
                  }}
                >
                  {row.map((cell, cIdx) => {
                    const isRowHeader = isFirstColHeader && cIdx === 0;
                    const align = alignment[cIdx] || 'center';

                    // Cas spécial : double barre ||
                    const isDoubleBar = cell.trim() === '||' || cell.trim() === '\\parallel' || cell.trim() === '\\Vert';

                    return (
                      <td
                        key={cIdx}
                        style={{
                          padding: isVariationTable ? '0.85rem 1rem' : '0.7rem 1rem',
                          textAlign: align,
                          fontWeight: isRowHeader ? 800 : 500,
                          color: '#000000',
                          borderRight: cIdx < row.length - 1 ? '1.5px solid #000000' : 'none',
                          borderLeft: isDoubleBar ? '3px double #000000' : undefined,
                          background: isRowHeader ? '#f8fafc' : undefined,
                          minWidth: isRowHeader ? '90px' : '70px'
                        }}
                      >
                        {renderCellContent(cell)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
