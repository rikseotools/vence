-- Verificar y arreglar las políticas RLS existentes

-- 1. Ver todas las políticas actuales para public_user_profiles
SELECT
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'public_user_profiles'
ORDER BY policyname;

-- 2. Si la política existe pero no funciona, eliminarla y recrearla
-- Primero, eliminar la política problemática
DROP POLICY IF EXISTS "Perfiles públicos visibles para todos" ON public_user_profiles;

-- 3. Crear nueva política que permita SELECT para TODOS (incluyendo anónimos)
CREATE POLICY "Perfiles públicos visibles para todos"
ON public_user_profiles
FOR SELECT
TO public  -- IMPORTANTE: especificar que es para el rol public (incluye anon)
USING (true);

-- 4. Verificar que funciona correctamente
SELECT
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'public_user_profiles'
AND policyname = 'Perfiles públicos visibles para todos';