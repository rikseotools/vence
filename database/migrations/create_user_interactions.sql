-- Migración: Crear tabla user_interactions para tracking de interacciones de usuario
-- Fecha: 2026-01-15
-- Propósito: Trackear clicks, acciones y eventos de usuario para analytics y debugging

-- ============================================
-- CREAR TABLA PRINCIPAL
-- ============================================

CREATE TABLE IF NOT EXISTS user_interactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID,

  -- Información del evento
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL,
  component TEXT,
  action TEXT,
  label TEXT,
  value JSONB DEFAULT '{}',

  -- Contexto de la página
  page_url TEXT,
  element_id TEXT,
  element_text TEXT,

  -- Métricas
  response_time_ms INTEGER,

  -- Información del dispositivo
  device_info JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ÍNDICES PARA QUERIES EFICIENTES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_user_interactions_user_id
  ON user_interactions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_interactions_event_type
  ON user_interactions(event_type);

CREATE INDEX IF NOT EXISTS idx_user_interactions_category
  ON user_interactions(event_category);

CREATE INDEX IF NOT EXISTS idx_user_interactions_created_at
  ON user_interactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_interactions_component
  ON user_interactions(component);

CREATE INDEX IF NOT EXISTS idx_user_interactions_session
  ON user_interactions(session_id);

-- Índice compuesto para queries de admin frecuentes
CREATE INDEX IF NOT EXISTS idx_user_interactions_user_category_date
  ON user_interactions(user_id, event_category, created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;

-- Usuarios pueden ver sus propias interacciones
CREATE POLICY "Users can view own interactions"
  ON user_interactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Usuarios pueden insertar sus propias interacciones (o anónimas)
CREATE POLICY "Users can insert own interactions"
  ON user_interactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Admins pueden ver todas las interacciones
CREATE POLICY "Admins can view all interactions"
  ON user_interactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (plan_type = 'admin' OR email = 'ilovetestpro@gmail.com')
    )
  );

-- Service role puede hacer todo
CREATE POLICY "Service role full access"
  ON user_interactions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- CONSTRAINTS
-- ============================================

-- Validar categorías permitidas
ALTER TABLE user_interactions
  ADD CONSTRAINT user_interactions_category_check
  CHECK (event_category IN ('test', 'chat', 'navigation', 'ui', 'auth', 'error', 'conversion', 'psychometric'));

-- ============================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- ============================================

COMMENT ON TABLE user_interactions IS 'Tracking de interacciones de usuario para analytics, debugging y A/B testing';
COMMENT ON COLUMN user_interactions.event_type IS 'Tipo específico de evento (ej: test_answer_selected, chat_opened)';
COMMENT ON COLUMN user_interactions.event_category IS 'Categoría del evento (test, chat, navigation, ui, auth, error, conversion)';
COMMENT ON COLUMN user_interactions.component IS 'Componente React donde ocurrió el evento';
COMMENT ON COLUMN user_interactions.action IS 'Acción específica realizada';
COMMENT ON COLUMN user_interactions.value IS 'Datos adicionales del evento en formato JSON';
COMMENT ON COLUMN user_interactions.session_id IS 'ID de sesión para agrupar eventos de la misma visita';
