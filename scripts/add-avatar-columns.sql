-- Añadir columnas de avatar a public_user_profiles
-- Estas columnas faltan y por eso no se muestran los avatares

-- 1. Añadir columnas de avatar
ALTER TABLE public_user_profiles
ADD COLUMN IF NOT EXISTS avatar_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS avatar_emoji VARCHAR(10),
ADD COLUMN IF NOT EXISTS avatar_color VARCHAR(100),
ADD COLUMN IF NOT EXISTS avatar_name VARCHAR(50),
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Verificar que las columnas se añadieron
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'public_user_profiles'
ORDER BY ordinal_position;

-- 3. Ahora sí actualizar el avatar de Nila
UPDATE public_user_profiles
SET
  avatar_type = 'predefined',
  avatar_emoji = '🦄',
  avatar_color = 'from-pink-400 to-purple-500',
  avatar_name = 'Unicornio',
  updated_at = NOW()
WHERE id = 'c16c186a-4e70-4b1e-a3bd-c107e13670dd';

-- 4. Verificar que se guardó correctamente
SELECT
  id,
  display_name,
  ciudad,
  avatar_type,
  avatar_emoji,
  avatar_color
FROM public_user_profiles
WHERE avatar_emoji IS NOT NULL;