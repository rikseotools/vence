-- scripts/corrected-user-progress-fix.sql
-- MIGRACIÓN CORREGIDA: user_progress con estructura real

-- =====================================================
-- PASO 1: VER TEMAS DISPONIBLES
-- =====================================================

SELECT 
  'TEMAS DISPONIBLES:' as info,
  id as topic_id,
  topic_number,
  title,
  description,
  difficulty,
  is_active
FROM topics 
WHERE is_active = true
ORDER BY topic_number;

-- =====================================================
-- PASO 2: ANÁLISIS DE DATOS A MIGRAR
-- =====================================================

WITH test_stats AS (
  SELECT 
    t.user_id,
    tq.tema_number,
    SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END) as correct_answers,
    COUNT(*) as total_answers,
    ROUND((SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric) * 100, 2) as accuracy_percentage,
    MAX(t.completed_at) as last_attempt_date
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
  tema_number,
  total_answers as total_attempts,
  correct_answers as correct_attempts,
  accuracy_percentage,
  last_attempt_date,
  CASE WHEN accuracy_percentage < 70 THEN true ELSE false END as needs_review
FROM test_stats
ORDER BY user_id, tema_number;

-- =====================================================
-- PASO 3: INSERCIÓN CORRECTA
-- =====================================================

INSERT INTO user_progress (
  user_id,
  topic_id,
  total_attempts,
  correct_attempts,
  last_attempt_date,
  accuracy_percentage,
  needs_review,
  created_at,
  updated_at
)
WITH test_stats AS (
  SELECT 
    t.user_id,
    tq.tema_number,
    SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END) as correct_answers,
    COUNT(*) as total_answers,
    ROUND((SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric) * 100, 2) as accuracy_percentage,
    MAX(t.completed_at) as last_attempt_date
  FROM tests t
  INNER JOIN test_questions tq ON t.id = tq.test_id
  WHERE t.is_completed = true 
    AND t.user_id IS NOT NULL
    AND tq.tema_number IS NOT NULL 
    AND tq.tema_number > 0
  GROUP BY t.user_id, tq.tema_number
)
SELECT 
  ts.user_id,
  tp.id as topic_id,  -- JOIN correcto usando topic_number
  ts.total_answers,
  ts.correct_answers,
  ts.last_attempt_date,
  ts.accuracy_percentage,
  CASE WHEN ts.accuracy_percentage < 70 THEN true ELSE false END as needs_review,
  NOW(),
  NOW()
FROM test_stats ts
INNER JOIN topics tp ON tp.topic_number = ts.tema_number  -- CORREGIDO: topic_number en lugar de number
WHERE tp.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM user_progress up 
    WHERE up.user_id = ts.user_id 
      AND up.topic_id = tp.id
  );

-- =====================================================
-- PASO 4: VERIFICAR RESULTADO
-- =====================================================

-- Contar registros insertados
SELECT 
  'RESULTADO INSERCIÓN:' as info,
  COUNT(*) as registros_user_progress
FROM user_progress;

-- Ver progreso por usuario con nombres de temas
SELECT 
  'PROGRESO POR USUARIO:' as info,
  up.user_id,
  COUNT(*) as temas_con_progreso,
  ROUND(AVG(up.accuracy_percentage), 2) as accuracy_promedio,
  STRING_AGG(tp.topic_number::text || ':' || tp.title, ', ' ORDER BY tp.topic_number) as temas_desbloqueados
FROM user_progress up
INNER JOIN topics tp ON up.topic_id = tp.id
GROUP BY up.user_id
ORDER BY up.user_id;

-- Ver detalles del progreso
SELECT 
  'DETALLE PROGRESO:' as info,
  up.user_id,
  tp.topic_number,
  tp.title as tema_titulo,
  up.total_attempts,
  up.correct_attempts,
  up.accuracy_percentage,
  up.needs_review,
  up.last_attempt_date
FROM user_progress up
INNER JOIN topics tp ON up.topic_id = tp.id
ORDER BY up.user_id, tp.topic_number;