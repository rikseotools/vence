-- scripts/create-laws-rpc-function.sql
-- Función RPC optimizada para obtener leyes con conteo de preguntas

CREATE OR REPLACE FUNCTION get_laws_with_question_counts()
RETURNS TABLE (
  id uuid,
  name text,
  short_name text,
  description text,
  year integer,
  type text,
  questionCount bigint,
  officialQuestions bigint
) 
LANGUAGE SQL
STABLE
AS $$
  SELECT 
    l.id,
    l.name,
    l.short_name,
    l.description,
    l.year,
    l.type,
    COUNT(q.id) as questionCount,
    COUNT(q.id) FILTER (WHERE q.is_official_exam = true) as officialQuestions
  FROM laws l
  LEFT JOIN articles a ON a.law_id = l.id
  LEFT JOIN questions q ON q.article_id = a.id AND q.is_active = true
  WHERE l.is_active = true
  GROUP BY l.id, l.name, l.short_name, l.description, l.year, l.type
  HAVING COUNT(q.id) >= 5
  ORDER BY COUNT(q.id) DESC;
$$;

-- Dar permisos de ejecución
GRANT EXECUTE ON FUNCTION get_laws_with_question_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION get_laws_with_question_counts() TO anon;