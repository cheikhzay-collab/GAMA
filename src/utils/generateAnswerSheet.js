import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

/**
 * Sanitizes strings for safe PDF filenames across OS and browsers.
 */
const sanitizeFilename = (str) => {
  if (!str) return 'file';
  return String(str)
    .replace(/[/\\?%*:|"<>\[\]]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
};

/**
 * Transliterates Arabic characters to Latin phonetic equivalents for Moroccan names.
 */
const transliterateArabic = (str) => {
  if (!str) return '';
  const map = {
    'أ': 'A', 'إ': 'I', 'آ': 'A', 'ا': 'A', 'ب': 'B', 'ت': 'T', 'ث': 'Th',
    'ج': 'J', 'ح': 'H', 'خ': 'Kh', 'د': 'D', 'ذ': 'Dh', 'ر': 'R', 'ز': 'Z',
    'س': 'S', 'ش': 'Ch', 'ص': 'S', 'ض': 'D', 'ط': 'T', 'ظ': 'Z', 'ع': 'A',
    'غ': 'Gh', 'ف': 'F', 'ق': 'K', 'ك': 'K', 'ل': 'L', 'م': 'M', 'ن': 'N',
    'ه': 'H', 'و': 'Ou', 'ي': 'Y', 'ى': 'A', 'ئ': 'E', 'ء': 'A', 'ؤ': 'Ou',
    'ة': 'e', 'گ': 'G', 'پ': 'P', 'ڤ': 'V'
  };
  return String(str)
    .split('')
    .map(ch => map[ch] || ch)
    .join('');
};

/**
 * Removes non-Latin-1 characters and transliterates Arabic Unicode characters
 * to prevent jsPDF font encoding corruption (Mojibake).
 */
const toLatinOnly = (str, fallback = '') => {
  if (!str) return fallback;
  let clean = transliterateArabic(str)
    .replace(/[^\x20-\u00FF]/g, '') // Strictly strip non-Latin-1 characters
    .replace(/\(\s*[-—]?\s*\)/g, '')
    .replace(/\[\s*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return clean || fallback;
};

/**
 * Renders a single page of an OMR answer sheet onto a jsPDF document.
 * @param {jsPDF} doc
 * @param {Object} exam     - { id, name, school, year, questions }
 * @param {Object} student  - { name, massarCode, id }
 * @param {Object} classObj - { id, name }
 */
export async function renderAnswerSheetPage(doc, exam, student = null, classObj = null) {
  const W = 210, H = 297;
  const margin = 14;

  // ── Premium Royal Palette ────────────────────────────────────────
  const navy      = [26, 26, 46];      // Royal Deep Navy #1a1a2e
  const violet    = [124, 58, 237];    // L'CONQ Purple #7c3aed
  const emerald   = [16, 163, 74];     // Emerald Green #10a34a
  const softBg    = [248, 247, 255];   // Light pastel purple-blue #f8f7ff
  const borderCol = [226, 232, 240];   // Light Gray Border #e2e8f0
  const charcoal  = [31, 41, 55];      // Dark Text #1f2937
  const mid       = [100, 116, 139];   // Secondary Slate #64748b

  // ── High-Tech Solid Anchor Squares for Robust Computer Vision ──
  const drawSolidAnchorSquare = (x, y) => {
    doc.setFillColor(0, 0, 0);
    doc.rect(x, y, 7, 7, 'F');
  };

  drawSolidAnchorSquare(8, 8);               // Top-Left
  drawSolidAnchorSquare(W - 8 - 7, 8);       // Top-Right
  drawSolidAnchorSquare(8, H - 8 - 7);       // Bottom-Left
  drawSolidAnchorSquare(W - 8 - 7, H - 8 - 7); // Bottom-Right

  // ── QR Code Payload ──────────────────────────────────────────────
  // Ultra-compact payload (under 25 characters) to guarantee Version 1/2 QR Code
  // with massive modules for lightning-fast camera scanning even on low-end devices.
  const examPrefix = exam?.id ? String(exam.id).slice(0, 8) : 'EXAM';
  const massar = student?.massarCode || student?.id || student?.cne || '';
  const payload = massar ? `LCQ:${examPrefix}:${massar}` : `LCQ:${examPrefix}`;

  const qrDataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    width: 240,
    margin: 1,
    color: { dark: '#000000', light: '#FFFFFF' },
  });

  // ── Header Band ──────────────────────────────────────────────────
  const headerMargin = 16;
  doc.setFillColor(...navy);
  doc.roundedRect(headerMargin, 16, W - headerMargin * 2, 30, 3, 3, 'F');

  // Platform Logo
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text("L'CONQ", headerMargin + 6, 26);

  // Logo gold dot
  doc.setFillColor(245, 158, 11); // Gold #f59e0b
  doc.circle(headerMargin + 30, 22.5, 1.2, 'F');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(191, 196, 210);
  doc.text('Feuille de réponses officielle · Correction par Intelligence Artificielle', headerMargin + 6, 32);

  // Exam name sanitized for jsPDF Latin-1 helvetica font
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  
  const rawSchool = exam?.school || 'L\'CONQ';
  const rawName = exam?.name || 'Examen QCM';
  const rawYear = exam?.year || '';

  const cleanSchool = toLatinOnly(rawSchool) || 'L\'CONQ';
  const cleanName = toLatinOnly(rawName) || 'Examen QCM';
  const cleanYear = toLatinOnly(rawYear) || '';

  const examLabel = `${cleanSchool} — ${cleanName} ${cleanYear}`.replace(/\s+—\s+$/, '').trim();
  doc.text(examLabel, headerMargin + 6, 41, { maxWidth: 130 });

  // QR Code Image in Header
  doc.addImage(qrDataUrl, 'PNG', W - headerMargin - 30, 17, 28, 28);

  // ── Student Info Cards ───────────────────────────────────────────
  const drawCard = (x, y, w, h, title, val) => {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...borderCol);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, h, 2, 2, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...mid);
    doc.text(title, x + 3, y + 5);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...charcoal);
    const latinVal = toLatinOnly(val, '___________________________');
    doc.text(latinVal.slice(0, 26), x + 3, y + 10.5);
  };

  const cardY = 51;
  const cardH = 14;
  const className = classObj?.name || student?.className || 'N/A';
  const studentName = student?.name || '';

  drawCard(margin, cardY, 58, cardH, 'NOM & PRÉNOM DU CANDIDAT', studentName || '___________________________');
  drawCard(margin + 60, cardY, 32, cardH, 'CODE MASSAR', massar || '__________');
  drawCard(margin + 94, cardY, 30, cardH, 'CLASSE', className);
  drawCard(margin + 126, cardY, 26, cardH, 'DATE', new Date().toLocaleDateString('fr-MA'));

  // Score Card
  let questions = exam?.questions || [];
  if ((!questions || questions.length === 0) && (exam?.questionsCount || exam?.questions_count)) {
    const qCount = exam.questionsCount || exam.questions_count || 20;
    questions = Array.from({ length: qCount }, (_, i) => ({ question: `Q${i + 1}` }));
  }
  if (!questions || questions.length === 0) {
    questions = Array.from({ length: 20 }, (_, i) => ({ question: `Q${i + 1}` }));
  }

  const scoreCardX = margin + 154;
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(...emerald);
  doc.setLineWidth(0.4);
  doc.roundedRect(scoreCardX, cardY, 28, cardH, 2, 2, 'FD');

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...emerald);
  doc.text('SCORE FINAL', scoreCardX + 2.5, cardY + 5);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...emerald);
  doc.text(`__ / ${questions.length}`, scoreCardX + 2.5, cardY + 10.5);

  // ── Instructions Panel ───────────────────────────────────────────
  const instY = 69;
  const instH = 10;
  doc.setFillColor(250, 245, 255);
  doc.roundedRect(margin, instY, W - margin * 2, instH, 1.5, 1.5, 'F');

  doc.setFillColor(...violet);
  doc.rect(margin, instY, 2.5, instH, 'F');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...violet);
  doc.text('INFORMATIONS & CONSIGNES IMPORTANTES :', margin + 5, instY + 4);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...charcoal);
  doc.text('· Noircissez complètement le cercle avec un stylo bleu ou noir.  · En cas d\'erreur, blanchissez proprement le cercle.', margin + 5, instY + 7.5);

  // ── Legend Section ───────────────────────────────────────────────
  const opts = ['A', 'B', 'C', 'D', 'E'];
  const legendY = 82;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...mid);
  doc.text('EXEMPLES DE REMPLISSAGE :', margin, legendY + 3);

  // Example: Filled
  const cxOk = margin + 45;
  doc.setFillColor(...navy);
  doc.circle(cxOk, legendY + 2, 2.8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'bold');
  doc.text('A', cxOk - 1.2, legendY + 3.9);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...emerald);
  doc.text('Correct', cxOk + 4, legendY + 3);

  // Example: Empty
  const cxNo = margin + 70;
  doc.setDrawColor(...mid);
  doc.setLineWidth(0.3);
  doc.circle(cxNo, legendY + 2, 2.8, 'S');
  doc.setTextColor(...mid);
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'normal');
  doc.text('B', cxNo - 1.2, legendY + 3.9);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mid);
  doc.text('Vide', cxNo + 4, legendY + 3);

  // ── OMR Grid Section ─────────────────────────────────────────────
  const Q = questions.length;
  const cols = 2;
  const rowH = 8.5;
  const colW = (W - margin * 2) / cols;
  const gridTop = 96;

  for (let col = 0; col < cols; col++) {
    const xBase = margin + col * colW;
    doc.setFillColor(...violet);
    doc.roundedRect(xBase, gridTop, colW - 2, 7, 1.5, 1.5, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('N°', xBase + 3, gridTop + 4.8);
    
    opts.forEach((o, i) => {
      doc.text(o, xBase + 18 + i * 9, gridTop + 4.8);
    });
  }

  const half = Math.ceil(Q / cols);
  const totalGridH = 7 + half * rowH;
  doc.setDrawColor(...borderCol);
  doc.setLineWidth(0.3);
  doc.line(W / 2, gridTop, W / 2, gridTop + totalGridH);

  for (let q = 0; q < Q; q++) {
    const col    = q < half ? 0 : 1;
    const rowIdx = col === 0 ? q : q - half;
    const xBase  = margin + col * colW;
    const y      = gridTop + 7 + rowIdx * rowH;

    doc.setFillColor(0, 0, 0);
    doc.rect(col === 0 ? 8 : 200, y + rowH / 2 - 1, 2, 2, 'F');

    if (rowIdx % 2 === 0) {
      doc.setFillColor(...softBg);
      doc.rect(xBase, y, colW - 2, rowH, 'F');
    }

    doc.setDrawColor(...borderCol);
    doc.setLineWidth(0.15);
    doc.line(xBase, y + rowH, xBase + colW - 2, y + rowH);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...navy);
    doc.text(String(q + 1).padStart(2, '0'), xBase + 3, y + rowH / 2 + 1);

    opts.forEach((o, i) => {
      const cx = xBase + 20 + i * 9;
      const cy = y + rowH / 2;
      
      doc.setDrawColor(...mid);
      doc.setLineWidth(0.35);
      doc.circle(cx, cy, 2.9, 'S');

      doc.setFontSize(6.2);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...mid);
      doc.text(o, cx - 1.3, cy + 1.1);
    });
  }

  // ── Footer ───────────────────────────────────────────────────────
  const usedRows = Math.ceil(Q / 2);
  const footerY  = Math.max(gridTop + 7 + usedRows * rowH + 12, 258);

  doc.setDrawColor(...borderCol);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY, W - margin, footerY);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mid);
  doc.text("Après avoir terminé, scannez cette feuille via l'application L'CONQ pour obtenir une correction instantanée.", margin, footerY + 5.5, { maxWidth: W - margin * 2 - 25 });

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...navy);
  doc.text(`EXAM ID: ${examPrefix.toUpperCase()}`, W - margin, footerY + 5.5, { align: 'right' });

  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mid);
  doc.text('lconq.ma · IA OMR Engine v2.0', W - margin, footerY + 8.5, { align: 'right' });
}

/**
 * Generates a printable answer sheet PDF for an individual exam/user.
 * @param {Object} exam   - { id, name, school, year, questions }
 * @param {Object} user   - { name, email, massarCode, id }
 */
export async function generateAnswerSheet(exam, user) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  await renderAnswerSheetPage(doc, exam, user);
  const schoolName = sanitizeFilename(exam?.school || 'LCONQ');
  const examIdPart = sanitizeFilename(String(exam?.id || 'EXAM').slice(0, 6));
  const filename = `feuille-reponses-${schoolName}-${exam?.year || ''}-${examIdPart}.pdf`;
  doc.save(filename);
}

/**
 * Generates a multi-page PDF containing a personalized answer sheet for every student in a class.
 * @param {Object} exam         - Exam object
 * @param {Object} classObj     - Class object
 * @param {Array}  studentsList - List of student objects { name, massarCode, id }
 */
export async function generateBatchAnswerSheets(exam, classObj, studentsList = []) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const list = studentsList.length > 0 ? studentsList : [{ name: '', massarCode: '' }];

  for (let i = 0; i < list.length; i++) {
    if (i > 0) doc.addPage();
    await renderAnswerSheetPage(doc, exam, list[i], classObj);
  }

  const className = sanitizeFilename(classObj?.name || 'Classe');
  const examName = sanitizeFilename(exam?.name || 'Examen');
  const filename = `Grilles-OMR-${className}-${examName}.pdf`;
  doc.save(filename);
}
