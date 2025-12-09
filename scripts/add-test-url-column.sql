-- ============================================
-- AÑADIR COLUMNA test_url A LA TABLA tests
-- ============================================
-- Para trackear qué tipo de test están haciendo los usuarios

-- 1. Añadir columna test_url
ALTER TABLE tests
ADD COLUMN test_url VARCHAR(500);

-- 2. Crear índice para queries rápidas
CREATE INDEX idx_tests_test_url ON tests(test_url);

-- 3. Verificar que se añadió correctamente
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'tests'
AND column_name = 'test_url';

-- 4. Ver algunos ejemplos (será NULL para tests antiguos)
SELECT id, test_url, created_at
FROM tests
ORDER BY created_at DESC
LIMIT 5;
