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

// ─── AI API Drivers with Exponential Backoff Auto-Retry ───────────────────────

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const callGeminiWithRetry = async ({ base64Data, fileType, pageCount, preExtractedPdfText, solveSolutions, apiKey, model, onProgress }) => {
  const modelToUse = (!model || model === 'gemini-2.5-flash') ? 'gemini-3.6-flash' : model;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;

  const isPdf = (fileType && fileType.includes('pdf'));
  const safeMime = isPdf ? 'application/pdf' : (fileType && fileType.includes('/') ? fileType : 'image/jpeg');

  const systemContent = solveSolutions
    ? SYSTEM_PROMPT + MOROCCAN_SOLVE_ADDENDUM
    : SYSTEM_PROMPT + NO_SOLUTION_ADDENDUM;

  const userText = buildExtractionUserPrompt(pageCount, solveSolutions, preExtractedPdfText);

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

  const MAX_RETRIES = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 1) {
        onProgress(35, `Tentative ${attempt}/${MAX_RETRIES} après incident temporaire...`);
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const status = res.status;
        const msg = errJson?.error?.message || `Erreur HTTP ${status}`;

        if ((status === 429 || status >= 500) && attempt < MAX_RETRIES) {
          const delayMs = attempt * 4000;
          console.warn(`[Gemini] HTTP ${status} on attempt ${attempt}. Retrying in ${delayMs}ms...`);
          onProgress(30, `API surchargée (HTTP ${status}). Nouvel essai automatique dans ${delayMs / 1000}s...`);
          await sleep(delayMs);
          continue;
        }
        throw new Error(`Gemini API: ${msg}`);
      }

      const data = await res.json();
      const candidate = data?.candidates?.[0];
      if (!candidate || !candidate.content?.parts) {
        throw new Error("L'API Gemini n'a retourné aucun contenu.");
      }

      const nonThoughtParts = candidate.content.parts.filter(p => !p.thought);
      const text = (nonThoughtParts.length > 0 ? nonThoughtParts : candidate.content.parts)
        .map(p => p.text || '')
        .join('');

      if (!text.trim()) throw new Error("Réponse textuelle de Gemini vide.");
      return text;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        const delayMs = attempt * 3000;
        console.warn(`[Gemini] Network/call error on attempt ${attempt}: ${err.message}. Retrying...`);
        onProgress(30, `Connexion interrompue (${err.message}). Réessai ${attempt + 1}/${MAX_RETRIES}...`);
        await sleep(delayMs);
      }
    }
  }
  throw lastError;
};

const callClaudeWithRetry = async ({ base64Data, fileType, pageCount, preExtractedPdfText, solveSolutions, apiKey, model, proxyUrl, onProgress }) => {
  const endpoint = proxyUrl || 'https://api.anthropic.com/v1/messages';
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['x-api-key'] = apiKey;
  headers['anthropic-version'] = '2023-06-01';

  const isPdf = (fileType && fileType.includes('pdf'));
  const safeMime = isPdf ? 'application/pdf' : (fileType && fileType.includes('/') ? fileType : 'image/jpeg');
  const sourceBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } }
    : { type: 'image', source: { type: 'base64', media_type: safeMime, data: base64Data } };

  const systemContent = solveSolutions
    ? SYSTEM_PROMPT + MOROCCAN_SOLVE_ADDENDUM
    : SYSTEM_PROMPT + NO_SOLUTION_ADDENDUM;

  const userText = buildExtractionUserPrompt(pageCount, solveSolutions, preExtractedPdfText);
  const selectedModel = model || 'claude-3-5-sonnet-20241022';
  const maxTokens = (selectedModel.includes('3-7') || selectedModel.includes('opus-4') || selectedModel.includes('sonnet-4')) ? 16000 : 8192;

  const payload = {
    model: selectedModel,
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

  const MAX_RETRIES = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 1) {
        onProgress(35, `Tentative ${attempt}/${MAX_RETRIES} Claude en cours...`);
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const status = res.status;
        const msg = errJson?.error?.message || `Erreur HTTP ${status}`;

        if ((status === 429 || status >= 500) && attempt < MAX_RETRIES) {
          const delayMs = attempt * 4000;
          onProgress(30, `API Claude occupée (HTTP ${status}). Réessai dans ${delayMs / 1000}s...`);
          await sleep(delayMs);
          continue;
        }
        throw new Error(`Claude API: ${msg}`);
      }

      const data = await res.json();
      const text = data?.content?.[0]?.text;
      if (!text) throw new Error("L'API Claude n'a retourné aucun texte.");
      return text;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        const delayMs = attempt * 3000;
        onProgress(30, `Erreur réseau Claude (${err.message}). Réessai ${attempt + 1}/${MAX_RETRIES}...`);
        await sleep(delayMs);
      }
    }
  }
  throw lastError;
};

const callDeepSeekWithRetry = async ({ preExtractedPdfText, pageCount, solveSolutions, apiKey, model, deepseekUrl, onProgress }) => {
  const rawModel = model || 'deepseek-reasoner';
  const modelToUse = (rawModel === 'deepseek-v4-pro' || rawModel === 'deepseek-r1')
    ? 'deepseek-reasoner'
    : (rawModel === 'deepseek-v4-flash' || rawModel === 'deepseek-v3')
      ? 'deepseek-chat'
      : rawModel;

  const cleanUrl = (deepseekUrl || 'https://api.deepseek.com').trim().replace(/\/$/, '');
  const endpoint = `${cleanUrl}/v1/chat/completions`;

  const systemContent = solveSolutions
    ? SYSTEM_PROMPT + MOROCCAN_SOLVE_ADDENDUM
    : SYSTEM_PROMPT + NO_SOLUTION_ADDENDUM;

  const userContent = `TEXTE DU DOCUMENT EXTRAIT DU PDF :\n${preExtractedPdfText || ''}\n\n${buildExtractionUserPrompt(pageCount, solveSolutions)}`;

  const payload = {
    model: modelToUse,
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: userContent }
    ],
    max_tokens: 8192,
    response_format: !modelToUse.includes('reasoner') ? { type: 'json_object' } : undefined,
    temperature: 0.1
  };

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };

  const MAX_RETRIES = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 1) {
        onProgress(35, `Tentative ${attempt}/${MAX_RETRIES} DeepSeek en cours...`);
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const status = res.status;
        const msg = errJson?.error?.message || `Erreur HTTP ${status}`;

        if ((status === 429 || status >= 500) && attempt < MAX_RETRIES) {
          const delayMs = attempt * 4000;
          onProgress(30, `API DeepSeek surchargée (${status}). Réessai dans ${delayMs / 1000}s...`);
          await sleep(delayMs);
          continue;
        }
        throw new Error(`DeepSeek API: ${msg}`);
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error("DeepSeek n'a retourné aucun contenu.");
      return content;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        const delayMs = attempt * 3000;
        onProgress(30, `Incident DeepSeek (${err.message}). Réessai ${attempt + 1}/${MAX_RETRIES}...`);
        await sleep(delayMs);
      }
    }
  }
  throw lastError;
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

// Main Queue Processing Loop
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
      progressMessage: 'Initialisation du document et configuration...'
    });

    const onProgress = (percent, message) => {
      updateTaskState({ progressPercent: percent, progressMessage: message });
    };

    let rawText = '';
    const provider = nextTask.provider || 'gemini';
    onProgress(25, `Transmission du document à l'IA (${provider.toUpperCase()})...`);

    if (provider === 'claude') {
      rawText = await callClaudeWithRetry({
        base64Data: nextTask.base64Data,
        fileType: nextTask.fileType,
        pageCount: nextTask.pageCount || 1,
        preExtractedPdfText: nextTask.preExtractedPdfText || '',
        solveSolutions: nextTask.solveSolutions !== false,
        apiKey: nextTask.apiKey,
        model: nextTask.model,
        proxyUrl: nextTask.proxyUrl,
        onProgress
      });
    } else if (provider === 'deepseek') {
      rawText = await callDeepSeekWithRetry({
        preExtractedPdfText: nextTask.preExtractedPdfText || '',
        pageCount: nextTask.pageCount || 1,
        solveSolutions: nextTask.solveSolutions !== false,
        apiKey: nextTask.apiKey,
        model: nextTask.model,
        deepseekUrl: nextTask.deepseekUrl,
        onProgress
      });
    } else {
      // Default: Gemini
      rawText = await callGeminiWithRetry({
        base64Data: nextTask.base64Data,
        fileType: nextTask.fileType,
        pageCount: nextTask.pageCount || 1,
        preExtractedPdfText: nextTask.preExtractedPdfText || '',
        solveSolutions: nextTask.solveSolutions !== false,
        apiKey: nextTask.apiKey,
        model: nextTask.model,
        onProgress
      });
    }

    onProgress(75, 'Structure LaTeX, assainissement et validation JSON...');
    const parsed = parseJsonWithResilience(rawText);

    // Normalize sections count for progress preview
    const header = parsed?.header || {};
    const sectionsCount = Array.isArray(parsed?.sections) ? parsed.sections.length : 0;

    // Successful completion
    updateTaskState({
      status: 'completed',
      progressPercent: 100,
      progressMessage: `Fiche extraite avec succès ! (${sectionsCount} sections détectées)`,
      result: parsed,
      headerSummary: {
        ficheTitle: header.fiche_title || header.title || nextTask.fileName,
        subject: header.subject || 'Mathématiques',
        detectedLevel: header.detected_level || '2bac_pc_svt',
        docType: header.doc_type || 'course',
        sectionsCount
      },
      // Remove heavy raw base64 data to keep JSON lightweight
      base64Data: undefined,
      preExtractedPdfText: undefined,
      completedAt: new Date().toISOString(),
      error: null
    });

    console.log(`[Worker] Task ${taskId} successfully completed!`);
  } catch (err) {
    console.error(`[Worker] Task ${taskId} failed:`, err);
    updateTaskState({
      status: 'failed',
      progressPercent: 0,
      progressMessage: `Échec de l'extraction : ${err.message}`,
      error: err.message,
      base64Data: undefined
    });
  } finally {
    isWorkerRunning = false;
    // Process next item in queue
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
