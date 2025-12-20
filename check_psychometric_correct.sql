-- Verificar preguntas psicotécnicas en las tablas correctas
SELECT 
  pc.category_key,
  pc.display_name as categoria,
  COUNT(*) as total_preguntas
FROM psychometric_questions pq
JOIN psychometric_categories pc ON pq.category_id = pc.id
WHERE pq.is_active = true
GROUP BY pc.category_key, pc.display_name
ORDER BY pc.display_name;

-- Ver todas las categorías disponibles
SELECT 
  id,
  category_key,
  display_name,
  description
FROM psychometric_categories
ORDER BY display_name;

-- Contar total de preguntas psicotécnicas activas
SELECT COUNT(*) as total_preguntas_activas
FROM psychometric_questions 
WHERE is_active = true;
