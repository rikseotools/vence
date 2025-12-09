-- ============================================
-- MARCAR COMO COMPLETADOS LOS TESTS DE HOY
-- ============================================
-- Total: 10 tests que tienen todas las preguntas guardadas
-- pero no están marcados como completados

-- David Fenoy jimenez (davidfenoyjimenez@gmail.com) - 1 test
UPDATE tests SET is_completed = true, completed_at = NOW() WHERE id = '0f016129-60f3-4eb5-80d3-dda88079e0d7'; -- 85/85 preguntas

-- Nila Jinayda Maíz Garay (jinayda32@gmail.com) - 2 tests
UPDATE tests SET is_completed = true, completed_at = NOW() WHERE id = '385bb484-e6a0-4654-808d-3e84d8ca1967'; -- 49/49 preguntas
UPDATE tests SET is_completed = true, completed_at = NOW() WHERE id = '86197d60-586c-412b-90a6-bc0c389e3f6e'; -- 23/23 preguntas

-- H G (nitupadreteconoce@gmail.com) - 7 tests
UPDATE tests SET is_completed = true, completed_at = NOW() WHERE id = '2cbd7406-99fa-432c-881c-bf17c4e07f4d'; -- 23/23 preguntas
UPDATE tests SET is_completed = true, completed_at = NOW() WHERE id = '345a639d-ab16-4859-8c68-c0e13cbeb385'; -- 24/24 preguntas
UPDATE tests SET is_completed = true, completed_at = NOW() WHERE id = '92074ecd-9f82-4933-b5dc-76ebf9ce3022'; -- 24/24 preguntas
UPDATE tests SET is_completed = true, completed_at = NOW() WHERE id = '237fa977-7e9a-42c8-9f5a-735902da10f4'; -- 24/24 preguntas
UPDATE tests SET is_completed = true, completed_at = NOW() WHERE id = 'b16d50d9-2576-46b1-998f-28fc9c368f59'; -- 24/24 preguntas
UPDATE tests SET is_completed = true, completed_at = NOW() WHERE id = '97deac1f-e91b-433c-af69-d07136074424'; -- 24/24 preguntas
UPDATE tests SET is_completed = true, completed_at = NOW() WHERE id = 'e14b5dff-ba11-41cd-9216-5a9ffef9d3a5'; -- 24/24 preguntas

-- Verificar que se actualizaron correctamente
SELECT
  id,
  user_id,
  is_completed,
  completed_at,
  total_questions,
  score
FROM tests
WHERE id IN (
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
ORDER BY completed_at DESC;
