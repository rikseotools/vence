-- Tabla para guardar errores de verificación con IA
-- Útil para debugging y análisis de fallos

CREATE TABLE IF NOT EXISTS ai_verification_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  law_id UUID REFERENCES laws(id),
  article_number TEXT,
  provider TEXT NOT NULL, -- 'openai', 'anthropic', 'google'
  model TEXT,
  prompt TEXT, -- El prompt enviado (puede ser largo)
  raw_response TEXT, -- La respuesta cruda (truncada o errónea)
  error_message TEXT NOT NULL,
  error_type TEXT, -- 'json_parse', 'timeout', 'http_error', 'token_limit', 'api_error'
  questions_count INT, -- Número de preguntas que se intentaron verificar
  tokens_used JSONB, -- { input_tokens, output_tokens } si está disponible
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas comunes
CREATE INDEX IF NOT EXISTS idx_ai_verification_errors_law_id ON ai_verification_errors(law_id);
CREATE INDEX IF NOT EXISTS idx_ai_verification_errors_created_at ON ai_verification_errors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_verification_errors_error_type ON ai_verification_errors(error_type);
CREATE INDEX IF NOT EXISTS idx_ai_verification_errors_provider ON ai_verification_errors(provider);

-- Comentarios
COMMENT ON TABLE ai_verification_errors IS 'Registro de errores durante verificación de preguntas con IA';
COMMENT ON COLUMN ai_verification_errors.raw_response IS 'Respuesta cruda del modelo, útil para debug de JSON truncado';
COMMENT ON COLUMN ai_verification_errors.error_type IS 'Tipo de error: json_parse, timeout, http_error, token_limit, api_error';
