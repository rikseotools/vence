-- =====================================================
-- RPC: get_user_statistics_complete
-- Calcula TODAS las estadísticas del usuario en una sola query
-- Reemplaza ~15 queries del cliente por 1 sola
-- =====================================================

DROP FUNCTION IF EXISTS get_user_statistics_complete(UUID);

CREATE OR REPLACE FUNCTION get_user_statistics_complete(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  v_total_questions BIGINT;
  v_correct_answers BIGINT;
  v_total_study_time BIGINT;
  v_tests_completed BIGINT;
BEGIN
  -- ===========================================
  -- 1. CONTEOS GLOBALES (una sola pasada)
  -- ===========================================
  SELECT
    COUNT(*),
    SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)
  INTO v_total_questions, v_correct_answers
  FROM test_questions tq
  JOIN tests t ON tq.test_id = t.id
  WHERE t.user_id = p_user_id;

  -- Total tests completados y tiempo de estudio
  SELECT
    COUNT(*),
    COALESCE(SUM(total_time_seconds), 0)
  INTO v_tests_completed, v_total_study_time
  FROM tests
  WHERE user_id = p_user_id
    AND is_completed = true
    AND completed_at IS NOT NULL;

  -- ===========================================
  -- 2. CONSTRUIR JSON COMPLETO
  -- ===========================================
  SELECT json_build_object(
    -- ========== ESTADÍSTICAS BÁSICAS ==========
    'tests_completed', v_tests_completed,
    'total_questions', v_total_questions,
    'correct_answers', v_correct_answers,
    'accuracy', CASE WHEN v_total_questions > 0
      THEN ROUND((v_correct_answers::NUMERIC / v_total_questions) * 100, 1)
      ELSE 0 END,
    'total_study_time', v_total_study_time,

    -- ========== TIEMPO PROMEDIO ==========
    'average_time', (
      SELECT COALESCE(ROUND(AVG(time_spent_seconds)), 0)
      FROM test_questions tq
      JOIN tests t ON tq.test_id = t.id
      WHERE t.user_id = p_user_id
        AND tq.time_spent_seconds IS NOT NULL
        AND tq.time_spent_seconds > 0
        AND tq.time_spent_seconds < 300 -- Excluir outliers
    ),

    -- ========== MEJOR PUNTUACIÓN ==========
    'best_score', (
      SELECT COALESCE(MAX(ROUND((score::NUMERIC / NULLIF(total_questions, 0)) * 100)), 0)
      FROM tests
      WHERE user_id = p_user_id
        AND is_completed = true
        AND total_questions > 0
    ),

    -- ========== RACHA ACTUAL ==========
    'current_streak', (
      WITH consecutive_days AS (
        SELECT DISTINCT DATE(completed_at AT TIME ZONE 'Europe/Madrid') as study_date
        FROM tests
        WHERE user_id = p_user_id
          AND completed_at IS NOT NULL
        ORDER BY study_date DESC
      ),
      streak_calc AS (
        SELECT
          study_date,
          study_date - (ROW_NUMBER() OVER (ORDER BY study_date DESC))::INT as grp
        FROM consecutive_days
        WHERE study_date >= CURRENT_DATE - INTERVAL '30 days'
      )
      SELECT COALESCE(COUNT(*), 0)
      FROM streak_calc
      WHERE grp = (
        SELECT grp FROM streak_calc
        WHERE study_date >= CURRENT_DATE - INTERVAL '1 day'
        LIMIT 1
      )
    ),

    -- ========== TESTS RECIENTES (últimos 10) ==========
    'recent_tests', (
      SELECT COALESCE(json_agg(recent), '[]'::json)
      FROM (
        SELECT
          id,
          title,
          test_type,
          tema_number,
          score,
          total_questions,
          ROUND((score::NUMERIC / NULLIF(total_questions, 0)) * 100) as percentage,
          total_time_seconds,
          completed_at
        FROM tests
        WHERE user_id = p_user_id
          AND is_completed = true
          AND completed_at IS NOT NULL
        ORDER BY completed_at DESC
        LIMIT 10
      ) recent
    ),

    -- ========== PROGRESO SEMANAL (últimas 4 semanas) ==========
    'weekly_progress', (
      SELECT COALESCE(json_agg(weekly ORDER BY week_start), '[]'::json)
      FROM (
        SELECT
          DATE_TRUNC('week', tq.created_at AT TIME ZONE 'Europe/Madrid') as week_start,
          COUNT(*) as questions_answered,
          SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END) as correct_answers,
          ROUND((SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::NUMERIC / COUNT(*)) * 100, 1) as accuracy,
          COUNT(DISTINCT t.id) as tests_completed,
          COALESCE(SUM(t.total_time_seconds), 0) as study_time
        FROM test_questions tq
        JOIN tests t ON tq.test_id = t.id
        WHERE t.user_id = p_user_id
          AND tq.created_at >= NOW() - INTERVAL '4 weeks'
        GROUP BY DATE_TRUNC('week', tq.created_at AT TIME ZONE 'Europe/Madrid')
      ) weekly
    ),

    -- ========== DESGLOSE POR DIFICULTAD ==========
    'difficulty_breakdown', (
      SELECT COALESCE(json_agg(diff), '[]'::json)
      FROM (
        SELECT
          COALESCE(tq.difficulty, 'unknown') as difficulty,
          COUNT(*) as total,
          SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END) as correct,
          ROUND((SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::NUMERIC / COUNT(*)) * 100, 1) as accuracy,
          ROUND(AVG(CASE WHEN tq.time_spent_seconds > 0 AND tq.time_spent_seconds < 300
            THEN tq.time_spent_seconds END)) as avg_time
        FROM test_questions tq
        JOIN tests t ON tq.test_id = t.id
        WHERE t.user_id = p_user_id
        GROUP BY COALESCE(tq.difficulty, 'unknown')
        HAVING COUNT(*) >= 5
        ORDER BY
          CASE COALESCE(tq.difficulty, 'unknown')
            WHEN 'easy' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'hard' THEN 3
            WHEN 'extreme' THEN 4
            ELSE 5
          END
      ) diff
    ),

    -- ========== RENDIMIENTO POR TEMA (top 20) ==========
    'theme_performance', (
      SELECT COALESCE(json_agg(theme), '[]'::json)
      FROM (
        SELECT
          COALESCE(tq.tema_number, 0) as tema_number,
          COUNT(*) as total,
          SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END) as correct,
          ROUND((SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::NUMERIC / COUNT(*)) * 100, 1) as accuracy,
          ROUND(AVG(CASE WHEN tq.time_spent_seconds > 0 THEN tq.time_spent_seconds END)) as avg_time,
          COUNT(DISTINCT tq.article_number) as articles_count
        FROM test_questions tq
        JOIN tests t ON tq.test_id = t.id
        WHERE t.user_id = p_user_id
        GROUP BY COALESCE(tq.tema_number, 0)
        HAVING COUNT(*) >= 3
        ORDER BY accuracy ASC, total DESC
        LIMIT 20
      ) theme
    ),

    -- ========== RENDIMIENTO POR ARTÍCULO (top 30 peores) ==========
    'article_performance', (
      SELECT COALESCE(json_agg(article), '[]'::json)
      FROM (
        SELECT
          tq.law_name,
          tq.article_number,
          COALESCE(tq.tema_number, 0) as tema_number,
          COUNT(*) as total,
          SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END) as correct,
          ROUND((SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::NUMERIC / COUNT(*)) * 100, 1) as accuracy,
          ROUND(AVG(CASE WHEN tq.time_spent_seconds > 0 THEN tq.time_spent_seconds END)) as avg_time
        FROM test_questions tq
        JOIN tests t ON tq.test_id = t.id
        WHERE t.user_id = p_user_id
          AND tq.law_name IS NOT NULL
          AND tq.article_number IS NOT NULL
        GROUP BY tq.law_name, tq.article_number, COALESCE(tq.tema_number, 0)
        HAVING COUNT(*) >= 2
        ORDER BY accuracy ASC, total DESC
        LIMIT 30
      ) article
    ),

    -- ========== PATRONES DE TIEMPO (por hora del día) ==========
    'time_patterns', (
      SELECT COALESCE(json_agg(hourly), '[]'::json)
      FROM (
        SELECT
          EXTRACT(HOUR FROM t.completed_at AT TIME ZONE 'Europe/Madrid')::INT as hour,
          COUNT(DISTINCT t.id) as tests,
          ROUND(AVG((t.score::NUMERIC / NULLIF(t.total_questions, 0)) * 100), 1) as accuracy
        FROM tests t
        WHERE t.user_id = p_user_id
          AND t.completed_at IS NOT NULL
          AND t.is_completed = true
          AND t.total_questions > 0
        GROUP BY EXTRACT(HOUR FROM t.completed_at AT TIME ZONE 'Europe/Madrid')
        HAVING COUNT(*) >= 2
        ORDER BY hour
      ) hourly
    ),

    -- ========== DÍAS ACTIVOS (últimos 30 días) ==========
    'active_days', (
      SELECT COUNT(DISTINCT DATE(completed_at AT TIME ZONE 'Europe/Madrid'))
      FROM tests
      WHERE user_id = p_user_id
        AND completed_at IS NOT NULL
        AND completed_at >= NOW() - INTERVAL '30 days'
    ),

    -- ========== PREGUNTAS HOY ==========
    'questions_today', (
      SELECT COUNT(*)
      FROM test_questions tq
      JOIN tests t ON tq.test_id = t.id
      WHERE t.user_id = p_user_id
        AND DATE(tq.created_at AT TIME ZONE 'Europe/Madrid') = CURRENT_DATE
    ),

    -- ========== METADATA ==========
    'generated_at', NOW(),
    'user_id', p_user_id

  ) INTO result;

  RETURN result;
END;
$$;

-- Dar permisos
GRANT EXECUTE ON FUNCTION get_user_statistics_complete(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_statistics_complete(UUID) TO anon;

-- Índices recomendados para optimizar la RPC
-- (ejecutar solo si no existen)
CREATE INDEX IF NOT EXISTS idx_tests_user_completed
  ON tests(user_id, is_completed, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_test_questions_test_id
  ON test_questions(test_id);

CREATE INDEX IF NOT EXISTS idx_test_questions_created_at
  ON test_questions(created_at);

COMMENT ON FUNCTION get_user_statistics_complete IS
'Calcula todas las estadísticas del usuario en una sola llamada.
Reemplaza ~15 queries del cliente por 1 RPC.
Uso: SELECT get_user_statistics_complete(user_id);
Retorna: JSON con tests_completed, accuracy, weekly_progress, etc.';
