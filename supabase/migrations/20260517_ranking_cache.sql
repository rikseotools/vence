-- Materializar el ranking para eliminar agregación pesada en el hot path.
--
-- CONTEXTO: /api/ranking ejecutaba SELECT GROUP BY user_id sobre
-- test_questions (1M+ filas) en cada cache miss. Tiempo medido: 9-12s
-- consistentes. Con timeout 12s + saturación BD ocasional → 503 visible
-- al usuario ~30 veces/día.
--
-- SOLUCIÓN: tabla pre-agregada `ranking_cache` por (time_filter, user_id),
-- refrescada por cron cada 5 min. El endpoint pasa a SELECT trivial con
-- índice cubriente. Tiempo esperado: 9-12s → <50ms. El cron sí paga la
-- agregación pesada pero en background, fuera del camino del usuario.
--
-- timeFilter soportados (ver lib/api/ranking/schemas.ts):
-- 'today', 'yesterday', 'week', 'month'.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ranking_cache (
  time_filter      text        NOT NULL,
  user_id          uuid        NOT NULL,
  total_questions  integer     NOT NULL,
  correct_answers  integer     NOT NULL,
  accuracy         numeric     NOT NULL,
  refreshed_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (time_filter, user_id),
  CONSTRAINT ranking_cache_time_filter_check
    CHECK (time_filter IN ('today', 'yesterday', 'week', 'month'))
);

COMMENT ON TABLE public.ranking_cache IS
  'Ranking pre-agregado por timeFilter. Refrescado por cron cada 5min '
  '(/api/cron/refresh-rankings → refresh_ranking_cache()). Sustituye '
  'al GROUP BY en /api/ranking que tardaba 9-12s.';

-- Índice cubriente para la query del endpoint:
-- WHERE time_filter = X AND total_questions >= N ORDER BY accuracy DESC, total_questions DESC.
CREATE INDEX IF NOT EXISTS ranking_cache_lookup_idx
  ON public.ranking_cache (time_filter, accuracy DESC, total_questions DESC)
  INCLUDE (user_id, correct_answers);

-- RLS: tabla interna, leída solo desde código server-side con Drizzle.
ALTER TABLE public.ranking_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ranking_cache FROM anon, authenticated;

-- ============================================================================
-- Función que refresca el ranking para los 4 timeFilters.
-- Idempotente: trunca y reinserta por time_filter. Si el cron falla, los
-- datos anteriores se mantienen (no se borran hasta que el INSERT del nuevo
-- run tiene éxito, vía transacción).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.refresh_ranking_cache()
RETURNS TABLE (
  filter_name text,
  rows_inserted integer,
  duration_ms integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_start timestamptz;
  v_count integer;
  v_today_start timestamptz;
  v_today_end timestamptz;
  v_yesterday_start timestamptz;
  v_yesterday_end timestamptz;
  v_week_start timestamptz;
  v_month_start timestamptz;
BEGIN
  -- Rangos de fechas. Misma lógica que lib/api/ranking/queries.ts:computeDateRange.
  v_today_start := date_trunc('day', now() AT TIME ZONE 'UTC')::timestamptz;
  v_today_end := v_today_start + interval '1 day' - interval '1 microsecond';
  v_yesterday_start := v_today_start - interval '1 day';
  v_yesterday_end := v_today_start - interval '1 microsecond';
  -- Semana ISO lunes: si hoy es domingo (DOW=0) restamos 6 días, sino DOW-1.
  v_week_start := v_today_start - (
    CASE EXTRACT(DOW FROM v_today_start)::int
      WHEN 0 THEN 6
      ELSE EXTRACT(DOW FROM v_today_start)::int - 1
    END || ' days'
  )::interval;
  v_month_start := date_trunc('month', v_today_start);

  -- TODAY
  v_start := clock_timestamp();
  DELETE FROM ranking_cache WHERE time_filter = 'today';
  INSERT INTO ranking_cache (time_filter, user_id, total_questions, correct_answers, accuracy, refreshed_at)
  SELECT 'today',
         user_id,
         COUNT(*)::int,
         COUNT(*) FILTER (WHERE is_correct)::int,
         ROUND((COUNT(*) FILTER (WHERE is_correct)::numeric / COUNT(*)) * 100, 0),
         now()
  FROM test_questions
  WHERE user_id IS NOT NULL
    AND created_at >= v_today_start
    AND created_at <= v_today_end
  GROUP BY user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  filter_name := 'today';
  rows_inserted := v_count;
  duration_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_start)) * 1000;
  RETURN NEXT;

  -- YESTERDAY
  v_start := clock_timestamp();
  DELETE FROM ranking_cache WHERE time_filter = 'yesterday';
  INSERT INTO ranking_cache (time_filter, user_id, total_questions, correct_answers, accuracy, refreshed_at)
  SELECT 'yesterday',
         user_id,
         COUNT(*)::int,
         COUNT(*) FILTER (WHERE is_correct)::int,
         ROUND((COUNT(*) FILTER (WHERE is_correct)::numeric / COUNT(*)) * 100, 0),
         now()
  FROM test_questions
  WHERE user_id IS NOT NULL
    AND created_at >= v_yesterday_start
    AND created_at <= v_yesterday_end
  GROUP BY user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  filter_name := 'yesterday';
  rows_inserted := v_count;
  duration_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_start)) * 1000;
  RETURN NEXT;

  -- WEEK (desde lunes de esta semana)
  v_start := clock_timestamp();
  DELETE FROM ranking_cache WHERE time_filter = 'week';
  INSERT INTO ranking_cache (time_filter, user_id, total_questions, correct_answers, accuracy, refreshed_at)
  SELECT 'week',
         user_id,
         COUNT(*)::int,
         COUNT(*) FILTER (WHERE is_correct)::int,
         ROUND((COUNT(*) FILTER (WHERE is_correct)::numeric / COUNT(*)) * 100, 0),
         now()
  FROM test_questions
  WHERE user_id IS NOT NULL
    AND created_at >= v_week_start
  GROUP BY user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  filter_name := 'week';
  rows_inserted := v_count;
  duration_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_start)) * 1000;
  RETURN NEXT;

  -- MONTH (desde día 1 de este mes)
  v_start := clock_timestamp();
  DELETE FROM ranking_cache WHERE time_filter = 'month';
  INSERT INTO ranking_cache (time_filter, user_id, total_questions, correct_answers, accuracy, refreshed_at)
  SELECT 'month',
         user_id,
         COUNT(*)::int,
         COUNT(*) FILTER (WHERE is_correct)::int,
         ROUND((COUNT(*) FILTER (WHERE is_correct)::numeric / COUNT(*)) * 100, 0),
         now()
  FROM test_questions
  WHERE user_id IS NOT NULL
    AND created_at >= v_month_start
  GROUP BY user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  filter_name := 'month';
  rows_inserted := v_count;
  duration_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_start)) * 1000;
  RETURN NEXT;

  RETURN;
END;
$$;

COMMENT ON FUNCTION public.refresh_ranking_cache IS
  'Refresca ranking_cache para los 4 timeFilters. Llamado por cron cada 5min. '
  'Devuelve una fila por filtro con stats de la operación.';

COMMIT;
