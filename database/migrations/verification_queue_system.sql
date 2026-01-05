-- Tabla para cola de verificación de preguntas con IA
-- Permite ejecutar verificaciones en background sin depender del navegador

CREATE TABLE IF NOT EXISTS verification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Qué verificar
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  question_ids UUID[] DEFAULT '{}', -- IDs específicos a verificar (opcional)

  -- Configuración de IA
  ai_provider TEXT NOT NULL DEFAULT 'openai',
  ai_model TEXT NOT NULL DEFAULT 'gpt-4o-mini',

  -- Estado del proceso
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),

  -- Progreso
  total_questions INTEGER DEFAULT 0,
  processed_questions INTEGER DEFAULT 0,
  successful_verifications INTEGER DEFAULT 0,
  failed_verifications INTEGER DEFAULT 0,

  -- Metadatos
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),

  -- Para evitar duplicados
  UNIQUE(topic_id, status) WHERE status IN ('pending', 'processing')
);

-- Índices para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_verification_queue_status ON verification_queue(status);
CREATE INDEX IF NOT EXISTS idx_verification_queue_pending ON verification_queue(created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_verification_queue_topic ON verification_queue(topic_id);

-- Comentarios
COMMENT ON TABLE verification_queue IS 'Cola de verificaciones de preguntas pendientes de procesar en background';
COMMENT ON COLUMN verification_queue.question_ids IS 'IDs específicos a verificar. Si vacío, se verifican todas las pendientes del tema';
COMMENT ON COLUMN verification_queue.status IS 'pending=esperando, processing=en proceso, completed=terminado, failed=error, cancelled=cancelado';
