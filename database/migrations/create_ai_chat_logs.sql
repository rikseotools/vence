-- Tabla para loguear interacciones del chat de IA
-- Permite analizar qué preguntan los usuarios y mejorar el sistema

CREATE TABLE IF NOT EXISTS ai_chat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Usuario (nullable para anónimos)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Mensaje del usuario
  message TEXT NOT NULL,

  -- Preview de la respuesta (primeros 500 chars)
  response_preview TEXT,

  -- Respuesta completa (para análisis detallado)
  full_response TEXT,

  -- Fuentes/artículos usados en la respuesta
  sources_used JSONB DEFAULT '[]'::jsonb,

  -- Contexto de pregunta (si estaba viendo una pregunta del test)
  question_context_id UUID,
  question_context_law TEXT,

  -- Si usó una sugerencia predefinida
  suggestion_used TEXT,

  -- Métricas de rendimiento
  response_time_ms INTEGER,
  tokens_used INTEGER,

  -- Estado
  had_error BOOLEAN DEFAULT false,
  error_message TEXT,

  -- Metadata adicional
  user_oposicion TEXT,
  detected_laws JSONB DEFAULT '[]'::jsonb,

  -- Feedback del usuario
  feedback TEXT CHECK (feedback IN ('positive', 'negative')),
  feedback_comment TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas frecuentes
CREATE INDEX idx_ai_chat_logs_user_id ON ai_chat_logs(user_id);
CREATE INDEX idx_ai_chat_logs_created_at ON ai_chat_logs(created_at DESC);
CREATE INDEX idx_ai_chat_logs_question_context_law ON ai_chat_logs(question_context_law);
CREATE INDEX idx_ai_chat_logs_had_error ON ai_chat_logs(had_error);

-- Índice GIN para búsqueda en sources_used y detected_laws
CREATE INDEX idx_ai_chat_logs_sources ON ai_chat_logs USING GIN(sources_used);
CREATE INDEX idx_ai_chat_logs_detected_laws ON ai_chat_logs USING GIN(detected_laws);

-- RLS: Los usuarios solo pueden ver sus propios logs
ALTER TABLE ai_chat_logs ENABLE ROW LEVEL SECURITY;

-- Política para insertar (cualquier usuario autenticado o anónimo puede insertar)
CREATE POLICY "Anyone can insert chat logs" ON ai_chat_logs
  FOR INSERT WITH CHECK (true);

-- Política para leer (solo admins pueden leer todos, usuarios sus propios logs)
CREATE POLICY "Users can read own chat logs" ON ai_chat_logs
  FOR SELECT USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Vista para analytics de admin
CREATE OR REPLACE VIEW admin_ai_chat_analytics AS
SELECT
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as total_chats,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(*) FILTER (WHERE had_error) as errors,
  AVG(response_time_ms) as avg_response_time_ms,
  COUNT(*) FILTER (WHERE suggestion_used IS NOT NULL) as suggestion_clicks,
  COUNT(*) FILTER (WHERE question_context_id IS NOT NULL) as chats_with_question_context
FROM ai_chat_logs
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- Vista para ver las preguntas más frecuentes (agrupadas por similitud)
CREATE OR REPLACE VIEW ai_chat_popular_questions AS
SELECT
  message,
  COUNT(*) as times_asked,
  COUNT(DISTINCT user_id) as unique_users,
  MAX(created_at) as last_asked
FROM ai_chat_logs
WHERE had_error = false
GROUP BY message
ORDER BY times_asked DESC
LIMIT 100;

-- Vista para ver leyes más consultadas
CREATE OR REPLACE VIEW ai_chat_popular_laws AS
SELECT
  law_elem as law_name,
  COUNT(*) as times_mentioned
FROM ai_chat_logs,
  jsonb_array_elements_text(detected_laws) as law_elem
GROUP BY law_elem
ORDER BY times_mentioned DESC;

COMMENT ON TABLE ai_chat_logs IS 'Logs de interacciones del chat de IA para análisis y mejora del sistema';
