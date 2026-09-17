// api/extraction-tasks.js
// Dedicated Vercel Serverless Function & Cloud Task Queue for Lesson Extraction
// Connects directly to Neon PostgreSQL (public.extraction_tasks)
import { neon } from '@neondatabase/serverless';

export const config = {
  maxDuration: 60,
};

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://lconq.ma,https://www.lconq.ma')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '';
  const isAllowed =
    ALLOWED_ORIGINS.includes(origin) ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:') ||
    origin.endsWith('.vercel.app');

  const allowed = isAllowed ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', allowed || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
}

let _sql = null;
function getSql() {
  if (_sql) return _sql;
  const databaseUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('NEON_DATABASE_URL is not configured on server');
  _sql = neon(databaseUrl);
  return _sql;
}

// ── Moroccan Curriculum System Prompt ─────────────────────────────────────────
const SYSTEM_PROMPT = `Tu es un Professeur Agrégé de mathématiques et Inspecteur Pédagogique, expert en manuels scolaires marocains (niveaux Tronc Commun, 1ère Bac, 2ème Bac — filières SM, PC/SVT, Arts, SGC).
Tu analyses des fiches de cours, chapitres de manuel, séries d'exercices, devoirs surveillés ou épreuves d'examen fournis en PDF ou image.
Ton objectif UNIQUE est de produire un JSON structuré représentant FIDÈLEMENT, INTÉGRALEMENT et INTELLIGEMMENT le contenu pédagogique du document.

Directives absolues :
1. DÉTECTION DU NIVEAU ("header.detected_level") : "common_core_sci", "common_core_arts", "1bac_sci", "1bac_arts", "2bac_sm", "2bac_pc_svt", "2bac_arts".
2. DÉTECTION DU TYPE ("header.doc_type") : "course", "exercises", "homework", "summary", "national", "concours".
3. CONSERVATION DE LA LANGUE : si en arabe -> extraire en arabe. Si en français -> extraire en français.
4. SYNTAXE LATEX : tout symbole mathématique DOIT être encadré par $...$ ou $$...$$. Ne pas utiliser \\cline, utiliser \\hline.
5. EXHAUSTIVITÉ ABSOLUE : extraire l'intégralité des sections, définitions, théorèmes et exercices sans rien omettre.`;

const MOROCCAN_SOLVE_ADDENDUM = `
🎯 RÈGLES DE RÉSOLUTION OFFICIELLES (INSPECTEUR PÉDAGOGIQUE MAROCAIN) :
Pour chaque exercice dans le champ "solution", fournis un corrigé mathématique rigoureux respectant le programme officiel marocain. Pas de règle de L'Hôpital.`;

const NO_SOLUTION_ADDENDUM = `
⚠️ INSTRUCTION EXTRACTION SANS RÉSOLUTION :
Laisse le champ "solution" vide ("") et "interactive_answers" comme tableau vide []. Ne résous rien.`;

function buildExtractionUserPrompt(pageCount, solveSolutions, preExtractedPdfText = '') {
  const pageNote = pageCount && pageCount > 1
    ? `⚠️ CE DOCUMENT COMPORTE ${pageCount} PAGES. Tu DOIS IMPÉRATIVEMENT extraire l'intégralité de CHAQUE page de 1 à ${pageCount}.`
    : `⚠️ Tu DOIS IMPÉRATIVEMENT extraire l'intégralité absolue du document du début à la fin.`;

  const textFusion = preExtractedPdfText && preExtractedPdfText.trim()
    ? `\n\n📄 TEXTE BRUT DU PDF :\n"""\n${preExtractedPdfText.trim()}\n"""\n`
    : '';

  return `${pageNote}
${textFusion}
Extrais tout le document et retourne un JSON avec la structure :
{
  "header": {
    "fiche_title": "Titre du document",
    "subject": "Mathématiques",
    "detected_level": "2bac_pc_svt",
    "doc_type": "course"
  },
  "sections": [
    {
      "id": "sec-1",
      "title": "Titre section / Exercice",
      "type": "content" ou "exercise",
      "content": "Texte complet en LaTeX...",
      "items": [{"type": "text", "text": "..."}],
      "solution": ""
    }
  ]
}`;
}

// Resilient JSON parser
function parseJsonWithResilience(rawText) {
  let clean = rawText.trim();
  if (clean.includes('</think>')) clean = clean.split('</think>').pop().trim();
  if (clean.startsWith('```json')) clean = clean.slice(7);
  else if (clean.startsWith('```')) clean = clean.slice(3);
  if (clean.endsWith('```')) clean = clean.slice(0, -3);
  clean = clean.trim();

  try {
    return JSON.parse(clean);
  } catch (_) {
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(clean.substring(firstBrace, lastBrace + 1));
    }
    throw new Error("Impossible de parser le JSON retourné par l'IA.");
  }
}

// Serverless extraction execution using Gemini
async function executeGeminiExtraction({ base64Data, fileType, pageCount, apiKey, model, solveSolutions, preExtractedPdfText }) {
  const isPdf = (fileType && fileType.includes('pdf'));
  const safeMime = isPdf ? 'application/pdf' : (fileType && fileType.includes('/') ? fileType : 'image/jpeg');

  const systemContent = solveSolutions
    ? SYSTEM_PROMPT + MOROCCAN_SOLVE_ADDENDUM
    : SYSTEM_PROMPT + NO_SOLUTION_ADDENDUM;

  const userText = buildExtractionUserPrompt(pageCount, solveSolutions, preExtractedPdfText);

  let userPref = (model || '').trim();
  if (userPref === '3.7' || userPref === 'gemini-3.7') userPref = 'gemini-2.5-flash';
  if (userPref === '3.5' || userPref === 'gemini-3.5') userPref = 'gemini-2.5-flash';
  const defaultCascade = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
  const cascade = Array.from(new Set([userPref, ...defaultCascade].filter(Boolean)));

  let lastErr = null;
  for (const modelToUse of cascade) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            parts: [
              ...(base64Data ? [{
                inlineData: {
                  mimeType: safeMime,
                  data: base64Data
                }
              }] : []),
              { text: userText }
            ]
          }
        ],
        systemInstruction: { parts: [{ text: systemContent }] },
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
        throw new Error(err?.error?.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const candidate = data?.candidates?.[0];
      const nonThoughtParts = candidate?.content?.parts?.filter(p => !p.thought) || [];
      const textParts = (nonThoughtParts.length > 0 ? nonThoughtParts : (candidate?.content?.parts || []))
        .map(p => p.text || '')
        .join('');

      if (!textParts.trim()) throw new Error('Réponse vide.');

      const parsed = parseJsonWithResilience(textParts);
      return { parsed, usedModel: modelToUse };
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error("Tous les modèles ont échoué.");
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  let sql;
  try {
    sql = getSql();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const id = url.searchParams.get('id') || (req.body && req.body.id) || null;
  const action = url.searchParams.get('action') || (req.body && req.body.action) || null;

  // ── 1. GET Requests ─────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    if (action === 'ping') {
      return res.status(200).json({ status: 'online', mode: 'server' });
    }

    if (id) {
      try {
        const rows = await sql.query(
          `SELECT 
             id, file_name, file_type, page_count, provider, model, status, 
             progress_percent, progress_message, attempts, max_attempts, 
             error_message, header_summary, result_json, 
             created_at, updated_at, completed_at 
           FROM public.extraction_tasks 
           WHERE id = $1`,
          [id]
        );

        if (!rows || rows.length === 0) {
          return res.status(404).json({ error: 'Tâche introuvable' });
        }

        const row = rows[0];
        return res.status(200).json({
          id: row.id,
          fileName: row.file_name,
          fileType: row.file_type,
          pageCount: row.page_count,
          provider: row.provider,
          model: row.model,
          status: row.status,
          progressPercent: row.progress_percent,
          progressMessage: row.progress_message,
          attempts: row.attempts,
          maxAttempts: row.max_attempts,
          error: row.error_message,
          headerSummary: row.header_summary,
          result: row.result_json,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          completedAt: row.completed_at
        });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // List all tasks (newest first)
    try {
      const rows = await sql.query(
        `SELECT 
           id, file_name, file_type, page_count, provider, model, status, 
           progress_percent, progress_message, attempts, max_attempts, 
           error_message, header_summary, 
           (result_json IS NOT NULL) AS has_result,
           created_at, updated_at, completed_at 
         FROM public.extraction_tasks 
         ORDER BY created_at DESC 
         LIMIT 100`
      );

      const tasks = (rows || []).map(row => ({
        id: row.id,
        fileName: row.file_name,
        fileType: row.file_type,
        pageCount: row.page_count,
        provider: row.provider,
        model: row.model,
        status: row.status,
        progressPercent: row.progress_percent,
        progressMessage: row.progress_message,
        attempts: row.attempts,
        maxAttempts: row.max_attempts,
        error: row.error_message,
        headerSummary: row.header_summary,
        hasResult: Boolean(row.has_result),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        completedAt: row.completed_at
      }));

      return res.status(200).json(tasks);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── 2. POST Requests (Create or Retry) ──────────────────────────────────────
  if (req.method === 'POST') {
    const body = req.body || {};

    // (A) Retry
    if (action === 'retry') {
      const targetId = id || body.id;
      if (!targetId) return res.status(400).json({ error: 'ID manquant' });

      try {
        await sql.query(
          `UPDATE public.extraction_tasks 
           SET status = 'pending', attempts = 0, progress_percent = 0, 
               progress_message = 'Nouvelle tentative programmée...', 
               error_message = NULL, updated_at = NOW() 
           WHERE id = $1`,
          [targetId]
        );
        return res.status(200).json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // (B) Create New Task
    const taskId = `TASK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const fileName = body.fileName || 'document.pdf';
    const fileType = body.fileType || 'application/pdf';
    const pageCount = body.pageCount || 1;
    const provider = body.provider || 'gemini';
    const model = body.model || '';
    const apiKey = body.apiKey || process.env.GEMINI_API_KEY || '';

    try {
      await sql.query(
        `INSERT INTO public.extraction_tasks (
           id, file_name, file_type, page_count, provider, model, status, 
           progress_percent, progress_message, attempts, max_attempts, 
           created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, 'processing', 15, 
           'Extraction en cours sur le serveur...', 1, 3, NOW(), NOW()
         )`,
        [taskId, fileName, fileType, pageCount, provider, model]
      );

      // Execute extraction if data and key are available
      if (apiKey && (body.base64Data || body.preExtractedPdfText)) {
        try {
          const { parsed, usedModel } = await executeGeminiExtraction({
            base64Data: body.base64Data,
            fileType,
            pageCount,
            apiKey,
            model,
            solveSolutions: body.solveSolutions !== false,
            preExtractedPdfText: body.preExtractedPdfText
          });

          const header = parsed?.header || {};
          const sections = parsed?.sections || parsed?.items || [];
          const headerSummary = {
            ficheTitle: header.fiche_title || header.title || fileName,
            subject: header.subject || 'Mathématiques',
            detectedLevel: header.detected_level || '2bac_pc_svt',
            docType: header.doc_type || 'course',
            sectionsCount: sections.length,
            extractedWithModel: usedModel
          };

          await sql.query(
            `UPDATE public.extraction_tasks 
             SET status = 'completed', progress_percent = 100, 
                 progress_message = 'Fiche extraite avec succès !', 
                 result_json = $1, header_summary = $2, 
                 completed_at = NOW(), updated_at = NOW() 
             WHERE id = $3`,
            [JSON.stringify(parsed), JSON.stringify(headerSummary), taskId]
          );

          return res.status(201).json({
            success: true,
            task: {
              id: taskId,
              fileName,
              status: 'completed',
              progressPercent: 100,
              headerSummary,
              hasResult: true
            }
          });
        } catch (extractErr) {
          console.error('[Extraction Error]:', extractErr);
          await sql.query(
            `UPDATE public.extraction_tasks 
             SET status = 'failed', progress_percent = 0, 
                 error_message = $1, progress_message = 'Échec de l''extraction', 
                 updated_at = NOW() 
             WHERE id = $2`,
            [extractErr.message, taskId]
          );

          return res.status(201).json({
            success: true,
            task: {
              id: taskId,
              fileName,
              status: 'failed',
              error: extractErr.message
            }
          });
        }
      }

      // If no extraction was immediately executed, return task as pending/processing
      return res.status(201).json({
        success: true,
        task: {
          id: taskId,
          fileName,
          status: 'pending',
          progressPercent: 0,
          progressMessage: 'En attente...'
        }
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── 3. DELETE Requests ──────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    if (!id) return res.status(400).json({ error: 'ID manquant' });
    try {
      await sql.query(`DELETE FROM public.extraction_tasks WHERE id = $1`, [id]);
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
