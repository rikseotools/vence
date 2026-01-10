-- Migration: Sistema de tracking de fraude con device_id
-- Fecha: 2026-01-10

-- 1. Tabla para usuarios bajo vigilancia automática
CREATE TABLE IF NOT EXISTS fraud_watch_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL, -- 'same_ip', 'same_device_vpn', 'manual'
  detection_details JSONB, -- Detalles de la detección (IP, fingerprint, etc.)
  suspicion_score INTEGER DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_fraud BOOLEAN DEFAULT FALSE,
  confirmed_at TIMESTAMPTZ,
  confirmed_device_id TEXT, -- device_id que confirma el fraude
  related_users UUID[], -- Otros usuarios del mismo grupo sospechoso
  notes TEXT,

  UNIQUE(user_id) -- Un usuario solo puede estar una vez en la lista
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_fraud_watch_user_id ON fraud_watch_list(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_watch_confirmed ON fraud_watch_list(confirmed_fraud);
CREATE INDEX IF NOT EXISTS idx_fraud_watch_added_at ON fraud_watch_list(added_at DESC);

-- 2. Añadir campo device_id a user_sessions (si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_sessions' AND column_name = 'device_id'
  ) THEN
    ALTER TABLE user_sessions ADD COLUMN device_id TEXT;
    CREATE INDEX idx_sessions_device_id ON user_sessions(device_id);
  END IF;
END $$;

-- 3. Tabla para confirmar fraudes (cuando 2+ usuarios comparten device_id)
CREATE TABLE IF NOT EXISTS fraud_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  user_ids UUID[] NOT NULL, -- Usuarios que comparten este device_id
  first_detected_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  session_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'dismissed', 'action_taken')),
  action_taken TEXT,
  action_taken_at TIMESTAMPTZ,
  action_taken_by UUID REFERENCES auth.users(id),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_fraud_confirmations_device_id ON fraud_confirmations(device_id);
CREATE INDEX IF NOT EXISTS idx_fraud_confirmations_status ON fraud_confirmations(status);

-- 4. RLS Policies
ALTER TABLE fraud_watch_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_confirmations ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden ver/modificar
CREATE POLICY "Admins can manage fraud_watch_list" ON fraud_watch_list
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage fraud_confirmations" ON fraud_confirmations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- El usuario puede ver si está en la lista (para el tracking)
CREATE POLICY "Users can check own watch status" ON fraud_watch_list
  FOR SELECT USING (user_id = auth.uid());

-- 5. Función para verificar si un usuario está siendo vigilado
CREATE OR REPLACE FUNCTION is_user_watched(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM fraud_watch_list
    WHERE user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Función para detectar fraudes confirmados por device_id
CREATE OR REPLACE FUNCTION check_device_id_fraud(p_device_id TEXT)
RETURNS TABLE(user_ids UUID[], is_fraud BOOLEAN) AS $$
DECLARE
  v_user_ids UUID[];
BEGIN
  -- Obtener todos los usuarios que han usado este device_id
  SELECT ARRAY_AGG(DISTINCT user_id) INTO v_user_ids
  FROM user_sessions
  WHERE device_id = p_device_id
  AND user_id IS NOT NULL;

  -- Es fraude si hay más de 1 usuario
  RETURN QUERY SELECT v_user_ids, (array_length(v_user_ids, 1) > 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE fraud_watch_list IS 'Usuarios bajo vigilancia automática por sospecha de multi-cuenta';
COMMENT ON TABLE fraud_confirmations IS 'Fraudes confirmados cuando múltiples usuarios comparten device_id';
