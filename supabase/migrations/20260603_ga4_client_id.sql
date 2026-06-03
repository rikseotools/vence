-- 20260603_ga4_client_id.sql
-- F4 del roadmap docs/roadmap/trackeo-conversiones-ventas.md — destino GA4.
--
-- Para enviar el evento `purchase` a GA4 por Measurement Protocol y que GA4 lo
-- ATE al usuario (y por tanto a su canal de adquisición), hace falta el
-- `client_id` de GA (cookie `_ga`). Lo capturamos en el registro y lo guardamos
-- aquí. Aditivo, reversible (DROP COLUMN). Agnóstico.

BEGIN;

ALTER TABLE public.user_acquisition
  ADD COLUMN IF NOT EXISTS ga_client_id TEXT;

COMMENT ON COLUMN public.user_acquisition.ga_client_id IS
  'client_id de GA4 (cookie _ga, formato "XXXXXXXXX.YYYYYYYYY"), capturado en el '
  'registro. Lo usa el GA4Destination para enviar el purchase por Measurement '
  'Protocol atado al usuario. Ver docs/roadmap/trackeo-conversiones-ventas.md.';

COMMIT;
