-- RPC: get_laws_with_question_counts
-- Optimiza la página /leyes reduciendo query de 3s a <100ms
-- Creado: 2025-12-26

CREATE OR REPLACE FUNCTION get_laws_with_question_counts()
RETURNS TABLE (
  id UUID,
  name TEXT,
  short_name TEXT,
  description TEXT,
  year INTEGER,
  type TEXT,
  "questionCount" BIGINT,
  "officialQuestions" BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    l.id,
    l.name,
    l.short_name,
    l.description,
    l.year,
    l.type,
    COUNT(q.id) AS "questionCount",
    COUNT(q.id) FILTER (WHERE q.is_official_exam = true) AS "officialQuestions"
  FROM laws l
  LEFT JOIN articles a ON a.law_id = l.id
  LEFT JOIN questions q ON q.primary_article_id = a.id AND q.is_active = true
  WHERE l.is_active = true
  GROUP BY l.id, l.name, l.short_name, l.description, l.year, l.type
  HAVING COUNT(q.id) >= 5
  ORDER BY COUNT(q.id) DESC;
$$;

-- Dar permisos
GRANT EXECUTE ON FUNCTION get_laws_with_question_counts() TO anon;
GRANT EXECUTE ON FUNCTION get_laws_with_question_counts() TO authenticated;

-- Comentario
COMMENT ON FUNCTION get_laws_with_question_counts() IS 'Obtiene leyes con conteo de preguntas optimizado para /leyes';
