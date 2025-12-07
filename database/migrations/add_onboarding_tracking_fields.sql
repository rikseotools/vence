-- Migration: Añadir tracking de onboarding a la base de datos
-- Fecha: 2025-12-06
-- Reemplaza localStorage por campos en BD

-- 1. Añadir campos de tracking a user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS onboarding_skip_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS onboarding_last_skip_at TIMESTAMP WITH TIME ZONE;

-- 2. Crear índice
CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding_skip ON user_profiles(onboarding_skip_count);

-- Comentarios
COMMENT ON COLUMN user_profiles.onboarding_skip_count IS 'Número de veces que el usuario ha saltado el onboarding';
COMMENT ON COLUMN user_profiles.onboarding_last_skip_at IS 'Última vez que el usuario saltó el onboarding';
