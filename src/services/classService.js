// src/services/classService.js
// Service for managing school classes and student assignments with SWR caching & fail-safe persistence.

import { supabase } from '../lib/supabase';
import { localDb } from '../lib/localDbClient';
import { queryCache } from './queryCache';

const STORAGE_KEY = 'lconq_classes_db';

const getLocalStorageClasses = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch (e) {
    return null;
  }
};

const saveLocalStorageClasses = (classes) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(classes));
  } catch (e) {
    console.warn('[LocalStorage] Failed to save classes:', e);
  }
};

const mapDBToClass = (row) => ({
  id: row.id,
  name: row.name,
  level: row.level,
  students: row.students || [],
  studentCount: row.student_count || (row.students ? row.students.length : 0),
  competitions: row.competitions || [],
  competitionGrades: row.competition_grades || row.competitionGrades || {},
  controls: row.controls || [],
  grades: row.grades || {},
  homework: row.homework || {},
  language: row.language || 'fr',
  program: row.program || [],
  createdAt: row.created_at || row.createdAt
});

/**
 * Fetch all classes with SWR caching.
 */
export const getAllClasses = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('classes_all', async () => {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('classes')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          const mapped = data.map(mapDBToClass);
          saveLocalStorageClasses(mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('[Supabase] Failed to fetch classes:', err);
      }
    }

    try {
      const data = await localDb.get('/classes');
      if (Array.isArray(data) && data.length > 0) {
        const mapped = data.map(mapDBToClass);
        saveLocalStorageClasses(mapped);
        return mapped;
      }
    } catch (err) {
      console.warn('[LocalDB] Companion server offline for classes, using local storage backup.');
    }

    const cache = getLocalStorageClasses();
    return cache || [];
  }, {
    forceRefresh,
    staleTime: 1000 * 60 * 3,
    cacheTime: 1000 * 60 * 30
  });
};

/**
 * Fetch a single class by ID.
 */
export const getClassById = async (classId, options = {}) => {
  if (!classId) return null;
  const classes = await getAllClasses(options);
  return classes.find(c => c.id === classId) || null;
};

/**
 * Add or update a class.
 */
export const addClass = async (classData) => {
  const id = classData.id || 'CLASS-' + Math.random().toString(36).substring(2, 11).toUpperCase();
  const now = new Date().toISOString();

  const newClass = {
    id,
    name: classData.name,
    level: classData.level,
    students: classData.students || [],
    studentCount: classData.studentCount || (classData.students ? classData.students.length : 0),
    competitions: classData.competitions || [],
    competitionGrades: classData.competitionGrades || {},
    controls: classData.controls || [],
    grades: classData.grades || {},
    homework: classData.homework || {},
    language: classData.language || 'fr',
    program: classData.program || [],
    createdAt: classData.createdAt || now
  };

  // Invalidate SWR Cache
  queryCache.invalidate('classes_all');

  // 1. LocalStorage
  const currentClasses = (await getAllClasses()).filter(c => c.id !== id);
  currentClasses.unshift(newClass);
  saveLocalStorageClasses(currentClasses);

  // 2. Companion API
  try {
    await localDb.post('/classes', newClass);
  } catch (err) {
    console.warn('[LocalDB] Could not sync addClass to Companion server:', err.message);
  }

  // 3. Supabase
  if (supabase) {
    try {
      await supabase.from('classes').upsert({
        id,
        name: classData.name,
        level: classData.level,
        student_count: newClass.studentCount,
        students: newClass.students,
        competitions: newClass.competitions,
        competition_grades: newClass.competitionGrades,
        controls: newClass.controls,
        grades: newClass.grades,
        homework: newClass.homework,
        language: newClass.language,
        program: newClass.program,
        updated_at: now
      });
    } catch (err) {
      console.warn('[Supabase] Could not sync addClass to Supabase:', err.message);
    }
  }

  return id;
};

/**
 * Update specific fields on a class.
 */
export const updateClass = async (classId, updates) => {
  const now = new Date().toISOString();

  queryCache.invalidate('classes_all');

  // 1. LocalStorage
  const currentClasses = await getAllClasses();
  const idx = currentClasses.findIndex(c => c.id === classId);
  if (idx !== -1) {
    currentClasses[idx] = {
      ...currentClasses[idx],
      ...updates,
      updatedAt: now
    };
    saveLocalStorageClasses(currentClasses);
  }

  // 2. Companion API
  try {
    const list = await localDb.get('/classes');
    const cls = list.find(c => c.id === classId);
    if (cls) {
      const merged = { ...cls, ...updates, updatedAt: now };
      await localDb.post('/classes', merged);
    }
  } catch (err) {
    console.warn('[LocalDB] Could not sync updateClass to Companion server:', err.message);
  }

  // 3. Supabase
  if (supabase) {
    try {
      await supabase.from('classes').update({
        ...updates,
        updated_at: now
      }).eq('id', classId);
    } catch (err) {
      console.warn('[Supabase] Could not sync updateClass to Supabase:', err.message);
    }
  }

  return classId;
};

/**
 * Delete a class by ID.
 */
export const deleteClass = async (classId) => {
  queryCache.invalidate('classes_all');

  // 1. LocalStorage
  const currentClasses = await getAllClasses();
  const filtered = currentClasses.filter(c => c.id !== classId);
  saveLocalStorageClasses(filtered);

  // 2. Companion API
  try {
    await localDb.delete('/classes', classId);
  } catch (err) {
    console.warn('[LocalDB] Could not sync deleteClass to Companion server:', err.message);
  }

  // 3. Supabase
  if (supabase) {
    try {
      await supabase.from('classes').delete().eq('id', classId);
    } catch (err) {
      console.warn('[Supabase] Could not sync deleteClass to Supabase:', err.message);
    }
  }

  return true;
};

/**
 * Record/assign a student's grade for a specific control/exam in a class.
 */
export const recordStudentExamGrade = async (classId, studentMassar, examName, score, totalQuestions) => {
  if (!classId || !studentMassar) return null;
  const cls = await getClassById(classId);
  if (!cls) return null;

  const competitions = Array.isArray(cls.competitions) ? [...cls.competitions] : [];
  if (!competitions.includes(examName)) {
    competitions.push(examName);
  }

  const controls = Array.isArray(cls.controls) ? [...cls.controls] : [];
  if (!controls.includes(examName)) {
    controls.push(examName);
  }

  const competitionGrades = { ...(cls.competitionGrades || {}) };
  const grades = { ...(cls.grades || {}) };
  
  const numericScore = parseFloat(score);
  const total = parseFloat(totalQuestions) || 20;
  const score20 = (total > 0 && !isNaN(numericScore)) ? ((numericScore / total) * 20).toFixed(2) : numericScore;
  
  let displayScore = `${numericScore}/${total}`;
  if (total !== 20 && !isNaN(numericScore)) {
    displayScore = `${numericScore}/${total} (${score20}/20)`;
  }

  const studentKeys = new Set([
    studentMassar,
    studentMassar.toUpperCase(),
    studentMassar.toLowerCase()
  ]);

  if (cls.students && Array.isArray(cls.students)) {
    const st = cls.students.find(s => 
      (s.massarCode && s.massarCode.toUpperCase() === studentMassar.toUpperCase()) || 
      (s.id && s.id.toUpperCase() === studentMassar.toUpperCase())
    );
    if (st) {
      if (st.id) studentKeys.add(st.id);
      if (st.massarCode) studentKeys.add(st.massarCode);
    }
  }

  studentKeys.forEach(key => {
    if (!competitionGrades[key]) competitionGrades[key] = {};
    competitionGrades[key][examName] = displayScore;

    if (!grades[key]) grades[key] = {};
    grades[key][examName] = displayScore;
  });

  await updateClass(classId, { competitions, competitionGrades, controls, grades });
  return { examName, score: numericScore, totalQuestions: total, score20, displayScore };
};
