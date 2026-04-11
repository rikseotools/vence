-- Trigger PG para enviar email automático al resolver/rechazar una impugnación
-- legislativa. Este trigger ya existía en Supabase desde antes (creado a mano en
-- el SQL Editor y no versionado). Este archivo captura su estado el 11/04/2026
-- para completar la paridad de versionado con el trigger psicotécnico.
--
-- Flujo: AFTER UPDATE en question_disputes → si status pasa a 'resolved'/'rejected'
-- → http_post al endpoint /api/send-dispute-email → Resend envía el email al usuario.
--
-- Requisitos:
--   - Extensión `http` habilitada en Supabase
--   - Endpoint /api/send-dispute-email desplegado (acepta {disputeId, status,
--     adminResponse, userId, questionId} desde trigger, además de formatos para
--     webhook y admin panel)
--
-- Documentado en docs/maintenance/impugnaciones-claude-code.md (sección 15.1).
--
-- IDEMPOTENTE: se puede ejecutar varias veces sin efectos secundarios.
-- SEGURIDAD: CREATE OR REPLACE no rompe el trigger existente, solo lo reescribe
-- idéntico.

CREATE OR REPLACE FUNCTION public.send_dispute_email_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  api_url TEXT;
  api_response http_response;
  payload TEXT;
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) AND (NEW.status IN ('resolved', 'rejected')) THEN

    api_url := COALESCE(
      current_setting('app.base_url', true),
      'https://www.vence.es'
    ) || '/api/send-dispute-email';

    payload := json_build_object(
      'disputeId', NEW.id,
      'status', NEW.status,
      'adminResponse', NEW.admin_response,
      'resolvedAt', NEW.resolved_at,
      'userId', NEW.user_id,
      'questionId', NEW.question_id
    )::text;

    BEGIN
      SELECT * INTO api_response FROM http_post(api_url, payload, 'application/json');
      IF api_response.status < 200 OR api_response.status >= 300 THEN
        RAISE WARNING 'Error email impugnacion disputa %. Status: %', NEW.id, api_response.status;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error en trigger email disputa %: %', NEW.id, SQLERRM;
    END;

  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_send_dispute_email ON public.question_disputes;
CREATE TRIGGER trigger_send_dispute_email
  AFTER UPDATE ON public.question_disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.send_dispute_email_notification();
