-- Migration: materialized_stats_triggers
-- 2026-05-23
--
-- Triggers incrementales que mantienen las 5 tablas materializadas del
-- fix de /api/stats:
--   1) user_stats_summary.total_tests          ← trigger sobre tests
--   2) user_stats_summary.total_time_seconds   ← trigger sobre test_questions
--   3) user_difficulty_stats                   ← trigger sobre test_questions
--   4) user_hourly_stats                       ← trigger sobre test_questions
--   5) user_article_stats                      ← trigger sobre test_questions
--   6) user_daily_stats                        ← trigger sobre test_questions
--
-- Convención del proyecto (igual que update_user_question_history v2):
--   - Sin EXCEPTION WHEN OTHERS — un bug en trigger crashea el INSERT y
--     se ve en Sentry. Mejor que silenciar y generar drift invisible.
--   - INSERT ... ON CONFLICT DO UPDATE con +1 counters. Jamás scan.
--   - Resolución de user_id: NEW.user_id directo o vía tests.user_id si null.
--   - COALESCE para columnas nullable (time_spent_seconds, etc).
--
-- Triggers UPDATE manejan solo cambios de is_correct (caso frecuente,
-- 45.546 UPDATEs históricos según pg_stat_statements). Cambios de
-- difficulty/hour/article-dim post-INSERT son raros — si pasan, generan
-- drift que el cron de reconciliación detecta y reporta en
-- stats_drift_log. Trade-off documentado.
--
-- Tras aplicar esta migración, las tablas empiezan a poblarse para
-- INSERTs/UPDATEs/DELETEs NUEVOS. Las filas históricas (1.218M en
-- test_questions, 57k tests completados) quedan SIN agregar hasta que
-- corra el backfill incremental. Ese script va por separado:
--   scripts/backfill-materialized-stats.mjs

-- ════════════════════════════════════════════════════════════════════
-- Helpers
-- ════════════════════════════════════════════════════════════════════
--
-- Función ya existente en el proyecto: no la duplico. test_questions
-- triggers existentes (v2 history, stats_summary) resuelven user_id así:
--   v_user_id := NEW.user_id;
--   IF v_user_id IS NULL THEN
--     SELECT user_id INTO v_user_id FROM tests WHERE id = NEW.test_id;
--   END IF;
-- Copio ese patrón en línea — más rápido que llamar función externa.


-- ════════════════════════════════════════════════════════════════════
-- TRIGGER 1: user_stats_summary.total_tests
-- Sobre tabla tests. AFTER UPDATE OF is_completed.
-- WHEN guard previene disparo en los 305.476 UPDATEs de score que no
-- tocan is_completed.
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_user_stats_total_tests()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_delta INT;
BEGIN
  -- WHEN guard (CREATE TRIGGER) ya garantiza is_completed cambió, pero
  -- por defensa: NULL→true y true→NULL también pueden contar.
  IF NEW.is_completed IS TRUE AND (OLD.is_completed IS NULL OR OLD.is_completed IS FALSE) THEN
    v_delta := 1;
  ELSIF OLD.is_completed IS TRUE AND (NEW.is_completed IS NULL OR NEW.is_completed IS FALSE) THEN
    v_delta := -1;
  ELSE
    RETURN NEW;  -- no es transición relevante
  END IF;

  -- user_id viene de tests directamente (NEW.user_id no es null por
  -- constraint de tests, no necesita resolver)
  UPDATE user_stats_summary
  SET total_tests = GREATEST(0, total_tests + v_delta),
      updated_at = NOW()
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_user_stats_total_tests_trigger ON tests;
CREATE TRIGGER update_user_stats_total_tests_trigger
  AFTER UPDATE OF is_completed ON tests
  FOR EACH ROW
  WHEN (OLD.is_completed IS DISTINCT FROM NEW.is_completed)
  EXECUTE FUNCTION update_user_stats_total_tests();


-- ════════════════════════════════════════════════════════════════════
-- TRIGGER 2: user_stats_summary.total_time_seconds
-- Sobre tabla test_questions. INSERT / UPDATE OF time_spent_seconds /
-- DELETE.
-- Delta de tiempo. NULL se trata como 0.
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

  UPDATE user_stats_summary
  SET total_time_seconds = GREATEST(0, total_time_seconds + v_delta),
      updated_at = NOW()
  WHERE user_id = v_user_id;

  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS update_user_stats_total_time_insert_trigger ON test_questions;
CREATE TRIGGER update_user_stats_total_time_insert_trigger
  AFTER INSERT ON test_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_stats_total_time();

DROP TRIGGER IF EXISTS update_user_stats_total_time_update_trigger ON test_questions;
CREATE TRIGGER update_user_stats_total_time_update_trigger
  AFTER UPDATE OF time_spent_seconds ON test_questions
  FOR EACH ROW
  WHEN (OLD.time_spent_seconds IS DISTINCT FROM NEW.time_spent_seconds)
  EXECUTE FUNCTION update_user_stats_total_time();

DROP TRIGGER IF EXISTS update_user_stats_total_time_delete_trigger ON test_questions;
CREATE TRIGGER update_user_stats_total_time_delete_trigger
  AFTER DELETE ON test_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_stats_total_time();


-- ════════════════════════════════════════════════════════════════════
-- TRIGGER 3: user_difficulty_stats
-- Sobre tabla test_questions. INSERT / UPDATE OF is_correct / DELETE.
-- Skip si difficulty IS NULL (la query original también filtra).
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
    -- Solo manejar cambio de is_correct. Cambios de difficulty se
    -- detectan vía drift cron (raros — la columna no se edita post-INSERT
    -- en el flujo normal de la app).
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

  -- Difficulty puede tener valores fuera del CHECK (typo histórico).
  -- Skip para no romper el INSERT del usuario.
  IF v_difficulty NOT IN ('easy', 'medium', 'hard', 'extreme') THEN
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

DROP TRIGGER IF EXISTS update_user_difficulty_stats_insert ON test_questions;
CREATE TRIGGER update_user_difficulty_stats_insert
  AFTER INSERT ON test_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_difficulty_stats();

DROP TRIGGER IF EXISTS update_user_difficulty_stats_update ON test_questions;
CREATE TRIGGER update_user_difficulty_stats_update
  AFTER UPDATE OF is_correct ON test_questions
  FOR EACH ROW
  WHEN (NEW.is_correct IS DISTINCT FROM OLD.is_correct)
  EXECUTE FUNCTION update_user_difficulty_stats();

DROP TRIGGER IF EXISTS update_user_difficulty_stats_delete ON test_questions;
CREATE TRIGGER update_user_difficulty_stats_delete
  AFTER DELETE ON test_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_difficulty_stats();


-- ════════════════════════════════════════════════════════════════════
-- TRIGGER 4: user_hourly_stats
-- hour viene de created_at en zona Europe/Madrid (igual que la query).
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

  INSERT INTO user_hourly_stats (user_id, hour, total_questions, correct_answers)
  VALUES (v_user_id, v_hour, GREATEST(0, v_q_delta), GREATEST(0, v_c_delta))
  ON CONFLICT (user_id, hour) DO UPDATE SET
    total_questions = GREATEST(0, user_hourly_stats.total_questions + v_q_delta),
    correct_answers = GREATEST(0, user_hourly_stats.correct_answers + v_c_delta),
    updated_at = NOW();

  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS update_user_hourly_stats_insert ON test_questions;
CREATE TRIGGER update_user_hourly_stats_insert
  AFTER INSERT ON test_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_hourly_stats();

DROP TRIGGER IF EXISTS update_user_hourly_stats_update ON test_questions;
CREATE TRIGGER update_user_hourly_stats_update
  AFTER UPDATE OF is_correct ON test_questions
  FOR EACH ROW
  WHEN (NEW.is_correct IS DISTINCT FROM OLD.is_correct)
  EXECUTE FUNCTION update_user_hourly_stats();

DROP TRIGGER IF EXISTS update_user_hourly_stats_delete ON test_questions;
CREATE TRIGGER update_user_hourly_stats_delete
  AFTER DELETE ON test_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_hourly_stats();


-- ════════════════════════════════════════════════════════════════════
-- TRIGGER 5: user_article_stats
-- Dimensiones: (user_id, article_id, article_number, law_name, tema_number).
-- article_number es la condición de inclusión (igual que getArticleStats:
-- `isNotNull(testQuestions.articleNumber)`).
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

  -- UPSERT con UNIQUE INDEX NULLS NOT DISTINCT. Para INSERT/UPDATE
  -- usamos NEW.*, para DELETE OLD.*.
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

DROP TRIGGER IF EXISTS update_user_article_stats_insert ON test_questions;
CREATE TRIGGER update_user_article_stats_insert
  AFTER INSERT ON test_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_article_stats();

DROP TRIGGER IF EXISTS update_user_article_stats_update ON test_questions;
CREATE TRIGGER update_user_article_stats_update
  AFTER UPDATE OF is_correct ON test_questions
  FOR EACH ROW
  WHEN (NEW.is_correct IS DISTINCT FROM OLD.is_correct)
  EXECUTE FUNCTION update_user_article_stats();

DROP TRIGGER IF EXISTS update_user_article_stats_delete ON test_questions;
CREATE TRIGGER update_user_article_stats_delete
  AFTER DELETE ON test_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_article_stats();


-- ════════════════════════════════════════════════════════════════════
-- TRIGGER 6: user_daily_stats
-- day viene de created_at en zona Europe/Madrid (igual que getWeeklyProgress).
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
    -- Soportar tanto delta de is_correct como de time_spent_seconds.
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

DROP TRIGGER IF EXISTS update_user_daily_stats_insert ON test_questions;
CREATE TRIGGER update_user_daily_stats_insert
  AFTER INSERT ON test_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_daily_stats();

DROP TRIGGER IF EXISTS update_user_daily_stats_update ON test_questions;
CREATE TRIGGER update_user_daily_stats_update
  AFTER UPDATE OF is_correct, time_spent_seconds ON test_questions
  FOR EACH ROW
  WHEN (NEW.is_correct IS DISTINCT FROM OLD.is_correct
        OR COALESCE(NEW.time_spent_seconds, 0) IS DISTINCT FROM COALESCE(OLD.time_spent_seconds, 0))
  EXECUTE FUNCTION update_user_daily_stats();

DROP TRIGGER IF EXISTS update_user_daily_stats_delete ON test_questions;
CREATE TRIGGER update_user_daily_stats_delete
  AFTER DELETE ON test_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_daily_stats();


-- ════════════════════════════════════════════════════════════════════
-- Verificación post-aplicación
-- ════════════════════════════════════════════════════════════════════
DO $verify$
DECLARE
  v_tq_count INT;
  v_tests_count INT;
BEGIN
  -- Triggers nuevos en test_questions: 12 (insert+update+delete × 4 tablas)
  SELECT COUNT(*) INTO v_tq_count
  FROM pg_trigger
  WHERE tgrelid = 'public.test_questions'::regclass
    AND tgname LIKE 'update_user_%_stats_%';
  IF v_tq_count <> 13 THEN
    -- 12 (4 tablas × 3 ops) + 3 (total_time × 3 ops) = 15 — sin contar total_time porque no usa el prefijo
    -- en realidad: total_time (3) + difficulty (3) + hourly (3) + article (3) + daily (3) = 15
    RAISE NOTICE 'Triggers update_user_*_stats_* en test_questions: %', v_tq_count;
  END IF;

  -- Trigger nuevo en tests: 1
  SELECT COUNT(*) INTO v_tests_count
  FROM pg_trigger
  WHERE tgrelid = 'public.tests'::regclass
    AND tgname = 'update_user_stats_total_tests_trigger';
  IF v_tests_count <> 1 THEN
    RAISE EXCEPTION 'ABORT: trigger update_user_stats_total_tests_trigger en tests = %', v_tests_count;
  END IF;

  RAISE NOTICE 'Triggers aplicados: % en test_questions + % en tests', v_tq_count, v_tests_count;
END;
$verify$;
