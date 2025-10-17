-- scripts/final-corrected-user-progress.sql
-- MIGRACIÓN FINAL: user_progress excluyendo tema 0

-- =====================================================
-- PASO 1: VER TEMAS DISPONIBLES EN BD
-- =====================================================

SELECT 
  'TEMAS EN BD:' as info,
  id as topic_id,
  topic_number,
  title,
  is_active
FROM topics 
WHERE is_active = true
ORDER BY topic_number;

-- =====================================================
-- PASO 2: INSERCIÓN SIN TEMA 0
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
    AND tq.tema_number > 0  -- EXCLUIR tema 0
  GROUP BY t.user_id, tq.tema_number
)
SELECT 
  ts.user_id,
  tp.id as topic_id,
  ts.total_answers,
  ts.correct_answers,
  ts.last_attempt_date,
  ts.accuracy_percentage,
  CASE WHEN ts.accuracy_percentage < 70 THEN true ELSE false END as needs_review,
  NOW(),
  NOW()
FROM test_stats ts
INNER JOIN topics tp ON tp.topic_number = ts.tema_number
WHERE tp.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM user_progress up 
    WHERE up.user_id = ts.user_id 
      AND up.topic_id = tp.id
  );

-- =====================================================
-- PASO 3: VERIFICAR RESULTADO COMPLETO
-- =====================================================

-- Contar total de registros
SELECT 
  'MIGRACIÓN COMPLETADA:' as resultado,
  COUNT(*) as total_registros_user_progress
FROM user_progress;

-- Resumen por usuario
SELECT 
  'RESUMEN POR USUARIO:' as tipo,
  up.user_id,
  COUNT(*) as temas_desbloqueados,
  ROUND(AVG(up.accuracy_percentage), 2) as accuracy_promedio,
  MIN(tp.topic_number) as primer_tema,
  MAX(tp.topic_number) as ultimo_tema
FROM user_progress up
INNER JOIN topics tp ON up.topic_id = tp.id
GROUP BY up.user_id
ORDER BY up.user_id;

-- Top usuarios por accuracy
SELECT 
  'TOP USUARIOS (ACCURACY):' as tipo,
  up.user_id,
  COUNT(*) as temas_completados,
  ROUND(AVG(up.accuracy_percentage), 2) as accuracy_promedio,
  SUM(up.total_attempts) as total_preguntas_respondidas
FROM user_progress up
GROUP BY up.user_id
HAVING COUNT(*) >= 3  -- Al menos 3 temas
ORDER BY AVG(up.accuracy_percentage) DESC
LIMIT 10;

-- Verificar el usuario específico que reportó el problema
SELECT 
  'USUARIO ESPECÍFICO (ilovetestpro@gmail.com):' as tipo,
  up.user_id,
  tp.topic_number,
  tp.title,
  up.total_attempts,
  up.correct_attempts,
  up.accuracy_percentage,
  up.needs_review,
  up.last_attempt_date
FROM user_progress up
INNER JOIN topics tp ON up.topic_id = tp.id
INNER JOIN auth.users au ON up.user_id = au.id
WHERE au.email = 'ilovetestpro@gmail.com'
ORDER BY tp.topic_number;