-- =====================================================
-- OPTIMIZACIÓN: Estadísticas de usuario
--
-- Problema: Las queries de estadísticas tardan 8+ segundos
-- Solución: Crear función optimizada con una sola pasada
-- =====================================================

-- Función optimizada que calcula todas las estadísticas en una sola pasada
CREATE OR REPLACE FUNCTION get_user_stats_optimized(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_today DATE;
  v_seven_days_ago DATE;
BEGIN
  v_today := (NOW() AT TIME ZONE 'Europe/Madrid')::DATE;
  v_seven_days_ago := v_today - 7;

  -- Una sola query con múltiples CTEs para eficiencia
  WITH
  -- Estadísticas principales
  main_stats AS (
    SELECT
      COUNT(DISTINCT t.id) as total_tests,
      COUNT(tq.id) as total_questions,
      SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END) as correct_answers,
      COALESCE(SUM(tq.time_spent_seconds), 0) as total_time_seconds,
      COALESCE(AVG(tq.time_spent_seconds), 0) as avg_time_per_question
    FROM test_questions tq
    INNER JOIN tests t ON tq.test_id = t.id
    WHERE t.user_id = p_user_id AND t.is_completed = true
  ),

  -- Mejor puntuación
  best_score AS (
    SELECT COALESCE(MAX(
      CASE WHEN total_questions > 0
        THEN (score::float / total_questions * 100)
        ELSE 0
      END
    ), 0)::int as best_score
    FROM tests
    WHERE user_id = p_user_id AND is_completed = true
  ),

  -- Racha actual (desde user_streaks)
  streak_data AS (
    SELECT
      COALESCE(current_streak, 0) as current_streak,
      COALESCE(longest_streak, 0) as longest_streak
    FROM user_streaks
    WHERE user_id = p_user_id
  ),

  -- Progreso semanal
  weekly_progress AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'date', day_date::text,
        'questions', questions,
        'correct', correct,
        'accuracy', CASE WHEN questions > 0 THEN ROUND((correct::float / questions * 100)) ELSE 0 END,
        'studyMinutes', ROUND(study_seconds / 60.0)
      ) ORDER BY day_date
    ) as data
    FROM (
      SELECT
        DATE(tq.created_at AT TIME ZONE 'Europe/Madrid') as day_date,
        COUNT(*) as questions,
        SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END) as correct,
        COALESCE(SUM(tq.time_spent_seconds), 0) as study_seconds
      FROM test_questions tq
      INNER JOIN tests t ON tq.test_id = t.id
      WHERE t.user_id = p_user_id
        AND tq.created_at >= (NOW() - INTERVAL '7 days')
      GROUP BY DATE(tq.created_at AT TIME ZONE 'Europe/Madrid')
    ) weekly
  ),

  -- Tests recientes
  recent_tests AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', id,
        'title', title,
        'temaNumber', tema_number,
        'score', COALESCE(score::int, 0),
        'totalQuestions', COALESCE(total_questions, 0),
        'accuracy', CASE WHEN total_questions > 0 THEN ROUND((score::float / total_questions * 100)) ELSE 0 END,
        'completedAt', completed_at,
        'timeSeconds', COALESCE(total_time_seconds, 0)
      ) ORDER BY completed_at DESC
    ) as data
    FROM (
      SELECT id, title, tema_number, score, total_questions, completed_at, total_time_seconds
      FROM tests
      WHERE user_id = p_user_id AND is_completed = true AND completed_at IS NOT NULL
      ORDER BY completed_at DESC
      LIMIT 10
    ) recent
  ),

  -- Rendimiento por tema
  theme_performance AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'temaNumber', tema_number,
        'totalQuestions', total,
        'correctAnswers', correct,
        'accuracy', CASE WHEN total > 0 THEN ROUND((correct::float / total * 100)) ELSE 0 END,
        'averageTime', avg_time,
        'lastPracticed', last_practiced
      ) ORDER BY tema_number
    ) as data
    FROM (
      SELECT
        tq.tema_number,
        COUNT(*) as total,
        SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END) as correct,
        ROUND(AVG(tq.time_spent_seconds)) as avg_time,
        MAX(tq.created_at) as last_practiced
      FROM test_questions tq
      INNER JOIN tests t ON tq.test_id = t.id
      WHERE t.user_id = p_user_id AND tq.tema_number IS NOT NULL
      GROUP BY tq.tema_number
    ) themes
  ),

  -- Desglose por dificultad
  difficulty_breakdown AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'difficulty', difficulty,
        'totalQuestions', total,
        'correctAnswers', correct,
        'accuracy', CASE WHEN total > 0 THEN ROUND((correct::float / total * 100)) ELSE 0 END,
        'averageTime', avg_time
      )
    ) as data
    FROM (
      SELECT
        tq.difficulty,
        COUNT(*) as total,
        SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END) as correct,
        ROUND(AVG(tq.time_spent_seconds)) as avg_time
      FROM test_questions tq
      INNER JOIN tests t ON tq.test_id = t.id
      WHERE t.user_id = p_user_id AND tq.difficulty IS NOT NULL
      GROUP BY tq.difficulty
    ) diffs
  ),

  -- Patrones de tiempo (distribución por hora)
  time_patterns AS (
    SELECT jsonb_build_object(
      'hourlyDistribution', COALESCE(jsonb_agg(
        jsonb_build_object(
          'hour', hour,
          'questions', questions,
          'accuracy', accuracy
        ) ORDER BY hour
      ), '[]'::jsonb),
      'averageSessionMinutes', (
        SELECT COALESCE(ROUND(AVG(total_time_seconds) / 60.0), 0)
        FROM tests
        WHERE user_id = p_user_id AND is_completed = true
      )
    ) as data
    FROM (
      SELECT
        EXTRACT(HOUR FROM tq.created_at AT TIME ZONE 'Europe/Madrid')::int as hour,
        COUNT(*) as questions,
        ROUND(SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::float / COUNT(*) * 100) as accuracy
      FROM test_questions tq
      INNER JOIN tests t ON tq.test_id = t.id
      WHERE t.user_id = p_user_id
      GROUP BY EXTRACT(HOUR FROM tq.created_at AT TIME ZONE 'Europe/Madrid')
    ) hourly
  ),

  -- Artículos débiles (accuracy < 60%, mínimo 3 preguntas)
  weak_articles AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'articleId', article_id,
        'articleNumber', article_number,
        'lawName', law_name,
        'totalQuestions', total,
        'correctAnswers', correct,
        'accuracy', accuracy
      ) ORDER BY accuracy
    ) as data
    FROM (
      SELECT
        tq.article_id,
        tq.article_number,
        tq.law_name,
        COUNT(*) as total,
        SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END) as correct,
        ROUND(SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::float / COUNT(*) * 100) as accuracy
      FROM test_questions tq
      INNER JOIN tests t ON tq.test_id = t.id
      WHERE t.user_id = p_user_id AND tq.article_number IS NOT NULL
      GROUP BY tq.article_id, tq.article_number, tq.law_name
      HAVING COUNT(*) >= 3
        AND SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::float / COUNT(*) < 0.6
      ORDER BY SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::float / COUNT(*)
      LIMIT 10
    ) weak
  ),

  -- Artículos fuertes (accuracy >= 80%, mínimo 3 preguntas)
  strong_articles AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'articleId', article_id,
        'articleNumber', article_number,
        'lawName', law_name,
        'totalQuestions', total,
        'correctAnswers', correct,
        'accuracy', accuracy
      ) ORDER BY accuracy DESC
    ) as data
    FROM (
      SELECT
        tq.article_id,
        tq.article_number,
        tq.law_name,
        COUNT(*) as total,
        SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END) as correct,
        ROUND(SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::float / COUNT(*) * 100) as accuracy
      FROM test_questions tq
      INNER JOIN tests t ON tq.test_id = t.id
      WHERE t.user_id = p_user_id AND tq.article_number IS NOT NULL
      GROUP BY tq.article_id, tq.article_number, tq.law_name
      HAVING COUNT(*) >= 3
        AND SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::float / COUNT(*) >= 0.8
      ORDER BY SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::float / COUNT(*) DESC
      LIMIT 10
    ) strong
  )

  -- Combinar todo en un solo JSONB
  SELECT jsonb_build_object(
    'main', jsonb_build_object(
      'totalTests', ms.total_tests,
      'totalQuestions', ms.total_questions,
      'correctAnswers', ms.correct_answers,
      'accuracy', CASE WHEN ms.total_questions > 0
        THEN ROUND((ms.correct_answers::float / ms.total_questions * 100))
        ELSE 0 END,
      'totalStudyTimeSeconds', ms.total_time_seconds,
      'averageTimePerQuestion', ROUND(ms.avg_time_per_question),
      'bestScore', bs.best_score,
      'currentStreak', COALESCE(sd.current_streak, 0),
      'longestStreak', COALESCE(sd.longest_streak, 0)
    ),
    'weeklyProgress', COALESCE(wp.data, '[]'::jsonb),
    'recentTests', COALESCE(rt.data, '[]'::jsonb),
    'themePerformance', COALESCE(tp.data, '[]'::jsonb),
    'difficultyBreakdown', COALESCE(db.data, '[]'::jsonb),
    'timePatterns', COALESCE(tpat.data, '{}'::jsonb),
    'weakArticles', COALESCE(wa.data, '[]'::jsonb),
    'strongArticles', COALESCE(sa.data, '[]'::jsonb)
  ) INTO v_result
  FROM main_stats ms
  CROSS JOIN best_score bs
  LEFT JOIN streak_data sd ON true
  CROSS JOIN weekly_progress wp
  CROSS JOIN recent_tests rt
  CROSS JOIN theme_performance tp
  CROSS JOIN difficulty_breakdown db
  CROSS JOIN time_patterns tpat
  CROSS JOIN weak_articles wa
  CROSS JOIN strong_articles sa;

  RETURN v_result;
END;
$$;

-- Dar permisos
GRANT EXECUTE ON FUNCTION get_user_stats_optimized(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_stats_optimized(UUID) TO service_role;

COMMENT ON FUNCTION get_user_stats_optimized IS
'Función optimizada que calcula todas las estadísticas de usuario en una sola ejecución.
Retorna un JSONB con: main stats, weekly progress, recent tests, theme performance,
difficulty breakdown, time patterns, weak articles, strong articles.';
