-- Migration: Sistema de detección de fraudes
-- Fecha: 2026-01-09
-- Descripción: Tabla de alertas de fraude y funciones RPC para detección

-- ============================================
-- TABLA: fraud_alerts
-- ============================================
CREATE TABLE IF NOT EXISTS fraud_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL, -- 'same_ip', 'same_device', 'multi_account', 'suspicious_premium', 'location_anomaly'
  severity TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  status TEXT NOT NULL DEFAULT 'new', -- 'new', 'reviewed', 'dismissed', 'action_taken'
  user_ids UUID[] NOT NULL,
  details JSONB DEFAULT '{}',
  match_criteria TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_status ON fraud_alerts(status);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_type ON fraud_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_severity ON fraud_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_detected ON fraud_alerts(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_user_ids ON fraud_alerts USING GIN(user_ids);

-- ============================================
-- FUNCIÓN: detect_same_ip_fraud
-- Detecta usuarios que comparten la misma IP
-- ============================================
CREATE OR REPLACE FUNCTION detect_same_ip_fraud()
RETURNS TABLE (
  ip_address TEXT,
  user_ids UUID[],
  emails TEXT[],
  names TEXT[],
  user_count BIGINT,
  has_premium BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH user_ips AS (
    SELECT DISTINCT ON (us.user_id, us.ip_address)
      us.user_id,
      us.ip_address,
      up.email,
      up.full_name,
      up.plan_type
    FROM user_sessions us
    JOIN user_profiles up ON us.user_id = up.id
    WHERE us.ip_address IS NOT NULL
      AND us.created_at > NOW() - INTERVAL '30 days'
  ),
  grouped_ips AS (
    SELECT
      ui.ip_address,
      ARRAY_AGG(DISTINCT ui.user_id) AS user_ids,
      ARRAY_AGG(DISTINCT ui.email) AS emails,
      ARRAY_AGG(DISTINCT ui.full_name) FILTER (WHERE ui.full_name IS NOT NULL) AS names,
      COUNT(DISTINCT ui.user_id) AS user_count,
      BOOL_OR(ui.plan_type IN ('premium', 'premium_monthly', 'premium_semester', 'premium_annual')) AS has_premium
    FROM user_ips ui
    GROUP BY ui.ip_address
    HAVING COUNT(DISTINCT ui.user_id) >= 2
  )
  SELECT * FROM grouped_ips
  ORDER BY has_premium DESC, user_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCIÓN: detect_same_device_fraud
-- Detecta usuarios que comparten el mismo dispositivo
-- ============================================
CREATE OR REPLACE FUNCTION detect_same_device_fraud()
RETURNS TABLE (
  device_fingerprint TEXT,
  user_ids UUID[],
  emails TEXT[],
  names TEXT[],
  user_count BIGINT,
  has_premium BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH user_devices AS (
    SELECT DISTINCT ON (us.user_id, us.user_agent)
      us.user_id,
      us.user_agent AS device_fingerprint,
      up.email,
      up.full_name,
      up.plan_type
    FROM user_sessions us
    JOIN user_profiles up ON us.user_id = up.id
    WHERE us.user_agent IS NOT NULL
      AND LENGTH(us.user_agent) > 20  -- Filtrar user agents muy cortos
      AND us.created_at > NOW() - INTERVAL '30 days'
  ),
  grouped_devices AS (
    SELECT
      ud.device_fingerprint,
      ARRAY_AGG(DISTINCT ud.user_id) AS user_ids,
      ARRAY_AGG(DISTINCT ud.email) AS emails,
      ARRAY_AGG(DISTINCT ud.full_name) FILTER (WHERE ud.full_name IS NOT NULL) AS names,
      COUNT(DISTINCT ud.user_id) AS user_count,
      BOOL_OR(ud.plan_type IN ('premium', 'premium_monthly', 'premium_semester', 'premium_annual')) AS has_premium
    FROM user_devices ud
    GROUP BY ud.device_fingerprint
    HAVING COUNT(DISTINCT ud.user_id) >= 2
  )
  SELECT * FROM grouped_devices
  ORDER BY has_premium DESC, user_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCIÓN: detect_multi_account_fraud
-- Detecta usuarios con mismo nombre + dispositivo/IP
-- ============================================
CREATE OR REPLACE FUNCTION detect_multi_account_fraud()
RETURNS TABLE (
  user_ids UUID[],
  emails TEXT[],
  names TEXT[],
  ips TEXT[],
  devices TEXT[],
  user_count BIGINT,
  has_premium BOOLEAN,
  match_criteria TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH user_data AS (
    SELECT DISTINCT
      up.id AS user_id,
      up.email,
      LOWER(TRIM(up.full_name)) AS normalized_name,
      up.full_name,
      up.plan_type,
      us.ip_address,
      us.user_agent
    FROM user_profiles up
    JOIN user_sessions us ON up.id = us.user_id
    WHERE up.full_name IS NOT NULL
      AND LENGTH(TRIM(up.full_name)) > 3
      AND us.created_at > NOW() - INTERVAL '30 days'
  ),
  -- Usuarios con mismo nombre y dispositivo
  same_name_device AS (
    SELECT
      ud1.normalized_name,
      ud1.user_agent,
      ARRAY_AGG(DISTINCT ud1.user_id) AS user_ids,
      ARRAY_AGG(DISTINCT ud1.email) AS emails,
      ARRAY_AGG(DISTINCT ud1.full_name) AS names,
      ARRAY_AGG(DISTINCT ud1.ip_address) FILTER (WHERE ud1.ip_address IS NOT NULL) AS ips,
      ARRAY[ud1.user_agent] AS devices,
      COUNT(DISTINCT ud1.user_id) AS user_count,
      BOOL_OR(ud1.plan_type IN ('premium', 'premium_monthly', 'premium_semester', 'premium_annual')) AS has_premium,
      'name+device' AS match_criteria
    FROM user_data ud1
    WHERE ud1.user_agent IS NOT NULL
    GROUP BY ud1.normalized_name, ud1.user_agent
    HAVING COUNT(DISTINCT ud1.user_id) >= 2
  ),
  -- Usuarios con mismo nombre e IP
  same_name_ip AS (
    SELECT
      ud1.normalized_name,
      ud1.ip_address,
      ARRAY_AGG(DISTINCT ud1.user_id) AS user_ids,
      ARRAY_AGG(DISTINCT ud1.email) AS emails,
      ARRAY_AGG(DISTINCT ud1.full_name) AS names,
      ARRAY[ud1.ip_address] AS ips,
      ARRAY_AGG(DISTINCT ud1.user_agent) FILTER (WHERE ud1.user_agent IS NOT NULL) AS devices,
      COUNT(DISTINCT ud1.user_id) AS user_count,
      BOOL_OR(ud1.plan_type IN ('premium', 'premium_monthly', 'premium_semester', 'premium_annual')) AS has_premium,
      'name+ip' AS match_criteria
    FROM user_data ud1
    WHERE ud1.ip_address IS NOT NULL
    GROUP BY ud1.normalized_name, ud1.ip_address
    HAVING COUNT(DISTINCT ud1.user_id) >= 2
  )
  SELECT
    snd.user_ids,
    snd.emails,
    snd.names,
    snd.ips,
    snd.devices,
    snd.user_count,
    snd.has_premium,
    snd.match_criteria
  FROM same_name_device snd
  UNION
  SELECT
    sni.user_ids,
    sni.emails,
    sni.names,
    sni.ips,
    sni.devices,
    sni.user_count,
    sni.has_premium,
    sni.match_criteria
  FROM same_name_ip sni
  ORDER BY has_premium DESC, user_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCIÓN: detect_suspicious_premium
-- Detecta premium con múltiples ubicaciones
-- ============================================
CREATE OR REPLACE FUNCTION detect_suspicious_premium()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  name TEXT,
  locations TEXT[],
  location_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH premium_sessions AS (
    SELECT
      up.id AS user_id,
      up.email,
      up.full_name AS name,
      us.city,
      us.region,
      us.country_code
    FROM user_profiles up
    JOIN user_sessions us ON up.id = us.user_id
    WHERE up.plan_type IN ('premium', 'premium_monthly', 'premium_semester', 'premium_annual')
      AND us.city IS NOT NULL
      AND us.created_at > NOW() - INTERVAL '30 days'
  ),
  location_counts AS (
    SELECT
      ps.user_id,
      ps.email,
      ps.name,
      ARRAY_AGG(DISTINCT CONCAT(ps.city, ', ', COALESCE(ps.region, ''), ' (', ps.country_code, ')')) AS locations,
      COUNT(DISTINCT CONCAT(ps.city, ps.country_code)) AS location_count
    FROM premium_sessions ps
    GROUP BY ps.user_id, ps.email, ps.name
    HAVING COUNT(DISTINCT CONCAT(ps.city, ps.country_code)) >= 3
  )
  SELECT * FROM location_counts
  ORDER BY location_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- GRANTS para service role
-- ============================================
GRANT EXECUTE ON FUNCTION detect_same_ip_fraud() TO service_role;
GRANT EXECUTE ON FUNCTION detect_same_device_fraud() TO service_role;
GRANT EXECUTE ON FUNCTION detect_multi_account_fraud() TO service_role;
GRANT EXECUTE ON FUNCTION detect_suspicious_premium() TO service_role;

GRANT ALL ON fraud_alerts TO service_role;

-- Comentarios
COMMENT ON TABLE fraud_alerts IS 'Alertas de posible fraude: multi-cuentas, IPs compartidas, dispositivos duplicados';
COMMENT ON FUNCTION detect_same_ip_fraud() IS 'Detecta usuarios que comparten la misma IP';
COMMENT ON FUNCTION detect_same_device_fraud() IS 'Detecta usuarios que comparten el mismo dispositivo';
COMMENT ON FUNCTION detect_multi_account_fraud() IS 'Detecta usuarios con mismo nombre + dispositivo/IP';
COMMENT ON FUNCTION detect_suspicious_premium() IS 'Detecta premium con múltiples ubicaciones sospechosas';
