-- 20260603_conversion_outbox.sql
-- F1 del roadmap docs/roadmap/trackeo-conversiones-ventas.md
--
-- Outbox de conversiones de marketing: cada venta (y futuros eventos) se encola
-- aquí en la MISMA operación que graba el badge, y un worker async la entrega a
-- cada destino (Google Ads hoy; Meta/GA4/TikTok mañana = nuevas filas, mismo
-- esquema). Garantiza entrega at-least-once + idempotencia + reintentos, para
-- que una caída de la API de Ads no pierda conversiones.
--
-- A diferencia de test_questions_outbox (emitido por trigger SQL), este outbox
-- lo escribe el CÓDIGO de aplicación (lib/conversions/recordConversion.ts), por
-- lo que no hay trigger emisor — solo tabla + índices + grants.
--
-- AGNÓSTICO: Postgres estándar, RLS lockdown (sin políticas). Escritura/lectura
-- por la conexión privilegiada (getAdminDb). Idempotente. Reversible: DROP TABLE.

BEGIN;

CREATE TABLE IF NOT EXISTS public.conversion_outbox (
  -- id = dedupId determinista (p.ej. 'purchase:in_123:google_ads'). PK = idempotencia.
  id            TEXT PRIMARY KEY,
  event_type    TEXT NOT NULL CHECK (event_type IN ('purchase','refund','registration','checkout_started')),
  destination   TEXT NOT NULL,                 -- 'google_ads' | 'meta' | 'ga4' | ...
  user_id       UUID,
  value_cents   INTEGER NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'eur',
  occurred_at   TIMESTAMPTZ NOT NULL,          -- momento del evento (no de la subida)
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,  -- snapshot atribución + plan + email_hash
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed')),
  retry_count   INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at  TIMESTAMPTZ
);

COMMENT ON TABLE public.conversion_outbox IS
  'Outbox de conversiones de marketing. 1 fila por (evento × destino). Escrito '
  'por lib/conversions/recordConversion (no trigger). Worker: '
  'app/api/cron/conversion-outbox. Ver docs/roadmap/trackeo-conversiones-ventas.md (F1).';

COMMENT ON COLUMN public.conversion_outbox.id IS
  'dedupId determinista = idempotencia. Reintentar un evento ya encolado no '
  'duplica (ON CONFLICT DO NOTHING en el insert).';

COMMENT ON COLUMN public.conversion_outbox.retry_count IS
  'Incrementa en cada fallo de entrega. A partir de 5 → DLQ (status=failed). '
  'Inspección manual.';

-- Polling del worker: índice parcial sobre los pendientes (óptimo, no indexa entregados).
CREATE INDEX IF NOT EXISTS idx_conversion_outbox_pending
  ON public.conversion_outbox (created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_conversion_outbox_user
  ON public.conversion_outbox (user_id) WHERE user_id IS NOT NULL;

-- RLS lockdown (sin políticas). getAdminDb bypasa. Inocuo en RDS.
ALTER TABLE public.conversion_outbox ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.conversion_outbox TO service_role;

COMMIT;

-- ============================================================================
-- Smoke test post-migración (ejecutar manualmente):
-- ============================================================================
-- INSERT INTO public.conversion_outbox (id, event_type, destination, value_cents, currency, occurred_at)
--   VALUES ('purchase:test:google_ads', 'purchase', 'google_ads', 5900, 'eur', NOW())
--   ON CONFLICT (id) DO NOTHING;
-- SELECT id, status, retry_count FROM public.conversion_outbox WHERE id='purchase:test:google_ads';
-- DELETE FROM public.conversion_outbox WHERE id='purchase:test:google_ads';
