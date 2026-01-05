-- Migración: Añadir campos de derogación a la tabla laws
-- Fecha: 2026-01-05
-- Descripción: Permite registrar qué leyes están derogadas, por qué norma y cuándo

ALTER TABLE laws
ADD COLUMN IF NOT EXISTS is_derogated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS derogated_by TEXT,
ADD COLUMN IF NOT EXISTS derogated_at DATE;

-- Comentarios para documentación
COMMENT ON COLUMN laws.is_derogated IS 'Indica si la ley/norma ha sido derogada';
COMMENT ON COLUMN laws.derogated_by IS 'Nombre de la norma que la derogó (ej: Ley 39/2015)';
COMMENT ON COLUMN laws.derogated_at IS 'Fecha en que entró en vigor la derogación';

-- Índice para consultas rápidas de leyes activas vs derogadas
CREATE INDEX IF NOT EXISTS idx_laws_is_derogated ON laws(is_derogated);
