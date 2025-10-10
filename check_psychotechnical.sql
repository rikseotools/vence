-- Verificar preguntas de psicotécnicos
SELECT 
  category,
  COUNT(*) as total_preguntas,
  COUNT(DISTINCT question_text) as preguntas_unicas
FROM psychotechnical_questions 
GROUP BY category
ORDER BY category;

-- Ver todas las preguntas existentes
SELECT 
  id,
  category, 
  question_text,
  created_at
FROM psychotechnical_questions 
ORDER BY category, id;
