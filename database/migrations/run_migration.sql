-- Ejecutar migración de datos existentes
-- =====================================================

-- 1. Primero diagnosticar los datos (opcional)
SELECT 'DIAGNÓSTICO DE DATOS:' as mensaje;
SELECT * FROM diagnose_null_question_ids();

-- 2. Ejecutar la migración de datos
SELECT 'INICIANDO MIGRACIÓN...' as mensaje;
SELECT migrate_existing_data() as registros_procesados;

-- 3. Verificar resultados
SELECT 'VERIFICACIÓN POST-MIGRACIÓN:' as mensaje;
SELECT COUNT(*) as total_historiales_creados FROM user_question_history;
SELECT COUNT(DISTINCT user_id) as usuarios_con_historial FROM user_question_history;
SELECT COUNT(DISTINCT question_id) as preguntas_con_historial FROM user_question_history;

-- 4. Mostrar algunos ejemplos de datos creados
SELECT 'EJEMPLOS DE DATOS CREADOS:' as mensaje;
SELECT 
    user_id,
    question_id,
    total_attempts,
    correct_attempts,
    success_rate,
    personal_difficulty,
    trend
FROM user_question_history 
ORDER BY total_attempts DESC 
LIMIT 5;