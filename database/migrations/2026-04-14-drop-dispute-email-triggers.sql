-- 2026-04-14 — Eliminar triggers PG de envío de email de impugnaciones.
--
-- Contexto: el patrón antiguo (UPDATE en *_disputes → trigger PG → http_post síncrono
-- al endpoint Vercel) fallaba en silencio cuando el endpoint estaba frío
-- (cold start de Vercel >5s → timeout del http_post). Las legislativas funcionaban
-- por suerte (endpoint caliente por volumen); las psicotécnicas fallaban
-- sistemáticamente al recibir poco tráfico.
--
-- Sustituido por la función TS resolveDispute() en lib/api/v2/dispute/queries.ts,
-- que llama directamente a sendEmailV2 desde el mismo proceso Vercel del admin
-- (sin saltos HTTP intermedios → sin cold start). Endpoint:
--   POST /api/v2/dispute/resolve
--
-- Esta migration:
--   1. Elimina los dos triggers (legislativo + psicotécnico).
--   2. Elimina las dos funciones PL/pgSQL asociadas.
--
-- Los endpoints HTTP /api/send-dispute-email y /api/send-dispute-email/psychometric
-- se mantienen temporalmente como compatibilidad por si quedan llamadas externas
-- (cron antiguo, scripts, etc.). Pueden eliminarse en un commit posterior.
--
-- IDEMPOTENTE: usa IF EXISTS para que se pueda re-ejecutar.

DROP TRIGGER IF EXISTS trigger_send_dispute_email ON public.question_disputes;
DROP TRIGGER IF EXISTS trigger_send_psychometric_dispute_email ON public.psychometric_question_disputes;

DROP FUNCTION IF EXISTS public.send_dispute_email_notification();
DROP FUNCTION IF EXISTS public.send_psychometric_dispute_email_notification();
