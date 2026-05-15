-- Añade columnas para tracking de modelo usado en cada interacción del chat AI.
-- Permite calcular métricas por modelo (% satisfacción, latencia, etc.) en /admin/ai.
--
-- - model_provider: 'openai' | 'anthropic' (futuro: 'google', etc.)
-- - model_id: identificador concreto ('gpt-4o', 'claude-sonnet-4-6', etc.)
--
-- Logs históricos (antes de esta migración) quedan NULL: las stats por modelo
-- solo cuentan logs nuevos.

ALTER TABLE ai_chat_logs
  ADD COLUMN IF NOT EXISTS model_provider text,
  ADD COLUMN IF NOT EXISTS model_id text;

CREATE INDEX IF NOT EXISTS idx_ai_chat_logs_model_provider
  ON ai_chat_logs (model_provider)
  WHERE model_provider IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_chat_logs_model_id
  ON ai_chat_logs (model_id)
  WHERE model_id IS NOT NULL;

COMMENT ON COLUMN ai_chat_logs.model_provider IS 'Proveedor del modelo LLM usado: openai, anthropic, etc.';
COMMENT ON COLUMN ai_chat_logs.model_id IS 'ID concreto del modelo (gpt-4o, claude-sonnet-4-6, etc.)';
