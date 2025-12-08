-- CREATE RPC FUNCTION TO CALCULATE USER DIFFICULTY METRICS FROM TEST_QUESTIONS
-- This replaces the non-existent user_difficulty_metrics table

CREATE OR REPLACE FUNCTION get_user_difficulty_metrics(p_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  total_questions_attempted INTEGER,
  questions_mastered INTEGER,
  questions_struggling INTEGER,
  avg_personal_difficulty NUMERIC,
  accuracy_trend TEXT,
  last_updated TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH user_question_stats AS (
    -- Get all unique questions attempted by the user with their stats
    SELECT
      tq.question_id,
      COUNT(*) as attempts,
      SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END) as correct_count,
      MAX(tq.created_at) as last_attempt,
      -- Calculate success rate for each question
      ROUND(SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::NUMERIC * 100.0 / COUNT(*)::NUMERIC, 2) as success_rate
    FROM test_questions tq
    JOIN tests t ON t.id = tq.test_id
    WHERE t.user_id = p_user_id
      AND tq.question_id IS NOT NULL
    GROUP BY tq.question_id
  ),

  recent_accuracy AS (
    -- Calculate accuracy trend from last 30 days
    SELECT
      CASE
        WHEN COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '15 days') = 0 THEN 'stable'
        WHEN
          (SUM(CASE WHEN is_correct AND created_at > NOW() - INTERVAL '15 days' THEN 1 ELSE 0 END)::NUMERIC * 100.0 /
           NULLIF(COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '15 days'), 0)) >
          (SUM(CASE WHEN is_correct AND created_at BETWEEN NOW() - INTERVAL '30 days' AND NOW() - INTERVAL '15 days' THEN 1 ELSE 0 END)::NUMERIC * 100.0 /
           NULLIF(COUNT(*) FILTER (WHERE created_at BETWEEN NOW() - INTERVAL '30 days' AND NOW() - INTERVAL '15 days'), 0))
        THEN 'improving'
        WHEN
          (SUM(CASE WHEN is_correct AND created_at > NOW() - INTERVAL '15 days' THEN 1 ELSE 0 END)::NUMERIC * 100.0 /
           NULLIF(COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '15 days'), 0)) <
          (SUM(CASE WHEN is_correct AND created_at BETWEEN NOW() - INTERVAL '30 days' AND NOW() - INTERVAL '15 days' THEN 1 ELSE 0 END)::NUMERIC * 100.0 /
           NULLIF(COUNT(*) FILTER (WHERE created_at BETWEEN NOW() - INTERVAL '30 days' AND NOW() - INTERVAL '15 days'), 0))
        THEN 'declining'
        ELSE 'stable'
      END as trend
    FROM test_questions tq
    JOIN tests t ON t.id = tq.test_id
    WHERE t.user_id = p_user_id
      AND tq.created_at > NOW() - INTERVAL '30 days'
  )

  SELECT
    p_user_id as user_id,
    COUNT(*)::INTEGER as total_questions_attempted,
    COUNT(*) FILTER (WHERE success_rate >= 80 AND attempts >= 2)::INTEGER as questions_mastered,
    COUNT(*) FILTER (WHERE success_rate < 50 AND attempts >= 2)::INTEGER as questions_struggling,
    -- Calculate average difficulty (inverse of success rate)
    ROUND(AVG(CASE
      WHEN success_rate > 0 THEN (100 - success_rate)
      ELSE 50
    END), 2) as avg_personal_difficulty,
    COALESCE((SELECT trend FROM recent_accuracy), 'stable') as accuracy_trend,
    NOW() as last_updated
  FROM user_question_stats;
END;
$$;

-- CREATE RPC FUNCTION TO GET USER PROGRESS TRENDS
CREATE OR REPLACE FUNCTION get_user_progress_trends(p_user_id UUID)
RETURNS TABLE (
  total INTEGER,
  improving INTEGER,
  stable INTEGER,
  declining INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH question_trends AS (
    SELECT
      tq.question_id,
      -- Calculate trend based on recent vs older performance
      CASE
        WHEN COUNT(*) FILTER (WHERE tq.created_at > NOW() - INTERVAL '7 days') < 2 THEN 'stable'
        WHEN
          SUM(CASE WHEN tq.is_correct AND tq.created_at > NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END)::NUMERIC /
          NULLIF(COUNT(*) FILTER (WHERE tq.created_at > NOW() - INTERVAL '7 days'), 0) >
          SUM(CASE WHEN tq.is_correct AND tq.created_at <= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END)::NUMERIC /
          NULLIF(COUNT(*) FILTER (WHERE tq.created_at <= NOW() - INTERVAL '7 days'), 0)
        THEN 'improving'
        WHEN
          SUM(CASE WHEN tq.is_correct AND tq.created_at > NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END)::NUMERIC /
          NULLIF(COUNT(*) FILTER (WHERE tq.created_at > NOW() - INTERVAL '7 days'), 0) <
          SUM(CASE WHEN tq.is_correct AND tq.created_at <= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END)::NUMERIC /
          NULLIF(COUNT(*) FILTER (WHERE tq.created_at <= NOW() - INTERVAL '7 days'), 0)
        THEN 'declining'
        ELSE 'stable'
      END as trend
    FROM test_questions tq
    JOIN tests t ON t.id = tq.test_id
    WHERE t.user_id = p_user_id
      AND tq.question_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM test_questions tq2
        JOIN tests t2 ON t2.id = tq2.test_id
        WHERE t2.user_id = p_user_id
          AND tq2.question_id = tq.question_id
          AND tq2.created_at > NOW() - INTERVAL '14 days'
      )
    GROUP BY tq.question_id
    HAVING COUNT(*) >= 2  -- Only include questions attempted at least twice
  )

  SELECT
    COUNT(*)::INTEGER as total,
    COUNT(*) FILTER (WHERE trend = 'improving')::INTEGER as improving,
    COUNT(*) FILTER (WHERE trend = 'stable')::INTEGER as stable,
    COUNT(*) FILTER (WHERE trend = 'declining')::INTEGER as declining
  FROM question_trends;
END;
$$;

-- CREATE RPC FUNCTION TO GET STRUGGLING QUESTIONS
CREATE OR REPLACE FUNCTION get_struggling_questions(p_user_id UUID, p_limit INTEGER DEFAULT 5)
RETURNS TABLE (
  question_id UUID,
  question_text TEXT,
  total_attempts INTEGER,
  success_rate NUMERIC,
  last_attempt TIMESTAMP WITH TIME ZONE,
  trend TEXT,
  personal_difficulty NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH question_stats AS (
    SELECT
      tq.question_id,
      q.question_text,
      COUNT(*) as total_attempts,
      SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::NUMERIC * 100.0 / COUNT(*)::NUMERIC as success_rate,
      MAX(tq.created_at) as last_attempt,
      -- Calculate trend
      CASE
        WHEN COUNT(*) FILTER (WHERE tq.created_at > NOW() - INTERVAL '7 days') = 0 THEN 'stable'
        WHEN COUNT(*) FILTER (WHERE tq.created_at > NOW() - INTERVAL '7 days') >= 2 AND
          SUM(CASE WHEN tq.is_correct AND tq.created_at > NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END)::NUMERIC /
          COUNT(*) FILTER (WHERE tq.created_at > NOW() - INTERVAL '7 days') >
          SUM(CASE WHEN tq.is_correct AND tq.created_at <= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END)::NUMERIC /
          NULLIF(COUNT(*) FILTER (WHERE tq.created_at <= NOW() - INTERVAL '7 days'), 0)
        THEN 'improving'
        WHEN COUNT(*) FILTER (WHERE tq.created_at > NOW() - INTERVAL '7 days') >= 2 AND
          SUM(CASE WHEN tq.is_correct AND tq.created_at > NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END)::NUMERIC /
          COUNT(*) FILTER (WHERE tq.created_at > NOW() - INTERVAL '7 days') <
          SUM(CASE WHEN tq.is_correct AND tq.created_at <= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END)::NUMERIC /
          NULLIF(COUNT(*) FILTER (WHERE tq.created_at <= NOW() - INTERVAL '7 days'), 0)
        THEN 'declining'
        ELSE 'stable'
      END as trend
    FROM test_questions tq
    JOIN tests t ON t.id = tq.test_id
    JOIN questions q ON q.id = tq.question_id
    WHERE t.user_id = p_user_id
      AND tq.question_id IS NOT NULL
    GROUP BY tq.question_id, q.question_text
    HAVING COUNT(*) >= 2  -- At least 2 attempts
      AND (SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::NUMERIC * 100.0 / COUNT(*)::NUMERIC) < 60  -- Less than 60% success rate
  )

  SELECT
    question_id,
    question_text,
    total_attempts::INTEGER,
    ROUND(success_rate, 2) as success_rate,
    last_attempt,
    trend,
    ROUND(100 - success_rate, 2) as personal_difficulty
  FROM question_stats
  ORDER BY success_rate ASC, total_attempts DESC
  LIMIT p_limit;
END;
$$;

-- CREATE RPC FUNCTION TO GET MASTERED QUESTIONS
CREATE OR REPLACE FUNCTION get_mastered_questions(p_user_id UUID, p_limit INTEGER DEFAULT 5)
RETURNS TABLE (
  question_id UUID,
  question_text TEXT,
  total_attempts INTEGER,
  success_rate NUMERIC,
  last_attempt TIMESTAMP WITH TIME ZONE,
  personal_difficulty NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH question_stats AS (
    SELECT
      tq.question_id,
      q.question_text,
      COUNT(*) as total_attempts,
      SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::NUMERIC * 100.0 / COUNT(*)::NUMERIC as success_rate,
      MAX(tq.created_at) as last_attempt
    FROM test_questions tq
    JOIN tests t ON t.id = tq.test_id
    JOIN questions q ON q.id = tq.question_id
    WHERE t.user_id = p_user_id
      AND tq.question_id IS NOT NULL
    GROUP BY tq.question_id, q.question_text
    HAVING COUNT(*) >= 2  -- At least 2 attempts
      AND (SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::NUMERIC * 100.0 / COUNT(*)::NUMERIC) >= 80  -- At least 80% success rate
  )

  SELECT
    question_id,
    question_text,
    total_attempts::INTEGER,
    ROUND(success_rate, 2) as success_rate,
    last_attempt,
    ROUND(100 - success_rate, 2) as personal_difficulty
  FROM question_stats
  ORDER BY success_rate DESC, total_attempts DESC
  LIMIT p_limit;
END;
$$;

-- CREATE RPC FUNCTION TO GET PERSONALIZED RECOMMENDATIONS
CREATE OR REPLACE FUNCTION get_personalized_recommendations(p_user_id UUID)
RETURNS TABLE (
  priority TEXT,
  title TEXT,
  description TEXT,
  action_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH user_stats AS (
    SELECT
      COUNT(DISTINCT tq.question_id) as total_questions,
      COUNT(DISTINCT tq.tema_number) as topics_attempted,
      AVG(CASE WHEN tq.is_correct THEN 100 ELSE 0 END) as avg_accuracy,
      COUNT(*) FILTER (WHERE tq.created_at > NOW() - INTERVAL '7 days') as recent_activity
    FROM test_questions tq
    JOIN tests t ON t.id = tq.test_id
    WHERE t.user_id = p_user_id
  ),
  struggling_topics AS (
    SELECT
      tq.tema_number,
      COUNT(*) as attempts,
      AVG(CASE WHEN tq.is_correct THEN 100 ELSE 0 END) as accuracy
    FROM test_questions tq
    JOIN tests t ON t.id = tq.test_id
    WHERE t.user_id = p_user_id
      AND tq.tema_number IS NOT NULL
    GROUP BY tq.tema_number
    HAVING AVG(CASE WHEN tq.is_correct THEN 100 ELSE 0 END) < 60
      AND COUNT(*) >= 5
    ORDER BY accuracy ASC
    LIMIT 3
  )

  -- Generate recommendations based on user performance
  SELECT * FROM (
    -- Recommendation for struggling topics
    SELECT
      'high' as priority,
      'Reforzar Tema ' || tema_number as title,
      'Tu precisión es del ' || ROUND(accuracy::NUMERIC, 0) || '%. Dedica más tiempo a este tema.' as description,
      'study_topic' as action_type
    FROM struggling_topics

    UNION ALL

    -- Recommendation for inactive users
    SELECT
      'medium' as priority,
      'Mantén tu ritmo de estudio' as title,
      'Has estado menos activo últimamente. Intenta estudiar al menos 15 minutos al día.' as description,
      'increase_activity' as action_type
    FROM user_stats
    WHERE recent_activity < 10

    UNION ALL

    -- Recommendation for users with low overall accuracy
    SELECT
      'high' as priority,
      'Revisa los conceptos básicos' as title,
      'Tu precisión general es del ' || ROUND(avg_accuracy::NUMERIC, 0) || '%. Repasa los temas fundamentales.' as description,
      'review_basics' as action_type
    FROM user_stats
    WHERE avg_accuracy < 60

    UNION ALL

    -- Recommendation for users doing well
    SELECT
      'low' as priority,
      'Excelente progreso' as title,
      'Tu rendimiento es muy bueno. Considera aumentar la dificultad de las preguntas.' as description,
      'increase_difficulty' as action_type
    FROM user_stats
    WHERE avg_accuracy > 85
      AND total_questions > 100
  ) recommendations
  ORDER BY
    CASE priority
      WHEN 'high' THEN 1
      WHEN 'medium' THEN 2
      WHEN 'low' THEN 3
    END
  LIMIT 5;
END;
$$;

-- Test the functions
SELECT * FROM get_user_difficulty_metrics(
  (SELECT id FROM user_profiles LIMIT 1)
);