// src/services/lessonService.js
// CRUD for lessons with local companion database API persistence when Supabase is disabled.

import { supabase } from '../lib/supabase';
import { localDb } from '../lib/localDbClient';

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

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Fetch ALL lessons (admin view).
 */
export const getAllLessons = async () => {
  if (!supabase) {
    try {
      const data = await localDb.get('/lessons');
      return data.map(mapDBToLesson);
    } catch (err) {
      console.error('[LocalDB] Failed to fetch all lessons:', err);
      return [];
    }
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
    try {
      const data = await localDb.get('/lessons');
      return data.filter(l => l.isActive === true || l.is_active === true).map(mapDBToLesson);
    } catch (err) {
      console.error('[LocalDB] Failed to fetch active lessons:', err);
      return [];
    }
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
    try {
      const data = await localDb.get('/lessons');
      const found = data.find(l => l.id === lessonId);
      return found ? mapDBToLesson(found) : null;
    } catch (err) {
      console.error('[LocalDB] Failed to fetch lesson by id:', err);
      return null;
    }
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
  const id = lessonData.id || 'MOCK-L-' + Math.random().toString(36).substring(2, 11).toUpperCase();
  const dbLesson = {
    id,
    ...mapLessonToDB(lessonData),
    created_at: new Date().toISOString(),
  };

  if (!supabase) {
    try {
      const newItem = {
        ...dbLesson,
        is_active: lessonData.isActive !== undefined ? lessonData.isActive : true
      };
      await localDb.post('/lessons', newItem);
      return id;
    } catch (err) {
      console.error('[LocalDB] Failed to add lesson:', err);
      throw err;
    }
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
    try {
      const lessons = await localDb.get('/lessons');
      const idx = lessons.findIndex(l => l.id === lessonId);
      if (idx !== -1) {
        const original = lessons[idx];
        const updated = {
          ...original,
          ...dbUpdates,
          content: {
            ...(original.content || {}),
            ...(dbUpdates.content || {})
          }
        };
        await localDb.post('/lessons', updated);
      }
      return;
    } catch (err) {
      console.error('[LocalDB] Failed to update lesson:', err);
      throw err;
    }
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
    try {
      const lessons = await localDb.get('/lessons');
      const lesson = lessons.find(l => l.id === lessonId);
      if (lesson) {
        lesson.is_active = !currentStatus;
        lesson.updated_at = new Date().toISOString();
        await localDb.post('/lessons', lesson);
      }
      return;
    } catch (err) {
      console.error('[LocalDB] Failed to toggle lesson status:', err);
      throw err;
    }
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
    try {
      await localDb.delete('/lessons', lessonId);
      return;
    } catch (err) {
      console.error('[LocalDB] Failed to delete lesson:', err);
      throw err;
    }
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
