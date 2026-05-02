-- Migration: questions_difficulty_batch_update (Fase 0.2 mejora escala)
-- 2026-05-02
--
-- Mejora escalabilidad de recalculate_dirty_question_difficulty:
-- - Reemplaza bucle FOR (N round-trips a BD) por UPDATE batch único con CTE
-- - LIMIT default 200 → 1000 (capacidad 5x más)
-- - Algoritmo IDÉNTICO al original (validado: 105/105 matches en test paridad)
-- - Maneja preguntas dirty sin respuestas (las limpia sin cambiar difficulty)
--
-- Performance medida en producción:
-- - 1000 preguntas en 13.7s (vs 5.3s para 200 con loop = ~26ms/pregunta)
-- - Mejor uso del query planner: una sola query atómica, menos overhead
-- - Margen seguro frente a statement_timeout 30s (Vercel default)
--
-- Capacidad estimada para 100k DAU:
-- - 1000 cada 5min = 12.000/h. Si insuficiente, subir a cron 1min o LIMIT 2000.
-- - Health endpoint /api/admin/health expone backlog para detectar saturación.
--
-- Idempotente.

CREATE OR REPLACE FUNCTION public.recalculate_dirty_question_difficulty(
  p_limit integer DEFAULT 1000
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lock_acquired BOOLEAN;
  v_processed INTEGER := 0;
BEGIN
  v_lock_acquired := pg_try_advisory_xact_lock(hashtext('recalc_question_difficulty'));
  IF NOT v_lock_acquired THEN
    RETURN -1;
  END IF;

  -- Single UPDATE batch con CTE de agregación. Algoritmo IDÉNTICO al
  -- trigger original pero ejecutado en una sola query (no N round-trips).
  -- Preguntas dirty sin respuestas se limpian (stats_dirty=false) sin
  -- cambiar difficulty.
  WITH dirty_qs AS (
    SELECT id FROM questions WHERE stats_dirty = true ORDER BY id LIMIT p_limit
  ),
  agg AS (
    SELECT
      tq.question_id,
      COUNT(*) AS total,
      AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END) * 100 AS success_rate,
      AVG(tq.time_spent_seconds) AS avg_time,
      AVG(CASE tq.confidence_level
        WHEN 'very_sure' THEN 4.0
        WHEN 'sure' THEN 3.0
        WHEN 'unsure' THEN 2.0
        WHEN 'guessing' THEN 1.0
        ELSE 2.5
      END) AS avg_confidence
    FROM test_questions tq
    WHERE tq.question_id IN (SELECT id FROM dirty_qs)
    GROUP BY tq.question_id
  ),
  scored AS (
    SELECT
      question_id,
      (100 - success_rate) * 0.5
      + CASE WHEN avg_time > 120 THEN 25 WHEN avg_time > 90 THEN 15
             WHEN avg_time > 60 THEN 8 ELSE 0 END
      + CASE WHEN avg_confidence < 2.0 THEN 25 WHEN avg_confidence < 2.5 THEN 15
             WHEN avg_confidence < 3.0 THEN 8 ELSE 0 END
      AS difficulty_score
    FROM agg
  ),
  classified AS (
    SELECT
      question_id,
      CASE WHEN difficulty_score >= 75 THEN 'extreme'
           WHEN difficulty_score >= 50 THEN 'hard'
           WHEN difficulty_score >= 25 THEN 'medium'
           ELSE 'easy'
      END AS new_difficulty
    FROM scored
  ),
  -- LEFT JOIN para incluir preguntas sin respuestas (limpian dirty sin tocar difficulty)
  final AS (
    SELECT d.id AS question_id, c.new_difficulty
    FROM dirty_qs d
    LEFT JOIN classified c ON c.question_id = d.id
  ),
  updated AS (
    UPDATE questions q
    SET difficulty = COALESCE(f.new_difficulty, q.difficulty),
        updated_at = CASE WHEN f.new_difficulty IS NOT NULL THEN NOW() ELSE q.updated_at END,
        stats_dirty = false
    FROM final f
    WHERE q.id = f.question_id
    RETURNING q.id
  )
  SELECT count(*) INTO v_processed FROM updated;

  RETURN v_processed;
END;
$$;
