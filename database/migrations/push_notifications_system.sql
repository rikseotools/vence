-- Sistema completo de notificaciones push para oposiciones
-- Creado para ilovetest - Sistema de preparación oposiciones

-- Configuración de notificaciones del usuario
CREATE TABLE user_notification_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  push_enabled BOOLEAN DEFAULT false,
  push_subscription JSONB, -- Subscription object from browser
  preferred_times JSONB DEFAULT '["09:00", "14:00", "20:00"]'::jsonb,
  timezone TEXT DEFAULT 'Europe/Madrid',
  frequency TEXT DEFAULT 'smart' CHECK (frequency IN ('daily', 'smart', 'minimal', 'off')),
  oposicion_type TEXT DEFAULT 'auxiliar-administrativo', -- tipo de oposición
  exam_date DATE, -- fecha estimada del examen
  motivation_level TEXT DEFAULT 'medium' CHECK (motivation_level IN ('low', 'medium', 'high', 'extreme')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para optimización
CREATE INDEX idx_user_notification_settings_user_id ON user_notification_settings(user_id);
CREATE INDEX idx_user_notification_settings_push_enabled ON user_notification_settings(push_enabled);

-- Patrones de actividad del usuario (para personalización)
CREATE TABLE user_activity_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_hours INTEGER[] DEFAULT ARRAY[9, 14, 20], -- horas preferidas
  active_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5,6,7], -- días de la semana (1=lunes)
  avg_session_duration INTEGER DEFAULT 15, -- minutos
  peak_performance_time TIME, -- hora de mejor rendimiento
  streak_pattern TEXT, -- 'morning_focused', 'evening_focused', 'consistent', 'irregular'
  last_calculated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_activity_patterns_user_id ON user_activity_patterns(user_id);

-- Templates de mensajes con contexto de oposición
CREATE TABLE notification_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL, -- 'streak_danger', 'daily_motivation', 'comeback', 'achievement', 'exam_proximity', 'weakness_focus'
  subcategory TEXT, -- 'urgent', 'motivational', 'morning', 'afternoon', etc.
  message_variants JSONB NOT NULL, -- array de variantes del mensaje
  target_conditions JSONB, -- condiciones para usar este template
  oposicion_context BOOLEAN DEFAULT true, -- si incluye contexto de oposición
  urgency_level INTEGER DEFAULT 1 CHECK (urgency_level BETWEEN 1 AND 5), -- nivel de urgencia
  active BOOLEAN DEFAULT true,
  success_metrics JSONB DEFAULT '{}'::jsonb, -- métricas de rendimiento
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para templates
CREATE INDEX idx_notification_templates_category ON notification_templates(category);
CREATE INDEX idx_notification_templates_active ON notification_templates(active);

-- Historial de notificaciones enviadas (para analytics y anti-spam)
CREATE TABLE notification_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES notification_templates(id),
  message_sent TEXT NOT NULL,
  message_variant INTEGER, -- qué variante del template se usó
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scheduled_for TIMESTAMP WITH TIME ZONE, -- cuándo estaba programada
  delivery_status TEXT DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'failed', 'clicked', 'dismissed')),
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  resulted_in_session BOOLEAN DEFAULT false,
  session_started_at TIMESTAMP WITH TIME ZONE,
  context_data JSONB, -- datos del contexto cuando se envió
  device_info JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para logs
CREATE INDEX idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX idx_notification_logs_sent_at ON notification_logs(sent_at);
CREATE INDEX idx_notification_logs_template_id ON notification_logs(template_id);
CREATE INDEX idx_notification_logs_delivery_status ON notification_logs(delivery_status);

-- Métricas de efectividad de notificaciones
CREATE TABLE notification_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES notification_templates(id),
  user_segment TEXT, -- 'new_user', 'regular', 'at_risk', 'power_user'
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  total_sessions_generated INTEGER DEFAULT 0,
  avg_time_to_click INTERVAL,
  conversion_rate DECIMAL(5,4), -- porcentaje de clicks que resultan en sesión
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notification_metrics_template_id ON notification_metrics(template_id);
CREATE INDEX idx_notification_metrics_period ON notification_metrics(period_start, period_end);

-- Configuración de horarios inteligentes por usuario
CREATE TABLE user_smart_scheduling (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  next_notification_time TIMESTAMP WITH TIME ZONE,
  notification_frequency_hours INTEGER DEFAULT 24, -- cada cuántas horas notificar
  last_session_time TIMESTAMP WITH TIME ZONE,
  streak_status INTEGER DEFAULT 0, -- días de racha actual
  risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  last_risk_calculation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  pause_until TIMESTAMP WITH TIME ZONE, -- pausar notificaciones hasta esta fecha
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_smart_scheduling_user_id ON user_smart_scheduling(user_id);
CREATE INDEX idx_user_smart_scheduling_next_notification ON user_smart_scheduling(next_notification_time);
CREATE INDEX idx_user_smart_scheduling_risk_level ON user_smart_scheduling(risk_level);

-- Función para actualizar timestamps automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para auto-actualizar updated_at
CREATE TRIGGER update_user_notification_settings_updated_at 
    BEFORE UPDATE ON user_notification_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_smart_scheduling_updated_at 
    BEFORE UPDATE ON user_smart_scheduling 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para calcular el riesgo de abandono
CREATE OR REPLACE FUNCTION calculate_user_risk_level(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
    days_since_last_session INTEGER;
    current_streak INTEGER;
    avg_frequency DECIMAL;
    risk_level TEXT;
BEGIN
    -- Días desde la última sesión
    SELECT COALESCE(
        EXTRACT(DAY FROM NOW() - MAX(created_at)), 
        999
    ) INTO days_since_last_session
    FROM test_sessions 
    WHERE user_id = p_user_id;
    
    -- Racha actual
    SELECT COALESCE(streak_status, 0) INTO current_streak
    FROM user_smart_scheduling 
    WHERE user_id = p_user_id;
    
    -- Calcular nivel de riesgo
    IF days_since_last_session >= 7 THEN
        risk_level := 'critical';
    ELSIF days_since_last_session >= 3 THEN
        risk_level := 'high';
    ELSIF days_since_last_session >= 1 AND current_streak > 5 THEN
        risk_level := 'medium';
    ELSE
        risk_level := 'low';
    END IF;
    
    -- Actualizar en la tabla
    UPDATE user_smart_scheduling 
    SET risk_level = calculate_user_risk_level.risk_level,
        last_risk_calculation = NOW()
    WHERE user_id = p_user_id;
    
    RETURN risk_level;
END;
$$ LANGUAGE plpgsql;

-- Vista para usuarios que necesitan notificaciones
CREATE OR REPLACE VIEW users_needing_notifications AS
SELECT 
    uns.user_id,
    uns.push_subscription,
    uns.preferred_times,
    uns.timezone,
    uns.motivation_level,
    uns.exam_date,
    uss.next_notification_time,
    uss.risk_level,
    uss.streak_status,
    uap.preferred_hours,
    uap.peak_performance_time,
    EXTRACT(EPOCH FROM (NOW() - uss.last_session_time))/3600 as hours_since_last_session
FROM user_notification_settings uns
JOIN user_smart_scheduling uss ON uns.user_id = uss.user_id
LEFT JOIN user_activity_patterns uap ON uns.user_id = uap.user_id
WHERE uns.push_enabled = true
    AND uns.frequency != 'off'
    AND (uss.pause_until IS NULL OR uss.pause_until < NOW())
    AND uss.next_notification_time <= NOW();

COMMENT ON TABLE user_notification_settings IS 'Configuración de notificaciones push por usuario';
COMMENT ON TABLE notification_templates IS 'Templates de mensajes con contexto de oposición';
COMMENT ON TABLE notification_logs IS 'Historial completo de notificaciones enviadas y su efectividad';
COMMENT ON TABLE user_activity_patterns IS 'Patrones de actividad del usuario para personalización';
COMMENT ON TABLE notification_metrics IS 'Métricas agregadas de efectividad por template y segmento';
COMMENT ON VIEW users_needing_notifications IS 'Vista optimizada para el cron job de envío de notificaciones';