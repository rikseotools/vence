-- Tabla simple para trackear envíos a Manuel basados en payouts de Stripe
-- Fecha: 2026-01-12

CREATE TABLE IF NOT EXISTS payout_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Referencia al payout de Stripe
  stripe_payout_id TEXT UNIQUE NOT NULL,  -- po_xxx
  payout_date TIMESTAMPTZ NOT NULL,

  -- Montos (en céntimos)
  payout_amount INTEGER NOT NULL,          -- Lo que Armando recibió en banco
  payout_fee INTEGER DEFAULT 0,            -- Fee del payout (si hubo)
  manuel_amount INTEGER NOT NULL,          -- 90% para Manuel
  armando_amount INTEGER NOT NULL,         -- 10% para Armando

  -- Estado del envío a Manuel
  sent_to_manuel BOOLEAN DEFAULT FALSE,
  sent_date TIMESTAMPTZ,

  -- Confirmación de Manuel
  manuel_confirmed BOOLEAN DEFAULT FALSE,
  manuel_confirmed_date TIMESTAMPTZ,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_payout_transfers_date ON payout_transfers(payout_date DESC);
CREATE INDEX idx_payout_transfers_sent ON payout_transfers(sent_to_manuel);

-- Comentarios
COMMENT ON TABLE payout_transfers IS 'Registro de payouts de Stripe y envíos correspondientes a Manuel (90%)';
COMMENT ON COLUMN payout_transfers.payout_amount IS 'Cantidad neta recibida en banco (después de fee de payout)';
COMMENT ON COLUMN payout_transfers.manuel_amount IS '90% del payout_amount';
COMMENT ON COLUMN payout_transfers.armando_amount IS '10% del payout_amount';
