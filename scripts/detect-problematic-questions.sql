-- detect-problematic-questions.sql
-- Función para detectar automáticamente preguntas problemáticas y añadirlas al tracking

CREATE OR REPLACE FUNCTION detect_and_track_problematic_questions()
RETURNS jsonb AS $$
DECLARE
    detected_count integer := 0;
    redetected_count integer := 0;
    result jsonb;
BEGIN
    -- 🎯 DETECCIÓN 1: Preguntas con alta tasa de fallos (frequent_fails)
    WITH frequent_fails AS (
        SELECT 
            tq.question_id,
            COUNT(DISTINCT tq.tests.user_id) as unique_users_wrong,
            COUNT(*) as total_attempts,
            COUNT(*) FILTER (WHERE tq.is_correct = false) as incorrect_attempts,
            ROUND((COUNT(*) FILTER (WHERE tq.is_correct = false)::numeric / COUNT(*)) * 100, 2) as failure_rate
        FROM test_questions tq
        INNER JOIN questions q ON tq.question_id = q.id
        WHERE q.is_active = true
          AND tq.created_at >= NOW() - INTERVAL '30 days' -- Solo últimos 30 días
        GROUP BY tq.question_id
        HAVING COUNT(*) >= 5 -- Al menos 5 intentos
           AND COUNT(DISTINCT tq.tests.user_id) >= 3 -- Al menos 3 usuarios distintos
           AND (COUNT(*) FILTER (WHERE tq.is_correct = false)::numeric / COUNT(*)) >= 0.60 -- 60% de fallos
    )
    INSERT INTO problematic_questions_tracking (
        question_id, detection_type, failure_rate, users_affected, total_attempts, status
    )
    SELECT 
        ff.question_id,
        'frequent_fails',
        ff.failure_rate,
        ff.unique_users_wrong,
        ff.total_attempts,
        'pending'
    FROM frequent_fails ff
    WHERE NOT EXISTS (
        -- No insertar si ya existe un registro resolved reciente
        SELECT 1 FROM problematic_questions_tracking pqt 
        WHERE pqt.question_id = ff.question_id 
          AND pqt.detection_type = 'frequent_fails'
          AND pqt.status = 'resolved'
          AND pqt.resolved_at > NOW() - INTERVAL '7 days'
    )
    ON CONFLICT (question_id, detection_type) DO NOTHING;

    GET DIAGNOSTICS detected_count = ROW_COUNT;

    -- 🚨 DETECCIÓN 2: Preguntas con alto abandono (high_abandonment)
    WITH abandonment_stats AS (
        SELECT 
            tq.question_id,
            COUNT(*) as total_appearances,
            COUNT(*) FILTER (WHERE t.is_completed = false) as abandoned_at,
            COUNT(DISTINCT CASE WHEN t.is_completed = false THEN t.user_id END) as unique_users_abandoned,
            ROUND((COUNT(*) FILTER (WHERE t.is_completed = false)::numeric / COUNT(*)) * 100, 2) as abandonment_rate
        FROM test_questions tq
        INNER JOIN tests t ON tq.test_id = t.id
        INNER JOIN questions q ON tq.question_id = q.id
        WHERE q.is_active = true
          AND tq.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY tq.question_id
        HAVING COUNT(*) >= 4 -- Al menos 4 apariciones
           AND COUNT(*) FILTER (WHERE t.is_completed = false) >= 2 -- Al menos 2 abandonos
           AND (COUNT(*) FILTER (WHERE t.is_completed = false)::numeric / COUNT(*)) >= 0.50 -- 50% abandono
    )
    INSERT INTO problematic_questions_tracking (
        question_id, detection_type, abandonment_rate, users_affected, total_attempts, status
    )
    SELECT 
        ats.question_id,
        'high_abandonment',
        ats.abandonment_rate,
        ats.unique_users_abandoned,
        ats.total_appearances,
        'pending'
    FROM abandonment_stats ats
    WHERE NOT EXISTS (
        SELECT 1 FROM problematic_questions_tracking pqt 
        WHERE pqt.question_id = ats.question_id 
          AND pqt.detection_type = 'high_abandonment'
          AND pqt.status = 'resolved'
          AND pqt.resolved_at > NOW() - INTERVAL '7 days'
    )
    ON CONFLICT (question_id, detection_type) DO NOTHING;

    -- 🔄 RE-DETECCIÓN: Preguntas resolved que superan el umbral
    WITH redetection_candidates AS (
        SELECT 
            pqt.id,
            pqt.question_id,
            pqt.detection_type,
            pqt.redetection_threshold_users,
            
            -- Contar nuevos fallos desde la resolución
            CASE 
                WHEN pqt.detection_type = 'frequent_fails' THEN
                    COUNT(DISTINCT tq.tests.user_id) FILTER (WHERE tq.is_correct = false AND tq.created_at > pqt.resolved_at)
                ELSE
                    COUNT(DISTINCT t.user_id) FILTER (WHERE t.is_completed = false AND tq.created_at > pqt.resolved_at)
            END as new_users_affected,
            
            -- Métricas actualizadas
            CASE 
                WHEN pqt.detection_type = 'frequent_fails' THEN
                    ROUND((COUNT(*) FILTER (WHERE tq.is_correct = false)::numeric / COUNT(*)) * 100, 2)
                ELSE
                    ROUND((COUNT(*) FILTER (WHERE t.is_completed = false)::numeric / COUNT(*)) * 100, 2)
            END as current_rate

        FROM problematic_questions_tracking pqt
        INNER JOIN test_questions tq ON pqt.question_id = tq.question_id
        LEFT JOIN tests t ON tq.test_id = t.id
        WHERE pqt.status = 'resolved'
          AND pqt.resolved_at < NOW() - INTERVAL '7 days' -- Al menos 7 días desde resolución
        GROUP BY pqt.id, pqt.question_id, pqt.detection_type, pqt.redetection_threshold_users, pqt.resolved_at
    )
    UPDATE problematic_questions_tracking 
    SET 
        status = 'pending',
        detected_at = NOW(),
        users_affected = rc.new_users_affected,
        failure_rate = CASE WHEN rc.detection_type = 'frequent_fails' THEN rc.current_rate ELSE failure_rate END,
        abandonment_rate = CASE WHEN rc.detection_type = 'high_abandonment' THEN rc.current_rate ELSE abandonment_rate END
    FROM redetection_candidates rc
    WHERE problematic_questions_tracking.id = rc.id
      AND rc.new_users_affected >= rc.redetection_threshold_users
      AND rc.current_rate >= 50; -- Mantener alta tasa problemática

    GET DIAGNOSTICS redetected_count = ROW_COUNT;

    -- Resultado final
    result := jsonb_build_object(
        'success', true,
        'detected_new', detected_count,
        'redetected', redetected_count,
        'timestamp', NOW(),
        'message', format('Detectadas %s preguntas nuevas, %s re-detectadas', detected_count, redetected_count)
    );

    RETURN result;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'timestamp', NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- 🔄 FUNCIÓN DE LIMPIEZA: Eliminar registros antiguos sin actividad
CREATE OR REPLACE FUNCTION cleanup_old_tracking_records()
RETURNS integer AS $$
DECLARE
    deleted_count integer;
BEGIN
    -- Eliminar registros resolved muy antiguos (más de 90 días) sin re-detección
    DELETE FROM problematic_questions_tracking 
    WHERE status = 'resolved' 
      AND resolved_at < NOW() - INTERVAL '90 days';
      
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 🎯 FUNCIÓN PRINCIPAL: Ejecutar detección completa
CREATE OR REPLACE FUNCTION run_problematic_questions_detection()
RETURNS jsonb AS $$
DECLARE
    detection_result jsonb;
    cleanup_count integer;
    final_result jsonb;
BEGIN
    -- 1. Ejecutar detección
    SELECT detect_and_track_problematic_questions() INTO detection_result;
    
    -- 2. Ejecutar limpieza
    SELECT cleanup_old_tracking_records() INTO cleanup_count;
    
    -- 3. Resultado combinado
    final_result := detection_result || jsonb_build_object('cleaned_records', cleanup_count);
    
    RETURN final_result;
END;
$$ LANGUAGE plpgsql;

-- 📊 FUNCIÓN DE ESTADÍSTICAS: Ver estado del tracking
CREATE OR REPLACE FUNCTION get_tracking_stats()
RETURNS jsonb AS $$
BEGIN
    RETURN (
        SELECT jsonb_build_object(
            'pending_questions', COUNT(*) FILTER (WHERE status = 'pending'),
            'resolved_questions', COUNT(*) FILTER (WHERE status = 'resolved'),
            'frequent_fails', COUNT(*) FILTER (WHERE detection_type = 'frequent_fails'),
            'high_abandonment', COUNT(*) FILTER (WHERE detection_type = 'high_abandonment'),
            'last_detection', MAX(detected_at),
            'oldest_pending', MIN(detected_at) FILTER (WHERE status = 'pending'),
            'recent_resolutions', COUNT(*) FILTER (WHERE status = 'resolved' AND resolved_at > NOW() - INTERVAL '7 days')
        )
        FROM problematic_questions_tracking
    );
END;
$$ LANGUAGE plpgsql;

-- 🔧 COMENTARIOS DE USO:
-- Para ejecutar detección manual: SELECT run_problematic_questions_detection();
-- Para ver estadísticas: SELECT get_tracking_stats();
-- Para programar ejecución automática, usar cron job o trigger temporal