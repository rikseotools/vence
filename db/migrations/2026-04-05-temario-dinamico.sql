-- Migración: Temario dinámico desde BD (elimina hardcoding de page.tsx)
-- Fuente única de verdad: BD. Resuelve 243 mismatches title page.tsx ↔ BD.
-- Creado: 2026-04-05

-- ============================================
-- 1. NUEVA TABLA: oposicion_bloques
-- ============================================
-- Agrupa temas en bloques con título + icono por oposición.
-- Customizable por oposición (32 bloques únicos, 11 iconos distintos).

CREATE TABLE IF NOT EXISTS oposicion_bloques (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  position_type TEXT NOT NULL,
  bloque_number INT NOT NULL,
  titulo TEXT NOT NULL,
  icon TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT oposicion_bloques_unique UNIQUE (position_type, bloque_number)
);

CREATE INDEX IF NOT EXISTS oposicion_bloques_position_type_idx
  ON oposicion_bloques (position_type);

-- RLS: lectura pública (temario es SEO público)
ALTER TABLE oposicion_bloques ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bloques legibles por todos" ON oposicion_bloques FOR SELECT USING (true);

-- ============================================
-- 2. AMPLIAR tabla topics con campos UI
-- ============================================

ALTER TABLE topics ADD COLUMN IF NOT EXISTS bloque_number INT;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS display_number INT;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS disponible BOOLEAN DEFAULT true;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS descripcion_corta TEXT;

CREATE INDEX IF NOT EXISTS topics_bloque_number_idx
  ON topics (position_type, bloque_number, topic_number);

-- ============================================
-- 3. COMENTARIOS documentación
-- ============================================

COMMENT ON TABLE oposicion_bloques IS
  'Bloques temáticos de cada oposición (Bloque I, II, III...). Usado por el listado del temario.';

COMMENT ON COLUMN topics.bloque_number IS
  'Número del bloque al que pertenece el tema (FK lógica a oposicion_bloques.bloque_number).';

COMMENT ON COLUMN topics.display_number IS
  'Número que se muestra al usuario. Útil cuando topic_number usa rangos (ej: T103 display 3).';

COMMENT ON COLUMN topics.disponible IS
  'Si false, el tema aparece como "En elaboración" y no es clickable.';

COMMENT ON COLUMN topics.descripcion_corta IS
  'Descripción pedagógica breve (1-2 líneas) para el listado del temario. topics.description es más larga.';
