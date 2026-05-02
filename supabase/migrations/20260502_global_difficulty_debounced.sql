-- Migration: global_difficulty_debounced (Fase 2 escalabilidad - triggers #3 y #4)
-- 2026-05-02
--
-- Optimiza los 2 triggers restantes pesados en test_questions INSERT:
-- - Trigger #3 (law_question_difficulty): elimina UPDATE pesado en `questions`
--   sobre 4 campos (global_difficulty, sample_size, confidence, last_update)
--   que NO tienen lectores reales en producción. Mantiene solo el INSERT
--   atómico en law_question_first_attempts (datos de tracking conservados).
-- - Trigger #4 (track_first_attempt): mantiene INSERT en question_first_attempts
--   pero reemplaza el `PERFORM update_question_global_difficulty(...)` síncrono
--   por `UPDATE questions SET global_dirty = true` (atómico, ~0.5ms).
--   Un cron nuevo procesa el global_dirty backlog cada 5min.
--
-- Equivalencia funcional preservada:
-- - questions.global_difficulty_category (campo IMPORTANTE — usado para filtrar
--   preguntas en /api/random-test y /api/v2/filtered-questions cuando user
--   elige "test fácil/medio/difícil") sigue actualizándose, con lag max 5min.
-- - El sistema YA tolera valores stale: filtered-questions y random-test usan
--   patrón `(globalDifficultyCategory = X OR (NULL AND difficulty = X))`.
-- - questions.global_difficulty (numérico, 0 lectores reales en prod) y
--   sample_size/confidence/last_update (0 lectores reales) dejan de actualizarse
--   por trigger #3 — nadie los lee.
-- - Las funciones `get_effective_law_question_difficulty` y `get_law_difficulty_stats`
--   sólo se llaman desde script de test (test_law_difficulty_fix.js), no producción.
--
-- Beneficio: triggers #3 y #4 bajan de 50-150ms a ~1-2ms en first_attempts
-- (que son el 63.8% de las respuestas). Esto debería eliminar la mayoría de
-- los warnings "respuesta lenta 2-4s" en /api/v2/answer-and-save.
--
-- Idempotente.

-- ============================================
-- PARTE 1: Columna global_dirty en questions
-- ============================================
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS global_dirty BOOLEAN DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_global_dirty
  ON public.questions (id) WHERE global_dirty = true;

-- ============================================
-- PARTE 2: Función para procesar global_dirty en batch (cron 5min)
-- ============================================
-- Usa update_question_global_difficulty(id) que YA EXISTE y es idempotente.
-- Procesa preguntas marcadas como global_dirty + las marca como no dirty al final.
-- xact_lock para evitar 2 crons concurrentes.
CREATE OR REPLACE FUNCTION public.recalculate_dirty_global_difficulty(
  p_limit integer DEFAULT 200
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lock_acquired BOOLEAN;
  v_dirty_ids UUID[];
  v_question_id UUID;
  v_processed INTEGER := 0;
BEGIN
  -- xact_lock se libera al fin de transaccion (commit, rollback, timeout)
  v_lock_acquired := pg_try_advisory_xact_lock(hashtext('recalc_global_difficulty'));
  IF NOT v_lock_acquired THEN
    RETURN -1;
  END IF;

  -- Capturar IDs dirty ordenados
  SELECT array_agg(id) INTO v_dirty_ids
  FROM (
    SELECT id FROM public.questions
    WHERE global_dirty = true
    ORDER BY id
    LIMIT p_limit
  ) sub;

  IF v_dirty_ids IS NULL OR array_length(v_dirty_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  -- Procesar cada pregunta con la función existente (~30ms cada una)
  FOREACH v_question_id IN ARRAY v_dirty_ids LOOP
    PERFORM public.update_question_global_difficulty(v_question_id);
    v_processed := v_processed + 1;
  END LOOP;

  -- Marcar como no dirty al final (todas en un solo UPDATE)
  UPDATE public.questions
  SET global_dirty = false
  WHERE id = ANY(v_dirty_ids);

  RETURN v_processed;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recalculate_dirty_global_difficulty(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_dirty_global_difficulty(integer) TO service_role;

-- ============================================
-- PARTE 3: Trigger #3 nuevo - elimina UPDATE pesado
-- ============================================
-- Mantiene INSERT en law_question_first_attempts (datos tracking).
-- ELIMINA el bloque `IF is_first_attempt THEN UPDATE questions SET
-- global_difficulty=, sample_size=, confidence=, last_update= END IF`
-- — esos 4 campos no tienen lectores reales en produccion.
--
-- ROLLBACK (cuerpo original):
-- ─────────────────────────────────────────────────────────────────────
-- DECLARE is_first_attempt BOOLEAN := FALSE; sample_size INTEGER;
-- BEGIN
--   IF NEW.psychometric_question_id IS NOT NULL THEN RETURN NEW; END IF;
--   IF NEW.question_id IS NULL THEN RETURN NEW; END IF;
--   INSERT INTO law_question_first_attempts (...)
--   SELECT t.user_id, NEW.question_id, ... FROM tests t WHERE t.id = NEW.test_id
--   ON CONFLICT (user_id, question_id) DO NOTHING
--   RETURNING TRUE INTO is_first_attempt;
--   IF is_first_attempt THEN
--     DECLARE new_global_difficulty NUMERIC;
--     BEGIN
--       new_global_difficulty := calculate_global_law_question_difficulty(NEW.question_id);
--       SELECT COUNT(*) INTO sample_size FROM law_question_first_attempts WHERE question_id = NEW.question_id;
--       IF new_global_difficulty IS NOT NULL THEN
--         UPDATE questions SET global_difficulty = new_global_difficulty,
--                difficulty_sample_size = sample_size,
--                difficulty_confidence = LEAST(1.0, sample_size / 20.0),
--                last_difficulty_update = NOW()
--         WHERE id = NEW.question_id;
--       END IF;
--     END;
--   END IF;
--   RETURN NEW;
-- END;
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trigger_update_law_question_difficulty()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Skip si psychometric o question_id null
  IF NEW.psychometric_question_id IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.question_id IS NULL THEN RETURN NEW; END IF;

  -- Mantener INSERT atomic en law_question_first_attempts (tracking)
  INSERT INTO public.law_question_first_attempts (
    user_id, question_id, is_correct, time_taken_seconds, confidence_level, interaction_data
  )
  SELECT t.user_id, NEW.question_id, NEW.is_correct, NEW.time_spent_seconds,
         NEW.confidence_level, NEW.user_behavior_data
  FROM public.tests t WHERE t.id = NEW.test_id
  ON CONFLICT (user_id, question_id) DO NOTHING;

  -- ELIMINADO: UPDATE pesado en questions (sus 4 campos sin lectores reales)
  -- El cálculo de global_difficulty_category lo hace ahora trigger #4 + cron
  -- via update_question_global_difficulty (que escribe a global_difficulty_category,
  -- el campo IMPORTANTE que sí tiene lectores).

  RETURN NEW;
END;
$$;

-- ============================================
-- PARTE 4: Trigger #4 nuevo - INSERT + SET global_dirty (no PERFORM síncrono)
-- ============================================
-- ROLLBACK (cuerpo original):
-- ─────────────────────────────────────────────────────────────────────
-- DECLARE v_user_id UUID; v_is_first_attempt BOOLEAN;
-- BEGIN
--   IF NEW.psychometric_question_id IS NOT NULL THEN RETURN NEW; END IF;
--   IF NEW.question_id IS NULL THEN RETURN NEW; END IF;
--   SELECT user_id INTO v_user_id FROM tests WHERE id = NEW.test_id;
--   IF v_user_id IS NULL THEN RETURN NEW; END IF;
--   SELECT NOT EXISTS (SELECT 1 FROM question_first_attempts
--          WHERE user_id = v_user_id AND question_id = NEW.question_id)
--   INTO v_is_first_attempt;
--   IF v_is_first_attempt THEN
--     INSERT INTO question_first_attempts (...) VALUES (...)
--     ON CONFLICT (user_id, question_id) DO NOTHING;
--     PERFORM update_question_global_difficulty(NEW.question_id);
--   END IF;
--   RETURN NEW;
-- END;
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.track_question_first_attempt()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_is_first_attempt BOOLEAN;
BEGIN
  -- Skip si psychometric o question_id null
  IF NEW.psychometric_question_id IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.question_id IS NULL THEN RETURN NEW; END IF;

  -- Resolver user_id desde tests (si NEW.user_id no está set)
  SELECT user_id INTO v_user_id FROM public.tests WHERE id = NEW.test_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  -- Verificar primer intento (PK lookup, rapido con índice)
  SELECT NOT EXISTS (
    SELECT 1 FROM public.question_first_attempts
    WHERE user_id = v_user_id AND question_id = NEW.question_id
  ) INTO v_is_first_attempt;

  IF v_is_first_attempt THEN
    -- Mantener INSERT atomic
    INSERT INTO public.question_first_attempts (
      user_id, question_id, is_correct, time_spent_seconds, confidence_level, created_at
    ) VALUES (
      v_user_id, NEW.question_id, NEW.is_correct, NEW.time_spent_seconds,
      NEW.confidence_level, NOW()
    )
    ON CONFLICT (user_id, question_id) DO NOTHING;

    -- DIFERIDO: en lugar de PERFORM update_question_global_difficulty (50-100ms)
    -- síncrono, marcamos dirty. El cron /api/cron/recalc-global-difficulty
    -- procesa el backlog cada 5min usando la misma función.
    -- Lag máximo 5min en `global_difficulty_category` — aceptable porque el
    -- sistema ya usa fallback `(globalDifficultyCategory IS NULL AND difficulty = X)`
    UPDATE public.questions
    SET global_dirty = true
    WHERE id = NEW.question_id AND global_dirty = false;
  END IF;

  RETURN NEW;
END;
$$;
