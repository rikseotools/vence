-- Crear perfiles públicos faltantes para usuarios con avatares
-- Estos usuarios tienen avatares configurados pero no tienen public_user_profiles

-- 1. Verificar primero si Nila ya tiene perfil (parece que sí según el listado anterior)
SELECT id, display_name, avatar_emoji
FROM public_user_profiles
WHERE id = 'c16c186a-4e70-4b1e-a3bd-c107e13670dd';

-- Si el resultado anterior muestra que tiene perfil pero sin avatar, actualizar:
UPDATE public_user_profiles
SET
  avatar_type = 'predefined',
  avatar_emoji = '🦄',
  avatar_color = 'from-pink-400 to-purple-500',
  avatar_name = 'Unicornio',
  updated_at = NOW()
WHERE id = 'c16c186a-4e70-4b1e-a3bd-c107e13670dd'
  AND (avatar_emoji IS NULL OR avatar_emoji = '');

-- Si el resultado anterior muestra que NO tiene perfil, crear uno:
INSERT INTO public_user_profiles (
  id,
  display_name,
  avatar_type,
  avatar_emoji,
  avatar_color,
  avatar_name,
  created_at,
  updated_at
)
SELECT
  'c16c186a-4e70-4b1e-a3bd-c107e13670dd',
  'Nila',
  'predefined',
  '🦄',
  'from-pink-400 to-purple-500',
  'Unicornio',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public_user_profiles
  WHERE id = 'c16c186a-4e70-4b1e-a3bd-c107e13670dd'
);

-- Verificar el resultado final
SELECT
  id,
  display_name,
  ciudad,
  avatar_type,
  avatar_emoji,
  avatar_color,
  avatar_name
FROM public_user_profiles
WHERE id = 'c16c186a-4e70-4b1e-a3bd-c107e13670dd';