-- Idempotencia del settlement por stripe_invoice_id (arregla duplicados de pagos).
--
-- BUG (07/07/2026, flip de altas nuevas a cuenta Nila): un alta nueva dispara DOS
-- eventos de webhook para el MISMO pago — checkout.session.completed (con
-- charge/payment_intent NULL: las sesiones de suscripción no llevan payment_intent)
-- e invoice.payment_succeeded (con charge). El único guard era
-- `unique(stripe_payment_intent_id)`, pero como NULL no colisiona en un índice único
-- de Postgres, la fila del checkout (PI NULL) y la de la factura convivían → dos filas
-- por pago. Inflaba el reporting de ventas/ingreso (~32% volumen, ~40% € en 30d),
-- pero NO era doble cobro (Stripe cobraba una vez; verificado contra la API).
--
-- Fix: idempotencia por la clave que AMBOS eventos comparten (stripe_invoice_id).
-- El código del webhook (recordPaymentSettlement) hace ahora un upsert por invoice
-- que ENRIQUECE la fila con charge/fee/net cuando llega el evento completo.
--
-- Aditivo y seguro. La limpieza conserva SIEMPRE la fila completa (con charge).

-- 1. Des-duplicar: conservar una fila por factura, prefiriendo la que tiene charge.
DELETE FROM public.payment_settlements p
USING (
  SELECT id, row_number() OVER (
           PARTITION BY stripe_invoice_id
           ORDER BY (stripe_charge_id IS NOT NULL) DESC, created_at ASC
         ) AS rn
  FROM public.payment_settlements
  WHERE stripe_invoice_id IS NOT NULL
) d
WHERE p.id = d.id AND d.rn > 1;

-- 2. Índice único PARCIAL por factura (los pagos puntuales sin factura no colisionan).
CREATE UNIQUE INDEX IF NOT EXISTS payment_settlements_stripe_invoice_id_key
  ON public.payment_settlements (stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;
