-- Migration: fix_theme_performance_by_scope_multiplication
-- Corrige el bug de multiplicación x6 en get_theme_performance_by_scope
-- El problema: el JOIN final usaba topic_number (que tiene duplicados por oposición)
-- La solución: usar topic_id que es único

DROP FUNCTION IF EXISTS get_theme_performance_by_scope(UUID);

CREATE OR REPLACE FUNCTION get_theme_performance_by_scope(p_user_id UUID)
RETURNS TABLE(
  topic_number INTEGER,
  topic_title TEXT,
  total_questions BIGINT,
  correct_answers BIGINT,
  accuracy NUMERIC,
  average_time NUMERIC,
  last_practiced TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH user_responses AS (
    -- Obtener todas las respuestas del usuario con info del artículo
    SELECT
      tq.id AS response_id,
      tq.is_correct,
      tq.time_spent_seconds,
      tq.created_at,
      a.id AS article_id,
      a.article_number,
      a.law_id
    FROM test_questions tq
    INNER JOIN tests t ON t.id = tq.test_id
    INNER JOIN articles a ON a.id = tq.article_id
    WHERE t.user_id = p_user_id
      AND tq.article_id IS NOT NULL
  ),
  -- Mapear cada respuesta a todos los temas que cubren ese artículo
  -- 🔧 FIX: Incluir topic_id para evitar multiplicación en el JOIN final
  responses_with_topics AS (
    SELECT DISTINCT
      ur.response_id,
      ur.is_correct,
      ur.time_spent_seconds,
      ur.created_at,
      top.id AS topic_id,  -- 🔧 FIX: Guardar topic_id único
      top.topic_number,
      top.title AS topic_title  -- 🔧 FIX: Guardar título aquí para evitar JOIN
    FROM user_responses ur
    INNER JOIN topic_scope ts ON ts.law_id = ur.law_id
    INNER JOIN topics top ON top.id = ts.topic_id
    WHERE ur.article_number = ANY(ts.article_numbers)
  )
  -- Agregar por tema
  -- 🔧 FIX: Ya no necesitamos JOIN con topics, tenemos todo en el CTE
  SELECT
    rwt.topic_number,
    MAX(rwt.topic_title) AS topic_title,
    COUNT(*)::BIGINT AS total_questions,
    SUM(CASE WHEN rwt.is_correct THEN 1 ELSE 0 END)::BIGINT AS correct_answers,
    ROUND(
      (SUM(CASE WHEN rwt.is_correct THEN 1 ELSE 0 END)::NUMERIC / COUNT(*)::NUMERIC) * 100,
      1
    ) AS accuracy,
    ROUND(AVG(COALESCE(rwt.time_spent_seconds, 0))::NUMERIC, 1) AS average_time,
    MAX(rwt.created_at) AS last_practiced
  FROM responses_with_topics rwt
  GROUP BY rwt.topic_number
  ORDER BY rwt.topic_number;
END;
$$;

-- Comentario actualizado
COMMENT ON FUNCTION get_theme_performance_by_scope IS
'Calcula el rendimiento por tema del usuario usando topic_scope.
Una respuesta puede contar para múltiples temas si el artículo está en el scope de varios.
FIX 2026-02-03: Corregido bug de multiplicación x6 por JOIN incorrecto con topic_number.';
