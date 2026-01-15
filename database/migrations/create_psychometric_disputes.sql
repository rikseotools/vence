-- Crear tabla para disputas de preguntas psicotécnicas
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS psychometric_question_disputes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES psychometric_questions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  dispute_type TEXT NOT NULL CHECK (dispute_type IN ('ai_detected_error', 'respuesta_incorrecta', 'otro')),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'rejected')),
  admin_response TEXT,
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_read BOOLEAN DEFAULT FALSE
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_psych_disputes_question ON psychometric_question_disputes(question_id);
CREATE INDEX IF NOT EXISTS idx_psych_disputes_user ON psychometric_question_disputes(user_id);
CREATE INDEX IF NOT EXISTS idx_psych_disputes_status ON psychometric_question_disputes(status);

-- Habilitar RLS
ALTER TABLE psychometric_question_disputes ENABLE ROW LEVEL SECURITY;

-- Política: usuarios pueden ver sus propias disputas
CREATE POLICY "Users can view own disputes" ON psychometric_question_disputes
  FOR SELECT USING (auth.uid() = user_id);

-- Política: usuarios pueden crear disputas
CREATE POLICY "Users can create disputes" ON psychometric_question_disputes
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Política: service role puede hacer todo
CREATE POLICY "Service role full access" ON psychometric_question_disputes
  FOR ALL USING (auth.role() = 'service_role');
