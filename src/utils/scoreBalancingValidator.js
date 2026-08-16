/**
 * Score Balancing & Moroccan LaTeX Validation Utility for GAMA Platform
 */

const POINTS_REGEX = /\(\s*([\d.,]+)\s*(?:pts?|points?|\u0646|\u0646\u0642\u0637\u0629?|\u0646\u0642\u0637)\s*\)/i;
const BRACKET_POINTS_REGEX = /\[\s*([\d.,]+)\s*(?:pts?|points?|\u0646|\u0646\u0642\u0637\u0629?|\u0646\u0642\u0637)\s*\]/i;

/**
 * Extracts point value from a single line of text.
 * @param {string} text 
 * @returns {number|null}
 */
export function extractPointsFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(POINTS_REGEX) || text.match(BRACKET_POINTS_REGEX);
  if (match) {
    const val = parseFloat(match[1].replace(',', '.'));
    return isNaN(val) ? null : val;
  }
  return null;
}

/**
 * Validates and balances points for a single exercise / section.
 * @param {Object} section 
 * @returns {{ isBalanced: boolean, declaredPoints: number, calculatedSum: number, subQuestions: Array<{ number: string, points: number, text: string }> }}
 */
export function validateExercisePoints(section) {
  if (!section) {
    return { isBalanced: true, declaredPoints: 0, calculatedSum: 0, subQuestions: [] };
  }

  const declaredPoints = parseFloat(section.points) || 0;
  const items = Array.isArray(section.items) ? section.items : [];
  const subQuestions = [];

  // 1. Check items array
  items.forEach((item, idx) => {
    const text = typeof item === 'string' ? item : (item?.text || '');
    const pts = extractPointsFromText(text);
    if (pts !== null) {
      const numMatch = text.match(/^(\*\*|\s)*(\d+|[a-zA-Z])[.)]/);
      const num = numMatch ? numMatch[2] : `#${idx + 1}`;
      subQuestions.push({ number: num, points: pts, text });
    }
  });

  // 2. If no points found in items, check content lines
  if (subQuestions.length === 0 && typeof section.content === 'string') {
    const lines = section.content.split('\n');
    lines.forEach((line, idx) => {
      const pts = extractPointsFromText(line);
      if (pts !== null) {
        const numMatch = line.match(/^(\*\*|\s)*(\d+|[a-zA-Z])[.)]/);
        const num = numMatch ? numMatch[2] : `#${idx + 1}`;
        subQuestions.push({ number: num, points: pts, text: line });
      }
    });
  }

  const calculatedSum = subQuestions.reduce((sum, q) => sum + q.points, 0);
  // Balanced if declared points equals calculated sum or if no subpoints are explicitly given
  const isBalanced = declaredPoints === 0 || calculatedSum === 0 || Math.abs(declaredPoints - calculatedSum) < 0.01;

  return {
    isBalanced,
    declaredPoints,
    calculatedSum,
    subQuestions
  };
}

/**
 * Sanitizes and enforces standard Moroccan LaTeX formatting.
 * @param {string} text 
 * @returns {string}
 */
export function sanitizeMoroccanLatex(text) {
  if (!text || typeof text !== 'string') return text;

  let sanitized = text;

  // Replace \vec{AB} with \overrightarrow{AB}
  sanitized = sanitized.replace(/\\vec\{([A-Za-z0-9_]+)\}/g, (match, p1) => {
    return p1.length > 1 ? `\\overrightarrow{${p1}}` : `\\vec{${p1}}`;
  });

  // Replace non-standard vector products with Moroccan official \wedge
  sanitized = sanitized.replace(/\\times\s*\\overrightarrow/g, '\\wedge \\overrightarrow');
  sanitized = sanitized.replace(/\s+x\s+\\overrightarrow/g, ' \\wedge \\overrightarrow');

  // Ensure limit arrows are standard \to instead of ->
  sanitized = sanitized.replace(/\\lim_\{([^}]+)\s*->\s*([^}]+)\}/g, '\\lim_{$1 \\to $2}');

  return sanitized;
}
