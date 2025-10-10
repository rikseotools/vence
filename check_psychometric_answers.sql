-- Verificar si se están guardando las respuestas de psicotécnicos
SELECT 
  COUNT(*) as total_respuestas,
  COUNT(DISTINCT user_id) as usuarios_unicos,
  COUNT(DISTINCT question_id) as preguntas_respondidas,
  MIN(created_at) as primera_respuesta,
  MAX(created_at) as ultima_respuesta
FROM psychometric_test_answers;

-- Ver respuestas específicas recientes
SELECT 
  pta.user_id,
  pta.question_id,
  pq.question_text,
  pta.user_answer,
  pta.is_correct,
  pta.created_at
FROM psychometric_test_answers pta
JOIN psychometric_questions pq ON pta.question_id = pq.id
ORDER BY pta.created_at DESC
LIMIT 10;
