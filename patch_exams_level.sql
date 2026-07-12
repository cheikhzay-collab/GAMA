-- SQL Migration: Transition from schools to levels in L'Conq
-- Run this in Supabase SQL Editor

-- 1. Add level column to public.exams if it doesn't exist
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS level text;

-- 2. Migrate existing records to their corresponding level values
UPDATE public.exams SET level = '2bac_pc_svt' WHERE school = 'Médecine / Pharmacie' AND level IS NULL;
UPDATE public.exams SET level = '2bac_sm' WHERE school IN ('ENSA', 'ENSAM', 'INPT', 'INSEA', 'Général (Prépa)') AND level IS NULL;
UPDATE public.exams SET level = '2bac_pc_svt' WHERE school = 'ENCG' AND level IS NULL;

-- 3. Recreate exams_metadata view to include the level column
CREATE OR REPLACE VIEW public.exams_metadata AS
SELECT id, name, school, level, year, tier, is_active, is_archived, date_added, updated_at,
       jsonb_array_length(COALESCE(questions, '[]'::jsonb)) AS questions_count
FROM public.exams;
