// companionExtractionWorker.js
// Asynchronous Background Queue Worker & Resilient AI Extraction Engine
// Handles lesson extraction tasks detached from the client browser with auto-retry and persistent queue.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const TASKS_FILE = path.join(DATA_DIR, 'extraction_tasks.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper: read tasks
const readTasks = () => {
  if (!fs.existsSync(TASKS_FILE)) {
    fs.writeFileSync(TASKS_FILE, JSON.stringify([], null, 2), 'utf8');
    return [];
  }
  try {
    const raw = fs.readFileSync(TASKS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[Worker] Error reading extraction_tasks.json:', err);
    return [];
  }
};

// Helper: write tasks
const writeTasks = (tasks) => {
  try {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf8');
  } catch (err) {
    console.error('[Worker] Error writing extraction_tasks.json:', err);
  }
};

// ─── Moroccan Curriculum System Prompt ────────────────────────────────────────

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
   • 'exercises' : (سلسلة تمارين / Travaux Dirigés TD / Fiche d'exercices / Exercices d'application)
   • 'national'  : (الامتحان الوطني الموحد الرسمي للبكالوريا - Sujet Officiel d'Examen National)
   • 'homework'  : (فرض محروس / فرض منزلي / مراقبة مستمرة - Devoir Surveillé DS / Devoir Maison DM)
   • 'summary'   : (ملخص شامل / ملخص درس / بطاقة ملخص / Résumé de cours / Synthèse de cours)
   • 'course'    : (درس كامل / بطاقة درس - Fiche de cours)
   • 'concours'  : (مباراة ولوج الكليات والمدارس العليا - Épreuve de Concours)

3. EXTRACTION DU BARÈME DE NOTATION ET DES POINTS ("points" & "header.total_points") :
   - Dans le "header", indique "total_points": 20 (ou total calculé).
   - Pour CHAQUE exercice : extrais le nombre numérique de points attribués dans le champ "points".

4. RÈGLE ABSOLUE DE LANGUE — CONSERVATION RIGOUREUSE DE LA LANGUE D'ORIGINE :
   - Si le fichier est en ARABE : TOUT LE JSON DOIT ÊTRE EN ARABE ! Ne traduis JAMAIS vers le français.
   - Si le fichier source est en FRANÇAIS : extrais l'intégralité en français.

5. LATEX STRICT :
   - Encadre CHAQUE symbole et formule par $...$ ou $$...$$.
   - Pas de \\cline (utiliser \\hline).
   - Utilise \\boxed{...} pour les résultats finaux.
`;

const MOROCCAN_SOLVE_ADDENDUM = `
════════════════════════════════════════════════════════════
🎯 RÈGLES DE RÉSOLUTION OFFICIELLES (INSPECTEUR PÉDAGOGIQUE MAROCAIN)
════════════════════════════════════════════════════════════
Pour chaque exercice, activité ou application résolue dans le champ "solution" :
1. Respecte scrupuleusement le programme officiel marocain du niveau détecté.
2. ⚠️ RÈGLE DE L'HÔPITAL STRICTEMENT INTERDITE pour les limites (utiliser méthodes officielles : factorisation, quantité conjuguée, encadrements).
3. Rédige d'abord l'intégralité du corrigé mathématique détaillé question par question.
`;

const NO_SOLUTION_ADDENDUM = `
⚠️ INSTRUCTION STRICTE — MODE EXTRACTION UNIQUEMENT (SANS RÉSOLUTION) :
- Tu dois extraire et structurer FIDÈLEMENT tout le contenu du document sans résoudre.
- Pour le champ "solution" de chaque exercice, écris UNIQUEMENT la chaîne vide "".
- Pour le tableau "interactive_answers", retourne un tableau vide [].
`;

const buildExtractionUserPrompt = (pageCount, solveSolutions, preExtractedPdfText = '') => {
  const pageNote = pageCount && pageCount > 1
    ? `⚠️ CE DOCUMENT COMPORTE EXACTEMENT ${pageCount} PAGES (de la page 1 à la page ${pageCount}).\nTu DOIS IMPÉRATIVEMENT lire, parcourir et extraire l'intégralité de CHAQUE page de la page 1 jusqu'à la dernière page ${pageCount} sans t'arrêter en cours de route et sans sauter aucune section.`
    : `⚠️ Tu DOIS IMPÉRATIVEMENT extraire l'intégralité absolue du document du début à la toute fin sans rien omettre.`;

  const textFusion = preExtractedPdfText && preExtractedPdfText.trim()
    ? `\n\n📄 TEXTE BRUT DÉTECTÉ DIRECTEMENT DU PDF :\n"""\n${preExtractedPdfText.trim()}\n"""\n`
    : '';

  const commonRules = `
${pageNote}
${textFusion}
🎯 EXIGENCES STRICTES D'EXHAUSTIVITÉ TOTALE (AUCUN MANQUE TOLÉRÉ) :
1. COURS THÉORIQUES (الدروس النظرية) : Extrais L'INTÉGRALITÉ des chapitres, sections, définitions, théorèmes et exemples.
2. SÉRIES D'EXERCICES (سلاسل التمارين) : Extrais TOUS les exercices du premier au dernier avec toutes les sous-questions.
3. CONSERVATION DE LA LANGUE D'ORIGINE (arabe ou français).
4. SYNTAXE LATEX RIGOUREUSE avec $...$ et $$...$$.
`;

  if (solveSolutions) {
    return `${commonRules}\nTranscris et extrais l'intégralité absolue du document, résous les exercices de manière détaillée dans "solution" et génère le JSON complet.`;
  } else {
    return `${commonRules}\nExtrais et structure fidèlement tout le contenu sans résoudre. IMPORTANT : Laisse le champ "solution" vide ("") pour chaque exercice et "interactive_answers" comme tableau vide []. Ne résous rien et génère le JSON complet.`;
  }
};

// ─── JSON Repair & Sanitization Pipeline ──────────────────────────────────────

const repairTruncatedJson = (str) => {
  if (!str) return str;
  let s = str.trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

  const firstBrace = s.indexOf('{');
  const firstBracket = s.indexOf('[');
  let start = -1;
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    start = firstBrace;
  } else if (firstBracket !== -1) {
    start = firstBracket;
  }
  if (start > 0) s = s.slice(start);

  const stack = [];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\') { escaped = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (!inString) {
      if (c === '{') stack.push('}');
      else if (c === '[') stack.push(']');
      else if (c === '}' || c === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === c) {
          stack.pop();
        }
      }
    }
  }

  if (inString) s += '"';
  s = s.replace(/,\s*$/, '');
  s = s.replace(/:\s*$/, ': ""');

  while (stack.length > 0) {
    s += stack.pop();
  }
  return s;
};

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
      if (char === '\n') result += '\\n';
      continue;
    }
    result += char;
  }
  return result;
};

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
        let isClosing = false;
        let j = i + 1;
        while (j < str.length && /\s/.test(str[j])) j++;
        if (j < str.length) {
          const nextChar = str[j];
          if (nextChar === ',' || nextChar === '}' || nextChar === ']' || nextChar === ':') {
            isClosing = true;
          }
        } else {
          isClosing = true;
        }
        if (isClosing) {
          inString = false;
          result += char;
        } else {
          result += '\\"';
        }
      }
      continue;
    }
    result += char;
  }
  return result;
};

const extractJsonFromText = (str) => {
  if (!str) return str;
  let s = str.trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const firstBrace = s.indexOf('{');
  const firstBracket = s.indexOf('[');
  let start = -1;
  if (firstBrace === -1 && firstBracket === -1) return s;
  if (firstBrace === -1) start = firstBracket;
  else if (firstBracket === -1) start = firstBrace;
  else start = Math.min(firstBrace, firstBracket);

  const lastBrace = s.lastIndexOf('}');
  const lastBracket = s.lastIndexOf(']');
  const end = Math.max(lastBrace, lastBracket);

  if (start !== -1 && end !== -1 && end > start) {
    return s.slice(start, end + 1);
  }
  return start !== -1 ? s.slice(start) : s;
};

const parseJsonWithResilience = (rawText) => {
  let cleanText = rawText.trim();
  if (cleanText.includes('</think>')) {
    cleanText = cleanText.split('</think>').pop().trim();
  }
  cleanText = sanitizeLatexJson(cleanText);

  const strategies = [
    (t) => JSON.parse(extractJsonFromText(t)),
    (t) => JSON.parse(escapeLiteralNewlinesInJson(extractJsonFromText(t))),
    (t) => JSON.parse(escapeUnescapedQuotesInJson(escapeLiteralNewlinesInJson(extractJsonFromText(t)))),
    (t) => JSON.parse(repairTruncatedJson(escapeUnescapedQuotesInJson(escapeLiteralNewlinesInJson(extractJsonFromText(t))))),
    (t) => JSON.parse(repairTruncatedJson(escapeUnescapedQuotesInJson(escapeLiteralNewlinesInJson(sanitizeLatexJson(extractJsonFromText(t))))))
  ];

  let lastError = null;
  for (let i = 0; i < strategies.length; i++) {
    try {
      const res = strategies[i](cleanText);
      console.log(`[Worker] JSON Parse Strategy ${i + 1} succeeded!`);
      return res;
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`Échec d'analyse du JSON produit par l'IA : ${lastError?.message || 'JSON invalide'}`);
};

// ─── AI API Drivers with Cascading Model Fallback & Quota Resilience ─────────

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Verified high-performing models per provider
const FALLBACK_MODELS = {
  gemini: [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.5-pro',
    'gemini-1.5-pro',
    'gemini-1.5-flash'
  ],
  claude: [
    'claude-3-7-sonnet-20250219',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022'
  ],
  deepseek: [
    'deepseek-reasoner',
    'deepseek-chat'
  ]
};

// Build unique ordered cascade list of models to try
const resolveModelCascade = (provider, userPreferredModel) => {
  const defaults = FALLBACK_MODELS[provider] || FALLBACK_MODELS.gemini;
  let cleanUser = (userPreferredModel || '').trim();

  // Normalize obsolete or speculative model names
  if (provider === 'gemini') {
    if (cleanUser === 'gemini-3.6-flash' || cleanUser === 'gemini-3.5-flash' || cleanUser === 'gemini-3.7' || cleanUser === 'gemini-3.5-flash-thinking' || cleanUser === 'gemini-3.1-pro') {
      cleanUser = 'gemini-2.5-flash';
    }
  }

  const cascade = [];
  if (cleanUser) {
    cascade.push(cleanUser);
  }
  for (const m of defaults) {
    if (!cascade.includes(m)) {
      cascade.push(m);
    }
  }
  return cascade;
};

// Quota wait helper with live countdown updates
const waitForQuotaRegeneration = async (seconds, modelName, onProgress) => {
  console.log(`[Worker] Quota exhausted for ${modelName}. Waiting ${seconds}s for quota regeneration...`);
  for (let rem = seconds; rem > 0; rem -= 5) {
    const chunk = Math.min(5, rem);
    if (onProgress) {
      onProgress(30, `Quota API saturé pour [${modelName}] (HTTP 429). Pause intelligente : reprise dans ${rem}s...`);
    }
    await sleep(chunk * 1000);
  }
};

// Strict Document Validation: Ensure output is NOT an empty shell
const validateExtractedDocument = (parsed) => {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error("Format JSON invalide : aucun objet structuré trouvé.");
  }

  let rawSections = [];
  if (Array.isArray(parsed)) {
    rawSections = parsed;
  } else if (Array.isArray(parsed.sections)) {
    rawSections = parsed.sections;
  } else if (Array.isArray(parsed.items)) {
    rawSections = parsed.items;
  } else if (Array.isArray(parsed.exercises)) {
    rawSections = parsed.exercises;
  } else if (Array.isArray(parsed.exercices)) {
    rawSections = parsed.exercices;
  } else if (Array.isArray(parsed.series)) {
    rawSections = parsed.series;
  } else if (Array.isArray(parsed.serie)) {
    rawSections = parsed.serie;
  } else if (Array.isArray(parsed.questions)) {
    rawSections = parsed.questions;
  } else if (Array.isArray(parsed.parties)) {
    rawSections = parsed.parties;
  } else if (Array.isArray(parsed.content)) {
    rawSections = parsed.content;
  } else if (Array.isArray(parsed.data)) {
    rawSections = parsed.data;
  } else if (Array.isArray(parsed.cours)) {
    rawSections = parsed.cours;
  } else if (parsed.course && Array.isArray(parsed.course.sections)) {
    rawSections = parsed.course.sections;
  } else if (parsed.course && Array.isArray(parsed.course.items)) {
    rawSections = parsed.course.items;
  } else {
    const arrayProp = Object.values(parsed).find(val => Array.isArray(val) && val.length > 0 && typeof val[0] === 'object');
    if (arrayProp) {
      rawSections = arrayProp;
    }
  }

  // Fallback if parsed is directly a single section object
  if (rawSections.length === 0) {
    if (parsed.content || parsed.questions || parsed.exercice || parsed.title) {
      rawSections = [parsed];
    }
  }

  if (!rawSections || rawSections.length === 0) {
    throw new Error("Document vide : aucune section ni exercice n'a été extrait par le modèle.");
  }

  // Ensure at least one section has substantial content (not a blank/empty placeholder)
  const hasSubstantiveContent = rawSections.some(sec => {
    if (!sec) return false;
    if (typeof sec === 'string') return sec.trim().length > 15;
    if (typeof sec !== 'object') return false;

    const title = (sec.title || sec.section_title || sec.titre || '').trim();
    const content = (typeof sec.content === 'string' ? sec.content : '').trim();
    const solution = (typeof sec.solution === 'string' ? sec.solution : '').trim();
    const items = Array.isArray(sec.items) ? sec.items : [];
    const questions = Array.isArray(sec.questions) ? sec.questions : [];

    const hasItemText = items.some(it => {
      if (!it) return false;
      if (typeof it === 'string') return it.trim().length > 5;
      return (it.text && it.text.trim().length > 5) || it.url || it.type === 'table' || it.table_data;
    });

    return title.length > 3 || content.length > 15 || solution.length > 15 || hasItemText || questions.length > 0;
  });

  if (!hasSubstantiveContent) {
    throw new Error("Document vide : les sections retournées ne contiennent aucun texte, formule ou exercice exploitable.");
  }

  const header = parsed.header || (typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {});
  return {
    ...parsed,
    header,
    sections: rawSections
  };
};

// ─── Single Model Invocation Drivers ──────────────────────────────────────────

const callGeminiSingleAttempt = async ({ model, base64Data, safeMime, userText, systemContent, apiKey }) => {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: safeMime,
              data: base64Data
            }
          },
          { text: userText }
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
    const errJson = await res.json().catch(() => ({}));
    const status = res.status;
    const msg = errJson?.error?.message || `Erreur HTTP ${status}`;
    const err = new Error(`Gemini [${model}]: ${msg}`);
    err.status = status;
    err.isQuotaExceeded = (status === 429 || /resource_exhausted|quota|rate limit/i.test(msg));
    err.isNotFound = (status === 404 || /not found/i.test(msg));
    throw err;
  }

  const data = await res.json();
  const candidate = data?.candidates?.[0];
  if (!candidate || !candidate.content?.parts) {
    throw new Error(`Gemini [${model}] n'a retourné aucun contenu.`);
  }

  const nonThoughtParts = candidate.content.parts.filter(p => !p.thought);
  const text = (nonThoughtParts.length > 0 ? nonThoughtParts : candidate.content.parts)
    .map(p => p.text || '')
    .join('');

  if (!text.trim()) {
    throw new Error(`Gemini [${model}] a produit une réponse textuelle vide.`);
  }

  return text;
};

const callClaudeSingleAttempt = async ({ model, base64Data, safeMime, userText, systemContent, apiKey, proxyUrl }) => {
  const endpoint = proxyUrl || 'https://api.anthropic.com/v1/messages';
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['x-api-key'] = apiKey;
  headers['anthropic-version'] = '2023-06-01';

  const isPdf = safeMime === 'application/pdf';
  const sourceBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } }
    : { type: 'image', source: { type: 'base64', media_type: safeMime, data: base64Data } };

  const maxTokens = (model.includes('3-7') || model.includes('opus-4') || model.includes('sonnet-4')) ? 16000 : 8192;

  const payload = {
    model,
    max_tokens: maxTokens,
    system: systemContent,
    messages: [
      {
        role: 'user',
        content: [
          sourceBlock,
          { type: 'text', text: userText }
        ]
      }
    ]
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    const status = res.status;
    const msg = errJson?.error?.message || `Erreur HTTP ${status}`;
    const err = new Error(`Claude [${model}]: ${msg}`);
    err.status = status;
    err.isQuotaExceeded = (status === 429 || /rate_limit|overloaded/i.test(msg));
    throw err;
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (!text || !text.trim()) {
    throw new Error(`Claude [${model}] n'a retourné aucun texte.`);
  }
  return text;
};

const callDeepSeekSingleAttempt = async ({ model, preExtractedPdfText, pageCount, solveSolutions, apiKey, deepseekUrl }) => {
  const cleanUrl = (deepseekUrl || 'https://api.deepseek.com').trim().replace(/\/$/, '');
  const endpoint = `${cleanUrl}/v1/chat/completions`;

  const systemContent = solveSolutions
    ? SYSTEM_PROMPT + MOROCCAN_SOLVE_ADDENDUM
    : SYSTEM_PROMPT + NO_SOLUTION_ADDENDUM;

  const userContent = `TEXTE DU DOCUMENT EXTRAIT DU PDF :\n${preExtractedPdfText || ''}\n\n${buildExtractionUserPrompt(pageCount, solveSolutions)}`;

  const payload = {
    model,
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: userContent }
    ],
    max_tokens: 8192,
    response_format: !model.includes('reasoner') ? { type: 'json_object' } : undefined,
    temperature: 0.1
  };

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    const status = res.status;
    const msg = errJson?.error?.message || `Erreur HTTP ${status}`;
    const err = new Error(`DeepSeek [${model}]: ${msg}`);
    err.status = status;
    err.isQuotaExceeded = (status === 429 || /rate limit|quota/i.test(msg));
    throw err;
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || !content.trim()) {
    throw new Error(`DeepSeek [${model}] n'a retourné aucun contenu.`);
  }
  return content;
};

// ─── Background Task Queue Controller ─────────────────────────────────────────

let isWorkerRunning = false;

// Clean stuck tasks on startup
const initQueue = () => {
  const tasks = readTasks();
  let changed = false;
  tasks.forEach(t => {
    if (t.status === 'processing') {
      t.status = 'pending';
      t.progressMessage = 'Remis en attente après redémarrage du serveur.';
      changed = true;
    }
  });
  if (changed) writeTasks(tasks);
  setTimeout(processQueue, 1500);
};

// Main Queue Processing Loop with Multi-Model Fallback Cascade & Quota Resilience
export const processQueue = async () => {
  if (isWorkerRunning) return;

  const tasks = readTasks();
  const nextTask = tasks.find(t => t.status === 'pending');
  if (!nextTask) {
    isWorkerRunning = false;
    return;
  }

  isWorkerRunning = true;
  const taskId = nextTask.id;
  console.log(`[Worker] Starting extraction task: ${taskId} (${nextTask.fileName})`);

  const updateTaskState = (updates) => {
    const currentTasks = readTasks();
    const idx = currentTasks.findIndex(t => t.id === taskId);
    if (idx !== -1) {
      currentTasks[idx] = { ...currentTasks[idx], ...updates, updatedAt: new Date().toISOString() };
      writeTasks(currentTasks);
    }
  };

  try {
    updateTaskState({
      status: 'processing',
      attempts: (nextTask.attempts || 0) + 1,
      progressPercent: 10,
      progressMessage: 'Initialisation du document et analyse des modèles disponibles...'
    });

    const onProgress = (percent, message) => {
      updateTaskState({ progressPercent: percent, progressMessage: message });
    };

    const provider = nextTask.provider || 'gemini';
    const modelsToTry = resolveModelCascade(provider, nextTask.model);
    console.log(`[Worker] Task ${taskId}: cascade list [${modelsToTry.join(' -> ')}]`);

    const isPdf = (nextTask.fileType && nextTask.fileType.includes('pdf'));
    const safeMime = isPdf ? 'application/pdf' : (nextTask.fileType && nextTask.fileType.includes('/') ? nextTask.fileType : 'image/jpeg');
    const solveSolutions = nextTask.solveSolutions !== false;

    const systemContent = solveSolutions
      ? SYSTEM_PROMPT + MOROCCAN_SOLVE_ADDENDUM
      : SYSTEM_PROMPT + NO_SOLUTION_ADDENDUM;

    const userText = buildExtractionUserPrompt(nextTask.pageCount || 1, solveSolutions, nextTask.preExtractedPdfText);

    let extractedResult = null;
    let usedModel = null;
    const failureLog = [];

    // Cascading model failover loop
    for (let i = 0; i < modelsToTry.length; i++) {
      const currentModel = modelsToTry[i];
      const modelIndex = i + 1;
      const totalModels = modelsToTry.length;
      const baseProgress = 20 + Math.floor((i / totalModels) * 60);

      onProgress(baseProgress, `Essai du modèle [${currentModel}] (${modelIndex}/${totalModels})...`);
      console.log(`[Worker] Task ${taskId}: Trying model ${currentModel} (${modelIndex}/${totalModels})...`);

      let rawText = '';
      let modelSucceeded = false;

      // Inner retry loop for transient network glitches
      const MAX_INNER_RETRIES = 2;
      for (let attempt = 1; attempt <= MAX_INNER_RETRIES; attempt++) {
        try {
          if (provider === 'claude') {
            rawText = await callClaudeSingleAttempt({
              model: currentModel,
              base64Data: nextTask.base64Data,
              safeMime,
              userText,
              systemContent,
              apiKey: nextTask.apiKey,
              proxyUrl: nextTask.proxyUrl
            });
          } else if (provider === 'deepseek') {
            rawText = await callDeepSeekSingleAttempt({
              model: currentModel,
              preExtractedPdfText: nextTask.preExtractedPdfText || '',
              pageCount: nextTask.pageCount || 1,
              solveSolutions,
              apiKey: nextTask.apiKey,
              deepseekUrl: nextTask.deepseekUrl
            });
          } else {
            // Default: Gemini
            rawText = await callGeminiSingleAttempt({
              model: currentModel,
              base64Data: nextTask.base64Data,
              safeMime,
              userText,
              systemContent,
              apiKey: nextTask.apiKey
            });
          }

          modelSucceeded = true;
          break; // API call succeeded
        } catch (apiErr) {
          const isQuota = Boolean(apiErr.isQuotaExceeded || apiErr.status === 429);
          const isNotFound = Boolean(apiErr.isNotFound || apiErr.status === 404);

          console.warn(`[Worker] Model ${currentModel} attempt ${attempt} failed: ${apiErr.message}`);

          if (isNotFound) {
            // Model doesn't exist on API, immediately skip to next model
            failureLog.push(`${currentModel}: non supporté ou introuvable (404)`);
            break;
          }

          if (isQuota) {
            failureLog.push(`${currentModel}: quota dépassé (429)`);
            const hasMoreModels = i < modelsToTry.length - 1;
            if (hasMoreModels) {
              // Try next model tier which often has separate quota (e.g. Flash vs Pro)
              onProgress(baseProgress, `Quota atteint sur [${currentModel}]. Bascule automatique vers le modèle de secours...`);
              await sleep(2000);
              break;
            } else {
              // If this was the last model, wait for quota regeneration and retry
              await waitForQuotaRegeneration(30, currentModel, onProgress);
              continue;
            }
          }

          // Transient network or server error
          if (attempt < MAX_INNER_RETRIES) {
            onProgress(baseProgress, `Incident temporaire sur [${currentModel}]. Réessai dans 4s...`);
            await sleep(4000);
          } else {
            failureLog.push(`${currentModel}: ${apiErr.message}`);
          }
        }
      }

      if (!modelSucceeded || !rawText.trim()) {
        continue; // Proceed to next model in cascade
      }

      // Model returned text: parse and strictly validate content
      try {
        onProgress(baseProgress + 10, `Validation et contrôle qualité du contenu extrait (${currentModel})...`);
        const parsed = parseJsonWithResilience(rawText);
        const validatedDoc = validateExtractedDocument(parsed);

        // Document is verified NON-EMPTY with real sections!
        extractedResult = validatedDoc;
        usedModel = currentModel;
        console.log(`[Worker] Task ${taskId}: extraction succeeded with model ${currentModel}! Sections: ${validatedDoc.sections.length}`);
        break; // SUCCESS! Break out of model cascade
      } catch (parseOrValErr) {
        console.warn(`[Worker] Validation failed for model ${currentModel}: ${parseOrValErr.message}`);
        failureLog.push(`${currentModel}: ${parseOrValErr.message}`);
        onProgress(baseProgress + 5, `Contenu incomplet retourné par [${currentModel}]. Bascule vers le modèle suivant...`);
        await sleep(2000);
      }
    }

    // Check if any model in the cascade succeeded
    if (!extractedResult) {
      throw new Error(
        `Tous les modèles testés (${modelsToTry.join(', ')}) ont échoué ou ont retourné un contenu vide.\n` +
        `Détails : ${failureLog.join(' | ')}`
      );
    }

    // Finalize successful extraction
    const header = extractedResult.header || {};
    const sectionsCount = extractedResult.sections.length;

    updateTaskState({
      status: 'completed',
      progressPercent: 100,
      progressMessage: `Fiche extraite avec succès via [${usedModel}] ! (${sectionsCount} sections détectées)`,
      result: extractedResult,
      headerSummary: {
        ficheTitle: header.fiche_title || header.title || nextTask.fileName,
        subject: header.subject || 'Mathématiques',
        detectedLevel: header.detected_level || '2bac_pc_svt',
        docType: header.doc_type || 'course',
        sectionsCount,
        extractedWithModel: usedModel
      },
      // Remove heavy binary payloads
      base64Data: undefined,
      preExtractedPdfText: undefined,
      completedAt: new Date().toISOString(),
      error: null
    });

    console.log(`[Worker] Task ${taskId} successfully completed using model ${usedModel}!`);
  } catch (err) {
    console.error(`[Worker] Task ${taskId} failed completely:`, err.message);
    updateTaskState({
      status: 'failed',
      progressPercent: 0,
      progressMessage: `Échec de l'extraction : ${err.message}`,
      error: err.message,
      result: null, // STRICTLY NULL TO PREVENT EMPTY FILES
      base64Data: undefined,
      preExtractedPdfText: undefined
    });
  } finally {
    isWorkerRunning = false;
    setTimeout(processQueue, 500);
  }
};

// ─── Public CRUD API for Companion Server ─────────────────────────────────────

export const getExtractionTasks = ({ includeResult = false } = {}) => {
  const tasks = readTasks();
  return tasks
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .map(t => {
      if (includeResult) return t;
      const { base64Data, preExtractedPdfText, result, ...meta } = t;
      return {
        ...meta,
        hasResult: Boolean(result)
      };
    });
};

export const getExtractionTaskById = (id) => {
  const tasks = readTasks();
  const task = tasks.find(t => t.id === id);
  if (!task) return null;
  const { base64Data, preExtractedPdfText, ...safeTask } = task;
  return safeTask;
};

export const createExtractionTask = (data) => {
  const tasks = readTasks();
  const id = `TASK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const newTask = {
    id,
    fileName: data.fileName || 'document.pdf',
    fileType: data.fileType || 'application/pdf',
    pageCount: data.pageCount || 1,
    base64Data: data.base64Data || '',
    preExtractedPdfText: data.preExtractedPdfText || '',
    provider: data.provider || 'gemini',
    apiKey: data.apiKey || '',
    model: data.model || '',
    proxyUrl: data.proxyUrl || '',
    deepseekUrl: data.deepseekUrl || '',
    solveSolutions: data.solveSolutions !== false,
    status: 'pending',
    progressPercent: 0,
    progressMessage: 'En attente dans la file...',
    attempts: 0,
    maxAttempts: 3,
    error: null,
    result: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  tasks.unshift(newTask);
  writeTasks(tasks);

  setTimeout(processQueue, 100);

  const { base64Data, preExtractedPdfText, ...safeTask } = newTask;
  return safeTask;
};

export const retryExtractionTask = (id, newApiKey = null) => {
  const tasks = readTasks();
  const idx = tasks.findIndex(t => t.id === id);
  if (idx === -1) return null;

  const task = tasks[idx];
  task.status = 'pending';
  task.attempts = 0;
  task.error = null;
  task.progressPercent = 0;
  task.progressMessage = 'Nouvelle tentative programmée...';
  task.updatedAt = new Date().toISOString();
  if (newApiKey) task.apiKey = newApiKey;

  tasks[idx] = task;
  writeTasks(tasks);

  setTimeout(processQueue, 100);
  const { base64Data, preExtractedPdfText, ...safeTask } = task;
  return safeTask;
};

export const deleteExtractionTask = (id) => {
  const tasks = readTasks();
  const filtered = tasks.filter(t => t.id !== id);
  writeTasks(filtered);
  return true;
};

// Initialize on load
initQueue();
