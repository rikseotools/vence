-- Bajar umbral de cálculo de global_difficulty de ≥3 a ≥1 first_attempts.
--
-- CONTEXTO: las funciones compute_global_difficulty_from_sums (nueva,
-- materializada) y calculate_question_global_difficulty (vieja, agregadora)
-- requerían ≥3 first_attempts para devolver una categoría. Por debajo de
-- ese umbral devolvían NULL → la pregunta caía al fallback `difficulty`
-- en los filtros.
--
-- El umbral ≥3 mezclaba dos conceptos: (a) confianza estadística suficiente
-- para que el sistema adaptativo confíe en el dato (que sí necesita ≥3) y
-- (b) umbral mínimo para CATEGORIZAR la pregunta (que NO lo necesita: con
-- 1 primer intento ya tienes mejor info que 1000 retests sesgados).
--
-- Esta migración separa los conceptos: la categoría se calcula con
-- cualquier first_attempt ≥1. El sistema adaptativo sigue usando su propio
-- umbral (≥3 personal, ≥5 global) en sus propias funciones — no se toca.
--
-- IMPACTO: hoy 33 preguntas con 1-2 first_attempts pasan a tener categoría
-- asignada (en vez de NULL). Esas preguntas dejan de depender del fallback
-- `difficulty` para los filtros de UX easy/medium/hard/extreme.

BEGIN;

-- 1. Función materializada (la que usa el trigger nuevo de Fase 2-bis).
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
  v_accuracy       numeric;
  v_avg_time       numeric;
  v_avg_confidence numeric;
  v_score          numeric := 0;
BEGIN
  -- Umbral mínimo: ≥1 first_attempt. Antes era ≥3, separamos la confianza
  -- estadística del sistema adaptativo (que sigue exigiendo ≥3/≥5 en sus
  -- propias funciones — ver get_effective_psychometric_difficulty y
  -- get_effective_law_question_difficulty).
  IF p_sample_size IS NULL OR p_sample_size < 1 THEN
    RETURN NULL;
  END IF;

  v_accuracy := (p_correct_sum::numeric / p_sample_size) * 100;
  v_avg_time := p_time_sum::numeric / p_sample_size;
  v_avg_confidence := p_confidence_sum / p_sample_size;

  -- Factor 1: tasa de error (0-50 pts).
  v_score := v_score + ((100 - v_accuracy) * 0.5);

  -- Factor 2: tiempo medio (0-25 pts).
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

-- 2. Función agregadora vieja (mantenida para back-compat; antes la usaba
-- el cron eliminado y aún la llaman algunos scripts de test). Mismo
-- cambio de umbral para coherencia.
CREATE OR REPLACE FUNCTION public.calculate_question_global_difficulty(p_question_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_first_attempts_accuracy NUMERIC;
  v_first_attempts_count INTEGER;
  v_avg_time_taken NUMERIC;
  v_avg_confidence NUMERIC;
  v_difficulty_score NUMERIC;
BEGIN
  SELECT
    AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END) * 100,
    COUNT(*),
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
  INTO v_first_attempts_accuracy, v_first_attempts_count, v_avg_time_taken,
       v_avg_confidence
  FROM question_first_attempts
  WHERE question_id = p_question_id;

  -- Umbral ≥1 (antes ≥3). Ver doc en compute_global_difficulty_from_sums.
  IF v_first_attempts_count < 1 OR v_first_attempts_count IS NULL THEN
    RETURN NULL;
  END IF;

  v_difficulty_score := 0;
  v_difficulty_score := v_difficulty_score + ((100 - v_first_attempts_accuracy) * 0.5);

  IF v_avg_time_taken IS NOT NULL THEN
    v_difficulty_score := v_difficulty_score +
      CASE
        WHEN v_avg_time_taken > 120 THEN 25
        WHEN v_avg_time_taken > 90 THEN 15
        WHEN v_avg_time_taken > 60 THEN 8
        ELSE 0
      END;
  END IF;

  IF v_avg_confidence IS NOT NULL THEN
    v_difficulty_score := v_difficulty_score +
      CASE
        WHEN v_avg_confidence < 2.0 THEN 25
        WHEN v_avg_confidence < 2.5 THEN 15
        WHEN v_avg_confidence < 3.0 THEN 8
        ELSE 0
      END;
  END IF;

  RETURN ROUND(GREATEST(0, LEAST(100, v_difficulty_score)), 1);
END;
$$;

-- 3. Recalcular global_difficulty para preguntas con 1-2 first_attempts
-- que antes quedaban con NULL. Ahora deben tener categoría asignada.
UPDATE questions q
SET
  global_difficulty = compute_global_difficulty_from_sums(
    q.difficulty_sample_size,
    q.first_attempts_correct_sum,
    q.first_attempts_time_sum,
    q.first_attempts_confidence_sum
  ),
  global_difficulty_category = CASE
    WHEN compute_global_difficulty_from_sums(
      q.difficulty_sample_size, q.first_attempts_correct_sum,
      q.first_attempts_time_sum, q.first_attempts_confidence_sum
    ) IS NULL THEN NULL
    WHEN compute_global_difficulty_from_sums(
      q.difficulty_sample_size, q.first_attempts_correct_sum,
      q.first_attempts_time_sum, q.first_attempts_confidence_sum
    ) >= 75 THEN 'extreme'
    WHEN compute_global_difficulty_from_sums(
      q.difficulty_sample_size, q.first_attempts_correct_sum,
      q.first_attempts_time_sum, q.first_attempts_confidence_sum
    ) >= 50 THEN 'hard'
    WHEN compute_global_difficulty_from_sums(
      q.difficulty_sample_size, q.first_attempts_correct_sum,
      q.first_attempts_time_sum, q.first_attempts_confidence_sum
    ) >= 25 THEN 'medium'
    ELSE 'easy'
  END,
  difficulty_confidence = LEAST(1.0, q.difficulty_sample_size::numeric / 50.0),
  last_difficulty_update = NOW()
WHERE q.difficulty_sample_size >= 1 AND q.difficulty_sample_size < 3;

COMMIT;
