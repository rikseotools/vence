-- 20260625_refresh_ranking_cache_from_user_daily_stats.sql
--
-- FIX cron `refresh-rankings` (fallaba 1-4×/hora en horario laboral).
--
-- ROBUSTO, no parche: la función escaneaba `test_questions` (1,6M filas) cada
-- 5 min para 4 ventanas (today/yesterday/week/month). El filtro `month`
-- degradaba a ~106k heap fetches (visibility map rancio en tabla caliente) →
-- 6-12s → cruzaba statement_timeout bajo carga diurna → "Failed query".
--
-- Solución: agregar desde `user_daily_stats` (rollup por-usuario-por-día,
-- materializado e incremental vía outbox), en vez de escanear la tabla de
-- hechos. Cumple la regla del proyecto ("nunca scan/agregación sobre
-- test_questions; usar materializadas"). Resultado: 12.000ms -> 259ms (~46×),
-- O(usuarios×días) en vez de O(hechos) -> escala.
--
-- DECISIÓN DE ARQUITECTURA CONSCIENTE: el leaderboard pasa a ser
-- eventual-consistente (≈segundos de lag del outbox) en vez de exacto-síncrono.
-- Aceptable para un ranking no crítico. Cubierto por:
--   - frescura: RULE_MATERIALIZED_STATS_STALE (user_daily_stats, 20 min)
--   - paridad de valor: RULE (añadida en esta tanda para user_daily_stats)
-- CAMBIO DE COMPORTAMIENTO: el borde del día pasa de UTC a Europe/Madrid
-- (lo que ya usa user_daily_stats; además más correcto para una oposición ES).
-- Backup del cuerpo anterior: /tmp/refresh_ranking_cache_OLD_25jun.sql
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
  -- Días en zona Europe/Madrid para casar EXACTAMENTE con user_daily_stats.day.
  -- (Antes la función escaneaba test_questions por día UTC; ahora agrega la
  --  materializada por-usuario-por-día, que se bucketiza en Madrid.)
  v_today := (now() AT TIME ZONE 'Europe/Madrid')::date;
  v_yesterday := v_today - 1;
  v_week_start := v_today - (EXTRACT(ISODOW FROM v_today)::int - 1);   -- lunes de esta semana
  v_month_start := date_trunc('month', v_today)::date;

  -- TODAY
  v_cycle_start := clock_timestamp();
  INSERT INTO ranking_cache (time_filter, user_id, total_questions, correct_answers, accuracy, refreshed_at)
  SELECT 'today', user_id, SUM(total_questions)::int, SUM(correct_answers)::int,
         ROUND(SUM(correct_answers)::numeric / SUM(total_questions) * 100, 0), v_start
  FROM user_daily_stats WHERE day = v_today
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
