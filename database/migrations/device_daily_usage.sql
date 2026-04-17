-- ============================================================
-- FUNCTION: get_device_daily_usage
-- Sums questions_answered today across ALL free accounts that
-- share a given device_id. Premium accounts are excluded from
-- the sum (they have no limit).
-- Returns 0 if device_id not found or table doesn't exist.
-- ============================================================

CREATE OR REPLACE FUNCTION get_device_daily_usage(p_device_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_total INTEGER;
  v_today DATE;
BEGIN
  v_today := (NOW() AT TIME ZONE 'Europe/Madrid')::DATE;

  SELECT COALESCE(SUM(dqu.questions_answered), 0) INTO v_total
  FROM daily_question_usage dqu
  INNER JOIN user_devices ud ON ud.user_id = dqu.user_id
  INNER JOIN user_profiles up ON up.id = dqu.user_id
  WHERE ud.device_id = p_device_id
    AND ud.last_seen_at > NOW() - INTERVAL '30 days'
    AND dqu.usage_date = v_today
    AND COALESCE(up.plan_type, 'free') NOT IN ('premium', 'trial', 'legacy_free', 'premium_semester', 'admin');

  RETURN v_total;
END;
$$;
