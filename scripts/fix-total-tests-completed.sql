-- Arreglar get_user_public_stats para que devuelva total_tests_completed correctamente
-- Este fix añade el campo que falta y corrige todos los tipos BIGINT -> INTEGER

DROP FUNCTION IF EXISTS get_user_public_stats(UUID);

CREATE OR REPLACE FUNCTION get_user_public_stats(p_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  ciudad TEXT,
  target_oposicion TEXT,
  current_streak INTEGER,
  longest_streak INTEGER,
  last_activity_date TIMESTAMP WITH TIME ZONE,
  days_in_vence INTEGER,
  total_questions_answered INTEGER,
  total_correct_answers INTEGER,
  today_tests INTEGER,
  this_week_tests INTEGER,
  this_month_tests INTEGER,
  mastered_topics INTEGER,
  total_tests_completed INTEGER  -- 🔴 CAMPO AÑADIDO
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH user_basic_info AS (
    SELECT
      up.id,
      up.created_at,
      pup.display_name,
      pup.ciudad,
      up.target_oposicion
    FROM public.user_profiles up
    LEFT JOIN public.public_user_profiles pup ON pup.id = up.id
    WHERE up.id = p_user_id
  ),

  streak_info AS (
    SELECT
      user_streaks.current_streak,
      user_streaks.longest_streak,
      user_streaks.last_activity_date
    FROM public.user_streaks
    WHERE user_streaks.user_id = p_user_id
  ),

  answers_stats AS (
    SELECT
      COUNT(*)::INTEGER as total_answers,
      COUNT(*) FILTER (WHERE is_correct = true)::INTEGER as correct_answers
    FROM public.detailed_answers
    WHERE detailed_answers.user_id = p_user_id
  ),

  today_count AS (
    SELECT COUNT(*)::INTEGER as count_today
    FROM public.tests
    WHERE tests.user_id = p_user_id
      AND is_completed = true
      AND DATE(completed_at) = CURRENT_DATE
  ),

  week_count AS (
    SELECT COUNT(*)::INTEGER as count_week
    FROM public.tests
    WHERE tests.user_id = p_user_id
      AND is_completed = true
      AND completed_at >= DATE_TRUNC('week', CURRENT_DATE)
  ),

  month_count AS (
    SELECT COUNT(*)::INTEGER as count_month
    FROM public.tests
    WHERE tests.user_id = p_user_id
      AND is_completed = true
      AND completed_at >= DATE_TRUNC('month', CURRENT_DATE)
  ),

  mastered_count AS (
    SELECT COUNT(DISTINCT topic_id)::INTEGER as count_mastered
    FROM public.user_progress
    WHERE user_progress.user_id = p_user_id
      AND accuracy_percentage >= 80
      AND total_attempts >= 10
  ),

  completed_tests_count AS (
    SELECT COUNT(*)::INTEGER as count_completed
    FROM public.tests
    WHERE tests.user_id = p_user_id
      AND is_completed = true
  )

  SELECT
    ubi.id,
    ubi.display_name,
    ubi.ciudad,
    ubi.target_oposicion,
    COALESCE(si.current_streak, 0)::INTEGER,
    COALESCE(si.longest_streak, 0)::INTEGER,
    si.last_activity_date,
    EXTRACT(DAY FROM (NOW() - ubi.created_at))::INTEGER as days_in_vence,
    COALESCE(ast.total_answers, 0)::INTEGER,
    COALESCE(ast.correct_answers, 0)::INTEGER,
    COALESCE(tc.count_today, 0)::INTEGER,
    COALESCE(wc.count_week, 0)::INTEGER,
    COALESCE(mc.count_month, 0)::INTEGER,
    COALESCE(msc.count_mastered, 0)::INTEGER,
    COALESCE(ctc.count_completed, 0)::INTEGER  -- 🔴 CAMPO AÑADIDO
  FROM user_basic_info ubi
  LEFT JOIN streak_info si ON true
  LEFT JOIN answers_stats ast ON true
  LEFT JOIN today_count tc ON true
  LEFT JOIN week_count wc ON true
  LEFT JOIN month_count mc ON true
  LEFT JOIN mastered_count msc ON true
  LEFT JOIN completed_tests_count ctc ON true;  -- 🔴 JOIN AÑADIDO
END;
$$;

-- Verificar que la funcion se creo correctamente
SELECT routine_name, data_type
FROM information_schema.routines
WHERE routine_name = 'get_user_public_stats';

-- Probar con Inma para verificar el total_tests_completed
SELECT * FROM get_user_public_stats(
  (SELECT id FROM user_profiles WHERE email = 'inmacorcuera72@gmail.com')
);
