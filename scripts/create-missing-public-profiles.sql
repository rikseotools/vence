-- Script para crear perfiles públicos faltantes
-- Esto asegura que todos los usuarios con user_profiles tengan también un public_user_profile

-- Primero, insertar perfiles públicos para usuarios que no los tienen
INSERT INTO public_user_profiles (id, display_name, ciudad, created_at)
SELECT
  up.id,
  COALESCE(
    up.nickname,
    SPLIT_PART(up.full_name, ' ', 1),
    SPLIT_PART(up.email, '@', 1)
  ) as display_name,
  up.ciudad,
  NOW()
FROM user_profiles up
WHERE NOT EXISTS (
  SELECT 1
  FROM public_user_profiles pup
  WHERE pup.id = up.id
)
AND up.id IS NOT NULL;

-- Verificar cuántos perfiles públicos se crearon
SELECT COUNT(*) as perfiles_creados
FROM public_user_profiles
WHERE created_at >= NOW() - INTERVAL '1 minute';

-- Mostrar algunos perfiles públicos recién creados
SELECT id, display_name, ciudad, created_at
FROM public_user_profiles
WHERE created_at >= NOW() - INTERVAL '1 minute'
LIMIT 10;