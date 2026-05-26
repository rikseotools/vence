-- Migration: user_theme_stats_triggers
-- 2026-05-26
--
-- Fase 1.b del roadmap docs/roadmap/materialized-stats-aggregates.md.
-- Triggers incrementales que mantienen user_theme_stats en sincronía
-- con cada INSERT/UPDATE/DELETE sobre test_questions.
--
-- Convención del proyecto (igual que update_user_stats_total_time y
-- update_user_question_history v2):
--   - Sin EXCEPTION WHEN OTHERS — un bug en trigger crashea el INSERT y
--     se ve en Sentry. Mejor que silenciar y generar drift invisible.
--   - INSERT ... ON CONFLICT DO UPDATE con +1 counters. Jamás scan.
--   - Resolución de user_id: NEW.user_id directo o vía tests.user_id si null.
--   - Resolución de position_type: SELECT desde tests por test_id.
--     Skip silencioso si NULL (la query original también filtra).
--
-- Memoria del proyecto: "Triggers materializadores: cubrir SIEMPRE 3
-- TG_OPs (INSERT/UPDATE/DELETE) + UPSERT + smoke verify dentro de
-- migración" — patrón obligatorio aprendido del incidente 23/05 con
-- is_completed.
--
-- Tras aplicar, los inserts/updates/deletes nuevos en test_questions
-- empiezan a mantener user_theme_stats incrementalmente. Las filas
-- históricas (test_questions previos) NO se agregan hasta que corra el
-- backfill — script separado: scripts/backfill-user-theme-stats.mjs.
--
-- Rollback (5 segundos):
--   DROP TRIGGER user_theme_stats_insert_trigger ON test_questions;
--   DROP TRIGGER user_theme_stats_update_trigger ON test_questions;
--   DROP TRIGGER user_theme_stats_delete_trigger ON test_questions;
--   DROP FUNCTION update_user_theme_stats();

-- ════════════════════════════════════════════════════════════════════
-- Función trigger: update_user_theme_stats
-- ════════════════════════════════════════════════════════════════════
--
-- Maneja los 3 TG_OPs en una sola función — comparte la resolución de
-- v_user_id y v_position_type, y aplica el delta correspondiente.
--
-- Casos UPDATE relevantes:
--   - Cambia is_correct: ajusta `correct` (delta +1 o -1).
--   - Cambia tema_number: decrementa la fila vieja, incrementa la nueva.
--   - Otros cambios: no afectan a counters; se ignoran via WHEN guard
--     en el CREATE TRIGGER.

CREATE OR REPLACE FUNCTION update_user_theme_stats()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id        UUID;
  v_position_type  TEXT;
  v_old_user_id    UUID;
  v_old_position   TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.tema_number IS NULL THEN
      RETURN NEW;
    END IF;

    v_user_id := NEW.user_id;
    IF v_user_id IS NULL THEN
      SELECT user_id INTO v_user_id FROM tests WHERE id = NEW.test_id;
    END IF;
    SELECT position_type INTO v_position_type FROM tests WHERE id = NEW.test_id;

    IF v_user_id IS NULL OR v_position_type IS NULL THEN
      RETURN NEW;
    END IF;

    INSERT INTO user_theme_stats (
      user_id, position_type, tema_number, total, correct, last_study, updated_at
    ) VALUES (
      v_user_id, v_position_type, NEW.tema_number,
      1, CASE WHEN NEW.is_correct THEN 1 ELSE 0 END,
      NEW.created_at, NOW()
    )
    ON CONFLICT (user_id, position_type, tema_number) DO UPDATE SET
      total      = user_theme_stats.total + 1,
      correct    = user_theme_stats.correct + CASE WHEN NEW.is_correct THEN 1 ELSE 0 END,
      last_study = GREATEST(user_theme_stats.last_study, NEW.created_at),
      updated_at = NOW();

    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Caso A: cambia tema_number → decrementar fila vieja, incrementar nueva.
    IF NEW.tema_number IS DISTINCT FROM OLD.tema_number THEN
      v_user_id := COALESCE(NEW.user_id, OLD.user_id);
      IF v_user_id IS NULL THEN
        SELECT user_id INTO v_user_id FROM tests WHERE id = NEW.test_id;
      END IF;
      SELECT position_type INTO v_position_type FROM tests WHERE id = NEW.test_id;

      IF v_user_id IS NULL OR v_position_type IS NULL THEN
        RETURN NEW;
      END IF;

      -- Decrementar fila vieja (si el viejo tema_number no era null)
      IF OLD.tema_number IS NOT NULL THEN
        UPDATE user_theme_stats SET
          total      = GREATEST(0, total - 1),
          correct    = GREATEST(0, correct - CASE WHEN OLD.is_correct THEN 1 ELSE 0 END),
          updated_at = NOW()
        WHERE user_id = v_user_id
          AND position_type = v_position_type
          AND tema_number = OLD.tema_number;
      END IF;

      -- Incrementar fila nueva (si el nuevo tema_number no es null)
      IF NEW.tema_number IS NOT NULL THEN
        INSERT INTO user_theme_stats (
          user_id, position_type, tema_number, total, correct, last_study, updated_at
        ) VALUES (
          v_user_id, v_position_type, NEW.tema_number,
          1, CASE WHEN NEW.is_correct THEN 1 ELSE 0 END,
          NEW.created_at, NOW()
        )
        ON CONFLICT (user_id, position_type, tema_number) DO UPDATE SET
          total      = user_theme_stats.total + 1,
          correct    = user_theme_stats.correct + CASE WHEN NEW.is_correct THEN 1 ELSE 0 END,
          last_study = GREATEST(user_theme_stats.last_study, NEW.created_at),
          updated_at = NOW();
      END IF;

      RETURN NEW;
    END IF;

    -- Caso B: solo cambia is_correct → ajustar correct delta.
    IF NEW.is_correct IS DISTINCT FROM OLD.is_correct AND NEW.tema_number IS NOT NULL THEN
      v_user_id := COALESCE(NEW.user_id, OLD.user_id);
      IF v_user_id IS NULL THEN
        SELECT user_id INTO v_user_id FROM tests WHERE id = NEW.test_id;
      END IF;
      SELECT position_type INTO v_position_type FROM tests WHERE id = NEW.test_id;

      IF v_user_id IS NULL OR v_position_type IS NULL THEN
        RETURN NEW;
      END IF;

      UPDATE user_theme_stats SET
        correct = GREATEST(0, correct
          + CASE WHEN NEW.is_correct THEN 1 ELSE 0 END
          - CASE WHEN OLD.is_correct THEN 1 ELSE 0 END),
        updated_at = NOW()
      WHERE user_id = v_user_id
        AND position_type = v_position_type
        AND tema_number = NEW.tema_number;
    END IF;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.tema_number IS NULL THEN
      RETURN OLD;
    END IF;

    v_user_id := OLD.user_id;
    IF v_user_id IS NULL THEN
      SELECT user_id INTO v_user_id FROM tests WHERE id = OLD.test_id;
    END IF;
    SELECT position_type INTO v_position_type FROM tests WHERE id = OLD.test_id;

    IF v_user_id IS NULL OR v_position_type IS NULL THEN
      RETURN OLD;
    END IF;

    -- Nota: last_study no se recalcula en DELETE (requeriría SELECT MAX
    -- sobre el resto de filas del mismo tema). Acepta drift mínimo —
    -- el cron diario de Fase 2 lo detecta y corrige si supera 5%.
    UPDATE user_theme_stats SET
      total      = GREATEST(0, total - 1),
      correct    = GREATEST(0, correct - CASE WHEN OLD.is_correct THEN 1 ELSE 0 END),
      updated_at = NOW()
    WHERE user_id = v_user_id
      AND position_type = v_position_type
      AND tema_number = OLD.tema_number;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- ════════════════════════════════════════════════════════════════════
-- Triggers (3 TG_OPs)
-- ════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS user_theme_stats_insert_trigger ON test_questions;
CREATE TRIGGER user_theme_stats_insert_trigger
  AFTER INSERT ON test_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_theme_stats();

-- WHEN guard: solo dispara si cambia is_correct O tema_number.
-- Evita ejecución innecesaria en UPDATEs de otros campos (time_spent,
-- confidence_level, etc. — varios miles al día sin guard).
DROP TRIGGER IF EXISTS user_theme_stats_update_trigger ON test_questions;
CREATE TRIGGER user_theme_stats_update_trigger
  AFTER UPDATE OF is_correct, tema_number ON test_questions
  FOR EACH ROW
  WHEN (
    OLD.is_correct IS DISTINCT FROM NEW.is_correct
    OR OLD.tema_number IS DISTINCT FROM NEW.tema_number
  )
  EXECUTE FUNCTION update_user_theme_stats();

DROP TRIGGER IF EXISTS user_theme_stats_delete_trigger ON test_questions;
CREATE TRIGGER user_theme_stats_delete_trigger
  AFTER DELETE ON test_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_theme_stats();
