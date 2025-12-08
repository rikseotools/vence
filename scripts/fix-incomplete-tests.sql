-- Script para marcar como completados los tests que tienen todas sus preguntas guardadas
-- pero is_completed = false

-- Primero, verificar cuántos tests están en esta situación
SELECT 
  t.id,
  t.user_id,
  t.created_at,
  t.completed_at,
  t.is_completed,
  t.total_questions as expected_questions,
  COUNT(tq.id) as saved_questions,
  CASE 
    WHEN COUNT(tq.id) >= t.total_questions THEN 'SHOULD_BE_COMPLETED'
    ELSE 'INCOMPLETE'
  END as status
FROM tests t
LEFT JOIN test_questions tq ON tq.test_id = t.id
WHERE t.is_completed = false
  AND t.completed_at IS NOT NULL
GROUP BY t.id
HAVING COUNT(tq.id) >= t.total_questions
ORDER BY t.created_at DESC;

-- Ver resumen por fecha
SELECT 
  DATE(t.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Madrid') as fecha,
  COUNT(DISTINCT t.id) as tests_afectados,
  COUNT(DISTINCT t.user_id) as usuarios_afectados
FROM tests t
LEFT JOIN test_questions tq ON tq.test_id = t.id
WHERE t.is_completed = false
  AND t.completed_at IS NOT NULL
GROUP BY t.id, DATE(t.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Madrid')
HAVING COUNT(tq.id) >= t.total_questions
GROUP BY 1
ORDER BY 1 DESC;

-- ACTUALIZACIÓN: Marcar como completados los tests que cumplen la condición
-- DESCOMENTA LA SIGUIENTE QUERY PARA EJECUTAR LA ACTUALIZACIÓN:

/*
WITH tests_to_fix AS (
  SELECT 
    t.id,
    COUNT(tq.id) as saved_questions
  FROM tests t
  LEFT JOIN test_questions tq ON tq.test_id = t.id
  WHERE t.is_completed = false
    AND t.completed_at IS NOT NULL
  GROUP BY t.id
  HAVING COUNT(tq.id) >= t.total_questions
)
UPDATE tests
SET 
  is_completed = true,
  updated_at = NOW()
WHERE id IN (SELECT id FROM tests_to_fix);

-- Ver resultado
SELECT COUNT(*) as tests_actualizados FROM tests_to_fix;
*/
