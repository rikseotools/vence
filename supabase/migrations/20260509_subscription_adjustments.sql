-- Migration: subscription_adjustments — audit trail de ajustes admin sobre suscripciones
-- 2026-05-09
--
-- Contexto: hasta ahora no había forma profesional de registrar compensaciones,
-- créditos o reembolsos manuales aplicados por admin a un usuario. Stripe es
-- source of truth para el estado de la suscripción (trial_end, balance, etc.),
-- pero no conoce el contexto admin: quién aplicó la acción, por qué, qué
-- feedback la motivó. Esta tabla cierra ese gap como audit trail.
--
-- Use cases:
--   - Compensación por incidente (trial_end push +N días)
--   - Crédito por reclamación (customer balance)
--   - Reembolso manual de cargo
--   - Cupón aplicado manualmente
--
-- Lectura: el endpoint /api/stripe/subscription extiende su timeline para
-- mostrar estos eventos en /perfil del usuario afectado.
--
-- Idempotente.

CREATE TABLE IF NOT EXISTS public.subscription_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  stripe_subscription_id text NOT NULL,

  -- Qué se hizo
  adjustment_type text NOT NULL CHECK (adjustment_type IN (
    'time_extension',   -- trial_end push (días gratis)
    'credit',           -- customer balance negativo
    'refund',           -- charge refund parcial/total
    'discount'          -- coupon aplicado a la sub
  )),
  amount_value numeric(10, 2) NOT NULL CHECK (amount_value > 0),
  amount_unit text NOT NULL CHECK (amount_unit IN ('days', 'eur', 'percent')),

  -- Por qué (auditoría)
  reason_code text NOT NULL CHECK (reason_code IN (
    'incident_compensation',  -- bug/incidente técnico afectó al usuario
    'goodwill',               -- gesto comercial (sin causa específica)
    'churn_prevention',       -- evitar baja
    'support_resolution',     -- resolución de soporte
    'manual_admin'            -- otro motivo administrativo
  )),
  reason_detail text,                                          -- texto libre (ej. "Cascade pool 9 may")
  related_feedback_id uuid REFERENCES public.user_feedback(id) ON DELETE SET NULL,

  -- Quién y cuándo
  applied_by_user_id uuid NOT NULL REFERENCES public.user_profiles(id),
  stripe_event_id text,                                        -- ID del evento en Stripe (auditoría cruzada)

  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para lookups habituales
CREATE INDEX IF NOT EXISTS idx_subscription_adjustments_user_created
  ON public.subscription_adjustments (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscription_adjustments_feedback
  ON public.subscription_adjustments (related_feedback_id)
  WHERE related_feedback_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_adjustments_sub
  ON public.subscription_adjustments (stripe_subscription_id, created_at DESC);

-- RLS: solo service_role lee/escribe. Los user_profiles ven sus adjustments
-- vía endpoint /api/stripe/subscription que ya valida ownership.
ALTER TABLE public.subscription_adjustments ENABLE ROW LEVEL SECURITY;

-- Comentario tabla
COMMENT ON TABLE public.subscription_adjustments IS
  'Audit trail de ajustes admin sobre suscripciones (compensaciones, créditos, reembolsos, descuentos). Stripe = source of truth para estado; esta tabla = contexto admin (quién, por qué, qué feedback). Lectura via /api/stripe/subscription timeline.';
