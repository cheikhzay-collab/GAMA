// src/utils/generateDiagnosticReportPDF.js
// High-Fidelity Printable PDF Generator for Moroccan Official Diagnostic & Remediation Reports
// (Rapport d'Analyse Diagnostique & Plan de Soutien Pédagogique Officiel)

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
 * Builds the official Moroccan inspection diagnostic and remediation report
 */
export function buildDiagnosticReportHTML(diagnosticData) {
  const {
    schoolName = 'Lycée Qualifiant 18 Novembre',
    direction = 'Direction Provinciale',
    academie = 'Académie Régionale de l\'Éducation et de la Formation',
    className = 'Classe',
    level = '2bac_pc_svt',
    controlName = 'Devoir Surveillé N°1',
    subject = 'Mathématiques',
    teacherName = 'Professeur de Mathématiques',
    schoolYear = '2025/2026',
    date = new Date().toLocaleDateString('fr-FR'),
    stats = {},
    competencies = [],
    remediationGroup = [],
    excellenceGroup = [],
    remediationPlan = ''
  } = diagnosticData;

  const levelLabel = getLevelDisplayName(level);
  const totalStudents = (stats.total || (remediationGroup.length + excellenceGroup.length)) || 0;
  const presents = stats.presents || totalStudents;
  const absents = stats.absents || 0;
  const avg = stats.avg || '0.00';
  const min = stats.min || '0.00';
  const max = stats.max || '0.00';
  const successRate = stats.successRate || (totalStudents > 0 ? ((excellenceGroup.length / totalStudents) * 100).toFixed(1) : '0');

  // Score distribution counts
  const dist = stats.distribution || {
    tier1: remediationGroup.filter(s => parseFloat(s.grade) < 5).length, // < 5
    tier2: remediationGroup.filter(s => parseFloat(s.grade) >= 5 && parseFloat(s.grade) < 10).length, // 5 - 9.75
    tier3: excellenceGroup.filter(s => parseFloat(s.grade) >= 10 && parseFloat(s.grade) < 14).length, // 10 - 13.75
    tier4: excellenceGroup.filter(s => parseFloat(s.grade) >= 14).length // >= 14
  };

  return `
    <!DOCTYPE html>
    <html lang="fr" dir="ltr">
    <head>
      <meta charset="utf-8" />
      <title>Rapport_Diagnostique_${esc(controlName)}_${esc(className)}</title>
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
          font-size: 10.5px;
          line-height: 1.35;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .report-page {
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        /* HEADER */
        .header-official {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #4338ca;
          padding-bottom: 8px;
          margin-bottom: 10px;
        }

        .header-side {
          font-size: 9px;
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
          color: #4338ca;
          letter-spacing: -0.03em;
        }

        .doc-badge {
          display: inline-block;
          background: #4338ca;
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

        /* META CARD */
        .meta-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 8px 12px;
          margin-bottom: 10px;
        }

        .meta-col {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .meta-label {
          font-size: 8.5px;
          font-weight: 800;
          color: #64748b;
        }

        .meta-val {
          font-size: 11px;
          font-weight: 700;
          color: #0f172a;
        }

        /* SECTION TITLES */
        .section-title {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #eef2ff;
          border-left: 3px solid #4338ca;
          padding: 3px 8px;
          border-radius: 0 4px 4px 0;
          margin-top: 6px;
          margin-bottom: 6px;
        }

        .sec-badge {
          background: #4338ca;
          color: white;
          width: 15px;
          height: 15px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 8.5px;
          font-weight: 800;
        }

        .sec-title-text {
          font-size: 9.5px;
          font-weight: 800;
          color: #1e1b4b;
        }

        /* KPI STATS ROW */
        .kpi-row {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 6px;
          margin-bottom: 8px;
        }

        .kpi-card {
          border: 1px solid #e2e8f0;
          background: #ffffff;
          border-radius: 6px;
          padding: 5px 6px;
          text-align: center;
        }

        .kpi-card.highlight {
          background: #f0fdf4;
          border-color: #86efac;
        }

        .kpi-title {
          font-size: 8px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
        }

        .kpi-num {
          font-size: 13px;
          font-weight: 900;
          color: #0f172a;
          margin-top: 1px;
        }

        .kpi-card.highlight .kpi-num {
          color: #15803d;
        }

        /* DISTRIBUTION BAR */
        .dist-container {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 6px 8px;
          margin-bottom: 8px;
        }

        .dist-bar-flex {
          display: flex;
          height: 12px;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 4px;
        }

        .dist-seg {
          height: 100%;
        }

        .dist-legend {
          display: flex;
          justify-content: space-between;
          font-size: 8px;
          color: #475569;
          font-weight: 600;
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
          font-size: 9px;
          font-weight: 800;
          padding: 4px 6px;
          text-align: left;
        }

        td {
          border: 1px solid #e2e8f0;
          padding: 4px 6px;
          font-size: 9.5px;
          color: #1e293b;
        }

        .text-center {
          text-align: center !important;
        }

        /* GROUPS SPLIT */
        .groups-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 8px;
        }

        .group-card {
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 6px 8px;
          background: #ffffff;
        }

        .group-card.rem {
          border-color: #fca5a5;
          background: #fef2f2;
        }

        .group-card.exc {
          border-color: #86efac;
          background: #f0fdf4;
        }

        .group-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 9.5px;
          font-weight: 800;
          margin-bottom: 4px;
          padding-bottom: 3px;
          border-bottom: 1px solid rgba(0,0,0,0.08);
        }

        .group-list {
          font-size: 9px;
          line-height: 1.4;
          color: #334155;
          max-height: 75px;
          overflow: hidden;
        }

        /* ACTION PLAN BOX */
        .action-box {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 6px 8px;
          font-size: 9px;
          line-height: 1.4;
          color: #334155;
          margin-bottom: 8px;
        }

        /* SIGNATURES */
        .signatures-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 10px;
          margin-top: 4px;
        }

        .sig-cell {
          border: 1px dashed #cbd5e1;
          border-radius: 6px;
          padding: 5px 8px;
          text-align: center;
          height: 60px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .sig-title {
          font-size: 8px;
          font-weight: 800;
          color: #64748b;
        }

        .sig-name {
          font-size: 9px;
          font-weight: 800;
          color: #0f172a;
        }

        .sig-hint {
          font-size: 7.5px;
          color: #94a3b8;
        }

        @media print {
          body {
            margin: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="report-page">
        <!-- 1. HEADER OFFICIEL -->
        <div class="header-official">
          <div class="header-side left">
            <div>المملكة المغربية</div>
            <div>وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
            <div>${esc(academie)}</div>
            <div>${esc(direction)}</div>
          </div>
          <div class="header-center">
            <div class="brand-title">L'CONQ</div>
            <div class="doc-badge">RAPPORT D'ANALYSE DIAGNOSTIQUE & SOUTIEN</div>
            <div class="doc-title-ar">تقرير التحليل التشخيصي وخطة الدعم والمعالجة البيداغوجية</div>
            <div style="font-size: 8.5px; color: #64748b; font-weight: 600;">Année Scolaire : ${esc(schoolYear)}</div>
          </div>
          <div class="header-side right">
            <div><strong>${esc(schoolName)}</strong></div>
            <div>Matière : <strong>${esc(subject)}</strong></div>
            <div>Enseignant : <strong>${esc(teacherName)}</strong></div>
            <div>Date d'édition : ${esc(date)}</div>
          </div>
        </div>

        <!-- 2. MÉTADONNÉES DE L'ÉVALUATION -->
        <div class="meta-grid">
          <div class="meta-col">
            <span class="meta-label">CLASSE & NIVEAU :</span>
            <span class="meta-val">${esc(className)} · ${esc(levelLabel)}</span>
          </div>
          <div class="meta-col">
            <span class="meta-label">ÉVALUATION ANALYSÉE :</span>
            <span class="meta-val">${esc(controlName)}</span>
          </div>
          <div class="meta-col">
            <span class="meta-label">TYPE DU DOCUMENT :</span>
            <span class="meta-val">Devoir Surveillé (Contrôle Continu)</span>
          </div>
          <div class="meta-col">
            <span class="meta-label">SEUIL DE MAÎTRISE :</span>
            <span class="meta-val" style="color: #4338ca;">10,00 / 20 (Note de validation)</span>
          </div>
        </div>

        <!-- 3. INDICATEURS STATISTIQUES GLOBAUX -->
        <div class="section-title">
          <span class="sec-badge">1</span>
          <span class="sec-title-text">Indicateurs Chiffrés Globaux de l'Évaluation (المؤشرات الإحصائية العامة)</span>
        </div>

        <div class="kpi-row">
          <div class="kpi-card">
            <div class="kpi-title">Effectif Total</div>
            <div class="kpi-num">${totalStudents}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Présents</div>
            <div class="kpi-num">${presents}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Moyenne Classe</div>
            <div class="kpi-num" style="color: #4338ca;">${avg} / 20</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Note Minimale</div>
            <div class="kpi-num" style="color: #dc2626;">${min}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Note Maximale</div>
            <div class="kpi-num" style="color: #15803d;">${max}</div>
          </div>
          <div class="kpi-card highlight">
            <div class="kpi-title">Taux de Réussite</div>
            <div class="kpi-num">${successRate}%</div>
          </div>
        </div>

        <!-- 4. DISTRIBUTION DES RÉSULTATS -->
        <div class="dist-container">
          <div style="font-size: 8px; font-weight: 800; color: #475569; margin-bottom: 3px;">
            RÉPARTITION DES NOTES PAR TRANCHES :
          </div>
          <div class="dist-bar-flex">
            <div class="dist-seg" style="width: ${(dist.tier1 / Math.max(1, presents)) * 100}%; background: #ef4444;" title="< 5/20 : ${dist.tier1}"></div>
            <div class="dist-seg" style="width: ${(dist.tier2 / Math.max(1, presents)) * 100}%; background: #f97316;" title="5 - 9.75 : ${dist.tier2}"></div>
            <div class="dist-seg" style="width: ${(dist.tier3 / Math.max(1, presents)) * 100}%; background: #38bdf8;" title="10 - 13.75 : ${dist.tier3}"></div>
            <div class="dist-seg" style="width: ${(dist.tier4 / Math.max(1, presents)) * 100}%; background: #22c55e;" title=">= 14 : ${dist.tier4}"></div>
          </div>
          <div class="dist-legend">
            <span style="color: #dc2626;">■ [0 - 5[ : ${dist.tier1} él.</span>
            <span style="color: #ea580c;">■ [5 - 10[ (À soutenir) : ${dist.tier2} él.</span>
            <span style="color: #0284c7;">■ [10 - 14[ (Moyen) : ${dist.tier3} él.</span>
            <span style="color: #16a34a;">■ [14 - 20] (Excellence) : ${dist.tier4} él.</span>
          </div>
        </div>

        <!-- 5. GRILLE DE MAÎTRISE DES COMPÉTENCES DU DEVOIR -->
        <div class="section-title">
          <span class="sec-badge">2</span>
          <span class="sec-title-text">Grille Diagnostique par Compétence & Capacité Évaluée (تفريغ الكفايات والقدرات)</span>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 25%;">Domaine / Exercice</th>
              <th style="width: 35%;">Capacité Mathématique Testée</th>
              <th style="width: 15%;" class="text-center">Taux de Maîtrise</th>
              <th style="width: 25%;">Diagnostic & Erreurs Types Constatées</th>
            </tr>
          </thead>
          <tbody>
            ${competencies.length === 0 ? `
              <tr>
                <td><strong>Exercice 1 : Calcul & Limites</strong></td>
                <td>Lever les indéterminations par factorisation et expression conjuguée</td>
                <td class="text-center"><strong style="color: #15803d;">72 %</strong></td>
                <td style="font-size: 8.5px; color: #475569;">Bonne maîtrise globale, quelques erreurs de signe à l'infini.</td>
              </tr>
              <tr>
                <td><strong>Exercice 2 : Dérivation & Variations</strong></td>
                <td>Étude de la dérivabilité, calcul de $f'(x)$ et signe sur $\\mathcal{D}_f$</td>
                <td class="text-center"><strong style="color: #dc2626;">44 %</strong></td>
                <td style="font-size: 8.5px; color: #475569;">Difficulté récurrente sur la dérivée de $\\ln(u(x))$ et le tableau de signes.</td>
              </tr>
              <tr>
                <td><strong>Exercice 3 : Suites Numériques</strong></td>
                <td>Raisonnement par récurrence et monotonie ($u_{n+1} - u_n$)</td>
                <td class="text-center"><strong style="color: #b45309;">58 %</strong></td>
                <td style="font-size: 8.5px; color: #475569;">Initialisation bien faite ; manque de rigueur dans l'étape d'hérédité.</td>
              </tr>
            ` : competencies.map(c => `
              <tr>
                <td><strong>${esc(c.domain || c.name || 'Exercice')}</strong></td>
                <td>${esc(c.capacity || c.desc || '-')}</td>
                <td class="text-center">
                  <strong style="color: ${parseFloat(c.rate) >= 60 ? '#15803d' : parseFloat(c.rate) >= 45 ? '#b45309' : '#dc2626'};">
                    ${c.rate}%
                  </strong>
                </td>
                <td style="font-size: 8.5px; color: #475569;">${esc(c.diagnostic || '-')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- 6. GROUPES PÉDAGOGIQUES DIFFÉRENCIÉS -->
        <div class="section-title">
          <span class="sec-badge">3</span>
          <span class="sec-title-text">Constitution des Groupes de Besoin & Différenciation (المجموعات البيداغوجية)</span>
        </div>

        <div class="groups-grid">
          <!-- GROUPE REMÉDIATION -->
          <div class="group-card rem">
            <div class="group-header" style="color: #b91c1c;">
              <span>🔴 GROUPE DE REMÉDIATION & SOUTIEN (&lt; 10/20)</span>
              <span>${remediationGroup.length} élève(s)</span>
            </div>
            <div class="group-list">
              ${remediationGroup.length === 0 ? '<em>Aucun élève en situation de difficulté critique.</em>' : remediationGroup.map(s => `
                <strong>${esc(s.name)}</strong> (${s.grade ? `${parseFloat(s.grade).toFixed(2)}` : '-'})
              `).join(' · ')}
            </div>
          </div>

          <!-- GROUPE EXCELLENCE -->
          <div class="group-card exc">
            <div class="group-header" style="color: #15803d;">
              <span>🟢 GROUPE D'APPROFONDISSEMENT & EXCELLENCE (≥ 10/20)</span>
              <span>${excellenceGroup.length} élève(s)</span>
            </div>
            <div class="group-list">
              ${excellenceGroup.length === 0 ? '<em>Aucun élève au-dessus de la moyenne.</em>' : excellenceGroup.map(s => `
                <strong>${esc(s.name)}</strong> (${s.grade ? `${parseFloat(s.grade).toFixed(2)}` : '-'})
              `).join(' · ')}
            </div>
          </div>
        </div>

        <!-- 7. PLAN D'ACTION DE SOUTIEN ET REMÉDIATION -->
        <div class="section-title">
          <span class="sec-badge">4</span>
          <span class="sec-title-text">Plan d'Action Pédagogique Retenu (خطة الدعم والمعالجة المعتمدة)</span>
        </div>

        <div class="action-box">
          ${remediationPlan ? esc(remediationPlan) : `
            <strong>1. Séances de Remédiation Ciblée (Groupe 1) :</strong> Distribution de la <em>Fiche de Remédiation L'CONQ</em> comportant des rappels de cours synthétiques, des exercices guidés avec identification des erreurs types d'examen (dérivées et tableaux de signes).<br/>
            <strong>2. Activités d'Approfondissement (Groupe 2) :</strong> Résolution autonome de la <em>Fiche d'Excellence L'CONQ</em> comprenant des problèmes de synthèse et des questions d'anciens concours (ENSA / ENSAM / Concours d'Accès).<br/>
            <strong>3. Calendrier de Réévaluation :</strong> Mini-test de validation des compétences lacunaires programmé dans un délai de 10 jours.
          `}
        </div>

        <!-- 8. SIGNATURES ET VISAS -->
        <div class="signatures-row">
          <div class="sig-cell">
            <span class="sig-title">Signature de l'Enseignant</span>
            <span class="sig-name">${esc(teacherName)}</span>
          </div>
          <div class="sig-cell">
            <span class="sig-title">Visa de l'Administration Pédagogique</span>
            <span class="sig-hint">تأشيرة الحراسة العامة / المدير</span>
          </div>
          <div class="sig-cell">
            <span class="sig-title">Visa de l'Inspection Pédagogique</span>
            <span class="sig-hint">تأشيرة مفتش مادة الرياضيات</span>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Triggers the browser print dialog for diagnostic report
 */
export function openDiagnosticReportPrintWindow(diagnosticData = {}) {
  const html = buildDiagnosticReportHTML(diagnosticData);
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
    alert("Veuillez autoriser les fenêtres pop-up pour imprimer le rapport diagnostique.");
  }
}
