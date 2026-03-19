-- ============================================================================
-- FIX: Excluir ghost rows del ranking
-- Fecha: 2026-03-05
-- Bug: initOfficialExam pre-crea filas en test_questions con user_answer=''
--      e is_correct=false. Estas "ghost rows" inflan total_questions y
--      destruyen la accuracy de los usuarios en el ranking.
-- Fix: Añadir AND tq.user_answer != '' para excluir filas no respondidas.
-- ============================================================================

-- ============================================================================
-- FUNCIÓN PRINCIPAL: Obtener ranking por período (CORREGIDA)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_ranking_for_period(
    p_start_date timestamptz,
    p_end_date timestamptz DEFAULT NULL,
    p_min_questions integer DEFAULT 5,
    p_limit integer DEFAULT 100
)
RETURNS TABLE (
    user_id uuid,
    total_questions bigint,
    correct_answers bigint,
    accuracy numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.user_id,
        COUNT(*)::bigint as total_questions,
        COUNT(*) FILTER (WHERE tq.is_correct)::bigint as correct_answers,
        ROUND((COUNT(*) FILTER (WHERE tq.is_correct)::numeric / COUNT(*)) * 100, 0) as accuracy
    FROM test_questions tq
    INNER JOIN tests t ON t.id = tq.test_id
    WHERE
        tq.created_at >= p_start_date
        AND (p_end_date IS NULL OR tq.created_at <= p_end_date)
        AND tq.user_answer != ''
    GROUP BY t.user_id
    HAVING COUNT(*) >= p_min_questions
    ORDER BY
        accuracy DESC,
        total_questions DESC
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_ranking_for_period IS 'Ranking optimizado - excluye ghost rows (user_answer vacío) de exámenes inicializados';

-- ============================================================================
-- FUNCIÓN AUXILIAR: Obtener posición del usuario actual (CORREGIDA)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_ranking_position(
    p_user_id uuid,
    p_start_date timestamptz,
    p_end_date timestamptz DEFAULT NULL,
    p_min_questions integer DEFAULT 5
)
RETURNS TABLE (
    user_rank bigint,
    total_questions bigint,
    correct_answers bigint,
    accuracy numeric,
    total_users_in_ranking bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH user_stats AS (
        SELECT
            t.user_id,
            COUNT(*)::bigint as total_questions,
            COUNT(*) FILTER (WHERE tq.is_correct)::bigint as correct_answers,
            ROUND((COUNT(*) FILTER (WHERE tq.is_correct)::numeric / COUNT(*)) * 100, 0) as accuracy
        FROM test_questions tq
        INNER JOIN tests t ON t.id = tq.test_id
        WHERE
            tq.created_at >= p_start_date
            AND (p_end_date IS NULL OR tq.created_at <= p_end_date)
            AND tq.user_answer != ''
        GROUP BY t.user_id
        HAVING COUNT(*) >= p_min_questions
    ),
    ranked_users AS (
        SELECT
            *,
            ROW_NUMBER() OVER (ORDER BY accuracy DESC, total_questions DESC) as rank
        FROM user_stats
    )
    SELECT
        ru.rank::bigint as user_rank,
        ru.total_questions,
        ru.correct_answers,
        ru.accuracy,
        (SELECT COUNT(*) FROM ranked_users)::bigint as total_users_in_ranking
    FROM ranked_users ru
    WHERE ru.user_id = p_user_id;
END;
$$;

COMMENT ON FUNCTION get_user_ranking_position IS 'Posición del usuario en ranking - excluye ghost rows';

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
DO $$
DECLARE
    v_ghost_count bigint;
    v_total_count bigint;
BEGIN
    SELECT COUNT(*) INTO v_total_count FROM test_questions;
    SELECT COUNT(*) INTO v_ghost_count FROM test_questions WHERE user_answer = '';

    RAISE NOTICE '✅ Funciones de ranking actualizadas (ghost rows fix)';
    RAISE NOTICE '   - Total test_questions: %', v_total_count;
    RAISE NOTICE '   - Ghost rows (user_answer=''''): %', v_ghost_count;
    RAISE NOTICE '   - Porcentaje ghost: %%%', ROUND(v_ghost_count::numeric / v_total_count * 100, 1);
END $$;
