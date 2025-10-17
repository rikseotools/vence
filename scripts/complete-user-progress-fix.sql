-- scripts/complete-user-progress-fix.sql
-- MIGRACIÓN COMPLETA: Crear registros user_progress basados en tests completados

-- =====================================================
-- PASO 1: VERIFICAR ESTRUCTURA Y ESTADO ACTUAL
-- =====================================================

-- Ver estructura de user_progress
SELECT 
  'ESTRUCTURA user_progress:' as info,
  column_name, 
  data_type, 
  is_nullable, 
  column_default 
FROM information_schema.columns 
WHERE table_name = 'user_progress' 
ORDER BY ordinal_position;

-- Ver estado actual
SELECT 
  'ESTADO ACTUAL:' as info,
  'tests_completados' as tipo, 
  COUNT(*) as cantidad 
FROM tests 
WHERE is_completed = true AND user_id IS NOT NULL
UNION ALL
SELECT 
  'ESTADO ACTUAL:' as info,
  'user_progress_existente' as tipo, 
  COUNT(*) as cantidad 
FROM user_progress;

-- =====================================================
-- PASO 2: ANÁLISIS DE DATOS A MIGRAR
-- =====================================================

-- Ver qué combinaciones usuario-tema tenemos
WITH test_stats AS (
  SELECT 
    t.user_id,
    tq.tema_number,
    COUNT(DISTINCT t.id) as tests_completed,
    ROUND(AVG((t.score::float / t.total_questions::float) * 100)) as avg_accuracy,
    MAX((t.score::float / t.total_questions::float) * 100) as best_accuracy,
    MIN(t.completed_at) as first_test_date,
    MAX(t.completed_at) as last_test_date,
    CASE 
      WHEN AVG((t.score::float / t.total_questions::float) * 100) >= 70 THEN 1 
      ELSE 0 
    END as current_streak
  FROM tests t
  INNER JOIN test_questions tq ON t.id = tq.test_id
  WHERE t.is_completed = true 
    AND t.user_id IS NOT NULL
    AND tq.tema_number IS NOT NULL 
    AND tq.tema_number > 0
  GROUP BY t.user_id, tq.tema_number
)
SELECT 
  'DATOS A MIGRAR:' as info,
  user_id,
  tema_number as topic_number,
  tests_completed,
  avg_accuracy,
  best_accuracy,
  first_test_date,
  last_test_date,
  current_streak
FROM test_stats
ORDER BY user_id, topic_number;

-- =====================================================
-- PASO 3: INSERCIÓN BÁSICA (USAR SOLO LAS COLUMNAS QUE EXISTAN)
-- =====================================================

-- Opción A: Si user_progress tiene solo columnas básicas
INSERT INTO user_progress (
  user_id, 
  topic_number,
  created_at,
  updated_at
)
SELECT DISTINCT
  t.user_id,
  tq.tema_number,
  NOW(),
  NOW()
FROM tests t
INNER JOIN test_questions tq ON t.id = tq.test_id
WHERE t.is_completed = true 
  AND t.user_id IS NOT NULL
  AND tq.tema_number IS NOT NULL 
  AND tq.tema_number > 0
  AND NOT EXISTS (
    SELECT 1 FROM user_progress up 
    WHERE up.user_id = t.user_id 
      AND up.topic_number = tq.tema_number
  );

-- =====================================================
-- PASO 4: VERIFICAR RESULTADO
-- =====================================================

-- Ver cuántos registros se insertaron
SELECT 
  'RESULTADO:' as info,
  'user_progress_después' as tipo, 
  COUNT(*) as cantidad 
FROM user_progress;

-- Ver los registros creados
SELECT 
  'REGISTROS CREADOS:' as info,
  user_id,
  topic_number,
  created_at
FROM user_progress 
ORDER BY created_at DESC, user_id, topic_number;

-- =====================================================
-- PASO 5: ACTUALIZAR testAnalytics.js PARA QUE USE RPC SIMPLE
-- =====================================================

-- Crear función RPC simple que no tenga errores
CREATE OR REPLACE FUNCTION update_user_progress_simple(
  p_user_id UUID,
  p_topic_number INTEGER
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insertar o actualizar user_progress de forma simple
  INSERT INTO user_progress (user_id, topic_number, created_at, updated_at)
  VALUES (p_user_id, p_topic_number, NOW(), NOW())
  ON CONFLICT (user_id, topic_number) 
  DO UPDATE SET updated_at = NOW();
  
  -- Log para debug
  RAISE NOTICE 'user_progress actualizado para usuario % tema %', p_user_id, p_topic_number;
END;
$$;