-- 2026-05-25-observable-events.sql
--
-- Tabla `observable_events` unificada — Bloque 4 del roadmap arquitectural.
--
-- Reemplaza la observabilidad fragmentada que tenemos hoy:
--   - validation_error_logs (Vercel functions, atada a `withErrorLogging`)
--   - CloudWatch Logs /ecs/vence-backend (Fargate, aislada)
--   - Sentry (duplicado con validation_error_logs)
--   - stats_drift_log (cron de drift, otra tabla más)
--
-- Una sola tabla con todos los eventos críticos del sistema, escrita desde
-- 3 origenes (vercel/fargate/gha) — todos hablan el mismo idioma.
--
-- Patrón cross-runtime coherente: igual que cache_version y daily_limit,
-- ambos lados escriben directo a la misma tabla via Drizzle (estándar
-- Postgres). El que no pueda escribir directo (GHA) usa endpoint HTTP
-- ingest /api/observability/ingest con shared secret.
--
-- Decisión 23/05 del roadmap. Migración MVP — los writers viejos siguen
-- vivos en paralelo hasta migración completa (deprecate gradual).

BEGIN;

CREATE TABLE IF NOT EXISTS public.observable_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Timestamp del evento. Default NOW() pero el writer puede pasar uno
  -- propio si emite en background o batch (mantener temporalidad real).
  ts              timestamptz NOT NULL DEFAULT NOW(),

  -- Origen del evento. Permite filtrar por dónde se generó.
  -- Valores actuales: 'vercel' (lambdas Next.js), 'fargate' (backend NestJS),
  --                   'gha' (GitHub Actions), 'frontend' (cliente browser).
  -- Sin CHECK constraint — añadir source nuevo no debe requerir migración.
  source          text NOT NULL,

  -- Severidad del evento. Misma escala que loggers estándar.
  severity        text NOT NULL CHECK (severity IN ('debug', 'info', 'warn', 'error', 'critical')),

  -- Categoría del evento. Ej: 'http_5xx', 'cron_run', 'deploy', 'drift_alert',
  -- 'cache_invalidation', 'rate_limit_hit', 'backend_proxy_fallback'.
  -- Texto libre — la convención sí importa para queries pero no se enforza
  -- a nivel BD (futura migración añade enum cuando estabilice).
  event_type      text NOT NULL,

  -- Contexto opcional — todos nullable para no enforzar shape rígido.
  endpoint        text,
  user_id         uuid,
  deploy_version  text,
  duration_ms     integer,
  http_status     integer,
  error_message   text,

  -- Metadata libre JSONB para campos específicos del event_type sin
  -- requerir migración por cada nuevo dato.
  metadata        jsonb,

  created_at      timestamptz NOT NULL DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════
-- Índices — optimizados para los patrones de query típicos.
-- ════════════════════════════════════════════════════════════════

-- Time-series queries: "errores última hora", "últimos N eventos"
CREATE INDEX IF NOT EXISTS idx_observable_events_ts_desc
  ON public.observable_events (ts DESC);

-- Filtros por source+severity típicos: "errores backend hoy",
-- "warnings vercel última hora"
CREATE INDEX IF NOT EXISTS idx_observable_events_source_severity_ts
  ON public.observable_events (source, severity, ts DESC);

-- Filtros por event_type para dashboards específicos
CREATE INDEX IF NOT EXISTS idx_observable_events_event_type_ts
  ON public.observable_events (event_type, ts DESC);

-- Filtros por endpoint para investigación de un endpoint específico
CREATE INDEX IF NOT EXISTS idx_observable_events_endpoint_ts
  ON public.observable_events (endpoint, ts DESC)
  WHERE endpoint IS NOT NULL;

-- ════════════════════════════════════════════════════════════════
-- Retención: 30 días.
-- ════════════════════════════════════════════════════════════════
-- A 10k DAU con ~50 eventos/día/user observables = 500k/día = 15M/mes.
-- A ese ritmo: con retención 30d → ~15M filas activas. Postgres maneja
-- sin problemas con los índices anteriores.
--
-- La poda la hace un cron en backend (futuro) o un job SQL programado:
--   DELETE FROM observable_events WHERE ts < NOW() - INTERVAL '30 days'
--
-- Si el volumen crece, considerar particionado por día (RANGE PARTITION).
-- Hoy YAGNI: añadir cuando p_max de queries supere los 500ms.

COMMENT ON TABLE public.observable_events IS
  'Eventos observables unificados de todo el sistema (Vercel/Fargate/GHA/frontend). '
  'Reemplaza validation_error_logs + CloudWatch + Sentry + stats_drift_log como sitio único. '
  'Bloque 4 del docs/ARCHITECTURE_ROADMAP.md. Writers: lib/observability/emit.ts (Vercel), '
  'backend/src/observability/ObservabilityService (Fargate), '
  '/api/observability/ingest endpoint (GHA y otros sin acceso directo a BD).';

COMMIT;
