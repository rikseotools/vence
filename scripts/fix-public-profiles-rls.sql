-- Arreglar políticas RLS para public_user_profiles
-- El problema: la tabla se llama "public" pero no es realmente pública

-- 1. Ver políticas actuales
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'public_user_profiles';

-- 2. Habilitar RLS en la tabla (si no está habilitado)
ALTER TABLE public_user_profiles ENABLE ROW LEVEL SECURITY;

-- 3. Crear política para permitir SELECT público (todos pueden ver perfiles)
CREATE POLICY "Perfiles públicos visibles para todos"
ON public_user_profiles
FOR SELECT
USING (true);

-- 4. Crear política para que usuarios autenticados puedan actualizar su propio perfil
CREATE POLICY "Usuarios pueden actualizar su propio perfil"
ON public_user_profiles
FOR UPDATE
USING (auth.uid() = id);

-- 5. Crear política para INSERT (crear perfil propio)
CREATE POLICY "Usuarios pueden crear su perfil"
ON public_user_profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- 6. Verificar que las políticas se crearon
SELECT
  policyname,
  cmd,
  permissive,
  roles
FROM pg_policies
WHERE tablename = 'public_user_profiles'
ORDER BY policyname;