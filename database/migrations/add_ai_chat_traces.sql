-- Migración: Sistema de Trazabilidad AI Chat
-- Descripción: Crea tabla ai_chat_traces para observabilidad completa del sistema AI
-- Fecha: 2026-02-09

-- =============================================================================
-- TABLA: ai_chat_traces
-- Almacena trazas detalladas de cada paso del procesamiento AI
-- Cada interacción (log) puede tener múltiples spans (trazas)
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_chat_traces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relación con el log principal
  log_id UUID REFERENCES ai_chat_logs(id) ON DELETE CASCADE,

  -- Tipo de trace
  -- 'routing': Decisión de qué dominio usar
  -- 'domain': Procesamiento del dominio seleccionado
  -- 'llm_call': Llamada a OpenAI/Claude
  -- 'db_query': Consulta a base de datos
  -- 'post_process': Post-procesamiento (verificación discrepancias, etc)
  -- 'error': Error capturado
  trace_type TEXT NOT NULL,

  -- Timing
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- Contenido flexible en JSONB
  -- input_data: Lo que entró a este paso
  input_data JSONB DEFAULT '{}',

  -- output_data: Lo que salió de este paso
  output_data JSONB DEFAULT '{}',

  -- metadata: Información adicional (modelo usado, tokens, confidence, etc)
  metadata JSONB DEFAULT '{}',

  -- Resultado del span
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  error_stack TEXT,

  -- Orden dentro del trace (1, 2, 3...)
  sequence_number INTEGER NOT NULL,

  -- Para traces anidados (ej: un llm_call dentro de un domain)
  parent_trace_id UUID REFERENCES ai_chat_traces(id) ON DELETE CASCADE,

  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- ÍNDICES
-- =============================================================================

-- Buscar traces por log_id (el más común)
CREATE INDEX idx_ai_chat_traces_log_id
  ON ai_chat_traces(log_id);

-- Filtrar por tipo de trace
CREATE INDEX idx_ai_chat_traces_type
  ON ai_chat_traces(trace_type);

-- Ordenar por fecha (para lista reciente)
CREATE INDEX idx_ai_chat_traces_created
  ON ai_chat_traces(created_at DESC);

-- Buscar traces con errores
CREATE INDEX idx_ai_chat_traces_errors
  ON ai_chat_traces(success)
  WHERE success = false;

-- Buscar por parent (para traces anidados)
CREATE INDEX idx_ai_chat_traces_parent
  ON ai_chat_traces(parent_trace_id)
  WHERE parent_trace_id IS NOT NULL;

-- Índice GIN para búsquedas en metadata (modelo, dominio, etc)
CREATE INDEX idx_ai_chat_traces_metadata
  ON ai_chat_traces USING GIN (metadata);

-- =============================================================================
-- CONSTRAINTS
-- =============================================================================

-- Validar tipos de trace permitidos
ALTER TABLE ai_chat_traces
  ADD CONSTRAINT ai_chat_traces_type_check
  CHECK (trace_type IN ('routing', 'domain', 'llm_call', 'db_query', 'post_process', 'error'));

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE ai_chat_traces ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden ver traces
CREATE POLICY "Admins can view ai_chat_traces"
  ON ai_chat_traces
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (
        email LIKE '%@vencemitfg.es'
        OR email IN ('admin@example.com')
      )
    )
  );

-- Service role puede insertar (desde el backend)
CREATE POLICY "Service can insert ai_chat_traces"
  ON ai_chat_traces
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =============================================================================
-- COMENTARIOS
-- =============================================================================

COMMENT ON TABLE ai_chat_traces IS 'Trazas detalladas del procesamiento AI Chat para observabilidad';
COMMENT ON COLUMN ai_chat_traces.log_id IS 'Referencia al log principal en ai_chat_logs';
COMMENT ON COLUMN ai_chat_traces.trace_type IS 'Tipo: routing, domain, llm_call, db_query, post_process, error';
COMMENT ON COLUMN ai_chat_traces.input_data IS 'Datos de entrada al paso (JSONB)';
COMMENT ON COLUMN ai_chat_traces.output_data IS 'Datos de salida del paso (JSONB)';
COMMENT ON COLUMN ai_chat_traces.metadata IS 'Metadata adicional: modelo, tokens, confidence, etc';
COMMENT ON COLUMN ai_chat_traces.sequence_number IS 'Orden secuencial dentro del trace (1, 2, 3...)';
COMMENT ON COLUMN ai_chat_traces.parent_trace_id IS 'Para traces anidados (ej: llm_call dentro de domain)';

-- =============================================================================
-- FUNCIÓN: Calcular duración automáticamente
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_trace_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
    NEW.duration_ms := EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at)) * 1000;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_trace_duration
  BEFORE INSERT OR UPDATE ON ai_chat_traces
  FOR EACH ROW
  EXECUTE FUNCTION calculate_trace_duration();

-- =============================================================================
-- VISTA: Resumen de traces por log
-- =============================================================================

CREATE OR REPLACE VIEW ai_chat_traces_summary AS
SELECT
  l.id AS log_id,
  l.message,
  l.created_at,
  l.feedback,
  l.had_error,
  l.had_discrepancy,
  COUNT(t.id) AS trace_count,
  SUM(t.duration_ms) AS total_duration_ms,
  ARRAY_AGG(DISTINCT t.trace_type ORDER BY t.trace_type) AS trace_types,
  COUNT(*) FILTER (WHERE t.success = false) AS error_count,
  MAX(t.metadata->>'model') AS model_used,
  SUM((t.metadata->>'tokens_in')::int) AS total_tokens_in,
  SUM((t.metadata->>'tokens_out')::int) AS total_tokens_out
FROM ai_chat_logs l
LEFT JOIN ai_chat_traces t ON t.log_id = l.id
GROUP BY l.id, l.message, l.created_at, l.feedback, l.had_error, l.had_discrepancy
ORDER BY l.created_at DESC;

COMMENT ON VIEW ai_chat_traces_summary IS 'Vista resumen de logs con métricas de traces';
