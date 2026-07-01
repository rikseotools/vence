-- 20260630_refresh_ranking_cache_exclude_canary.sql
--
-- Excluir cuentas internal_canary (smoke@vence.es) del leaderboard.
--
-- PROBLEMA: el canary de smoke-test (registration_source='internal_canary')
-- martillea la MISMA pregunta miles de veces con valores sintéticos → 100%
-- de acierto con volumen enorme (n=7752/month) → aparecía #1 en TODAS las
-- ventanas del ranking (today/yesterday/week/month), ensuciando el leaderboard
-- y las métricas de precisión.
--
-- FIX (en ORIGEN): refresh_ranking_cache() agrega de user_daily_stats a
-- ranking_cache. Añadimos a cada una de las 4 ventanas un filtro que excluye
-- los user_id cuyo perfil es internal_canary. Robusto a futuros canaries
-- (filtra por registration_source, no por uuid hardcodeado). Tras un ciclo de
-- refresh, el DELETE ...WHERE refreshed_at < v_start purga las filas viejas del
-- canary que ya no se re-insertan.
--
-- Basado en 20260625_refresh_ranking_cache_from_user_daily_stats.sql (solo
-- añade el filtro NOT IN; el resto idéntico).
--
CREATE OR REPLACE FUNCTION public.refresh_ranking_cache()
 RETURNS TABLE(filter_name text, rows_inserted integer, duration_ms integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_start timestamptz;
  v_cycle_start timestamptz;
  v_count integer;
  v_today date;
  v_yesterday date;
  v_week_start date;
  v_month_start date;
BEGIN
  v_start := clock_timestamp();
  v_today := (now() AT TIME ZONE 'Europe/Madrid')::date;
  v_yesterday := v_today - 1;
  v_week_start := v_today - (EXTRACT(ISODOW FROM v_today)::int - 1);
  v_month_start := date_trunc('month', v_today)::date;

  -- TODAY
  v_cycle_start := clock_timestamp();
  INSERT INTO ranking_cache (time_filter, user_id, total_questions, correct_answers, accuracy, refreshed_at)
  SELECT 'today', user_id, SUM(total_questions)::int, SUM(correct_answers)::int,
         ROUND(SUM(correct_answers)::numeric / SUM(total_questions) * 100, 0), v_start
  FROM user_daily_stats WHERE day = v_today
    AND user_id NOT IN (SELECT id FROM user_profiles WHERE registration_source = 'internal_canary')
  GROUP BY user_id HAVING SUM(total_questions) > 0
  ON CONFLICT (time_filter, user_id) DO UPDATE SET
    total_questions = EXCLUDED.total_questions, correct_answers = EXCLUDED.correct_answers,
    accuracy = EXCLUDED.accuracy, refreshed_at = EXCLUDED.refreshed_at;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  DELETE FROM ranking_cache WHERE time_filter = 'today' AND refreshed_at < v_start;
  filter_name := 'today'; rows_inserted := v_count;
  duration_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_cycle_start)) * 1000; RETURN NEXT;

  -- YESTERDAY
  v_cycle_start := clock_timestamp();
  INSERT INTO ranking_cache (time_filter, user_id, total_questions, correct_answers, accuracy, refreshed_at)
  SELECT 'yesterday', user_id, SUM(total_questions)::int, SUM(correct_answers)::int,
         ROUND(SUM(correct_answers)::numeric / SUM(total_questions) * 100, 0), v_start
  FROM user_daily_stats WHERE day = v_yesterday
    AND user_id NOT IN (SELECT id FROM user_profiles WHERE registration_source = 'internal_canary')
  GROUP BY user_id HAVING SUM(total_questions) > 0
  ON CONFLICT (time_filter, user_id) DO UPDATE SET
    total_questions = EXCLUDED.total_questions, correct_answers = EXCLUDED.correct_answers,
    accuracy = EXCLUDED.accuracy, refreshed_at = EXCLUDED.refreshed_at;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  DELETE FROM ranking_cache WHERE time_filter = 'yesterday' AND refreshed_at < v_start;
  filter_name := 'yesterday'; rows_inserted := v_count;
  duration_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_cycle_start)) * 1000; RETURN NEXT;

  -- WEEK
  v_cycle_start := clock_timestamp();
  INSERT INTO ranking_cache (time_filter, user_id, total_questions, correct_answers, accuracy, refreshed_at)
  SELECT 'week', user_id, SUM(total_questions)::int, SUM(correct_answers)::int,
         ROUND(SUM(correct_answers)::numeric / SUM(total_questions) * 100, 0), v_start
  FROM user_daily_stats WHERE day >= v_week_start
    AND user_id NOT IN (SELECT id FROM user_profiles WHERE registration_source = 'internal_canary')
  GROUP BY user_id HAVING SUM(total_questions) > 0
  ON CONFLICT (time_filter, user_id) DO UPDATE SET
    total_questions = EXCLUDED.total_questions, correct_answers = EXCLUDED.correct_answers,
    accuracy = EXCLUDED.accuracy, refreshed_at = EXCLUDED.refreshed_at;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  DELETE FROM ranking_cache WHERE time_filter = 'week' AND refreshed_at < v_start;
  filter_name := 'week'; rows_inserted := v_count;
  duration_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_cycle_start)) * 1000; RETURN NEXT;

  -- MONTH
  v_cycle_start := clock_timestamp();
  INSERT INTO ranking_cache (time_filter, user_id, total_questions, correct_answers, accuracy, refreshed_at)
  SELECT 'month', user_id, SUM(total_questions)::int, SUM(correct_answers)::int,
         ROUND(SUM(correct_answers)::numeric / SUM(total_questions) * 100, 0), v_start
  FROM user_daily_stats WHERE day >= v_month_start
    AND user_id NOT IN (SELECT id FROM user_profiles WHERE registration_source = 'internal_canary')
  GROUP BY user_id HAVING SUM(total_questions) > 0
  ON CONFLICT (time_filter, user_id) DO UPDATE SET
    total_questions = EXCLUDED.total_questions, correct_answers = EXCLUDED.correct_answers,
    accuracy = EXCLUDED.accuracy, refreshed_at = EXCLUDED.refreshed_at;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  DELETE FROM ranking_cache WHERE time_filter = 'month' AND refreshed_at < v_start;
  filter_name := 'month'; rows_inserted := v_count;
  duration_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_cycle_start)) * 1000; RETURN NEXT;

  RETURN;
END;
$function$
