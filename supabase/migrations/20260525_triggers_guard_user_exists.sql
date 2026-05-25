-- Migration: triggers_guard_user_exists
-- 2026-05-25
--
-- Añade guard `EXISTS user_profiles` a las 6 funciones de trigger
-- materializadoras introducidas en 20260523_materialized_stats_triggers.sql.
--
-- ¿Por qué? El flujo /api/admin/delete-user (eliminación RGPD) ejecuta
-- DELETE FROM user_profiles que dispara cascadas en orden no determinista.
-- Cuando la cascada llega a DELETE FROM test_questions, los triggers
-- AFTER DELETE hacen UPSERT en user_stats_summary / user_article_stats /
-- user_daily_stats / user_difficulty_stats / user_hourly_stats con un
-- user_id que ya está siendo borrado en esa misma transacción → la fila
-- re-creada por el UPSERT viola la FK al confirmar el DELETE de
-- user_profiles → ROLLBACK del DELETE entero. Bug detectado el 2026-05-25
-- procesando 3 account_deletions RGPD (Casos B y C requirieron fallback
-- manual; antes de este fix, la API delete-user reportaba success=true
-- aunque user_profiles + auth.users sobrevivieran).
--
-- Defense in depth: el endpoint /api/admin/delete-user también se
-- reordenó (queries.ts borra test_questions + tests + 5 stats explícito
-- antes de user_profiles) — esto cubre el happy path. El guard en BD
-- cubre CUALQUIER flujo futuro de DELETE de tests (SQL manual, cron de
-- cleanup, migración a backend NestJS, etc.) sin que el dev tenga que
-- acordarse de actualizar listas.
--
-- Coste por trigger: 1 PK lookup en user_profiles.id (~0.05ms).
-- Despreciable vs el coste de las UPSERTs que ya hace cada trigger.
--
-- Patrón aplicado (igual en las 6 funciones, justo antes del UPSERT/UPDATE):
--
--   IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = v_user_id) THEN
--     RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
--   END IF;
--
-- Rollback: re-aplicar 20260523_materialized_stats_triggers.sql (CREATE
-- OR REPLACE FUNCTION sobrescribe sin tocar los CREATE TRIGGER).


-- ════════════════════════════════════════════════════════════════════
-- TRIGGER 1: user_stats_summary.total_tests (sobre tests)
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_user_stats_total_tests()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_delta INT;
BEGIN
  IF NEW.is_completed IS TRUE AND (OLD.is_completed IS NULL OR OLD.is_completed IS FALSE) THEN
    v_delta := 1;
  ELSIF OLD.is_completed IS TRUE AND (NEW.is_completed IS NULL OR NEW.is_completed IS FALSE) THEN
    v_delta := -1;
  ELSE
    RETURN NEW;
  END IF;

  -- Guard: si user_profiles ya no existe (mid-cascade DELETE RGPD),
  -- no recrear filas — la cascada de user_stats_summary ya las borró.
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = NEW.user_id) THEN
    RETURN NEW;
  END IF;

  UPDATE user_stats_summary
  SET total_tests = GREATEST(0, total_tests + v_delta),
      updated_at = NOW()
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$;


-- ════════════════════════════════════════════════════════════════════
-- TRIGGER 2: user_stats_summary.total_time_seconds (sobre test_questions)
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_user_stats_total_time()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_delta BIGINT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_delta := COALESCE(NEW.time_spent_seconds, 0);
    v_user_id := NEW.user_id;
    IF v_user_id IS NULL THEN
      SELECT user_id INTO v_user_id FROM tests WHERE id = NEW.test_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    v_delta := COALESCE(NEW.time_spent_seconds, 0) - COALESCE(OLD.time_spent_seconds, 0);
    IF v_delta = 0 THEN RETURN NEW; END IF;
    v_user_id := NEW.user_id;
    IF v_user_id IS NULL THEN
      SELECT user_id INTO v_user_id FROM tests WHERE id = NEW.test_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_delta := -COALESCE(OLD.time_spent_seconds, 0);
    v_user_id := OLD.user_id;
    IF v_user_id IS NULL THEN
      SELECT user_id INTO v_user_id FROM tests WHERE id = OLD.test_id;
    END IF;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF v_delta = 0 THEN
    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  -- Guard: ver explicación en TRIGGER 1.
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = v_user_id) THEN
    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  UPDATE user_stats_summary
  SET total_time_seconds = GREATEST(0, total_time_seconds + v_delta),
      updated_at = NOW()
  WHERE user_id = v_user_id;

  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$;


-- ════════════════════════════════════════════════════════════════════
-- TRIGGER 3: user_difficulty_stats (sobre test_questions)
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_user_difficulty_stats()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_difficulty TEXT;
  v_q_delta INT := 0;
  v_c_delta INT := 0;
  v_t_delta BIGINT := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.difficulty IS NULL THEN RETURN NEW; END IF;
    v_user_id := NEW.user_id;
    IF v_user_id IS NULL THEN SELECT user_id INTO v_user_id FROM tests WHERE id = NEW.test_id; END IF;
    v_difficulty := NEW.difficulty;
    v_q_delta := 1;
    v_c_delta := CASE WHEN NEW.is_correct THEN 1 ELSE 0 END;
    v_t_delta := COALESCE(NEW.time_spent_seconds, 0);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.difficulty IS NULL THEN RETURN NEW; END IF;
    IF NEW.is_correct IS NOT DISTINCT FROM OLD.is_correct THEN RETURN NEW; END IF;
    v_user_id := NEW.user_id;
    IF v_user_id IS NULL THEN SELECT user_id INTO v_user_id FROM tests WHERE id = NEW.test_id; END IF;
    v_difficulty := NEW.difficulty;
    IF NEW.is_correct IS TRUE AND (OLD.is_correct IS NULL OR OLD.is_correct IS FALSE) THEN
      v_c_delta := 1;
    ELSIF OLD.is_correct IS TRUE AND (NEW.is_correct IS NULL OR NEW.is_correct IS FALSE) THEN
      v_c_delta := -1;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.difficulty IS NULL THEN RETURN OLD; END IF;
    v_user_id := OLD.user_id;
    IF v_user_id IS NULL THEN SELECT user_id INTO v_user_id FROM tests WHERE id = OLD.test_id; END IF;
    v_difficulty := OLD.difficulty;
    v_q_delta := -1;
    v_c_delta := CASE WHEN OLD.is_correct THEN -1 ELSE 0 END;
    v_t_delta := -COALESCE(OLD.time_spent_seconds, 0);
  END IF;

  IF v_user_id IS NULL THEN
    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF v_difficulty NOT IN ('easy', 'medium', 'hard', 'extreme') THEN
    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  -- Guard: ver explicación en TRIGGER 1.
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = v_user_id) THEN
    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  INSERT INTO user_difficulty_stats (user_id, difficulty, total_questions, correct_answers, total_time_seconds)
  VALUES (v_user_id, v_difficulty, GREATEST(0, v_q_delta), GREATEST(0, v_c_delta), GREATEST(0, v_t_delta))
  ON CONFLICT (user_id, difficulty) DO UPDATE SET
    total_questions = GREATEST(0, user_difficulty_stats.total_questions + v_q_delta),
    correct_answers = GREATEST(0, user_difficulty_stats.correct_answers + v_c_delta),
    total_time_seconds = GREATEST(0, user_difficulty_stats.total_time_seconds + v_t_delta),
    updated_at = NOW();

  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$;


-- ════════════════════════════════════════════════════════════════════
-- TRIGGER 4: user_hourly_stats (sobre test_questions)
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_user_hourly_stats()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_hour SMALLINT;
  v_q_delta INT := 0;
  v_c_delta INT := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_user_id := NEW.user_id;
    IF v_user_id IS NULL THEN SELECT user_id INTO v_user_id FROM tests WHERE id = NEW.test_id; END IF;
    v_hour := EXTRACT(HOUR FROM NEW.created_at AT TIME ZONE 'Europe/Madrid')::SMALLINT;
    v_q_delta := 1;
    v_c_delta := CASE WHEN NEW.is_correct THEN 1 ELSE 0 END;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_correct IS NOT DISTINCT FROM OLD.is_correct THEN RETURN NEW; END IF;
    v_user_id := NEW.user_id;
    IF v_user_id IS NULL THEN SELECT user_id INTO v_user_id FROM tests WHERE id = NEW.test_id; END IF;
    v_hour := EXTRACT(HOUR FROM NEW.created_at AT TIME ZONE 'Europe/Madrid')::SMALLINT;
    IF NEW.is_correct IS TRUE AND (OLD.is_correct IS NULL OR OLD.is_correct IS FALSE) THEN
      v_c_delta := 1;
    ELSIF OLD.is_correct IS TRUE AND (NEW.is_correct IS NULL OR NEW.is_correct IS FALSE) THEN
      v_c_delta := -1;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
    IF v_user_id IS NULL THEN SELECT user_id INTO v_user_id FROM tests WHERE id = OLD.test_id; END IF;
    v_hour := EXTRACT(HOUR FROM OLD.created_at AT TIME ZONE 'Europe/Madrid')::SMALLINT;
    v_q_delta := -1;
    v_c_delta := CASE WHEN OLD.is_correct THEN -1 ELSE 0 END;
  END IF;

  IF v_user_id IS NULL OR v_hour IS NULL THEN
    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  -- Guard: ver explicación en TRIGGER 1.
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = v_user_id) THEN
    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  INSERT INTO user_hourly_stats (user_id, hour, total_questions, correct_answers)
  VALUES (v_user_id, v_hour, GREATEST(0, v_q_delta), GREATEST(0, v_c_delta))
  ON CONFLICT (user_id, hour) DO UPDATE SET
    total_questions = GREATEST(0, user_hourly_stats.total_questions + v_q_delta),
    correct_answers = GREATEST(0, user_hourly_stats.correct_answers + v_c_delta),
    updated_at = NOW();

  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$;


-- ════════════════════════════════════════════════════════════════════
-- TRIGGER 5: user_article_stats (sobre test_questions)
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_user_article_stats()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_q_delta INT := 0;
  v_c_delta INT := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.article_number IS NULL THEN RETURN NEW; END IF;
    v_user_id := NEW.user_id;
    IF v_user_id IS NULL THEN SELECT user_id INTO v_user_id FROM tests WHERE id = NEW.test_id; END IF;
    v_q_delta := 1;
    v_c_delta := CASE WHEN NEW.is_correct THEN 1 ELSE 0 END;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.article_number IS NULL THEN RETURN NEW; END IF;
    IF NEW.is_correct IS NOT DISTINCT FROM OLD.is_correct THEN RETURN NEW; END IF;
    v_user_id := NEW.user_id;
    IF v_user_id IS NULL THEN SELECT user_id INTO v_user_id FROM tests WHERE id = NEW.test_id; END IF;
    IF NEW.is_correct IS TRUE AND (OLD.is_correct IS NULL OR OLD.is_correct IS FALSE) THEN
      v_c_delta := 1;
    ELSIF OLD.is_correct IS TRUE AND (NEW.is_correct IS NULL OR NEW.is_correct IS FALSE) THEN
      v_c_delta := -1;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.article_number IS NULL THEN RETURN OLD; END IF;
    v_user_id := OLD.user_id;
    IF v_user_id IS NULL THEN SELECT user_id INTO v_user_id FROM tests WHERE id = OLD.test_id; END IF;
    v_q_delta := -1;
    v_c_delta := CASE WHEN OLD.is_correct THEN -1 ELSE 0 END;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  -- Guard: ver explicación en TRIGGER 1.
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = v_user_id) THEN
    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO user_article_stats (user_id, article_id, article_number, law_name, tema_number, total_questions, correct_answers)
    VALUES (v_user_id, OLD.article_id, OLD.article_number, OLD.law_name, OLD.tema_number, GREATEST(0, v_q_delta), GREATEST(0, v_c_delta))
    ON CONFLICT (user_id, article_id, article_number, law_name, tema_number) DO UPDATE SET
      total_questions = GREATEST(0, user_article_stats.total_questions + v_q_delta),
      correct_answers = GREATEST(0, user_article_stats.correct_answers + v_c_delta),
      updated_at = NOW();
    RETURN OLD;
  ELSE
    INSERT INTO user_article_stats (user_id, article_id, article_number, law_name, tema_number, total_questions, correct_answers)
    VALUES (v_user_id, NEW.article_id, NEW.article_number, NEW.law_name, NEW.tema_number, GREATEST(0, v_q_delta), GREATEST(0, v_c_delta))
    ON CONFLICT (user_id, article_id, article_number, law_name, tema_number) DO UPDATE SET
      total_questions = GREATEST(0, user_article_stats.total_questions + v_q_delta),
      correct_answers = GREATEST(0, user_article_stats.correct_answers + v_c_delta),
      updated_at = NOW();
    RETURN NEW;
  END IF;
END;
$$;


-- ════════════════════════════════════════════════════════════════════
-- TRIGGER 6: user_daily_stats (sobre test_questions)
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_user_daily_stats()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_day DATE;
  v_q_delta INT := 0;
  v_c_delta INT := 0;
  v_t_delta BIGINT := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_user_id := NEW.user_id;
    IF v_user_id IS NULL THEN SELECT user_id INTO v_user_id FROM tests WHERE id = NEW.test_id; END IF;
    v_day := (NEW.created_at AT TIME ZONE 'Europe/Madrid')::DATE;
    v_q_delta := 1;
    v_c_delta := CASE WHEN NEW.is_correct THEN 1 ELSE 0 END;
    v_t_delta := COALESCE(NEW.time_spent_seconds, 0);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_correct IS NOT DISTINCT FROM OLD.is_correct
       AND COALESCE(NEW.time_spent_seconds, 0) = COALESCE(OLD.time_spent_seconds, 0) THEN
      RETURN NEW;
    END IF;
    v_user_id := NEW.user_id;
    IF v_user_id IS NULL THEN SELECT user_id INTO v_user_id FROM tests WHERE id = NEW.test_id; END IF;
    v_day := (NEW.created_at AT TIME ZONE 'Europe/Madrid')::DATE;
    IF NEW.is_correct IS TRUE AND (OLD.is_correct IS NULL OR OLD.is_correct IS FALSE) THEN
      v_c_delta := 1;
    ELSIF OLD.is_correct IS TRUE AND (NEW.is_correct IS NULL OR NEW.is_correct IS FALSE) THEN
      v_c_delta := -1;
    END IF;
    v_t_delta := COALESCE(NEW.time_spent_seconds, 0) - COALESCE(OLD.time_spent_seconds, 0);
  ELSIF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
    IF v_user_id IS NULL THEN SELECT user_id INTO v_user_id FROM tests WHERE id = OLD.test_id; END IF;
    v_day := (OLD.created_at AT TIME ZONE 'Europe/Madrid')::DATE;
    v_q_delta := -1;
    v_c_delta := CASE WHEN OLD.is_correct THEN -1 ELSE 0 END;
    v_t_delta := -COALESCE(OLD.time_spent_seconds, 0);
  END IF;

  IF v_user_id IS NULL OR v_day IS NULL THEN
    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  -- Guard: ver explicación en TRIGGER 1.
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = v_user_id) THEN
    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  INSERT INTO user_daily_stats (user_id, day, total_questions, correct_answers, total_time_seconds)
  VALUES (v_user_id, v_day, GREATEST(0, v_q_delta), GREATEST(0, v_c_delta), GREATEST(0, v_t_delta))
  ON CONFLICT (user_id, day) DO UPDATE SET
    total_questions = GREATEST(0, user_daily_stats.total_questions + v_q_delta),
    correct_answers = GREATEST(0, user_daily_stats.correct_answers + v_c_delta),
    total_time_seconds = GREATEST(0, user_daily_stats.total_time_seconds + v_t_delta),
    updated_at = NOW();

  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$;


-- ════════════════════════════════════════════════════════════════════
-- Verificación post-aplicación
-- ════════════════════════════════════════════════════════════════════
DO $verify$
DECLARE
  v_funcs_with_guard INT;
BEGIN
  -- Las 6 funciones deben contener el guard EXISTS user_profiles.
  SELECT COUNT(*) INTO v_funcs_with_guard
  FROM pg_proc
  WHERE proname IN (
    'update_user_stats_total_tests',
    'update_user_stats_total_time',
    'update_user_difficulty_stats',
    'update_user_hourly_stats',
    'update_user_article_stats',
    'update_user_daily_stats'
  )
    AND prosrc LIKE '%FROM user_profiles WHERE id =%';

  IF v_funcs_with_guard <> 6 THEN
    RAISE EXCEPTION 'ABORT: solo % de 6 funciones contienen el guard EXISTS user_profiles', v_funcs_with_guard;
  END IF;

  RAISE NOTICE 'Guard EXISTS user_profiles añadido a las 6 funciones materializadoras.';
END;
$verify$;
