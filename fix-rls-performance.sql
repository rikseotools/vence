-- ============================================
-- FIX: Optimizar RLS de test_questions
-- Problema: Subqueries con IN son muy lentas
-- Solución: Usar EXISTS que es mucho más rápido
-- ============================================

-- 1️⃣ CREAR ÍNDICES (si no existen)
-- Estos índices hacen que las queries de RLS sean instantáneas
CREATE INDEX IF NOT EXISTS idx_test_questions_test_id ON test_questions(test_id);
CREATE INDEX IF NOT EXISTS idx_tests_id_user_id ON tests(id, user_id);

-- 2️⃣ REEMPLAZAR POLÍTICA DE SELECT
-- Cambiar IN (SELECT ...) por EXISTS (SELECT 1 ...)
DROP POLICY IF EXISTS "Users can view their own test answers" ON test_questions;

CREATE POLICY "Users can view their own test answers"
ON test_questions FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM tests
    WHERE tests.id = test_questions.test_id
    AND tests.user_id = auth.uid()
    LIMIT 1
  )
);

-- 3️⃣ REEMPLAZAR POLÍTICA DE UPDATE
-- Cambiar IN (SELECT ...) por EXISTS (SELECT 1 ...)
DROP POLICY IF EXISTS "Users can update their own test answers" ON test_questions;

CREATE POLICY "Users can update their own test answers"
ON test_questions FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM tests
    WHERE tests.id = test_questions.test_id
    AND tests.user_id = auth.uid()
    LIMIT 1
  )
);

-- ============================================
-- VERIFICAR RESULTADOS
-- ============================================
-- Ver las políticas actualizadas
SELECT
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'test_questions'
ORDER BY cmd;

-- ============================================
-- RESULTADO ESPERADO
-- ============================================
-- ✅ Las políticas ahora usan EXISTS en vez de IN
-- ✅ Los índices hacen que las queries sean instantáneas
-- ✅ No más timeouts (error 57014)
-- ✅ INSERT de preguntas < 200ms en vez de timeout
