-- Migration: Añadir campos de ubicación (ciudad y provincia)
-- Fecha: 2025-12-06

-- 1. Añadir campo ciudad a user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS ciudad TEXT;

-- 2. Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_user_profiles_ciudad ON user_profiles(ciudad);

-- 3. Actualizar función complete_user_onboarding para incluir ciudad y provincia
CREATE OR REPLACE FUNCTION complete_user_onboarding(
  p_user_id UUID,
  p_target_oposicion TEXT,
  p_target_oposicion_data JSONB,
  p_age INTEGER,
  p_gender TEXT,
  p_daily_study_hours INTEGER,
  p_ciudad TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Validar que el usuario existe
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuario no encontrado'
    );
  END IF;

  -- Actualizar perfil con todos los datos
  UPDATE user_profiles
  SET
    target_oposicion = p_target_oposicion,
    target_oposicion_data = p_target_oposicion_data,
    age = p_age,
    gender = p_gender,
    daily_study_hours = p_daily_study_hours,
    ciudad = p_ciudad,
    onboarding_completed_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Si no existe el perfil, crearlo
  IF NOT FOUND THEN
    INSERT INTO user_profiles (
      user_id,
      target_oposicion,
      target_oposicion_data,
      age,
      gender,
      daily_study_hours,
      ciudad,
      onboarding_completed_at,
      created_at,
      updated_at
    ) VALUES (
      p_user_id,
      p_target_oposicion,
      p_target_oposicion_data,
      p_age,
      p_gender,
      p_daily_study_hours,
      p_ciudad,
      NOW(),
      NOW(),
      NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Onboarding completado exitosamente'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 4. Actualizar función user_needs_onboarding para considerar ciudad y provincia
CREATE OR REPLACE FUNCTION user_needs_onboarding(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile RECORD;
BEGIN
  SELECT
    target_oposicion,
    onboarding_completed_at,
    age,
    gender,
    daily_study_hours,
    ciudad
  INTO v_profile
  FROM user_profiles
  WHERE user_id = p_user_id;

  -- Si no existe perfil, necesita onboarding
  IF NOT FOUND THEN
    RETURN TRUE;
  END IF;

  -- Necesita onboarding si falta algún campo obligatorio
  IF v_profile.target_oposicion IS NULL
     OR v_profile.onboarding_completed_at IS NULL
     OR v_profile.age IS NULL
     OR v_profile.gender IS NULL
     OR v_profile.daily_study_hours IS NULL
     OR v_profile.ciudad IS NULL THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;

EXCEPTION
  WHEN OTHERS THEN
    -- En caso de error, asumir que no necesita para no molestar
    RETURN FALSE;
END;
$$;

-- Comentario final
COMMENT ON COLUMN user_profiles.ciudad IS 'Ciudad del usuario, detectada por IP o ingresada manualmente';
