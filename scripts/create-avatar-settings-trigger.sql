-- ============================================
-- Trigger: Crear user_avatar_settings automáticamente
-- cuando se crea un nuevo user_profiles
-- ============================================

-- 1. Crear la función del trigger
CREATE OR REPLACE FUNCTION create_user_avatar_settings_on_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Insertar configuración de avatar en modo automático por defecto
  INSERT INTO user_avatar_settings (
    user_id,
    mode,
    current_profile,
    current_emoji,
    current_name,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    'automatic',
    NULL,  -- Se asignará en la próxima rotación semanal
    NULL,
    NULL,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;  -- Por si acaso ya existe

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Crear el trigger que se ejecuta después de insertar en user_profiles
DROP TRIGGER IF EXISTS trigger_create_avatar_settings ON user_profiles;

CREATE TRIGGER trigger_create_avatar_settings
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_user_avatar_settings_on_profile();

-- 3. Verificar que el trigger se creó correctamente
SELECT
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'trigger_create_avatar_settings';
