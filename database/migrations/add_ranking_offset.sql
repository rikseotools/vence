-- ============================================================================
-- ADD: Parametro p_offset a get_ranking_for_period
-- Fecha: 2026-03-06
-- Motivo: Paginacion server-side para scroll infinito en RankingModal
-- Compatible: p_offset DEFAULT 0, callers existentes no se rompen
-- ============================================================================

CREATE OR REPLACE FUNCTION get_ranking_for_period(
    p_start_date timestamptz,
    p_end_date timestamptz DEFAULT NULL,
    p_min_questions integer DEFAULT 5,
    p_limit integer DEFAULT 100,
    p_offset integer DEFAULT 0
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
    GROUP BY t.user_id
    HAVING COUNT(*) >= p_min_questions
    ORDER BY
        accuracy DESC,
        total_questions DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_ranking_for_period TO authenticated;

COMMENT ON FUNCTION get_ranking_for_period IS 'Ranking optimizado con paginacion - agrega en Postgres sin limite de respuestas';
