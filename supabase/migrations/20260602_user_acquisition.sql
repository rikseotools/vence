-- 20260602_user_acquisition.sql
-- Atribución first-touch multicanal (Google Ads, Meta Ads, orgánico…).
--
-- Objetivo: cruzar coste por campaña (API Google Ads, donde utm_campaign =
-- {campaignid} numérico) con ingresos reales por campaña (conversion_events).
-- Channel-agnostic: Meta (fbclid) y futuros canales encajan sin cambiar esquema.
--
-- AGNÓSTICO A SUPABASE (migración a AWS/RDS en curso):
--   - Solo Postgres estándar (tabla + índices + FK + RLS). Válido en RDS.
--   - SIN función RPC, SIN auth.uid(), SIN grants a roles authenticated/anon
--     (todo eso es PostgREST/Supabase). La escritura va por endpoint + Drizzle
--     (getAdminDb), el control de acceso está en la capa de aplicación.
--   - RLS habilitado SIN políticas = lockdown total vía PostgREST mientras
--     sigamos en Supabase (solo la conexión privilegiada de Drizzle escribe/lee).
--
-- Idempotente. Aplicar en prod solo tras revisión.

CREATE TABLE IF NOT EXISTS public.user_acquisition (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  channel      TEXT NOT NULL,                  -- 'google_ads' | 'meta_ads' | 'organic' | ...
  gclid        TEXT,                           -- Google click id (auto-tagging)
  fbclid       TEXT,                           -- Meta click id
  utm_source   TEXT,
  utm_medium   TEXT,
  utm_campaign TEXT,                           -- con el final_url_suffix nuevo = ID numérico de campaña (Google)
  landing_path TEXT,
  referrer     TEXT,
  captured_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.user_acquisition IS
  'Atribución first-touch por usuario (multicanal). 1 fila por usuario; no se sobrescribe (primer toque). Escritura vía endpoint+Drizzle, no RPC.';

CREATE INDEX IF NOT EXISTS idx_user_acquisition_channel
  ON public.user_acquisition (channel);
CREATE INDEX IF NOT EXISTS idx_user_acquisition_utm_campaign
  ON public.user_acquisition (utm_campaign);

-- RLS lockdown: habilitado sin políticas → nadie accede vía PostgREST.
-- La conexión privilegiada de la app (getAdminDb) bypasa RLS. En RDS (sin
-- PostgREST) esto es inocuo / se puede retirar.
ALTER TABLE public.user_acquisition ENABLE ROW LEVEL SECURITY;
