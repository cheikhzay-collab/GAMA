import { useState, useRef, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  UploadCloud, Sparkles, Loader2, CheckCircle2, 
  Trash2, Plus, ArrowLeft, AlertCircle, Save 
} from 'lucide-react';
import { addLesson } from '../services/lessonService';
import { SafeInlineMath } from '../utils/mathRenderer';
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

const SYSTEM_PROMPT = `Tu es un Professeur Agrégé de mathématiques et physique, expert du Baccalauréat Marocain (Maths A/B, PC, SVT) et des Concours post-bac (ENSA, APESA, FMP, UM6P).
Tu analyses des fiches de cours, devoirs surveillés, résumés ou séries d'exercices fournis en PDF ou image.
Ton objectif UNIQUE est de produire un JSON structuré représentant FIDÈLEMENT la hiérarchie exacte du document d'origine.

════════════════════════════════════════════════════════════
RÈGLE FONDAMENTALE — HIÉRARCHIE DES SECTIONS (À RESPECTER ABSOLUMENT)
════════════════════════════════════════════════════════════

Un document de cours marocain est structuré en 3 niveaux. Tu DOIS respecter cette hiérarchie dans le JSON :

  NIVEAU 1 — Grand titre (chiffres romains) : I., II., III., IV., ...
             → Met ce titre dans le champ "section_header" de CHAQUE section qui lui appartient.
             → RÉPÈTE "section_header" sur chaque élément du même chapitre (ne le laisse PAS vide).

  NIVEAU 2 — Sous-titre numéroté : 1., 2., 1.a., 1.b., ...
             → Met ce titre dans le champ "title" de la section.

  NIVEAU 3 — Bloc pédagogique : Activité, Définition, Propriété, Théorème, Remarque, Application, Exemple
             → Crée UNE section distincte par bloc pédagogique.
             → Le champ "title" DOIT commencer par l'étiquette du type entre astérisques gras :
                  "**Activité :**"  ou  "**نشاط :**"
                  "**Définition :**"  ou  "**تعريف :**"
                  "**Propriété :**"  ou  "**خاصية :**"
                  "**Théorème :**"  ou  "**مبرهنة :**"
                  "**Remarque :**"  ou  "**ملاحظة :**"
                  "**Application :**"  ou  "**تطبيق :**"
                  "**Exemple :**"  ou  "**مثال :**"
                  "**Correction :**"  ou  "**تصحيح :**"
             → Suivi du titre original s'il existe. Exemple : "**Définition :** Limite d'une suite"

════════════════════════════════════════════════════════════
EXEMPLE CONCRET DU MAPPING DOCUMENT → JSON
════════════════════════════════════════════════════════════

Document source :
  I. Généralités sur les suites numériques
    1. Définition
      Définition : Une suite numérique est une fonction u : N → R...
      Remarque : Si u est définie pour n ≥ 1, on parle de suite indicée...
    2. Exemples
      Exemple : La suite définie par u_n = 2n + 1...
      Application : Calculer u_5...

JSON attendu (3 sections distinctes) :
  { "section_header": "I. Généralités sur les suites numériques", "title": "1. Définition", ... }
  { "section_header": "I. Généralités sur les suites numériques", "title": "**Définition :** Suite numérique", "items": [{ "text": "**Définition :** Une suite numérique est une fonction $u : \\\\mathbb{N} \\\\to \\\\mathbb{R}$..." }] }
  { "section_header": "I. Généralités sur les suites numériques", "title": "**Remarque :** Suite indicée à partir de 1", "items": [{ "text": "**Remarque :** Si $u$ est définie pour $n \\\\geq 1$, on parle de suite indicée..." }] }
  { "section_header": "I. Généralités sur les suites numériques", "title": "2. Exemples", ... }
  { "section_header": "I. Généralités sur les suites numériques", "title": "**Exemple :** Suite $u_n = 2n+1$", "items": [{ "text": "**Exemple :** La suite définie par $u_n = 2n + 1$..." }] }
  { "section_header": "I. Généralités sur les suites numériques", "title": "**Application :** Calcul de $u_5$", "items": [{ "text": "**Application :** Calculer $u_5$..." }] }

════════════════════════════════════════════════════════════
EXIGENCES COMPLÉMENTAIRES
════════════════════════════════════════════════════════════

1. TERMINOLOGIE ET NOTATIONS MAROCAINES :
   - Respecte scrupuleusement les manuels officiels marocains ("Al Moufid", "Fi Rihab").
   - Notations standard : $\\\\mathbb{R}^*$, $\\\\mathbb{R}_+$, intervalles explicites.
   - Limites : $\\\\lim_{x \\\\to 0^+}$ — jamais de DL (hors-programme au Bac marocain).

2. LATEX PARFAIT :
   - Formules en ligne : $...$ — formules en bloc : $$...$$
   - Double tous les backslashes dans les chaînes JSON : \\\\frac, \\\\lim, \\\\mathbb{N}

3. SOLUTIONS DÉTAILLÉES (si mode résolution activé) :
   - Chaque étape sur une ligne distincte. Connecteurs : "On a :", "D'où", "Par conséquent".
   - Justifie chaque limite ou dérivation utilisée.

4. DEVOIRS SURVEILLÉS — si doc_type = 'homework' :
   - Chaque question sur une ligne distincte avec son barème : "(1,5 pts) Question..."
   - titre uniquement : "Exercice N° X" ou "تمرين X"

5. FORMAT STRICT :
   - Retourne UNIQUEMENT le JSON brut. Aucun texte avant ou après. Aucun bloc \`\`\`json.

════════════════════════════════════════════════════════════
SCHÉMA JSON OBLIGATOIRE
════════════════════════════════════════════════════════════

{
  "header": {
    "prep_title": "Titre général (ex: Préparation aux concours)",
    "schools": ["ENSA", "UM6P"],
    "subject": "Matière (ex: Algèbre)",
    "fiche_title": "Titre de la fiche (ex: Fiche 01 : Suites numériques)",
    "teacher": "Nom du professeur si présent",
    "phone": "Téléphone si présent",
    "doc_type": "'course' | 'homework' | 'exercises' | 'concours'"
  },
  "sections": [
    {
      "id": "sec-1",
      "section_header": "I. Généralités sur les suites numériques",
      "title": "1. Définition",
      "type": "content",
      "section_number": "1",
      "accent_text": "",
      "items": [
        { "type": "text", "text": "Contenu du paragraphe introductif..." }
      ]
    },
    {
      "id": "sec-2",
      "section_header": "I. Généralités sur les suites numériques",
      "title": "**Définition :** Suite numérique",
      "type": "content",
      "section_number": "1.1",
      "accent_text": "",
      "items": [
        { "type": "highlight_box", "text": "**Définition :** Une suite numérique est une application $u : \\\\mathbb{N} \\\\to \\\\mathbb{R}$, $n \\\\mapsto u_n$." }
      ]
    },
    {
      "id": "sec-3",
      "section_header": "I. Généralités sur les suites numériques",
      "title": "**Remarque :** Suite indicée à partir de 1",
      "type": "content",
      "section_number": "1.2",
      "accent_text": "",
      "items": [
        { "type": "text", "text": "**Remarque :** Si $u$ est définie pour $n \\\\geq 1$, on parle de suite indicée à partir de 1." }
      ]
    },
    {
      "id": "ex-1",
      "section_header": "II. Exercices d'application",
      "title": "Exercice N° 1",
      "type": "exercise",
      "section_number": "1",
      "content": "Énoncé complet de l'exercice avec formules LaTeX.",
      "solution": "Solution détaillée étape par étape.",
      "interactive_answers": [
        { "question_idx": 1, "label": "u_1 =", "expected_answer": "3" }
      ]
    }
  ]
}
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

const normalizeLevel = (rawLevel) => {
  if (!rawLevel) return '2bac_pc_svt';
  const normalized = rawLevel.toLowerCase().trim();
  
  if (normalized.includes('common_core_sci') || normalized.includes('common-core-sci')) return 'common_core_sci';
  if (normalized.includes('common_core_arts') || normalized.includes('common-core-arts')) return 'common_core_arts';
  if (normalized.includes('1bac_sci') || normalized.includes('1bac-sci')) return '1bac_sci';
  if (normalized.includes('1bac_arts') || normalized.includes('1bac-arts')) return '1bac_arts';
  if (normalized.includes('2bac_sm') || normalized.includes('2bac-sm')) return '2bac_sm';
  if (normalized.includes('2bac_pc_svt') || normalized.includes('2bac-pc-svt') || normalized.includes('2bac_pc/svt')) return '2bac_pc_svt';
  if (normalized.includes('2bac_arts') || normalized.includes('2bac-arts')) return '2bac_arts';

  if (normalized.includes('sm') || normalized.includes('math') || normalized.includes('رياضية')) {
    return '2bac_sm';
  }
  if (normalized.includes('pc') || normalized.includes('svt') || normalized.includes('تجريبية')) {
    return '2bac_pc_svt';
  }
  if (normalized.includes('2bac') || normalized.includes('ثانية باك')) {
    if (normalized.includes('letter') || normalized.includes('art') || normalized.includes('آداب') || normalized.includes('إنسانية')) {
      return '2bac_arts';
    }
    return '2bac_pc_svt';
  }
  if (normalized.includes('1bac') || normalized.includes('أولى باك') || normalized.includes('1ère bac') || normalized.includes('première bac')) {
    if (normalized.includes('letter') || normalized.includes('art') || normalized.includes('آداب') || normalized.includes('إنسانية')) {
      return '1bac_arts';
    }
    return '1bac_sci';
  }
  if (normalized.includes('commun') || normalized.includes('tc') || normalized.includes('مشترك')) {
    if (normalized.includes('letter') || normalized.includes('art') || normalized.includes('آداب') || normalized.includes('إنسانية')) {
      return 'common_core_arts';
    }
    return 'common_core_sci';
  }
  
  const validKeys = ['common_core_sci', 'common_core_arts', '1bac_sci', '1bac_arts', '2bac_sm', '2bac_pc_svt', '2bac_arts'];
  if (validKeys.includes(rawLevel)) {
    return rawLevel;
  }
  
  return '2bac_pc_svt';
};

export default function AdminLessonsImport() {
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

  const [deepseekKey, setDeepseekKey] = useState(() => localStorage.getItem('deepseekApiKey') || '');
  const [deepseekUrl, setDeepseekUrl] = useState(() => localStorage.getItem('deepseekApiUrl') || 'https://api.deepseek.com');
  const [deepseekModel, setDeepseekModel] = useState(() => localStorage.getItem('deepseekModel') || 'deepseek-chat');
  
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
      setDeepseekModel(localStorage.getItem('deepseekModel') || 'deepseek-chat');
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
              text: "Transcris et extrais l'intégralité absolue de ce document. Analyse chaque paragraphe, formule et exercice. Ne résume rien, ne laisse aucun élément de côté, et génère le JSON complet selon le schéma exigé."
            }
          ]
        }
      ],
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }]
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

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: claudeModel,
        max_tokens: 16000,
        stream: true,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            sourceBlock,
            { type: 'text', text: "Transcris et extrais l'intégralité absolue de ce document. Analyse chaque paragraphe, formule et exercice. Ne résume rien, ne laisse aucun élément de côté, et génère le JSON complet selon le schéma exigé." }
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
    const modelToUse = deepseekModel || 'deepseek-chat';
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

Transcris et extrais l'intégralité absolue de ce texte. Analyse chaque paragraphe, formule et exercice. Ne résume rien, ne laisse aucun élément de côté, et génère le JSON complet selon le schéma exigé.`
      : `TEXTE DU DOCUMENT :
${pdfText}

Extrais et structure FIDÈLEMENT tout le contenu. N'oublie aucun titre, définition, théorème, propriété, remarque, activité ou exercice.
IMPORTANT : Laisse le champ "solution" vide ("") pour chaque exercice et "interactive_answers" comme tableau vide []. Ne résous rien.`;

    const payload = {
      model: modelToUse,
      messages: [
        { role: "system", content: systemContent },
        { role: "user",   content: userContent }
      ],
      response_format: modelToUse === 'deepseek-chat' ? { type: 'json_object' } : undefined,
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

      // Populate form state
      setFicheTitle(parsed.header.fiche_title || '');
      setSubject(parsed.header.subject || 'Algèbre');
      setPrepTitle(parsed.header.prep_title || 'Préparation aux concours');
      setTeacher(parsed.header.teacher || '');
      setPhone(parsed.header.phone || '');
      const mappedSections = (parsed.sections || []).map(sec => {
        const hasAr = /[\u0600-\u06FF]/.test((sec.title || '') + ' ' + (sec.content || '') + ' ' + (sec.solution || '') + ' ' + (sec.items || []).map(it => it.text || '').join(' '));
        return {
          ...sec,
          language: sec.language || (hasAr ? 'ar' : 'fr')
        };
      });
      setSections(mappedSections);
      setSelectedLevel(normalizeLevel(parsed.header.level));
      setDocType(parsed.header.doc_type || 'course');
      const isAr = /[\u0600-\u06FF]/.test((parsed.header.fiche_title || '') + ' ' + (parsed.header.subject || ''));
      setDocLanguage(parsed.metadata?.language || (isAr ? 'ar' : 'fr'));
      
      const numMatch = (parsed.header.fiche_title || '').match(/Fiche\s*(\d+)/i);
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
      const lessonData = {
        title: ficheTitle,
        subject,
        chapterNumber,
        teacher,
        phone,
        level: selectedLevel,
        docType: docType,
        content: {
          level: selectedLevel,
          doc_type: docType,
          metadata: {
            language: docLanguage
          },
          header: {
            prep_title: prepTitle,
            schools: [],
            subject,
            fiche_title: ficheTitle,
            teacher,
            phone
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
        <button onClick={() => navigate('/admin/lessons')} className="btn-outline" style={{ padding: '0.5rem 0.75rem' }}>
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
                  <option value="deepseek-chat">deepseek-chat (V3 - Rapide/Éco)</option>
                  <option value="deepseek-reasoner">deepseek-reasoner (R1 - Réflexion)</option>
                </select>
              ) : (
                <select
                  className="input-control"
                  value={geminiModel}
                  onChange={e => { setGeminiModel(e.target.value); localStorage.setItem('geminiModel', e.target.value); }}
                >
                  <option value="gemini-3.5-flash">Gemini 3.5 Flash (Recommandé)</option>
                  <option value="gemini-3.1-pro">Gemini 3.1 Pro (Haute précision)</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash (Legacy)</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro (Legacy)</option>
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
          
          {/* Section 1: Header metadata */}
          <div className="glass-panel" style={{ padding: '2.25rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)' }}>
            <h2 style={{ 
              fontSize: '1.3rem', 
              fontWeight: 800, 
              marginBottom: '1.75rem', 
              borderBottom: '1px solid var(--border)', 
              paddingBottom: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              color: 'var(--text-main)'
            }}>
              <span style={{ fontSize: '1.4rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}>📁</span>
              <span>Informations Générales du Document</span>
            </h2>

            <div className="dashboard-grid">
              <div className="col-span-5 input-group">
                <label style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Titre de la Fiche <span style={{ color: 'var(--text-subtle)', fontWeight: 400 }}>(ex: Fiche 01 : Arithmétique)</span></label>
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
                <select className="input-control" value={docType} onChange={e => setDocType(e.target.value)} style={{ width: '100%' }}>
                  <option value="course">درس (Cours)</option>
                  <option value="homework">فرض محروس (Devoir Surveillé)</option>
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

            <div className="dashboard-grid" style={{ marginTop: '1.5rem' }}>
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
                  <option value="common_core_sci">جدع مشترك علوم (Tronc Commun Sci)</option>
                  <option value="common_core_arts">جدع مشترك آداب (Tronc Commun Lettres)</option>
                  <option value="1bac_sci">أولى باك علوم (1ère Bac Sciences)</option>
                  <option value="1bac_arts">أولى باك آداب (1ère Bac Lettres)</option>
                  <option value="2bac_sm">ثانية باك علوم رياضية (2ème Bac Sciences Maths)</option>
                  <option value="2bac_pc_svt">ثانية باك علوم تجريبية (2ème Bac PC/SVT)</option>
                  <option value="2bac_arts">ثانية باك آداب (2ème Bac Lettres)</option>
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
                <label style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Langue du document / لغة الملف</label>
                <select 
                  className="input-control" 
                  value={docLanguage} 
                  onChange={e => setDocLanguage(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="fr">Français (الفرنسية)</option>
                  <option value="ar">Arabe (العربية)</option>
                  <option value="en">Anglais (الإنجليزية)</option>
                </select>
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
                  {/* Delete Button */}
                  <button 
                    onClick={() => handleRemoveSection(secIdx)}
                    style={{
                      position: 'absolute', top: '1.25rem', right: '1.25rem',
                      background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)',
                      border: 'none', borderRadius: '8px', padding: '0.4rem', cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={16} />
                  </button>

                  {/* Section Title */}
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '1rem', width: '100%', marginBottom: '1.25rem', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>Titre du Bloc</label>
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
                        style={{ width: '100%' }}
                      >
                        <option value="content">Théorie (Cours)</option>
                        <option value="exercise">Exercice / Corrigé</option>
                      </select>
                    </div>
                  </div>

                  {/* Section Metadata Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '80px 1.5fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
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
                  {sec.type === 'content' && (
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
    </div>
  );
}
