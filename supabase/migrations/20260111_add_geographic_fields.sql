-- Migración: Añadir campos geográficos a convocatorias_boe
-- Fecha: 2026-01-11

-- Añadir columnas geográficas
ALTER TABLE convocatorias_boe
ADD COLUMN IF NOT EXISTS ambito TEXT,
ADD COLUMN IF NOT EXISTS comunidad_autonoma TEXT,
ADD COLUMN IF NOT EXISTS provincia TEXT,
ADD COLUMN IF NOT EXISTS municipio TEXT;

-- Añadir constraint para ambito
ALTER TABLE convocatorias_boe
ADD CONSTRAINT convocatorias_boe_ambito_check
CHECK (ambito IS NULL OR ambito IN ('estatal', 'autonomico', 'local'));

-- Crear índices para filtros geográficos
CREATE INDEX IF NOT EXISTS idx_convocatorias_boe_ambito
ON convocatorias_boe(ambito);

CREATE INDEX IF NOT EXISTS idx_convocatorias_boe_ccaa
ON convocatorias_boe(comunidad_autonoma);

CREATE INDEX IF NOT EXISTS idx_convocatorias_boe_provincia
ON convocatorias_boe(provincia);

-- Comentarios
COMMENT ON COLUMN convocatorias_boe.ambito IS 'Ámbito territorial: estatal, autonomico, local';
COMMENT ON COLUMN convocatorias_boe.comunidad_autonoma IS 'Comunidad Autónoma (ej: Andalucía, Madrid)';
COMMENT ON COLUMN convocatorias_boe.provincia IS 'Provincia (ej: Almería, Barcelona)';
COMMENT ON COLUMN convocatorias_boe.municipio IS 'Municipio/Ayuntamiento (ej: Níjar, Alcorcón)';
