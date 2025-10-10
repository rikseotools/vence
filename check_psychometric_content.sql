-- Ver el contenido completo de las preguntas psicotécnicas
SELECT 
  pq.id,
  pc.display_name as categoria,
  ps.display_name as seccion,
  pq.question_text,
  pq.question_subtype,
  pq.options,
  pq.correct_answer,
  pq.explanation,
  pq.difficulty_level,
  pq.metadata
FROM psychometric_questions pq
JOIN psychometric_categories pc ON pq.category_id = pc.id
LEFT JOIN psychometric_sections ps ON pq.section_id = ps.id
WHERE pq.is_active = true
ORDER BY pc.display_name, pq.created_at;
