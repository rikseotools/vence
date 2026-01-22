-- Tabla para almacenar feedback de cancelaciones y refunds
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS cancellation_feedback (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subscription_id TEXT, -- ID de suscripción de Stripe

  -- Tipo de cancelación
  cancellation_type TEXT DEFAULT 'self_service', -- 'self_service' (app), 'manual_refund' (soporte), 'admin'

  -- Respuestas del formulario (para self_service)
  reason TEXT NOT NULL, -- Motivo principal
  reason_details TEXT, -- Comentario adicional (opcional)
  alternative TEXT, -- Cómo seguirá preparándose (puede ser NULL si aprobó/no se presenta)
  contacted_support BOOLEAN DEFAULT false,

  -- Metadata del plan
  plan_type TEXT, -- Plan que tenía (premium_monthly, premium_semester)
  period_end_at TIMESTAMP WITH TIME ZONE, -- Cuándo termina el acceso

  -- Datos para refunds manuales
  user_email TEXT, -- Guardamos email por si se borra el usuario
  stripe_customer_id TEXT,
  stripe_charge_id TEXT,
  stripe_refund_id TEXT,
  refund_amount_cents INTEGER, -- Monto devuelto en centavos (5900 = 59€)

  -- Trazabilidad
  requested_via TEXT DEFAULT 'app', -- 'app', 'support_chat', 'email', 'phone'
  admin_notes TEXT, -- Notas internas del admin
  processed_by TEXT, -- Quién procesó el refund

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para consultas
CREATE INDEX IF NOT EXISTS idx_cancellation_feedback_user_id ON cancellation_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_feedback_reason ON cancellation_feedback(reason);
CREATE INDEX IF NOT EXISTS idx_cancellation_feedback_created_at ON cancellation_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cancellation_feedback_type ON cancellation_feedback(cancellation_type);
CREATE INDEX IF NOT EXISTS idx_cancellation_feedback_email ON cancellation_feedback(user_email);

-- RLS Policies
ALTER TABLE cancellation_feedback ENABLE ROW LEVEL SECURITY;

-- Solo el service role puede insertar (desde la API)
CREATE POLICY "Service can insert cancellation feedback" ON cancellation_feedback
  FOR INSERT TO public
  WITH CHECK (true);

-- Solo admins pueden ver el feedback
CREATE POLICY "Admins can view cancellation feedback" ON cancellation_feedback
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.email IN (
        'manuelrivas@hey.com',
        'admin@vence.es'
      )
    )
  );

-- Comentarios para documentación
COMMENT ON TABLE cancellation_feedback IS 'Almacena cancelaciones (desde app) y refunds manuales (soporte)';
COMMENT ON COLUMN cancellation_feedback.cancellation_type IS 'Tipo: self_service (app), manual_refund (soporte), admin';
COMMENT ON COLUMN cancellation_feedback.reason IS 'Motivo: approved, not_presenting, too_expensive, prefer_other, missing_features, no_progress, hard_to_use, customer_request, other';
COMMENT ON COLUMN cancellation_feedback.alternative IS 'Alternativa: academy_presential, academy_online, books, other_app, self_study, stop_preparing, other';
COMMENT ON COLUMN cancellation_feedback.requested_via IS 'Canal: app, support_chat, email, phone';
