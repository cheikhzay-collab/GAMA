// src/services/classService.js
// Service for managing school classes and student assignments with SWR caching & fail-safe persistence.

import { supabase } from '../lib/supabase';
import { localDb } from '../lib/localDbClient';
import { queryCache } from './queryCache';
import initialClassesData from '../../data/classes.json';

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

const safeParseJSON = (val, fallback) => {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch (e) {
      return fallback;
    }
  }
  return fallback;
};

/**
 * Normalizes a class object from ANY source (Supabase snake_case, LocalDB camelCase, or localStorage).
 * This is the single source of truth for class shape normalization.
 */
const normalizeClass = (row) => {
  if (!row) return null;

  // Support both snake_case (Supabase) and camelCase (LocalDB/localStorage)
  const parsedStudents = safeParseJSON(row.students, []);
  const parsedGrades = safeParseJSON(row.grades, {});
  // competitionGrades can come as camelCase (local) or snake_case (Supabase)
  const parsedCompGrades = safeParseJSON(
    row.competitionGrades ?? row.competition_grades,
    {}
  );
  const parsedHomework = safeParseJSON(row.homework, {});
  const parsedControls = safeParseJSON(row.controls, []);
  const parsedCompetitions = safeParseJSON(row.competitions, []);
  const parsedProgram = safeParseJSON(row.program, []);

  const studentsList = Array.isArray(parsedStudents) ? parsedStudents : [];
  // Support both snake_case (Supabase) and camelCase (LocalDB/localStorage)
  const count = row.student_count ?? row.studentCount ?? studentsList.length;

  return {
    id: row.id,
    name: row.name,
    level: row.level,
    students: studentsList,
    studentCount: count,
    competitions: Array.isArray(parsedCompetitions) ? parsedCompetitions : [],
    competitionGrades: parsedCompGrades,
    controls: Array.isArray(parsedControls) ? parsedControls : [],
    grades: parsedGrades,
    homework: typeof parsedHomework === 'object' && parsedHomework !== null ? parsedHomework : {},
    language: row.language || 'fr',
    program: Array.isArray(parsedProgram) ? parsedProgram : [],
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
  };
};

// Keep mapDBToClass as an alias for Supabase rows (pure snake_case source)
const mapDBToClass = normalizeClass;

/**
 * Fetch all classes with SWR caching.
 */
export const getAllClasses = async (options = {}) => {
  const { forceRefresh = false } = options;

  return queryCache.fetchWithCache('classes_all', async () => {
    // 1. Try Supabase first
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('classes')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          const mapped = data.map(normalizeClass);
          saveLocalStorageClasses(mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('[Supabase] Failed to fetch classes:', err);
      }
    }

    // 2. Try LocalDB companion server
    // NOTE: LocalDB returns classes in camelCase (as saved), so normalizeClass handles both.
    try {
      const data = await localDb.get('/classes');
      if (Array.isArray(data) && data.length > 0) {
        // normalizeClass handles camelCase from localDb correctly
        const mapped = data.map(normalizeClass);
        saveLocalStorageClasses(mapped);
        return mapped;
      }
    } catch (err) {
      console.warn('[LocalDB] Companion server offline for classes, using local storage backup.');
    }

    // 3. Fallback to localStorage
    const cache = getLocalStorageClasses();
    if (Array.isArray(cache) && cache.length > 0) {
      // If cached classes have empty students, merge students from initialClassesData
      if (Array.isArray(initialClassesData)) {
        const seedMap = new Map(initialClassesData.map(c => [c.id, c]));
        let needsResave = false;
        const enriched = cache.map(c => {
          const seed = seedMap.get(c.id);
          if ((!c.students || c.students.length === 0) && seed && seed.students && seed.students.length > 0) {
            needsResave = true;
            return {
              ...c,
              students: seed.students,
              studentCount: seed.students.length
            };
          }
          return c;
        });
        if (needsResave) {
          saveLocalStorageClasses(enriched);
          return enriched;
        }
      }
      return cache;
    }

    // 4. Seed fallback from bundled Moroccan classes
    if (Array.isArray(initialClassesData) && initialClassesData.length > 0) {
      const mapped = initialClassesData.map(normalizeClass);
      saveLocalStorageClasses(mapped);
      return mapped;
    }

    return [];
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

  const students = Array.isArray(classData.students) ? classData.students : [];
  const studentCount = classData.studentCount !== undefined ? classData.studentCount : students.length;

  const newClass = {
    id,
    name: classData.name,
    level: classData.level,
    students,
    studentCount,
    competitions: classData.competitions || [],
    competitionGrades: classData.competitionGrades || {},
    controls: classData.controls || [],
    grades: classData.grades || {},
    homework: classData.homework || {},
    language: classData.language || 'fr',
    program: classData.program || [],
    createdAt: classData.createdAt || now,
    updatedAt: now
  };

  // 1. LocalStorage first (synchronous, always reliable)
  // Read directly from localStorage to avoid cache race conditions
  const rawCached = getLocalStorageClasses() || [];
  const filteredForNew = rawCached.filter(c => c.id !== id);
  filteredForNew.unshift(newClass);
  saveLocalStorageClasses(filteredForNew);

  // 2. Invalidate SWR Cache AFTER writing localStorage (so next read gets fresh data)
  queryCache.invalidate('classes_all');

  // 3. Companion API (fire-and-forget, non-blocking)
  localDb.post('/classes', newClass).catch(err => {
    console.warn('[LocalDB] Could not sync addClass to Companion server:', err.message);
  });

  // 4. Supabase (fire-and-forget)
  if (supabase) {
    supabase.from('classes').upsert({
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
    }).then(({ error }) => {
      if (error) console.warn('[Supabase] Could not sync addClass to Supabase:', error.message);
    });
  }

  return id;
};

/**
 * Update specific fields on a class.
 * Uses localStorage as primary source to avoid async race conditions.
 */
export const updateClass = async (classId, updates) => {
  const now = new Date().toISOString();

  // 1. LocalStorage — read directly (avoid cache), merge, write back
  const rawCurrent = getLocalStorageClasses() || [];
  const idx = rawCurrent.findIndex(c => c.id === classId);

  if (idx !== -1) {
    const existing = rawCurrent[idx];
    const updatedStudents = updates.students !== undefined ? updates.students : existing.students;
    const studentCount = updates.studentCount !== undefined
      ? updates.studentCount
      : (Array.isArray(updatedStudents) ? updatedStudents.length : existing.studentCount);

    rawCurrent[idx] = {
      ...existing,
      ...updates,
      students: updatedStudents,
      studentCount,
      updatedAt: now
    };
    saveLocalStorageClasses(rawCurrent);
  }

  // 2. Invalidate SWR Cache AFTER writing localStorage
  queryCache.invalidate('classes_all');

  // 3. Companion API — merge server state with updates (fire-and-forget)
  localDb.get('/classes').then(list => {
    if (!Array.isArray(list)) return;
    const cls = list.find(c => c.id === classId);
    if (!cls) return;

    const updatedStudents = updates.students !== undefined ? updates.students : cls.students;
    const studentCount = updates.studentCount !== undefined
      ? updates.studentCount
      : (Array.isArray(updatedStudents) ? updatedStudents.length : cls.studentCount);

    const merged = { ...cls, ...updates, students: updatedStudents, studentCount, updatedAt: now };
    localDb.post('/classes', merged).catch(err => {
      console.warn('[LocalDB] Could not sync updateClass to Companion server:', err.message);
    });
  }).catch(err => {
    console.warn('[LocalDB] Could not sync updateClass to Companion server:', err.message);
  });

  // 4. Supabase — build db-shaped update object (fire-and-forget)
  if (supabase) {
    const dbUpdates = { updated_at: now };

    // Map camelCase fields to snake_case for Supabase
    if (updates.students !== undefined) dbUpdates.students = updates.students;
    if (updates.studentCount !== undefined) dbUpdates.student_count = updates.studentCount;
    if (updates.competitionGrades !== undefined) dbUpdates.competition_grades = updates.competitionGrades;
    if (updates.competitions !== undefined) dbUpdates.competitions = updates.competitions;
    if (updates.controls !== undefined) dbUpdates.controls = updates.controls;
    if (updates.grades !== undefined) dbUpdates.grades = updates.grades;
    if (updates.homework !== undefined) dbUpdates.homework = updates.homework;
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.level !== undefined) dbUpdates.level = updates.level;
    if (updates.language !== undefined) dbUpdates.language = updates.language;
    if (updates.program !== undefined) dbUpdates.program = updates.program;

    supabase.from('classes').update(dbUpdates).eq('id', classId).then(({ error }) => {
      if (error) console.warn('[Supabase] Could not sync updateClass to Supabase:', error.message);
    });
  }

  return classId;
};

/**
 * Add or update a student within a class.
 */
export const addStudentToClass = async (classId, student) => {
  // Read directly from localStorage to avoid cache staleness
  const rawCurrent = getLocalStorageClasses() || [];
  const cls = rawCurrent.find(c => c.id === classId);
  if (!cls) return false;

  const currentStudents = Array.isArray(cls.students) ? [...cls.students] : [];
  const existingIdx = currentStudents.findIndex(s =>
    (s.id && (s.id === student.id || s.id === student.massarCode)) ||
    (s.massarCode && (s.massarCode === student.massarCode || s.massarCode === student.id))
  );

  if (existingIdx !== -1) {
    currentStudents[existingIdx] = { ...currentStudents[existingIdx], ...student };
  } else {
    currentStudents.push(student);
  }

  await updateClass(classId, {
    students: currentStudents,
    studentCount: currentStudents.length
  });

  return true;
};

/**
 * Remove a student from a class.
 */
export const removeStudentFromClass = async (classId, studentId) => {
  // Read directly from localStorage to avoid cache staleness
  const rawCurrent = getLocalStorageClasses() || [];
  const cls = rawCurrent.find(c => c.id === classId);
  if (!cls) return false;

  const currentStudents = (cls.students || []).filter(s =>
    s.id !== studentId && s.massarCode !== studentId
  );

  await updateClass(classId, {
    students: currentStudents,
    studentCount: currentStudents.length
  });

  return true;
};

/**
 * Delete a class by ID.
 */
export const deleteClass = async (classId) => {
  // 1. LocalStorage
  const rawCurrent = getLocalStorageClasses() || [];
  const filtered = rawCurrent.filter(c => c.id !== classId);
  saveLocalStorageClasses(filtered);

  // 2. Invalidate SWR Cache
  queryCache.invalidate('classes_all');

  // 3. Companion API (fire-and-forget)
  localDb.delete('/classes', classId).catch(err => {
    console.warn('[LocalDB] Could not sync deleteClass to Companion server:', err.message);
  });

  // 4. Supabase (fire-and-forget)
  if (supabase) {
    supabase.from('classes').delete().eq('id', classId).then(({ error }) => {
      if (error) console.warn('[Supabase] Could not sync deleteClass to Supabase:', error.message);
    });
  }

  return true;
};

/**
 * Record/assign a student's grade for a specific control/exam in a class.
 */
export const recordStudentExamGrade = async (classId, studentMassar, examName, score, totalQuestions) => {
  if (!classId || !studentMassar) return null;

  // Read directly from localStorage for consistency
  const rawCurrent = getLocalStorageClasses() || [];
  const cls = rawCurrent.find(c => c.id === classId);
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
