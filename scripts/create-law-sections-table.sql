-- scripts/create-law-sections-table.sql
-- Crear tabla law_sections para estructura jerárquica de leyes

CREATE TABLE IF NOT EXISTS law_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  law_id UUID NOT NULL REFERENCES laws(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL, -- 'titulo', 'capitulo', 'seccion'
  section_number TEXT NOT NULL, -- 'I', 'II', 'preliminar', '1', '2'
  title TEXT NOT NULL,
  description TEXT,
  article_range_start INTEGER,
  article_range_end INTEGER,
  slug TEXT UNIQUE NOT NULL, -- para URLs amigables
  order_position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_law_sections_law_id ON law_sections(law_id);
CREATE INDEX IF NOT EXISTS idx_law_sections_section_type ON law_sections(section_type);
CREATE INDEX IF NOT EXISTS idx_law_sections_order ON law_sections(order_position);
CREATE INDEX IF NOT EXISTS idx_law_sections_slug ON law_sections(slug);
CREATE INDEX IF NOT EXISTS idx_law_sections_active ON law_sections(is_active);

-- Crear trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_law_sections_updated_at 
  BEFORE UPDATE ON law_sections 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Comentarios para documentación
COMMENT ON TABLE law_sections IS 'Estructura jerárquica de títulos, capítulos y secciones de las leyes';
COMMENT ON COLUMN law_sections.section_type IS 'Tipo de sección: titulo, capitulo, seccion';
COMMENT ON COLUMN law_sections.section_number IS 'Número/identificador de la sección (I, II, preliminar, etc.)';
COMMENT ON COLUMN law_sections.slug IS 'URL amigable para la sección';
COMMENT ON COLUMN law_sections.order_position IS 'Orden de aparición en la ley';
COMMENT ON COLUMN law_sections.article_range_start IS 'Primer artículo incluido en esta sección';
COMMENT ON COLUMN law_sections.article_range_end IS 'Último artículo incluido en esta sección';

-- Restricciones adicionales
ALTER TABLE law_sections 
  ADD CONSTRAINT check_article_range 
  CHECK (article_range_start IS NULL OR article_range_end IS NULL OR article_range_start <= article_range_end);

ALTER TABLE law_sections 
  ADD CONSTRAINT check_section_type 
  CHECK (section_type IN ('titulo', 'capitulo', 'seccion', 'libro', 'parte', 'anexo'));

-- Política RLS (Row Level Security) - opcional
-- ALTER TABLE law_sections ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "law_sections_read_policy" ON law_sections FOR SELECT USING (true);