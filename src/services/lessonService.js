// src/services/lessonService.js
// High-performance resilient CRUD for lessons with SWR caching and direct single-lesson fetching.
// Supabase -> Local Companion API -> LocalStorage -> Seed Fallback.

import { supabase } from '../lib/supabase';
import { localDb } from '../lib/localDbClient';
import { queryCache } from './queryCache';

const STORAGE_KEY = 'lconq_lessons_db';

// Initial seed lessons if storage and remote DB are empty
const INITIAL_SEED_LESSONS = [
  {
    id: "MOCK-TC-MATH-01",
    title: "Fiche 01 : Logique Mathématique",
    subject: "Mathématiques",
    chapterNumber: "01",
    teacher: "Prof. Youssef",
    phone: "0681399067",
    schools: ["Bac BIOF"],
    level: "common_core_sci",
    docType: "course",
    isActive: true,
    createdAt: "2026-07-11T17:11:40.176Z",
    updatedAt: "2026-07-14T18:47:22.651Z",
    content: {
      level: "common_core_sci",
      doc_type: "course",
      header: {
        prep_title: "Tronc Commun Sciences",
        schools: ["Bac BIOF"],
        subject: "Mathématiques",
        fiche_title: "Fiche 01 : Logique Mathématique",
        teacher: "Prof. Youssef",
        phone: "0681399067"
      },
      sections: [
        {
          id: "sec-tc-1",
          title: "Assertions et connecteurs logiques",
          type: "definition",
          section_number: "1",
          section_header: "Résumé de cours : Logique",
          accent_text: "Définitions et propositions",
          items: [
            { type: "text", text: "Une **assertion** (ou proposition) est un énoncé mathématique qui a une valeur de vérité unique : soit **Vrai (V)** soit **Faux (F)**." },
            { type: "highlight_box", text: "L'implication $P \\Rightarrow Q$ est fausse uniquement dans le cas où $P$ est vraie et $Q$ est fausse. Elle est équivalente à $(\\text{non } P) \\text{ ou } Q$." },
            { type: "bullet", text: "La conjonction $P \\text{ et } Q$ est vraie si et seulement si les deux assertions sont vraies simultanément." }
          ],
          language: "fr"
        },
        {
          id: "ex-tc-1",
          title: "Exercice 1 : Négation de propositions",
          type: "exercise",
          section_number: "2",
          section_header: "Exercices d'application",
          content: "Écrire la négation mathématique de la proposition suivante :\n$$P: (\\forall x \\in \\mathbb{R})(\\exists y \\in \\mathbb{R}) : x + y > 0$$",
          solution: "Pour trouver la négation d'une proposition quantifiée, on inverse les quantificateurs et on prend la négation de l'assertion finale :\n\n- Le $\\forall x$ devient $\\exists x$\n- Le $\\exists y$ devient $\\forall y$\n- L'inégalité strict $>$ devient $\\le$\n\nAinsi, la négation est :\n$$\\text{non } P: (\\exists x \\in \\mathbb{R})(\\forall y \\in \\mathbb{R}) : x + y \\le 0$$",
          interactive_answers: [
            { question_idx: 1, label: "Entrez le symbole final de comparaison de la négation (<= ou >=) :", expected_answer: "<=" }
          ],
          language: "fr"
        }
      ],
      metadata: { language: "fr" }
    }
  },
  {
    id: "MOCK-L-TKF6NKSTI",
    title: "Barycentre",
    subject: "Mathématiques",
    chapterNumber: "",
    teacher: "Pr. LATRACH ABDELKBIR",
    phone: "",
    schools: [],
    level: "1bac_sci",
    docType: "course",
    isActive: true,
    createdAt: "2026-07-12T10:00:00.000Z",
    updatedAt: "2026-07-14T18:47:22.651Z",
    content: {
      level: "1bac_sci",
      doc_type: "course",
      header: {
        prep_title: "1ère Bac Sciences",
        schools: [],
        subject: "Mathématiques",
        fiche_title: "Barycentre",
        teacher: "Pr. LATRACH ABDELKBIR",
        phone: ""
      },
      sections: [],
      metadata: { language: "fr" }
    }
  }
];

// Helper to read from LocalStorage
const getLocalStorageLessons = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch (e) {
    return null;
  }
};

// Helper to write to LocalStorage
const saveLocalStorageLessons = (lessons) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lessons));
  } catch (e) {
    console.warn('[LocalStorage] Failed to save lessons:', e);
  }
};

// Helper to map lesson fields to DB columns
const mapLessonToDB = (l) => ({
  title: l.title,
  subject: l.subject,
  chapter_number: l.chapterNumber || l.chapter_number || null,
  teacher: l.teacher || null,
  phone: l.phone || null,
  schools: l.schools || [],
  content: {
    ...(l.content || {}),
    level: l.level || l.content?.level || null,
    doc_type: l.docType || l.content?.doc_type || 'course'
  },
  is_active: l.isActive !== undefined ? l.isActive : true,
  updated_at: new Date().toISOString(),
});

// Helper to map DB columns to lesson fields
const mapDBToLesson = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    chapterNumber: row.chapter_number !== undefined ? row.chapter_number : row.chapterNumber,
    teacher: row.teacher,
    phone: row.phone,
    schools: row.schools || [],
    content: row.content || {},
    level: row.level || row.content?.level || null,
    docType: row.docType || row.content?.doc_type || 'course',
    isActive: row.is_active !== undefined ? row.is_active : (row.isActive !== undefined ? row.isActive : true),
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
  };
};

// ─── Read (Optimized with SWR & Direct Single Fetch) ──────────────────────────

/**
 * Fetch ALL lessons with SWR caching and fail-proof fallback sequence.
 */
export const getAllLessons = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('lessons_all', async () => {
    // 1. Try Supabase if configured
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('lessons')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          const mapped = data.map(mapDBToLesson);
          saveLocalStorageLessons(mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('[Supabase] Failed to fetch lessons, trying fallback:', err);
      }
    }

    // 2. Try Local Companion DB API (port 5002)
    try {
      const data = await localDb.get('/lessons');
      if (Array.isArray(data) && data.length > 0) {
        const mapped = data.map(mapDBToLesson);
        saveLocalStorageLessons(mapped);
        return mapped;
      }
    } catch (err) {
      console.warn('[LocalDB] Companion server offline or unreachable, using local storage backup.');
    }

    // 3. Try LocalStorage backup
    const localCache = getLocalStorageLessons();
    if (localCache && localCache.length > 0) {
      return localCache.map(mapDBToLesson);
    }

    // 4. Default Seed Fallback
    saveLocalStorageLessons(INITIAL_SEED_LESSONS);
    return INITIAL_SEED_LESSONS.map(mapDBToLesson);
  }, {
    forceRefresh,
    staleTime: 1000 * 60 * 3, // 3 mins fresh
    cacheTime: 1000 * 60 * 30
  });
};

/**
 * Fetch only active lessons (student view).
 */
export const getActiveLessons = async (options = {}) => {
  const allLessons = await getAllLessons(options);
  return allLessons.filter(l => l.isActive === true);
};

/**
 * Fetch a single lesson by ID (Direct Single Lookup + Cached).
 */
export const getLessonById = async (lessonId, options = {}) => {
  if (!lessonId) return null;
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache(`lesson_detail_${lessonId}`, async () => {
    // 1. Try direct Supabase single query
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('lessons')
          .select('*')
          .eq('id', lessonId)
          .maybeSingle();

        if (!error && data) {
          return mapDBToLesson(data);
        }
      } catch (err) {
        console.warn(`[Supabase] Failed to fetch single lesson ${lessonId}:`, err);
      }
    }

    // 2. Try Companion API
    try {
      const data = await localDb.get(`/lessons/${lessonId}`);
      if (data) return mapDBToLesson(data);
    } catch {}

    // 3. Fallback to cached list
    const allLessons = await getAllLessons();
    const found = allLessons.find(l => l.id === lessonId);
    return found || null;
  }, {
    forceRefresh,
    staleTime: 1000 * 60 * 5,
    cacheTime: 1000 * 60 * 60
  });
};

// ─── Write (With Automatic Cache Invalidation) ─────────────────────────────────

/**
 * Add a new lesson.
 */
export const addLesson = async (lessonData) => {
  const id = lessonData.id || 'MOCK-L-' + Math.random().toString(36).substring(2, 11).toUpperCase();
  const now = new Date().toISOString();
  
  const mapped = {
    id,
    title: lessonData.title,
    subject: lessonData.subject,
    chapterNumber: lessonData.chapterNumber || lessonData.chapter_number || '',
    teacher: lessonData.teacher || '',
    phone: lessonData.phone || '',
    schools: lessonData.schools || [],
    content: {
      ...(lessonData.content || {}),
      level: lessonData.level || lessonData.content?.level || null,
      doc_type: lessonData.docType || lessonData.content?.doc_type || 'course'
    },
    level: lessonData.level || lessonData.content?.level || null,
    docType: lessonData.docType || lessonData.content?.doc_type || 'course',
    isActive: lessonData.isActive !== undefined ? lessonData.isActive : true,
    createdAt: now,
    updatedAt: now
  };

  // 1. Invalidate SWR cache immediately
  queryCache.invalidate('lessons_all');
  queryCache.set(`lesson_detail_${id}`, mapped);

  // 2. Save to LocalStorage cache immediately
  const currentLessons = (await getAllLessons()).filter(l => l.id !== id);
  currentLessons.unshift(mapped);
  saveLocalStorageLessons(currentLessons);

  // 3. Push to Local Companion API if available
  const dbLesson = {
    id,
    ...mapLessonToDB(lessonData),
    created_at: now
  };

  try {
    await localDb.post('/lessons', dbLesson);
  } catch (err) {
    console.warn('[LocalDB] Could not sync addLesson to Companion server:', err.message);
  }

  // 4. Push to Supabase if configured
  if (supabase) {
    try {
      await supabase.from('lessons').insert(dbLesson);
    } catch (err) {
      console.warn('[Supabase] Could not sync addLesson to Supabase:', err.message);
    }
  }

  return id;
};

/**
 * Update dynamic fields of a lesson.
 */
export const updateLesson = async (lessonId, updates) => {
  const now = new Date().toISOString();
  
  // Invalidate SWR caches
  queryCache.invalidate('lessons_all');
  queryCache.invalidate(`lesson_detail_${lessonId}`);

  // 1. Update LocalStorage cache immediately
  const currentLessons = await getAllLessons();
  const idx = currentLessons.findIndex(l => l.id === lessonId);
  if (idx !== -1) {
    const original = currentLessons[idx];
    const updated = {
      ...original,
      ...updates,
      content: {
        ...(original.content || {}),
        ...(updates.content || {}),
        level: updates.level || updates.content?.level || original.level,
        doc_type: updates.docType || updates.content?.doc_type || original.docType
      },
      level: updates.level || updates.content?.level || original.level,
      docType: updates.docType || updates.content?.doc_type || original.docType,
      updatedAt: now
    };
    currentLessons[idx] = updated;
    saveLocalStorageLessons(currentLessons);
  }

  // 2. Prepare DB update payload
  const dbUpdates = {};
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.subject !== undefined) dbUpdates.subject = updates.subject;
  if (updates.chapterNumber !== undefined) dbUpdates.chapter_number = updates.chapterNumber;
  if (updates.teacher !== undefined) dbUpdates.teacher = updates.teacher;
  if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
  if (updates.schools !== undefined) dbUpdates.schools = updates.schools;
  if (updates.content !== undefined || updates.level !== undefined || updates.docType !== undefined) {
    dbUpdates.content = {
      ...(updates.content || {}),
      level: updates.level || updates.content?.level || null,
      doc_type: updates.docType || updates.content?.doc_type || null
    };
  }
  if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
  dbUpdates.updated_at = now;

  // 3. Sync to Local Companion API
  try {
    const localLessons = await localDb.get('/lessons');
    const lIdx = localLessons.findIndex(l => l.id === lessonId);
    if (lIdx !== -1) {
      const orig = localLessons[lIdx];
      const merged = {
        ...orig,
        ...dbUpdates,
        content: { ...(orig.content || {}), ...(dbUpdates.content || {}) }
      };
      await localDb.post('/lessons', merged);
    }
  } catch (err) {
    console.warn('[LocalDB] Could not sync updateLesson to Companion server:', err.message);
  }

  // 4. Sync to Supabase
  if (supabase) {
    try {
      await supabase.from('lessons').update(dbUpdates).eq('id', lessonId);
    } catch (err) {
      console.warn('[Supabase] Could not sync updateLesson to Supabase:', err.message);
    }
  }
};

/**
 * Toggle active status of a lesson.
 */
export const toggleLessonStatus = async (lessonId, currentStatus) => {
  return updateLesson(lessonId, { isActive: !currentStatus });
};

/**
 * Permanently delete a lesson.
 */
export const deleteLesson = async (lessonId) => {
  queryCache.invalidate('lessons_all');
  queryCache.invalidate(`lesson_detail_${lessonId}`);

  // 1. Remove from LocalStorage cache immediately
  const currentLessons = await getAllLessons();
  const filtered = currentLessons.filter(l => l.id !== lessonId);
  saveLocalStorageLessons(filtered);

  // 2. Sync delete to Companion server
  try {
    await localDb.delete('/lessons', lessonId);
  } catch (err) {
    console.warn('[LocalDB] Could not sync deleteLesson to Companion server:', err.message);
  }

  // 3. Sync delete to Supabase
  if (supabase) {
    try {
      await supabase.from('lessons').delete().eq('id', lessonId);
    } catch (err) {
      console.warn('[Supabase] Could not sync deleteLesson to Supabase:', err.message);
    }
  }
};
