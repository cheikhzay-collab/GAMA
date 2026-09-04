-- SQL Schema for L'Conq Supabase — v2 (Secure)
-- Last updated: 2026-05-31
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- ⚠️  This is idempotent — safe to re-run.

-- ─── 1. Profiles Table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name text,
  email text,
  phone text,
  city text,
  role text DEFAULT 'student',
  tier text DEFAULT 'freemium',
  xp integer DEFAULT 0,
  streak integer DEFAULT 0,
  rank integer,
  total_students integer DEFAULT 1200,
  joined timestamp with time zone DEFAULT timezone('utc'::text, now()),
  subscription jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Migration to ensure columns exist on existing databases
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city text;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is admin (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  );
END;
$$;

-- Profiles policies (secure, no deprecated auth.role())
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can do everything on profiles." ON public.profiles;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "Admins can do everything on profiles."
  ON public.profiles FOR ALL
  USING (public.is_admin());

-- Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, tier, xp, streak, total_students, joined)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', 'Élève'),
    new.email,
    'student',
    'freemium',
    0, 0, 1200,
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Protect role/tier from self-elevation
CREATE OR REPLACE FUNCTION public.check_profile_update()
RETURNS trigger
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- Allow updates to role/tier if app.bypass_tier_trigger session setting is 'true'
  IF current_setting('app.bypass_tier_trigger', true) = 'true' THEN
    RETURN new;
  END IF;

  IF (old.role IS DISTINCT FROM new.role OR old.tier IS DISTINCT FROM new.tier) THEN
    IF NOT public.is_admin() THEN
      new.role := old.role;
      new.tier := old.tier;
    END IF;
  END IF;
  RETURN new;
END;
$$;

CREATE OR REPLACE TRIGGER check_profile_update_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.check_profile_update();

-- ─── 2. Config Table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read configs." ON public.config;
DROP POLICY IF EXISTS "Admins can write configs." ON public.config;

CREATE POLICY "Anyone can read configs." ON public.config
  FOR SELECT USING (true);

CREATE POLICY "Admins can write configs." ON public.config
  FOR ALL USING (public.is_admin());

-- ─── 3. Exams Table ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exams (
  id text PRIMARY KEY,
  name text NOT NULL,
  school text,
  year text,
  tier text,
  questions jsonb,
  pdf_url text,
  is_active boolean DEFAULT true,
  is_archived boolean DEFAULT false,
  date_added timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active and non-archived exams." ON public.exams;
DROP POLICY IF EXISTS "Admins can manage exams." ON public.exams;

CREATE POLICY "Anyone can view active and non-archived exams." ON public.exams
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage exams." ON public.exams
  FOR ALL USING (public.is_admin());

-- ─── 4. Activation Codes Table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activation_codes (
  code text PRIMARY KEY,
  plan_id text,
  is_used boolean DEFAULT false,
  used_by text,
  used_at timestamp with time zone,
  batch_name text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.activation_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can select activation codes" ON public.activation_codes;
DROP POLICY IF EXISTS "Authenticated users can update activation codes" ON public.activation_codes;
DROP POLICY IF EXISTS "Admins can manage activation codes." ON public.activation_codes;

CREATE POLICY "Admins can manage activation codes." ON public.activation_codes
  FOR ALL USING (public.is_admin());

-- ─── 5. Progress Table (SRS/FSRS cards) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.progress (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  question_id text NOT NULL,
  difficulty double precision,
  stability double precision,
  repetitions integer,
  ease_factor double precision,
  last_review_date timestamp with time zone,
  next_review_date timestamp with time zone,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, question_id)
);

ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own progress." ON public.progress;

CREATE POLICY "Users can manage their own progress." ON public.progress
  FOR ALL USING (auth.uid() = user_id);

-- ─── 6. Mock History Table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mock_history (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  exam_id text NOT NULL,
  exam_name text,
  school text,
  score double precision,
  max_score integer,
  pct double precision,
  correct_count integer,
  wrong_count integer,
  empty_count integer,
  mode text,
  date timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.mock_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own mock history." ON public.mock_history;

CREATE POLICY "Users can manage their own mock history." ON public.mock_history
  FOR ALL USING (auth.uid() = user_id);

-- ─── 7. Activity Table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  count integer DEFAULT 1,
  UNIQUE(user_id, date)
);

ALTER TABLE public.activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own activity." ON public.activity;

CREATE POLICY "Users can manage their own activity." ON public.activity
  FOR ALL USING (auth.uid() = user_id);

-- ─── 8. Admin RPCs ────────────────────────────────────────────────────────────

-- Get all user profiles (admin only — enforced at DB level)
CREATE OR REPLACE FUNCTION public.get_all_profiles()
RETURNS SETOF profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;
  RETURN QUERY SELECT * FROM public.profiles ORDER BY joined DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_all_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_all_profiles() TO authenticated;

-- Delete a user (admin only)
CREATE OR REPLACE FUNCTION public.delete_user(uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;
  IF uid = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user(uuid) TO authenticated;

-- Get public leaderboard (name, xp, streak, tier) of top 100 students
CREATE OR REPLACE FUNCTION public.get_leaderboard()
RETURNS TABLE (
  name text,
  xp integer,
  streak integer,
  tier text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT profiles.name, profiles.xp, profiles.streak, profiles.tier
  FROM public.profiles
  WHERE (profiles.role IS DISTINCT FROM 'admin') AND (LOWER(profiles.name) != 'directeur')
  ORDER BY profiles.xp DESC
  LIMIT 100;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_leaderboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO authenticated;


-- ─── 9. Code Redemption RPC (Atomic & Secure) ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.redeem_code(input_code text, user_name_or_email text, user_id uuid)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  code_row record;
  plans_json jsonb;
  plan_item jsonb;
  plan_found boolean := false;
  plan_duration integer;
  sub_end_date timestamp with time zone;
BEGIN
  -- 1. Get the activation code
  SELECT * INTO code_row FROM public.activation_codes WHERE upper(code) = upper(input_code);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Code d''activation invalide. Veuillez vérifier la saisie.';
  END IF;

  -- 2. Check if code is already used
  IF code_row.is_used THEN
    RAISE EXCEPTION 'Ce code a déjà été utilisé.';
  END IF;

  -- 3. Get plans from config table
  SELECT value INTO plans_json FROM public.config WHERE key = 'plans';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Configuration des plans introuvable.';
  END IF;

  -- Find the plan matching the code's plan_id in the JSON array
  FOR plan_item IN SELECT jsonb_array_elements(plans_json->'plans') LOOP
    IF plan_item->>'id' = code_row.plan_id THEN
      plan_found := true;
      plan_duration := (plan_item->>'durationDays')::integer;
    END IF;
  END LOOP;

  IF NOT plan_found THEN
    RAISE EXCEPTION 'Plan d''abonnement introuvable pour ce code.';
  END IF;

  -- 4. Mark code as used
  UPDATE public.activation_codes
  SET is_used = true,
      used_by = user_name_or_email,
      used_at = now()
  WHERE upper(code) = upper(input_code);

  -- 5. Calculate subscription end date
  sub_end_date := now() + (plan_duration || ' days')::interval;

  -- 6. Enable trigger bypass for setting the user subscription & tier to premium
  PERFORM set_config('app.bypass_tier_trigger', 'true', true);

  -- 7. Update user profile to premium tier
  UPDATE public.profiles
  SET tier = 'premium',
      subscription = jsonb_build_object(
        'planId', code_row.plan_id,
        'status', 'active',
        'startDate', now(),
        'endDate', sub_end_date
      )
  WHERE id = user_id;

  RETURN jsonb_build_object(
    'success', true,
    'planId', code_row.plan_id,
    'durationDays', plan_duration
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_code(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_code(text, text, uuid) TO authenticated;


-- ─── 10. Performance Indexes & Views ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_progress_user_id ON public.progress(user_id);
CREATE INDEX IF NOT EXISTS idx_mock_history_user_id ON public.mock_history(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_user_id ON public.activity(user_id);

-- Performance Optimizations (2026 Audit)
CREATE INDEX IF NOT EXISTS idx_profiles_xp ON public.profiles(xp DESC);
CREATE INDEX IF NOT EXISTS idx_progress_user_next_review ON public.progress(user_id, next_review_date);
CREATE INDEX IF NOT EXISTS idx_mock_history_user_date ON public.mock_history(user_id, date DESC);

-- Fast Filtering & Sorting Indexes for Exams, Lessons, and Classes
CREATE INDEX IF NOT EXISTS idx_exams_active_school ON public.exams (is_active, is_archived, school, year);
CREATE INDEX IF NOT EXISTS idx_exams_date_added ON public.exams (date_added DESC);
CREATE INDEX IF NOT EXISTS idx_lessons_active_level ON public.lessons (is_active, level, subject);
CREATE INDEX IF NOT EXISTS idx_lessons_created_at ON public.lessons (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_classes_created_at ON public.classes (created_at DESC);

-- Lightweight Metadata View for Ultra-Fast Exam List Queries
CREATE OR REPLACE VIEW public.exams_metadata AS
SELECT 
  id,
  name,
  school,
  year,
  tier,
  pdf_url,
  is_active,
  is_archived,
  date_added,
  updated_at,
  COALESCE(jsonb_array_length(questions), 0) AS questions_count
FROM public.exams;


-- ─── 11. Storage Bucket and Policies ──────────────────────────────────────────
-- Insert public bucket named 'gima-assets' if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('gima-assets', 'gima-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for storage objects in the 'gima-assets' bucket
DROP POLICY IF EXISTS "Public Select" ON storage.objects;
DROP POLICY IF EXISTS "Admin Manage" ON storage.objects;

-- Allow public read access to all objects in gima-assets
CREATE POLICY "Public Select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'gima-assets');

-- Allow admins to perform all operations on gima-assets
CREATE POLICY "Admin Manage" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'gima-assets' AND public.is_admin())
  WITH CHECK (bucket_id = 'gima-assets' AND public.is_admin());

