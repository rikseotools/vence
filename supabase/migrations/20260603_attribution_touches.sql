-- 20260603_attribution_touches.sql
-- F0 del roadmap docs/roadmap/trackeo-conversiones-ventas.md
--
-- Atribución duradera multi-touch + multicanal. Dos cambios:
--   1) NUEVA tabla append-only `attribution_touches`: cada toque (anónimo o
--      identificado) con TODOS los click-IDs (Google web/iOS, Meta, TikTok, Bing).
--      Clave de anonimato = `device_id` (reusa el `vence_device_id` que ya genera
--      components/FraudTracker.tsx). Al registrarse, se liga device_id → user_id.
--   2) EVOLUCIÓN aditiva de `user_acquisition` (creada en 20260602): añade
--      last-touch + click-IDs nuevos, SIN romper el first-touch existente ni los
--      readers (lib/services/googleAds/roi.ts).
--
-- AGNÓSTICO A SUPABASE (migración a RDS en curso): solo Postgres estándar
-- (tablas + índices + RLS sin políticas = lockdown PostgREST). SIN RPC, SIN
-- auth.uid(), SIN grants a anon/authenticated. Escritura/lectura por la conexión
-- privilegiada de la app (getAdminDb/Drizzle), control de acceso en la capa app.
--
-- Idempotente. Reversible: DROP TABLE attribution_touches; + ALTER TABLE
-- user_acquisition DROP COLUMN ... (las nuevas). Aplicar en prod tras revisión.

BEGIN;

-- ============================================================================
-- 1. Tabla append-only de toques de atribución
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.attribution_touches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id    TEXT NOT NULL,                 -- vence_device_id (1ª parte, pre-login)
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL hasta el binding en signup
  -- Click-IDs (channel-agnostic; cualquier plataforma encaja sin migrar esquema)
  gclid        TEXT,                           -- Google Ads (web)
  gbraid       TEXT,                           -- Google Ads (app→web, iOS)
  wbraid       TEXT,                           -- Google Ads (web→app, iOS)
  fbclid       TEXT,                           -- Meta
  ttclid       TEXT,                           -- TikTok
  msclkid      TEXT,                           -- Microsoft/Bing
  -- UTM
  utm_source   TEXT,
  utm_medium   TEXT,
  utm_campaign TEXT,
  utm_term     TEXT,
  utm_content  TEXT,
  -- Contexto
  landing_path TEXT,
  referrer     TEXT,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.attribution_touches IS
  'Append-only: cada toque de atribución (anónimo por device_id, ligado a user_id '
  'en el signup). Fuente para derivar first/last-touch en user_acquisition. '
  'Escritura vía endpoint público /api/attribution/touch + Drizzle. Ver '
  'docs/roadmap/trackeo-conversiones-ventas.md (F0).';

COMMENT ON COLUMN public.attribution_touches.device_id IS
  'vence_device_id (UUID 1ª parte, localStorage) generado por FraudTracker. '
  'Permite ligar toques pre-login al usuario tras registrarse.';

CREATE INDEX IF NOT EXISTS idx_attribution_touches_device
  ON public.attribution_touches (device_id);
CREATE INDEX IF NOT EXISTS idx_attribution_touches_user
  ON public.attribution_touches (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attribution_touches_gclid
  ON public.attribution_touches (gclid) WHERE gclid IS NOT NULL;

-- RLS lockdown (igual que user_acquisition): habilitado SIN políticas → nadie
-- accede vía PostgREST; getAdminDb (privilegiado) bypasa RLS. Inocuo en RDS.
ALTER TABLE public.attribution_touches ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. Evolución aditiva de user_acquisition (last-touch + click-IDs nuevos)
-- ============================================================================

ALTER TABLE public.user_acquisition
  ADD COLUMN IF NOT EXISTS gbraid           TEXT,
  ADD COLUMN IF NOT EXISTS wbraid           TEXT,
  ADD COLUMN IF NOT EXISTS ttclid           TEXT,
  ADD COLUMN IF NOT EXISTS msclkid          TEXT,
  -- Last-touch (el first-touch son las columnas existentes; no se sobrescriben)
  ADD COLUMN IF NOT EXISTS last_channel     TEXT,
  ADD COLUMN IF NOT EXISTS last_gclid       TEXT,
  ADD COLUMN IF NOT EXISTS last_utm_source  TEXT,
  ADD COLUMN IF NOT EXISTS last_utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS last_landing_path TEXT,
  ADD COLUMN IF NOT EXISTS last_captured_at TIMESTAMPTZ;

COMMENT ON COLUMN public.user_acquisition.last_channel IS
  'Last-touch derivado de attribution_touches en el binding (signup). Las '
  'columnas sin prefijo siguen siendo el first-touch (no se sobrescriben).';

COMMIT;

-- ============================================================================
-- Smoke test post-migración (ejecutar manualmente):
-- ============================================================================
-- INSERT INTO public.attribution_touches (device_id, gclid, utm_campaign, landing_path)
--   VALUES ('test-device', 'TESTGCLID', '999', '/');
-- SELECT id, device_id, gclid, occurred_at FROM public.attribution_touches
--   WHERE device_id='test-device';
-- DELETE FROM public.attribution_touches WHERE device_id='test-device';
