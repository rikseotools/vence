-- Verificar y arreglar usuarios con oposiciones personalizadas que deberían tener auxiliar_administrativo_estado

-- 1. Ver qué oposiciones tiene Inma y otros usuarios problemáticos
SELECT
  up.id,
  up.email,
  up.full_name,
  pup.display_name,
  up.target_oposicion,
  up.created_at,
  -- Verificar si es un UUID (oposición personalizada)
  CASE
    WHEN up.target_oposicion ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN 'Es UUID (oposición personalizada)'
    ELSE 'Es texto normal'
  END as tipo_oposicion,
  -- Si es UUID, buscar el nombre de la oposición personalizada
  CASE
    WHEN up.target_oposicion ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      (SELECT nombre FROM oposiciones WHERE id::text = up.target_oposicion LIMIT 1)
    ELSE up.target_oposicion
  END as nombre_oposicion
FROM user_profiles up
LEFT JOIN public_user_profiles pup ON pup.id = up.id
WHERE
  LOWER(COALESCE(up.full_name, '')) LIKE '%inma%'
  OR LOWER(COALESCE(up.email, '')) LIKE '%inma%'
  OR LOWER(COALESCE(pup.display_name, '')) LIKE '%inma%'
  OR LOWER(COALESCE(up.full_name, '')) LIKE '%david%'
  OR LOWER(COALESCE(up.email, '')) LIKE '%david%'
  OR LOWER(COALESCE(pup.display_name, '')) LIKE '%david%';

-- 2. Ver todas las oposiciones personalizadas creadas recientemente
SELECT
  o.id,
  o.nombre,
  o.tipo_acceso,
  o.administracion,
  o.created_at,
  COUNT(up.id) as usuarios_con_esta_oposicion
FROM oposiciones o
LEFT JOIN user_profiles up ON up.target_oposicion = o.id::text
WHERE o.created_at > NOW() - INTERVAL '60 days'
GROUP BY o.id, o.nombre, o.tipo_acceso, o.administracion, o.created_at
ORDER BY o.created_at DESC;

-- 3. Identificar usuarios que probablemente deberían tener auxiliar_administrativo_estado
-- pero tienen una oposición personalizada similar
SELECT
  up.id,
  up.email,
  up.full_name,
  up.target_oposicion as oposicion_actual,
  o.nombre as nombre_oposicion_personalizada,
  'auxiliar_administrativo_estado' as oposicion_correcta
FROM user_profiles up
LEFT JOIN oposiciones o ON o.id::text = up.target_oposicion
WHERE up.target_oposicion ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND (
    LOWER(o.nombre) LIKE '%auxiliar%administrativo%'
    OR LOWER(o.nombre) LIKE '%aux%admin%'
    OR o.administracion = 'Estado'
  );

-- 4. FIX: Actualizar usuarios específicos que deberían tener auxiliar_administrativo_estado
-- IMPORTANTE: Ejecutar solo después de verificar con las consultas anteriores

-- Opción A: Actualizar Inma específicamente (más seguro)
/*
UPDATE user_profiles
SET target_oposicion = 'auxiliar_administrativo_estado'
WHERE email = 'EMAIL_DE_INMA_AQUI'
  AND target_oposicion ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
*/

-- Opción B: Actualizar todos los que crearon oposición "Auxiliar Administrativo del Estado" personalizada
/*
UPDATE user_profiles up
SET target_oposicion = 'auxiliar_administrativo_estado'
FROM oposiciones o
WHERE up.target_oposicion = o.id::text
  AND (
    o.nombre = 'Auxiliar Administrativo del Estado'
    OR o.nombre = 'Auxiliar Administrativo Estado'
    OR (o.nombre LIKE '%Auxiliar Administrativo%' AND o.administracion = 'Estado')
  );
*/

-- 5. Verificar el resultado después del update
/*
SELECT
  up.id,
  up.email,
  up.target_oposicion,
  CASE
    WHEN up.target_oposicion = 'auxiliar_administrativo_estado' THEN '✅ Correcto - Mostrará Temas dominados'
    ELSE '❌ Incorrecto - Mostrará Tests completados'
  END as estado
FROM user_profiles up
WHERE email IN ('EMAIL_DE_INMA', 'EMAIL_DE_DAVID');
*/