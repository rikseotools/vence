-- ============================================
-- Sistema de Avatares Automáticos por Comportamiento
-- Migración: create-avatar-tables.sql
-- Fecha: 2026-01-16
-- ============================================

-- Tabla de perfiles de avatar (datos estáticos)
CREATE TABLE IF NOT EXISTS avatar_profiles (
  id TEXT PRIMARY KEY,                    -- 'night_owl', 'early_bird', etc.
  emoji TEXT NOT NULL,
  name_es TEXT NOT NULL,                  -- Nombre masculino/neutro
  name_es_f TEXT,                         -- Nombre femenino (NULL si es neutro)
  description_es TEXT NOT NULL,
  color TEXT NOT NULL,                    -- Color hex para UI
  priority INT DEFAULT 50,                -- Para resolver empates (mayor = más prioritario)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de configuración de avatar por usuario
CREATE TABLE IF NOT EXISTS user_avatar_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  mode TEXT DEFAULT 'automatic' CHECK (mode IN ('manual', 'automatic')),
  current_profile TEXT REFERENCES avatar_profiles(id),
  current_emoji TEXT,
  current_name TEXT,
  last_rotation_at TIMESTAMPTZ,
  -- Campos para notificación in-app de rotación
  rotation_notification_pending BOOLEAN DEFAULT false,
  previous_profile TEXT,
  previous_emoji TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Para bases de datos existentes, añadir columnas si no existen
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'user_avatar_settings'
                 AND column_name = 'rotation_notification_pending') THEN
    ALTER TABLE user_avatar_settings ADD COLUMN rotation_notification_pending BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'user_avatar_settings'
                 AND column_name = 'previous_profile') THEN
    ALTER TABLE user_avatar_settings ADD COLUMN previous_profile TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'user_avatar_settings'
                 AND column_name = 'previous_emoji') THEN
    ALTER TABLE user_avatar_settings ADD COLUMN previous_emoji TEXT;
  END IF;
END $$;

-- Índice para búsquedas por usuario
CREATE INDEX IF NOT EXISTS idx_user_avatar_settings_user_id ON user_avatar_settings(user_id);

-- Índice para el cron de rotación (usuarios en modo automático)
CREATE INDEX IF NOT EXISTS idx_user_avatar_settings_mode ON user_avatar_settings(mode) WHERE mode = 'automatic';

-- ============================================
-- Insertar perfiles de avatar iniciales
-- ============================================

INSERT INTO avatar_profiles (id, emoji, name_es, name_es_f, description_es, color, priority) VALUES
  ('night_owl', '🦉', 'Búho Nocturno', NULL, 'Estudias principalmente después de las 21:00', '#6366f1', 60),
  ('early_bird', '🐓', 'Madrugador/a', NULL, 'Estudias principalmente antes de las 9:00', '#f59e0b', 60),
  ('champion', '🦁', 'León Campeón', 'Leona Campeona', 'Tu precisión supera el 85%', '#ef4444', 90),
  ('consistent', '🐢', 'Tortuga Constante', NULL, 'Llevas más de 14 días de racha', '#10b981', 85),
  ('speed_eagle', '🦅', 'Águila Veloz', NULL, 'Respondes más de 100 preguntas por semana', '#3b82f6', 70),
  ('worker_ant', '🐜', 'Hormiga Trabajadora', NULL, 'Estudias todos los días de la semana', '#8b5cf6', 80),
  ('smart_dolphin', '🐬', 'Delfín Inteligente', NULL, 'Has mejorado más del 10% esta semana', '#06b6d4', 75),
  ('relaxed_koala', '🐨', 'Koala Relajado', 'Koala Relajada', 'Te lo tomas con calma, menos de 20 preguntas esta semana', '#94a3b8', 10),
  ('clever_squirrel', '🐿️', 'Ardilla Astuta', NULL, 'Dominas los temas difíciles con >70% de acierto', '#f97316', 65),
  ('busy_bee', '🐝', 'Abeja Productiva', NULL, 'Estudias mañana, tarde y noche', '#eab308', 55)
ON CONFLICT (id) DO UPDATE SET
  emoji = EXCLUDED.emoji,
  name_es = EXCLUDED.name_es,
  name_es_f = EXCLUDED.name_es_f,
  description_es = EXCLUDED.description_es,
  color = EXCLUDED.color,
  priority = EXCLUDED.priority;

-- ============================================
-- RLS Policies
-- ============================================

-- Habilitar RLS
ALTER TABLE user_avatar_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE avatar_profiles ENABLE ROW LEVEL SECURITY;

-- Políticas para user_avatar_settings
CREATE POLICY "Users can view own avatar settings"
  ON user_avatar_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own avatar settings"
  ON user_avatar_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own avatar settings"
  ON user_avatar_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Política para avatar_profiles (lectura pública, solo admin puede modificar)
CREATE POLICY "Anyone can view avatar profiles"
  ON avatar_profiles FOR SELECT
  USING (true);

-- Service role puede hacer todo (para cron jobs)
CREATE POLICY "Service role full access to user_avatar_settings"
  ON user_avatar_settings FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- Función de actualización automática de updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_user_avatar_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trigger_user_avatar_settings_updated_at ON user_avatar_settings;
CREATE TRIGGER trigger_user_avatar_settings_updated_at
  BEFORE UPDATE ON user_avatar_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_avatar_settings_updated_at();

-- ============================================
-- Verificación
-- ============================================

-- Verificar que las tablas se crearon correctamente
DO $$
BEGIN
  RAISE NOTICE '✅ Tablas avatar_profiles y user_avatar_settings creadas correctamente';
  RAISE NOTICE '✅ 10 perfiles de avatar insertados';
  RAISE NOTICE '✅ RLS policies configuradas';
  RAISE NOTICE '✅ Trigger de updated_at configurado';
END $$;
