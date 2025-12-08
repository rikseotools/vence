-- Actualizar el perfil público de Nila con los datos de su avatar
-- que están en user_metadata pero no en public_user_profiles
UPDATE public_user_profiles
SET
  avatar_type = 'predefined',
  avatar_emoji = '🦄',
  avatar_color = 'from-pink-400 to-purple-500',
  avatar_name = 'Unicornio',
  updated_at = NOW()
WHERE id = 'c16c186a-4e70-4b1e-a3bd-c107e13670dd';

-- Verificar la actualización
SELECT
  id,
  display_name,
  ciudad,
  avatar_type,
  avatar_emoji,
  avatar_color,
  avatar_name,
  avatar_url
FROM public_user_profiles
WHERE id = 'c16c186a-4e70-4b1e-a3bd-c107e13670dd';