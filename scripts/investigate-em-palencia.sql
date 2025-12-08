-- Investigar usuario EM de Palencia que tiene muchas preguntas pero 0 temas dominados

-- 1. Encontrar al usuario
WITH em_user AS (
  SELECT
    up.id,
    up.email,
    up.full_name,
    pup.display_name,
    pup.ciudad,
    up.target_oposicion,
    up.created_at
  FROM user_profiles up
  LEFT JOIN public_user_profiles pup ON pup.id = up.id
  WHERE pup.ciudad = 'Palencia'
    AND (pup.display_name LIKE 'EM%' OR pup.display_name = 'EM')
  LIMIT 1
)
SELECT * FROM em_user;

-- 2. Verificar su progreso en la tabla user_progress
WITH em_user AS (
  SELECT up.id
  FROM user_profiles up
  LEFT JOIN public_user_profiles pup ON pup.id = up.id
  WHERE pup.ciudad = 'Palencia'
    AND (pup.display_name LIKE 'EM%' OR pup.display_name = 'EM')
  LIMIT 1
)
SELECT
  up.topic_id,
  t.title as topic_title,
  up.total_attempts,
  up.correct_attempts,
  up.accuracy_percentage,
  up.last_attempt_date,
  up.needs_review,
  CASE
    WHEN up.accuracy_percentage >= 80 AND up.total_attempts >= 10
    THEN '✅ DOMINADO'
    ELSE '❌ NO DOMINADO'
  END as status
FROM user_progress up
LEFT JOIN topics t ON t.id = up.topic_id
WHERE up.user_id = (SELECT id FROM em_user)
ORDER BY up.accuracy_percentage DESC;

-- 3. Ver cuántos temas debería tener dominados según el criterio
WITH em_user AS (
  SELECT up.id
  FROM user_profiles up
  LEFT JOIN public_user_profiles pup ON pup.id = up.id
  WHERE pup.ciudad = 'Palencia'
    AND (pup.display_name LIKE 'EM%' OR pup.display_name = 'EM')
  LIMIT 1
)
SELECT
  COUNT(*) as total_temas_en_progress,
  COUNT(CASE
    WHEN accuracy_percentage >= 80 AND total_attempts >= 10
    THEN 1
  END) as temas_dominados,
  COUNT(CASE
    WHEN accuracy_percentage >= 80
    THEN 1
  END) as temas_con_80_porciento,
  COUNT(CASE
    WHEN total_attempts >= 10
    THEN 1
  END) as temas_con_10_intentos
FROM user_progress
WHERE user_id = (SELECT id FROM em_user);

-- 4. Ver si hay registros en user_progress
WITH em_user AS (
  SELECT up.id
  FROM user_profiles up
  LEFT JOIN public_user_profiles pup ON pup.id = up.id
  WHERE pup.ciudad = 'Palencia'
    AND (pup.display_name LIKE 'EM%' OR pup.display_name = 'EM')
  LIMIT 1
)
SELECT COUNT(*) as registros_en_user_progress
FROM user_progress
WHERE user_id = (SELECT id FROM em_user);

-- 5. Ver estadísticas de preguntas por tema
WITH em_user AS (
  SELECT up.id
  FROM user_profiles up
  LEFT JOIN public_user_profiles pup ON pup.id = up.id
  WHERE pup.ciudad = 'Palencia'
    AND (pup.display_name LIKE 'EM%' OR pup.display_name = 'EM')
  LIMIT 1
),
questions_by_topic AS (
  SELECT
    tq.tema_number,
    COUNT(*) as total_questions,
    SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END) as correct_answers,
    ROUND(
      SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::NUMERIC * 100 /
      COUNT(*)::NUMERIC, 1
    ) as accuracy
  FROM test_questions tq
  JOIN tests t ON t.id = tq.test_id
  WHERE t.user_id = (SELECT id FROM em_user)
  GROUP BY tq.tema_number
)
SELECT
  tema_number,
  total_questions,
  correct_answers,
  accuracy,
  CASE
    WHEN accuracy >= 80 AND total_questions >= 10
    THEN '✅ Debería estar dominado'
    WHEN accuracy >= 80
    THEN '⚠️ Buena precisión pero pocas preguntas'
    WHEN total_questions >= 10
    THEN '⚠️ Suficientes preguntas pero baja precisión'
    ELSE '❌ No cumple criterios'
  END as status
FROM questions_by_topic
ORDER BY tema_number;

-- 6. Verificar qué devuelve la función para este usuario
WITH em_user AS (
  SELECT up.id
  FROM user_profiles up
  LEFT JOIN public_user_profiles pup ON pup.id = up.id
  WHERE pup.ciudad = 'Palencia'
    AND (pup.display_name LIKE 'EM%' OR pup.display_name = 'EM')
  LIMIT 1
)
SELECT * FROM get_user_public_stats((SELECT id FROM em_user));