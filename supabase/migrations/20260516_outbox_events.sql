-- Fase 2 — Outbox pattern (paso 0: infraestructura sin handlers)
--
-- Tabla `outbox_events` que actúa como cola in-database para mover trabajo
-- pesado (recálculos, agregaciones) fuera del camino crítico del usuario.
--
-- Patrón:
--   1) Endpoint que sirve al usuario (p.ej. /api/v2/answer-and-save) inserta
--      en outbox_events DENTRO de la misma transacción donde guarda la
--      respuesta. Si la transacción rollbackea, el evento desaparece. Atómico.
--   2) Worker `/api/cron/process-outbox` lee filas con processed_at IS NULL,
--      ejecuta el handler correspondiente, marca processed_at = now().
--   3) Si el worker falla, attempts se incrementa y last_error guarda el motivo.
--      El siguiente run reintenta.
--
-- Ver docs/ARCHITECTURE_ROADMAP.md sección "Fase 2 — Outbox pattern".

CREATE TABLE IF NOT EXISTS public.outbox_events (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   text        NOT NULL,
  payload      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempts     integer     NOT NULL DEFAULT 0,
  last_error   text,

  CONSTRAINT outbox_events_attempts_nonneg CHECK (attempts >= 0)
);

COMMENT ON TABLE public.outbox_events IS
  'Outbox pattern (Fase 2). Eventos pendientes de procesar por worker async. '
  'Filas se encolan dentro de la transacción del request, worker las consume '
  'en background. processed_at IS NULL = pendiente.';

COMMENT ON COLUMN public.outbox_events.event_type IS
  'Tipo de evento, p.ej. recalc_question_difficulty. Determina qué handler lo procesa.';

COMMENT ON COLUMN public.outbox_events.payload IS
  'Datos del evento en JSON. Schema concreto depende del event_type.';

COMMENT ON COLUMN public.outbox_events.processed_at IS
  'NULL = pendiente. Timestamp = procesado correctamente.';

COMMENT ON COLUMN public.outbox_events.attempts IS
  'Número de intentos de procesamiento. Se incrementa en cada fallo.';

-- Índice parcial: el worker sólo lee filas pendientes. Aunque la tabla acumule
-- millones de filas procesadas, este índice sólo contiene las pendientes.
-- Es la clave del rendimiento a escala.
CREATE INDEX IF NOT EXISTS outbox_events_pending_idx
  ON public.outbox_events (created_at)
  WHERE processed_at IS NULL;

-- Índice secundario para diagnóstico/admin (filtrar por tipo de evento).
CREATE INDEX IF NOT EXISTS outbox_events_type_idx
  ON public.outbox_events (event_type, created_at DESC);

-- ============================================================================
-- RLS: tabla interna, ningún cliente la consulta directamente. SELECT/INSERT/
-- UPDATE pasa por código server-side con DATABASE_URL (rol postgres). Cerramos
-- a anon/authenticated para defensa en profundidad.
-- ============================================================================

ALTER TABLE public.outbox_events ENABLE ROW LEVEL SECURITY;

-- Sin policies → cualquier consulta con rol anon/authenticated devuelve 0 filas.
-- El rol postgres / service_role bypassa RLS, que es lo que usa el código server.

REVOKE ALL ON public.outbox_events FROM anon, authenticated;
