-- Fix: take_pool_capacity_sample() contaba frontend_active_conns con
-- application_name = 'postgres-js' (GUION), pero el nombre real del cliente
-- postgres-js en pg_stat_activity es 'postgres.js' (PUNTO). Verificado en vivo
-- 02/06/2026: SELECT DISTINCT application_name FROM pg_stat_activity → 'postgres.js'.
--
-- CONSECUENCIA del bug: frontend_active_conns era ESTRUCTURALMENTE 0 siempre
-- (el filtro nunca casaba) → el indicador de saturación del pool del frontend
-- (regla pool_frontend_saturation_high, umbral ≥13) nunca podía disparar:
-- un gauge muerto pegado a 0. Diagnosticado al revisar por qué las alertas de
-- pool del 02/06 no cuadraban con la realidad.
--
-- Este CREATE OR REPLACE es idéntico al de 20260601_pool_capacity_samples.sql
-- salvo la línea de frontend_active (postgres-js → postgres.js).
--
-- LIMITACIÓN CONOCIDA (no la arregla este fix): 'postgres.js' es el nombre por
-- defecto de TODOS los clientes postgres-js (getDb frontend + getAdminDb +
-- getTraceDb + pooler), no solo el frontend. Es un proxy razonable y muy
-- superior a 0, pero para atribución exacta por pool habría que fijar un
-- application_name distinto por cliente en db/client.ts (mejora futura).

CREATE OR REPLACE FUNCTION public.take_pool_capacity_sample()
RETURNS TABLE(
  sample_at timestamptz,
  total_conns int,
  active_conns int,
  idle_in_tx_over_5s int,
  hung_clientread_over_10s int,
  frontend_active_conns int,
  inserted boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
#variable_conflict use_column
DECLARE
  v_sample_at timestamptz := date_trunc('minute', NOW());
  v_total int;
  v_active int;
  v_idle int;
  v_idle_tx int;
  v_idle_tx_5s int;
  v_long_active_5s int;
  v_hung_cr_10s int;
  v_by_app jsonb;
  v_frontend_active int;
  v_row_count integer;
  v_inserted boolean := false;
BEGIN
  WITH snap AS (
    SELECT
      application_name,
      state,
      wait_event,
      (backend_type = 'client backend') AS is_client_backend,
      EXTRACT(EPOCH FROM (NOW() - query_start))::float AS query_age_s,
      EXTRACT(EPOCH FROM (NOW() - state_change))::float AS state_age_s
    FROM pg_stat_activity
    WHERE datname IS NOT NULL
      AND pid != pg_backend_pid()
  ),
  counts AS (
    SELECT
      COUNT(*)::int AS total_conns,
      COUNT(*) FILTER (WHERE state = 'active')::int AS active_conns,
      COUNT(*) FILTER (WHERE state = 'idle')::int AS idle_conns,
      COUNT(*) FILTER (WHERE state = 'idle in transaction')::int AS idle_tx_conns,
      COUNT(*) FILTER (WHERE is_client_backend AND state = 'idle in transaction' AND state_age_s > 5)::int AS idle_tx_5s,
      COUNT(*) FILTER (WHERE is_client_backend AND state = 'active' AND query_age_s > 5)::int AS long_active_5s,
      COUNT(*) FILTER (WHERE is_client_backend AND wait_event = 'ClientRead' AND state IN ('active', 'idle in transaction') AND state_age_s > 10)::int AS hung_cr_10s,
      -- FIX 02/06/2026: 'postgres-js' → 'postgres.js' (nombre real del cliente).
      COUNT(*) FILTER (WHERE application_name = 'postgres.js' AND state = 'active')::int AS frontend_active
    FROM snap
  ),
  by_app_agg AS (
    SELECT jsonb_object_agg(
      coalesce(application_name, '?') || '/' || coalesce(state, '?'),
      cnt
    ) AS by_app
    FROM (
      SELECT application_name, state, COUNT(*)::int AS cnt
      FROM snap
      GROUP BY application_name, state
    ) s
  )
  SELECT
    c.total_conns, c.active_conns, c.idle_conns, c.idle_tx_conns,
    c.idle_tx_5s, c.long_active_5s, c.hung_cr_10s, c.frontend_active,
    a.by_app
  INTO
    v_total, v_active, v_idle, v_idle_tx,
    v_idle_tx_5s, v_long_active_5s, v_hung_cr_10s, v_frontend_active,
    v_by_app
  FROM counts c, by_app_agg a;

  INSERT INTO public.pool_capacity_samples (
    sample_at, total_conns, active_conns, idle_conns, idle_in_tx_conns,
    idle_in_tx_over_5s, long_active_over_5s, hung_clientread_over_10s,
    by_app, frontend_active_conns
  ) VALUES (
    v_sample_at, v_total, v_active, v_idle, v_idle_tx,
    v_idle_tx_5s, v_long_active_5s, v_hung_cr_10s,
    v_by_app, v_frontend_active
  )
  ON CONFLICT (sample_at) DO NOTHING;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_inserted := (v_row_count > 0);

  RETURN QUERY SELECT
    v_sample_at,
    v_total, v_active, v_idle_tx_5s, v_hung_cr_10s, v_frontend_active,
    v_inserted;
END;
$$;
