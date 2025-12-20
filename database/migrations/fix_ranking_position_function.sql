-- ============================================================================
-- FIX: Corregir función get_user_ranking_position
-- Error: "column reference accuracy is ambiguous"
-- Solución: Listar columnas explícitamente en lugar de SELECT *
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
        GROUP BY t.user_id
        HAVING COUNT(*) >= p_min_questions
    ),
    ranked_users AS (
        SELECT
            user_id,
            total_questions,
            correct_answers,
            accuracy,
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

GRANT EXECUTE ON FUNCTION get_user_ranking_position TO authenticated;

COMMENT ON FUNCTION get_user_ranking_position IS 'Obtiene posición exacta de un usuario en el ranking (FIXED: ambiguous column)';
