-- ============================================
-- AÑADIR CONSTRAINT ÚNICO A test_questions
-- ============================================
-- PROPÓSITO: Prevenir duplicados a nivel de base de datos
-- Un test solo puede tener UNA respuesta por cada question_order

-- 1. Verificar si ya existe el constraint
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'test_questions'
  AND constraint_type = 'UNIQUE'
  AND constraint_name = 'unique_test_question';

-- 2. Si no existe, crearlo (ejecutar solo si el SELECT anterior no devuelve nada)
ALTER TABLE test_questions
ADD CONSTRAINT unique_test_question
UNIQUE (test_id, question_order);

-- 3. Verificar que se creó correctamente
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'test_questions'
  AND constraint_name = 'unique_test_question';

-- 4. IMPORTANTE: Limpiar duplicados existentes ANTES de crear el constraint
-- Si el ALTER TABLE falla, ejecuta esto primero:

/*
-- Encontrar duplicados
SELECT test_id, question_order, COUNT(*) as duplicados
FROM test_questions
GROUP BY test_id, question_order
HAVING COUNT(*) > 1;

-- Eliminar duplicados (mantiene solo el primero)
DELETE FROM test_questions a USING (
  SELECT MIN(id) as id, test_id, question_order
  FROM test_questions
  GROUP BY test_id, question_order
  HAVING COUNT(*) > 1
) b
WHERE a.test_id = b.test_id
  AND a.question_order = b.question_order
  AND a.id <> b.id;
*/
