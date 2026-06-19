-- 20260619_conversion_outbox_skipped_status.sql
-- Añade el estado terminal 'skipped' a conversion_outbox.
--
-- Contexto (incidente 19/06): el worker trataba CUALQUIER `!res.ok` (incluido
-- `no_identifier` — venta sin click-ID de Google, NO atribuible) como fallo
-- REINTENTABLE → reintentos infinitos → DLQ → alerta `conversion_delivery_failed`
-- en bucle. Los veredictos TERMINALES (no_identifier, datos inválidos, config
-- ausente) no se arreglan reintentando: ahora se marcan 'skipped' (terminal, no
-- reintento, no cuenta como failed). Additiva: amplía el CHECK, no toca filas.
ALTER TABLE public.conversion_outbox
  DROP CONSTRAINT IF EXISTS conversion_outbox_status_check;

ALTER TABLE public.conversion_outbox
  ADD CONSTRAINT conversion_outbox_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'delivered'::text, 'failed'::text, 'skipped'::text]));
