-- Tabla pgbouncer_instance_samples — observabilidad POR INSTANCIA del pooler.
-- Fase 1 de la prioridad nº1 del ARCHITECTURE_ROADMAP §03/06 (línea 1608):
-- "no sabemos CUÁL instancia da el timeout… falta scrapear SHOW POOLS/STATS/
-- SERVERS de cada PgBouncer".
--
-- MOTIVACIÓN:
-- El health-check del NLB es TCP-only: una VM que acepta TCP pero cuelga
-- queries pasa el check y sigue sirviendo → 504. `/api/admin/infra-stats`
-- scrapea pero VÍA el NLB (instancia al azar), no por instancia. Esta tabla
-- guarda una muestra minuto-a-minuto POR CADA VM del pooler, alimentada por el
-- cron Fargate `pooler-instance-sampler` que conecta a cada instancia por la
-- RED PRIVADA (VPC peering) y mide: reachability, latencia real de un SELECT 1,
-- y las stats internas de PgBouncer (cl_waiting/maxwait/sv_active...).
--
-- DISEÑO: idéntico a pool_capacity_samples (migration 20260601) — muestra
-- minuto-a-minuto idempotente por PK, retención por función de poda, lógica
-- de retención del lado BD (auditable). La diferencia: las filas las INSERTA
-- el cron desde Node (los datos vienen del scrapeo externo, no de
-- pg_stat_activity), por eso no hay función take_*().
--
-- VOLUMEN: 2 instancias × 1.440 min/día = 2.880 filas/día, retención 14d
-- → ~40k filas ~12MB. Despreciable.

-- ============================================================================
-- 1) TABLA pgbouncer_instance_samples
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.pgbouncer_instance_samples (
  -- Truncado a minuto: idempotente vía PK compuesta (sample_at, instance).
  sample_at            timestamptz NOT NULL,
  -- IP privada de la instancia (172.26.x.x) — clave estable de la VM.
  instance             text        NOT NULL,
  -- Availability Zone (eu-west-2a / eu-west-2b) según el target group del NLB.
  az                   text,
  -- Vista del NLB sobre esa instancia: healthy | unhealthy | draining | unused.
  target_health        text,

  -- ───── Señal de servicio real (lo que el health-check TCP NO mide) ─────
  -- ¿Respondió la instancia a un SELECT 1 real (dbname=postgres) por su IP privada?
  reachable            boolean     NOT NULL,
  -- Latencia de establecer la conexión admin (ms).
  connect_ms           int,
  -- Latencia de un SELECT 1 real a través del pool de ESA instancia (ms).
  -- NULL si no fue alcanzable. Es el leading indicator directo de "cuelga queries".
  select1_ms           int,

  -- ───── Stats internas de PgBouncer (SHOW POOLS, pool postgres/postgres) ─────
  cl_active            int,   -- clientes con conexión de servidor asignada
  cl_waiting           int,   -- clientes ESPERANDO conexión (saturación → sube)
  sv_active            int,   -- conexiones de servidor en uso
  sv_idle              int,   -- conexiones de servidor ociosas
  maxwait_us           bigint,-- microsegundos que el cliente más antiguo lleva esperando

  -- ───── SHOW STATS_TOTALS (acumulados; derivados a medias) ─────
  query_count          bigint,
  avg_query_time_us    int,   -- query_time / query_count
  avg_wait_time_us     int,   -- wait_time / query_count
  -- SHOW SERVERS: nº de conexiones upstream (PgBouncer→Postgres) abiertas.
  server_count         int,

  -- Mensaje de error si la instancia no fue alcanzable / falló el scrape.
  error                text,

  PRIMARY KEY (sample_at, instance)
);

COMMENT ON TABLE public.pgbouncer_instance_samples IS
  'Muestreo minuto-a-minuto POR INSTANCIA del self-hosted PgBouncer. Cron Fargate `pooler-instance-sampler` conecta a cada VM por red privada (SHOW POOLS/STATS/SERVERS + SELECT 1 cronometrado). Retención 14 días. ARCHITECTURE_ROADMAP §03/06 prioridad nº1.';

CREATE INDEX IF NOT EXISTS idx_pgbouncer_instance_samples_at
  ON public.pgbouncer_instance_samples (sample_at DESC);

CREATE INDEX IF NOT EXISTS idx_pgbouncer_instance_samples_instance_at
  ON public.pgbouncer_instance_samples (instance, sample_at DESC);

-- ============================================================================
-- 2) FUNCIÓN prune_pgbouncer_instance_samples(days) — retención
-- ============================================================================
-- Mismo patrón que prune_pool_capacity_samples. El cron la llama cada tick;
-- coste despreciable (DELETE sin filas la mayor parte del tiempo).
CREATE OR REPLACE FUNCTION public.prune_pgbouncer_instance_samples(
  p_days integer DEFAULT 14
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.pgbouncer_instance_samples
  WHERE sample_at < NOW() - (p_days || ' days')::interval;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- ============================================================================
-- 3) VISTA operativa — últimos 15 min por instancia
-- ============================================================================
CREATE OR REPLACE VIEW public.v_pgbouncer_instances_last_15min AS
SELECT
  instance,
  az,
  COUNT(*)                                   AS samples,
  COUNT(*) FILTER (WHERE NOT reachable)      AS unreachable_samples,
  MAX(select1_ms)                            AS max_select1_ms,
  MAX(cl_waiting)                            AS max_cl_waiting,
  MAX(maxwait_us)                            AS max_maxwait_us,
  MAX(sample_at)                             AS last_sample_at
FROM public.pgbouncer_instance_samples
WHERE sample_at > NOW() - INTERVAL '15 minutes'
GROUP BY instance, az
ORDER BY instance;
