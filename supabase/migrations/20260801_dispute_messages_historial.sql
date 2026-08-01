-- 20260801_dispute_messages_historial.sql — historial de lo que le hemos escrito a alguien en una
-- impugnación [T-458].
--
-- ## El hueco que cierra
--
-- `question_disputes.admin_response` guarda UNA sola respuesta. Mientras solo se podía contestar una
-- vez daba igual, pero desde T-394 se puede CORREGIR un mensaje ya enviado, y entonces el campo pasó
-- a ser ambiguo: al corregirle a una usuaria la respuesta sobre el atajo de Windows (01/08/2026), el
-- correo salió bien y la ficha se quedó guardando el mensaje ANTERIOR. La siguiente sesión que abriera
-- esa ficha para atender una réplica habría leído como «lo último que le dijimos» algo que ya no lo
-- era — justo el modo de fallo contra el que existe la regla §0.bis del manual de impugnaciones
-- («lee tu admin_response anterior antes de contestar»).
--
-- ## Por qué ESTA forma y no otra
--
-- El lado de FEEDBACK ya resolvió esto con `feedback_conversations` + `feedback_messages` (1.461
-- filas). Se espeja ese modelo en vez de inventar un tercero: mismas columnas y mismos nombres
-- (`is_admin`, `message`, `created_at`). No se clona `feedback_conversations` porque la impugnación
-- YA es el hilo — tiene su propio `status` y su ciclo de vida — así que una tabla de conversación
-- encima sería una capa vacía.
--
-- `admin_response` NO se elimina ni se deja de escribir: sigue siendo «la última respuesta», que es
-- lo que leen el panel y las consultas existentes. Esta tabla es el HISTORIAL. Los dos a la vez, que
-- es lo que se decidió: ver de un vistazo lo último y poder reconstruir el hilo entero.
--
-- Append-only por convención, igual que `question_lifecycle_history`.

CREATE TABLE IF NOT EXISTS public.question_dispute_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id       uuid NOT NULL REFERENCES public.question_disputes(id) ON DELETE CASCADE,
  is_admin         boolean NOT NULL DEFAULT true,
  message          text NOT NULL,
  -- Motivo declarado cuando el mensaje es una CORRECCIÓN de otro ya enviado (T-394). NULL en la
  -- primera respuesta. Tenerlo aquí y no solo en telemetría es lo que permite leer el hilo y
  -- entender POR QUÉ hay dos mensajes seguidos nuestros.
  correccion_motivo text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.question_dispute_messages IS
  'Historial append-only de mensajes de una impugnación. `question_disputes.admin_response` guarda '
  'la ÚLTIMA respuesta (lo que lee el panel); aquí están todas. Espeja feedback_messages. T-458.';

CREATE INDEX IF NOT EXISTS idx_qdm_dispute_created
  ON public.question_dispute_messages (dispute_id, created_at DESC);

-- Backfill: la respuesta que hoy vive en `admin_response` es el primer mensaje del hilo. Sin esto el
-- historial nacería cojo y una réplica antigua se leería como si nunca le hubiéramos contestado.
INSERT INTO public.question_dispute_messages (dispute_id, is_admin, message, created_at)
SELECT d.id, true, d.admin_response, COALESCE(d.resolved_at, d.updated_at, d.created_at)
FROM public.question_disputes d
WHERE d.admin_response IS NOT NULL
  AND length(trim(d.admin_response)) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.question_dispute_messages m WHERE m.dispute_id = d.id
  );
