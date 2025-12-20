-- ============================================================
-- SISTEMA DE TRACKING DE CONVERSIONES
-- Trackea el funnel completo: registro -> test -> limite -> upgrade -> pago
-- ============================================================

-- 1. TABLA DE EVENTOS DE CONVERSION
-- ============================================================
CREATE TABLE IF NOT EXISTS conversion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',

  -- Para analisis temporal
  days_since_registration INTEGER DEFAULT 0,

  -- Contexto del usuario
  registration_source TEXT,
  plan_type TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indices para queries rapidas
CREATE INDEX IF NOT EXISTS idx_conversion_user_id ON conversion_events(user_id);
CREATE INDEX IF NOT EXISTS idx_conversion_event_type ON conversion_events(event_type);
CREATE INDEX IF NOT EXISTS idx_conversion_created_at ON conversion_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversion_source ON conversion_events(registration_source);

-- RLS Policies
ALTER TABLE conversion_events ENABLE ROW LEVEL SECURITY;

-- Los usuarios pueden ver sus propios eventos
CREATE POLICY "Users can view own conversion events" ON conversion_events
  FOR SELECT USING (auth.uid() = user_id);

-- Service role puede insertar (desde el servidor)
CREATE POLICY "Service can insert conversion events" ON conversion_events
  FOR INSERT WITH CHECK (true);

-- Admins pueden ver todo
CREATE POLICY "Admins can view all conversion events" ON conversion_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND plan_type = 'admin'
    )
  );


-- 2. FUNCION PARA REGISTRAR EVENTO
-- ============================================================
CREATE OR REPLACE FUNCTION track_conversion_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_event_data JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_days_since INTEGER;
  v_registration_source TEXT;
  v_plan_type TEXT;
  v_user_created_at TIMESTAMP WITH TIME ZONE;
  v_event_id UUID;
BEGIN
  -- Obtener info del usuario
  SELECT
    up.registration_source,
    up.plan_type,
    up.created_at
  INTO v_registration_source, v_plan_type, v_user_created_at
  FROM user_profiles up
  WHERE up.id = p_user_id;

  -- Calcular dias desde registro
  IF v_user_created_at IS NOT NULL THEN
    v_days_since := EXTRACT(DAY FROM (NOW() - v_user_created_at))::INTEGER;
  ELSE
    v_days_since := 0;
  END IF;

  -- Insertar evento
  INSERT INTO conversion_events (
    user_id,
    event_type,
    event_data,
    days_since_registration,
    registration_source,
    plan_type
  ) VALUES (
    p_user_id,
    p_event_type,
    p_event_data,
    v_days_since,
    v_registration_source,
    v_plan_type
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;


-- 3. VISTA PARA ANALISIS DE FUNNEL
-- ============================================================
CREATE OR REPLACE VIEW conversion_funnel_stats AS
SELECT
  registration_source,
  COUNT(DISTINCT CASE WHEN event_type = 'registration' THEN user_id END) as registrations,
  COUNT(DISTINCT CASE WHEN event_type = 'first_test_completed' THEN user_id END) as completed_first_test,
  COUNT(DISTINCT CASE WHEN event_type = 'limit_reached' THEN user_id END) as hit_limit,
  COUNT(DISTINCT CASE WHEN event_type = 'upgrade_modal_viewed' THEN user_id END) as saw_modal,
  COUNT(DISTINCT CASE WHEN event_type = 'upgrade_button_clicked' THEN user_id END) as clicked_upgrade,
  COUNT(DISTINCT CASE WHEN event_type = 'premium_page_viewed' THEN user_id END) as visited_premium,
  COUNT(DISTINCT CASE WHEN event_type = 'checkout_started' THEN user_id END) as started_checkout,
  COUNT(DISTINCT CASE WHEN event_type = 'payment_completed' THEN user_id END) as paid,
  ROUND(
    100.0 * COUNT(DISTINCT CASE WHEN event_type = 'payment_completed' THEN user_id END) /
    NULLIF(COUNT(DISTINCT CASE WHEN event_type = 'registration' THEN user_id END), 0),
    2
  ) as conversion_rate
FROM conversion_events
GROUP BY registration_source;


-- 4. VISTA PARA TIEMPO HASTA CONVERSION
-- ============================================================
CREATE OR REPLACE VIEW conversion_time_analysis AS
SELECT
  registration_source,
  AVG(days_since_registration) as avg_days_to_convert,
  MIN(days_since_registration) as min_days,
  MAX(days_since_registration) as max_days,
  COUNT(*) as total_conversions
FROM conversion_events
WHERE event_type = 'payment_completed'
GROUP BY registration_source;


-- 5. FUNCION PARA OBTENER STATS DE UN USUARIO
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_conversion_journey(p_user_id UUID)
RETURNS TABLE(
  event_type TEXT,
  event_data JSONB,
  days_since_registration INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ce.event_type,
    ce.event_data,
    ce.days_since_registration,
    ce.created_at
  FROM conversion_events ce
  WHERE ce.user_id = p_user_id
  ORDER BY ce.created_at ASC;
END;
$$;


-- ============================================================
-- NOTAS DE USO:
--
-- Registrar evento:
--   SELECT track_conversion_event('user-uuid', 'limit_reached', '{"questions": 25}');
--
-- Ver funnel por fuente:
--   SELECT * FROM conversion_funnel_stats;
--
-- Ver tiempo hasta conversion:
--   SELECT * FROM conversion_time_analysis;
--
-- Ver journey de un usuario:
--   SELECT * FROM get_user_conversion_journey('user-uuid');
-- ============================================================
