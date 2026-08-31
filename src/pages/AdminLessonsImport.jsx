import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  UploadCloud, Sparkles, Loader2, CheckCircle2, 
  Trash2, Plus, ArrowLeft, AlertCircle, Save,
  Crop, Eye, Columns, Maximize2, ZoomIn, ZoomOut,
  ChevronLeft, ChevronRight, Image as ImageIcon,
  CheckCircle, AlertTriangle
} from 'lucide-react';
import { addLesson } from '../services/lessonService';
import { SafeInlineMath } from '../utils/mathRenderer';
import SmartTableRenderer, { parseMarkdownTable } from '../components/SmartTableRenderer';
import NationalExamTemplate from '../components/NationalExamTemplate';
import PdfFigureCropperModal from '../components/PdfFigureCropperModal';
import { openNationalExamPrintWindow } from '../utils/generateNationalExamPDF';
import { loadPdfDocument, renderPdfPageToCanvas, cropPdfRegion } from '../utils/pdfFigureExtractor';
import { buildPageSnapshotsMap, attachImagesToSections } from '../utils/pdfImageExtractor';
import { validateExercisePoints, sanitizeMoroccanLatex } from '../utils/scoreBalancingValidator';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href;

// Attempt to repair a truncated JSON string by closing all open structures
const repairTruncatedJson = (str) => {
  if (!str) return str;
  let s = str.trim();
  // Remove trailing comma before closing
  s = s.replace(/,\s*$/, '');
  // Count open braces and brackets
  const stack = [];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\' && inString) { escaped = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (!inString) {
      if (c === '{') stack.push('}');
      else if (c === '[') stack.push(']');
      else if (c === '}' || c === ']') stack.pop();
    }
  }
  // If we're inside an unclosed string, close it first
  if (inString) s += '"';
  // Close all open structures in reverse order
  while (stack.length > 0) s += stack.pop();
  return s;
};

// Preprocess LaTeX backslashes to avoid JavaScript string escape issues
const sanitizeLatexJson = (str) => {
  if (!str) return str;
  let result = '';
  let i = 0;
  while (i < str.length) {
    if (str[i] === '\\') {
      const next = str[i + 1];
      if (next === '"') {
        result += '\\"';
        i += 2;
      } else if (next === '\\') {
        result += '\\\\';
        i += 2;
      } else if (next === 'n') {
        const afterN = str[i + 2];
        const isLetterAfterN = afterN && /[a-zA-Z]/.test(afterN);
        if (isLetterAfterN) {
          result += '\\\\';
          i += 1;
        } else {
          result += '\\n';
          i += 2;
        }
      } else {
        result += '\\\\';
        i += 1;
      }
    } else {
      result += str[i];
      i += 1;
    }
  }
  return result;
};

// Escape literal newlines inside JSON string values to prevent JSON.parse syntax errors
const escapeLiteralNewlinesInJson = (str) => {
  let inString = false;
  let escaped = false;
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      result += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }
    if (inString && (char === '\n' || char === '\r')) {
      if (char === '\n') {
        result += '\\n';
      }
      continue;
    }
    result += char;
  }
  return result;
};

// Escape unescaped double quotes inside JSON string values
const escapeUnescapedQuotesInJson = (str) => {
  if (!str) return str;
  let inString = false;
  let escaped = false;
  let result = '';
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    
    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }
    
    if (char === '\\') {
      result += char;
      escaped = true;
      continue;
    }
    
    if (char === '"') {
      if (!inString) {
        inString = true;
        result += char;
      } else {
        // We are inside a string. Is this the closing quote?
        // Check the next non-whitespace characters to see if they match JSON separators
        let isClosing = false;
        let j = i + 1;
        while (j < str.length && /\s/.test(str[j])) {
          j++;
        }
        if (j < str.length) {
          const nextChar = str[j];
          if (nextChar === ',' || nextChar === '}' || nextChar === ']' || nextChar === ':') {
            isClosing = true;
          }
        } else {
          isClosing = true; // End of string is closing
        }
        
        if (isClosing) {
          inString = false;
          result += char;
        } else {
          // This is an unescaped double quote inside the string! Escape it.
          result += '\\"';
        }
      }
      continue;
    }
    
    result += char;
  }
  return result;
};


// Extract JSON object/array from a string that may contain markdown fences or leading text
const extractJsonFromText = (str) => {
  if (!str) return str;
  // Strip markdown code fences
  let s = str.trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  // Find the first { or [ that starts a JSON structure
  const firstBrace = s.indexOf('{');
  const firstBracket = s.indexOf('[');
  let start = -1;
  if (firstBrace === -1 && firstBracket === -1) return s;
  if (firstBrace === -1) start = firstBracket;
  else if (firstBracket === -1) start = firstBrace;
  else start = Math.min(firstBrace, firstBracket);
  // Find the matching closing character
  const openChar = s[start];
  const closeChar = openChar === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\' && inString) { escaped = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (!inString) {
      if (c === openChar) depth++;
      else if (c === closeChar) {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
  }
  if (end !== -1) return s.slice(start, end + 1);
  // No complete JSON found — return from start to end (will need repair)
  return s.slice(start);
};

// Convert file to base64 string
const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result.split(',')[1]);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const SYSTEM_PROMPT = `Tu es un Professeur Agrégé de mathématiques et Inspecteur Pédagogique, expert en manuels scolaires marocains (niveaux Tronc Commun, 1ère Bac, 2ème Bac — filières SM, PC/SVT, Arts, SGC).
Tu analyses des fiches de cours, chapitres de manuel, séries d'exercices, devoirs surveillés ou épreuves d'examen fournis en PDF ou image.
Ton objectif UNIQUE est de produire un JSON structuré représentant FIDÈLEMENT, INTÉGRALEMENT et INTELLIGEMMENT le contenu pédagogique du document.

════════════════════════════════════════════════════════════
🧠 DÉTECTION AUTOMATIQUE INTELLIGENTE DE NIVEAU, TYPE & BAREME DE NOTATION (POINTS)
════════════════════════════════════════════════════════════
⚠️ DIRECTIVES D'ANALYSE AUTOMATIQUE HAUTE INTELLIGENCE :

1. DÉTECTION AUTOMATIQUE DU NIVEAU PÉDAGOGIQUE ("header.detected_level") :
   - Analyse le titre, l'en-tête, les références officielles et le contenu pour identifier le niveau exact :
     • "common_core_sci"  : Tronc Commun Scientifique (الجدع المشترك العلمي)
     • "common_core_arts" : Tronc Commun Littéraire (الجدع المشترك الأدبي)
     • "1bac_sci"         : 1ère Bac Sciences Expérimentales / Math (الأولى باك علوم تجريبية / رياضية)
     • "1bac_arts"        : 1ère Bac Littéraire (الأولى باك آداب)
     • "2bac_sm"          : 2ème Bac Sciences Mathématiques (الثانية باك علوم رياضية)
     • "2bac_pc_svt"      : 2ème Bac Sciences Expérimentales PC/SVT (الثانية باك علوم تجريبية)
     • "2bac_arts"        : 2ème Bac Lettres & Sciences Humaines (الثانية باك آداب)

2. DÉTECTION RIGOUREUSE DU TYPE DE DOCUMENT ET DE L'ARCHITECTURE ("header.doc_type" & "header.is_national_exam") :
   Tu DOIS IDENTIFIER AVEC PRÉCISION la nature exacte du document parmi ces 5 architectures distinctes :

   • 'exercises' : (سلسلة تمارين / Travaux Dirigés TD / Fiche d'exercices / Exercices d'application / Révision)
     - Tout document contenant les termes "سلسلة تمارين", "سلسلة رقم", "Série d'exercices", "TD", "Travaux dirigés", "Fiche d'exercices", "تمارين داعمة".
     - ⚠️ RÈGLE ABSOLUE & CRUCIALE : Même si la série de تمارين porte un titre mentionnant le Baccalauréat ou les examens nationaux (ex: "سلسلة تمارين مقتطفة من الامتحانات الوطنية" ou "Série Préparation Examen National"), son "header.doc_type" EST IMPÉRATIVEMENT 'exercises' et "header.is_national_exam" DOIT ÊTRE false !

   • 'national' : (الامتحان الوطني الموحد الرسمي للبكالوريا - Sujet Officiel d'Examen National)
     - ⚠️ CETTE ARCHITECTURE EST STRICTEMENT RÉSERVÉE AU SUJET OFFICIEL DE L'EXAMEN NATIONAL DU BACCALAURÉAT imprimé par le Ministère de l'Éducation Nationale (comportant l'en-tête officiel du Royaume du Maroc, le cadre d'examen avec durée, coefficient, code NS/NR, la case triangulaire du sujet, et les consignes officielles).
     - Dans ce cas UNIQUEMENT : définis "header.doc_type": "national" et "header.is_national_exam": true.

   • 'homework' : (فرض محروس / فرض منزلي / مراقبة مستمرة - Devoir Surveillé DS / Devoir Maison DM / Contrôle Continu)
     - Tout document de contrôle : "Devoir Surveillé", "DS N°", "فرض محروس", "فرض منزلي", "Contrôle continu".
     - Définis "header.doc_type": "homework", "header.is_national_exam": false, "header.total_points": 20.

   • 'course' : (درس / ملخص نظري / بطاقة درس - Fiche de cours / Résumé de cours)
     - Document comportant du cours théorique, définitions, théorèmes, propriétés, sans être une pure série d'exercices.
     - Définis "header.doc_type": "course", "header.is_national_exam": false.

   • 'concours' : (مباراة ولوج الكليات والمدارس العليا - Épreuve de Concours)
     - Épreuves de concours d'accès (Médecine FMP/FMD, ENSA, ENSAM, CNC, APESA, etc.).
     - Définis "header.doc_type": "concours", "header.is_national_exam": false.

3. EXTRACTION DU BARÈME DE NOTATION ET DES POINTS ("points" & "header.total_points") :
   - Si le document est un devoir / contrôle / examen ou s'il contient des mentions de points (ex: (1.5 pts), (2 pts), (0.75 pt), [3 pts], (1,5 ن), (2 ن), (0,75 نقطة)) :
     • Dans le "header", indique "total_points": 20 (ou la somme totale des points calculée).
     • Pour CHAQUE exercice ou section (type 'exercise' ou 'activity') :
       - Extrais le nombre numérique de points attribués dans le champ "points" (ex: 3.5, 2, 1.5, 0.75).
       - Conserve aussi les mentions de points des sous-questions dans le texte de l'énoncé (ex: "**1.a.** (0.75 pt) Montrer que...").

4. DÉTAILS DE L'EXAMEN NATIONAL MAROCAIN (UNIQUEMENT SI doc_type === 'national') :
   - Extrais l'objet "header.national_exam_meta" avec les champs exacts :
     - "year": Année de l'examen (ex: "2026")
     - "session": Nom de la session (ex: "الدورة العادية 2026")
     - "subject": Nom de la matière (ex: "الرياضيات")
     - "branch": Branche et filière (ex: "مسلك علوم الحياة والأرض ومسلك العلوم الفيزيائية (خيار فرنسية)")
     - "code": Code du sujet (ex: "NS 22F")
     - "subject_number": Numéro du sujet dans la case triangulaire (ex: "3")
     - "duration": Durée de l'épreuve (ex: "3س")
     - "coefficient": Coefficient de la matière (ex: "7")
     - "total_pages": Nombre total de pages (ex: 8)
     - "general_instructions": Tableau des consignes générales (ex: ["L'utilisation d'une calculatrice non programmable est autorisée ;", ...])
     - "subject_components": Tableau des composantes du sujet [{"name": "Exercice 1", "topic": "Géométrie dans l'espace", "points": "3 points"}, ...]
     - "notations": Tableau des notations officielles figurant sur la page de garde.
     - Pour CHAQUE sous-question de chaque exercice, indique les points attribués ("0.5 pt", "0.25 pt", etc.) et conserve les formules mathématiques en LaTeX ($ ... $).

5. DÉTECTION ET CAPTURE AUTOMATIQUE DES FIGURES GÉOMÉTRIQUES ET COURBES ("figure_bbox") :
   - Si un exercice, une question ou une partie de cours est accompagné d'une figure géométrique, d'une courbe $(C_f)$, d'un tableau graphique, d'un schéma ou d'un dessin :
     • Tu DOIS INSÉRER un élément de type "image" dans le tableau "items" à l'emplacement exact où se trouve la figure.
     • Définis l'objet "figure_bbox" avec les coordonnées de délimitation normalisées sur la page correspondante (échelle 0 à 1000) :
       {
         "type": "image",
         "alt": "Figure : Courbe représentative de la fonction f(x)",
         "figure_bbox": {
           "page": 1,        // Numéro de page (1-indexé)
           "ymin": 250,      // Coordonnée Y supérieure (0-1000)
           "xmin": 520,      // Coordonnée X gauche (0-1000)
           "ymax": 680,      // Coordonnée Y inférieure (0-1000)
           "xmax": 950       // Coordonnée X droite (0-1000)
         },
         "width_pct": 80,
         "align": "center"
       }

6. 📊 DÉTECTION ET EXTRACTION HAUTE-PRÉCISION DES TABLEAUX & TABLEAUX DE VARIATIONS ("table") :
   - Si un cours, une activité ou un exercice contient un tableau (Tableau de valeurs, Tableau statistique, Tableau de vérité, Tableau de signes, Tableau de variation de fonction $f(x)$) :
     • Tu DOIS INSÉRER un élément de type "table" dans le tableau "items" avec la structure JSON exacte :
       {
         "type": "table",
         "title": "Tableau de variation de f(x)",
         "table_data": {
           "headers": ["x", "-\infty", "0", "1", "+\infty"],
           "rows": [
             ["f'(x)", "", "-", "0", "+"],
             ["f(x)", "+\infty", "\searrow", "-2", "\nearrow"]
           ]
         }
       }
     • Pour les flèches de variation : utilise impérativement "\nearrow" (croissante) et "\searrow" (décroissante).
     • Pour les valeurs interdites / discontinuités : utilise "||" (double barre).
     • Pour les zéros sous la dérivée : écris "0".
     • Chaque cellule doit contenir du LaTeX propre sans balises $ imbriquées.

⚠️ DÉCOUPAGE RIGOUREUX ET EXTRACTION INTÉGRALE DES EXERCICES & SÉRIES DE TEMARINE ("content" & "items") :
- Il est STRICTEMENT INTERDIT de n'extraire que la première phrase d'un exercice ou d'omettre les questions !
- Tu DOIS extraire L'ÉNONCÉ INTÉGRAL DE CHAQUE EXERCICE : le texte introductif ET ABSOLUMENT TOUTES LES QUESTIONS ET SOUS-QUESTIONS (1., 2.a., 2.b., 3.a., 3.b., 4., etc.) du début à la fin.
- Pour CHAQUE exercice (Exercice 1, Exercice 2, etc.) ou section d'exercice / activité :
  • Le champ "content" DOIT CONTENIR L'ÉNONCÉ COMPLET MULTI-LIGNES avec TOUTES les questions (chacune sur une ligne avec son barème, ex: "**1.a.** (0.5 pt) Montrer que...").
  • Le tableau "items" DOIT CONTENIR TOUTES LES QUESTIONS ET SOUS-QUESTIONS sous forme d'objets distincts :
    - { "type": "text", "text": "Préambule/Contexte de l'exercice..." }
    - { "type": "bullet", "text": "**1.a.** (0.5 pt) Énoncé de la question en LaTeX..." }
    - { "type": "bullet", "text": "**1.b.** (0.75 pt) ..." }
    ... et ainsi de suite pour 100% des questions du document.

════════════════════════════════════════════════════════════
RÈGLE ABSOLUE DE LANGUE — CONSERVATION RIGOUREUSE DE LA LANGUE D'ORIGINE
════════════════════════════════════════════════════════════
⚠️ INSTRUCTION DE LANGUE OBLIGATOIRE ET PRIORITAIRE :
- Tu DOIS CONSERVER STRICTEMENT ET RIGOUREUSEMENT LA LANGUE ORIGINALE DU DOCUMENT SOURCE.
- Si le fichier / PDF / image est rédigé en ARABE (titres, cours, définitions, théorèmes, activités, questions, exercices, remarques), TOUT LE JSON PRODUIT (titres, sous-titres, texte des items, solutions, remarques) DOIT ÊTRE EN ARABE ! Ne traduis JAMAIS un document arabe en français.
- Si le fichier source est en FRANÇAIS, extrais l'intégralité en français.
- Détermine la langue principale du document et indique-la dans le champ "language" du header/metadata JSON ("ar" ou "fr").
- Ne traduis AUCUN mot, titre, définition ou énoncé d'une langue vers une autre. Le résultat doit respecter à 100% la langue d'origine du fichier importé !

════════════════════════════════════════════════════════════
✨ EXIGENCES D'EXTRACTION INTELLIGENTE : TENSIIQ, NUMÉROTATION ET CORRECTION LINGUISTIQUE
════════════════════════════════════════════════════════════

1. ✍️ CORRECTION LINGUISTIQUE, SPELLING ET ERREURS OCR (إصلاح الأخطاء اللغوية والنحوية) :
   - Tu DOIS corriger AUTOMATIQUEMENT toutes les fautes d'orthographe, de grammaire, de frappe et d'extraction OCR dans le texte source (en arabe ET en français).
   - En ARABE (العربية) : Corriger les fautes d'orthographe et de frappe (الهمزات: أ/إ/آ/ء, التاء المربوطة والهاء: ة/ه, الألف المقصورة: ى/ي), réparer les mots collés ou tronqués par l'OCR (ex: "الامتحان" au lieu de "ألإمتحان" ou "الامتحـان"), et assurer une syntaxe et une grammaire impeccables.
   - En FRANÇAIS : Corriger les fautes de frappe, d'accords, de ponctuation et les accents manquants (é, è, à, ç, etc.) provoqués par la numérisation.
   - Préservation absolue du sens scientifique et mathématique originel.

2. 🔢 NUMÉROTATION INTELLIGENTE ET HARMONIEUSE DES QUESTIONS ET EXERCICES (ترقيم الأسئلة والتمارين) :
   - Numérote clairement et méthodiquement tous les exercices (Exercice 1, Exercice 2...), toutes les activités (Activité 1, Activité 2...), et toutes les sous-questions (1.a., 1.b., 2.a., 2.b...).
   - Restitue la hiérarchie exacte des questions et sous-questions de manière ordonnée et sans aucune omission ni numéros manquants.

3. 🎨 TENSIIQ ET FORMATAGE INTELLIGENT DU CONTENU (التنسيق الذكي) :
   - Applique la syntaxe LaTeX \`$ ... $\` pour TOUT symbole, variable ($x$, $n$, $u_n$, $f(x)$) et expression mathématique inline, et \`$$ ... $$\` pour les équations en bloc.
   - Structure chaque section pédagogique avec une aération optimale, des titres clairs en gras (\`**...**\`), et des encadrés appropriés pour les définitions et théorèmes.

════════════════════════════════════════════════════════════
MODÈLE DE COURS MAROCAIN — STRUCTURE HIÉRARCHIQUE OBLIGATOIRE
════════════════════════════════════════════════════════════

Tout cours de mathématiques marocain suit cette hiérarchie exacte. Tu DOIS la respecter :

┌──────────────────────────────────────────────────────────┐
│  TITRE DU CHAPITRE (ex: "Barycentre")                    │  → header.fiche_title
│                                                          │
│  I. Grand Titre (chiffres romains)                       │  → section_header
│     ┌────────────────────────────────────────┐           │
│     │  1. Définition / Sous-titre            │  → title  │
│     │     ┌──────────────────────────┐       │           │
│     │     │ ✦ Activité ① / ② / ③   │  section distincte │
│     │     │ ✦ Définitions :          │  section distincte │
│     │     │ ✦ Exemple :              │  section distincte │
│     │     │ ✦ Remarques :            │  section distincte │
│     │     │ ✦ Propriété :            │  section distincte │
│     │     │ ✦ Application ① / ② :  │  section distincte │
│     │     │ ✦ Exercice :             │  section distincte │
│     │     └──────────────────────────┘                   │
│     └────────────────────────────────────────┘           │
│  II. Grand Titre suivant                                 │
│  III. ...                                                │
└──────────────────────────────────────────────────────────┘

════════════════════════════════════════════════════════════
RÈGLES DE MAPPING — CHAQUE BLOC PÉDAGOGIQUE = UNE SECTION
════════════════════════════════════════════════════════════

▸ ACTIVITÉ (Activité ①, Activité ②, Activité de soutien des prérequis...) :
  - title: "**Activité ① :** Titre de l'activité" (ou ②, ③, etc.)
  - type: "activity"
  - items: tableau d'items "text" ou "bullet" avec TOUTES les sous-questions numérotées (1., 2., a., b., etc.)
  - Chaque question sur un item séparé. Les sous-questions "a." et "b." sont des items "bullet".
  - Le texte introductif (ex: "Soient A et B deux points...") est le premier item de type "text".
  - Inclure l'accent_text pour les phrases mises en évidence (fond orangé dans le manuel).

▸ DÉFINITIONS / DÉFINITION :
  - title: "**Définitions :**" ou "**Définition :** Nom de la définition"
  - type: "definition"
  - items: le contenu va dans un item de type "highlight_box" (fond grisé / encadré dans le manuel).
  - Respecte les symboles mathématiques officiels : $bar\\{(A;a),(B;b)\\}$, $\\overrightarrow{GA}$, etc.
  - Les sous-points (•) sont des items "bullet" APRÈS le highlight_box principal.

▸ PROPRIÉTÉ / PROPRIÉTÉS :
  - title: "**Propriété :** Nom de la propriété" ou "**Propriétés :**"
  - type: "property"
  - items: le contenu va dans un item "highlight_box" (encadré dans le manuel).
  - Si la propriété a un nom (ex: "conservation du barycentre"), l'inclure dans le title.

▸ THÉORÈME :
  - title: "**Théorème :** Nom du théorème"
  - type: "theorem"
  - items: item "highlight_box" pour l'énoncé.

▸ EXEMPLE :
  - title: "**Exemple :**" ou "**Exemple :** Bref titre"
  - type: "example"
  - items: items "text" ou "bullet" avec l'exemple détaillé.
  - Le texte "O Exemple :" dans le manuel = exactement ce type de section.

▸ REMARQUES / REMARQUE :
  - title: "**Remarques :**" ou "**Remarque :**"
  - type: "remark"
  - items: chaque point "•" est un item "bullet" distinct. Le texte introductif est un item "text".

▸ APPLICATION (Application ①, Application ②...) :
  - title: "**Application ① :**" (ou ②, ③, etc.)
  - type: "activity"
  - content: TOUT le texte de l'application avec les questions numérotées (une par ligne).
  - solution: résolution détaillée si mode résolution activé, sinon "".
  - interactive_answers: [] (tableau vide sauf si réponses numériques simples extraites).

▸ EXERCICE (Exercice 1, Exercice 2, Série d'exercices, Devoir, TD) :
  - title: "**Exercice 1 :**" (ou Exercice 2, Exercice N° X, etc.)
  - type: "exercise"
  - points: barème numérique si présent (ex: 3.5), sinon 0
  - content: L'ÉNONCÉ TOTAL MULTI-LIGNES de l'exercice incluant TOUTES LES QUESTIONS ET SOUS-QUESTIONS (1., 2.a., 2.b., 3., etc.). Ne coupe JAMAIS après la première phrase !
  - items: Tableau d'items contenant le préambule ("text") ET CHAQUE question numérotée ("bullet") avec son énoncé et son barème.
  - solution: Résolution détaillée si disponible, sinon "".

▸ TECHNIQUE DE CONSTRUCTION / MÉTHODE :
  - title: "**Technique de construction :**" ou "**Méthode :**"
  - type: "content"
  - items: items "text" décrivant les étapes.

════════════════════════════════════════════════════════════
EXEMPLE CONCRET — COURS "BARYCENTRE"
════════════════════════════════════════════════════════════

Document source :
  I. Barycentre de deux points pondérés
    1. Définition
      Activité ① : Soutien des prérequis
        ABC est un triangle. Soient I, J et K...
        1. Placer les points I, J et K.
        2. Vérifier que AK = 3AB - 2AC.
      Activité ② :
        Soient A et B deux points distincts...
        1.a. Montrer que AG = (3/5)AB.
           b. Construire le point G.
        [Le point G est appelé le barycentre...]
        2.a. Vérifier, pour tout point M...
           b. En déduire l'ensemble des points M...
      Définitions :
        [Soient (A;a) et (B;b) deux points pondérés tels que a+b≠0...]
        • Si a = b, le point G est appelé l'isobarycentre...
      Exemple :
        Si I est milieu du segment [AB], alors IA + IB = 0...
      Remarques :
        • G = bar{(A;α),(B;β)} ⟺ AG = (b/(a+b))AB
        • Si A ≠ B, alors les points A, B et G sont alignés.
    2. Propriétés du barycentre
      Propriété : conservation du barycentre
        [Si G le barycentre des points pondérés (A;a) et (B;b), alors G est aussi...]
      Propriété caractéristique du barycentre de deux points :
        [Soient (A;a) et (B;b) deux points pondérés tels que a+b≠0...]
      Application ① :
        1. Déterminer a et b pour que G soit le barycentre...
        2. Construire le point G dans le premier cas.

JSON attendu (extrait) :
[
  {
    "id": "sec-1",
    "section_header": "I. Barycentre de deux points pondérés",
    "title": "1. Définition",
    "type": "content",
    "section_number": "I",
    "accent_text": "",
    "items": [
      { "type": "text", "text": "Introduction optionnelle si présente dans le document." }
    ]
  },
  {
    "id": "sec-2",
    "section_header": "I. Barycentre de deux points pondérés",
    "title": "**Activité ① :** Soutien des prérequis",
    "type": "activity",
    "section_number": "I",
    "accent_text": "",
    "items": [
      { "type": "text", "text": "$ABC$ est un triangle. Soient $I$, $J$ et $K$ trois points du plan tels que $\\\\overrightarrow{AI} = \\\\frac{1}{2}\\\\overrightarrow{AB}$ et $\\\\overrightarrow{AJ} = \\\\frac{2}{5}\\\\overrightarrow{AC}$ et $\\\\overrightarrow{BK} = -2\\\\overrightarrow{BC}$." },
      { "type": "bullet", "text": "**1.** Placer les points $I$, $J$ et $K$." },
      { "type": "bullet", "text": "**2.** Vérifier que $\\\\overrightarrow{AK} = 3\\\\overrightarrow{AB} - 2\\\\overrightarrow{AC}$." },
      { "type": "bullet", "text": "**3.** Montrer que $\\\\overrightarrow{IJ} = -\\\\frac{1}{2}\\\\overrightarrow{AB} + \\\\frac{2}{5}\\\\overrightarrow{AC}$." }
    ]
  },
  {
    "id": "sec-3",
    "section_header": "I. Barycentre de deux points pondérés",
    "title": "**Activité ② :**",
    "type": "activity",
    "section_number": "I",
    "accent_text": "Le point G est appelé **le barycentre** des points pondérés $(A;a)$ et $(B;b)$.",
    "items": [
      { "type": "text", "text": "Soient $A$ et $B$ deux points distincts du plan, et $G$ un point tel que $2\\\\overrightarrow{GA} + 3\\\\overrightarrow{GB} = \\\\vec{0}$." },
      { "type": "bullet", "text": "**1.a.** Montrer que $\\\\overrightarrow{AG} = \\\\frac{3}{5}\\\\overrightarrow{AB}$." },
      { "type": "bullet", "text": "**b.** Construire le point $G$." },
      { "type": "bullet", "text": "**2.a.** Vérifier, pour tout point $M$ du plan, que $2\\\\overrightarrow{MA} + 3\\\\overrightarrow{MB} = 5\\\\overrightarrow{MG}$." },
      { "type": "bullet", "text": "**b.** En déduire l'ensemble des points $M$ du plan tel que $\\\\|2\\\\overrightarrow{MA} + 3\\\\overrightarrow{MB}\\\\| = 15$." }
    ]
  },
  {
    "id": "sec-4",
    "section_header": "I. Barycentre de deux points pondérés",
    "title": "**Définitions :**",
    "type": "definition",
    "section_number": "I",
    "accent_text": "",
    "items": [
      { "type": "highlight_box", "text": "Soient $(A;a)$ et $(B;b)$ deux points pondérés tels que $a + b \\\\neq 0$.\\nIl existe un unique point $G$ vérifiant : $a\\\\overrightarrow{GA} + b\\\\overrightarrow{GB} = \\\\vec{0}$.\\nLe point $G$ s'appelle **le barycentre** des points pondérés $(A;a)$ et $(B;b)$ ou barycentre du système pondéré $\\\\{(A;a),(B;b)\\\\}$.\\nOn écrit : $G = bar\\\\{(A;a);(B;b)\\\\}$." },
      { "type": "bullet", "text": "Si $a = b$, le point $G$ est appelé l'isobarycentre des points $A$ et $B$." }
    ]
  },
  {
    "id": "sec-5",
    "section_header": "I. Barycentre de deux points pondérés",
    "title": "**Exemple :**",
    "type": "example",
    "section_number": "I",
    "accent_text": "",
    "items": [
      { "type": "text", "text": "Si $I$ est milieu du segment $[AB]$, alors $\\\\overrightarrow{IA} + \\\\overrightarrow{IB} = \\\\vec{0}$.\\nDonc $I$ est le barycentre des points pondérés $(A;1)$ et $(B;1)$.\\nOn a aussi $I$ est l'isobarycentre des points $A$ et $B$." }
    ]
  },
  {
    "id": "sec-6",
    "section_header": "I. Barycentre de deux points pondérés",
    "title": "**Remarques :**",
    "type": "remark",
    "section_number": "I",
    "accent_text": "",
    "items": [
      { "type": "text", "text": "Soient $(A;a)$ et $(B;b)$ deux points pondérés tels que $a + b \\\\neq 0$." },
      { "type": "bullet", "text": "$G = bar\\\\{(A;\\\\alpha),(B;\\\\beta)\\\\} \\\\Leftrightarrow \\\\overrightarrow{AG} = \\\\frac{b}{a+b}\\\\overrightarrow{AB}$\\n$\\\\Leftrightarrow \\\\overrightarrow{BG} = \\\\frac{a}{a+b}\\\\overrightarrow{BA}$." },
      { "type": "bullet", "text": "Si $A \\\\neq B$, alors les points $A$, $B$ et $G$ sont alignés." }
    ]
  },
  {
    "id": "sec-7",
    "section_header": "I. Barycentre de deux points pondérés",
    "title": "2. Propriétés du barycentre",
    "type": "content",
    "section_number": "I",
    "accent_text": "",
    "items": []
  },
  {
    "id": "sec-8",
    "section_header": "I. Barycentre de deux points pondérés",
    "title": "**Propriété :** conservation du barycentre",
    "type": "property",
    "section_number": "I",
    "accent_text": "",
    "items": [
      { "type": "highlight_box", "text": "Si $G$ le barycentre des points pondérés $(A;a)$ et $(B;b)$, alors $G$ est aussi le barycentre des points pondérés $(A;ka)$ et $(B;kb)$ pour tout réel $k$ non nul." }
    ]
  },
  {
    "id": "app-1",
    "section_header": "I. Barycentre de deux points pondérés",
    "title": "**Application ① :**",
    "type": "activity",
    "section_number": "I",
    "content": "**1.** Déterminer $a$ et $b$ pour que $G$ soit le barycentre du système $\\\\{(A;a);(B;b)\\\\}$ dans chacun des cas suivants :\\n① $\\\\overrightarrow{CA} + 3\\\\overrightarrow{GB} = 2\\\\overrightarrow{AB}$\\n② $-7\\\\overrightarrow{GA} + 3\\\\overrightarrow{GB} = 10$\\n**2.** Construire le point $G$ dans le premier cas.",
    "solution": "",
    "interactive_answers": []
  }
]

════════════════════════════════════════════════════════════
🎯 DIRECTIVES EXIGENCES LATEX HAUTE QUALITÉ & SYMBOLISME RIGOUREUX
════════════════════════════════════════════════════════════

1. INTÉGRALES & CALCUL INTÉGRAL :
   - Intégrale définie : $\int_{a}^{b} f(x) \, \mathrm{d}x$ (espace '\,' et différentielle '\mathrm{d}x')
   - Crochet d'intégration : $\left[ F(x) \right]_{a}^{b} = F(b) - F(a)$
   - Intégrale par parties : $\int_{a}^{b} u(x)v'(x) \, \mathrm{d}x = \left[ u(x)v(x) \right]_{a}^{b} - \int_{a}^{b} u'(x)v(x) \, \mathrm{d}x$

2. LIMITES & ASYMPTOTES :
   - Forme canonique : $\lim_{x \to a} f(x) = L$ et $\lim_{x \to \pm\infty} \frac{f(x)}{x} = l$
   - Flèches de limite : toujours $\to$ (jamais -> ou \rightarrow)

3. VECTEURS, NORMES & GÉOMÉTRIE (MAROC) :
   - Flèche complète : $\overrightarrow{AB}$, $\overrightarrow{u}$ (jamais \vec{})
   - Produit vectoriel officiel : $\overrightarrow{u} \wedge \overrightarrow{v}$ (symbole \wedge)
   - Produit scalaire : $\overrightarrow{u} \cdot \overrightarrow{v}$ ou $\overrightarrow{AB} \cdot \overrightarrow{AC}$
   - Norme : $\left\| \overrightarrow{AB} \right\|$ ou $\left\| \overrightarrow{u} \right\|$

4. FRACTIONS ET PARENTHÈSES AUTOSIZE :
   - Utiliser $\left( \dfrac{a}{b} \right)$, $\left[ ... \right]$, $\left\{ ... \right\}$ pour des formules aérées sans chevauchement.
   - Utiliser $\dfrac{a}{b}$ pour les fractions principales en mode ligne.

5. ENSEMBLES ET NOTATIONS :
   - Ensembles officiels : $\mathbb{R}$, $\mathbb{N}$, $\mathbb{Z}$, $\mathbb{C}$, $\mathbb{Q}$, $\mathbb{R}^*$, $\mathbb{R}_+^*$
   - Intervalles : $[a; b]$, $]a; b[$, $[a; +\infty[$ (avec point-virgule)
   - Systèmes d'équations : $\begin{cases} ax + by = c \\ dx + ey = f \end{cases}$

6. DOUBLE BACKSLASH DANS LE JSON :
   - Dans toutes les chaînes JSON, échapper CHAQUE antislash LaTeX avec un double antislash (ex: \frac → \\frac, \overrightarrow → \\overrightarrow, \neq → \\neq).
   - Formules en ligne: $...$ — Formules en bloc: $$...$$

════════════════════════════════════════════════════════════
RÈGLES accent_text
════════════════════════════════════════════════════════════

Le champ accent_text contient le texte mis en évidence dans un fond coloré (orangé/jaune) dans le manuel.
Exemples: "Le point G est appelé **le barycentre** des points pondérés $(A;a)$ et $(B;b)$."
Si aucun texte en évidence, laisse accent_text à "".

════════════════════════════════════════════════════════════
RÈGLE CRITIQUE — NE RIEN OMETTRE
════════════════════════════════════════════════════════════

✅ Extrais CHAQUE bloc pédagogique comme une section distincte.
✅ Ne regroupe pas une Propriété et une Application dans la même section.
✅ Ne résume PAS : copie FIDÈLEMENT tout le texte, formule par formule, ligne par ligne.
✅ Les numéros d'Activité et d'Application (①②③ ou 1,2,3) DOIVENT apparaître dans le titre.
✅ Retourne UNIQUEMENT le JSON brut. Zéro texte avant ou après. Pas de bloc \`\`\`json.

════════════════════════════════════════════════════════════
SCHÉMA JSON OBLIGATOIRE
════════════════════════════════════════════════════════════

{
  "header": {
    "prep_title": "Titre de la série ou de la préparation si présent, sinon \"\"",
    "subject": "Matière (ex: Mathématiques)",
    "fiche_title": "Titre du chapitre ou du devoir (ex: Devoir Surveillé N°1 ou Barycentre)",
    "teacher": "Nom du professeur si présent, sinon \"\"",
    "phone": "Téléphone si présent, sinon \"\"",
    "doc_type": "'course' | 'homework' | 'exercises' | 'concours'",
    "detected_level": "'common_core_sci' | 'common_core_arts' | '1bac_sci' | '1bac_arts' | '2bac_sm' | '2bac_pc_svt' | '2bac_arts'",
    "total_points": 20
  },
  "sections": [
    {
      "id": "sec-1",
      "section_header": "I. Grand titre (chiffres romains) — RÉPÉTER sur toutes les sections du même chapitre",
      "title": "1. Sous-titre OU **Activité ① :** titre OU **Définitions :** OU **Propriété :** nom OU ...",
      "type": "content | definition | property | theorem | corollary | example | remark | activity",
      "section_number": "I",
      "accent_text": "Texte mis en évidence (fond coloré) si présent, sinon \"\"",
      "items": [
        { "type": "text", "text": "Paragraphe ou introduction." },
        { "type": "highlight_box", "text": "Contenu encadré (définition, propriété, théorème)." },
        { "type": "bullet", "text": "• Point de liste ou sous-question." },
        {
          "type": "grid_items",
          "cols": 2,
          "grid_items": [
            "a. \\lim_{x \\to +\\infty} \\frac{2x^2+x+3}{x-1}",
            "b. \\lim_{x \\to -\\infty} \\frac{x|x|-4x+3}{x^2-7x+2}",
            "c. \\lim_{x \\to -2} \\frac{x^2+5x+6}{x+2}",
            "d. \\lim_{x \\to -3} \\frac{2x^2+3x-9}{x^2+x-6}"
          ]
        },
        {
          "type": "image",
          "url": "",
          "svg_code": "",
          "alt": "Légende ou description de la figure (ex: Figure 1 — Construction du barycentre G)",
          "align": "center",
          "width_pct": 70
        }
      ]
    },
    {
      "id": "ex-1",
      "section_header": "Exercice 1 : Calcul de limites & Étude de fonction",
      "title": "**Exercice 1 :** (4 pts)",
      "type": "exercise",
      "points": 4,
      "section_number": "1",
      "content": "Soit $f$ la fonction numérique définie par $f(x) = \\dfrac{2x^2+x+3}{x-1}$.\n**1.a.** (1 pt) Déterminer le domaine de définition $D_f$.\n**1.b.** (1 pt) Calculer $\\lim_{x \\to +\\infty} f(x)$ et $\\lim_{x \\to 1^+} f(x)$.\n**2.** (2 pts) Étudier la dérivabilité de $f$ en $x_0 = 2$.",
      "items": [
        { "type": "text", "text": "Soit $f$ la fonction numérique définie par $f(x) = \\dfrac{2x^2+x+3}{x-1}$." },
        { "type": "bullet", "text": "**1.a.** (1 pt) Déterminer le domaine de définition $D_f$." },
        { "type": "bullet", "text": "**1.b.** (1 pt) Calculer $\\lim_{x \\to +\\infty} f(x)$ et $\\lim_{x \\to 1^+} f(x)$." },
        { "type": "bullet", "text": "**2.** (2 pts) Étudier la dérivabilité de $f$ en $x_0 = 2$." }
      ],
      "solution": "Solution détaillée si disponible, sinon \"\"",
      "interactive_answers": []
    }
  ]
}

NOTE CRITIQUE SUR LES IMAGES ET FIGURES :
Si le document contient une figure géométrique, un graphique, un schéma, une courbe ou toute zone visuelle non-textuelle :
⚠️ Tu DOIS obligatoirement insérer un item de type "image" À L'EMPLACEMENT EXACT de la figure dans le tableau "items".
⚠️ Tu DOIS indiquer les coordonnées PRÉCISES du "figure_bbox" sur la page correspondante (échelle 0-1000) :
  - "page": numéro de la page où se trouve la figure (1-indexé)
  - "xmin": limite gauche de la figure (entre 0 et 1000, ex: 50 pour 5% depuis la gauche)
  - "xmax": limite droite (ex: 950 pour 95% depuis la gauche)
  - "ymin": limite supérieure (ex: 300 pour 30% depuis le haut)
  - "ymax": limite inférieure (ex: 700 pour 70% depuis le haut)
- url: "" (laisser vide — sera remplie automatiquement par le système)
- alt: Description précise de la figure (ex: "Figure — Construction du barycentre G des points A(2) et B(3)")
- align: "center" par défaut
- width_pct: 80 par défaut
EXEMPLE de figure en bas à droite sur la page 2 :
{ "type": "image", "url": "", "alt": "Courbe représentative de f", "figure_bbox": { "page": 2, "xmin": 500, "ymin": 400, "xmax": 960, "ymax": 850 }, "width_pct": 80, "align": "center" }
`;


function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

import { normalizeLevel } from '../utils/levelHelpers';

export default function AdminLessonsImport({ onBack }) {
  const isMobile = useIsMobile();
  const { schools, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  if (!authLoading && user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const fileInputRef = useRef();

  // Setup state
  const [provider, setProvider] = useState(() => localStorage.getItem('aiImportProvider') || 'gemini');
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('geminiApiKey') || '');
  const [geminiModel, setGeminiModel] = useState(() => localStorage.getItem('geminiModel') || 'gemini-3.5-flash');

  const [claudeKey, setClaudeKey] = useState(() => localStorage.getItem('claudeApiKey') || '');
  const [claudeModel, setClaudeModel] = useState(() => localStorage.getItem('claudeModel') || 'claude-3-5-sonnet-20241022');
  const [proxyUrl, setProxyUrl] = useState(() => localStorage.getItem('claudeProxyUrl') || '');

  const [deepseekKey, setDeepseekKey] = useState(() => localStorage.getItem('deepseekApiKey') || 'sk-12a7032f07d740348c607ef947a0a9f7');
  const [deepseekUrl, setDeepseekUrl] = useState(() => localStorage.getItem('deepseekApiUrl') || 'https://api.deepseek.com');
  const [deepseekModel, setDeepseekModel] = useState(() => {
    const m = localStorage.getItem('deepseekModel') || 'deepseek-v4-pro';
    if (m === 'deepseek-reasoner' || m === 'deepseek-r1') return 'deepseek-v4-pro';
    if (m === 'deepseek-chat' || m === 'deepseek-v3') return 'deepseek-v4-flash';
    return m;
  });
  
  const [uploadFile, setUploadFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [detectedModels, setDetectedModels] = useState([]);

  // Form State for editing the parsed result
  const [phase, setPhase] = useState(1); // 1 = Upload & Parse, 2 = Review & Edit
  const [ficheTitle, setFicheTitle] = useState('');
  const [isNationalExam, setIsNationalExam] = useState(false);
  const [nationalExamMeta, setNationalExamMeta] = useState(null);
  const [viewNationalTemplate, setViewNationalTemplate] = useState(false);
  const [subject, setSubject] = useState('Algèbre');
  const [chapterNumber, setChapterNumber] = useState('');
  const [teacher, setTeacher] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedSchools, setSelectedSchools] = useState([]);
  const [sections, setSections] = useState([]);
  const [prepTitle, setPrepTitle] = useState('Préparation aux concours');
  const [selectedLevel, setSelectedLevel] = useState('2bac_pc_svt');
  const [docType, setDocType] = useState('course');
  const [docLanguage, setDocLanguage] = useState('fr');
  const [topics, setTopics] = useState([]);
  const [totalPoints, setTotalPoints] = useState(20);

  // Page snapshots map — { [pageNum]: dataUrl } — built after AI analysis for figure placeholders
  const [pageSnapshotsMap, setPageSnapshotsMap] = useState({});

  // PDF Document & Interactive Cropping Canvas State
  const [pdfDocProxy, setPdfDocProxy] = useState(null);
  const [pdfPageNum, setPdfPageNum] = useState(1);
  const [pdfTotalPages, setPdfTotalPages] = useState(1);
  const [pdfScale, setPdfScale] = useState(1.3);
  const [isSplitView, setIsSplitView] = useState(true);
  const [isCropping, setIsCropping] = useState(false);
  const [cropTargetSectionIdx, setCropTargetSectionIdx] = useState(null);
  const [cropTargetItemIdx, setCropTargetItemIdx] = useState(null);
  const [cropBox, setCropBox] = useState(null); // { x, y, width, height }
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const pdfCanvasRef = useRef(null);
  const pdfContainerRef = useRef(null);

  // Initialize PDF doc proxy when file is uploaded or analyzed
  useEffect(() => {
    if (!uploadFile) {
      setPdfDocProxy(null);
      return;
    }
    if (uploadFile.type === 'application/pdf' || uploadFile.name?.endsWith('.pdf')) {
      loadPdfDocument(uploadFile).then(doc => {
        setPdfDocProxy(doc);
        setPdfTotalPages(doc.numPages);
        setPdfPageNum(1);
      }).catch(err => {
        console.warn('PDF Preview init error:', err);
      });
    }
  }, [uploadFile]);

  // Render current PDF page to canvas
  const renderCurrentPdfPage = useCallback(async () => {
    if (!pdfDocProxy || !pdfCanvasRef.current) return;
    try {
      await renderPdfPageToCanvas(pdfDocProxy, pdfPageNum, pdfCanvasRef.current, pdfScale);
    } catch (err) {
      console.warn('Error rendering PDF page to canvas:', err);
    }
  }, [pdfDocProxy, pdfPageNum, pdfScale]);

  useEffect(() => {
    if (phase === 2 && pdfDocProxy) {
      renderCurrentPdfPage();
    }
  }, [phase, pdfDocProxy, pdfPageNum, pdfScale, renderCurrentPdfPage]);

  // Cropper Modal State
  const [isCropperModalOpen, setIsCropperModalOpen] = useState(false);
  const [cropModalSecIdx, setCropModalSecIdx] = useState(0);
  const [cropModalItemIdx, setCropModalItemIdx] = useState(null);

  // Open interactive cropper modal for a section/item, optionally jumping to a specific PDF page
  const handleOpenCropperModal = (secIdx = 0, itemIdx = null) => {
    setCropModalSecIdx(secIdx);
    setCropModalItemIdx(itemIdx);
    setIsCropperModalOpen(true);
  };

  // Jump to the figure's page in the PDF viewer and open the cropper modal
  const handleJumpAndCrop = (secIdx, itemIdx, pageNum) => {
    if (pageNum && pdfDocProxy) {
      setPdfPageNum(Math.max(1, Math.min(pdfTotalPages, pageNum)));
    }
    handleOpenCropperModal(secIdx, itemIdx);
  };

  // Handle completed crop from modal
  const handleCropComplete = ({ url, alt, width_pct, align, targetSectionIdx, targetItemIdx }) => {
    setSections(prev => {
      const next = [...prev];
      const secIdx = (targetSectionIdx !== undefined && targetSectionIdx !== null && next[targetSectionIdx]) ? targetSectionIdx : 0;
      if (!next[secIdx]) return prev;

      const sec = { ...next[secIdx] };
      const items = Array.isArray(sec.items) ? [...sec.items] : [];

      const newImageItem = {
        type: 'image',
        url,
        alt: alt || 'Figure géométrique',
        width_pct: width_pct || 80,
        align: align || 'center'
      };

      if (targetItemIdx !== null && targetItemIdx >= 0 && items[targetItemIdx]?.type === 'image') {
        items[targetItemIdx] = {
          ...items[targetItemIdx],
          url,
          alt: alt || items[targetItemIdx].alt || 'Figure géométrique',
          width_pct: width_pct || items[targetItemIdx].width_pct || 80,
          align: align || items[targetItemIdx].align || 'center'
        };
      } else if (targetItemIdx !== null && targetItemIdx >= 0) {
        items.splice(targetItemIdx + 1, 0, newImageItem);
      } else {
        items.push(newImageItem);
      }

      sec.items = items;
      next[secIdx] = sec;
      return next;
    });
  };

  // Trigger inline crop for a section/item
  const startCropForSection = (secIdx, itemIdx = null) => {
    handleOpenCropperModal(secIdx, itemIdx);
  };

  // Perform split-screen inline crop extraction
  const handleConfirmCrop = async () => {
    if (!pdfDocProxy || !cropBox || cropTargetSectionIdx === null) {
      setIsCropping(false);
      return;
    }
    try {
      const canvas = pdfCanvasRef.current;
      if (!canvas) return;

      const normRect = {
        x: cropBox.x / canvas.width,
        y: cropBox.y / canvas.height,
        width: cropBox.width / canvas.width,
        height: cropBox.height / canvas.height
      };

      const croppedDataUrl = await cropPdfRegion(pdfDocProxy, pdfPageNum, normRect, true, 2.5);

      handleCropComplete({
        url: croppedDataUrl,
        alt: `Figure extraite de la page ${pdfPageNum}`,
        width_pct: 80,
        align: 'center',
        targetSectionIdx: cropTargetSectionIdx,
        targetItemIdx: cropTargetItemIdx
      });

      setIsCropping(false);
      setCropBox(null);
      setCropTargetSectionIdx(null);
      setCropTargetItemIdx(null);
    } catch (err) {
      alert("Erreur lors de l'extraction de l'image : " + err.message);
    }
  };

  // Load API key from settings if updated
  useEffect(() => {
    const sync = () => {
      setProvider(localStorage.getItem('aiImportProvider') || 'gemini');
      setGeminiKey(localStorage.getItem('geminiApiKey') || '');
      setGeminiModel(localStorage.getItem('geminiModel') || 'gemini-3.5-flash');
      setClaudeKey(localStorage.getItem('claudeApiKey') || '');
      setClaudeModel(localStorage.getItem('claudeModel') || 'claude-3-5-sonnet-20241022');
      setProxyUrl(localStorage.getItem('claudeProxyUrl') || '');
      setDeepseekKey(localStorage.getItem('deepseekApiKey') || '');
      setDeepseekUrl(localStorage.getItem('deepseekApiUrl') || 'https://api.deepseek.com');
      const rawDs = localStorage.getItem('deepseekModel') || 'deepseek-v4-pro';
      const dsModel = (rawDs === 'deepseek-reasoner' || rawDs === 'deepseek-r1')
        ? 'deepseek-v4-pro'
        : (rawDs === 'deepseek-chat' || rawDs === 'deepseek-v3')
          ? 'deepseek-v4-flash'
          : rawDs;
      setDeepseekModel(dsModel);
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadFile(file);
    setFileName(file.name);
    setError('');
  };

  const fetchGeminiWithPdf = async (base64Data, fileType) => {
    const modelToUse = geminiModel || 'gemini-3.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${geminiKey}`;
    
    const solveSolutions = localStorage.getItem('gemini_solve_solutions') !== 'false';
    const NO_SOLUTION_ADDENDUM = `
⚠️ INSTRUCTION STRICTE — MODE EXTRACTION UNIQUEMENT (SANS RÉSOLUTION) :
- Tu dois extraire et structurer FIDÈLEMENT tout le contenu du document (énoncés, cours, définitions, théorèmes, propriétés, remarques, activités, applications).
- Pour le champ "solution" de chaque exercice, écris UNIQUEMENT la chaîne vide "" — ne fournis AUCUNE résolution, aucune étape de calcul, aucune réponse numérique.
- Pour le tableau "interactive_answers", retourne un tableau vide [].
- N'explique pas pourquoi tu ne résous pas. Mets juste "" dans le champ solution.
- Cette consigne est ABSOLUE et PRIORITAIRE sur toutes les autres instructions du prompt système.`;

    const systemContent = solveSolutions
      ? SYSTEM_PROMPT
      : SYSTEM_PROMPT + NO_SOLUTION_ADDENDUM;

    const userText = solveSolutions
      ? "Transcris et extrais l'intégralité absolue de ce document DANS SA LANGUE D'ORIGINE (si le document est en arabe, extrais TOUT en arabe sans traduire en français). POUR LES SÉRIES D'EXERCICES ET TEMARINE : Extrais TOUTES LES QUESTIONS ET SOUS-QUESTIONS (1., 2.a., 2.b., 3., etc.) sans exception. Ne t'arrête JAMAIS à la première phrase d'un exercice ! Extrais l'énoncé complet du début à la fin de chaque exercice dans \"content\" et dans \"items\". Ne résume rien et génère le JSON complet."
      : "Extrais et structure FIDÈLEMENT tout le contenu DANS SA LANGUE D'ORIGINE (si le document est en arabe, extrais TOUT en arabe sans traduire en français). POUR LES SÉRIES D'EXERCICES ET TEMARINE : Extrais TOUTES LES QUESTIONS ET SOUS-QUESTIONS (1., 2.a., 2.b., 3., etc.) sans exception. Ne t'arrête JAMAIS à la première phrase ! Extrais l'énoncé complet du début à la fin de chaque exercice dans \"content\" et dans \"items\". IMPORTANT : Laisse le champ \"solution\" vide (\"\") pour chaque exercice et \"interactive_answers\" comme tableau vide []. Ne résous rien.";

    const payload = {
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: fileType,
                data: base64Data
              }
            },
            {
              text: userText
            }
          ]
        }
      ],
      systemInstruction: {
        parts: [{ text: systemContent }]
      },
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 65536,
        temperature: 0.1
      }
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Erreur HTTP ${res.status}`);
    }

    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text;
  };

  const streamClaudeWithPdf = async (base64Data, fileType) => {
    const endpoint = proxyUrl || 'https://api.anthropic.com/v1/messages';
    const headers = {
      'Content-Type': 'application/json',
    };
    if (proxyUrl) {
      if (claudeKey) headers['x-api-key'] = claudeKey;
    } else {
      headers['x-api-key'] = claudeKey;
      headers['anthropic-version'] = '2023-06-01';
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
    }

    const isPdf = fileType === 'application/pdf';
    const sourceBlock = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } }
      : { type: 'image', source: { type: 'base64', media_type: fileType, data: base64Data } };

    const solveSolutions = localStorage.getItem('claude_solve_solutions') !== 'false';
    const NO_SOLUTION_ADDENDUM = `
⚠️ INSTRUCTION STRICTE — MODE EXTRACTION UNIQUEMENT (SANS RÉSOLUTION) :
- Tu dois extraire et structurer FIDÈLEMENT tout le contenu du document (énoncés, cours, définitions, théorèmes, propriétés, remarques, activités, applications).
- Pour le champ "solution" de chaque exercice, écris UNIQUEMENT la chaîne vide "" — ne fournis AUCUNE résolution, aucune étape de calcul, aucune réponse numérique.
- Pour le tableau "interactive_answers", retourne un tableau vide [].
- N'explique pas pourquoi tu ne résous pas. Mets juste "" dans le champ solution.
- Cette consigne est ABSOLUE et PRIORITAIRE sur toutes les autres instructions du prompt système.`;

    const systemContent = solveSolutions
      ? SYSTEM_PROMPT
      : SYSTEM_PROMPT + NO_SOLUTION_ADDENDUM;

    const userText = solveSolutions
      ? "Transcris et extrais l'intégralité absolue de ce document DANS SA LANGUE D'ORIGINE (si le document est en arabe, extrais TOUT en arabe sans traduire en français). POUR LES SÉRIES D'EXERCICES ET TEMARINE : Extrais TOUTES LES QUESTIONS ET SOUS-QUESTIONS (1., 2.a., 2.b., 3., etc.) sans exception. Ne t'arrête JAMAIS à la première phrase d'un exercice ! Extrais l'énoncé complet du début à la fin de chaque exercice dans \"content\" et dans \"items\". Ne résume rien et génère le JSON complet."
      : "Extrais et structure FIDÈLEMENT tout le contenu DANS SA LANGUE D'ORIGINE (si le document est en arabe, extrais TOUT en arabe sans traduire en français). POUR LES SÉRIES D'EXERCICES ET TEMARINE : Extrais TOUTES LES QUESTIONS ET SOUS-QUESTIONS (1., 2.a., 2.b., 3., etc.) sans exception. Ne t'arrête JAMAIS à la première phrase ! Extrais l'énoncé complet du début à la fin de chaque exercice dans \"content\" et dans \"items\". IMPORTANT : Laisse le champ \"solution\" vide (\"\") pour chaque exercice et \"interactive_answers\" comme tableau vide []. Ne résous rien.";

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: claudeModel,
        max_tokens: 16000,
        stream: true,
        system: systemContent,
        messages: [{
          role: 'user',
          content: [
            sourceBlock,
            { type: 'text', text: userText }
          ]
        }]
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err?.error?.message || err?.message || JSON.stringify(err);
      throw new Error(`Erreur Claude ${res.status}: ${msg}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const dataStr = line.slice(6).trim();
        if (dataStr === '[DONE]') break;
        try {
          const evt = JSON.parse(dataStr);
          if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
            accumulated += evt.delta.text;
            const secCount = (accumulated.match(/"id"/g) || []).length;
            setProgress(`⚡ Réception en cours... ${secCount > 0 ? `${secCount} sections détectées` : ''} (${(accumulated.length/1000).toFixed(1)}k caractères)`);
          }
        } catch { /* skip */ }
      }
    }

    return accumulated;
  };

  const extractTextFromPdf = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += `--- PAGE ${i} ---\n${pageText}\n\n`;
    }
    return fullText;
  };

  const fetchDeepSeekWithText = async (pdfText) => {
    const rawModel = deepseekModel || 'deepseek-v4-pro';
    const modelToUse = (rawModel === 'deepseek-reasoner' || rawModel === 'deepseek-r1')
      ? 'deepseek-v4-pro'
      : (rawModel === 'deepseek-chat' || rawModel === 'deepseek-v3')
        ? 'deepseek-v4-flash'
        : rawModel;
    const cleanUrl = deepseekUrl.trim().replace(/\/$/, '');
    const endpoint = `${cleanUrl}/v1/chat/completions`;

    const solveSolutions = localStorage.getItem('deepseek_solve_solutions') !== 'false';

    const NO_SOLUTION_ADDENDUM = `
⚠️ INSTRUCTION STRICTE — MODE EXTRACTION UNIQUEMENT (SANS RÉSOLUTION) :
- Tu dois extraire et structurer FIDÈLEMENT tout le contenu du document (énoncés, cours, définitions, théorèmes, propriétés, remarques, activités, applications).
- Pour le champ "solution" de chaque exercice, écris UNIQUEMENT la chaîne vide "" — ne fournis AUCUNE résolution, aucune étape de calcul, aucune réponse numérique.
- Pour le tableau "interactive_answers", retourne un tableau vide [].
- N'explique pas pourquoi tu ne résous pas. Mets juste "" dans le champ solution.
- Cette consigne est ABSOLUE et PRIORITAIRE sur toutes les autres instructions du prompt système.`;

    const systemContent = solveSolutions
      ? SYSTEM_PROMPT
      : SYSTEM_PROMPT + NO_SOLUTION_ADDENDUM;

    const userContent = solveSolutions
      ? `TEXTE DU DOCUMENT :
${pdfText}

Transcris et extrais l'intégralité absolue de ce texte DANS SA LANGUE D'ORIGINE (si le document est en arabe, extrais TOUT en arabe sans traduire en français). POUR LES SÉRIES D'EXERCICES ET TEMARINE : Extrais TOUTES LES QUESTIONS ET SOUS-QUESTIONS (1., 2.a., 2.b., 3., etc.) sans exception. Ne t'arrête JAMAIS à la première phrase d'un exercice ! Extrais l'énoncé complet du début à la fin de chaque exercice dans "content" et dans "items". Ne résume rien et génère le JSON complet.`
      : `TEXTE DU DOCUMENT :
${pdfText}

Extrais et structure FIDÈLEMENT tout le contenu DANS SA LANGUE D'ORIGINE (si le document est en arabe, extrais TOUT en arabe sans traduire en français). POUR LES SÉRIES D'EXERCICES ET TEMARINE : Extrais TOUTES LES QUESTIONS ET SOUS-QUESTIONS (1., 2.a., 2.b., 3., etc.) sans exception. Ne t'arrête JAMAIS à la première phrase ! Extrais l'énoncé complet du début à la fin de chaque exercice dans "content" et dans "items". IMPORTANT : Laisse le champ "solution" vide ("") pour chaque exercice et "interactive_answers" comme tableau vide []. Ne résous rien.`;

    const payload = {
      model: modelToUse,
      messages: [
        { role: "system", content: systemContent },
        { role: "user",   content: userContent }
      ],
      response_format: !modelToUse.includes('reasoner') ? { type: 'json_object' } : undefined,
      temperature: 0.1
    };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${deepseekKey}`
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err?.error?.message || err?.message || JSON.stringify(err);
      throw new Error(`Erreur DeepSeek ${res.status}: ${msg}`);
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content;
  };

  const handleAnalyze = async () => {
    if (provider === 'gemini' && !geminiKey) {
      setError('Clé API Gemini manquante. Veuillez la configurer.');
      return;
    }
    if (provider === 'claude' && !claudeKey) {
      setError('Clé API Claude manquante. Veuillez la configurer.');
      return;
    }
    if (provider === 'deepseek' && !deepseekKey) {
      setError('Clé API DeepSeek manquante. Veuillez la configurer.');
      return;
    }
    if (!uploadFile) {
      setError('Veuillez sélectionner un fichier PDF ou une image.');
      return;
    }

    setLoading(true);
    setError('');
    setDetectedModels([]);
    setProgress('Préparation du fichier...');
    setProgressPercent(5);

    let progressInterval = setInterval(() => {
      setProgressPercent(prev => {
        if (prev < 30) {
          setProgress('Lecture et encodage du document...');
          return prev + 5;
        } else if (prev < 65) {
          setProgress('Envoi à l\'IA & traitement...');
          return prev + 3;
        } else if (prev < 92) {
          setProgress('Génération de la fiche structurée LaTeX...');
          return prev + 1;
        }
        return prev;
      });
    }, 800);

    try {
      let rawText = '';
      
      if (provider === 'claude') {
        const base64Data = await fileToBase64(uploadFile);
        setProgress('Envoi du document à Anthropic Claude...');
        rawText = await streamClaudeWithPdf(base64Data, uploadFile.type);
      } else if (provider === 'deepseek') {
        const isPdf = uploadFile.type === 'application/pdf';
        if (!isPdf) {
          throw new Error("DeepSeek ne prend en charge que les fichiers textuels (PDF). Veuillez utiliser Gemini ou Claude pour les images.");
        }
        setProgress('Extraction du texte du PDF...');
        const pdfText = await extractTextFromPdf(uploadFile);
        setProgress('Envoi du texte à DeepSeek...');
        rawText = await fetchDeepSeekWithText(pdfText);
      } else {
        const base64Data = await fileToBase64(uploadFile);
        setProgress('Envoi du fichier à Google Gemini...');
        rawText = await fetchGeminiWithPdf(base64Data, uploadFile.type);
      }

      if (!rawText) {
        throw new Error("L'API n'a retourné aucun contenu.");
      }

      let parsed;
      let cleanText = rawText.trim();
      if (cleanText.includes('</think>')) {
        cleanText = cleanText.split('</think>').pop().trim();
      }
      cleanText = sanitizeLatexJson(cleanText);

      const parseStrategies = [
        // Strategy 1: Direct JSON parse of the extracted JSON block
        (txt) => JSON.parse(extractJsonFromText(txt)),
        
        // Strategy 2: Escape literal newlines inside strings
        (txt) => JSON.parse(escapeLiteralNewlinesInJson(extractJsonFromText(txt))),
        
        // Strategy 3: Escape literal newlines + escape unescaped inner quotes
        (txt) => JSON.parse(escapeUnescapedQuotesInJson(escapeLiteralNewlinesInJson(extractJsonFromText(txt)))),
        
        // Strategy 4: Escape literal newlines + escape unescaped inner quotes + repair truncation
        (txt) => JSON.parse(repairTruncatedJson(escapeUnescapedQuotesInJson(escapeLiteralNewlinesInJson(extractJsonFromText(txt))))),
        
        // Strategy 5: LaTeX sanitize + escape literal newlines + escape unescaped inner quotes + repair truncation
        (txt) => JSON.parse(repairTruncatedJson(escapeUnescapedQuotesInJson(escapeLiteralNewlinesInJson(sanitizeLatexJson(extractJsonFromText(txt))))))
      ];

      let parseError = null;
      for (let i = 0; i < parseStrategies.length; i++) {
        try {
          parsed = parseStrategies[i](cleanText);
          console.log(`[JSON Parse] Strategy ${i + 1} succeeded!`);
          break;
        } catch (e) {
          console.warn(`[JSON Parse] Strategy ${i + 1} failed:`, e.message);
          parseError = e;
        }
      }

      if (!parsed) {
        throw new Error(
          `Impossible de lire la réponse JSON.\n` +
          `Erreur : ${parseError ? parseError.message : 'JSON invalide'}\n\n` +
          `💡 Solutions :\n` +
          `• Essayez un autre modèle/moteur d'IA\n` +
          `• Découpez le document en sections plus courtes\n` +
          `• Vérifiez ou saisissez votre clé API`
        );
      }

      console.log('[Extraction Response]:', parsed);

      const header = parsed?.header || {};
      const rawSections = Array.isArray(parsed) ? parsed : (parsed?.sections || []);

      // Populate form state safely
      setFicheTitle(header.fiche_title || header.title || '');
      setSubject(header.subject || 'Mathématiques');
      setPrepTitle(header.prep_title || 'Préparation aux concours');
      setTeacher(header.teacher || '');
      setPhone(header.phone || '');
      setTopics(Array.isArray(header.topics) ? header.topics : []);
      if (header.total_points) setTotalPoints(header.total_points);

      // Deterministic Document Architecture Classifier
      const rawTitle = ((header.fiche_title || header.title || '') + ' ' + (header.prep_title || '')).trim();
      const isSeries = /سلسلة|s[ée]rie|travaux dirig[ée]s|fiche d['’]exercices|تمارين تطبيقية|أعمال موجهة/i.test(rawTitle);
      const isHomework = /فرض|devoir|contr[ôo]le continu|ds\s*n?°?|dm\s*n?°?/i.test(rawTitle);
      const isConcours = /مباراة|concours|fmp|ensam?|apesa/i.test(rawTitle);
      
      const isOfficialNational = !isSeries && !isHomework && !isConcours && Boolean(
        header.doc_type === 'national' ||
        (header.is_national_exam && /^(الامتحان الوطني الموحد|examen national)/i.test((header.fiche_title || '').trim())) ||
        /NS\s*\d+|NR\s*\d+/i.test(rawTitle)
      );

      let finalDocType = header.doc_type || 'course';
      if (isSeries) {
        finalDocType = 'exercises';
      } else if (isHomework) {
        finalDocType = 'homework';
      } else if (isConcours) {
        finalDocType = 'concours';
      } else if (isOfficialNational) {
        finalDocType = 'national';
      } else if (header.doc_type) {
        finalDocType = header.doc_type;
      }

      setDocType(finalDocType);
      setIsNationalExam(isOfficialNational);
      if (isOfficialNational && header.national_exam_meta) {
        setNationalExamMeta(header.national_exam_meta);
      }
      setViewNationalTemplate(isOfficialNational);

      const detectedLvl = header.detected_level || header.level;
      if (detectedLvl) {
        setSelectedLevel(normalizeLevel(detectedLvl));
      }

      let mappedSections = rawSections.map(sec => {
        const rawItemsList = Array.isArray(sec.items) ? sec.items : [];
        let content = typeof sec.content === 'string' ? sec.content : '';

        // Normalize and preserve table items
        const items = rawItemsList.map(it => {
          if (typeof it === 'string') {
            if (it.trim().startsWith('|') && it.trim().endsWith('|') && it.includes('\n')) {
              const parsedTbl = parseMarkdownTable(it);
              if (parsedTbl) {
                return {
                  type: 'table',
                  table_data: { headers: parsedTbl.headers, rows: parsedTbl.rows, alignment: parsedTbl.alignment },
                  headers: parsedTbl.headers,
                  rows: parsedTbl.rows,
                  isVariationTable: parsedTbl.isVariationTable
                };
              }
            }
            return { type: 'text', text: it };
          }
          if (it && typeof it === 'object') {
            if (it.type === 'table' || it.headers || it.table_data || (it.text && it.text.trim().startsWith('|') && it.text.trim().endsWith('|') && it.text.includes('\n'))) {
              const headers = it.table_data?.headers || it.headers || [];
              const rows = it.table_data?.rows || it.rows || [];
              if (headers.length > 0 && rows.length > 0) {
                return {
                  ...it,
                  type: 'table',
                  table_data: { headers, rows, alignment: it.alignment || it.table_data?.alignment || [] },
                  headers,
                  rows
                };
              }
              if (it.text && it.text.trim().startsWith('|')) {
                const parsedTbl = parseMarkdownTable(it.text);
                if (parsedTbl) {
                  return {
                    ...it,
                    type: 'table',
                    table_data: { headers: parsedTbl.headers, rows: parsedTbl.rows, alignment: parsedTbl.alignment },
                    headers: parsedTbl.headers,
                    rows: parsedTbl.rows,
                    isVariationTable: parsedTbl.isVariationTable
                  };
                }
              }
            }
          }
          return it;
        });

        // If items exist but content is missing or very short, build content from items
        if (items.length > 0 && (!content || content.trim().length < 30)) {
          content = items.map(it => typeof it === 'string' ? it : (it.text || '')).filter(Boolean).join('\n');
        }

        // If content exists but items is empty, build items from content lines
        let finalItems = items;
        if (finalItems.length === 0 && content.trim()) {
          const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
          finalItems = lines.map(line => {
            const isBullet = /^(\d+|[a-zA-Z])[.)]|\*\*(\d+|[a-zA-Z])/.test(line);
            return { type: isBullet ? 'bullet' : 'text', text: line };
          });
        }

        const hasAr = /[\u0600-\u06FF]/.test((sec.title || '') + ' ' + content + ' ' + (sec.solution || '') + ' ' + finalItems.map(it => it.text || '').join(' '));
        return {
          ...sec,
          content,
          items: finalItems,
          points: sec.points !== undefined && sec.points !== null ? sec.points : '',
          language: sec.language || (hasAr ? 'ar' : 'fr')
        };
      });

      // Build page snapshots for figure placeholders (lightweight — just for preview thumbnails)
      let activePdfProxy = pdfDocProxy;
      if (!activePdfProxy && uploadFile && (uploadFile.type === 'application/pdf' || uploadFile.name?.endsWith('.pdf'))) {
        try {
          activePdfProxy = await loadPdfDocument(uploadFile);
          setPdfDocProxy(activePdfProxy);
          setPdfTotalPages(activePdfProxy.numPages);
        } catch (pdfErr) {
          console.warn('[FigurePlaceholder] Failed to load PDF proxy:', pdfErr);
        }
      }

      // Count image items that need a placeholder
      const imageItemsCount = mappedSections.reduce((total, sec) =>
        total + (Array.isArray(sec.items) ? sec.items.filter(it => it.type === 'image' && !it.url).length : 0), 0
      );

      if (imageItemsCount > 0 && uploadFile && (uploadFile.type === 'application/pdf' || uploadFile.name?.endsWith('.pdf'))) {
        setProgress(`🖼️ Préparation des aperçus de ${imageItemsCount} figure(s)...`);
        try {
          const snaps = await buildPageSnapshotsMap(uploadFile, Math.min(activePdfProxy?.numPages || 20, 20), 1.2);
          setPageSnapshotsMap(snaps);

          // Auto-resolve figure_bbox → cropped image URLs
          setProgress(`🖼️ Extraction automatique de ${imageItemsCount} figure(s)...`);
          try {
            const resolvedSections = await attachImagesToSections(
              mappedSections,
              activePdfProxy,
              uploadFile,
              snaps,
              cropPdfRegion,
              (msg) => setProgress(msg)
            );
            mappedSections = resolvedSections;
          } catch (resolveErr) {
            console.warn('[AutoResolve] attachImagesToSections failed, images will need manual crop:', resolveErr);
          }
        } catch (snapErr) {
          console.warn('[FigurePlaceholder] Snapshot build failed:', snapErr);
        }
      } else if (imageItemsCount > 0 && uploadFile && uploadFile.type?.startsWith('image/')) {
        // For image files: use the full image as the figure source
        const reader = new FileReader();
        const imageDataUrl = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(uploadFile);
        });
        for (const sec of mappedSections) {
          if (!Array.isArray(sec.items)) continue;
          for (let i = 0; i < sec.items.length; i++) {
            const it = sec.items[i];
            if (it.type === 'image' && !it.url) {
              sec.items[i] = { ...it, url: imageDataUrl, _isSourceImage: true };
            }
          }
        }
      }

      setSections(mappedSections);
      const isAr = /[\u0600-\u06FF]/.test((header.fiche_title || '') + ' ' + (header.subject || ''));
      setDocLanguage(parsed?.metadata?.language || (isAr ? 'ar' : 'fr'));
      
      const numMatch = (header.fiche_title || '').match(/Fiche\s*(\d+)/i);
      if (numMatch) setChapterNumber(numMatch[1]);

      clearInterval(progressInterval);
      setProgressPercent(100);
      setProgress('Analyse terminée !');
      
      setTimeout(() => {
        setPhase(2);
        setLoading(false);
      }, 500);
    } catch (e) {
      clearInterval(progressInterval);
      setProgressPercent(0);
      setLoading(false);
      console.error(e);
      let diagMsg = `Erreur lors de l'extraction : ${e.message}`;
      setError(diagMsg);
    }
  };

  // State modifiers
  const handleAddSection = (type) => {
    const newId = `sec-${Date.now()}`;
    const newSec = type === 'content' 
      ? { id: newId, title: 'Nouvelle Section', type: 'content', section_number: '', section_header: '', accent_text: '', items: [{ type: 'text', text: '' }], language: docLanguage }
      : { id: newId, title: 'Nouvel Exercice', type: 'exercise', section_number: '', section_header: '', content: '', solution: '', interactive_answers: [], language: docLanguage };
    setSections([...sections, newSec]);
  };

  const handleRemoveSection = (index) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  const handleUpdateSection = (index, field, value) => {
    setSections(sections.map((sec, i) => i === index ? { ...sec, [field]: value } : sec));
  };

  const handleAddItemToContentSection = (secIndex) => {
    setSections(sections.map((sec, i) => {
      if (i === secIndex) {
        return {
          ...sec,
          items: [...(sec.items || []), { type: 'text', text: '' }]
        };
      }
      return sec;
    }));
  };

  const handleRemoveItemFromContentSection = (secIndex, itemIndex) => {
    setSections(sections.map((sec, i) => {
      if (i === secIndex) {
        return {
          ...sec,
          items: sec.items.filter((_, idx) => idx !== itemIndex)
        };
      }
      return sec;
    }));
  };

  const handleUpdateContentItem = (secIndex, itemIndex, field, value) => {
    setSections(sections.map((sec, i) => {
      if (i === secIndex) {
        const newItems = sec.items.map((item, idx) => {
          if (idx === itemIndex) {
            return { ...item, [field]: value };
          }
          return item;
        });
        return { ...sec, items: newItems };
      }
      return sec;
    }));
  };

  const handleAddInteractiveAnswer = (secIndex) => {
    setSections(sections.map((sec, i) => {
      if (i === secIndex) {
        const nextIdx = (sec.interactive_answers?.length || 0) + 1;
        return {
          ...sec,
          interactive_answers: [...(sec.interactive_answers || []), { question_idx: nextIdx, label: '', expected_answer: '' }]
        };
      }
      return sec;
    }));
  };

  const handleRemoveInteractiveAnswer = (secIndex, ansIndex) => {
    setSections(sections.map((sec, i) => {
      if (i === secIndex) {
        return {
          ...sec,
          interactive_answers: sec.interactive_answers.filter((_, idx) => idx !== ansIndex)
        };
      }
      return sec;
    }));
  };

  const handleUpdateInteractiveAnswer = (secIndex, ansIndex, field, value) => {
    setSections(sections.map((sec, i) => {
      if (i === secIndex) {
        const newAns = sec.interactive_answers.map((ans, idx) => {
          if (idx === ansIndex) {
            return { ...ans, [field]: value };
          }
          return ans;
        });
        return { ...sec, interactive_answers: newAns };
      }
      return sec;
    }));
  };

  const handleSaveLesson = async () => {
    if (!ficheTitle.trim() || !subject.trim()) {
      setError('Le titre et la matière sont obligatoires.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const effectiveDocType = isNationalExam ? 'national' : docType;
      const lessonData = {
        title: ficheTitle,
        subject,
        chapterNumber,
        teacher,
        phone,
        level: selectedLevel,
        docType: effectiveDocType,
        is_national_exam: isNationalExam,
        national_exam_meta: isNationalExam ? nationalExamMeta : null,
        content: {
          level: selectedLevel,
          doc_type: effectiveDocType,
          is_national_exam: isNationalExam,
          national_exam_meta: isNationalExam ? nationalExamMeta : null,
          metadata: {
            language: docLanguage
          },
          header: {
            prep_title: prepTitle,
            schools: [],
            subject,
            fiche_title: ficheTitle,
            teacher,
            phone,
            is_national_exam: isNationalExam,
            national_exam_meta: isNationalExam ? nationalExamMeta : null
          },
          sections
        },
        isActive: true
      };

      await addLesson(lessonData);
      navigate('/admin/lessons');
    } catch (e) {
      console.error(e);
      setError(`Erreur d'enregistrement : ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleSchool = (sch) => {
    if (selectedSchools.includes(sch)) {
      setSelectedSchools(selectedSchools.filter(s => s !== sch));
    } else {
      setSelectedSchools([...selectedSchools, sch]);
    }
  };

  // Renders the smart image item editor with thumbnail preview and Jump & Crop button
  const renderImageItemEditor = (item, secIdx, itemIdx) => {
    const bbox = item.figure_bbox;
    const figPage = bbox?.page || 1;
    const snapUrl = pageSnapshotsMap[figPage];
    const hasUrl = Boolean(item.url);

    // Compute CSS background-* to zoom into the bbox region as a thumbnail
    const thumbStyle = (snapUrl && bbox) ? (() => {
      const x1 = (bbox.xmin || 0) / 10;       // convert 0-1000 → 0-100%
      const y1 = (bbox.ymin || 0) / 10;
      const x2 = (bbox.xmax || 1000) / 10;
      const y2 = (bbox.ymax || 1000) / 10;
      const w = Math.max(1, x2 - x1);
      const h = Math.max(1, y2 - y1);
      const scaleX = 100 / w;
      const scaleY = 100 / h;
      return {
        backgroundImage: `url(${snapUrl})`,
        backgroundSize: `${scaleX}% ${scaleY}%`,
        backgroundPosition: `${-(x1 / w) * 100}% ${-(y1 / h) * 100}%`,
        backgroundRepeat: 'no-repeat'
      };
    })() : null;

    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem',
        background: hasUrl ? 'rgba(16,185,129,0.04)' : 'rgba(99,102,241,0.04)',
        padding: '0.85rem', borderRadius: '10px',
        border: `1.5px dashed ${hasUrl ? 'rgba(16,185,129,0.4)' : 'rgba(99,102,241,0.35)'}`
      }}>

        {/* Header badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            fontSize: '0.72rem', fontWeight: 800, padding: '0.2rem 0.6rem', borderRadius: '99px',
            background: hasUrl ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)',
            color: hasUrl ? '#10b981' : 'var(--violet)',
            border: `1px solid ${hasUrl ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.25)'}`
          }}>
            {hasUrl
              ? (item._isSourceImage ? '📸 Image source' : '✅ Figure renseignée')
              : `🖼️ Figure détectée — Page ${figPage}${bbox ? ` (${bbox.xmin},${bbox.ymin}→${bbox.xmax},${bbox.ymax})` : ''}`}
          </span>
          {!hasUrl && (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Recadrez ou uploadez l'image ci-dessous
            </span>
          )}
        </div>

        {/* Thumbnail + actions OR preview */}
        {!hasUrl ? (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'stretch' }}>

            {/* Thumbnail: shows zoomed-in bbox region from page snapshot */}
            <div
              onClick={() => handleJumpAndCrop(secIdx, itemIdx, figPage)}
              title={`Cliquez pour ouvrir le recadreur sur la page ${figPage}`}
              style={{
                width: '100px', minWidth: '100px', height: '90px',
                borderRadius: '8px', overflow: 'hidden',
                border: '1px solid rgba(99,102,241,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, cursor: 'pointer', position: 'relative',
                background: (snapUrl && thumbStyle) ? undefined : 'rgba(99,102,241,0.08)',
                ...(snapUrl && thumbStyle ? thumbStyle : {})
              }}
            >
              {(!snapUrl || !thumbStyle) && (
                <div style={{ textAlign: 'center', padding: '0.5rem' }}>
                  <ImageIcon size={22} style={{ color: 'var(--violet)', opacity: 0.6 }} />
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Page {figPage}</div>
                </div>
              )}
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '8px',
                background: 'rgba(99,102,241,0.28)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: 0, transition: 'opacity 0.18s'
              }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0'}
              >
                <Crop size={20} color="#fff" />
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => handleJumpAndCrop(secIdx, itemIdx, figPage)}
                className="btn"
                style={{
                  width: '100%', padding: '0.55rem 0.75rem', fontSize: '0.8rem', fontWeight: 800,
                  background: 'linear-gradient(135deg, var(--violet), #8b5cf6)',
                  justifyContent: 'center', gap: '0.4rem'
                }}
              >
                <Crop size={14} />
                ✂️ Recadrer depuis PDF (Page {figPage})
              </button>

              <label style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                width: '100%', padding: '0.45rem 0.75rem', fontSize: '0.78rem', fontWeight: 700,
                cursor: 'pointer', borderRadius: '8px', border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.04)', color: 'var(--text-main)', transition: 'background 0.15s'
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
              >
                <ImageIcon size={14} />
                📁 Uploader une image
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = ev => handleUpdateContentItem(secIdx, itemIdx, 'url', ev.target.result);
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
            </div>
          </div>
        ) : (
          /* Image already set: preview + re-crop button */
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)', background: '#fff', flexShrink: 0 }}>
              <img src={item.url} alt={item.alt || 'Figure'}
                style={{ display: 'block', maxWidth: '120px', maxHeight: '100px', objectFit: 'contain' }} />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <button type="button" onClick={() => handleJumpAndCrop(secIdx, itemIdx, figPage)}
                className="btn-outline"
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--violet)' }}>
                <Crop size={12} /> إعادة قص من PDF
              </button>
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                fontSize: '0.75rem', padding: '0.3rem 0.6rem', cursor: 'pointer',
                borderRadius: '8px', border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text-muted)'
              }}>
                <ImageIcon size={12} /> استبدال بصورة أخرى
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = ev => handleUpdateContentItem(secIdx, itemIdx, 'url', ev.target.result);
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
            </div>
          </div>
        )}

        {/* Legend + size/align controls */}
        <input type="text" className="input-control"
          placeholder="عنوان الشكل / Légende (ex: Figure 1 — Courbes de f et g)"
          value={item.alt || ''}
          onChange={e => handleUpdateContentItem(secIdx, itemIdx, 'alt', e.target.value)}
          style={{ padding: '0.35rem', fontSize: '0.8rem' }}
        />
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>📐 الحجم:</label>
            <select className="input-control" value={item.width_pct || 80}
              onChange={e => handleUpdateContentItem(secIdx, itemIdx, 'width_pct', parseInt(e.target.value))}
              style={{ padding: '0.2rem 0.4rem', fontSize: '0.78rem' }}>
              <option value={100}>100%</option>
              <option value={80}>80%</option>
              <option value={60}>60%</option>
              <option value={50}>50%</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>📍 المحاذاة:</label>
            <select className="input-control" value={item.align || 'center'}
              onChange={e => handleUpdateContentItem(secIdx, itemIdx, 'align', e.target.value)}
              style={{ padding: '0.2rem 0.4rem', fontSize: '0.78rem' }}>
              <option value="center">الوسط</option>
              <option value="right">اليمين</option>
              <option value="left">اليسار</option>
            </select>
          </div>
        </div>
      </div>
    );
  };

  const isArMode = /[\u0600-\u06FF]/.test(ficheTitle + ' ' + subject + ' ' + (sections || []).map(s => s.title + ' ' + (s.content || '')).join(' '));

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '3rem' }}>
      {isArMode && (
        <style>{`
          @font-face {
            font-family: 'UKIJMerdaneRegular';
            src: url('/fonts/UKIJMerdaneRegular.ttf') format('truetype');
          }
          .input-control, textarea, select {
            font-family: 'UKIJMerdaneRegular', 'Cairo', 'Amiri', Arial, sans-serif !important;
            direction: rtl !important;
            text-align: right !important;
          }
          select.input-control {
            background-position: left 0.75rem center !important;
            padding-left: 2.25rem !important;
            padding-right: 1rem !important;
          }
          label, h2, h3, h4 {
            font-family: 'UKIJMerdaneRegular', 'Cairo', 'Amiri', Arial, sans-serif !important;
            direction: rtl !important;
            text-align: right !important;
          }
        `}</style>
      )}
      
      {/* ── Header ── */}
      <header style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button onClick={onBack || (() => navigate('/admin/lessons'))} className="btn-outline" style={{ padding: '0.5rem 0.75rem' }}>
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={24} className="text-violet" />
            Générateur de Fiches de Cours IA
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Importez des résumés de cours au format PDF ou Image et laissez l'IA créer des fiches interactives LaTeX.
          </p>
        </div>
      </header>

      {error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1.25rem', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: '1.5rem', color: 'var(--danger)', fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span style={{ fontWeight: 600 }}>{error}</span>
          </div>
          
          {detectedModels.length > 0 && (
            <div style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(239,68,68,0.15)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span>💡</span> Modèles disponibles (Cliquez pour sélectionner) :
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                {detectedModels.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setGeminiModel(m);
                      localStorage.setItem('geminiModel', m);
                    }}
                    style={{
                      padding: '0.25rem 0.6rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: geminiModel === m ? '1px solid var(--violet)' : '1px solid rgba(255,255,255,0.1)',
                      background: geminiModel === m ? 'var(--violet-soft)' : 'rgba(255,255,255,0.03)',
                      color: geminiModel === m ? 'var(--violet)' : 'var(--text-muted)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      if (geminiModel !== m) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                        e.currentTarget.style.color = 'var(--text-main)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (geminiModel !== m) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                        e.currentTarget.style.color = 'var(--text-muted)';
                      }
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PHASE 1: Upload and Parse ── */}
      {phase === 1 && (
        <div className="glass-panel" style={{ padding: '3rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '1.5rem', marginBottom: '0.5rem' }}>
            <div className="input-group" style={{ flex: 1 }}>
              <label>Moteur d'intelligence artificielle</label>
              <select
                className="input-control"
                value={provider}
                onChange={e => {
                  const val = e.target.value;
                  setProvider(val);
                  localStorage.setItem('aiImportProvider', val);
                }}
              >
                <option value="gemini">Google Gemini (Sécurisé & Rapide)</option>
                <option value="claude">Anthropic Claude (Modèle d'Examen)</option>
                <option value="deepseek">DeepSeek AI (Super Économique)</option>
              </select>
            </div>

            <div className="input-group" style={{ flex: 1 }}>
              <label>Modèle de traitement IA</label>
              {provider === 'claude' ? (
                <select
                  className="input-control"
                  value={claudeModel}
                  onChange={e => { setClaudeModel(e.target.value); localStorage.setItem('claudeModel', e.target.value); }}
                >
                  <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Recommandé)</option>
                  <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (Rapide)</option>
                  <option value="claude-3-opus-20240229">Claude 3 Opus (Haute précision)</option>
                </select>
              ) : provider === 'deepseek' ? (
                <select
                  className="input-control"
                  value={deepseekModel}
                  onChange={e => { setDeepseekModel(e.target.value); localStorage.setItem('deepseekModel', e.target.value); }}
                >
                  <option value="deepseek-v4-pro">deepseek-v4-pro (R1 - Réflexion / Raisonnement)</option>
                  <option value="deepseek-v4-flash">deepseek-v4-flash (Flash - Rapide & Économique)</option>
                </select>
              ) : (
                <select
                  className="input-control"
                  value={geminiModel}
                  onChange={e => { setGeminiModel(e.target.value); localStorage.setItem('geminiModel', e.target.value); }}
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommandé - Ultra Rapide)</option>
                  <option value="gemini-2.5-flash-thinking">Gemini 2.5 Flash Thinking (Résolution & LaTeX Avancés)</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (Haute précision)</option>
                  <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                  <option value="gemini-3.1-pro">Gemini 3.1 Pro</option>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash (Legacy)</option>
                </select>
              )}
            </div>
          </div>

          {/* Quick API Key configurator */}
          {provider === 'claude' && !claudeKey && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '1rem', borderRadius: 10, background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)', fontSize: '0.8rem' }}>
              <span style={{ fontWeight: 700, color: '#7c3aed' }}>⚠️ Clé API Claude manquante</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="password"
                  placeholder="Collez votre clé API Anthropic (sk-ant-...)"
                  className="input-control"
                  value={claudeKey}
                  onChange={e => { setClaudeKey(e.target.value); localStorage.setItem('claudeApiKey', e.target.value); }}
                  style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                />
              </div>
            </div>
          )}
          {provider === 'deepseek' && !deepseekKey && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '1rem', borderRadius: 10, background: 'rgba(0,186,124,0.06)', border: '1px solid rgba(0,186,124,0.15)', fontSize: '0.8rem' }}>
              <span style={{ fontWeight: 700, color: '#00BA7C' }}>⚠️ Clé API DeepSeek manquante</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="password"
                  placeholder="Collez votre clé API DeepSeek (sk-...)"
                  className="input-control"
                  value={deepseekKey}
                  onChange={e => { setDeepseekKey(e.target.value); localStorage.setItem('deepseekApiKey', e.target.value); }}
                  style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                />
              </div>
            </div>
          )}
          {provider === 'gemini' && !geminiKey && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '1rem', borderRadius: 10, background: 'rgba(66,133,244,0.06)', border: '1px solid rgba(66,133,244,0.15)', fontSize: '0.8rem' }}>
              <span style={{ fontWeight: 700, color: '#4285F4' }}>⚠️ Clé API Gemini manquante</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="password"
                  placeholder="Collez votre clé API Google Gemini (AIzaSy...)"
                  className="input-control"
                  value={geminiKey}
                  onChange={e => { setGeminiKey(e.target.value); localStorage.setItem('geminiApiKey', e.target.value); }}
                  style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                />
              </div>
            </div>
          )}

          <div className="input-group">
            <label>Sélectionnez la fiche de cours (PDF ou Image)</label>
            <label className="upload-zone" style={{ minHeight: '220px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <input 
                type="file" 
                ref={fileInputRef} 
                accept="application/pdf, image/*" 
                onChange={handleFileSelect} 
                style={{ display: 'none' }} 
              />
              {!uploadFile ? (
                <>
                  <UploadCloud size={48} className="text-violet" style={{ marginBottom: '1rem' }} />
                  <p style={{ fontWeight: 800, fontSize: '1rem', margin: '0 0 0.25rem 0' }}>Glissez-déposez un fichier ici</p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fichiers supportés : .pdf, .png, .jpg, .jpeg</span>
                </>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <CheckCircle2 size={40} className="text-emerald" style={{ margin: '0 auto 0.75rem' }} />
                  <p style={{ fontWeight: 800, margin: '0 0 0.25rem 0' }}>{fileName}</p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Type : {uploadFile.type} ({(uploadFile.size / (1024 * 1024)).toFixed(2)} Mo)
                  </span>
                  <div style={{ marginTop: '1rem', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.8rem' }} onClick={(e) => { e.preventDefault(); setUploadFile(null); }}>
                    Changer de fichier
                  </div>
                </div>
              )}
            </label>
          </div>

          <button 
            onClick={handleAnalyze} 
            className="btn" 
            disabled={loading || !uploadFile}
            style={{ width: '100%', padding: '1.25rem', fontSize: '1.1rem', justifyContent: 'center' }}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} style={{ marginRight: '0.5rem' }} />
                Traitement en cours...
              </>
            ) : (
              <>
                <Sparkles size={20} style={{ marginRight: '0.5rem' }} />
                Analyser et extraire le contenu
              </>
            )}
          </button>

          {loading && (
            <div className="animate-fade-in" style={{ marginTop: '1.5rem', width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{progress}</span>
                <span style={{ color: 'var(--violet)', fontWeight: 800 }}>{progressPercent}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '99px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <div style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--violet), var(--emerald))',
                  borderRadius: '99px',
                  transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 0 10px rgba(113, 109, 242, 0.5)'
                }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PHASE 2: Edit & Review ── */}
      {phase === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

          {/* National Exam Banner & Actions */}
          {isNationalExam && (
            <div className="glass-panel" style={{
              padding: '1.25rem 1.75rem',
              borderRadius: '16px',
              border: '1px solid rgba(234, 179, 8, 0.4)',
              background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.12) 0%, rgba(245, 158, 11, 0.04) 100%)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.75rem' }}>🏆</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    تم اكتشاف امتحان وطني موحد للبكالوريا (Examen National)
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    تم تفريغ المستند في معمارية الامتحان الوطني الرسمي (تنسيق الصفحات + الجدول التأطييري + QR Code لكل سؤال)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Split View & Toolbar Controls */}
          <div className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button onClick={() => setPhase(1)} className="btn-outline" style={{ fontSize: '0.85rem' }}>
                <ArrowLeft size={16} /> Retour au fichier
              </button>
              <button
                type="button"
                onClick={() => handleOpenCropperModal(0)}
                className="btn-outline"
                style={{ fontSize: '0.85rem', color: 'var(--emerald)', borderColor: 'rgba(16,185,129,0.35)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                title="قص وتحديد الأشكال والمنحنيات من الـ PDF"
              >
                <Crop size={15} /> ✂️ أداة قص الأشكال (PDF)
              </button>
              {pdfDocProxy && (
                <button
                  onClick={() => setIsSplitView(!isSplitView)}
                  className={isSplitView ? 'btn' : 'btn-outline'}
                  style={{ fontSize: '0.85rem', background: isSplitView ? 'var(--violet)' : undefined }}
                >
                  <Columns size={16} /> {isSplitView ? 'الشاشة المزدوجة (مفعّلة)' : 'تفعيل الشاشة المزدوجة (Split-View)'}
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-outline"
                onClick={() => setViewNationalTemplate(!viewNationalTemplate)}
                style={{
                  background: viewNationalTemplate ? 'var(--violet)' : 'rgba(255,255,255,0.05)',
                  color: viewNationalTemplate ? '#fff' : 'inherit',
                  fontWeight: 700,
                  fontSize: '0.85rem'
                }}
              >
                {viewNationalTemplate ? '✏️ التعديل والتنقيح' : '👁️ المعمارية الرسمية للامتحان الوطني'}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => openNationalExamPrintWindow({
                  header: { fiche_title: ficheTitle, subject, level: selectedLevel, is_national_exam: isNationalExam, national_exam_meta: nationalExamMeta },
                  sections: sections.map(s => ({ title: s.title, points: s.points, content: s.content, items: s.items || s.questions || [] }))
                })}
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}
              >
                🖨️ طباعة / تصدير التنسيق الرسمي (PDF)
              </button>
            </div>
          </div>

          {/* National Exam Template View Mode */}
          {isNationalExam && viewNationalTemplate ? (
            <div className="glass-panel" style={{ padding: '2rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
              <NationalExamTemplate
                examData={{
                  header: { fiche_title: ficheTitle, subject, level: selectedLevel, is_national_exam: isNationalExam, national_exam_meta: nationalExamMeta },
                  sections: sections.map(s => ({ title: s.title, points: s.points, content: s.content, items: s.items || s.questions || [] }))
                }}
              />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: (isSplitView && pdfDocProxy && !isMobile) ? '460px 1fr' : '1fr', gap: '1.5rem', alignItems: 'start' }}>
              
              {/* Left Pane: Interactive High-DPI PDF Viewer & Cropper */}
              {isSplitView && pdfDocProxy && (
                <div className="glass-panel" style={{ padding: '1.25rem', position: 'sticky', top: '1rem', maxHeight: 'calc(100vh - 2rem)', display: 'flex', flexDirection: 'column', gap: '0.75rem', zIndex: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--violet)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      📄 مستند المصدر (PDF)
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <button
                        className="btn-outline"
                        style={{ padding: '0.2rem 0.4rem' }}
                        disabled={pdfPageNum <= 1}
                        onClick={() => setPdfPageNum(p => Math.max(1, p - 1))}
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                        {pdfPageNum} / {pdfTotalPages}
                      </span>
                      <button
                        className="btn-outline"
                        style={{ padding: '0.2rem 0.4rem' }}
                        disabled={pdfPageNum >= pdfTotalPages}
                        onClick={() => setPdfPageNum(p => Math.min(pdfTotalPages, p + 1))}
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Cropper controls bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      onClick={() => {
                        setIsCropping(!isCropping);
                        setCropBox(null);
                      }}
                      className={isCropping ? 'btn' : 'btn-outline'}
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', flex: 1, background: isCropping ? 'var(--emerald)' : undefined }}
                    >
                      <Crop size={14} /> {isCropping ? 'إلغاء وضع القص' : '✂️ تفعيل أداة قص الأشكال'}
                    </button>

                    <div style={{ display: 'flex', gap: '0.2rem' }}>
                      <button className="btn-outline" style={{ padding: '0.2rem 0.4rem' }} onClick={() => setPdfScale(s => Math.min(2.5, s + 0.2))}>
                        <ZoomIn size={14} />
                      </button>
                      <button className="btn-outline" style={{ padding: '0.2rem 0.4rem' }} onClick={() => setPdfScale(s => Math.max(0.8, s - 0.2))}>
                        <ZoomOut size={14} />
                      </button>
                    </div>
                  </div>

                  {/* PDF Canvas Container */}
                  <div
                    ref={pdfContainerRef}
                    style={{
                      flex: 1,
                      overflow: 'auto',
                      border: isCropping ? '2px dashed #10b981' : '1px solid var(--border)',
                      borderRadius: '8px',
                      position: 'relative',
                      background: '#33373b',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'flex-start',
                      minHeight: '380px',
                      cursor: isCropping ? 'crosshair' : 'default',
                      userSelect: 'none'
                    }}
                    onMouseDown={(e) => {
                      if (!isCropping) return;
                      const canvas = pdfCanvasRef.current;
                      if (!canvas) return;
                      const rect = canvas.getBoundingClientRect();
                      const scaleX = canvas.width / rect.width;
                      const scaleY = canvas.height / rect.height;
                      const x = (e.clientX - rect.left) * scaleX;
                      const y = (e.clientY - rect.top) * scaleY;
                      setIsDraggingCrop(true);
                      setDragStart({ x, y });
                      setCropBox({ x, y, width: 0, height: 0 });
                    }}
                    onMouseMove={(e) => {
                      if (!isCropping || !isDraggingCrop) return;
                      const canvas = pdfCanvasRef.current;
                      if (!canvas) return;
                      const rect = canvas.getBoundingClientRect();
                      const scaleX = canvas.width / rect.width;
                      const scaleY = canvas.height / rect.height;
                      const curX = (e.clientX - rect.left) * scaleX;
                      const curY = (e.clientY - rect.top) * scaleY;
                      const x = Math.min(dragStart.x, curX);
                      const y = Math.min(dragStart.y, curY);
                      const width = Math.abs(curX - dragStart.x);
                      const height = Math.abs(curY - dragStart.y);
                      setCropBox({ x, y, width, height });
                    }}
                    onMouseUp={() => {
                      if (isDraggingCrop) setIsDraggingCrop(false);
                    }}
                  >
                    <canvas ref={pdfCanvasRef} style={{ maxWidth: '100%', height: 'auto', display: 'block' }} />

                    {/* Render Crop Overlay Box */}
                    {isCropping && cropBox && cropBox.width > 5 && cropBox.height > 5 && pdfCanvasRef.current && (
                      <div
                        style={{
                          position: 'absolute',
                          left: `${(cropBox.x / pdfCanvasRef.current.width) * 100}%`,
                          top: `${(cropBox.y / pdfCanvasRef.current.height) * 100}%`,
                          width: `${(cropBox.width / pdfCanvasRef.current.width) * 100}%`,
                          height: `${(cropBox.height / pdfCanvasRef.current.height) * 100}%`,
                          border: '2px solid #10b981',
                          background: 'rgba(16, 185, 129, 0.25)',
                          boxShadow: '0 0 12px rgba(16, 185, 129, 0.6)',
                          pointerEvents: 'none'
                        }}
                      />
                    )}
                  </div>

                  {/* Confirm crop action box */}
                  {isCropping && cropBox && cropBox.width > 20 && cropBox.height > 20 && (
                    <div style={{ background: 'rgba(0,0,0,0.85)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--emerald)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                        <span style={{ color: 'var(--emerald)', fontWeight: 800 }}>✂️ تم تحديد المنطقة</span>
                        <select
                          className="input-control"
                          style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                          value={cropTargetSectionIdx !== null ? cropTargetSectionIdx : 0}
                          onChange={e => setCropTargetSectionIdx(parseInt(e.target.value))}
                        >
                          {sections.map((s, idx) => (
                            <option key={idx} value={idx}>
                              إرفاق بـ : {s.title || `قسم ${idx + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={handleConfirmCrop} className="btn" style={{ flex: 1, padding: '0.35rem', fontSize: '0.8rem', background: 'var(--emerald)' }}>
                          <CheckCircle size={14} /> تأكيد وقص الشكل
                        </button>
                        <button onClick={() => setCropBox(null)} className="btn-outline" style={{ padding: '0.35rem', fontSize: '0.8rem' }}>
                          إلغاء
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Right Pane: Lesson & Exercises Structure Editor */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Section 1: Header metadata */}
                <div className="glass-panel" style={{ padding: '2rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)' }}>
                  <h2 style={{ 
                    fontSize: '1.2rem', 
                    fontWeight: 800, 
                    marginBottom: '1.5rem', 
                    borderBottom: '1px solid var(--border)', 
                    paddingBottom: '0.6rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    color: 'var(--text-main)'
                  }}>
                    <span>📁</span>
                    <span>Informations Générales du Document</span>
                  </h2>

                  <div className="dashboard-grid">
                    <div className="col-span-5 input-group">
                      <label style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Titre de la Fiche</label>
                      <input 
                        type="text" 
                        className="input-control" 
                        value={ficheTitle}
                        onChange={e => setFicheTitle(e.target.value)}
                        placeholder="Fiche 01 : Arithmétique"
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div className="col-span-3 input-group">
                      <label style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Type de Document</label>
                      <select className="input-control" value={docType} onChange={e => {
                        const val = e.target.value;
                        setDocType(val);
                        if (val === 'national') {
                          setIsNationalExam(true);
                          setViewNationalTemplate(true);
                        }
                      }} style={{ width: '100%' }}>
                        <option value="course">درس (Cours)</option>
                        <option value="homework">فرض محروس (Devoir Surveillé)</option>
                        <option value="national">امتحان وطني (Examen National)</option>
                        <option value="exercises">سلسلة تمارين (Série d'exercices)</option>
                        <option value="concours">مباراة (Concours)</option>
                      </select>
                    </div>

                    <div className="col-span-2 input-group">
                      <label style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Matière</label>
                      <select className="input-control" value={subject} onChange={e => setSubject(e.target.value)} style={{ width: '100%' }}>
                        <option value="Algèbre">Algèbre</option>
                        <option value="Analyse">Analyse</option>
                        <option value="Géométrie">Géométrie</option>
                        <option value="Probabilités">Probabilités</option>
                        <option value="Physique">Physique</option>
                        <option value="Chimie">Chimie</option>
                        <option value="SVT">SVT</option>
                      </select>
                    </div>

                    <div className="col-span-2 input-group">
                      <label style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Numéro</label>
                      <input 
                        type="text" 
                        className="input-control" 
                        value={chapterNumber}
                        onChange={e => setChapterNumber(e.target.value)}
                        placeholder="01"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  <div className="dashboard-grid" style={{ marginTop: '1.25rem' }}>
                    <div className="col-span-3 input-group">
                      <label style={{ color: 'var(--text-muted)', fontWeight: 600 }}>En-tête de préparation</label>
                      <input 
                        type="text" 
                        className="input-control" 
                        value={prepTitle}
                        onChange={e => setPrepTitle(e.target.value)}
                        placeholder="Préparation aux concours"
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div className="col-span-3 input-group">
                      <label style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Niveau Scolaire</label>
                      <select 
                        className="input-control" 
                        value={selectedLevel} 
                        onChange={e => setSelectedLevel(e.target.value)}
                        style={{ width: '100%' }}
                      >
                        <option value="common_core_sci">Tronc Commun Scientifique</option>
                        <option value="common_core_arts">Tronc Commun Littéraire</option>
                        <option value="1bac_sci">1ère Bac Sciences</option>
                        <option value="1bac_arts">1ère Bac Lettres</option>
                        <option value="2bac_sm">2ème Bac Sciences Maths</option>
                        <option value="2bac_pc_svt">2ème Bac PC/SVT</option>
                        <option value="2bac_arts">2ème Bac Lettres</option>
                      </select>
                    </div>

                    <div className="col-span-2 input-group">
                      <label style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Enseignant</label>
                      <input 
                        type="text" 
                        className="input-control" 
                        value={teacher}
                        onChange={e => setTeacher(e.target.value)}
                        placeholder="Prof : FAYSSAL"
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div className="col-span-2 input-group">
                      <label style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Téléphone</label>
                      <input 
                        type="text" 
                        className="input-control" 
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="0681399067"
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div className="col-span-2 input-group">
                      <label style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Langue du document</label>
                      <select 
                        className="input-control" 
                        value={docLanguage} 
                        onChange={e => setDocLanguage(e.target.value)}
                        style={{ width: '100%' }}
                      >
                        <option value="fr">Français</option>
                        <option value="ar">Arabe</option>
                        <option value="en">Anglais</option>
                      </select>
                    </div>

                    {/* Document Architecture Selector */}
                    <div className="col-span-6 input-group" style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                      <label style={{ color: 'var(--violet)', fontWeight: 800, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                        <span>🏛️ المعمارية ونوع الوثيقة (Architecture & Type de Document) :</span>
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
                        {[
                          { id: 'exercises', label: "📝 سلسلة تمارين (Série d'exercices)", desc: 'تمارين وأسئلة فرعية متسلسلة' },
                          { id: 'national', label: '🏆 امتحان وطني رسمي (Examen National)', desc: 'الورقة الرسمية للامتحان الوطني' },
                          { id: 'homework', label: '📋 فرض محروس / منزلي (Devoir)', desc: 'سلم التنقيط على 20' },
                          { id: 'course', label: '📖 درس / ملخص (Fiche de Cours)', desc: 'فقرات نظرية وتعاريف' },
                          { id: 'concours', label: '🎯 مباراة ولوج (Concours)', desc: 'مباريات الطب والهندسة' },
                        ].map(t => {
                          const isSelected = isNationalExam ? t.id === 'national' : docType === t.id;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                if (t.id === 'national') {
                                  setIsNationalExam(true);
                                  setDocType('national');
                                  setViewNationalTemplate(true);
                                } else {
                                  setIsNationalExam(false);
                                  setDocType(t.id);
                                  setViewNationalTemplate(false);
                                }
                              }}
                              style={{
                                padding: '0.6rem 0.8rem',
                                borderRadius: '8px',
                                textAlign: 'left',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                border: isSelected ? '2px solid var(--violet)' : '1px solid var(--border)',
                                background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.03)',
                                color: isSelected ? 'var(--text-main)' : 'var(--text-muted)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.2rem'
                              }}
                            >
                              <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>{t.label}</span>
                              <span style={{ fontSize: '0.7rem', opacity: 0.75 }}>{t.desc}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Course Contents */}
                <div className="glass-panel" style={{ padding: '2rem' }}>
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                      📝 Sections du Cours / Exercices
                    </h2>
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '0.5rem' }}>
                      <button onClick={() => handleAddSection('content')} className="btn-outline" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', justifyContent: 'center' }}>
                        <Plus size={14} /> + Section Théorique
                      </button>
                      <button onClick={() => handleAddSection('exercise')} className="btn-outline" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', justifyContent: 'center' }}>
                        <Plus size={14} /> + Exercice
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {sections.map((sec, secIdx) => (
                      <div 
                        key={sec.id} 
                        className={docLanguage === 'ar' ? 'rtl-section' : 'ltr-section'}
                        style={{
                          border: '1px solid var(--border)',
                          borderRadius: '12px',
                          padding: '1.5rem',
                          background: 'rgba(255,255,255,0.02)',
                          position: 'relative'
                        }}
                      >
                        {/* Delete Button & Quick Crop Header */}
                        <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenCropperModal(secIdx)}
                            className="btn-outline"
                            style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', color: 'var(--emerald)', borderColor: 'rgba(16,185,129,0.3)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                            title="قص شكل هندسي من الـ PDF وربطه بهذا القسم"
                          >
                            <Crop size={13} /> ✂️ قص شكل من الـ PDF
                          </button>
                          <button 
                            onClick={() => handleRemoveSection(secIdx)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)',
                              border: 'none', borderRadius: '8px', padding: '0.4rem', cursor: 'pointer'
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        {/* Section Title & Score Balance Badge */}
                        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '1rem', width: '100%', marginBottom: '1.25rem', alignItems: 'flex-start', paddingRight: '150px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>Titre du Bloc</label>
                              {sec.type === 'exercise' && (() => {
                                const scoreBalance = validateExercisePoints(sec);
                                return (
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: 99,
                                    fontSize: '0.7rem',
                                    fontWeight: 800,
                                    background: scoreBalance.isBalanced ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                                    color: scoreBalance.isBalanced ? '#10b981' : '#f59e0b',
                                    border: `1px solid ${scoreBalance.isBalanced ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                                  }}>
                                    {scoreBalance.isBalanced ? (
                                      <><CheckCircle size={12} /> {scoreBalance.declaredPoints || scoreBalance.calculatedSum} ن متوازنة</>
                                    ) : (
                                      <><AlertTriangle size={12} /> مجموع الأسئلة: {scoreBalance.calculatedSum} ن / المصرّح به: {scoreBalance.declaredPoints} ن</>
                                    )}
                                  </span>
                                );
                              })()}
                            </div>
                              <input 
                                type="text" 
                                className="input-control" 
                                value={sec.title || ''} 
                                onChange={e => handleUpdateSection(secIdx, 'title', e.target.value)}
                                style={{ fontWeight: 800, fontSize: '1rem', width: '100%' }}
                              />
                            </div>
                            <div style={{ width: isMobile ? '100%' : '150px' }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>Type</label>
                              <select 
                                className="input-control"
                                value={sec.type}
                                onChange={e => handleUpdateSection(secIdx, 'type', e.target.value)}
                                style={{ width: '100%', fontWeight: 700 }}
                              >
                                <option value="content">Théorie (Général)</option>
                                <option value="definition">Définition</option>
                                <option value="property">Propriété</option>
                                <option value="theorem">Théorème</option>
                                <option value="corollary">Corollaire</option>
                                <option value="example">Exemple</option>
                                <option value="remark">Remarque</option>
                                <option value="activity">Activité / Application</option>
                                <option value="exercise">Exercice / Corrigé</option>
                              </select>
                            </div>
                          </div>

                          {/* Section Metadata Grid */}
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '80px 100px 1.5fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                            <div>
                              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>N° Section</label>
                              <input 
                                type="text" 
                                className="input-control" 
                                value={sec.section_number || ''} 
                                onChange={e => handleUpdateSection(secIdx, 'section_number', e.target.value)}
                                placeholder="Ex: 1"
                                style={{ padding: '0.35rem', fontSize: '0.85rem' }}
                              />
                            </div>

                            <div>
                              <label style={{ fontSize: '0.75rem', color: 'var(--amber)', fontWeight: 800 }}>⭐ Points</label>
                              <input 
                                type="text" 
                                className="input-control" 
                                value={sec.points !== undefined && sec.points !== null ? sec.points : ''} 
                                onChange={e => handleUpdateSection(secIdx, 'points', e.target.value)}
                                placeholder="Ex: 3.5"
                                style={{ padding: '0.35rem', fontSize: '0.85rem', borderColor: 'var(--amber)', fontWeight: 800 }}
                              />
                            </div>

                            <div>
                              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>En-tête de Section Pill (ex: Résumé : Suites Numériques)</label>
                              <input 
                                type="text" 
                                className="input-control" 
                                value={sec.section_header || ''} 
                                onChange={e => handleUpdateSection(secIdx, 'section_header', e.target.value)}
                                placeholder="Laisse vide pour continuer la section précédente"
                                style={{ padding: '0.35rem', fontSize: '0.85rem' }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sous-titre Accent Vert (ex: Définitions-Notations-Vocabulaire)</label>
                              <input 
                                type="text" 
                                className="input-control" 
                                value={sec.accent_text || ''} 
                                onChange={e => handleUpdateSection(secIdx, 'accent_text', e.target.value)}
                                placeholder="Optionnel"
                                style={{ padding: '0.35rem', fontSize: '0.85rem' }}
                              />
                            </div>
                          </div>

                          {/* Type 1: Content Block Editor */}
                          {sec.type !== 'exercise' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--violet)' }}>Éléments de texte</span>
                                <button onClick={() => handleAddItemToContentSection(secIdx)} className="btn-outline" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>
                                  <Plus size={12} /> Ajouter un point
                                </button>
                              </div>

                              {sec.items?.map((item, itemIdx) => (
                                <div key={itemIdx} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '0.75rem', alignItems: isMobile ? 'stretch' : 'flex-start', width: '100%' }}>
                                  <select
                                    className="input-control"
                                    value={item.type}
                                    onChange={e => handleUpdateContentItem(secIdx, itemIdx, 'type', e.target.value)}
                                    style={{ width: isMobile ? '100%' : '150px', flexShrink: 0, padding: '0.4rem' }}
                                  >
                                    <option value="text">Texte Standard</option>
                                    <option value="bullet">Puce (Bullet)</option>
                                    <option value="highlight_box">Formule (Encadré)</option>
                                    <option value="notation_grid">Grille de Notations</option>
                                    <option value="table">Tableau Comparatif</option>
                                    <option value="image">🖼️ Figure / Image (شكل/مبيان)</option>
                                  </select>

                                  {item.type === 'notation_grid' ? (
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255,255,255,0.01)', padding: '0.75rem', borderRadius: '8px', border: '1px dashed var(--border)' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <strong style={{ fontSize: '0.8rem' }}>Colonnes de Notations :</strong>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const cols = item.notation_columns || [];
                                            handleUpdateContentItem(secIdx, itemIdx, 'notation_columns', [...cols, { title: '', math_blocks: [''] }]);
                                          }}
                                          className="btn-outline"
                                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                                        >
                                          + Ajouter Colonne
                                        </button>
                                      </div>
                                      {item.notation_columns?.map((col, colIdx) => (
                                        <div key={colIdx} style={{ border: '1px solid var(--border)', padding: '0.5rem', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <input
                                              type="text"
                                              className="input-control"
                                              placeholder="Titre de colonne (ex: • Notation fonctionnelle)"
                                              value={col.title || ''}
                                              onChange={e => {
                                                const newCols = item.notation_columns.map((c, ci) => ci === colIdx ? { ...c, title: e.target.value } : c);
                                                handleUpdateContentItem(secIdx, itemIdx, 'notation_columns', newCols);
                                              }}
                                              style={{ flex: 1, padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                            />
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const newCols = item.notation_columns.filter((_, ci) => ci !== colIdx);
                                                handleUpdateContentItem(secIdx, itemIdx, 'notation_columns', newCols);
                                              }}
                                              style={{ background: 'transparent', color: 'var(--danger)', border: 'none', cursor: 'pointer' }}
                                            >
                                              <Trash2 size={14} />
                                            </button>
                                          </div>
                                          <textarea
                                            className="input-control"
                                            placeholder="Blocs mathématiques (un par ligne, ex: u : E \\rightarrow \\mathbb{R})"
                                            value={col.math_blocks?.join('\n') || ''}
                                            onChange={e => {
                                              const lines = e.target.value.split('\n');
                                              const newCols = item.notation_columns.map((c, ci) => ci === colIdx ? { ...c, math_blocks: lines } : c);
                                              handleUpdateContentItem(secIdx, itemIdx, 'notation_columns', newCols);
                                            }}
                                            rows={2}
                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  ) : item.type === 'table' ? (
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255,255,255,0.01)', padding: '0.75rem', borderRadius: '8px', border: '1px dashed var(--border)' }}>
                                      <div>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>En-têtes du Tableau (séparés par | )</label>
                                        <input
                                          type="text"
                                          className="input-control"
                                          placeholder="ex: Concept | une suite arithmétique | une suite géométrique"
                                          value={item.table_data?.headers?.join(' | ') || ''}
                                          onChange={e => {
                                            const headers = e.target.value.split('|').map(s => s.trim());
                                            const rows = item.table_data?.rows || [[]];
                                            handleUpdateContentItem(secIdx, itemIdx, 'table_data', { headers, rows });
                                          }}
                                          style={{ padding: '0.35rem', fontSize: '0.8rem' }}
                                        />
                                      </div>
                                      <div>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>Lignes du Tableau (une ligne par rangée, cellules séparées par | )</label>
                                        <textarea
                                          className="input-control"
                                          placeholder="ex: Définition | U_{n+1} = U_n + r | U_{n+1} = qU_n"
                                          value={item.table_data?.rows?.map(r => r.join(' | ')).join('\n') || ''}
                                          onChange={e => {
                                            const rows = e.target.value.split('\n').map(line => line.split('|').map(s => s.trim()));
                                            const headers = item.table_data?.headers || [];
                                            handleUpdateContentItem(secIdx, itemIdx, 'table_data', { headers, rows });
                                          }}
                                          rows={3}
                                          style={{ padding: '0.35rem', fontSize: '0.8rem' }}
                                        />
                                      </div>
                                    </div>
                                  ) : item.type === 'image' ? (
                                    renderImageItemEditor(item, secIdx, itemIdx)
                                  ) : (
                                    <textarea
                                      className="input-control"
                                      value={item.text || ''}
                                      onChange={e => handleUpdateContentItem(secIdx, itemIdx, 'text', e.target.value)}
                                      placeholder="Entrez le contenu (LaTeX supporté avec $ ... $)"
                                      rows={2}
                                      style={{ flex: 1, padding: '0.4rem' }}
                                    />
                                  )}

                                  <button
                                    onClick={() => handleRemoveItemFromContentSection(secIdx, itemIdx)}
                                    style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', marginTop: '0.5rem' }}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Type 2: Exercise Block Editor */}
                          {sec.type === 'exercise' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                              <div className="input-group">
                                <label>Énoncé de l'Exercice</label>
                                <textarea
                                  className="input-control"
                                  value={sec.content}
                                  onChange={e => handleUpdateSection(secIdx, 'content', e.target.value)}
                                  placeholder="Entrez l'énoncé de l'exercice..."
                                  rows={4}
                                />
                              </div>

                              {/* Sub-items & Attached Images Editor for Exercises */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px dashed var(--border)', borderRadius: '8px', padding: '0.75rem', background: 'rgba(255,255,255,0.01)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--violet)' }}>
                                    🖼️ عناصر وإشكال التمرين والأسئلة (Éléments & Figures d'exercice)
                                  </span>
                                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenCropperModal(secIdx)}
                                      className="btn-outline"
                                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', color: 'var(--emerald)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                                      title="قص شكل من مستند الـ PDF وإدراجه في هذا التمرين"
                                    >
                                      <Crop size={12} /> ✂️ قص شكل من PDF
                                    </button>
                                    <button onClick={() => handleAddItemToContentSection(secIdx)} className="btn-outline" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>
                                      <Plus size={12} /> + إضافة سؤال / شكل صورة
                                    </button>
                                  </div>
                                </div>

                                {sec.items?.map((item, itemIdx) => (
                                  <div key={itemIdx} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '0.75rem', alignItems: isMobile ? 'stretch' : 'flex-start', width: '100%' }}>
                                    <select
                                      className="input-control"
                                      value={item.type}
                                      onChange={e => handleUpdateContentItem(secIdx, itemIdx, 'type', e.target.value)}
                                      style={{ width: isMobile ? '100%' : '150px', flexShrink: 0, padding: '0.4rem' }}
                                    >
                                      <option value="text">Texte Standard</option>
                                      <option value="bullet">Puce / Question</option>
                                      <option value="highlight_box">Formule (Encadré)</option>
                                      <option value="table">📊 Tableau (جدول/تغيرات)</option>
                                      <option value="image">🖼️ Figure / Image (شكل/مبيان)</option>
                                    </select>

                                    {item.type === 'table' ? (
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem', background: 'rgba(255,255,255,0.01)', padding: '0.75rem', borderRadius: '8px', border: '1px dashed var(--border)' }}>
                                      <div>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>En-têtes du Tableau (séparés par | )</label>
                                        <input
                                          type="text"
                                          className="input-control"
                                          placeholder="ex: x | -\infty | 0 | +\infty"
                                          value={(item.table_data?.headers || item.headers || []).join(' | ')}
                                          onChange={e => {
                                            const headers = e.target.value.split('|').map(s => s.trim());
                                            const rows = item.table_data?.rows || item.rows || [[]];
                                            handleUpdateContentItem(secIdx, itemIdx, 'table_data', { headers, rows });
                                            handleUpdateContentItem(secIdx, itemIdx, 'headers', headers);
                                            handleUpdateContentItem(secIdx, itemIdx, 'rows', rows);
                                          }}
                                          style={{ padding: '0.35rem', fontSize: '0.8rem' }}
                                        />
                                      </div>
                                      <div>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 800 }}>Lignes du Tableau (une ligne par rangée, cellules séparées par | )</label>
                                        <textarea
                                          className="input-control"
                                          placeholder="ex: f'(x) | - | 0 | +&#10;f(x) | +\infty | \searrow -2 | \nearrow +\infty"
                                          value={(item.table_data?.rows || item.rows || []).map(r => Array.isArray(r) ? r.join(' | ') : String(r)).join('\n')}
                                          onChange={e => {
                                            const rows = e.target.value.split('\n').map(line => line.split('|').map(s => s.trim()));
                                            const headers = item.table_data?.headers || item.headers || [];
                                            handleUpdateContentItem(secIdx, itemIdx, 'table_data', { headers, rows });
                                            handleUpdateContentItem(secIdx, itemIdx, 'headers', headers);
                                            handleUpdateContentItem(secIdx, itemIdx, 'rows', rows);
                                          }}
                                          rows={3}
                                          style={{ padding: '0.35rem', fontSize: '0.8rem' }}
                                        />
                                      </div>
                                      <div style={{ marginTop: '0.4rem' }}>
                                        <SmartTableRenderer table={item} />
                                      </div>
                                    </div>
                                  ) : item.type === 'image' ? (
                                      renderImageItemEditor(item, secIdx, itemIdx)
                                    ) : (
                                      <textarea
                                        className="input-control"
                                        value={item.text || ''}
                                        onChange={e => handleUpdateContentItem(secIdx, itemIdx, 'text', e.target.value)}
                                        placeholder="نص السؤال (LaTeX supporté مع $ ... $)"
                                        rows={2}
                                        style={{ flex: 1, padding: '0.4rem' }}
                                      />
                                    )}

                                    <button
                                      onClick={() => handleRemoveItemFromContentSection(secIdx, itemIdx)}
                                      style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', marginTop: '0.5rem' }}
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                ))}
                              </div>

                              <div className="input-group">
                                <label>Solution Détaillée</label>
                                <textarea
                                  className="input-control"
                                  value={sec.solution}
                                  onChange={e => handleUpdateSection(secIdx, 'solution', e.target.value)}
                                  placeholder="Entrez la correction rédigée..."
                                  rows={6}
                                />
                              </div>

                              {/* Interactive Verification Checks */}
                              <div style={{ marginTop: '0.5rem', borderTop: '1px dashed var(--border)', paddingTop: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                                    Champs de vérification interactive (Optionnel - Pour s'entraîner)
                                  </span>
                                  <button onClick={() => handleAddInteractiveAnswer(secIdx)} className="btn-outline" style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}>
                                    <Plus size={12} /> Ajouter une question interactive
                                  </button>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                  {sec.interactive_answers?.map((ans, ansIdx) => (
                                    <div key={ansIdx} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '0.75rem', alignItems: isMobile ? 'stretch' : 'center', width: '100%' }}>
                                      <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>Q{ans.question_idx} :</span>
                                      <input
                                        type="text"
                                        className="input-control"
                                        value={ans.label}
                                        onChange={e => handleUpdateInteractiveAnswer(secIdx, ansIdx, 'label', e.target.value)}
                                        placeholder="Libellé (ex: Entrez la valeur de x)"
                                        style={{ flex: 1, width: isMobile ? '100%' : 'auto', padding: '0.4rem' }}
                                      />
                                      <input
                                        type="text"
                                        className="input-control"
                                        value={ans.expected_answer}
                                        onChange={e => handleUpdateInteractiveAnswer(secIdx, ansIdx, 'expected_answer', e.target.value)}
                                        placeholder="Réponse exacte attendue"
                                        style={{ width: isMobile ? '100%' : '180px', padding: '0.4rem' }}
                                      />
                                      <button
                                        onClick={() => handleRemoveInteractiveAnswer(secIdx, ansIdx)}
                                        style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem', width: '100%' }}>
            <button onClick={() => setPhase(1)} className="btn-outline" style={{ padding: '1rem 2rem', width: isMobile ? '100%' : 'auto', justifyContent: 'center' }} disabled={loading}>
              Retour à l'import
            </button>
            <button onClick={handleSaveLesson} className="btn" style={{ padding: '1rem 2rem', width: isMobile ? '100%' : 'auto', justifyContent: 'center' }} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} style={{ marginRight: '0.5rem' }} />
                  Publication en cours...
                </>
              ) : (
                <>
                  <Save size={18} style={{ marginRight: '0.5rem' }} />
                  Publier la fiche interactive
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Interactive PDF & Image Figure Cropper Modal */}
      <PdfFigureCropperModal
        isOpen={isCropperModalOpen}
        onClose={() => setIsCropperModalOpen(false)}
        initialPdfDoc={pdfDocProxy}
        initialFile={uploadFile}
        sections={sections}
        targetSectionIdx={cropModalSecIdx}
        targetItemIdx={cropModalItemIdx}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}
