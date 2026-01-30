-- Migración: user_test_favorites
-- Sistema de favoritos para configuraciones de test
-- Creado: 2026-01-30

-- ============================================
-- TABLA: user_test_favorites
-- ============================================
CREATE TABLE user_test_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  selected_laws JSONB NOT NULL DEFAULT '[]',
  selected_articles_by_law JSONB NOT NULL DEFAULT '{}',
  position_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT user_test_favorites_user_name_unique UNIQUE(user_id, name)
);

-- ============================================
-- ÍNDICES
-- ============================================
CREATE INDEX user_test_favorites_user_id_idx ON user_test_favorites(user_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE user_test_favorites ENABLE ROW LEVEL SECURITY;

-- Los usuarios solo pueden ver sus propios favoritos
CREATE POLICY "Users can view own favorites"
  ON user_test_favorites
  FOR SELECT
  USING (auth.uid() = user_id);

-- Los usuarios solo pueden insertar sus propios favoritos
CREATE POLICY "Users can insert own favorites"
  ON user_test_favorites
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Los usuarios solo pueden actualizar sus propios favoritos
CREATE POLICY "Users can update own favorites"
  ON user_test_favorites
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Los usuarios solo pueden eliminar sus propios favoritos
CREATE POLICY "Users can delete own favorites"
  ON user_test_favorites
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- COMENTARIOS
-- ============================================
COMMENT ON TABLE user_test_favorites IS 'Configuraciones de test favoritas guardadas por los usuarios';
COMMENT ON COLUMN user_test_favorites.name IS 'Nombre del favorito (ej: "CE Títulos I y II")';
COMMENT ON COLUMN user_test_favorites.description IS 'Descripción opcional del favorito';
COMMENT ON COLUMN user_test_favorites.selected_laws IS 'Array de law_short_names seleccionadas';
COMMENT ON COLUMN user_test_favorites.selected_articles_by_law IS 'Objeto con artículos seleccionados por ley';
COMMENT ON COLUMN user_test_favorites.position_type IS 'Tipo de oposición asociada (opcional)';
