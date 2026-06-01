-- Snapshot histórico de pg_stat_statements + vista delta 24h.
--
-- Acción 3 del roadmap docs/roadmap/observability-capacity.md.
--
-- Motivación:
-- pg_stat_statements es ACUMULADO desde el último pg_stat_statements_reset().
-- En producción el reset ocurre raramente (último: 2026-05-26, lleva 5+ días),
-- así que las queries del top mezclan "lento HOY" con "lento durante incidente
-- de hace 5 días". Esto bloqueó el diagnóstico del incidente 31/05/2026 donde
-- `getAllLawsWithStats` aparecía con mean=2927ms (174 calls) pero era ruido
-- histórico — sólo se llama desde /test/por-leyes con bajo tráfico.
--
-- Solución: snapshot diario en tabla histórica + vista que calcula el DELTA
-- de las últimas 24h (calls nuevas, mean efectivo del periodo, no acumulado).
--
-- Coste: 1 INSERT/día con ~5k-50k filas, ~5-50MB/snapshot, retención 30 días
-- = peor caso 1.5GB. Despreciable vs el valor diagnóstico.
--
-- IMPORTANTE: NO reseteamos pg_stat_statements. El reset queda como
-- operación manual cuando se decida (decisión consciente, no automática).
-- Lo que sí tenemos es el snapshot histórico que permite calcular deltas.

-- ============================================================================
-- 1) TABLA pg_stat_statements_snapshots
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.pg_stat_statements_snapshots (
  snapshot_at    timestamptz NOT NULL,
  queryid        bigint      NOT NULL,
  calls          bigint      NOT NULL,
  total_exec_ms  numeric     NOT NULL,
  mean_exec_ms   numeric     NOT NULL,
  max_exec_ms    numeric     NOT NULL,
  stddev_exec_ms numeric     NOT NULL,
  rows           bigint      NOT NULL,
  -- Truncamos a 1000 chars para acotar tamaño de fila — las queries de la app
  -- caben de sobra; las queries gigantescas de migraciones se truncan sin
  -- pérdida diagnóstica relevante.
  query          text        NOT NULL,
  PRIMARY KEY (snapshot_at, queryid)
);

COMMENT ON TABLE public.pg_stat_statements_snapshots IS
  'Snapshot diario de pg_stat_statements para calcular deltas 24h. Cron Fargate `pg-stat-snapshot` (00:05 UTC) lo alimenta. Retención: 30 días. Roadmap: docs/roadmap/observability-capacity.md Acción 3.';

CREATE INDEX IF NOT EXISTS idx_pgss_snap_ts
  ON public.pg_stat_statements_snapshots (snapshot_at DESC);

-- ============================================================================
-- 2) FUNCIÓN take_pg_stat_statements_snapshot()
-- ============================================================================
-- Patrón: misma forma que `refresh_ranking_cache()` — la lógica vive en SQL,
-- el cron del backend solo invoca y recoge stats. Más fácil de auditar y de
-- ejecutar a mano en investigaciones (`SELECT take_pg_stat_statements_snapshot()`).
--
-- Idempotente por (snapshot_at, queryid) — si se llama 2 veces en el mismo
-- minuto, el segundo INSERT falla con UNIQUE conflict y devuelve rows_inserted=0.
-- El cron diario no debería encontrar este caso, pero es defensa-en-profundidad.

CREATE OR REPLACE FUNCTION public.take_pg_stat_statements_snapshot()
RETURNS TABLE(snapshot_at timestamptz, rows_inserted integer, duration_ms integer)
LANGUAGE plpgsql
SECURITY DEFINER
-- search_path explícito incluye `extensions` (donde vive pg_stat_statements
-- en Supabase) y `public` (donde vive nuestra tabla destino). pg_catalog
-- siempre se busca primero implícitamente. Sin `extensions` en el path la
-- función falla con `relation "pg_stat_statements" does not exist`.
SET search_path = public, extensions, pg_catalog
AS $$
-- Directiva clave: los OUT parameters del RETURNS TABLE(...) (snapshot_at,
-- rows_inserted, duration_ms) colisionarían con columnas homónimas en el
-- INSERT y el RETURN. `use_column` dice a plpgsql: ante ambigüedad prefiere
-- la columna, no la variable. Patrón idiomático cuando los OUT params
-- comparten nombre con columnas — alternativa sería renombrar OUT con
-- prefijo (rompería el contrato con el service TS que lee `snapshot_at`).
#variable_conflict use_column
DECLARE
  v_start timestamptz := clock_timestamp();
  v_snapshot_at timestamptz := date_trunc('minute', NOW());
  v_inserted integer;
BEGIN
  INSERT INTO public.pg_stat_statements_snapshots (
    snapshot_at, queryid, calls,
    total_exec_ms, mean_exec_ms, max_exec_ms, stddev_exec_ms,
    rows, query
  )
  SELECT
    v_snapshot_at,
    pgss.queryid,
    pgss.calls,
    pgss.total_exec_time,
    pgss.mean_exec_time,
    pgss.max_exec_time,
    pgss.stddev_exec_time,
    pgss.rows,
    LEFT(pgss.query, 1000)
  -- Schema explícito `extensions.` por defensa-en-profundidad: si en el
  -- futuro Supabase mueve la extensión a otro schema, este search_path
  -- compatibiliza ambos casos.
  FROM extensions.pg_stat_statements pgss
  WHERE pgss.calls > 10  -- filtrar queries casi-nuevas que no aportan al delta
    AND pgss.queryid IS NOT NULL
  ON CONFLICT (snapshot_at, queryid) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN QUERY SELECT
    v_snapshot_at,
    v_inserted,
    EXTRACT(MILLISECOND FROM (clock_timestamp() - v_start))::integer
      + (EXTRACT(SECOND FROM (clock_timestamp() - v_start))::integer * 1000);
END;
$$;

COMMENT ON FUNCTION public.take_pg_stat_statements_snapshot() IS
  'Inserta snapshot del estado actual de pg_stat_statements (queries con >10 calls). Devuelve (snapshot_at, rows_inserted, duration_ms). Llamada por cron Fargate `pg-stat-snapshot` 1×/día.';

-- ============================================================================
-- 3) FUNCIÓN prune_pg_stat_statements_snapshots(days int)
-- ============================================================================
-- Retención explícita. Se invoca desde el mismo cron diario tras el snapshot
-- (o desde el cron de poda existente, según se decida operativamente).

CREATE OR REPLACE FUNCTION public.prune_pg_stat_statements_snapshots(p_keep_days integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.pg_stat_statements_snapshots
  WHERE snapshot_at < NOW() - (p_keep_days || ' days')::interval;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.prune_pg_stat_statements_snapshots(integer) IS
  'Elimina snapshots con más de p_keep_days días (default 30). Devuelve filas borradas.';

-- ============================================================================
-- 4) VISTA v_pg_stat_statements_delta
-- ============================================================================
-- Calcula el delta de las últimas 24h comparando los 2 snapshots más recientes.
-- Patrón clave: `mean_ms_last_24h` distingue "lento HOY" de "lento histórico".
-- Si una query se degrada hoy, `mean_ms_last_24h >> mean_ms_all_time`.

CREATE OR REPLACE VIEW public.v_pg_stat_statements_delta AS
WITH snapshots_ordered AS (
  SELECT DISTINCT snapshot_at
  FROM public.pg_stat_statements_snapshots
  ORDER BY snapshot_at DESC
  LIMIT 2
),
ranked AS (
  SELECT snapshot_at,
         ROW_NUMBER() OVER (ORDER BY snapshot_at DESC) AS rn
  FROM snapshots_ordered
),
today AS (
  SELECT s.*
  FROM public.pg_stat_statements_snapshots s
  JOIN ranked r ON r.snapshot_at = s.snapshot_at AND r.rn = 1
),
yesterday AS (
  SELECT s.*
  FROM public.pg_stat_statements_snapshots s
  JOIN ranked r ON r.snapshot_at = s.snapshot_at AND r.rn = 2
)
SELECT
  t.snapshot_at                       AS today_snapshot_at,
  y.snapshot_at                       AS yesterday_snapshot_at,
  t.queryid,
  -- DELTA de calls (cuántas nuevas en las últimas 24h)
  (t.calls - COALESCE(y.calls, 0))::bigint                        AS calls_delta_24h,
  -- DELTA de tiempo total (ms gastados en las últimas 24h)
  (t.total_exec_ms - COALESCE(y.total_exec_ms, 0))::numeric       AS total_ms_delta_24h,
  -- MEAN efectivo de las últimas 24h (clave: NO es acumulado)
  CASE WHEN (t.calls - COALESCE(y.calls, 0)) > 0
       THEN ((t.total_exec_ms - COALESCE(y.total_exec_ms, 0))
             / NULLIF(t.calls - COALESCE(y.calls, 0), 0))::numeric(12,2)
       ELSE NULL
  END                                                              AS mean_ms_last_24h,
  -- MEAN acumulado (para comparar — si delta >> all_time hay degradación reciente)
  t.mean_exec_ms                      AS mean_ms_all_time,
  t.max_exec_ms                       AS max_ms_all_time,
  t.calls                             AS calls_all_time,
  LEFT(t.query, 200)                  AS query_preview,
  t.query                             AS query_full
FROM today t
LEFT JOIN yesterday y ON y.queryid = t.queryid
WHERE (t.calls - COALESCE(y.calls, 0)) > 5  -- ignorar queries sin actividad nueva
ORDER BY total_ms_delta_24h DESC;

COMMENT ON VIEW public.v_pg_stat_statements_delta IS
  'Top queries por tiempo total consumido en las últimas 24h (delta real entre los 2 snapshots más recientes). Usar para diagnóstico de incidentes: si mean_ms_last_24h >> mean_ms_all_time hay degradación reciente. Roadmap: docs/roadmap/observability-capacity.md Acción 3.';

-- ============================================================================
-- 5) VERIFICACIÓN (run-once en migración)
-- ============================================================================
-- Verificamos que pg_stat_statements está habilitado y que la función SQL
-- compila. Si pg_stat_statements no está instalado, fallamos rápido aquí
-- (mejor que descubrirlo cuando el cron empieza a fallar en producción).
DO $$
DECLARE
  v_schema text;
BEGIN
  SELECT extnamespace::regnamespace::text INTO v_schema
  FROM pg_extension WHERE extname = 'pg_stat_statements';

  IF v_schema IS NULL THEN
    RAISE EXCEPTION
      'pg_stat_statements extension not installed. Cannot apply this migration.';
  END IF;

  -- Aviso defensivo: si la extensión no vive ni en `public` ni en `extensions`,
  -- el search_path de la función `take_pg_stat_statements_snapshot()` puede
  -- necesitar ajuste manual. En Supabase Pro es siempre `extensions`.
  IF v_schema NOT IN ('public', 'extensions') THEN
    RAISE WARNING
      'pg_stat_statements vive en schema "%". La función asume public/extensions — revisar search_path.',
      v_schema;
  END IF;
END $$;
