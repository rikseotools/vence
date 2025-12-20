DROP FUNCTION IF EXISTS get_user_ranking_position(uuid, timestamptz, timestamptz, integer);

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
    SELECT
        subq.rank as user_rank,
        subq.total_questions,
        subq.correct_answers,
        subq.accuracy,
        subq.total_users as total_users_in_ranking
    FROM (
        WITH user_stats AS (
            SELECT
                t.user_id,
                COUNT(*) as total_questions,
                COUNT(*) FILTER (WHERE tq.is_correct) as correct_answers,
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
            r.rank::bigint,
            r.total_questions::bigint,
            r.correct_answers::bigint,
            r.accuracy::numeric,
            (SELECT COUNT(*)::bigint FROM ranked_users) as total_users
        FROM ranked_users r
        WHERE r.user_id = p_user_id
    ) subq;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_ranking_position TO authenticated;
