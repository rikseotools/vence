-- Script para agregar ciudad a public_user_profiles y crear función RPC
-- Esto permitirá mostrar las ciudades en el ranking público

-- ========================================
-- 1. Agregar columna ciudad a public_user_profiles si no existe
-- ========================================
ALTER TABLE public_user_profiles
ADD COLUMN IF NOT EXISTS ciudad TEXT;

-- ========================================
-- 2. Copiar ciudades desde user_profiles a public_user_profiles
-- ========================================
UPDATE public_user_profiles pup
SET ciudad = up.ciudad
FROM user_profiles up
WHERE pup.id = up.id
AND up.ciudad IS NOT NULL;

-- ========================================
-- 3. Crear trigger para sincronizar ciudad automáticamente
-- ========================================

-- Eliminar trigger si existe
DROP TRIGGER IF EXISTS sync_ciudad_to_public_profile ON user_profiles;
DROP FUNCTION IF EXISTS sync_ciudad_to_public();

-- Crear función para sincronizar ciudad
CREATE OR REPLACE FUNCTION sync_ciudad_to_public()
RETURNS TRIGGER AS $$
BEGIN
  -- Actualizar ciudad en public_user_profiles cuando se actualice en user_profiles
  UPDATE public_user_profiles
  SET ciudad = NEW.ciudad
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger
CREATE TRIGGER sync_ciudad_to_public_profile
AFTER INSERT OR UPDATE OF ciudad ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION sync_ciudad_to_public();

-- ========================================
-- 4. Verificación
-- ========================================
SELECT
  pup.id,
  pup.display_name,
  pup.ciudad,
  up.ciudad as ciudad_original
FROM public_user_profiles pup
LEFT JOIN user_profiles up ON pup.id = up.id
WHERE up.ciudad IS NOT NULL
LIMIT 10;

-- ========================================
-- MENSAJE FINAL
-- ========================================
-- Ejecuta este script en el SQL Editor de Supabase
-- Después de ejecutarlo:
-- 1. Las ciudades estarán disponibles en public_user_profiles
-- 2. Se sincronizarán automáticamente cuando se actualicen
-- 3. El ranking mostrará las ciudades correctamente