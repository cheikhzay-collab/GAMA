// src/services/lessonService.js
// Supabase CRUD for lessons with a complete local localStorage fallback for local development.

import { supabase } from '../lib/supabase';

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
    chapterNumber: row.chapter_number,
    teacher: row.teacher,
    phone: row.phone,
    schools: row.schools,
    content: row.content,
    level: row.content?.level || null,
    docType: row.content?.doc_type || 'course',
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

// ─── Local Storage Seed and CRUD Helpers ──────────────────────────────────────

const seedDefaultLessons = () => {
  return [
    {
      id: "MOCK-TC-MATH-01",
      title: "Fiche 01 : Logique Mathématique",
      subject: "Mathématiques",
      chapter_number: "01",
      teacher: "Prof. Youssef",
      phone: "0681399067",
      schools: ["Bac BIOF"],
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
            type: "content",
            section_number: "1",
            section_header: "Résumé de cours : Logique",
            accent_text: "Définitions et propositions",
            items: [
              {
                type: "text",
                text: "Une **assertion** (ou proposition) est un énoncé mathématique qui a une valeur de vérité unique : soit **Vrai (V)** soit **Faux (F)**."
              },
              {
                type: "highlight_box",
                text: "L'implication $P \\Rightarrow Q$ est fausse uniquement dans le cas où $P$ est vraie et $Q$ est fausse. Elle est équivalente à $(\\text{non } P) \\text{ ou } Q$."
              },
              {
                type: "bullet",
                text: "La conjonction $P \\text{ et } Q$ est vraie si et seulement si les deux assertions sont vraies simultanément."
              }
            ]
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
              {
                question_idx: 1,
                label: "Entrez le symbole final de comparaison de la négation (<= ou >=) :",
                expected_answer: "<="
              }
            ]
          }
        ]
      },
      is_active: true,
      created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: "MOCK-1BAC-MATH-02",
      title: "Fiche 02 : Suites Numériques",
      subject: "Mathématiques",
      chapter_number: "02",
      teacher: "Prof. Alaoui",
      phone: "0670984523",
      schools: ["ENSA", "ENSAM"],
      content: {
        level: "1bac_sci",
        doc_type: "homework",
        header: {
          prep_title: "1ère Année Bac Sciences",
          schools: ["ENSA", "ENSAM"],
          subject: "Mathématiques",
          fiche_title: "Fiche 02 : Suites Numériques",
          teacher: "Prof. Alaoui",
          phone: "0670984523"
        },
        sections: [
          {
            id: "sec-1bac-1",
            title: "Suites arithmétiques",
            type: "content",
            section_number: "1",
            section_header: "Résumé de cours : Suites",
            accent_text: "Définition et terme général",
            items: [
              {
                type: "text",
                text: "Une suite $(u_n)_{n \\ge n_0}$ est dite **arithmétique** s'il existe un nombre réel $r$, appelé **raison** de la suite, tel que :\n$$(\\forall n \\ge n_0) : u_{n+1} = u_n + r$$"
              },
              {
                type: "highlight_box",
                text: "**Terme général :** Si $(u_n)$ est une suite arithmétique de raison $r$ définie sur $\\mathbb{N}$, alors pour tous entiers naturels $n$ et $p$ :\n$$u_n = u_p + (n-p)r$$ En particulier, pour $p=0$ : $u_n = u_0 + nr$."
              }
            ]
          },
          {
            id: "ex-1bac-1",
            title: "Exercice 1 : Calcul de terme",
            type: "exercise",
            section_number: "2",
            section_header: "Exercices d'application",
            content: "Soit $(u_n)$ une suite arithmétique de premier terme $u_0 = 3$ et de raison $r = 5$. Calculer le terme $u_{12}$.",
            solution: "On utilise la formule du terme général d'une suite arithmétique :\n$$u_n = u_0 + nr$$\n\nEn remplaçant par les valeurs données ($u_0 = 3$ et $r = 5$) :\n$$u_{12} = u_0 + 12 \\cdot r = 3 + 12 \\times 5 = 3 + 60 = 63$$\n\nLe douzième terme est donc $u_{12} = 63$.",
            interactive_answers: [
              {
                question_idx: 1,
                label: "Valeur de u_12 :",
                expected_answer: "63"
              }
            ]
          }
        ]
      },
      is_active: true,
      created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: "MOCK-2BAC-PHYS-01",
      title: "Fiche 01 : Ondes Progressives",
      subject: "Physique",
      chapter_number: "01",
      teacher: "Prof. Fayssal",
      phone: "0661223344",
      schools: ["FMP", "ENSA"],
      content: {
        level: "2bac_pc_svt",
        doc_type: "exercises",
        header: {
          prep_title: "2ème Année Bac Sciences",
          schools: ["FMP", "ENSA"],
          subject: "Physique",
          fiche_title: "Fiche 01 : Ondes Progressives",
          teacher: "Prof. Fayssal",
          phone: "0661223344"
        },
        sections: [
          {
            id: "sec-2bac-1",
            title: "Célérité d'une onde progressive",
            type: "content",
            section_number: "1",
            section_header: "Ondes Mécaniques",
            accent_text: "Définition de la célérité",
            items: [
              {
                type: "text",
                text: "La **célérité $v$** (vitesse de propagation) d'une onde est le quotient de la distance $d$ parcourue par la durée $\\Delta t$ du parcours :\n$$v = \\frac{d}{\\Delta t}$$"
              },
              {
                type: "highlight_box",
                text: "**Retard temporel :** Le retard temporel $\\tau$ de la perturbation au point $M_2$ par rapport au point $M_1$ est :\n$$\\tau = \\frac{M_1 M_2}{v}$$"
              }
            ]
          },
          {
            id: "ex-2bac-1",
            title: "Exercice 1 : Retard temporel le long d'une corde",
            type: "exercise",
            section_number: "2",
            section_header: "Exercices",
            content: "Une perturbation se propage le long d'une corde à la vitesse $v = 8.0\\text{ m/s}$. Calculer le retard temporel $\\tau$ (en secondes) pour un point $M$ situé à $d = 4.0\\text{ m}$ de la source.",
            solution: "On applique la relation du retard temporel :\n$$\\tau = \\frac{d}{v}$$\n\nAvec $d = 4.0\\text{ m}$ et $v = 8.0\\text{ m/s}$ :\n$$\\tau = \\frac{4.0}{8.0} = 0.50\\text{ s}$$\n\nLa perturbation atteint le point $M$ avec un retard de $0.50$ seconde.",
            interactive_answers: [
              {
                question_idx: 1,
                label: "Retard temporel tau (en s) :",
                expected_answer: "0.5"
              }
            ]
          }
        ]
      },
      is_active: true,
      created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
      updated_at: new Date().toISOString()
    }
  ];
};

const getLocalLessons = () => {
  const saved = localStorage.getItem('lessons');
  if (!saved || saved === 'null' || saved === 'undefined') {
    console.log('[lessonService] No saved lessons found. Seeding defaults...');
    const defaultData = seedDefaultLessons();
    localStorage.setItem('lessons', JSON.stringify(defaultData));
    return defaultData;
  }
  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    console.warn('[lessonService] Saved lessons in localStorage is not an array. Resetting...');
    const defaultData = seedDefaultLessons();
    localStorage.setItem('lessons', JSON.stringify(defaultData));
    return defaultData;
  } catch (e) {
    console.error('[localStorage] Error loading lessons:', e);
    const defaultData = seedDefaultLessons();
    localStorage.setItem('lessons', JSON.stringify(defaultData));
    return defaultData;
  }
};

const saveLocalLessons = (lessons) => {
  console.log('[lessonService] Saving lessons list to localStorage of size:', lessons.length);
  localStorage.setItem('lessons', JSON.stringify(lessons));
};

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Fetch ALL lessons (admin view).
 */
export const getAllLessons = async () => {
  if (!supabase) {
    const list = getLocalLessons();
    return list.map(mapDBToLesson);
  }

  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Supabase] Failed to fetch all lessons:', error);
    return [];
  }
  return data.map(mapDBToLesson);
};

/**
 * Fetch only active lessons (student view).
 */
export const getActiveLessons = async () => {
  if (!supabase) {
    const list = getLocalLessons();
    return list.filter(l => l.is_active === true).map(mapDBToLesson);
  }

  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Supabase] Failed to fetch active lessons:', error);
    return [];
  }
  return data.map(mapDBToLesson);
};

/**
 * Fetch a single lesson by ID.
 */
export const getLessonById = async (lessonId) => {
  if (!supabase) {
    const list = getLocalLessons();
    const found = list.find(l => l.id === lessonId);
    return found ? mapDBToLesson(found) : null;
  }

  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .maybeSingle();

  if (error || !data) {
    console.error('[Supabase] Failed to fetch lesson by id:', error);
    return null;
  }
  return mapDBToLesson(data);
};

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Add a new lesson.
 * @param {Object} lessonData
 * @returns {Promise<string>} — new lesson ID
 */
export const addLesson = async (lessonData) => {
  const id = lessonData.id || Math.random().toString(36).substring(2, 11).toUpperCase();
  const dbLesson = {
    id,
    ...mapLessonToDB(lessonData),
    created_at: new Date().toISOString(),
  };

  if (!supabase) {
    const list = getLocalLessons();
    const newItem = {
      ...dbLesson,
      is_active: lessonData.isActive !== undefined ? lessonData.isActive : true
    };
    list.unshift(newItem);
    console.log('[lessonService] unshift new item to local list:', newItem);
    saveLocalLessons(list);
    return id;
  }

  const { error } = await supabase
    .from('lessons')
    .insert(dbLesson);

  if (error) {
    console.error('[Supabase] Failed to add lesson:', error);
    throw error;
  }
  return id;
};

/**
 * Update dynamic fields of a lesson.
 */
export const updateLesson = async (lessonId, updates) => {
  const dbUpdates = {};
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.subject !== undefined) dbUpdates.subject = updates.subject;
  if (updates.chapterNumber !== undefined) dbUpdates.chapter_number = updates.chapterNumber;
  if (updates.teacher !== undefined) dbUpdates.teacher = updates.teacher;
  if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
  if (updates.schools !== undefined) dbUpdates.schools = updates.schools;
  if (updates.content !== undefined) dbUpdates.content = {
    ...(updates.content || {}),
    level: updates.level || updates.content?.level || null,
    doc_type: updates.docType || updates.content?.doc_type || null
  };
  if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
  dbUpdates.updated_at = new Date().toISOString();

  if (!supabase) {
    const list = getLocalLessons();
    const idx = list.findIndex(l => l.id === lessonId);
    if (idx !== -1) {
      // Merge updates
      const original = list[idx];
      list[idx] = {
        ...original,
        ...dbUpdates,
        content: {
          ...original.content,
          ...dbUpdates.content
        }
      };
      saveLocalLessons(list);
    }
    return;
  }

  const { error } = await supabase
    .from('lessons')
    .update(dbUpdates)
    .eq('id', lessonId);

  if (error) {
    console.error('[Supabase] Failed to update lesson:', error);
    throw error;
  }
};

/**
 * Toggle the active/inactive status of a lesson.
 */
export const toggleLessonStatus = async (lessonId, currentStatus) => {
  if (!supabase) {
    const list = getLocalLessons();
    const idx = list.findIndex(l => l.id === lessonId);
    if (idx !== -1) {
      list[idx].is_active = !currentStatus;
      list[idx].updated_at = new Date().toISOString();
      saveLocalLessons(list);
    }
    return;
  }

  const { error } = await supabase
    .from('lessons')
    .update({
      is_active: !currentStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lessonId);

  if (error) {
    console.error('[Supabase] Failed to toggle lesson status:', error);
    throw error;
  }
};

/**
 * Permanently delete a lesson.
 */
export const deleteLesson = async (lessonId) => {
  if (!supabase) {
    const list = getLocalLessons();
    const filtered = list.filter(l => l.id !== lessonId);
    saveLocalLessons(filtered);
    return;
  }

  const { error } = await supabase
    .from('lessons')
    .delete()
    .eq('id', lessonId);

  if (error) {
    console.error('[Supabase] Failed to delete lesson:', error);
    throw error;
  }
};
