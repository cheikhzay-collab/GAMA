// src/services/classService.js
// Service for managing school classes and student assignments locally or via Supabase (fallback to local).

import { supabase } from '../lib/supabase';

const getLocalClasses = () => {
  const saved = localStorage.getItem('classes');
  if (!saved || saved === 'null' || saved === 'undefined') {
    const defaultClasses = [];
    localStorage.setItem('classes', JSON.stringify(defaultClasses));
    return defaultClasses;
  }
  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (e) {
    console.error('[localStorage] Error loading classes:', e);
    return [];
  }
};

const saveLocalClasses = (classes) => {
  localStorage.setItem('classes', JSON.stringify(classes));
};

/**
 * Fetch all classes.
 */
export const getAllClasses = async () => {
  if (!supabase) {
    return getLocalClasses();
  }
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[Supabase] Failed to fetch classes:', error);
    return getLocalClasses();
  }
  return data.map(row => ({
    id: row.id,
    name: row.name,
    level: row.level,
    studentCount: row.student_count || 0,
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
    const list = getLocalClasses();
    return list.find(c => c.id === classId) || null;
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
    const list = getLocalClasses();
    const existingIdx = list.findIndex(c => c.id === classData.id);
    const newClass = {
      id: classData.id,
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
    if (existingIdx > -1) {
      list[existingIdx] = newClass;
    } else {
      list.unshift(newClass);
    }
    saveLocalClasses(list);
    return classData.id;
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
    const list = getLocalClasses();
    const existingIdx = list.findIndex(c => c.id === classId);
    if (existingIdx > -1) {
      list[existingIdx] = {
        ...list[existingIdx],
        ...updates
      };
      saveLocalClasses(list);
    }
    return classId;
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
    const list = getLocalClasses();
    const updated = list.filter(c => c.id !== classId);
    saveLocalClasses(updated);
    return true;
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
