// src/utils/generateFichePedagogiquePDF.js
// Official Moroccan Fiche Pédagogique PDF Generator (Inspectorate Template BO n°6844)

import { cleanControlChars } from './mathRenderer';

export function generateFichePedagogiquePDF(lesson, options = {}) {
  const isArabic = lesson.language === 'ar';
  const profName = options.profName || localStorage.getItem('lconq_prof_name') || 'Prof. Mohamed Benali';
  const profSchool = options.profSchool || localStorage.getItem('lconq_prof_school') || 'Lycée Qualifiant Ibn Khaldoun';
  const profDirection = options.profDirection || localStorage.getItem('lconq_prof_direction') || 'Rabat';
  const profAcademy = options.profAcademy || localStorage.getItem('lconq_prof_academy') || 'AREF Rabat-Salé-Kénitra';
  const profSubject = options.profSubject || 'Mathématiques';
  const academicYear = options.academicYear || '2025/2026';

  const title = lesson.fiche_title || lesson.title || 'Fiche Pédagogique';
  const levelName = lesson.detected_level || lesson.level || '2ème Bac Sciences';
  const sections = lesson.sections || [];

  const esc = (str) => {
    if (!str) return '';
    return cleanControlChars(String(str))
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  const win = window.open('', '_blank');
  if (!win) {
    alert('Veuillez autoriser les fenêtres surgissantes (popups) pour afficher la Fiche Pédagogique.');
    return;
  }

  const htmlContent = `
<!DOCTYPE html>
<html lang="${isArabic ? 'ar' : 'fr'}" dir="${isArabic ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <title>Fiche Pédagogique - ${esc(title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Inter:wght@400;500;600;700;800&display=swap');
    
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }

    * { box-sizing: border-box; }
    
    body {
      font-family: ${isArabic ? "'Cairo', sans-serif" : "'Inter', sans-serif"};
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 11pt;
      line-height: 1.5;
    }

    .no-print-bar {
      background: #0f172a;
      color: #ffffff;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      position: sticky;
      top: 0;
      z-index: 1000;
    }

    .btn-print {
      background: #6366f1;
      color: #ffffff;
      border: none;
      padding: 8px 20px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.9rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-print:hover { background: #4f46e5; }

    .header-box {
      border: 2px solid #0f172a;
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 16px;
      background: #f8fafc;
    }

    .header-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5pt;
    }

    .header-table td {
      padding: 4px 8px;
      vertical-align: middle;
    }

    .doc-title-banner {
      background: #0f172a;
      color: #ffffff;
      text-align: center;
      padding: 10px;
      font-weight: 800;
      font-size: 14pt;
      border-radius: 4px;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
    }

    .card-box {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px 14px;
      background: #ffffff;
    }

    .card-title {
      font-weight: 800;
      font-size: 10pt;
      color: #0f172a;
      border-bottom: 1.5px solid #6366f1;
      padding-bottom: 4px;
      margin-bottom: 6px;
      text-transform: uppercase;
    }

    .card-box ul {
      margin: 0;
      padding-left: 18px;
      font-size: 9.5pt;
    }

    .card-box ul li { margin-bottom: 4px; }

    /* Deroulement Table */
    .matrix-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      font-size: 9pt;
    }

    .matrix-table th {
      background: #1e293b;
      color: #ffffff;
      font-weight: 800;
      padding: 8px;
      border: 1px solid #0f172a;
      text-align: center;
    }

    .matrix-table td {
      border: 1px solid #cbd5e1;
      padding: 8px;
      vertical-align: top;
    }

    .step-badge {
      background: #e0e7ff;
      color: #3730a3;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 4px;
      display: inline-block;
    }

    @media print {
      .no-print-bar { display: none !important; }
      body { background: #ffffff; }
      .header-box, .card-box { page-break-inside: avoid; }
      .matrix-table { page-break-inside: auto; }
      .matrix-table tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>

  <div class="no-print-bar">
    <div style="font-weight:700;">📄 FICHE PÉDAGOGIQUE OFFICIELLE — Inspection du Ministère</div>
    <button class="btn-print" onclick="window.print()">🖨️ Imprimer la Fiche PDF</button>
  </div>

  <div style="padding: 20px;">
    <!-- En-tête Officiel -->
    <div class="header-box">
      <table class="header-table">
        <tr>
          <td style="width:35%;"><strong>ROYAUME DU MAROC</strong><br/>Ministère de l'Éducation Nationale<br/>${esc(profAcademy)}</td>
          <td style="width:30%; text-align:center;">
            <div style="font-weight:900; font-size:12pt; color:#0f172a;">FICHE PÉDAGOGIQUE</div>
            <div style="font-size:8.5pt; color:#64748b;">Année Scolaire : ${esc(academicYear)}</div>
          </td>
          <td style="width:35%; text-align:right;">
            <strong>Direction :</strong> ${esc(profDirection)}<br/>
            <strong>Établissement :</strong> ${esc(profSchool)}<br/>
            <strong>Professeur :</strong> ${esc(profName)}
          </td>
        </tr>
      </table>
    </div>

    <!-- Banner Chapter Title -->
    <div class="doc-title-banner">
      Matière : ${esc(profSubject)} — Chapitre : ${esc(title)}
    </div>

    <!-- Info Matrix -->
    <table class="header-table" style="border:1px solid #cbd5e1; margin-bottom:16px; background:#f8fafc; border-radius:4px;">
      <tr>
        <td style="border:1px solid #e2e8f0;"><strong>Niveau :</strong> ${esc(levelName)}</td>
        <td style="border:1px solid #e2e8f0;"><strong>Durée Globale :</strong> ${esc(lesson.duration || '6 Heures (Théorie + TD)')}</td>
        <td style="border:1px solid #e2e8f0;"><strong>Fiche N° :</strong> 01</td>
      </tr>
    </table>

    <!-- Pedagogical Pre-requisites & Capacities -->
    <div class="grid-2">
      <div class="card-box">
        <div class="card-title">📌 Prérequis (المكتسبات القبلية)</div>
        <ul>
          ${lesson.prerequisites && lesson.prerequisites.length > 0 ? lesson.prerequisites.map(p => `<li>${esc(p)}</li>`).join('') : `
            <li>Notions de base en calcul algébrique et étude de fonctions.</li>
            <li>Propriétés des limites usuelles et continuités des fonctions.</li>
            <li>Calcul vectoriel et propriétés des repères orthogonaux.</li>
          `}
        </ul>
      </div>
      <div class="card-box">
        <div class="card-title">🎯 Capacités Attendues (القدرات المستهدفة)</div>
        <ul>
          ${lesson.capacities && lesson.capacities.length > 0 ? lesson.capacities.map(c => `<li>${esc(c)}</li>`).join('') : `
            <li>Maîtriser les définitions et théorèmes fondamentaux du chapitre.</li>
            <li>Calculer rigoureusement les limites et déterminer les asymptotes.</li>
            <li>Appliquer les méthodes de résolution aux exercices de synthèse.</li>
          `}
        </ul>
      </div>
    </div>

    <div class="card-box" style="margin-bottom:16px;">
      <div class="card-title">🛠️ Outils Didactiques & Orientations (الوسائل التوضيحية والتوجيهات)</div>
      <div style="font-size:9.5pt; color:#334155;">
        • ${esc(typeof lesson.tools === 'string' ? lesson.tools : (Array.isArray(lesson.tools) ? lesson.tools.join(', ') : 'Manuel scolaire officiel, Tableau noir/blanc, Calculatrice scientifique, Data Show'))}<br/>
        • Recommandations officielles : Inculquer le raisonnement rigoureux, valoriser l'autonomie des élèves lors des activités.
      </div>
    </div>

    <!-- Deroulement de la Lecon -->
    <div style="font-weight:800; font-size:11pt; color:#0f172a; margin-bottom:6px; text-transform:uppercase;">
      📋 Déroulement de la Leçon & Activités (سير الدرس والأنشطة)
    </div>

    <table class="matrix-table">
      <thead>
        <tr>
          <th style="width:12%;">Étape / Durée</th>
          <th style="width:30%;">Contenu & Activités</th>
          <th style="width:24%;">Rôle de l'Enseignant</th>
          <th style="width:22%;">Rôle de l'Élève</th>
          <th style="width:12%;">Évaluation</th>
        </tr>
      </thead>
      <tbody>
        ${sections.length > 0 ? sections.map((sec, idx) => `
          <tr>
            <td style="text-align:center;">
              <span class="step-badge">Phase ${idx + 1}</span><br/>
              <span style="font-size:8pt; color:#64748b;">${esc(sec.duration || '45 min')}</span>
            </td>
            <td>
              <strong style="color:#0f172a;">${esc(sec.title || sec.section_header || `Section ${idx + 1}`)}</strong>
              <div style="font-size:8.5pt; color:#475569; margin-top:4px;">
                ${esc(sec.content_summary || (sec.type === 'activity' ? '✦ Activité d\'introduction & soutien' : sec.type === 'definition' ? '✦ Définitions & concepts clés' : sec.type === 'property' ? '✦ Propriétés fondamentales & démonstrations' : '✦ Application & Exercices guidés'))}
              </div>
            </td>
            <td>
              ${sec.teacher_role ? esc(sec.teacher_role) : '• Poser le problème et guider la réflexion.<br/>• Animer la discussion et corriger au tableau.<br/>• Synthétiser les notions et faire noter le cours.'}
            </td>
            <td>
              ${sec.student_role ? esc(sec.student_role) : '• Chercher individuellement puis en binôme.<br/>• Formuler les conjectures et participer.<br/>• Prendre des notes sur le cahier de cours.'}
            </td>
            <td style="text-align:center;">
              <span style="color:#059669; font-weight:700;">${esc(sec.evaluation_type || 'Formative')}</span><br/>
              <span style="font-size:8pt; color:#64748b;">Exercice oral / QCM</span>
            </td>
          </tr>
        `).join('') : `
          <tr>
            <td colspan="5" style="text-align:center; padding:20px; color:#64748b;">
              Veuillez ajouter des sections au cours pour remplir automatiquement le déroulement pédagogique.
            </td>
          </tr>
        `}
      </tbody>
    </table>

    <div style="margin-top: 24px; text-align: right; font-size: 9.5pt;">
      <strong>Signature de l'Enseignant :</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <strong>Visa de l'Inspecteur :</strong>
    </div>
  </div>

</body>
</html>
  `;

  win.document.write(htmlContent);
  win.document.close();
}
