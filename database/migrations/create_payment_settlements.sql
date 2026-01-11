-- Tabla de liquidaciones de pagos entre socios
-- Manuel (90%) - Armando (10%) sobre el NETO después de fees de Stripe

CREATE TABLE IF NOT EXISTS payment_settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Datos del pago de Stripe
  stripe_payment_intent_id TEXT UNIQUE, -- pi_xxx
  stripe_charge_id TEXT,                 -- ch_xxx
  stripe_invoice_id TEXT,                -- in_xxx
  stripe_customer_id TEXT,               -- cus_xxx

  -- Usuario que pagó
  user_id UUID REFERENCES user_profiles(id),
  user_email TEXT,

  -- Montos
  amount_gross INTEGER NOT NULL,         -- Bruto en céntimos (5900 = 59€)
  stripe_fee INTEGER NOT NULL,           -- Fee de Stripe en céntimos
  amount_net INTEGER NOT NULL,           -- Neto en céntimos (después de Stripe)
  currency TEXT DEFAULT 'eur',

  -- Reparto (sobre el NETO)
  manuel_amount INTEGER NOT NULL,        -- 90% del neto
  armando_amount INTEGER NOT NULL,       -- 10% del neto

  -- Estado de liquidación
  armando_marked_paid BOOLEAN DEFAULT FALSE,      -- Armando marcó que pagó a Manuel
  armando_marked_paid_at TIMESTAMPTZ,
  manuel_confirmed_received BOOLEAN DEFAULT FALSE, -- Manuel confirmó que recibió
  manuel_confirmed_at TIMESTAMPTZ,

  -- Liquidación agrupada (para pagos en lote)
  settlement_batch_id UUID,              -- Si se liquida en grupo

  -- Notas
  notes TEXT,

  -- Timestamps
  payment_date TIMESTAMPTZ NOT NULL,     -- Fecha del pago en Stripe
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_payment_settlements_user ON payment_settlements(user_id);
CREATE INDEX idx_payment_settlements_pending ON payment_settlements(manuel_confirmed_received) WHERE manuel_confirmed_received = FALSE;
CREATE INDEX idx_payment_settlements_date ON payment_settlements(payment_date DESC);
CREATE INDEX idx_payment_settlements_batch ON payment_settlements(settlement_batch_id) WHERE settlement_batch_id IS NOT NULL;

-- Tabla de lotes de liquidación (opcional, para agrupar pagos)
CREATE TABLE IF NOT EXISTS settlement_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Totales del lote
  total_gross INTEGER NOT NULL,          -- Total bruto
  total_net INTEGER NOT NULL,            -- Total neto
  total_manuel INTEGER NOT NULL,         -- Total para Manuel
  total_armando INTEGER NOT NULL,        -- Total para Armando
  payments_count INTEGER NOT NULL,       -- Número de pagos incluidos

  -- Estado
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'confirmed')),

  -- Fechas
  period_start DATE,                     -- Inicio del período
  period_end DATE,                       -- Fin del período
  armando_paid_at TIMESTAMPTZ,
  manuel_confirmed_at TIMESTAMPTZ,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vista resumen de pendientes
CREATE OR REPLACE VIEW settlement_summary AS
SELECT
  COUNT(*) as total_payments,
  COUNT(*) FILTER (WHERE manuel_confirmed_received = FALSE) as pending_payments,
  COALESCE(SUM(amount_net), 0) as total_net,
  COALESCE(SUM(manuel_amount), 0) as total_manuel,
  COALESCE(SUM(armando_amount), 0) as total_armando,
  COALESCE(SUM(manuel_amount) FILTER (WHERE manuel_confirmed_received = FALSE), 0) as pending_manuel,
  COALESCE(SUM(armando_amount) FILTER (WHERE manuel_confirmed_received = FALSE), 0) as pending_armando
FROM payment_settlements;

-- Comentarios
COMMENT ON TABLE payment_settlements IS 'Registro de pagos para liquidación entre socios (Manuel 90%, Armando 10%)';
COMMENT ON COLUMN payment_settlements.amount_gross IS 'Monto bruto en céntimos (5900 = 59€)';
COMMENT ON COLUMN payment_settlements.amount_net IS 'Monto neto después de fees de Stripe';
COMMENT ON COLUMN payment_settlements.manuel_amount IS '90% del neto - lo que Armando debe pagar a Manuel';
COMMENT ON COLUMN payment_settlements.armando_amount IS '10% del neto - lo que Armando se queda';
