-- 2026-05-08-user-stats-summary-triggers.sql
--
-- Cierra hueco de consistencia en user_stats_summary detectado por
-- __tests__/api/user-stats/userStatsSummary.test.ts (test "summary matches
-- count(*) for a heavy user"): 4 usuarios tienen total_questions
-- desincronizado vs el detalle real en test_questions.
--
-- Causa: el trigger update_user_stats_summary_trigger solo dispara en
-- INSERT AFTER. UPDATE de is_correct/was_blank y DELETE de filas en
-- test_questions no reflejaban en el agregado, así que cualquier corrección
-- post-respuesta o borrado de test rompía la invariante.
--
-- Solución en dos partes:
--
--   1. Backfill: recalcular user_stats_summary desde 0 para todos los
--      usuarios usando el detalle de test_questions. Esto garantiza que
--      todos los mismatches actuales se corrigen, no solo los 4 detectados.
--
--   2. Triggers nuevos para UPDATE y DELETE: mantener el agregado en sync
--      ante cualquier cambio futuro. Pattern: en UPDATE solo importa si
--      cambian is_correct o was_blank (las que entran al summary). En
--      DELETE hay que decrementar contadores.
--
-- Idempotente:
--   - Backfill usa TRUNCATE + INSERT, no acumula filas duplicadas.
--   - CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS antes de CREATE.

-- ============================================================================
-- 1. Backfill desde 0
-- ============================================================================
-- Strategy: borrar todo + reinsertar desde el detalle. Más simple que UPDATE
-- diferencial y garantiza estado consistente.

BEGIN;

TRUNCATE TABLE user_stats_summary;

INSERT INTO user_stats_summary (
  user_id, total_questions, correct_answers, blank_answers,
  questions_this_week, week_start, updated_at
)
SELECT
  t.user_id,
  COUNT(*)::int AS total_questions,
  SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::int AS correct_answers,
  SUM(CASE WHEN tq.was_blank THEN 1 ELSE 0 END)::int AS blank_answers,
  -- questions_this_week: contar solo respondidas durante la semana actual
  SUM(CASE
    WHEN date_trunc('week', tq.created_at)::date = date_trunc('week', now())::date
    THEN 1 ELSE 0
  END)::int AS questions_this_week,
  date_trunc('week', now())::date AS week_start,
  now() AS updated_at
FROM test_questions tq
INNER JOIN tests t ON tq.test_id = t.id
WHERE t.user_id IS NOT NULL
GROUP BY t.user_id;

COMMIT;

-- ============================================================================
-- 2. Trigger ON UPDATE de test_questions
-- ============================================================================
-- Solo recalculamos si cambian is_correct o was_blank (las columnas que
-- entran al agregado). Si solo cambia tiempo, score, etc., no toca summary.

CREATE OR REPLACE FUNCTION public.update_user_stats_summary_on_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id UUID;
  v_correct_delta INT := 0;
  v_blank_delta INT := 0;
BEGIN
  -- Solo actuar si cambia algo relevante
  IF NEW.is_correct IS NOT DISTINCT FROM OLD.is_correct
     AND NEW.was_blank IS NOT DISTINCT FROM OLD.was_blank THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO v_user_id FROM tests WHERE id = NEW.test_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  -- Calcular delta para is_correct
  IF NEW.is_correct AND NOT OLD.is_correct THEN v_correct_delta := 1;
  ELSIF NOT NEW.is_correct AND OLD.is_correct THEN v_correct_delta := -1;
  END IF;

  -- Calcular delta para was_blank
  IF NEW.was_blank AND NOT OLD.was_blank THEN v_blank_delta := 1;
  ELSIF NOT NEW.was_blank AND OLD.was_blank THEN v_blank_delta := -1;
  END IF;

  UPDATE user_stats_summary
  SET correct_answers = GREATEST(0, correct_answers + v_correct_delta),
      blank_answers = GREATEST(0, blank_answers + v_blank_delta),
      updated_at = now()
  WHERE user_id = v_user_id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS update_user_stats_summary_on_update_trigger ON test_questions;
CREATE TRIGGER update_user_stats_summary_on_update_trigger
AFTER UPDATE OF is_correct, was_blank ON test_questions
FOR EACH ROW EXECUTE FUNCTION public.update_user_stats_summary_on_update();

-- ============================================================================
-- 3. Trigger ON DELETE de test_questions
-- ============================================================================
-- Decrementar todos los contadores. Si questions_this_week cae a 0 antes
-- del lunes que viene, se queda en 0 hasta el reset semanal natural — está bien.

CREATE OR REPLACE FUNCTION public.update_user_stats_summary_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id UUID;
  v_was_this_week BOOLEAN;
BEGIN
  SELECT user_id INTO v_user_id FROM tests WHERE id = OLD.test_id;
  IF v_user_id IS NULL THEN RETURN OLD; END IF;

  v_was_this_week := date_trunc('week', OLD.created_at)::date = date_trunc('week', now())::date;

  UPDATE user_stats_summary
  SET total_questions = GREATEST(0, total_questions - 1),
      correct_answers = GREATEST(0, correct_answers - CASE WHEN OLD.is_correct THEN 1 ELSE 0 END),
      blank_answers = GREATEST(0, blank_answers - CASE WHEN OLD.was_blank THEN 1 ELSE 0 END),
      questions_this_week = CASE
        WHEN v_was_this_week THEN GREATEST(0, questions_this_week - 1)
        ELSE questions_this_week
      END,
      updated_at = now()
  WHERE user_id = v_user_id;

  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS update_user_stats_summary_on_delete_trigger ON test_questions;
CREATE TRIGGER update_user_stats_summary_on_delete_trigger
AFTER DELETE ON test_questions
FOR EACH ROW EXECUTE FUNCTION public.update_user_stats_summary_on_delete();

-- ============================================================================
-- 4. Verificación
-- ============================================================================
DO $$
DECLARE
  v_mismatches INT;
BEGIN
  SELECT COUNT(*) INTO v_mismatches FROM (
    SELECT s.user_id
    FROM user_stats_summary s
    WHERE s.total_questions != (
      SELECT COUNT(*) FROM test_questions tq
      INNER JOIN tests t ON tq.test_id = t.id
      WHERE t.user_id = s.user_id
    )
  ) sub;

  IF v_mismatches > 0 THEN
    RAISE NOTICE 'AVISO: aún hay % usuarios con mismatch tras backfill.', v_mismatches;
  ELSE
    RAISE NOTICE 'OK: 0 mismatches en user_stats_summary tras backfill + nuevos triggers.';
  END IF;
END $$;
