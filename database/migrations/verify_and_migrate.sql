-- Verificación completa y migración de datos
-- =====================================================

-- 1. Verificar que las tablas se crearon correctamente
SELECT 'VERIFICANDO TABLAS...' as mensaje;
SELECT 
    table_name,
    CASE 
        WHEN table_name = 'user_question_history' THEN '✅ Tabla principal creada'
        WHEN table_name = 'user_difficulty_metrics' THEN '✅ Tabla de métricas creada'
    END as status
FROM information_schema.tables 
WHERE table_name IN ('user_question_history', 'user_difficulty_metrics')
AND table_schema = 'public';

-- 2. Verificar que las funciones existen
SELECT 'VERIFICANDO FUNCIONES...' as mensaje;
SELECT 
    routine_name,
    CASE 
        WHEN routine_name = 'migrate_existing_data' THEN '✅ Función de migración disponible'
        WHEN routine_name = 'calculate_personal_difficulty' THEN '✅ Función de cálculo disponible'
        WHEN routine_name = 'diagnose_question_references' THEN '✅ Función de diagnóstico disponible'
    END as status
FROM information_schema.routines 
WHERE routine_name IN ('migrate_existing_data', 'calculate_personal_difficulty', 'diagnose_question_references')
AND routine_schema = 'public';

-- 3. Diagnosticar datos antes de migrar
SELECT 'DIAGNÓSTICO PRE-MIGRACIÓN...' as mensaje;
SELECT * FROM diagnose_question_references();

-- 4. Ejecutar migración de datos
SELECT 'EJECUTANDO MIGRACIÓN...' as mensaje;
SELECT migrate_existing_data() as registros_migrados;

-- 5. Verificar resultados post-migración
SELECT 'RESULTADOS POST-MIGRACIÓN...' as mensaje;
SELECT 
    COUNT(*) as total_historiales,
    COUNT(DISTINCT user_id) as usuarios_únicos,
    COUNT(DISTINCT question_id) as preguntas_únicas,
    MIN(total_attempts) as min_intentos,
    MAX(total_attempts) as max_intentos,
    ROUND(AVG(success_rate::NUMERIC), 2) as promedio_éxito
FROM user_question_history;

-- 6. Mostrar distribución por dificultad personal
SELECT 'DISTRIBUCIÓN POR DIFICULTAD...' as mensaje;
SELECT 
    personal_difficulty,
    COUNT(*) as cantidad,
    ROUND(AVG(success_rate::NUMERIC), 2) as promedio_éxito,
    ROUND(AVG(total_attempts), 1) as promedio_intentos
FROM user_question_history
GROUP BY personal_difficulty
ORDER BY 
    CASE personal_difficulty
        WHEN 'easy' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'hard' THEN 3
        WHEN 'extreme' THEN 4
    END;

-- 7. Mostrar ejemplos de usuarios con más datos
SELECT 'TOP USUARIOS CON MÁS DATOS...' as mensaje;
SELECT 
    user_id,
    COUNT(*) as preguntas_con_historial,
    ROUND(AVG(success_rate::NUMERIC), 2) as éxito_promedio,
    COUNT(*) FILTER (WHERE personal_difficulty = 'easy') as fáciles,
    COUNT(*) FILTER (WHERE personal_difficulty = 'medium') as medias,
    COUNT(*) FILTER (WHERE personal_difficulty = 'hard') as difíciles,
    COUNT(*) FILTER (WHERE personal_difficulty = 'extreme') as extremas
FROM user_question_history
GROUP BY user_id
ORDER BY COUNT(*) DESC
LIMIT 5;

-- 8. Verificar integridad de datos
SELECT 'VERIFICACIÓN DE INTEGRIDAD...' as mensaje;
SELECT 
    CASE 
        WHEN COUNT(*) = COUNT(CASE WHEN user_id IS NOT NULL AND question_id IS NOT NULL THEN 1 END) 
        THEN '✅ Todos los registros tienen user_id y question_id válidos'
        ELSE '❌ Hay registros con valores NULL'
    END as integridad_ids,
    CASE 
        WHEN MIN(success_rate) >= 0 AND MAX(success_rate) <= 1 
        THEN '✅ success_rate en rango válido (0-1)'
        ELSE '❌ success_rate fuera de rango'
    END as integridad_rates,
    CASE 
        WHEN MIN(total_attempts) >= 1 
        THEN '✅ total_attempts válidos (≥1)'
        ELSE '❌ total_attempts inválidos'
    END as integridad_attempts
FROM user_question_history;

SELECT 'MIGRACIÓN COMPLETADA ✅' as mensaje;