CREATE OR REPLACE FUNCTION public.increment_daily_questions(p_user_id uuid, p_limit integer DEFAULT 25)
 RETURNS TABLE(can_answer boolean, questions_today integer, questions_remaining integer, is_limit_reached boolean, is_premium boolean, reset_time timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  DECLARE
    v_plan_type TEXT;
    v_today DATE;
    v_current_count INTEGER;
    v_is_premium BOOLEAN;
    v_reset_time TIMESTAMP WITH TIME ZONE;
  BEGIN
    v_today := (NOW() AT TIME ZONE 'Europe/Madrid')::DATE;
    v_reset_time := (v_today + INTERVAL '1 day')::TIMESTAMP AT TIME ZONE 'Europe/Madrid';

    SELECT up.plan_type INTO v_plan_type
    FROM user_profiles up
    WHERE up.id = p_user_id;

    v_is_premium := COALESCE(v_plan_type, 'free') IN ('premium', 'trial', 'legacy_free', 'premium_semester', 'admin');

    IF v_is_premium THEN
      RETURN QUERY SELECT
        TRUE::BOOLEAN,
        0::INTEGER,
        999::INTEGER,
        FALSE::BOOLEAN,
        TRUE::BOOLEAN,
        v_reset_time;
      RETURN;
    END IF;

    INSERT INTO daily_question_usage (user_id, usage_date, questions_answered, last_question_at, updated_at)
    VALUES (p_user_id, v_today, 1, NOW(), NOW())
    ON CONFLICT (user_id, usage_date)
    DO UPDATE SET
      questions_answered = CASE
        WHEN daily_question_usage.questions_answered < p_limit
        THEN daily_question_usage.questions_answered + 1
        ELSE daily_question_usage.questions_answered
      END,
      last_question_at = NOW(),
      updated_at = NOW();

    SELECT dqu.questions_answered INTO v_current_count
    FROM daily_question_usage dqu
    WHERE dqu.user_id = p_user_id AND dqu.usage_date = v_today;

    IF v_current_count IS NULL THEN
      v_current_count := 1;
    END IF;

    RETURN QUERY SELECT
      v_current_count <= p_limit,
      v_current_count,
      GREATEST(0, p_limit - v_current_count),
      v_current_count >= p_limit,
      FALSE::BOOLEAN,
      v_reset_time;
  END;
  $function$
