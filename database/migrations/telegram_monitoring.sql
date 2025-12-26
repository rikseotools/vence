-- Migración: Sistema de Monitorización de Telegram
-- Fecha: 2025-12-26

-- Configuración de sesión Telegram (encriptada)
CREATE TABLE IF NOT EXISTS telegram_session (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_string TEXT NOT NULL,  -- Sesión encriptada de gramjs
  phone_number TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)  -- Solo una sesión por usuario admin
);

-- Grupos monitorizados
CREATE TABLE IF NOT EXISTS telegram_groups (
  id BIGINT PRIMARY KEY,  -- ID de Telegram (puede ser negativo para grupos)
  title TEXT NOT NULL,
  username TEXT,  -- @username del grupo si es público
  member_count INT,
  is_monitoring BOOLEAN DEFAULT true,
  keywords TEXT[] DEFAULT ARRAY['test', 'vence', 'oposiciones', 'auxiliar'],
  added_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alertas/menciones detectadas
CREATE TABLE IF NOT EXISTS telegram_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id BIGINT REFERENCES telegram_groups(id) ON DELETE CASCADE,
  message_id BIGINT NOT NULL,
  message_text TEXT NOT NULL,
  sender_id BIGINT,
  sender_name TEXT,
  sender_username TEXT,
  matched_keywords TEXT[] NOT NULL,
  is_read BOOLEAN DEFAULT false,
  is_replied BOOLEAN DEFAULT false,
  reply_text TEXT,
  replied_at TIMESTAMPTZ,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, message_id)  -- Evitar duplicados
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_telegram_alerts_unread
  ON telegram_alerts(is_read) WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_telegram_alerts_detected
  ON telegram_alerts(detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_telegram_alerts_group
  ON telegram_alerts(group_id);

CREATE INDEX IF NOT EXISTS idx_telegram_groups_monitoring
  ON telegram_groups(is_monitoring) WHERE is_monitoring = true;

-- RLS Policies (solo admins pueden acceder)
ALTER TABLE telegram_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_alerts ENABLE ROW LEVEL SECURITY;

-- Política: Solo el admin dueño puede ver/modificar su sesión
CREATE POLICY "Admin can manage own session" ON telegram_session
  FOR ALL USING (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Política: Solo admins pueden gestionar grupos
CREATE POLICY "Admins can manage telegram groups" ON telegram_groups
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Política: Solo admins pueden ver/gestionar alertas
CREATE POLICY "Admins can manage telegram alerts" ON telegram_alerts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_telegram_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
DROP TRIGGER IF EXISTS telegram_session_updated_at ON telegram_session;
CREATE TRIGGER telegram_session_updated_at
  BEFORE UPDATE ON telegram_session
  FOR EACH ROW EXECUTE FUNCTION update_telegram_updated_at();

DROP TRIGGER IF EXISTS telegram_groups_updated_at ON telegram_groups;
CREATE TRIGGER telegram_groups_updated_at
  BEFORE UPDATE ON telegram_groups
  FOR EACH ROW EXECUTE FUNCTION update_telegram_updated_at();

-- Comentarios de documentación
COMMENT ON TABLE telegram_session IS 'Almacena sesiones de Telegram encriptadas para monitorización';
COMMENT ON TABLE telegram_groups IS 'Grupos de Telegram que se están monitorizando';
COMMENT ON TABLE telegram_alerts IS 'Alertas detectadas cuando se mencionan keywords en grupos';
COMMENT ON COLUMN telegram_session.session_string IS 'Sesión de gramjs encriptada con AES-256';
COMMENT ON COLUMN telegram_alerts.matched_keywords IS 'Keywords que dispararon esta alerta';
