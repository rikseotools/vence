-- ============================================================
-- TABLA USER_DEVICES
-- Registra dispositivos por usuario para limitar multi-dispositivo
-- Todos: max 2 dispositivos (ordenador + móvil)
-- Dispositivos inactivos 30+ días se liberan automáticamente
-- ============================================================

CREATE TABLE IF NOT EXISTS user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_label TEXT, -- auto-generated from user_agent (e.g. "Chrome / Windows")
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  CONSTRAINT unique_user_device UNIQUE(user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_device_id ON user_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_last_seen ON user_devices(last_seen_at);

ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own devices" ON user_devices
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- FUNCTION: register_device
-- Registers a device for a user. Returns whether the device is allowed.
-- Evicts devices inactive for 30+ days before checking limits.
-- ============================================================

CREATE OR REPLACE FUNCTION register_device(
  p_user_id UUID,
  p_device_id TEXT,
  p_device_label TEXT DEFAULT NULL
)
RETURNS TABLE(
  out_allowed BOOLEAN,
  out_device_count INTEGER,
  out_max_devices INTEGER,
  out_is_new_device BOOLEAN,
  out_is_premium BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan_type TEXT;
  v_is_premium BOOLEAN;
  v_max INTEGER;
  v_existing_id UUID;
  v_current_count INTEGER;
  v_is_new BOOLEAN := FALSE;
BEGIN
  -- Evict stale devices (30+ days inactive)
  DELETE FROM user_devices
  WHERE user_id = p_user_id
    AND last_seen_at < NOW() - INTERVAL '30 days';

  -- Check plan type
  SELECT up.plan_type INTO v_plan_type
  FROM user_profiles up
  WHERE up.id = p_user_id;

  v_is_premium := COALESCE(v_plan_type, 'free') IN ('premium', 'trial', 'legacy_free', 'premium_semester', 'admin');
  v_max := 2; -- max 2 dispositivos para todos (ordenador + móvil)

  -- Check if device already registered for this user
  SELECT ud.id INTO v_existing_id
  FROM user_devices ud
  WHERE ud.user_id = p_user_id AND ud.device_id = p_device_id;

  IF v_existing_id IS NOT NULL THEN
    -- Known device: update last_seen
    UPDATE user_devices SET last_seen_at = NOW(), device_label = COALESCE(p_device_label, device_label)
    WHERE id = v_existing_id;

    SELECT COUNT(*) INTO v_current_count FROM user_devices WHERE user_id = p_user_id;

    RETURN QUERY SELECT TRUE, v_current_count, v_max, FALSE, v_is_premium;
    RETURN;
  END IF;

  -- New device: check count
  SELECT COUNT(*) INTO v_current_count FROM user_devices WHERE user_id = p_user_id;

  IF v_current_count >= v_max THEN
    -- Over limit
    RETURN QUERY SELECT
      FALSE, -- bloquear para todos cuando se supera el límite
      v_current_count,
      v_max,
      TRUE,
      v_is_premium;
    RETURN;
  END IF;

  -- Under limit: register new device
  INSERT INTO user_devices (user_id, device_id, device_label)
  VALUES (p_user_id, p_device_id, p_device_label);

  v_current_count := v_current_count + 1;
  v_is_new := TRUE;

  RETURN QUERY SELECT TRUE, v_current_count, v_max, v_is_new, v_is_premium;
END;
$$;


-- ============================================================
-- FUNCTION: get_accounts_on_device
-- Returns all user_ids that have used a given device_id.
-- Used to enforce shared daily limit across accounts on same device.
-- ============================================================

CREATE OR REPLACE FUNCTION get_accounts_on_device(p_device_id TEXT)
RETURNS TABLE(user_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT ud.user_id
  FROM user_devices ud
  WHERE ud.device_id = p_device_id
    AND ud.last_seen_at > NOW() - INTERVAL '30 days';
$$;
