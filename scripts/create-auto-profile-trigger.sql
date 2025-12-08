-- Crear trigger para generar automáticamente public_user_profiles cuando se crea un usuario

-- 1. Función que crea el perfil público
CREATE OR REPLACE FUNCTION create_public_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Crear perfil público con datos básicos
  INSERT INTO public_user_profiles (
    id,
    display_name,
    avatar_type,
    avatar_emoji,
    avatar_color,
    avatar_url,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    -- Usar el nombre completo, o el email sin dominio como display_name
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    -- Si tiene avatar de Google
    CASE
      WHEN NEW.raw_user_meta_data->>'avatar_url' IS NOT NULL
        OR NEW.raw_user_meta_data->>'picture' IS NOT NULL
      THEN 'google'
      ELSE NULL
    END,
    NULL, -- avatar_emoji (se llenará si elige un avatar predefinido)
    NULL, -- avatar_color
    -- URL del avatar si es de Google
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture'
    ),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING; -- No hacer nada si ya existe

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Crear trigger en la tabla auth.users
DROP TRIGGER IF EXISTS create_public_profile_on_signup ON auth.users;

CREATE TRIGGER create_public_profile_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_public_user_profile();

-- 3. También actualizar el perfil cuando el usuario actualiza sus datos
CREATE OR REPLACE FUNCTION update_public_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Actualizar avatar si cambió en user_metadata
  UPDATE public_user_profiles
  SET
    avatar_type = CASE
      WHEN NEW.raw_user_meta_data->>'avatar_type' = 'predefined' THEN 'predefined'
      WHEN NEW.raw_user_meta_data->>'avatar_type' = 'uploaded' THEN 'uploaded'
      WHEN NEW.raw_user_meta_data->>'avatar_url' IS NOT NULL
        OR NEW.raw_user_meta_data->>'picture' IS NOT NULL THEN 'google'
      ELSE avatar_type
    END,
    avatar_emoji = COALESCE(NEW.raw_user_meta_data->>'avatar_emoji', avatar_emoji),
    avatar_color = COALESCE(NEW.raw_user_meta_data->>'avatar_color', avatar_color),
    avatar_url = COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture',
      avatar_url
    ),
    updated_at = NOW()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger para actualizaciones
DROP TRIGGER IF EXISTS update_public_profile_on_change ON auth.users;

CREATE TRIGGER update_public_profile_on_change
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data)
  EXECUTE FUNCTION update_public_user_profile();

-- 5. Crear perfiles para usuarios existentes que no tienen
INSERT INTO public_user_profiles (id, display_name, created_at, updated_at)
SELECT
  u.id,
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    SPLIT_PART(u.email, '@', 1)
  ),
  u.created_at,
  NOW()
FROM auth.users u
LEFT JOIN public_user_profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- 6. Actualizar avatares de usuarios existentes
UPDATE public_user_profiles p
SET
  avatar_type = CASE
    WHEN u.raw_user_meta_data->>'avatar_type' = 'predefined' THEN 'predefined'
    WHEN u.raw_user_meta_data->>'avatar_type' = 'uploaded' THEN 'uploaded'
    WHEN u.raw_user_meta_data->>'avatar_url' IS NOT NULL
      OR u.raw_user_meta_data->>'picture' IS NOT NULL THEN 'google'
    ELSE p.avatar_type
  END,
  avatar_emoji = COALESCE(u.raw_user_meta_data->>'avatar_emoji', p.avatar_emoji),
  avatar_color = COALESCE(u.raw_user_meta_data->>'avatar_color', p.avatar_color),
  avatar_url = COALESCE(
    u.raw_user_meta_data->>'avatar_url',
    u.raw_user_meta_data->>'picture',
    p.avatar_url
  ),
  updated_at = NOW()
FROM auth.users u
WHERE p.id = u.id
  AND (p.avatar_type IS NULL OR p.avatar_emoji IS NULL)
  AND u.raw_user_meta_data IS NOT NULL;

-- 7. Verificar cuántos usuarios tienen perfil ahora
SELECT
  (SELECT COUNT(*) FROM auth.users) as total_users,
  (SELECT COUNT(*) FROM public_user_profiles) as profiles_count,
  (SELECT COUNT(*) FROM public_user_profiles WHERE avatar_emoji IS NOT NULL OR avatar_url IS NOT NULL) as with_avatar;