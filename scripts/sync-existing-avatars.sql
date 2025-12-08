-- Sincronizar avatares existentes desde user_metadata a public_user_profiles
-- Este script actualiza los avatares que ya existen en user_metadata pero no están en public_user_profiles

-- 1. Actualizar avatar de Nila (Unicornio)
UPDATE public_user_profiles
SET
  avatar_type = 'predefined',
  avatar_emoji = '🦄',
  avatar_color = 'from-pink-400 to-purple-500',
  avatar_name = 'Unicornio',
  updated_at = NOW()
WHERE id = 'c16c186a-4e70-4b1e-a3bd-c107e13670dd';

-- 2. Verificar si Manuel también necesita sincronización
SELECT id, display_name, avatar_emoji, avatar_type
FROM public_user_profiles
WHERE id = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f';

-- Si Manuel no tiene avatar, actualizarlo también
-- (Ejecutar solo si el SELECT anterior muestra avatar_emoji NULL)
-- UPDATE public_user_profiles
-- SET
--   avatar_type = 'predefined',
--   avatar_emoji = '🐶',  -- Ajustar según el avatar real
--   avatar_color = 'from-yellow-600 to-orange-500',
--   avatar_name = 'Perro',
--   updated_at = NOW()
-- WHERE id = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f'
--   AND avatar_emoji IS NULL;

-- 3. Verificar los cambios
SELECT
  id,
  display_name,
  ciudad,
  avatar_type,
  avatar_emoji,
  avatar_color,
  avatar_name
FROM public_user_profiles
WHERE id IN (
  'c16c186a-4e70-4b1e-a3bd-c107e13670dd',  -- Nila
  '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f'   -- Manuel
)
ORDER BY display_name;

-- 4. Verificar que ahora aparecen en el ranking con avatares
-- (Esto se verá reflejado en la interfaz)