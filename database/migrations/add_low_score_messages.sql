-- =====================================================
-- AGREGAR MENSAJES PARA NOTAS MUY BAJAS (0-49%)
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- Mensajes de apoyo para cuando el usuario saca menos del 50%
INSERT INTO motivational_messages (category, subcategory, message_variants, emoji, tone, color_scheme, min_accuracy, max_accuracy, priority) VALUES
('exam_result', 'struggle',
 '["💙 Los errores son escalones hacia el éxito, {nombre}", "🌱 Cada pregunta fallada es una lección valiosa", "💪 No importa cuántas veces caes, sino cuántas te levantas"]'::jsonb,
 '💙', 'supportive', 'blue', 0, 49.9, 7),

('exam_result', 'persistence',
 '["🌟 {nombre}, la persistencia vence lo que la fuerza no puede", "🔥 Cada intento te hace más sabio, {nombre}", "💪 El camino es duro, pero tú eres más duro aún"]'::jsonb,
 '🌱', 'supportive', 'purple', 0, 49.9, 7),

('exam_result', 'encouragement',
 '["🎯 {nombre}, hoy es solo práctica. El examen real vendrás preparado", "📚 Los mejores opositores también tuvieron días difíciles", "⭐ {nombre}, un mal test no define tu capacidad"]'::jsonb,
 '🎯', 'supportive', 'blue', 0, 49.9, 8),

('exam_result', 'motivation',
 '["💪 {nombre}, lo importante es que estás aquí practicando", "🌟 Cada test que haces te acerca más a tu meta", "🔥 El esfuerzo de hoy es la victoria de mañana"]'::jsonb,
 '💪', 'motivational', 'green', 0, 49.9, 7);

-- Verificar que se insertaron
SELECT subcategory, min_accuracy, max_accuracy
FROM motivational_messages
WHERE category = 'exam_result' AND min_accuracy = 0;
