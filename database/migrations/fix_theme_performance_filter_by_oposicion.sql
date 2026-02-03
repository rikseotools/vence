-- Migration: fix_theme_performance_filter_by_oposicion
-- Filtra el rendimiento por tema solo para la oposición del usuario
-- Así los números reflejan la realidad, no conocimiento "transferible" inflado

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
DECLARE
  v_position_type TEXT;
BEGIN
  -- 1. Obtener la oposición del usuario y normalizarla a position_type
  SELECT
    CASE
      WHEN up.target_oposicion ILIKE '%auxiliar_administrativo%' OR up.target_oposicion ILIKE '%auxiliar-administrativo%'
        THEN 'auxiliar_administrativo'
      WHEN up.target_oposicion ILIKE '%administrativo%' AND up.target_oposicion NOT ILIKE '%auxiliar%'
        THEN 'administrativo'
      WHEN up.target_oposicion ILIKE '%auxilio_judicial%' OR up.target_oposicion ILIKE '%auxilio-judicial%'
        THEN 'auxilio_judicial'
      WHEN up.target_oposicion ILIKE '%tramitacion%'
        THEN 'tramitacion_procesal'
      ELSE 'auxiliar_administrativo'  -- Default
    END INTO v_position_type
  FROM user_profiles up
  WHERE up.id = p_user_id;

  -- Si no tiene perfil, usar default
  IF v_position_type IS NULL THEN
    v_position_type := 'auxiliar_administrativo';
  END IF;

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
  -- Mapear cada respuesta a los temas de SU OPOSICIÓN que cubren ese artículo
  responses_with_topics AS (
    SELECT DISTINCT
      ur.response_id,
      ur.is_correct,
      ur.time_spent_seconds,
      ur.created_at,
      top.id AS topic_id,
      top.topic_number,
      top.title AS topic_title
    FROM user_responses ur
    INNER JOIN topic_scope ts ON ts.law_id = ur.law_id
    INNER JOIN topics top ON top.id = ts.topic_id
    WHERE ur.article_number = ANY(ts.article_numbers)
      AND top.position_type = v_position_type  -- 🔧 FILTRAR POR OPOSICIÓN
  )
  -- Agregar por tema
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

-- Comentario
COMMENT ON FUNCTION get_theme_performance_by_scope IS
'Calcula el rendimiento por tema del usuario usando topic_scope.
Solo cuenta para los topics de la oposición que estudia el usuario.
FIX 2026-02-03: Filtrado por oposición para evitar números inflados.';
