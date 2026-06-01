-- Tabla pool_capacity_samples + función + vista para Acción 2 del roadmap
-- docs/roadmap/observability-capacity.md.
--
-- MOTIVACIÓN:
-- Hoy detectamos saturación de pool DESPUÉS de los 5xx (lagging indicator
-- vía validation_error_logs). Necesitamos un LEADING indicator: muestrear
-- pg_stat_activity cada minuto y alertar cuando un patrón de saturación
-- aparezca ANTES de que se traduzca en errores user-facing.
--
-- DISEÑO:
--   1. Tabla con muestras minuto-a-minuto: 1.440 filas/día, retención 7d
--      → 10k filas/sem ~3MB. Despreciable.
--   2. Función take_pool_capacity_sample() que el cron Fargate invoca.
--   3. Función prune_pool_capacity_samples(days) para retención.
--   4. Vista v_pool_capacity_last_15min para uso operativo rápido.
--
-- PATRÓN: idéntico al de pg_stat_statements_snapshots
-- (migration 20260601_pg_stat_statements_snapshots.sql) — misma forma,
-- mismo modelo de cron+función+retención, mismo principio de tener la
-- lógica SQL del lado de la BD (auditable, ejecutable a mano).

-- ============================================================================
-- 1) TABLA pool_capacity_samples
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.pool_capacity_samples (
  -- Truncado a minuto: idempotente vía PK (si el cron corre 2× en mismo
  -- minuto por jitter o restart, el 2º INSERT falla limpiamente sin duplicar).
  sample_at                timestamptz NOT NULL,

  -- ───── Conteos globales en pg_stat_activity ─────
  total_conns              int  NOT NULL,
  active_conns             int  NOT NULL,
  idle_conns               int  NOT NULL,
  idle_in_tx_conns         int  NOT NULL,

  -- ───── Banderas rojas (Hipótesis A/B/D pool-segregation) ─────
  -- Conexiones "colgadas" duraderas que casi siempre indican problema.
  idle_in_tx_over_5s       int  NOT NULL,  -- Hipótesis B: after()/transaction sin commit
  long_active_over_5s      int  NOT NULL,  -- query lenta atascada
  -- Hipótesis A: cliente colgado tras query.
  -- CRÍTICO: state DEBE EXCLUIR 'idle' porque ClientRead con state=idle es
  -- comportamiento NORMAL (toda conexión idle espera la próxima query en
  -- ClientRead). El zombie real es state='active' o 'idle in transaction'
  -- con ClientRead duradero (cliente cerró TCP sin commit/abort).
  hung_clientread_over_10s int  NOT NULL,

  -- ───── Desglose por application_name (jsonb compacto) ─────
  -- Formato: {"postgres-js/active": 5, "Supavisor/idle": 8, ...}
  -- Permite reconstruir cualquier slice sin tener 1 columna por app.
  by_app                   jsonb NOT NULL,

  -- ───── Métricas derivadas del frontend (Fargate) ─────
  -- ¿Cuántas conexiones del frontend están activas en este momento?
  -- Conocer este número permite calcular "% saturación del pool del front".
  frontend_active_conns    int  NOT NULL,  -- postgres-js o conexiones desde IP frontend

  PRIMARY KEY (sample_at)
);

COMMENT ON TABLE public.pool_capacity_samples IS
  'Muestreo minuto-a-minuto del pool de Postgres (pg_stat_activity). Cron Fargate `pool-capacity-sampler` lo alimenta. Retención 7 días. Roadmap: docs/roadmap/observability-capacity.md Acción 2.';

CREATE INDEX IF NOT EXISTS idx_pool_capacity_samples_at
  ON public.pool_capacity_samples (sample_at DESC);

-- ============================================================================
-- 2) FUNCIÓN take_pool_capacity_sample()
-- ============================================================================
-- Llamada por cron Fargate cada minuto. Devuelve la fila insertada.
-- Idempotente vía ON CONFLICT DO NOTHING sobre PK truncada a minuto.
--
-- search_path explícito incluye `extensions` (donde vive pg_stat_statements
-- en Supabase) para uniformidad con take_pg_stat_statements_snapshot.

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
  v_row_count integer;       -- GET DIAGNOSTICS necesita integer, no boolean
  v_inserted boolean := false;
BEGIN
  -- Snapshot único de pg_stat_activity + counts agregados + by_app en UNA
  -- sola query (las CTEs `WITH ... AS` no persisten entre statements separados
  -- en plpgsql, por eso lo encadenamos todo).
  --
  -- `is_client_backend` excluye walsender (replication), autovacuum, archiver,
  -- background writer, etc. — esos procesos corren durante días en `active`
  -- sin ser problema. Para detectar saturación REAL solo queremos clientes
  -- (postgres-js del frontend, PostgREST, Supavisor, etc.).
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
      -- "idle in transaction" >5s = transacción sin commit (zombi típico).
      -- Filtramos por is_client_backend porque autovacuum workers también
      -- pueden reportar este estado.
      COUNT(*) FILTER (WHERE is_client_backend AND state = 'idle in transaction' AND state_age_s > 5)::int AS idle_tx_5s,
      -- "active" >5s en CLIENTE — excluye walsenders (replication),
      -- autovacuum, y otros backend_type que pueden estar activos durante
      -- horas/días sin ser problema.
      COUNT(*) FILTER (WHERE is_client_backend AND state = 'active' AND query_age_s > 5)::int AS long_active_5s,
      -- Zombie real: ClientRead duradero EN ESTADO NO-IDLE + cliente real.
      -- ClientRead+idle es comportamiento NORMAL (idle espera la próxima query).
      COUNT(*) FILTER (WHERE is_client_backend AND wait_event = 'ClientRead' AND state IN ('active', 'idle in transaction') AND state_age_s > 10)::int AS hung_cr_10s,
      -- Frontend activo: postgres-js (los containers Fargate).
      COUNT(*) FILTER (WHERE application_name = 'postgres-js' AND state = 'active')::int AS frontend_active
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

COMMENT ON FUNCTION public.take_pool_capacity_sample() IS
  'Inserta una muestra del estado actual del pool en pool_capacity_samples (truncado al minuto, idempotente). Devuelve los counts capturados + flag inserted. Llamada por cron Fargate `pool-capacity-sampler` 1×/min.';

-- ============================================================================
-- 3) FUNCIÓN prune_pool_capacity_samples(days)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.prune_pool_capacity_samples(p_keep_days integer DEFAULT 7)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.pool_capacity_samples
  WHERE sample_at < NOW() - (p_keep_days || ' days')::interval;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.prune_pool_capacity_samples(integer) IS
  'Elimina muestras con más de p_keep_days días (default 7). Devuelve filas borradas.';

-- ============================================================================
-- 4) VISTA v_pool_capacity_last_15min — uso operativo rápido
-- ============================================================================
-- Pensada para que un operador haga `SELECT * FROM v_pool_capacity_last_15min`
-- y vea de un vistazo si hay banderas rojas en los últimos 15 min.

CREATE OR REPLACE VIEW public.v_pool_capacity_last_15min AS
SELECT
  sample_at,
  total_conns,
  active_conns,
  idle_in_tx_over_5s,
  long_active_over_5s,
  hung_clientread_over_10s,
  frontend_active_conns,
  CASE
    WHEN idle_in_tx_over_5s > 0 OR hung_clientread_over_10s > 0 THEN 'RED'
    WHEN long_active_over_5s > 0 OR active_conns > 20 THEN 'AMBER'
    ELSE 'GREEN'
  END AS status,
  by_app
FROM public.pool_capacity_samples
WHERE sample_at > NOW() - INTERVAL '15 minutes'
ORDER BY sample_at DESC;

COMMENT ON VIEW public.v_pool_capacity_last_15min IS
  'Top muestras del pool en los últimos 15 minutos con status calculado (GREEN/AMBER/RED). Usar para diagnóstico operacional rápido.';
