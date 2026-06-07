-- Reflejar reembolsos y chargebacks en payment_settlements.
--
-- Origen 07/06/2026 (incidente cobro duplicado Lidia): una clienta hizo doble
-- checkout y pagó €20 dos veces. Al reembolsar uno de los cargos se descubrió
-- que el webhook de Stripe NO escucha `charge.refunded` ni
-- `charge.dispute.created`, así que un reembolso quedaba INVISIBLE para la BD:
-- la settlement seguía contando el importe completo (ingresos/MRR inflados y la
-- comisión de Armando repartiendo dinero ya devuelto). La fila de Lidia se tuvo
-- que corregir a mano.
--
-- Modelo de datos elegido (idempotente + auditable):
--   * `amount_gross` y `stripe_fee` quedan INMUTABLES = base histórica del cargo.
--   * `refunded_amount` = total reembolsado al cliente (acumulado, en céntimos).
--   * `amount_net` / `manuel_amount` / `armando_amount` pasan a ser el "neto
--     ADEUDADO tras reembolsos", recalculado desde la base inmutable cada vez
--     que llega un `charge.refunded` (ver lib/stripe-settlement-helpers.ts).
--     Así TODAS las queries de ingresos/payout existentes (SUM de esas
--     columnas) siguen siendo correctas sin tocarlas.
--   * `disputed_at` / `dispute_status` registran chargebacks (visibilidad +
--     plazo de respuesta); el ajuste de dinero de un dispute perdido se hará
--     cuando el dispute se cierre como `lost` (futuro).
--
-- Columnas nullable / DEFAULT 0: additivas, no afectan a filas ni código
-- existentes. IF NOT EXISTS: idempotente.

ALTER TABLE public.payment_settlements
  ADD COLUMN IF NOT EXISTS refunded_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_reason text,
  ADD COLUMN IF NOT EXISTS disputed_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_status text;

COMMENT ON COLUMN public.payment_settlements.refunded_amount IS
  'Total reembolsado al cliente en céntimos (acumulado). 0 = sin reembolso. amount_net/manuel/armando se recalculan desde amount_gross-stripe_fee descontando esto. Añadido 07/06/2026.';
COMMENT ON COLUMN public.payment_settlements.refunded_at IS
  'Fecha del último charge.refunded procesado para esta settlement.';
COMMENT ON COLUMN public.payment_settlements.refund_reason IS
  'Motivo del reembolso (Stripe refund.reason: duplicate/fraudulent/requested_by_customer, o nota manual).';
COMMENT ON COLUMN public.payment_settlements.disputed_at IS
  'Fecha de apertura de un chargeback (charge.dispute.created).';
COMMENT ON COLUMN public.payment_settlements.dispute_status IS
  'Estado del chargeback de Stripe (needs_response/under_review/won/lost).';
