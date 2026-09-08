// src/utils/aiExerciseSolver.js
// Multi-Engine AI Exercise Solver (DeepSeek, Gemini, Claude)
// Honors the "Résoudre les exercices" setting from AdminSettings.jsx

export async function solveExerciseWithAI(exerciseContent, options = {}) {
  const {
    level = '2bac_pc_svt',
    subject = 'Mathématiques',
    language = 'fr',
    docTitle = '',
    customInstructions = ''
  } = options;

  if (!exerciseContent || !exerciseContent.trim()) {
    throw new Error("Veuillez d'abord rédiger l'énoncé de l'exercice avant de demander sa résolution par IA.");
  }

  // 1. Read Provider Settings & Flags
  const deepseekAllowed = localStorage.getItem('deepseek_solve_solutions') !== 'false';
  const geminiAllowed = localStorage.getItem('gemini_solve_solutions') !== 'false';
  const claudeAllowed = localStorage.getItem('claude_solve_solutions') !== 'false';

  const deepseekKey = (localStorage.getItem('deepseekApiKey') || '').trim();
  const deepseekUrl = (localStorage.getItem('deepseekApiUrl') || 'https://api.deepseek.com').trim().replace(/\/$/, '');
  const geminiKey = (localStorage.getItem('geminiApiKey') || localStorage.getItem('gemini_api_key') || '').trim();
  const claudeKey = (localStorage.getItem('claudeApiKey') || '').trim();

  // Check if all are explicitly disabled
  if (!deepseekAllowed && !geminiAllowed && !claudeAllowed) {
    throw new Error('La résolution des exercices est désactivée dans les Paramètres IA. Veuillez activer la case "Résoudre les exercices" pour au moins un fournisseur.');
  }

  // Determine candidate engines
  const availableEngines = [];
  if (deepseekAllowed && deepseekKey) availableEngines.push('deepseek');
  if (geminiAllowed && geminiKey) availableEngines.push('gemini');
  if (claudeAllowed && claudeKey) availableEngines.push('claude');

  if (availableEngines.length === 0) {
    if (!deepseekKey && !geminiKey && !claudeKey) {
      throw new Error('Aucune clé API configurée. Veuillez renseigner votre clé Gemini, DeepSeek ou Claude dans les Paramètres (Admin Settings).');
    } else {
      throw new Error('La résolution automatique des exercices est décochée pour vos fournisseurs configurés. Activez "Résoudre les exercices" dans les Paramètres IA.');
    }
  }

  const isAr = language === 'ar' || /[\u0600-\u06FF]/.test(exerciseContent);

  const systemPrompt = isAr
    ? `أنت أستاذ مبرز وخبير في مادة الرياضيات بالتعليم الثانوي التأهيلي والتحضير للباكالوريا والمباريات الوطنية في المغرب (المستوى: ${level}).
مهمتك: تقديم حل مفصل، نموذجي، ودقيق رياضياً للتمرين المعطى.

قواعد الصياغة والإخراج:
1. اتبع بدقة ترقيم وتقسيم أسئلة التمرين (1., 2. أ), 2. ب), 3., ...).
2. اكتب جميع الصيغ والرموز الرياضية بصيغة LaTeX واضحة ونظيفة: استخدم $...$ للصيغ في نفس السطر و $$...$$ للصيغ المستقلة المركزية.
3. وضّح جميع مراحل الحساب والتعليلات الرياضية اللازمة (مبرهنة القيم الوسيطية، النهايات الاعتيادية، قواعد الاشتقاق، المكاملة بالأجزاء، التأطير، جداول الإشارة والتغيرات).
4. أبرز النتائج النهائية بوضوح (مثال: \\boxed{...} أو "الخلاصة : ...").
5. ابدأ مباشرة بحل السؤال الأول دون أي مقدمات أو تحيات ("إليك الحل...").`
    : `Tu es un Professeur Agrégé de Mathématiques, spécialiste de l'enseignement secondaire qualifiant marocain, du Baccalauréat et de la préparation aux concours d'accès (Niveau: ${level}).
Ta mission : Rédiger un corrigé officiel, rigoureux, pédagogique et complet de l'exercice fourni.

Règles impératives de rédaction :
1. Respecte scrupuleusement la numérotation des questions de l'énoncé (ex: 1., 2.a., 2.b., 3., etc.).
2. Écris TOUTES les expressions mathématiques en syntaxe KaTeX/LaTeX irréprochable : utilise $...$ pour les expressions en ligne et $$...$$ pour les équations centrées.
3. Détaille chaque étape de calcul avec toutes les justifications nécessaires (théorème des valeurs intermédiaires, limites usuelles, dérivabilité, intégration par parties, encadrements, etc.).
4. Mets en valeur les résultats finaux avec des conclusions nettes (ex: \\boxed{...} ou "Conclusion : ...").
5. Ne mets aucun texte d'introduction ni de salutation, commence DIRECTEMENT par la résolution de la première question.`;

  const userPrompt = `Énoncé de l'exercice (${subject} - ${docTitle || 'Exercice'}) :\n\n${exerciseContent.trim()}\n\n${customInstructions ? `Instructions supplémentaires : ${customInstructions}\n\n` : ''}Rédige maintenant le corrigé complet et détaillé :`;

  let lastError = null;

  // ── Engine 1: DeepSeek (Top choice for math reasoning) ──
  if (availableEngines.includes('deepseek')) {
    try {
      const endpoint = `${deepseekUrl}/v1/chat/completions`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deepseekKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.15,
          max_tokens: 8000
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `Erreur DeepSeek HTTP ${response.status}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content && content.trim()) {
        return content.trim();
      }
    } catch (err) {
      console.warn('[AI Solver] DeepSeek solver failed, attempting fallback...', err.message);
      lastError = err;
    }
  }

  // ── Engine 2: Google Gemini ──
  if (availableEngines.includes('gemini')) {
    const storedModel = localStorage.getItem('geminiModel');
    const preferredModel = (!storedModel || storedModel === 'gemini-2.5-flash') ? 'gemini-3.6-flash' : storedModel;
    const modelsToTry = [preferredModel, 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    const uniqueModels = Array.from(new Set(modelsToTry));

    for (const model of uniqueModels) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: userPrompt }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
              temperature: 0.15,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 8192
            }
          })
        });

        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}));
          throw new Error(errJson?.error?.message || `Erreur Gemini HTTP ${response.status}`);
        }

        const data = await response.json();
        const candidate = data?.candidates?.[0];
        const nonThoughtParts = candidate?.content?.parts?.filter(p => !p.thought) || [];
        const generatedText = (nonThoughtParts.length > 0 ? nonThoughtParts : (candidate?.content?.parts || []))
          .map(p => p.text || '')
          .join('');

        if (generatedText && generatedText.trim()) {
          return generatedText.trim();
        }
      } catch (err) {
        console.warn(`[AI Solver] Gemini model ${model} failed:`, err.message);
        lastError = err;
      }
    }
  }

  throw lastError || new Error('Impossible de résoudre l’exercice avec l’IA. Vérifiez votre connexion et vos clés API.');
}
