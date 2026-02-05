-- Añadir campos para trackear discrepancias y re-análisis en el chat AI
-- Esto permite analizar cuándo el modelo inicial da respuestas diferentes a la BD

-- Campos para trackear discrepancias en psicotécnicos
ALTER TABLE ai_chat_logs
ADD COLUMN IF NOT EXISTS had_discrepancy BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_suggested_answer TEXT,
ADD COLUMN IF NOT EXISTS db_answer TEXT,
ADD COLUMN IF NOT EXISTS reanalysis_response TEXT;

-- Índice para encontrar rápidamente las discrepancias
CREATE INDEX IF NOT EXISTS idx_ai_chat_logs_discrepancy
ON ai_chat_logs(had_discrepancy)
WHERE had_discrepancy = true;

-- Comentarios explicativos
COMMENT ON COLUMN ai_chat_logs.had_discrepancy IS 'Si el modelo inicial sugirió una respuesta diferente a la de BD';
COMMENT ON COLUMN ai_chat_logs.ai_suggested_answer IS 'La opción (A/B/C/D) que sugirió el modelo inicial';
COMMENT ON COLUMN ai_chat_logs.db_answer IS 'La opción correcta según la base de datos';
COMMENT ON COLUMN ai_chat_logs.reanalysis_response IS 'La respuesta del modelo superior (gpt-4o) en el re-análisis';

-- Vista para analytics de discrepancias
CREATE OR REPLACE VIEW admin_ai_discrepancy_analytics AS
SELECT
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) FILTER (WHERE had_discrepancy = true) as total_discrepancies,
  COUNT(*) FILTER (WHERE question_context_id IS NOT NULL) as total_psico_chats,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE had_discrepancy = true) /
    NULLIF(COUNT(*) FILTER (WHERE question_context_id IS NOT NULL), 0),
    2
  ) as discrepancy_rate_percent
FROM ai_chat_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

COMMENT ON VIEW admin_ai_discrepancy_analytics IS 'Vista para analizar la tasa de discrepancias del chat AI';
