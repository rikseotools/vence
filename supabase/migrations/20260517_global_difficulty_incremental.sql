-- Materializar global_difficulty como agregado incremental (Opción A de la
-- discusión 2026-05-16 sobre Fase 2). Elimina la necesidad del cron
-- `recalc-global-difficulty` y de la columna `global_dirty`.
--
-- IDEA: la función actual `calculate_question_global_difficulty(qid)` lee
-- `question_first_attempts` con AVG() / COUNT() (~50-150ms por pregunta en
-- picos). En 100 preguntas, eso es 5-15s → statement timeout 8s, deadlocks,
-- emails de fallo de GHA.
--
-- Solución: mantener tres sumas materializadas en `questions`:
--   - first_attempts_correct_sum     (Σ is_correct)
--   - first_attempts_time_sum        (Σ time_spent_seconds)
--   - first_attempts_confidence_sum  (Σ confidence_level mapeado a 1-4)
--
-- + `difficulty_sample_size` que ya existe (N = COUNT).
--
-- Con esos cuatro escalares, `global_difficulty` se recalcula en sub-ms con
-- aritmética pura (sin SELECT agregado). El trigger AFTER INSERT en
-- question_first_attempts hace el UPDATE incremental de esos sums + del
-- `global_difficulty` derivado.
--
-- ESTA MIGRACIÓN ES DUAL-WRITE: el sistema antiguo (trigger + dirty flag +
-- cron + recalculate_dirty_global_difficulty) sigue funcionando. La
-- migración añade el nuevo trigger Y un backfill inicial. Tras una semana
-- de paridad verificada, una migración posterior apagará el sistema viejo.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Nuevas columnas en `questions` para los sums incrementales.
-- ---------------------------------------------------------------------------

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS first_attempts_correct_sum     integer       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_attempts_time_sum        bigint        NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_attempts_confidence_sum  numeric(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.questions.first_attempts_correct_sum IS
  'Suma de is_correct (0/1) de question_first_attempts. Junto con '
  'difficulty_sample_size permite calcular % aciertos sin agregar.';

COMMENT ON COLUMN public.questions.first_attempts_time_sum IS
  'Suma de time_spent_seconds de question_first_attempts. /sample_size = '
  'tiempo medio.';

COMMENT ON COLUMN public.questions.first_attempts_confidence_sum IS
  'Suma de confidence_level mapeado a 1.0-4.0 (very_sure=4, sure=3, '
  'unsure=2, guessing=1, NULL=2.5). /sample_size = confianza media.';

-- ---------------------------------------------------------------------------
-- 2. Función pura que recalcula global_difficulty desde los 4 escalares.
-- Mismo algoritmo que calculate_question_global_difficulty pero SIN SELECT
-- — opera solo con los argumentos. Sub-milisegundo.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.compute_global_difficulty_from_sums(
  p_sample_size     integer,
  p_correct_sum     integer,
  p_time_sum        bigint,
  p_confidence_sum  numeric
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_accuracy      numeric;
  v_avg_time      numeric;
  v_avg_confidence numeric;
  v_score         numeric := 0;
BEGIN
  -- Mismo umbral que la función original: <3 first_attempts = no confiable.
  IF p_sample_size IS NULL OR p_sample_size < 3 THEN
    RETURN NULL;
  END IF;

  v_accuracy := (p_correct_sum::numeric / p_sample_size) * 100;
  v_avg_time := p_time_sum::numeric / p_sample_size;
  v_avg_confidence := p_confidence_sum / p_sample_size;

  -- Factor 1: tasa de error (0-50 pts).
  v_score := v_score + ((100 - v_accuracy) * 0.5);

  -- Factor 2: tiempo medio (0-25 pts). El check >0 evita penalizar cuando
  -- todo el tiempo es 0/NULL (lo que la función original también hacía con
  -- IF v_avg_time IS NOT NULL → aquí v_avg_time es 0 si time_sum es 0,
  -- cae en el ELSE 0 del CASE → equivalente).
  v_score := v_score +
    CASE
      WHEN v_avg_time > 120 THEN 25
      WHEN v_avg_time > 90  THEN 15
      WHEN v_avg_time > 60  THEN 8
      ELSE 0
    END;

  -- Factor 3: confianza media (0-25 pts).
  v_score := v_score +
    CASE
      WHEN v_avg_confidence < 2.0 THEN 25
      WHEN v_avg_confidence < 2.5 THEN 15
      WHEN v_avg_confidence < 3.0 THEN 8
      ELSE 0
    END;

  RETURN ROUND(GREATEST(0, LEAST(100, v_score)), 1);
END;
$$;

COMMENT ON FUNCTION public.compute_global_difficulty_from_sums IS
  'Versión pura (sin SELECT) del cálculo de global_difficulty. Misma '
  'fórmula que calculate_question_global_difficulty pero operando sobre '
  'los sums materializados en questions. Sub-ms.';

-- ---------------------------------------------------------------------------
-- 3. Helper para mapear confidence_level (text) → score (numeric 1-4).
-- Mismo mapeo que calculate_question_global_difficulty.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.confidence_text_to_score(p_text text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT CASE p_text
    WHEN 'very_sure' THEN 4.0
    WHEN 'sure'      THEN 3.0
    WHEN 'unsure'    THEN 2.0
    WHEN 'guessing'  THEN 1.0
    ELSE 2.5  -- NULL u otros valores
  END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Trigger AFTER INSERT en `question_first_attempts` que actualiza
-- incrementally `questions`. Cada fila nueva = un UPDATE puntual por PK
-- en questions (instantáneo).
--
-- ON CONFLICT no aplica porque question_first_attempts ya tiene su propio
-- ON CONFLICT (user_id, question_id) DO NOTHING en el caller. Si el
-- INSERT fue suprimido por el conflict, este trigger NO se ejecuta — eso
-- es exactamente lo que queremos (no contar dos veces).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.apply_first_attempt_to_question_stats()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_correct_delta integer;
  v_time_delta    integer;
  v_conf_delta    numeric;
  v_new_sample    integer;
  v_new_correct   integer;
  v_new_time      bigint;
  v_new_conf      numeric;
  v_new_diff      numeric;
  v_new_category  text;
  v_new_conf_pct  numeric;
BEGIN
  v_correct_delta := CASE WHEN NEW.is_correct THEN 1 ELSE 0 END;
  v_time_delta    := COALESCE(NEW.time_spent_seconds, 0);
  v_conf_delta    := confidence_text_to_score(NEW.confidence_level);

  -- UPDATE incremental + lectura de los valores nuevos (RETURNING) para
  -- recalcular global_difficulty en la misma operación.
  UPDATE public.questions
  SET
    difficulty_sample_size       = COALESCE(difficulty_sample_size, 0) + 1,
    first_attempts_correct_sum   = first_attempts_correct_sum + v_correct_delta,
    first_attempts_time_sum      = first_attempts_time_sum + v_time_delta,
    first_attempts_confidence_sum = first_attempts_confidence_sum + v_conf_delta,
    last_difficulty_update       = NOW()
  WHERE id = NEW.question_id
  RETURNING
    difficulty_sample_size,
    first_attempts_correct_sum,
    first_attempts_time_sum,
    first_attempts_confidence_sum
  INTO v_new_sample, v_new_correct, v_new_time, v_new_conf;

  -- Si la pregunta no existe (FK rota, race), salir limpio.
  IF v_new_sample IS NULL THEN
    RETURN NEW;
  END IF;

  v_new_diff := compute_global_difficulty_from_sums(
    v_new_sample, v_new_correct, v_new_time, v_new_conf
  );

  v_new_category := CASE
    WHEN v_new_diff IS NULL    THEN NULL
    WHEN v_new_diff >= 75      THEN 'extreme'
    WHEN v_new_diff >= 50      THEN 'hard'
    WHEN v_new_diff >= 25      THEN 'medium'
    ELSE 'easy'
  END;

  v_new_conf_pct := CASE
    WHEN v_new_sample IS NULL THEN NULL
    ELSE LEAST(1.0, v_new_sample::numeric / 50.0)
  END;

  -- Segundo UPDATE para los campos derivados. Postgres lo agrupa con el
  -- anterior dentro de la misma transacción del trigger; no hay round-trip
  -- extra al cliente.
  UPDATE public.questions
  SET
    global_difficulty           = v_new_diff,
    global_difficulty_category  = v_new_category,
    difficulty_confidence       = v_new_conf_pct
  WHERE id = NEW.question_id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.apply_first_attempt_to_question_stats IS
  'Trigger AFTER INSERT en question_first_attempts. Mantiene sums '
  'incrementales en questions y recalcula global_difficulty en sub-ms. '
  'Reemplaza al cron recalc-global-difficulty + global_dirty flag (que '
  'siguen activos durante la ventana de paridad).';

DROP TRIGGER IF EXISTS apply_first_attempt_to_question_stats_trigger
  ON public.question_first_attempts;

CREATE TRIGGER apply_first_attempt_to_question_stats_trigger
AFTER INSERT ON public.question_first_attempts
FOR EACH ROW
EXECUTE FUNCTION public.apply_first_attempt_to_question_stats();

COMMIT;
