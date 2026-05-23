-- Migration: drop_noop_triggers_test_questions
-- 2026-05-23
--
-- Contexto: durante la auditoría de los 14 triggers activos sobre
-- public.test_questions (precondición del fix de fondo de /api/stats —
-- ver docs/ARCHITECTURE_ROADMAP.md → ADR triggers SQL vs outbox) se
-- detectaron 2 triggers que sólo ejecutan `RETURN NEW`:
--
--   1) auto_update_difficulty_immediate_trigger
--      → función update_question_difficulty_immediate()
--      Quedó NO-OP el 2026-05-17 cuando se apagó el cron
--      recalc-question-difficulty (migración
--      20260517_drop_question_difficulty_cron_system.sql). El cuerpo
--      pasó a NO-OP pero el trigger se dejó vivo "por si acaso". Hoy
--      sólo aporta overhead PL/pgSQL en cada INSERT a test_questions.
--
--   2) update_article_stats_trigger
--      → función trigger_update_article_stats()
--      Quedó NO-OP el 2026-05-02 (migración
--      20260502_disable_trigger_update_article_stats.sql). El cuerpo se
--      vació pero el trigger siguió disparándose. Mismo problema:
--      overhead PL/pgSQL sin trabajo útil.
--
-- Verificación pre-DROP (2026-05-23):
--   - pg_get_functiondef confirma cuerpo = "BEGIN RETURN NEW; END;" en ambos
--   - 0 referencias a estos triggers en código de app
--   - Las migraciones que los dejaron NO-OP están commiteadas y aplicadas
--
-- Esta migración:
--   - DROP TRIGGER en ambos casos
--   - Mantiene las FUNCIONES (update_question_difficulty_immediate,
--     trigger_update_article_stats): son pequeñas y referenciadas por
--     comentarios; tirarlas se puede hacer en limpieza posterior si no
--     hay otros triggers que las usen.
--
-- Ganancia esperada: overhead × 2 triggers × cada INSERT a test_questions
-- (~292k INSERTs/mes según pg_stat_statements). El overhead exacto se mide
-- en task #9 (re-baseline post-DROP).
--
-- Rollback (5 segundos):
--   CREATE TRIGGER auto_update_difficulty_immediate_trigger
--     AFTER INSERT ON public.test_questions
--     FOR EACH ROW EXECUTE FUNCTION update_question_difficulty_immediate();
--   CREATE TRIGGER update_article_stats_trigger
--     AFTER INSERT ON public.test_questions
--     FOR EACH ROW EXECUTE FUNCTION trigger_update_article_stats();

-- Verificación de que las funciones siguen siendo NO-OP (defensa en
-- profundidad — si alguien cambió el cuerpo entre auditoría y DROP,
-- abortamos).
DO $verify$
DECLARE
  v_body_difficulty TEXT;
  v_body_article TEXT;
BEGIN
  SELECT prosrc INTO v_body_difficulty
  FROM pg_proc
  WHERE proname = 'update_question_difficulty_immediate'
    AND pronamespace = 'public'::regnamespace;

  SELECT prosrc INTO v_body_article
  FROM pg_proc
  WHERE proname = 'trigger_update_article_stats'
    AND pronamespace = 'public'::regnamespace;

  -- Normalizar whitespace y minúsculas para la comparación
  IF regexp_replace(lower(v_body_difficulty), '\s+', '', 'g') NOT LIKE '%returnnew;%' THEN
    RAISE EXCEPTION 'ABORT: update_question_difficulty_immediate ya no es NO-OP. Body actual: %', v_body_difficulty;
  END IF;

  IF regexp_replace(lower(v_body_article), '\s+', '', 'g') NOT LIKE '%returnnew;%' THEN
    RAISE EXCEPTION 'ABORT: trigger_update_article_stats ya no es NO-OP. Body actual: %', v_body_article;
  END IF;

  -- Comprobación adicional: el cuerpo debe ser muy corto (un NO-OP real)
  IF length(regexp_replace(v_body_difficulty, '--[^\n]*', '', 'g')) > 200 THEN
    RAISE EXCEPTION 'ABORT: update_question_difficulty_immediate tiene cuerpo no trivial (% chars)', length(v_body_difficulty);
  END IF;

  IF length(regexp_replace(v_body_article, '--[^\n]*', '', 'g')) > 200 THEN
    RAISE EXCEPTION 'ABORT: trigger_update_article_stats tiene cuerpo no trivial (% chars)', length(v_body_article);
  END IF;

  RAISE NOTICE 'Verificación pre-DROP OK: ambas funciones son NO-OP';
END;
$verify$;

-- DROP de los 2 triggers
DROP TRIGGER IF EXISTS auto_update_difficulty_immediate_trigger ON public.test_questions;
DROP TRIGGER IF EXISTS update_article_stats_trigger ON public.test_questions;

-- Verificación post-DROP: ahora deberían quedar 12 triggers en
-- test_questions (eran 14).
DO $assert$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_trigger
  WHERE tgrelid = 'public.test_questions'::regclass
    AND NOT tgisinternal;

  IF v_count <> 12 THEN
    RAISE EXCEPTION 'ABORT: tras DROP se esperaban 12 triggers, hay %', v_count;
  END IF;

  RAISE NOTICE 'OK: test_questions tiene ahora 12 triggers (eran 14)';
END;
$assert$;

COMMENT ON FUNCTION public.update_question_difficulty_immediate() IS
  'NO-OP desde 2026-05-17 (cron recalc-question-difficulty apagado). Trigger DROPeado el 2026-05-23. Función conservada como fósil; eliminar si nadie la usa tras 30 días.';

COMMENT ON FUNCTION public.trigger_update_article_stats() IS
  'NO-OP desde 2026-05-02 (UPDATE pesado a questions eliminado, ver 20260502_disable_trigger_update_article_stats.sql). Trigger DROPeado el 2026-05-23. Función conservada como fósil; eliminar si nadie la usa tras 30 días.';
