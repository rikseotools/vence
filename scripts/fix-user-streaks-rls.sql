-- Verificar y arreglar las políticas RLS para user_streaks

-- 1. Primero, verificar si RLS está habilitado
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'user_streaks';

-- 2. Habilitar RLS si no está habilitado
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

-- 3. Ver políticas existentes
SELECT
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_streaks';

-- 4. Eliminar política restrictiva si existe
DROP POLICY IF EXISTS "Users can view their own streak" ON user_streaks;
DROP POLICY IF EXISTS "Users can only view own streak" ON user_streaks;

-- 5. Crear política que permite a TODOS ver TODAS las rachas (para el ranking)
CREATE POLICY "Anyone can view all streaks for ranking"
ON user_streaks
FOR SELECT
TO public  -- Esto incluye usuarios autenticados y anónimos
USING (true);  -- Sin restricciones, todos pueden ver todas las rachas

-- 6. Política para que los usuarios solo puedan actualizar su propia racha
CREATE POLICY "Users can update own streak only"
ON user_streaks
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 7. Verificar que las políticas se crearon correctamente
SELECT
  policyname,
  cmd,
  roles,
  qual
FROM pg_policies
WHERE tablename = 'user_streaks'
ORDER BY policyname;

-- 8. Probar que funciona - debería devolver múltiples rachas
SELECT
  user_id,
  current_streak,
  last_activity_date
FROM user_streaks
WHERE current_streak >= 2
ORDER BY current_streak DESC
LIMIT 10;