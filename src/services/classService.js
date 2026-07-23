// src/services/classService.js
// Service for managing school classes and student assignments via Supabase or Local Companion API.

import { supabase } from '../lib/supabase';
import { localDb } from '../lib/localDbClient';

/**
 * Fetch all classes.
 */
export const getAllClasses = async () => {
  if (!supabase) {
    try {
      const data = await localDb.get('/classes');
      return data;
    } catch (err) {
      console.error('[LocalDB] Failed to fetch classes:', err);
      return [];
    }
  }

  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Supabase] Failed to fetch classes:', error);
    return [];
  }

  return data.map(row => ({
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
    createdAt: row.created_at
  }));
};

/**
 * Fetch a single class by ID.
 */
export const getClassById = async (classId) => {
  if (!supabase) {
    try {
      const list = await localDb.get('/classes');
      return list.find(c => c.id === classId) || null;
    } catch (err) {
      console.error('[LocalDB] Failed to fetch class by ID:', err);
      return null;
    }
  }

  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('id', classId)
    .maybeSingle();

  if (error) {
    console.error('[Supabase] Failed to fetch class by ID:', error);
    return null;
  }
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    level: data.level,
    studentCount: data.student_count || 0,
    controls: data.controls || [],
    grades: data.grades || {},
    homework: data.homework || {},
    language: data.language || 'fr',
    program: data.program || [],
    createdAt: data.created_at
  };
};

/**
 * Add or update a class.
 */
export const addClass = async (classData) => {
  if (!supabase) {
    try {
      const newClass = {
        id: classData.id || 'CLASS-' + Math.random().toString(36).substring(2, 11).toUpperCase(),
        name: classData.name,
        level: classData.level,
        studentCount: classData.studentCount || 0,
        controls: classData.controls || [],
        grades: classData.grades || {},
        homework: classData.homework || {},
        language: classData.language || 'fr',
        program: classData.program || [],
        createdAt: classData.createdAt || new Date().toISOString()
      };
      await localDb.post('/classes', newClass);
      return newClass.id;
    } catch (err) {
      console.error('[LocalDB] Failed to add/update class:', err);
      throw err;
    }
  }

  const { error } = await supabase
    .from('classes')
    .upsert({
      id: classData.id,
      name: classData.name,
      level: classData.level,
      student_count: classData.studentCount || 0,
      controls: classData.controls || [],
      grades: classData.grades || {},
      homework: classData.homework || {},
      language: classData.language || 'fr',
      program: classData.program || [],
      updated_at: new Date().toISOString()
    });

  if (error) {
    console.error('[Supabase] Failed to add/update class:', error);
    throw error;
  }
  return classData.id;
};

/**
 * Update specific fields on a class.
 */
export const updateClass = async (classId, updates) => {
  if (!supabase) {
    try {
      const list = await localDb.get('/classes');
      const cls = list.find(c => c.id === classId);
      if (cls) {
        const updated = {
          ...cls,
          ...updates,
          updatedAt: new Date().toISOString()
        };
        await localDb.post('/classes', updated);
      }
      return classId;
    } catch (err) {
      console.error('[LocalDB] Failed to update class:', err);
      throw err;
    }
  }

  const { error } = await supabase
    .from('classes')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', classId);

  if (error) {
    console.error('[Supabase] Failed to update class:', error);
    throw error;
  }
  return classId;
};

/**
 * Delete a class by ID.
 */
export const deleteClass = async (classId) => {
  if (!supabase) {
    try {
      await localDb.delete('/classes', classId);
      return true;
    } catch (err) {
      console.error('[LocalDB] Failed to delete class:', err);
      throw err;
    }
  }

  const { error } = await supabase
    .from('classes')
    .delete()
    .eq('id', classId);

  if (error) {
    console.error('[Supabase] Failed to delete class:', error);
    throw error;
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

  // Map grade to all variations of student keys (massarCode, id, uppercase, lowercase)
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

