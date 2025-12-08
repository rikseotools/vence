-- FIX INMEDIATO: Cambiar mastered_topics de 0 a 1 para usuarios con oposición auxiliar_administrativo_estado
-- Esto permitirá que se muestre la proyección de cuándo completarán el temario

-- La función actual tiene esta línea:
--   0 as mastered_topics, -- Simplificado
--
-- Necesitamos cambiarla para que al menos devuelva 1 cuando el usuario tiene la oposición correcta

-- OPCIÓN 1: Modificar la función existente para poner 1 en lugar de 0 (temporal)
-- Esto mostrará la proyección para TODOS los usuarios con auxiliar_administrativo_estado

-- Buscar la función actual y ver su definición exacta
SELECT prosrc FROM pg_proc WHERE proname = 'get_user_public_stats';

-- OPCIÓN 2: La más rápida - crear una versión corregida con un valor temporal
-- Cambiar solo esta parte en la SELECT final:

-- CAMBIAR DE:
--   0 as mastered_topics, -- Simplificado

-- A:
--   CASE
--     WHEN us.target_oposicion = 'auxiliar_administrativo_estado' AND us.total_questions > 0 THEN 1
--     ELSE 0
--   END as mastered_topics,

-- Esto hará que:
-- 1. Si el usuario tiene auxiliar_administrativo_estado y ha respondido al menos 1 pregunta, muestra 1 tema dominado
-- 2. Esto activará la proyección en el modal
-- 3. Es una solución temporal hasta implementar el cálculo real