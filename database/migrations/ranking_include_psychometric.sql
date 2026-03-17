-- ============================================================================
-- ADD: Incluir respuestas psicotécnicas en el ranking de opositores
-- Fecha: 2026-03-17
-- Motivo: Los psicotécnicos son parte del estudio y deben contar
-- Método: UNION ALL de test_questions + psychometric_test_answers
-- ============================================================================

-- Índice para performance en psychometric_test_answers.created_at
CREATE INDEX IF NOT EXISTS idx_psychometric_answers_created_at
  ON psychometric_test_answers(created_at);

-- ============================================================================
-- FUNCIÓN PRINCIPAL: Ranking por período (legislativo + psicotécnico)
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
        combined.user_id,
        COUNT(*)::bigint as total_questions,
        COUNT(*) FILTER (WHERE combined.is_correct)::bigint as correct_answers,
        ROUND((COUNT(*) FILTER (WHERE combined.is_correct)::numeric / COUNT(*)) * 100, 0) as accuracy
    FROM (
        -- Respuestas legislativas
        SELECT t.user_id, tq.is_correct, tq.created_at
        FROM test_questions tq
        INNER JOIN tests t ON t.id = tq.test_id
        WHERE tq.created_at >= p_start_date
          AND (p_end_date IS NULL OR tq.created_at <= p_end_date)

        UNION ALL

        -- Respuestas psicotécnicas
        SELECT pa.user_id, pa.is_correct, pa.created_at
        FROM psychometric_test_answers pa
        WHERE pa.user_id IS NOT NULL
          AND pa.created_at >= p_start_date
          AND (p_end_date IS NULL OR pa.created_at <= p_end_date)
    ) combined
    GROUP BY combined.user_id
    HAVING COUNT(*) >= p_min_questions
    ORDER BY
        accuracy DESC,
        total_questions DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_ranking_for_period TO authenticated;

COMMENT ON FUNCTION get_ranking_for_period IS 'Ranking unificado (legislativo + psicotécnico) con paginación';

-- ============================================================================
-- FUNCIÓN AUXILIAR: Posición del usuario (legislativo + psicotécnico)
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
            combined.user_id,
            COUNT(*)::bigint as total_questions,
            COUNT(*) FILTER (WHERE combined.is_correct)::bigint as correct_answers,
            ROUND((COUNT(*) FILTER (WHERE combined.is_correct)::numeric / COUNT(*)) * 100, 0) as accuracy
        FROM (
            SELECT t.user_id, tq.is_correct, tq.created_at
            FROM test_questions tq
            INNER JOIN tests t ON t.id = tq.test_id
            WHERE tq.created_at >= p_start_date
              AND (p_end_date IS NULL OR tq.created_at <= p_end_date)

            UNION ALL

            SELECT pa.user_id, pa.is_correct, pa.created_at
            FROM psychometric_test_answers pa
            WHERE pa.user_id IS NOT NULL
              AND pa.created_at >= p_start_date
              AND (p_end_date IS NULL OR pa.created_at <= p_end_date)
        ) combined
        GROUP BY combined.user_id
        HAVING COUNT(*) >= p_min_questions
    ),
    ranked_users AS (
        SELECT
            us.user_id,
            us.total_questions as tq,
            us.correct_answers as ca,
            us.accuracy as acc,
            ROW_NUMBER() OVER (ORDER BY us.accuracy DESC, us.total_questions DESC) as rank
        FROM user_stats us
    )
    SELECT
        ru.rank::bigint as user_rank,
        ru.tq as total_questions,
        ru.ca as correct_answers,
        ru.acc as accuracy,
        (SELECT COUNT(*) FROM ranked_users)::bigint as total_users_in_ranking
    FROM ranked_users ru
    WHERE ru.user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_ranking_position TO authenticated;

COMMENT ON FUNCTION get_user_ranking_position IS 'Posición del usuario en ranking unificado (legislativo + psicotécnico)';
