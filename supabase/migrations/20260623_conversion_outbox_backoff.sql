-- 20260623_conversion_outbox_backoff.sql
-- Backoff exponencial + deadline por edad para la entrega de conversiones.
--
-- Contexto (incidente 19-23/06): oauth2.googleapis.com devolvía "Premature close"
-- de forma intermitente y a veces SOSTENIDA (horas/días) desde el egress de
-- producción. El worker daba por muerta (DLQ 'failed') cualquier fila tras 5
-- reintentos consecutivos → se perdía atribución de ventas REALES (idempotentes
-- por order_id y aún dentro de la ventana de ~90d de Google) de forma permanente.
--
-- Fix: un fallo REINTENTABLE (red/OAuth/5xx) ya NO produce estado terminal por
-- agotar un cap de intentos; se reintenta con backoff exponencial (2→4→…→30 min)
-- hasta una DEADLINE por EDAD (72h). Solo al superar la deadline pasa a 'failed'
-- (DLQ real = requiere intervención humana). El veredicto TERMINAL de datos
-- (no_identifier, partial_failure) sigue marcándose 'skipped' al instante.
--
-- `next_attempt_at`: momento en que la fila es elegible para el siguiente intento.
-- NULL = elegible ya (filas nuevas insertadas por recordConversion y legacy).
-- Additiva: no toca filas existentes ni constraints.
ALTER TABLE public.conversion_outbox
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;

-- Índice de elegibilidad: pendientes "due" para reintento, ordenables FIFO por
-- alta. NULLS FIRST porque NULL = elegible inmediatamente.
CREATE INDEX IF NOT EXISTS idx_conversion_outbox_due
  ON public.conversion_outbox (next_attempt_at NULLS FIRST, created_at)
  WHERE status = 'pending';
