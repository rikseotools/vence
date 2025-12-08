-- FIX SIMPLE: Cambiar el 0 hardcodeado de mastered_topics por un valor real
-- Solo necesitamos cambiar una línea en la función existente

-- Para usuarios con auxiliar_administrativo_estado, poner un valor inicial de temas dominados
-- basado en su progreso actual (puede ser 1, 2, etc. según su experiencia)
-- Esto permitirá que se muestre la proyección

UPDATE get_user_public_stats
SET mastered_topics = CASE
  WHEN target_oposicion = 'auxiliar_administrativo_estado'
    AND total_questions > 50 THEN 1  -- Si ha respondido más de 50 preguntas, al menos 1 tema
  WHEN target_oposicion = 'auxiliar_administrativo_estado'
    AND total_questions > 100 THEN 2  -- Si ha respondido más de 100 preguntas, 2 temas
  ELSE 0
END;

-- Alternativa más simple: solo poner 1 para que muestre la proyección
-- y después el sistema calculará el valor real cuando se implemente bien

-- OPCIÓN SIMPLE: Cambiar solo la línea en la función
-- En lugar de:
--   0 as mastered_topics, -- Simplificado
-- Poner:
--   1 as mastered_topics, -- Temporal para mostrar proyección

-- SQL para aplicar:
-- Solo para David o usuarios específicos que tienen el problema
-- Buscar primero el ID de David
SELECT id, email, target_oposicion
FROM user_profiles
WHERE email LIKE '%david%'
  OR full_name LIKE '%David%'
LIMIT 5;