-- Migration: add_theme_performance_by_scope
-- Función para calcular rendimiento por tema usando topic_scope
-- Esto permite atribuir una respuesta a TODOS los temas que cubren ese artículo

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
  responses_with_topics AS (
    SELECT DISTINCT
      ur.response_id,
      ur.is_correct,
      ur.time_spent_seconds,
      ur.created_at,
      top.topic_number
    FROM user_responses ur
    INNER JOIN topic_scope ts ON ts.law_id = ur.law_id
    INNER JOIN topics top ON top.id = ts.topic_id
    WHERE ur.article_number = ANY(ts.article_numbers)
  )
  -- Agregar por tema
  SELECT
    rwt.topic_number,
    MAX(top.title) AS topic_title,
    COUNT(*)::BIGINT AS total_questions,
    SUM(CASE WHEN rwt.is_correct THEN 1 ELSE 0 END)::BIGINT AS correct_answers,
    ROUND(
      (SUM(CASE WHEN rwt.is_correct THEN 1 ELSE 0 END)::NUMERIC / COUNT(*)::NUMERIC) * 100,
      1
    ) AS accuracy,
    ROUND(AVG(COALESCE(rwt.time_spent_seconds, 0))::NUMERIC, 1) AS average_time,
    MAX(rwt.created_at) AS last_practiced
  FROM responses_with_topics rwt
  INNER JOIN topics top ON top.topic_number = rwt.topic_number
  GROUP BY rwt.topic_number
  ORDER BY rwt.topic_number;
END;
$$;

-- Dar permisos
GRANT EXECUTE ON FUNCTION get_theme_performance_by_scope(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_theme_performance_by_scope(UUID) TO anon;

-- Comentario descriptivo
COMMENT ON FUNCTION get_theme_performance_by_scope IS
'Calcula el rendimiento por tema del usuario usando topic_scope.
Una respuesta puede contar para múltiples temas si el artículo está en el scope de varios.
Esto es más preciso que usar solo tema_number del test.';
