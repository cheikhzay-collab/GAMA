// src/utils/sanitize.js
// [L-1 FIX] Centralized DOMPurify sanitization utilities
// Use these instead of passing raw HTML to dangerouslySetInnerHTML.
//
// SVG files from the database may contain malicious <script> tags or event handlers.
// DOMPurify strips them while preserving the visual structure.

import DOMPurify from 'dompurify';

// ── SVG-specific config ────────────────────────────────────────────────────────
// Allow SVG tags + presentation attributes, but strip scripts & event handlers
const SVG_CONFIG = {
  USE_PROFILES: { svg: true, svgFilters: true },
  ADD_TAGS: ['use', 'clipPath', 'linearGradient', 'radialGradient', 'stop', 'defs', 'symbol', 'pattern'],
  FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input'],
  FORBID_ATTR: [
    'onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur',
    'onchange', 'onsubmit', 'onkeydown', 'onkeyup', 'onkeypress',
    'onmouseenter', 'onmouseleave', 'onmouseout', 'onmousedown', 'onmouseup',
  ],
};

// ── General HTML config ────────────────────────────────────────────────────────
const HTML_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'b', 'i', 'u', 'strong', 'em', 'span', 'div',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'a', 'img', 'figure', 'figcaption', 'blockquote', 'code', 'pre',
    'sub', 'sup', 'mark', 'del', 'ins',
  ],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'id', 'style', 'target', 'rel', 'colspan', 'rowspan'],
  FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'iframe'],
};

/**
 * Sanitize SVG content from the database for safe rendering.
 * Strips script tags and event handlers (onerror, onload, etc.) while preserving SVG visuals.
 *
 * @param {string} svgString - Raw SVG string
 * @returns {string} - Safe SVG HTML string
 *
 * @example
 *   <div dangerouslySetInnerHTML={{ __html: safeSvg(question.image.slice(4)) }} />
 */
export function safeSvg(svgString) {
  if (!svgString || typeof svgString !== 'string') return '';
  return DOMPurify.sanitize(svgString, SVG_CONFIG);
}

/**
 * Sanitize general HTML content (math, rich text, lesson content).
 *
 * @param {string} html - Raw HTML string
 * @returns {string} - Safe HTML string
 */
export function safeHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return DOMPurify.sanitize(html, HTML_CONFIG);
}

/**
 * Sanitize KaTeX-rendered HTML. KaTeX output is already safe, but DOMPurify
 * adds a defense-in-depth layer in case content is injected before rendering.
 *
 * @param {string} html - KaTeX-rendered HTML
 * @returns {string} - Safe HTML string
 */
export function safeKatex(html) {
  if (!html || typeof html !== 'string') return '';
  return DOMPurify.sanitize(html, {
    ...SVG_CONFIG,
    ADD_TAGS: [
      ...(SVG_CONFIG.ADD_TAGS || []),
      'annotation', 'semantics', 'mrow', 'mi', 'mn', 'mo', 'msup', 'msub',
    ],
    FORCE_BODY: false,
  });
}

export default { safeSvg, safeHtml, safeKatex };
