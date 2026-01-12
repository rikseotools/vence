-- Migración para trackear TODOS los fees de Stripe correctamente
-- Fecha: 2026-01-12

-- 1. Tabla para fees de plataforma (payouts, billing fees, etc.)
-- Estos NO están ligados directamente a un pago específico
CREATE TABLE IF NOT EXISTS stripe_platform_fees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identificación de Stripe
  stripe_transaction_id TEXT UNIQUE NOT NULL,  -- txn_xxx
  stripe_source_id TEXT,                        -- po_xxx (payout), etc.

  -- Tipo de fee
  fee_type TEXT NOT NULL CHECK (fee_type IN (
    'payout_fee',       -- Comisión por transferencia a banco
    'billing_fee',      -- Billing Usage Fee (facturación)
    'refund_fee',       -- Fee por reembolso
    'dispute_fee',      -- Fee por disputa/chargeback
    'other'             -- Otros fees de plataforma
  )),

  -- Montos (en céntimos)
  amount INTEGER NOT NULL,                      -- Importe del fee (positivo)

  -- Descripción
  description TEXT,

  -- Período (para billing fees que cubren un rango)
  period_start DATE,
  period_end DATE,

  -- Timestamps
  fee_date TIMESTAMPTZ NOT NULL,               -- Fecha del fee
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_stripe_platform_fees_date ON stripe_platform_fees(fee_date DESC);
CREATE INDEX idx_stripe_platform_fees_type ON stripe_platform_fees(fee_type);

-- 2. Añadir campo para fee de payout en payment_settlements (estimado/prorrateado)
ALTER TABLE payment_settlements
ADD COLUMN IF NOT EXISTS payout_fee_estimated INTEGER DEFAULT 0;

COMMENT ON COLUMN payment_settlements.payout_fee_estimated IS 'Fee de payout estimado/prorrateado para este pago';

-- 3. Vista mejorada con TODOS los fees
CREATE OR REPLACE VIEW payment_settlements_summary AS
WITH
  -- Totales de pagos
  payments AS (
    SELECT
      COALESCE(SUM(amount_gross), 0) as total_gross,
      COALESCE(SUM(stripe_fee), 0) as total_charge_fees,
      COALESCE(SUM(payout_fee_estimated), 0) as total_payout_fees_estimated,
      COALESCE(SUM(amount_net), 0) as total_net_after_charge,
      COALESCE(SUM(manuel_amount), 0) as total_manuel,
      COALESCE(SUM(armando_amount), 0) as total_armando,
      COALESCE(SUM(manuel_amount) FILTER (WHERE manuel_confirmed_received = FALSE), 0) as pending_manuel,
      COALESCE(SUM(armando_amount) FILTER (WHERE manuel_confirmed_received = FALSE), 0) as pending_armando,
      COUNT(*) as total_payments,
      COUNT(*) FILTER (WHERE manuel_confirmed_received = FALSE) as pending_payments
    FROM payment_settlements
  ),
  -- Totales de fees de plataforma
  platform_fees AS (
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE fee_type = 'payout_fee'), 0) as total_payout_fees,
      COALESCE(SUM(amount) FILTER (WHERE fee_type = 'billing_fee'), 0) as total_billing_fees,
      COALESCE(SUM(amount), 0) as total_platform_fees
    FROM stripe_platform_fees
  )
SELECT
  p.total_gross,
  p.total_charge_fees,
  pf.total_payout_fees,
  pf.total_billing_fees,
  pf.total_platform_fees,
  (p.total_charge_fees + pf.total_platform_fees) as total_all_stripe_fees,
  (p.total_gross - p.total_charge_fees - pf.total_platform_fees) as true_net,
  p.total_manuel,
  p.total_armando,
  p.pending_manuel,
  p.pending_armando,
  p.total_payments,
  p.pending_payments
FROM payments p, platform_fees pf;

-- Comentarios
COMMENT ON TABLE stripe_platform_fees IS 'Fees de plataforma de Stripe no ligados a pagos específicos (payouts, billing, etc.)';
COMMENT ON VIEW payment_settlements_summary IS 'Resumen de liquidaciones incluyendo TODOS los fees de Stripe';
