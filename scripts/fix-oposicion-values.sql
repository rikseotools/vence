-- Script para corregir valores de oposición incorrectos en user_profiles
-- Ejecutar en Supabase SQL Editor

-- 1. Ver los valores problemáticos antes de corregir
SELECT
  id,
  full_name,
  target_oposicion,
  CASE
    WHEN target_oposicion ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN 'UUID'
    WHEN target_oposicion = 'auxiliar-administrativo-estado' THEN 'Con guiones'
    WHEN target_oposicion = 'auxiliar_ayuntamiento' THEN 'Ayuntamiento'
    ELSE 'OK'
  END as tipo_problema
FROM user_profiles
WHERE target_oposicion IS NOT NULL
  AND (
    target_oposicion ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' -- UUIDs
    OR target_oposicion = 'auxiliar-administrativo-estado' -- Con guiones
    OR target_oposicion = 'auxiliar_ayuntamiento' -- Ayuntamiento
  );

-- 2. Actualizar UUIDs a 'auxiliar_administrativo_estado'
UPDATE user_profiles
SET target_oposicion = 'auxiliar_administrativo_estado'
WHERE target_oposicion ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 3. Actualizar valores con guiones
UPDATE user_profiles
SET target_oposicion = 'auxiliar_administrativo_estado'
WHERE target_oposicion = 'auxiliar-administrativo-estado';

-- 4. Actualizar 'auxiliar_ayuntamiento' (si debe ser del estado)
-- NOTA: Solo ejecutar si estamos seguros de que debe ser del estado
-- UPDATE user_profiles
-- SET target_oposicion = 'auxiliar_administrativo_estado'
-- WHERE target_oposicion = 'auxiliar_ayuntamiento';

-- 5. Verificar que se corrigieron
SELECT
  target_oposicion,
  COUNT(*) as total_usuarios
FROM user_profiles
WHERE target_oposicion IS NOT NULL
GROUP BY target_oposicion
ORDER BY total_usuarios DESC;

-- 6. Verificar específicamente el usuario David (si conocemos su ID)
-- SELECT id, full_name, target_oposicion
-- FROM user_profiles
-- WHERE full_name LIKE '%David%'
-- LIMIT 10;