-- Hardening del trigger apply_first_attempt_to_question_stats: pasamos de
-- "incremento ciego" a "re-aggregate desde question_first_attempts". El
-- trigger se vuelve self-healing — cualquier drift (p.ej. por filas borradas
-- manualmente en cleanup, GDPR-erase, scripts ad-hoc) se corrige solo en el
-- siguiente INSERT que toque esa pregunta.
--
-- CONTEXTO: la versión inicial (20260517_global_difficulty_incremental.sql)
-- hacía `difficulty_sample_size = COALESCE(..., 0) + 1`. Al monitorear el
-- 2026-05-17 detectamos 75 preguntas con `difficulty_sample_size` inflado
-- respecto al count real de question_first_attempts. El drift era
-- pre-existente (no causado por el trigger), pero el modelo "incremento
-- ciego" lo perpetúa indefinidamente. Esta migración elimina la clase
-- entera de bugs.
--
-- COSTE: una query agregada por INSERT en question_first_attempts. Con
-- ~308 inserts/h actuales = 0.09/s. A 10k DAU proyectados = ~7/s.
-- Insignificante comparado con el round-trip BD (3.37ms en lhr1).
--
-- LIMITACIÓN CONOCIDA: este trigger está en AFTER INSERT. Si en el futuro
-- alguien hace UPDATE o DELETE sobre question_first_attempts, la pregunta
-- correspondiente NO se reconcilia hasta el siguiente INSERT para esa
-- misma pregunta. Si esto se vuelve problema, añadir triggers AFTER UPDATE
-- y AFTER DELETE con el mismo handler.

BEGIN;

CREATE OR REPLACE FUNCTION public.apply_first_attempt_to_question_stats()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_sample         integer;
  v_correct_sum    integer;
  v_time_sum       bigint;
  v_conf_sum       numeric(12,2);
  v_new_diff       numeric;
  v_new_category   text;
  v_new_conf_pct   numeric;
BEGIN
  -- Re-agregar desde question_first_attempts para esta pregunta. Una sola
  -- query con índice en question_id. Coste: O(first_attempts por pregunta)
  -- = típicamente <50, casi siempre sub-ms.
  SELECT
    count(*)::integer,
    SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::integer,
    SUM(COALESCE(time_spent_seconds, 0))::bigint,
    SUM(confidence_text_to_score(confidence_level))::numeric(12,2)
  INTO v_sample, v_correct_sum, v_time_sum, v_conf_sum
  FROM public.question_first_attempts
  WHERE question_id = NEW.question_id;

  -- Si la pregunta no tiene first_attempts tras nuestra propia inserción
  -- (race imposible salvo borrado simultáneo), salir limpio.
  IF v_sample IS NULL OR v_sample = 0 THEN
    RETURN NEW;
  END IF;

  v_new_diff := compute_global_difficulty_from_sums(
    v_sample, v_correct_sum, v_time_sum, v_conf_sum
  );

  v_new_category := CASE
    WHEN v_new_diff IS NULL THEN NULL
    WHEN v_new_diff >= 75   THEN 'extreme'
    WHEN v_new_diff >= 50   THEN 'hard'
    WHEN v_new_diff >= 25   THEN 'medium'
    ELSE 'easy'
  END;

  v_new_conf_pct := LEAST(1.0, v_sample::numeric / 50.0);

  UPDATE public.questions
  SET
    difficulty_sample_size        = v_sample,
    first_attempts_correct_sum    = v_correct_sum,
    first_attempts_time_sum       = v_time_sum,
    first_attempts_confidence_sum = v_conf_sum,
    global_difficulty             = v_new_diff,
    global_difficulty_category    = v_new_category,
    difficulty_confidence         = v_new_conf_pct,
    last_difficulty_update        = NOW()
  WHERE id = NEW.question_id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.apply_first_attempt_to_question_stats IS
  'Trigger AFTER INSERT en question_first_attempts. Re-agrega los sums '
  'completos desde question_first_attempts para la pregunta tocada y '
  'actualiza questions con todos los valores derivados. Self-healing — '
  'cualquier drift en sample_size se corrige solo en el siguiente INSERT.';

COMMIT;
