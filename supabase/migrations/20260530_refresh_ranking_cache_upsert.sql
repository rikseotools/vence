-- Refactor refresh_ranking_cache: DELETE+INSERT → UPSERT (ON CONFLICT)
--
-- Detectado 30/05/2026: la función actual hacía DELETE FROM ranking_cache
-- WHERE time_filter='X' seguido de INSERT masivo. Para WEEK/MONTH eso es
-- 722-2263 filas borradas + insertadas + mantenimiento de índices.
--
-- Métricas pg_stat_statements pre-refactor:
--   - mean: 2674ms, max: 19082ms, calls: 544
--   - SELECT solo: 385ms (87% del tiempo era write)
--   - 2 fallos del cron hoy (06:35, 07:45 UTC) por statement_timeout 30s
--
-- Nuevo enfoque:
--   1. INSERT...ON CONFLICT (time_filter, user_id) DO UPDATE — solo escribe filas
--      con cambios reales (PostgreSQL salta UPDATE si EXCLUDED == current).
--   2. DELETE WHERE refreshed_at < (current start) — limpia filas obsoletas
--      (users que pararon de hacer test). Típicamente 0-pocos.
--   3. Sin DELETE masivo → sin write amplification → menos index maintenance.

CREATE OR REPLACE FUNCTION refresh_ranking_cache()
RETURNS TABLE(filter_name text, rows_inserted integer, duration_ms integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_start timestamptz;
  v_cycle_start timestamptz;
  v_count integer;
  v_today_start timestamptz;
  v_today_end timestamptz;
  v_yesterday_start timestamptz;
  v_yesterday_end timestamptz;
  v_week_start timestamptz;
  v_month_start timestamptz;
BEGIN
  v_start := clock_timestamp();
  v_today_start := date_trunc('day', now() AT TIME ZONE 'UTC')::timestamptz;
  v_today_end := v_today_start + interval '1 day' - interval '1 microsecond';
  v_yesterday_start := v_today_start - interval '1 day';
  v_yesterday_end := v_today_start - interval '1 microsecond';
  v_week_start := v_today_start - (
    CASE EXTRACT(DOW FROM v_today_start)::int
      WHEN 0 THEN 6
      ELSE EXTRACT(DOW FROM v_today_start)::int - 1
    END || ' days'
  )::interval;
  v_month_start := date_trunc('month', v_today_start);

  -- ─────────────────── TODAY ───────────────────
  v_cycle_start := clock_timestamp();
  INSERT INTO ranking_cache (time_filter, user_id, total_questions, correct_answers, accuracy, refreshed_at)
  SELECT 'today',
         user_id,
         COUNT(*)::int,
         COUNT(*) FILTER (WHERE is_correct)::int,
         ROUND((COUNT(*) FILTER (WHERE is_correct)::numeric / COUNT(*)) * 100, 0),
         v_start
  FROM test_questions
  WHERE user_id IS NOT NULL
    AND created_at >= v_today_start
    AND created_at <= v_today_end
  GROUP BY user_id
  ON CONFLICT (time_filter, user_id) DO UPDATE SET
    total_questions = EXCLUDED.total_questions,
    correct_answers = EXCLUDED.correct_answers,
    accuracy = EXCLUDED.accuracy,
    refreshed_at = EXCLUDED.refreshed_at;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  -- Eliminar filas no tocadas en este refresh (users sin actividad ese día)
  DELETE FROM ranking_cache WHERE time_filter = 'today' AND refreshed_at < v_start;
  filter_name := 'today';
  rows_inserted := v_count;
  duration_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_cycle_start)) * 1000;
  RETURN NEXT;

  -- ─────────────────── YESTERDAY ───────────────────
  v_cycle_start := clock_timestamp();
  INSERT INTO ranking_cache (time_filter, user_id, total_questions, correct_answers, accuracy, refreshed_at)
  SELECT 'yesterday',
         user_id,
         COUNT(*)::int,
         COUNT(*) FILTER (WHERE is_correct)::int,
         ROUND((COUNT(*) FILTER (WHERE is_correct)::numeric / COUNT(*)) * 100, 0),
         v_start
  FROM test_questions
  WHERE user_id IS NOT NULL
    AND created_at >= v_yesterday_start
    AND created_at <= v_yesterday_end
  GROUP BY user_id
  ON CONFLICT (time_filter, user_id) DO UPDATE SET
    total_questions = EXCLUDED.total_questions,
    correct_answers = EXCLUDED.correct_answers,
    accuracy = EXCLUDED.accuracy,
    refreshed_at = EXCLUDED.refreshed_at;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  DELETE FROM ranking_cache WHERE time_filter = 'yesterday' AND refreshed_at < v_start;
  filter_name := 'yesterday';
  rows_inserted := v_count;
  duration_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_cycle_start)) * 1000;
  RETURN NEXT;

  -- ─────────────────── WEEK ───────────────────
  v_cycle_start := clock_timestamp();
  INSERT INTO ranking_cache (time_filter, user_id, total_questions, correct_answers, accuracy, refreshed_at)
  SELECT 'week',
         user_id,
         COUNT(*)::int,
         COUNT(*) FILTER (WHERE is_correct)::int,
         ROUND((COUNT(*) FILTER (WHERE is_correct)::numeric / COUNT(*)) * 100, 0),
         v_start
  FROM test_questions
  WHERE user_id IS NOT NULL
    AND created_at >= v_week_start
  GROUP BY user_id
  ON CONFLICT (time_filter, user_id) DO UPDATE SET
    total_questions = EXCLUDED.total_questions,
    correct_answers = EXCLUDED.correct_answers,
    accuracy = EXCLUDED.accuracy,
    refreshed_at = EXCLUDED.refreshed_at;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  DELETE FROM ranking_cache WHERE time_filter = 'week' AND refreshed_at < v_start;
  filter_name := 'week';
  rows_inserted := v_count;
  duration_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_cycle_start)) * 1000;
  RETURN NEXT;

  -- ─────────────────── MONTH ───────────────────
  v_cycle_start := clock_timestamp();
  INSERT INTO ranking_cache (time_filter, user_id, total_questions, correct_answers, accuracy, refreshed_at)
  SELECT 'month',
         user_id,
         COUNT(*)::int,
         COUNT(*) FILTER (WHERE is_correct)::int,
         ROUND((COUNT(*) FILTER (WHERE is_correct)::numeric / COUNT(*)) * 100, 0),
         v_start
  FROM test_questions
  WHERE user_id IS NOT NULL
    AND created_at >= v_month_start
  GROUP BY user_id
  ON CONFLICT (time_filter, user_id) DO UPDATE SET
    total_questions = EXCLUDED.total_questions,
    correct_answers = EXCLUDED.correct_answers,
    accuracy = EXCLUDED.accuracy,
    refreshed_at = EXCLUDED.refreshed_at;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  DELETE FROM ranking_cache WHERE time_filter = 'month' AND refreshed_at < v_start;
  filter_name := 'month';
  rows_inserted := v_count;
  duration_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_cycle_start)) * 1000;
  RETURN NEXT;

  RETURN;
END;
$$;
