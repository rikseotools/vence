-- Añadir columna discarded a ai_verification_results
-- Para persistir cuando un resultado de verificación es un falso positivo

ALTER TABLE ai_verification_results
ADD COLUMN IF NOT EXISTS discarded boolean DEFAULT false;

ALTER TABLE ai_verification_results
ADD COLUMN IF NOT EXISTS discarded_at timestamptz;

-- Crear índice para filtrar eficientemente
CREATE INDEX IF NOT EXISTS idx_ai_verification_pending
ON ai_verification_results (is_correct, fix_applied, discarded)
WHERE is_correct = false AND (fix_applied IS NULL OR fix_applied = false) AND (discarded IS NULL OR discarded = false);

-- Comentarios
COMMENT ON COLUMN ai_verification_results.discarded IS 'Marcado como falso positivo (IA se equivocó)';
COMMENT ON COLUMN ai_verification_results.discarded_at IS 'Fecha en que se marcó como falso positivo';
