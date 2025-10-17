-- scripts/test-topic-unlock-logic.sql
-- Simular la lógica del hook useTopicUnlock para el usuario específico

-- =====================================================
-- PASO 1: VER DATOS RAW DEL USUARIO
-- =====================================================

-- Datos actuales en user_progress para ismaelabdeselamdi@gmail.com
SELECT 
  'DATOS USER_PROGRESS:' as info,
  up.user_id,
  tp.topic_number,
  tp.title,
  up.total_attempts,
  up.correct_attempts,
  up.accuracy_percentage,
  up.needs_review,
  CASE 
    WHEN up.accuracy_percentage >= 70 AND up.total_attempts >= 10 THEN 'CUMPLE REQUISITOS'
    WHEN up.accuracy_percentage >= 70 THEN 'FALTA CANTIDAD (necesita 10+ preguntas)'
    WHEN up.total_attempts >= 10 THEN 'FALTA ACCURACY (necesita 70%+)'
    ELSE 'NO CUMPLE REQUISITOS'
  END as estado_desbloqueo
FROM user_progress up
INNER JOIN topics tp ON up.topic_id = tp.id
INNER JOIN auth.users au ON up.user_id = au.id
WHERE au.email = 'ismaelabdeselamdi@gmail.com'
ORDER BY tp.topic_number;

-- =====================================================
-- PASO 2: SIMULAR LÓGICA DE DESBLOQUEO SECUENCIAL
-- =====================================================

-- Simular exactamente lo que hace el hook useTopicUnlock
WITH user_progress_data AS (
  SELECT 
    tp.topic_number,
    up.accuracy_percentage,
    up.total_attempts,
    CASE 
      WHEN up.accuracy_percentage >= 70 AND up.total_attempts >= 10 THEN true 
      ELSE false 
    END as meets_threshold
  FROM user_progress up
  INNER JOIN topics tp ON up.topic_id = tp.id
  INNER JOIN auth.users au ON up.user_id = au.id
  WHERE au.email = 'ismaelabdeselamdi@gmail.com'
),
unlock_simulation AS (
  SELECT 
    topic_number,
    accuracy_percentage,
    total_attempts,
    meets_threshold,
    -- Tema actual desbloqueado si cumple requisitos
    CASE WHEN topic_number = 1 OR meets_threshold THEN true ELSE false END as tema_actual_desbloqueado,
    -- Siguiente tema desbloqueado si este cumple requisitos
    CASE WHEN meets_threshold THEN topic_number + 1 ELSE null END as desbloquea_tema_siguiente
  FROM user_progress_data
)
SELECT 
  'SIMULACIÓN DESBLOQUEO:' as info,
  topic_number as tema_actual,
  accuracy_percentage || '%' as accuracy,
  total_attempts as preguntas,
  meets_threshold as cumple_requisitos,
  tema_actual_desbloqueado as tema_desbloqueado,
  desbloquea_tema_siguiente as desbloquea_tema,
  CASE 
    WHEN desbloquea_tema_siguiente IS NOT NULL 
    THEN 'TEMA ' || desbloquea_tema_siguiente || ' DEBERÍA ESTAR DESBLOQUEADO'
    ELSE 'No desbloquea siguiente tema'
  END as resultado
FROM unlock_simulation
ORDER BY topic_number;

-- =====================================================
-- PASO 3: LISTA FINAL DE TEMAS DESBLOQUEADOS
-- =====================================================

-- Lista completa de temas que DEBERÍAN estar desbloqueados
WITH temas_que_cumplen AS (
  SELECT 
    tp.topic_number,
    up.accuracy_percentage >= 70 AND up.total_attempts >= 10 as cumple
  FROM user_progress up
  INNER JOIN topics tp ON up.topic_id = tp.id
  INNER JOIN auth.users au ON up.user_id = au.id
  WHERE au.email = 'ismaelabdeselamdi@gmail.com'
),
temas_desbloqueados AS (
  SELECT 1 as tema_desbloqueado, 'Siempre desbloqueado' as razon
  UNION ALL
  SELECT topic_number, 'Completado con éxito' as razon
  FROM temas_que_cumplen WHERE cumple = true
  UNION ALL
  SELECT topic_number + 1, 'Desbloqueado por tema anterior (' || topic_number || ')'
  FROM temas_que_cumplen WHERE cumple = true
)
SELECT 
  'TEMAS DESBLOQUEADOS FINALES:' as info,
  tema_desbloqueado,
  razon,
  CASE 
    WHEN tema_desbloqueado = 5 THEN '🎯 ESTE ES EL PROBLEMA - ¿ESTÁ DESBLOQUEADO?'
    ELSE '✅ Correcto'
  END as estado
FROM temas_desbloqueados 
WHERE tema_desbloqueado <= 16  -- Solo hasta tema 16
ORDER BY tema_desbloqueado;