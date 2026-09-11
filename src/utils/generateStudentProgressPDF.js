// src/utils/generateStudentProgressPDF.js
// Standalone high-fidelity HTML & PDF generator for Moroccan Student Progress & Diagnostic Reports
// (Bilan Individuel de l'Élève & Fiche de Suivi Pédagogique)

import { getLevelDisplayName } from './levelHelpers';

const esc = (s) => {
  if (typeof s !== 'string') return String(s ?? '');
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

/**
 * Returns color and badge for grade /20
 */
const getGradeBadge = (note) => {
  const n = parseFloat(note);
  if (isNaN(n)) return { label: 'Non noté', bg: '#f1f5f9', color: '#64748b' };
  if (n >= 16) return { label: 'Très Bien', bg: '#dcfce7', color: '#15803d' };
  if (n >= 14) return { label: 'Bien', bg: '#ecfccb', color: '#4d7c0f' };
  if (n >= 12) return { label: 'Assez Bien', bg: '#e0f2fe', color: '#0369a1' };
  if (n >= 10) return { label: 'Moyen (Validé)', bg: '#fef3c7', color: '#b45309' };
  if (n >= 8)  return { label: 'Fragile (À soutenir)', bg: '#ffedd5', color: '#c2410c' };
  return { label: 'Insuffisant (Urgent)', bg: '#fee2e2', color: '#b91c1c' };
};

/**
 * Generates the HTML for a single student's progress report
 */
export function generateSingleStudentHTML(student, classObj = {}, options = {}) {
  const teacherName = options.teacher || classObj.teacher || 'Professeur de Mathématiques';
  const schoolName = options.school || classObj.school || 'Lycée Qualifiant 18 Novembre';
  const schoolYear = options.year || '2025/2026';
  const subject = options.subject || 'Mathématiques';
  const levelLabel = getLevelDisplayName(classObj.level || student.level || '2bac_pc_svt');
  const className = classObj.name || student.className || 'Classe';

  // Extract student controls & grades
  const controls = classObj.controls || [];
  const gradesMap = (classObj.grades?.[student.id]) || (classObj.grades?.[student.massarCode]) || {};
  
  // Calculate class averages for each control
  const allStudents = classObj.students || [];
  const controlAverages = {};
  controls.forEach(ctrl => {
    const validGrades = allStudents
      .map(s => {
        const val = classObj.grades?.[s.id]?.[ctrl] ?? classObj.grades?.[s.massarCode]?.[ctrl];
        return parseFloat(val);
      })
      .filter(n => !isNaN(n));
    
    if (validGrades.length > 0) {
      const sum = validGrades.reduce((a, b) => a + b, 0);
      controlAverages[ctrl] = {
        avg: (sum / validGrades.length).toFixed(2),
        max: Math.max(...validGrades).toFixed(2),
        min: Math.min(...validGrades).toFixed(2)
      };
    } else {
      controlAverages[ctrl] = { avg: '-', max: '-', min: '-' };
    }
  });

  // Calculate student average
  const studentGradesList = controls
    .map(c => parseFloat(gradesMap[c]))
    .filter(n => !isNaN(n));
  
  const studentAvg = studentGradesList.length > 0
    ? (studentGradesList.reduce((a, b) => a + b, 0) / studentGradesList.length).toFixed(2)
    : null;

  const badge = studentAvg !== null ? getGradeBadge(studentAvg) : { label: 'En cours', bg: '#f1f5f9', color: '#64748b' };

  // Determine standard competencies based on level
  const competencies = [
    { name: "Maîtrise du calcul algébrique & factorisation", desc: "Identités remarquables, polynômes, simplifications" },
    { name: "Étude des fonctions & Dérivation", desc: "Domaine de définition, calcul des dérivées, tableau de variations" },
    { name: "Nombres réels, Limites & Continuité", desc: "Théorème des valeurs intermédiaires, limites usuelles" },
    { name: "Suites numériques & Récurrence", desc: "Monotonie, convergence, suites arithmétiques et géométriques" },
    { name: "Rigueur de la rédaction mathématique", desc: "Usage précis de l'équivalence ($\\iff$) et de l'implication ($\\implies$)" }
  ];

  // Auto-rate competencies from studentAvg
  const getCompetencyStatus = (idx) => {
    if (studentAvg === null) return { icon: '⚪', label: 'Non évalué', color: '#94a3b8' };
    const avg = parseFloat(studentAvg);
    if (avg >= 14) return { icon: '✅', label: 'Très bien acquis', color: '#15803d' };
    if (avg >= 11) {
      if (idx === 4) return { icon: '🟡', label: 'En cours d\'acquisition', color: '#b45309' };
      return { icon: '✅', label: 'Acquis', color: '#16a34a' };
    }
    if (avg >= 8) {
      if (idx < 2) return { icon: '🟡', label: 'En cours d\'acquisition', color: '#b45309' };
      return { icon: '🔴', label: 'À renforcer en priorité', color: '#dc2626' };
    }
    return { icon: '🔴', label: 'Non acquis (Besoin de soutien)', color: '#dc2626' };
  };

  return `
    <div class="student-page">
      <!-- HEADER OFFICIEL MAROCAIN -->
      <div class="header-official">
        <div class="header-side left">
          <div class="header-royaume">المملكة المغربية</div>
          <div class="header-min">وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
          <div class="header-acad">الأكاديمية الجهوية للتربية والتكوين</div>
          <div class="header-dir">المديرية الإقليمية</div>
        </div>
        <div class="header-center">
          <div class="brand-title">L'CONQ</div>
          <div class="doc-badge">BILAN PÉDAGOGIQUE INDIVIDUEL</div>
          <div class="doc-title-ar">بطاقة التتبع والتقييم الفردي للتلميذ</div>
          <div class="school-year">Année Scolaire : ${esc(schoolYear)}</div>
        </div>
        <div class="header-side right">
          <div class="header-lycee">${esc(schoolName)}</div>
          <div class="header-mat">Matière : <strong>${esc(subject)}</strong></div>
          <div class="header-prof">Enseignant : <strong>${esc(teacherName)}</strong></div>
          <div class="header-date">Date : ${new Date().toLocaleDateString('fr-FR')}</div>
        </div>
      </div>

      <!-- CARTE D'IDENTITÉ DE L'ÉLÈVE -->
      <div class="student-id-card">
        <div class="id-item">
          <span class="id-label">NOM & PRÉNOM (الاسم والنسب) :</span>
          <span class="id-val name">${esc(student.name || 'Élève')}</span>
        </div>
        <div class="id-item">
          <span class="id-label">CODE MASSAR (رقم مسار) :</span>
          <span class="id-val massar">${esc(student.massarCode || student.id || '-')}</span>
        </div>
        <div class="id-item">
          <span class="id-label">CLASSE (القسم) :</span>
          <span class="id-val">${esc(className)}</span>
        </div>
        <div class="id-item">
          <span class="id-label">NIVEAU (المستوى) :</span>
          <span class="id-val">${esc(levelLabel)}</span>
        </div>
        <div class="id-item highlight">
          <span class="id-label">MOYENNE GÉNÉRALE :</span>
          <span class="id-val avg" style="color: ${badge.color};">
            ${studentAvg !== null ? `${studentAvg} / 20` : 'En cours'}
          </span>
          <span class="appreciation-tag" style="background: ${badge.bg}; color: ${badge.color};">
            ${badge.label}
          </span>
        </div>
      </div>

      <!-- TABLEAU DES CONTRÔLES CONTINUS -->
      <div class="section-title-box">
        <span class="sec-num">1</span>
        <span class="sec-text">Résultats aux Devoirs Surveillés & Contrôles Continus (عناصر المراقبة المستمرة)</span>
      </div>

      <table class="grades-table">
        <thead>
          <tr>
            <th style="width: 28%;">Évaluation / Devoir</th>
            <th style="width: 18%;" class="text-center">Note Élève / 20</th>
            <th style="width: 18%;" class="text-center">Moyenne Classe</th>
            <th style="width: 18%;" class="text-center">Min / Max Classe</th>
            <th style="width: 18%;" class="text-center">Appréciation</th>
          </tr>
        </thead>
        <tbody>
          ${controls.length === 0 ? `
            <tr>
              <td colspan="5" style="text-align: center; color: #64748b; padding: 12px;">Aucun contrôle n'a encore été saisi pour cette classe.</td>
            </tr>
          ` : controls.map(ctrl => {
            const grade = gradesMap[ctrl];
            const hasGrade = grade !== undefined && grade !== null && grade !== '';
            const gBadge = hasGrade ? getGradeBadge(grade) : { label: '-', bg: '#f8fafc', color: '#94a3b8' };
            const classStats = controlAverages[ctrl] || { avg: '-', min: '-', max: '-' };

            return `
              <tr>
                <td><strong>${esc(ctrl)}</strong></td>
                <td class="text-center note-cell">
                  ${hasGrade ? `<strong>${parseFloat(grade).toFixed(2)}</strong> / 20` : '<span style="color:#94a3b8;">Non noté</span>'}
                </td>
                <td class="text-center" style="color: #475569;">${classStats.avg} / 20</td>
                <td class="text-center" style="font-size: 10px; color: #64748b;">
                  ${classStats.min} / ${classStats.max}
                </td>
                <td class="text-center">
                  <span class="status-pill" style="background: ${gBadge.bg}; color: ${gBadge.color};">
                    ${gBadge.label}
                  </span>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <!-- MATRICE DES COMPÉTENCES DU PROGRAMME -->
      <div class="section-title-box">
        <span class="sec-num">2</span>
        <span class="sec-text">Bilan d'Acquisition des Compétences Pédagogiques (شبكة تقييم الكفايات)</span>
      </div>

      <table class="competency-table">
        <thead>
          <tr>
            <th style="width: 45%;">Compétence & Capacité Attendue</th>
            <th style="width: 35%;">Précision Pédagogique</th>
            <th style="width: 20%;" class="text-center">Niveau de Maîtrise</th>
          </tr>
        </thead>
        <tbody>
          ${competencies.map((comp, idx) => {
            const status = getCompetencyStatus(idx);
            return `
              <tr>
                <td><strong>${comp.name}</strong></td>
                <td style="font-size: 10px; color: #64748b;">${comp.desc}</td>
                <td class="text-center">
                  <span class="comp-badge" style="color: ${status.color};">
                    ${status.icon} ${status.label}
                  </span>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <!-- REMARQUES & CONSEILS DE L'ENSEIGNANT -->
      <div class="section-title-box">
        <span class="sec-num">3</span>
        <span class="sec-text">Observations de l'Enseignant & Recommandations (توجيهات وملاحظات الأستاذ)</span>
      </div>

      <div class="teacher-remarks-box">
        <div class="remark-content">
          ${studentAvg !== null && parseFloat(studentAvg) >= 14 ? `
            <strong>🌟 Félicitations pour le travail fourni et l'assiduité :</strong> L'élève montre d'excellentes capacités d'analyse et une rigueur mathématique remarquable. Il est encouragé à aborder les exercices de synthèse de niveau concours (ENSA, ENSAM, Médecine) et à perfectionner la rapidité des calculs.
          ` : studentAvg !== null && parseFloat(studentAvg) >= 10 ? `
            <strong>👍 Bon investissement avec une marge de progression :</strong> Le travail est sérieux et les notions fondamentales sont comprises. Il convient d'approfondir la rédaction formelle des démonstrations et d'éviter les fautes d'inattention dans les calculs algébriques.
          ` : `
            <strong>⚠️ Plan de remédiation et soutien impératif :</strong> Des lacunes subsistent sur les prérequis fondamentaux (techniques de factorisation, étude des signes et limites). Un travail régulier sur les fiches de remédiation et la participation active aux séances de soutien sont vivement recommandés pour réussir l'examen.
          `}
        </div>
      </div>

      <!-- VISAS ET SIGNATURES -->
      <div class="signatures-grid">
        <div class="sig-box">
          <div class="sig-title">Signature de l'Élève & Tuteur</div>
          <div class="sig-space">توقيع ولي الأمر</div>
        </div>
        <div class="sig-box">
          <div class="sig-title">Visa de l'Enseignant</div>
          <div class="sig-prof-name">${esc(teacherName)}</div>
        </div>
        <div class="sig-box">
          <div class="sig-title">Cachet de l'Établissement</div>
          <div class="sig-space">خاتم الإدارة التربوية</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Builds the complete multi-page or single-page printable HTML document
 */
export function buildStudentProgressDocumentHTML(students = [], classObj = {}, options = {}) {
  const isBulk = students.length > 1;
  const docTitle = isBulk 
    ? `Bilans_Individuels_${classObj.name || 'Classe'}_2026` 
    : `Bilan_${students[0]?.name?.replace(/\s+/g, '_') || 'Eleve'}`;

  const pagesHTML = students
    .map(st => generateSingleStudentHTML(st, classObj, options))
    .join('\n');

  return `
    <!DOCTYPE html>
    <html lang="fr" dir="ltr">
    <head>
      <meta charset="utf-8" />
      <title>${esc(docTitle)}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Noto+Kufi+Arabic:wght@400;600;700;800;900&display=swap');

        @page {
          size: A4 portrait;
          margin: 0.6cm 0.7cm;
        }

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          padding: 0;
          font-family: 'Inter', 'Noto Kufi Arabic', -apple-system, BlinkMacSystemFont, sans-serif;
          color: #0f172a;
          background: #ffffff;
          font-size: 11px;
          line-height: 1.35;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .student-page {
          page-break-after: always;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding-bottom: 5px;
        }

        .student-page:last-child {
          page-break-after: avoid;
        }

        /* HEADER OFFICIEL */
        .header-official {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #0284c7;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }

        .header-side {
          font-size: 9.5px;
          color: #334155;
          line-height: 1.3;
        }

        .header-side.left {
          text-align: right;
          direction: rtl;
          font-family: 'Noto Kufi Arabic', sans-serif;
          font-weight: 600;
          width: 32%;
        }

        .header-side.right {
          text-align: right;
          width: 32%;
        }

        .header-center {
          text-align: center;
          width: 36%;
        }

        .brand-title {
          font-size: 16px;
          font-weight: 900;
          color: #0284c7;
          letter-spacing: -0.03em;
        }

        .doc-badge {
          display: inline-block;
          background: #0284c7;
          color: #ffffff;
          font-size: 9px;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 4px;
          margin: 3px 0;
          letter-spacing: 0.05em;
        }

        .doc-title-ar {
          font-family: 'Noto Kufi Arabic', sans-serif;
          font-size: 11px;
          font-weight: 800;
          color: #0f172a;
        }

        .school-year {
          font-size: 9px;
          color: #64748b;
          font-weight: 600;
        }

        /* CARTE D'IDENTITÉ ÉLÈVE */
        .student-id-card {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr;
          gap: 8px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 8px 12px;
          margin-bottom: 10px;
        }

        .id-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .id-item.highlight {
          grid-column: span 2;
          flex-direction: row;
          align-items: center;
          gap: 8px;
          background: #ffffff;
          padding: 4px 8px;
          border-radius: 6px;
          border: 1px dashed #cbd5e1;
        }

        .id-label {
          font-size: 8.5px;
          font-weight: 800;
          color: #64748b;
          letter-spacing: 0.03em;
        }

        .id-val {
          font-size: 11px;
          font-weight: 700;
          color: #0f172a;
        }

        .id-val.name {
          font-size: 13px;
          color: #0284c7;
          font-weight: 800;
        }

        .id-val.massar {
          font-family: monospace;
          letter-spacing: 0.05em;
        }

        .id-val.avg {
          font-size: 14px;
          font-weight: 900;
        }

        .appreciation-tag {
          font-size: 9px;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 12px;
          margin-left: auto;
        }

        /* SECTION TITLES */
        .section-title-box {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #f1f5f9;
          border-left: 3px solid #0284c7;
          padding: 4px 8px;
          border-radius: 0 4px 4px 0;
          margin-top: 6px;
          margin-bottom: 6px;
        }

        .sec-num {
          background: #0284c7;
          color: white;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: 800;
        }

        .sec-text {
          font-size: 10px;
          font-weight: 800;
          color: #0f172a;
        }

        /* TABLES */
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 8px;
        }

        th {
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          color: #334155;
          font-size: 9.5px;
          font-weight: 800;
          padding: 5px 6px;
          text-align: left;
        }

        td {
          border: 1px solid #e2e8f0;
          padding: 4px 6px;
          font-size: 10px;
          color: #1e293b;
        }

        .text-center {
          text-align: center !important;
        }

        .note-cell {
          font-size: 11px;
        }

        .status-pill {
          font-size: 8.5px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 8px;
          display: inline-block;
        }

        .comp-badge {
          font-size: 9.5px;
          font-weight: 700;
        }

        /* TEACHER REMARKS */
        .teacher-remarks-box {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 8px 10px;
          margin-bottom: 10px;
        }

        .remark-content {
          font-size: 10px;
          line-height: 1.45;
          color: #334155;
        }

        /* SIGNATURES */
        .signatures-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 10px;
          margin-top: 5px;
        }

        .sig-box {
          border: 1px dashed #cbd5e1;
          border-radius: 6px;
          padding: 6px 8px;
          text-align: center;
          height: 65px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .sig-title {
          font-size: 8.5px;
          font-weight: 800;
          color: #64748b;
          border-bottom: 1px solid #f1f5f9;
          padding-bottom: 2px;
        }

        .sig-prof-name {
          font-size: 9.5px;
          font-weight: 800;
          color: #0f172a;
        }

        .sig-space {
          font-size: 8px;
          color: #94a3b8;
        }

        @media print {
          body {
            margin: 0;
          }
          .no-print {
            display: none !important;
          }
        }
      </style>
    </head>
    <body>
      ${pagesHTML}
    </body>
    </html>
  `;
}

/**
 * Triggers the browser print dialog for student progress PDF
 */
export function openStudentProgressPrintWindow(students = [], classObj = {}, options = {}) {
  const studentList = Array.isArray(students) ? students : [students];
  if (studentList.length === 0) {
    alert("Aucun élève sélectionné pour l'impression du bilan.");
    return;
  }

  const html = buildStudentProgressDocumentHTML(studentList, classObj, options);
  const win = window.open('', '_blank');
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 600);
  } else {
    alert("Veuillez autoriser les fenêtres pop-up dans votre navigateur pour imprimer le bilan.");
  }
}
