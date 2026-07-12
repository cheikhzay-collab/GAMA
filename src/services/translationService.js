// src/services/translationService.js
// خدمة الترجمة بالذكاء الاصطناعي — تدعم Gemini و DeepSeek
// تُترجم دروس الرياضيات مع الحفاظ على LaTeX والمصطلحات المغربية الدقيقة

/**
 * قاموس المصطلحات الرياضية المغربية (فرنسي → عربي)
 */
const MOROCCAN_MATH_GLOSSARY = `
=== قاموس مصطلحات الرياضيات المغربية (يجب الالتزام بها) ===

** المتتاليات (Suites) **
Suite numérique → متتالية عددية
Suite arithmétique → متتالية حسابية (حسابية وليس "عددية" أو "حسبية")
Suite géométrique → متتالية هندسية
Suite croissante → متتالية متزايدة
Suite décroissante → متتالية متناقصة
Suite monotone → متتالية رتيبة
Suite bornée → متتالية محدودة
Suite convergente → متتالية متقاربة
Suite divergente → متتالية متباعدة
Suite stationnaire → متتالية ثابتة
Raison (arithmétique) → الأساس (للمتتالية الحسابية) - يُكتب r
Raison (géométrique) → الأساس (للمتتالية الهندسية) - يُكتب q
Premier terme → الحد الأول
Terme général → الحد العام
Terme d'une suite → حد المتتالية
Limite d'une suite → نهاية متتالية
Somme des termes → مجموع الحدود
Récurrence → التراجع / بالتراجع

** التحليل والاشتقاق (Analyse / Dérivation) **
Dérivée → المشتقة
Dérivée seconde → المشتقة الثانية
Dérivabilité → القابلية للاشتقاق
Fonction dérivée → الدالة المشتقة
Taux de variation → معدل التغير / نسبة التغير
Tangente → المماس
Extremum → النهاية العظمى / النهاية الصغرى
Maximum → النهاية العظمى (الحد الأعظم)
Minimum → النهاية الصغرى (الحد الأدنى)
Tableau de variations → جدول التغيرات
Croissant / Décroissant → متزايدة / متناقصة
Fonction → دالة / دوال (جمع)
Limite d'une fonction → نهاية دالة
Continuité → الاستمرارية

** التكامل (Intégration) **
Intégrale → التكامل
Primitive → الدالة الأصلية / الدالة البدئية
Intégration par parties → التكامل بالتجزئة
Aire → المساحة

** الهندسة والأشعة (Géométrie / Vecteurs) **
Vecteur → متجه / متجهات (جمع)
Norme d'un vecteur → معامل المتجه / القيمة المطلقة للمتجه
Produit scalaire → الجداء السلمي
Plan → المستوى
Droite → مستقيم / مستقيمات (جمع)
Cercle → دائرة
Sphère → كرة

** الإحصاء والاحتمالات (Stats / Probabilités) **
Probabilité → الاحتمال
Événement → حدث / أحداث
Variable aléatoire → متغيرة عشوائية
Espérance → الأمل الرياضي
Variance → التباين
Écart-type → الانحراف المعياري
Loi binomiale → القانون ذو الحدين / القانون الثنائي
Loi normale → القانون الطبيعي

** المنطق والمجموعات (Logique / Ensembles) **
Assertion / Proposition → قضية / قضايا
Implication → استلزام
Équivalence → تكافؤ
Négation → نفي
Quantificateur universel (∀) → كمّي الكليّ (لكل)
Quantificateur existentiel (∃) → كمّي الوجود (يوجد)
Ensemble → مجموعة
Sous-ensemble → مجموعة جزئية
Intersection → التقاطع
Union → الاتحاد
Complémentaire → المتمم

** المصفوفات والأنظمة (Matrices / Systèmes) **
Matrice → مصفوفة / مصفوفات
Déterminant → المحدد
Système d'équations → جملة معادلات

** قواعد الترجمة العامة **
- "On a" → "لدينا" أو "يكون"
- "Soit" → "ليكن" / "لتكن" (حسب المؤنث والمذكر)
- "D'où" → "ومنه" / "وعليه"
- "Donc" → "إذاً" / "وبذلك"
- "Or" → "غير أن" / "بيد أن"
- "Car" → "لأن"
- "En effet" → "في الواقع" / "فعلاً"
- "Ainsi" → "هكذا" / "وهكذا"
- "tel que" → "حيث" / "بحيث"
- "si et seulement si" → "إذا وفقط إذا"
- "pour tout" → "لكل"
- "il existe" → "يوجد"
- "vérifier" → "تحقق من أن" / "التحقق"
- "montrer" / "démontrer" → "بيّن أن" / "أثبت أن"
- "calculer" → "احسب"
- "déduire" → "استنتج"
- "on pose" → "نضع"
- "Exercice" → "تمرين"
- "Solution" / "Correction" → "الحل" / "التصحيح"
- "Cours" / "Leçon" → "الدرس"
- "Définition" → "تعريف"
- "Théorème" → "مبرهنة"
- "Propriété" → "خاصية"
- "Remarque" → "ملاحظة"
- "Exemple" → "مثال"
`;

/**
 * بناء prompt الترجمة المتخصص
 */
function buildTranslationPrompt(lesson, targetLang) {
  const langName = targetLang === 'ar' ? 'العربية المغربية' : targetLang === 'en' ? 'الإنجليزية' : 'الفرنسية';
  const rtlNote = targetLang === 'ar' ? `
- النص العربي يُكتب من اليمين إلى اليسار (RTL).
- استخدم صياغة الأستاذ المغربي في تدريس الرياضيات، وليس ترجمة حرفية.
- المصطلحات الرياضية يجب أن تتطابق مع ما هو موجود في الكتاب المدرسي المغربي.
${MOROCCAN_MATH_GLOSSARY}
` : '';

  return `أنت مترجم متخصص في ترجمة الدروس والمحتوى الرياضي المغربي إلى ${langName}.

## قواعد صارمة يجب اتباعها:
1. **الحفاظ على LaTeX**: كل معادلة تبدأ بـ $ أو $$ أو \\begin تُحافظ عليها كما هي بدون أي تغيير. لا تترجم أي رموز رياضية.
2. **Markdown**: الحفاظ على تنسيق **نص غامق** و*نص مائل* كما هو.
3. **هيكل JSON**: الإخراج يجب أن يكون JSON صالح 100% بنفس هيكل الإدخال. لا تُضف تعليقات // داخل JSON.
4. **لا تُضف ولا تحذف**: لا تُضف شرحاً إضافياً، ترجم فقط.
${rtlNote}

## الدرس المطلوب ترجمته:
${JSON.stringify(lesson.content, null, 2)}

## المطلوب:
أرجع JSON كامل يمثل محتوى الدرس المترجم إلى ${langName}. 
- اترجم حقول: title, section_header, accent_text, text, content, solution, label وما شابهها.
- لا تترجم: id, type, section_number, question_idx, expected_answer, notation_columns (math_blocks), table_data.
- عنوان الدرس الرئيسي يُترجم أيضاً.

أرجع فقط JSON نقياً بدون أي نص إضافي قبله أو بعده، ابدأ مباشرة بـ { :`;
}

/**
 * استدعاء Gemini API
 */
async function callGemini(prompt, geminiKey, model = 'gemini-2.5-flash') {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 65536,
      }
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini HTTP ${response.status}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('لم يُرجع Gemini أي نص');
  return text;
}

/**
 * استدعاء DeepSeek API (متوافق مع OpenAI)
 */
async function callDeepSeek(prompt, deepseekKey, deepseekUrl, model = 'deepseek-chat') {
  const baseUrl = (deepseekUrl || 'https://api.deepseek.com').replace(/\/$/, '');
  const endpoint = `${baseUrl}/v1/chat/completions`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${deepseekKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'أنت مترجم متخصص في المحتوى الرياضي المغربي. تُرجع دائماً JSON نقياً صالحاً بدون أي تعليقات أو نص إضافي.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 32000,
      response_format: { type: 'json_object' }, // يُجبر DeepSeek على إرجاع JSON نقي
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `DeepSeek HTTP ${response.status}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('لم يُرجع DeepSeek أي نص');
  return text;
}

/**
 * تنظيف ناتج JSON (إزالة ```json ... ``` والتعليقات)
 */
function cleanJsonOutput(raw) {
  let cleaned = raw.trim();
  // إزالة code fences
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  // إزالة تعليقات // من JSON (مشكلة شائعة مع DeepSeek)
  cleaned = cleaned.replace(/\/\/[^\n\r"]*/g, '');
  return cleaned;
}

/**
 * ترجمة درس كامل بالذكاء الاصطناعي
 * @param {Object} lesson — كائن الدرس المُحمَّل من lessonService
 * @param {string} targetLang — 'ar' | 'fr' | 'en'
 * @param {Object} options — { provider, geminiKey, geminiModel, deepseekKey, deepseekUrl, deepseekModel }
 * @returns {Promise<Object>} — درس مترجم جاهز للحفظ
 */
export async function translateLesson(lesson, targetLang, options = {}) {
  const provider = options.provider || 'gemini';
  const prompt = buildTranslationPrompt(lesson, targetLang);

  let rawOutput;

  if (provider === 'deepseek') {
    const deepseekKey = options.deepseekKey || localStorage.getItem('deepseekApiKey') || '';
    const deepseekUrl = options.deepseekUrl || localStorage.getItem('deepseekApiUrl') || 'https://api.deepseek.com';
    const deepseekModel = options.deepseekModel || 'deepseek-chat';

    if (!deepseekKey) {
      throw new Error('مفتاح DeepSeek API غير موجود. أضفه في صفحة الإعدادات.');
    }
    rawOutput = await callDeepSeek(prompt, deepseekKey, deepseekUrl, deepseekModel);
  } else {
    // Gemini (افتراضي)
    const geminiKey = options.geminiKey || localStorage.getItem('geminiApiKey') || '';
    const geminiModel = options.geminiModel || localStorage.getItem('geminiModel') || 'gemini-2.5-flash';

    if (!geminiKey) {
      throw new Error('مفتاح Gemini API غير موجود. أضفه في إعدادات الاستيراد بالذكاء الاصطناعي.');
    }
    rawOutput = await callGemini(prompt, geminiKey, geminiModel);
  }

  const cleanedJson = cleanJsonOutput(rawOutput);

  let translatedContent;
  try {
    translatedContent = JSON.parse(cleanedJson);
  } catch (e) {
    console.error('[translationService] JSON parse error:', e, '\nRaw:', cleanedJson.substring(0, 500));
    throw new Error(`فشل تحليل JSON المُرجَع من ${provider === 'deepseek' ? 'DeepSeek' : 'Gemini'}. حاول مرة أخرى.`, { cause: e });
  }

  // بناء الدرس المترجم
  const langSuffix = {
    ar: '(نسخة عربية)',
    en: '(English Version)',
    fr: '(Version Française)',
  }[targetLang] || '';

  const translatedLesson = {
    ...lesson,
    id: undefined, // سيُنشأ id جديد عند الحفظ
    title: `${translatedContent?.header?.fiche_title || lesson.title} ${langSuffix}`.trim(),
    content: {
      ...translatedContent,
      metadata: {
        ...(translatedContent.metadata || {}),
        translatedFrom: lesson.id,
        translatedFromTitle: lesson.title,
        language: targetLang,
        dir: targetLang === 'ar' ? 'rtl' : 'ltr',
        translatedAt: new Date().toISOString(),
        translatedBy: provider,
      }
    },
    isActive: false,
  };

  return translatedLesson;
}

/**
 * اللغات المدعومة
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'ar', label: 'العربية', flag: '🇲🇦', dir: 'rtl' },
  { code: 'fr', label: 'Français', flag: '🇫🇷', dir: 'ltr' },
  { code: 'en', label: 'English', flag: '🇬🇧', dir: 'ltr' },
];

/**
 * مزودو الذكاء الاصطناعي للترجمة
 */
export const TRANSLATION_PROVIDERS = [
  {
    id: 'gemini',
    name: 'Gemini',
    label: 'Google Gemini',
    color: '#4285F4',
    storageKey: 'geminiApiKey',
    icon: '✦',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    label: 'DeepSeek AI',
    color: '#00BA7C',
    storageKey: 'deepseekApiKey',
    icon: '◈',
  },
];
