-- 2026-04-14 — Eliminar trigger PG de envío de notificaciones de feedback.
--
-- Contexto: el trigger send_feedback_notification (AFTER INSERT en
-- feedback_messages cuando is_admin=true) hacía dos cosas:
--   1. INSERT en notification_logs (campana del usuario)
--   2. http_post síncrono a /api/send-support-email (email)
--
-- Mismo bug de cold-start que tenían los triggers de impugnaciones (eliminados
-- esta misma fecha): si el endpoint Vercel tarda >5s en responder, http_post
-- da timeout y la función PG captura la excepción con EXCEPTION WHEN OTHERS
-- emitiendo un RAISE WARNING invisible desde el dashboard. Resultado: feedback
-- queda respondido en BD pero el usuario no recibe nada.
--
-- Patrón actual (post-elim trigger):
--   - Admin UI (app/admin/feedback/page.tsx): ya hacía INSERT directo en
--     feedback_messages + INSERT propio en notification_logs + fetch a
--     /api/send-support-email. El trigger era redundante para esta ruta.
--   - Scripts de Claude: el manual gestionar-feedback-bug.md §10 documenta
--     los 5 pasos manuales (incluyendo el INSERT en notification_logs y el
--     fetch al endpoint que antes hacía el trigger).
--
-- IDEMPOTENTE: usa IF EXISTS para que se pueda re-ejecutar sin error.

DROP TRIGGER IF EXISTS trigger_send_feedback_notification ON public.feedback_messages;
DROP FUNCTION IF EXISTS public.send_feedback_notification();
