-- ============================================
-- ARREGLAR completed_at CON TIMESTAMP REAL
-- ============================================
-- Problema: Pusimos completed_at = NOW() en el UPDATE manual
-- Solución: Usar el timestamp de la última pregunta guardada

-- Para cada test, obtener el timestamp de su última pregunta y actualizar completed_at

UPDATE tests t
SET completed_at = (
  SELECT MAX(tq.created_at)
  FROM test_questions tq
  WHERE tq.test_id = t.id
)
WHERE t.id IN (
  '0f016129-60f3-4eb5-80d3-dda88079e0d7',
  '385bb484-e6a0-4654-808d-3e84d8ca1967',
  '86197d60-586c-412b-90a6-bc0c389e3f6e',
  '2cbd7406-99fa-432c-881c-bf17c4e07f4d',
  '345a639d-ab16-4859-8c68-c0e13cbeb385',
  '92074ecd-9f82-4933-b5dc-76ebf9ce3022',
  '237fa977-7e9a-42c8-9f5a-735902da10f4',
  'b16d50d9-2576-46b1-998f-28fc9c368f59',
  '97deac1f-e91b-433c-af69-d07136074424',
  'e14b5dff-ba11-41cd-9216-5a9ffef9d3a5'
);

-- Verificar los timestamps actualizados
SELECT
  t.id,
  t.created_at as test_created,
  t.completed_at as test_completed,
  (SELECT MAX(tq.created_at) FROM test_questions tq WHERE tq.test_id = t.id) as last_question,
  t.completed_at - t.created_at as duration
FROM tests t
WHERE t.id IN (
  '0f016129-60f3-4eb5-80d3-dda88079e0d7',
  '385bb484-e6a0-4654-808d-3e84d8ca1967',
  '86197d60-586c-412b-90a6-bc0c389e3f6e',
  '2cbd7406-99fa-432c-881c-bf17c4e07f4d',
  '345a639d-ab16-4859-8c68-c0e13cbeb385',
  '92074ecd-9f82-4933-b5dc-76ebf9ce3022',
  '237fa977-7e9a-42c8-9f5a-735902da10f4',
  'b16d50d9-2576-46b1-998f-28fc9c368f59',
  '97deac1f-e91b-433c-af69-d07136074424',
  'e14b5dff-ba11-41cd-9216-5a9ffef9d3a5'
)
ORDER BY t.completed_at DESC;
