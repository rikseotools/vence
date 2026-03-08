-- Migración: Añadir tracking de IA en disputas
-- Permite vincular disputas auto-creadas por IA con el chat log que las generó
-- y medir la precisión de la IA (aceptadas vs rechazadas)

-- 1. Añadir columnas a question_disputes
ALTER TABLE question_disputes
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS ai_chat_log_id uuid REFERENCES ai_chat_logs(id) ON DELETE SET NULL;

-- Constraint para source
ALTER TABLE question_disputes
  DROP CONSTRAINT IF EXISTS question_disputes_source_check;
ALTER TABLE question_disputes
  ADD CONSTRAINT question_disputes_source_check
  CHECK (source = ANY (ARRAY['user'::text, 'ai_auto'::text]));

-- 2. Añadir columnas a psychometric_question_disputes
ALTER TABLE psychometric_question_disputes
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS ai_chat_log_id uuid REFERENCES ai_chat_logs(id) ON DELETE SET NULL;

ALTER TABLE psychometric_question_disputes
  DROP CONSTRAINT IF EXISTS psychometric_question_disputes_source_check;
ALTER TABLE psychometric_question_disputes
  ADD CONSTRAINT psychometric_question_disputes_source_check
  CHECK (source = ANY (ARRAY['user'::text, 'ai_auto'::text]));

-- 3. Índice para consultar disputas por fuente (stats de precisión IA)
CREATE INDEX IF NOT EXISTS idx_question_disputes_source
  ON question_disputes(source) WHERE source = 'ai_auto';

CREATE INDEX IF NOT EXISTS idx_psychometric_disputes_source
  ON psychometric_question_disputes(source) WHERE source = 'ai_auto';

-- 4. Marcar disputas existentes que fueron creadas por IA (retroactivo)
UPDATE question_disputes
  SET source = 'ai_auto'
  WHERE description LIKE '%[AUTO-DETECTADO POR IA]%'
    AND source = 'user';

UPDATE psychometric_question_disputes
  SET source = 'ai_auto'
  WHERE description LIKE '%[AUTO-DETECTADO POR IA]%'
    AND source = 'user';
