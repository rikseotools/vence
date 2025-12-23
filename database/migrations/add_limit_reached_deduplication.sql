-- ============================================================
-- DEDUPLICACIÓN DE EVENTOS limit_reached
-- Evita múltiples eventos por usuario por día
-- Ejecutado: 2024-12-23
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
  v_today DATE;
  v_existing_event UUID;
BEGIN
  -- Para limit_reached, verificar si ya existe uno hoy
  IF p_event_type = 'limit_reached' THEN
    v_today := (NOW() AT TIME ZONE 'Europe/Madrid')::DATE;

    SELECT id INTO v_existing_event
    FROM conversion_events
    WHERE user_id = p_user_id
      AND event_type = 'limit_reached'
      AND (created_at AT TIME ZONE 'Europe/Madrid')::DATE = v_today
    LIMIT 1;

    IF v_existing_event IS NOT NULL THEN
      RETURN v_existing_event;
    END IF;
  END IF;

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

-- Índice para acelerar búsqueda de duplicados
CREATE INDEX IF NOT EXISTS idx_conversion_limit_reached_user
ON conversion_events(user_id, created_at)
WHERE event_type = 'limit_reached';
