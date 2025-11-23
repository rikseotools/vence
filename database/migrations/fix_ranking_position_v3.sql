-- Primero, crear un tipo personalizado si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_position_result') THEN
        CREATE TYPE user_position_result AS (
            user_rank bigint,
            total_questions bigint,
            correct_answers bigint,
            accuracy numeric,
            total_users_in_ranking bigint
        );
    END IF;
END $$;

-- Eliminar función anterior
DROP FUNCTION IF EXISTS get_user_ranking_position(uuid, timestamptz, timestamptz, integer);

-- Crear función usando el tipo personalizado
CREATE OR REPLACE FUNCTION get_user_ranking_position(
    p_user_id uuid,
    p_start_date timestamptz,
    p_end_date timestamptz DEFAULT NULL,
    p_min_questions integer DEFAULT 5
)
RETURNS SETOF user_position_result
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH user_stats AS (
        SELECT
            t.user_id as uid,
            COUNT(*) as tq,
            COUNT(*) FILTER (WHERE tq.is_correct) as ca,
            ROUND((COUNT(*) FILTER (WHERE tq.is_correct)::numeric / COUNT(*)) * 100, 0) as acc
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
            uid,
            tq,
            ca,
            acc,
            ROW_NUMBER() OVER (ORDER BY acc DESC, tq DESC) as rk
        FROM user_stats
    ),
    user_count AS (
        SELECT COUNT(*) as total FROM ranked_users
    )
    SELECT
        r.rk::bigint,
        r.tq::bigint,
        r.ca::bigint,
        r.acc::numeric,
        uc.total::bigint
    FROM ranked_users r, user_count uc
    WHERE r.uid = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_ranking_position TO authenticated;
