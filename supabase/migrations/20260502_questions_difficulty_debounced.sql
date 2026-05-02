-- Migration: questions_difficulty_debounced (Fase 0.2 escalabilidad)
-- 2026-05-02
--
-- Convierte el trigger update_question_difficulty_immediate (#2) de execución
-- inmediata por cada INSERT en test_questions a un patrón "dirty flag + cron
-- batch". Reduce el tiempo de cada INSERT al eliminar la query pesada
-- (COUNT/AVG/AVG/AVG sobre todas las respuestas a la pregunta) y el lock
-- contention en `questions`.
--
-- IMPORTANT — equivalencia funcional:
-- - El cálculo de difficulty (algoritmo basado en success_rate, avg_time,
--   avg_confidence) es BYTE-EXACT al del trigger original — solo cambia
--   cuándo se ejecuta (en cron 5min en lugar de cada INSERT).
-- - Lag máximo de 5 min entre que cambia el bracket de una pregunta y se
--   refleja en `questions.difficulty`. El sistema YA tolera valores stale
--   (fallback `globalDifficultyCategory || difficulty || 'medium'` en
--   filtered-questions:123, testFetchers:445, lawFetchers:159).
-- - questions.difficulty actual NO se invalida — sigue siendo válida hasta
--   que la pregunta reciba una nueva respuesta y se marque como dirty.
--
-- NO toca triggers #3 ni #4 (quedan para Fase 2 outbox por bug preexistente
-- de algoritmos paralelos #B/#C en `questions.global_difficulty`).
--
-- Rollback (5 segundos): revertir CREATE OR REPLACE FUNCTION
-- update_question_difficulty_immediate al cuerpo original (commiteado en este
-- archivo abajo como comentario).
--
-- Idempotente.

-- ============================================
-- PARTE 1: Columna stats_dirty en questions
-- ============================================
-- Postgres 11+ permite ADD COLUMN con DEFAULT sin reescritura de tabla.
-- En Postgres 17 (Supabase) es instantáneo para 102k filas.
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS stats_dirty BOOLEAN DEFAULT false NOT NULL;

-- Índice parcial: solo indexa filas con stats_dirty=true (típicamente <1k).
-- El cron usa este índice para el SELECT WHERE stats_dirty=true.
CREATE INDEX IF NOT EXISTS idx_questions_stats_dirty
  ON public.questions (id) WHERE stats_dirty = true;

-- ============================================
-- PARTE 2: Función para recalcular difficulty en batch
-- ============================================
-- Procesa hasta p_limit preguntas marcadas como dirty.
-- Usa advisory_lock para evitar que dos crons corran en paralelo.
-- Devuelve número de preguntas procesadas (para observabilidad del endpoint).
--
-- Algoritmo IDÉNTICO al del trigger update_question_difficulty_immediate
-- original — solo movido fuera de la ruta crítica del INSERT.

CREATE OR REPLACE FUNCTION public.recalculate_dirty_question_difficulty(
  p_limit integer DEFAULT 500
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lock_acquired BOOLEAN;
  v_processed INTEGER := 0;
  v_question_id UUID;
  v_success_rate NUMERIC;
  v_total_attempts INTEGER;
  v_avg_time NUMERIC;
  v_avg_confidence NUMERIC;
  v_new_difficulty TEXT;
  v_difficulty_score NUMERIC;
BEGIN
  -- Advisory lock: solo un cron puede correr a la vez.
  -- Si otro cron ya está corriendo, este sale sin hacer nada (no se queda esperando).
  v_lock_acquired := pg_try_advisory_lock(hashtext('recalc_question_difficulty'));
  IF NOT v_lock_acquired THEN
    RETURN -1; -- caller interpreta como "skip, otro cron corriendo"
  END IF;

  BEGIN
    -- Procesar dirty questions una por una (loop simple, no batch UPDATE
    -- porque cada pregunta requiere su propia agregación)
    FOR v_question_id IN
      SELECT id FROM questions
      WHERE stats_dirty = true
      ORDER BY id  -- determinista para idempotencia
      LIMIT p_limit
    LOOP
      -- Calcular agregados (mismo algoritmo que el trigger original)
      SELECT
        COUNT(*),
        AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END) * 100,
        AVG(time_spent_seconds),
        AVG(
          CASE confidence_level
            WHEN 'very_sure' THEN 4.0
            WHEN 'sure' THEN 3.0
            WHEN 'unsure' THEN 2.0
            WHEN 'guessing' THEN 1.0
            ELSE 2.5
          END
        )
      INTO v_total_attempts, v_success_rate, v_avg_time, v_avg_confidence
      FROM test_questions
      WHERE question_id = v_question_id;

      -- Si no hay datos (raro porque debería haber al menos 1), saltar
      IF v_total_attempts IS NULL OR v_total_attempts = 0 THEN
        UPDATE questions SET stats_dirty = false WHERE id = v_question_id;
        CONTINUE;
      END IF;

      -- Score (idéntico al trigger original)
      v_difficulty_score :=
        (100 - v_success_rate) * 0.5 +
        CASE
          WHEN v_avg_time > 120 THEN 25
          WHEN v_avg_time > 90 THEN 15
          WHEN v_avg_time > 60 THEN 8
          ELSE 0
        END +
        CASE
          WHEN v_avg_confidence < 2.0 THEN 25
          WHEN v_avg_confidence < 2.5 THEN 15
          WHEN v_avg_confidence < 3.0 THEN 8
          ELSE 0
        END;

      -- Bracket (idéntico al trigger original)
      v_new_difficulty :=
        CASE
          WHEN v_difficulty_score >= 75 THEN 'extreme'
          WHEN v_difficulty_score >= 50 THEN 'hard'
          WHEN v_difficulty_score >= 25 THEN 'medium'
          ELSE 'easy'
        END;

      -- UPDATE atómico (difficulty + clear dirty flag)
      UPDATE questions
      SET difficulty = v_new_difficulty,
          updated_at = NOW(),
          stats_dirty = false
      WHERE id = v_question_id;

      v_processed := v_processed + 1;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_advisory_unlock(hashtext('recalc_question_difficulty'));
    RAISE;
  END;

  PERFORM pg_advisory_unlock(hashtext('recalc_question_difficulty'));
  RETURN v_processed;
END;
$$;

-- service_role lo invoca desde el endpoint cron
REVOKE EXECUTE ON FUNCTION public.recalculate_dirty_question_difficulty(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_dirty_question_difficulty(integer) TO service_role;

-- ============================================
-- PARTE 3: Trigger nuevo (debounced)
-- ============================================
-- Reemplaza el cuerpo de update_question_difficulty_immediate.
-- En lugar de hacer COUNT/AVG/UPDATE pesado, solo marca la pregunta como
-- dirty (UPDATE atómico ligero, ~0.5ms vs ~280ms del original).
--
-- ROLLBACK COMPLETO (cuerpo del trigger original, para revertir si necesario):
-- ─────────────────────────────────────────────────────────────────────────────
-- CREATE OR REPLACE FUNCTION public.update_question_difficulty_immediate()
-- RETURNS trigger LANGUAGE plpgsql AS $body$
-- DECLARE
--   v_success_rate NUMERIC;
--   v_total_attempts INTEGER;
--   v_avg_time NUMERIC;
--   v_avg_confidence NUMERIC;
--   v_new_difficulty TEXT;
--   v_difficulty_score NUMERIC;
-- BEGIN
--   SELECT COUNT(*), AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END) * 100,
--          AVG(time_spent_seconds),
--          AVG(CASE confidence_level WHEN 'very_sure' THEN 4.0 WHEN 'sure' THEN 3.0
--              WHEN 'unsure' THEN 2.0 WHEN 'guessing' THEN 1.0 ELSE 2.5 END)
--   INTO v_total_attempts, v_success_rate, v_avg_time, v_avg_confidence
--   FROM test_questions WHERE question_id = NEW.question_id;
--   v_difficulty_score := (100 - v_success_rate) * 0.5
--     + CASE WHEN v_avg_time > 120 THEN 25 WHEN v_avg_time > 90 THEN 15
--            WHEN v_avg_time > 60 THEN 8 ELSE 0 END
--     + CASE WHEN v_avg_confidence < 2.0 THEN 25 WHEN v_avg_confidence < 2.5 THEN 15
--            WHEN v_avg_confidence < 3.0 THEN 8 ELSE 0 END;
--   v_new_difficulty := CASE WHEN v_difficulty_score >= 75 THEN 'extreme'
--     WHEN v_difficulty_score >= 50 THEN 'hard' WHEN v_difficulty_score >= 25 THEN 'medium'
--     ELSE 'easy' END;
--   UPDATE questions SET difficulty = v_new_difficulty, updated_at = NOW()
--   WHERE id = NEW.question_id;
--   RETURN NEW;
-- END;
-- $body$;
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_question_difficulty_immediate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Marca pregunta como dirty. El cron /api/cron/recalc-question-difficulty
  -- (cada 5min) recalcula difficulty en batch.
  -- Cambio de inmediato → eventual (lag max 5min). Algoritmo idéntico.
  IF NEW.question_id IS NOT NULL THEN
    UPDATE public.questions
    SET stats_dirty = true
    WHERE id = NEW.question_id AND stats_dirty = false;
  END IF;
  RETURN NEW;
END;
$$;
