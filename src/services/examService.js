// src/services/examService.js
// Supabase CRUD for exams — the core content of L'CONQ
// All functions return empty/null when supabase is null (no Supabase configured).

import { supabase } from '../lib/supabase';

// Helper to map exam fields to DB columns
const mapExamToDB = (e) => ({
  name: e.name,
  school: e.school,
  level: e.level || null,
  year: e.year,
  tier: e.tier,
  questions: e.questions,
  pdf_url: e.pdfUrl || null,
  is_active: e.isActive !== undefined ? e.isActive : true,
  is_archived: e.isArchived !== undefined ? e.isArchived : false,
  date_added: e.dateAdded || new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

// Helper to map DB columns to exam fields
const mapDBToExam = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    school: row.school,
    level: row.level || null,
    year: row.year,
    tier: row.tier,
    questions: row.questions,
    questionsCount: row.questions_count !== undefined ? row.questions_count : (row.questions ? row.questions.length : 0),
    pdfUrl: row.pdf_url,
    isActive: row.is_active,
    isArchived: row.is_archived,
    dateAdded: row.date_added,
    updatedAt: row.updated_at,
  };
};

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Fetch ALL exams (admin view).
 */
export const getAllExams = async () => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('exams_metadata')
    .select('*')
    .order('date_added', { ascending: false });

  if (error) {
    console.error('[Supabase] Failed to fetch all exams:', error);
    return [];
  }
  return data.map(mapDBToExam);
};

/**
 * Fetch only active, non-archived exams (student view).
 */
export const getActiveExams = async () => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('exams_metadata')
    .select('*')
    .eq('is_active', true)
    .eq('is_archived', false);

  if (error) {
    console.error('[Supabase] Failed to fetch active exams:', error);
    return [];
  }
  return data.map(mapDBToExam);
};

/**
 * Fetch a single exam by ID.
 */
export const getExamById = async (examId) => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('exams')
    .select('*')
    .eq('id', examId)
    .maybeSingle();

  if (error || !data) return null;
  return mapDBToExam(data);
};

/**
 * Fetch only the questions array of a single exam.
 */
export const getExamQuestionsOnly = async (examId) => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('exams')
    .select('questions')
    .eq('id', examId)
    .maybeSingle();

  if (error || !data) {
    console.error('[Supabase] Failed to fetch exam questions:', error);
    return [];
  }
  return data.questions || [];
};

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Add a new exam to Supabase.
 * @param {Object} examData — { name, school, year, tier, questions, pdfUrl }
 * @returns {Promise<string>} — new exam ID
 */
export const addExam = async (examData) => {
  if (!supabase) return null;
  const id = examData.id || Math.random().toString(36).substring(2, 11).toUpperCase();
  const dbExam = {
    id,
    ...mapExamToDB(examData),
  };

  const { error } = await supabase
    .from('exams')
    .insert(dbExam);

  if (error) {
    console.error('[Supabase] Failed to add exam:', error);
    throw error;
  }
  return id;
};

/**
 * Update specific fields of an exam.
 */
export const updateExam = async (examId, updates) => {
  if (!supabase) return;
  const dbUpdates = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.school !== undefined) dbUpdates.school = updates.school;
  if (updates.level !== undefined) dbUpdates.level = updates.level;
  if (updates.year !== undefined) dbUpdates.year = updates.year;
  if (updates.tier !== undefined) dbUpdates.tier = updates.tier;
  if (updates.questions !== undefined) dbUpdates.questions = updates.questions;
  if (updates.pdfUrl !== undefined) dbUpdates.pdf_url = updates.pdfUrl;
  if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
  if (updates.isArchived !== undefined) dbUpdates.is_archived = updates.isArchived;
  dbUpdates.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('exams')
    .update(dbUpdates)
    .eq('id', examId);

  if (error) {
    console.error('[Supabase] Failed to update exam:', error);
    throw error;
  }
};

/**
 * Toggle the active/inactive status of an exam.
 */
export const toggleExamStatus = async (examId, currentStatus) => {
  if (!supabase) return;
  const { error } = await supabase
    .from('exams')
    .update({
      is_active: !currentStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', examId);

  if (error) {
    console.error('[Supabase] Failed to toggle exam status:', error);
    throw error;
  }
};

/**
 * Toggle archived status of an exam.
 */
export const toggleArchiveExam = async (examId, currentArchived) => {
  if (!supabase) return;
  const { error } = await supabase
    .from('exams')
    .update({
      is_archived: !currentArchived,
      updated_at: new Date().toISOString(),
    })
    .eq('id', examId);

  if (error) {
    console.error('[Supabase] Failed to toggle archive status:', error);
    throw error;
  }
};

/**
 * Permanently delete an exam.
 */
export const deleteExam = async (examId) => {
  if (!supabase) return;
  const { error } = await supabase
    .from('exams')
    .delete()
    .eq('id', examId);

  if (error) {
    console.error('[Supabase] Failed to delete exam:', error);
    throw error;
  }
};
