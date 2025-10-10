-- create_subscription_count_function.sql
-- Function to get subscription count statistics

CREATE OR REPLACE FUNCTION get_subscription_count()
RETURNS TABLE (
    suscritos INTEGER,
    no_suscritos INTEGER,
    total INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH user_counts AS (
        SELECT 
            COUNT(*) FILTER (WHERE ep.unsubscribed_all IS NULL OR ep.unsubscribed_all = false) as subscribed_count,
            COUNT(*) FILTER (WHERE ep.unsubscribed_all = true) as unsubscribed_count,
            COUNT(*) as total_count
        FROM auth.users u
        LEFT JOIN email_preferences ep ON ep.user_id = u.id
        WHERE u.email_confirmed_at IS NOT NULL
    )
    SELECT 
        subscribed_count::INTEGER as suscritos,
        unsubscribed_count::INTEGER as no_suscritos,
        total_count::INTEGER as total
    FROM user_counts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role and authenticated users
GRANT EXECUTE ON FUNCTION get_subscription_count() TO service_role;
GRANT EXECUTE ON FUNCTION get_subscription_count() TO authenticated;

COMMENT ON FUNCTION get_subscription_count() IS 'Returns subscription statistics for email tracking admin panel';