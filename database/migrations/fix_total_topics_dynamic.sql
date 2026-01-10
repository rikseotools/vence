-- Migration: fix_total_topics_dynamic
-- Hace que total_topics sea dinámico según la oposición del usuario

CREATE OR REPLACE FUNCTION get_user_public_stats(p_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  user_created_at TIMESTAMPTZ,
  total_questions BIGINT,
  correct_answers BIGINT,
  global_accuracy NUMERIC,
  total_tests BIGINT,
  current_streak INTEGER,
  longest_streak INTEGER,
  target_oposicion TEXT,
  mastered_topics BIGINT,
  total_topics INTEGER,
  last_activity TIMESTAMPTZ,
  study_days BIGINT,
  total_study_time BIGINT,
  average_time_per_question NUMERIC,
  best_performance_time TEXT,
  favorite_topics TEXT[],
  weak_areas TEXT[],
  improvement_rate NUMERIC,
  predicted_score NUMERIC,
  study_consistency NUMERIC,
  total_tests_completed BIGINT,
  today_tests BIGINT,
  today_questions BIGINT,
  today_correct BIGINT,
  questions_this_week BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_target_oposicion TEXT;
  v_total_topics INTEGER;
BEGIN
  -- 1. Obtener la oposición objetivo del usuario
  SELECT up.target_oposicion INTO v_target_oposicion
  FROM user_profiles up
  WHERE up.id = p_user_id;

  -- 2. Normalizar slug (convertir guiones bajos a guiones)
  v_target_oposicion := REPLACE(COALESCE(v_target_oposicion, 'auxiliar-administrativo-estado'), '_', '-');

  -- 3. Obtener total_topics de la tabla oposiciones
  SELECT COALESCE(o.temas_count, 28) INTO v_total_topics
  FROM oposiciones o
  WHERE o.slug = v_target_oposicion;

  -- Si no se encuentra, usar 28 como default (Auxiliar)
  IF v_total_topics IS NULL THEN
    v_total_topics := 28;
  END IF;

  RETURN QUERY
  WITH user_stats AS (
    SELECT
      u.id AS user_id,
      u.created_at AS user_created_at,
      up.target_oposicion
    FROM auth.users u
    LEFT JOIN user_profiles up ON up.id = u.id
    WHERE u.id = p_user_id
  ),
  answer_stats AS (
    SELECT
      COUNT(*) AS total_questions,
      COUNT(*) FILTER (WHERE da.is_correct) AS correct_answers,
      ROUND(
        CASE WHEN COUNT(*) > 0
        THEN (COUNT(*) FILTER (WHERE da.is_correct)::NUMERIC / COUNT(*)::NUMERIC) * 100
        ELSE 0 END,
        1
      ) AS global_accuracy,
      MAX(da.created_at) AS last_activity,
      COUNT(DISTINCT DATE(da.created_at AT TIME ZONE 'Europe/Madrid')) AS study_days,
      COALESCE(SUM(da.time_spent_seconds), 0) AS total_study_time,
      ROUND(
        CASE WHEN COUNT(*) > 0
        THEN AVG(da.time_spent_seconds)
        ELSE 0 END,
        2
      ) AS average_time_per_question
    FROM detailed_answers da
    WHERE da.user_id = p_user_id
  ),
  test_stats AS (
    SELECT
      COUNT(*) AS total_tests,
      COUNT(*) FILTER (WHERE t.is_completed) AS total_tests_completed
    FROM tests t
    WHERE t.user_id = p_user_id
  ),
  streak_stats AS (
    SELECT
      COALESCE(us.current_streak, 0) AS current_streak,
      COALESCE(us.longest_streak, 0) AS longest_streak
    FROM user_streaks us
    WHERE us.user_id = p_user_id
  ),
  -- Contar temas dominados (≥70% accuracy con ≥10 preguntas)
  mastered_stats AS (
    SELECT COUNT(DISTINCT tema_number) AS mastered_count
    FROM (
      SELECT
        CASE
          WHEN q.tema_number BETWEEN 1 AND 16 THEN q.tema_number
          WHEN q.tema_number BETWEEN 101 AND 112 THEN q.tema_number
          WHEN q.tema_number BETWEEN 201 AND 299 THEN q.tema_number
          WHEN q.tema_number BETWEEN 301 AND 399 THEN q.tema_number
          WHEN q.tema_number BETWEEN 401 AND 499 THEN q.tema_number
          WHEN q.tema_number BETWEEN 501 AND 599 THEN q.tema_number
          ELSE NULL
        END AS tema_number,
        COUNT(*) AS total,
        ROUND((COUNT(*) FILTER (WHERE da.is_correct)::NUMERIC / NULLIF(COUNT(*)::NUMERIC, 0)) * 100, 1) AS accuracy
      FROM detailed_answers da
      JOIN questions q ON q.id = da.question_id
      WHERE da.user_id = p_user_id
        AND q.tema_number IS NOT NULL
      GROUP BY 1
      HAVING COUNT(*) >= 10
    ) tema_stats
    WHERE accuracy >= 70
      -- Filtrar por temas válidos según oposición
      AND (
        (v_target_oposicion = 'auxiliar-administrativo-estado' AND (
          tema_number BETWEEN 1 AND 16 OR tema_number BETWEEN 101 AND 112
        ))
        OR
        (v_target_oposicion = 'administrativo-estado' AND (
          tema_number BETWEEN 1 AND 16 OR
          tema_number BETWEEN 101 AND 112 OR
          tema_number BETWEEN 201 AND 207 OR
          tema_number BETWEEN 301 AND 307 OR
          tema_number BETWEEN 401 AND 409 OR
          tema_number BETWEEN 501 AND 506
        ))
        OR
        (v_target_oposicion NOT IN ('auxiliar-administrativo-estado', 'administrativo-estado'))
      )
  ),
  today_stats AS (
    SELECT
      COUNT(DISTINCT t.id) AS today_tests,
      COUNT(da.id) AS today_questions,
      COUNT(da.id) FILTER (WHERE da.is_correct) AS today_correct
    FROM tests t
    LEFT JOIN detailed_answers da ON da.test_id = t.id
    WHERE t.user_id = p_user_id
      AND t.created_at >= (CURRENT_DATE AT TIME ZONE 'Europe/Madrid')
      AND t.created_at < ((CURRENT_DATE + INTERVAL '1 day') AT TIME ZONE 'Europe/Madrid')
  ),
  week_stats AS (
    SELECT COUNT(*) AS questions_this_week
    FROM detailed_answers da
    WHERE da.user_id = p_user_id
      AND da.created_at >= (CURRENT_DATE - INTERVAL '7 days')
  )
  SELECT
    us.user_id,
    us.user_created_at,
    COALESCE(ans.total_questions, 0),
    COALESCE(ans.correct_answers, 0),
    COALESCE(ans.global_accuracy, 0),
    COALESCE(ts.total_tests, 0),
    COALESCE(ss.current_streak, 0),
    COALESCE(ss.longest_streak, 0),
    us.target_oposicion,
    COALESCE(ms.mastered_count, 0),
    v_total_topics,  -- ✅ Ahora es dinámico
    ans.last_activity,
    COALESCE(ans.study_days, 0),
    COALESCE(ans.total_study_time, 0),
    COALESCE(ans.average_time_per_question, 0),
    'afternoon'::TEXT,  -- Simplified
    ARRAY[]::TEXT[],
    ARRAY[]::TEXT[],
    0::NUMERIC,
    0::NUMERIC,
    CASE WHEN ans.study_days > 0
      THEN ROUND((ans.study_days::NUMERIC / 30) * 100, 2)
      ELSE 0
    END,
    COALESCE(ts.total_tests_completed, 0),
    COALESCE(tds.today_tests, 0),
    COALESCE(tds.today_questions, 0),
    COALESCE(tds.today_correct, 0),
    COALESCE(ws.questions_this_week, 0)
  FROM user_stats us
  CROSS JOIN answer_stats ans
  CROSS JOIN test_stats ts
  LEFT JOIN streak_stats ss ON TRUE
  CROSS JOIN mastered_stats ms
  CROSS JOIN today_stats tds
  CROSS JOIN week_stats ws;
END;
$$;

-- Comentario
COMMENT ON FUNCTION get_user_public_stats IS
'Estadísticas públicas del usuario. total_topics ahora es dinámico según la oposición del usuario.';
