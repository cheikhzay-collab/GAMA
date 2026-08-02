// src/services/examService.js
// Multi-tiered CRUD for exams with fail-safe persistence (Supabase -> LocalDb -> LocalStorage -> Seed Fallback).

import { supabase } from '../lib/supabase';
import { localDb } from '../lib/localDbClient';

const STORAGE_KEY = 'lconq_exams_db';

const INITIAL_SEED_EXAMS = [
  {
    id: "QVVOBFE7",
    name: "Concours Médecine / Pharmacie 2024",
    school: "Médecine / Pharmacie",
    level: "2bac_pc_svt",
    year: "2024",
    tier: "freemium",
    isActive: true,
    isArchived: false,
    dateAdded: "2026-07-01T00:00:00.000Z",
    questions: Array.from({ length: 20 }, (_, i) => {
      const answers = ["C", "A", "B", "D", "C", "A", "E", "B", "C", "D", "B", "B", "A", "C", "D", "E", "B", "A", "D", "C"];
      const topics = ["Analyse", "Géométrie", "Algèbre", "Physique", "Chimie"];
      const optTexts = ["Option A", "Option B", "Option C", "Option D", "Option E"];
      return {
        id: `qvvobfe7-q-${i + 1}`,
        question: `Question ${i + 1} de concours Médecine/Pharmacie`,
        topic: topics[i % topics.length],
        correct_answer: answers[i],
        options: optTexts.map((txt, oIdx) => ({
          id: ["A", "B", "C", "D", "E"][oIdx],
          text: txt
        }))
      };
    })
  }
];

const getLocalStorageExams = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch (e) {
    return null;
  }
};

const saveLocalStorageExams = (exams) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(exams));
  } catch (e) {
    console.warn('[LocalStorage] Failed to save exams:', e);
  }
};

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
    questions: row.questions || [],
    questionsCount: row.questions_count !== undefined ? row.questions_count : (row.questions ? row.questions.length : 0),
    pdfUrl: row.pdf_url || row.pdfUrl,
    isActive: row.is_active !== undefined ? row.is_active : (row.isActive !== undefined ? row.isActive : true),
    isArchived: row.is_archived !== undefined ? row.is_archived : (row.isArchived !== undefined ? row.isArchived : false),
    dateAdded: row.date_added || row.dateAdded,
    updatedAt: row.updated_at || row.updatedAt,
  };
};

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Fetch ALL exams (admin view) with fail-safe fallback.
 */
export const getAllExams = async () => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('exams_metadata')
        .select('*')
        .order('date_added', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        const mapped = data.map(mapDBToExam);
        saveLocalStorageExams(mapped);
        return mapped;
      }
    } catch (err) {
      console.warn('[Supabase] Failed to fetch exams:', err);
    }
  }

  try {
    const data = await localDb.get('/exams');
    if (Array.isArray(data) && data.length > 0) {
      const mapped = data.map(mapDBToExam);
      saveLocalStorageExams(mapped);
      return mapped;
    }
  } catch (err) {
    console.warn('[LocalDB] Companion server offline for exams, using local storage backup.');
  }

  const cache = getLocalStorageExams();
  if (cache && cache.length > 0) {
    return cache.map(mapDBToExam);
  }

  saveLocalStorageExams(INITIAL_SEED_EXAMS);
  return INITIAL_SEED_EXAMS.map(mapDBToExam);
};

/**
 * Fetch only active, non-archived exams (student view).
 */
export const getActiveExams = async () => {
  const exams = await getAllExams();
  return exams.filter(e => e.isActive && !e.isArchived);
};

/**
 * Fetch a single exam by ID.
 */
export const getExamById = async (examId) => {
  const exams = await getAllExams();
  return exams.find(e => e.id === examId) || null;
};

/**
 * Fetch only the questions array of a single exam.
 */
export const getExamQuestionsOnly = async (examId) => {
  const exam = await getExamById(examId);
  return exam ? (exam.questions || []) : [];
};

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Add a new exam.
 */
export const addExam = async (examData) => {
  const id = examData.id || Math.random().toString(36).substring(2, 11).toUpperCase();
  const now = new Date().toISOString();

  const newExam = {
    id,
    name: examData.name,
    school: examData.school,
    level: examData.level || null,
    year: examData.year,
    tier: examData.tier,
    questions: examData.questions || [],
    pdfUrl: examData.pdfUrl || null,
    isActive: examData.isActive !== undefined ? examData.isActive : true,
    isArchived: examData.isArchived !== undefined ? examData.isArchived : false,
    dateAdded: examData.dateAdded || now,
    updatedAt: now
  };

  // 1. Save to LocalStorage cache immediately
  const currentExams = (await getAllExams()).filter(e => e.id !== id);
  currentExams.unshift(newExam);
  saveLocalStorageExams(currentExams);

  // 2. Sync to Local Companion API
  try {
    await localDb.post('/exams', newExam);
  } catch (err) {
    console.warn('[LocalDB] Could not sync addExam to Companion server:', err.message);
  }

  // 3. Sync to Supabase if configured
  if (supabase) {
    try {
      await supabase.from('exams').insert({ id, ...mapExamToDB(examData) });
    } catch (err) {
      console.warn('[Supabase] Could not sync addExam to Supabase:', err.message);
    }
  }

  return id;
};

/**
 * Update specific fields of an exam.
 */
export const updateExam = async (examId, updates) => {
  const now = new Date().toISOString();

  // 1. Update LocalStorage cache immediately
  const currentExams = await getAllExams();
  const idx = currentExams.findIndex(e => e.id === examId);
  if (idx !== -1) {
    currentExams[idx] = {
      ...currentExams[idx],
      ...updates,
      updatedAt: now
    };
    saveLocalStorageExams(currentExams);
  }

  // 2. Sync to Local Companion API
  try {
    const localExams = await localDb.get('/exams');
    const eIdx = localExams.findIndex(e => e.id === examId);
    if (eIdx !== -1) {
      const merged = { ...localExams[eIdx], ...updates, updatedAt: now };
      await localDb.post('/exams', merged);
    }
  } catch (err) {
    console.warn('[LocalDB] Could not sync updateExam to Companion server:', err.message);
  }

  // 3. Sync to Supabase
  if (supabase) {
    try {
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
      dbUpdates.updated_at = now;

      await supabase.from('exams').update(dbUpdates).eq('id', examId);
    } catch (err) {
      console.warn('[Supabase] Could not sync updateExam to Supabase:', err.message);
    }
  }
};

/**
 * Toggle active status of an exam.
 */
export const toggleExamStatus = async (examId, currentStatus) => {
  return updateExam(examId, { isActive: !currentStatus });
};

/**
 * Toggle archived status of an exam.
 */
export const toggleArchiveExam = async (examId, currentArchived) => {
  return updateExam(examId, { isArchived: !currentArchived });
};

/**
 * Permanently delete an exam.
 */
export const deleteExam = async (examId) => {
  // 1. Remove from LocalStorage cache immediately
  const currentExams = await getAllExams();
  const filtered = currentExams.filter(e => e.id !== examId);
  saveLocalStorageExams(filtered);

  // 2. Sync delete to Companion server
  try {
    await localDb.delete('/exams', examId);
  } catch (err) {
    console.warn('[LocalDB] Could not sync deleteExam to Companion server:', err.message);
  }

  // 3. Sync delete to Supabase
  if (supabase) {
    try {
      await supabase.from('exams').delete().eq('id', examId);
    } catch (err) {
      console.warn('[Supabase] Could not sync deleteExam to Supabase:', err.message);
    }
  }
};
