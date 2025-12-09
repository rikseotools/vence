-- ============================================
-- AÑADIR RLS POLICY PARA ADMIN DASHBOARD
-- ============================================
-- Permitir a usuarios admin ver todos los perfiles

-- 1. Ver las políticas actuales en user_profiles
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'user_profiles';

-- 2. Crear política que permite a admins ver todos los perfiles
CREATE POLICY "Admins can view all profiles"
ON public.user_profiles
FOR SELECT
USING (
  -- El usuario es admin (tiene rol 'admin' en user_roles)
  EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
  OR
  -- O es su propio perfil
  auth.uid() = id
);

-- 3. Verificar que se creó correctamente
SELECT
  policyname,
  permissive,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'user_profiles'
AND policyname = 'Admins can view all profiles';
