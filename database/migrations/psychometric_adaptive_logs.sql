-- =====================================================
-- TABLA PARA LOGS DE DECISIONES ADAPTATIVAS PSICOTÉCNICAS
-- =====================================================

-- Crear tabla psychometric_adaptive_logs
CREATE TABLE IF NOT EXISTS psychometric_adaptive_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,
  decision_type TEXT NOT NULL CHECK (decision_type IN ('question_selection', 'difficulty_adjustment', 'performance_analysis')),
  decision_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (session_id) REFERENCES psychometric_test_sessions(id) ON DELETE CASCADE
);

-- Índices para psychometric_adaptive_logs
CREATE INDEX IF NOT EXISTS idx_psychometric_adaptive_logs_session ON psychometric_adaptive_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_psychometric_adaptive_logs_type ON psychometric_adaptive_logs(decision_type);
CREATE INDEX IF NOT EXISTS idx_psychometric_adaptive_logs_created ON psychometric_adaptive_logs(created_at);

-- Enable RLS
ALTER TABLE psychometric_adaptive_logs ENABLE ROW LEVEL SECURITY;

-- Policy para permitir acceso del sistema
CREATE POLICY "System can manage adaptive logs" ON psychometric_adaptive_logs
  FOR ALL USING (true);

-- Comentarios
COMMENT ON TABLE psychometric_adaptive_logs IS 'Log de decisiones del sistema de selección adaptativa psicotécnica';
COMMENT ON COLUMN psychometric_adaptive_logs.decision_type IS 'Tipo de decisión: question_selection, difficulty_adjustment, performance_analysis';
COMMENT ON COLUMN psychometric_adaptive_logs.decision_data IS 'Datos de la decisión en formato JSON';

-- Verificación
SELECT 'Tabla psychometric_adaptive_logs creada correctamente.' as status;