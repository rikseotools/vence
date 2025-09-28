-- SISTEMA DE TRACKING DE NOTIFICACIONES Y EMAILS
-- Para panel de administración y analíticas avanzadas

-- Tabla para tracking de eventos de notificaciones push
CREATE TABLE IF NOT EXISTS notification_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'permission_requested',    -- Usuario solicitó permisos
        'permission_granted',      -- Permisos concedidos
        'permission_denied',       -- Permisos denegados
        'subscription_created',    -- Suscripción push creada
        'subscription_updated',    -- Suscripción actualizada
        'subscription_deleted',    -- Suscripción eliminada
        'notification_sent',       -- Notificación enviada
        'notification_delivered',  -- Notificación entregada
        'notification_clicked',    -- Usuario hizo clic
        'notification_dismissed',  -- Usuario descartó
        'notification_failed',     -- Falló el envío
        'settings_updated'         -- Usuario cambió configuración
    )),
    notification_type TEXT CHECK (notification_type IN (
        'motivation',
        'streak_reminder', 
        'achievement',
        'study_reminder',
        'reactivation',
        'urgent'
    )),
    device_info JSONB DEFAULT '{}', -- Info del dispositivo
    browser_info JSONB DEFAULT '{}', -- Info del navegador
    push_subscription JSONB, -- Datos de la suscripción push
    notification_data JSONB DEFAULT '{}', -- Contenido de la notificación
    response_time_ms INTEGER, -- Tiempo de respuesta en ms
    error_details TEXT, -- Detalles del error si falló
    ip_address INET,
    user_agent TEXT,
    referrer TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para notification_events
CREATE INDEX IF NOT EXISTS idx_notification_events_user_id ON notification_events(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_events_event_type ON notification_events(event_type);
CREATE INDEX IF NOT EXISTS idx_notification_events_created_at ON notification_events(created_at);
CREATE INDEX IF NOT EXISTS idx_notification_events_user_event ON notification_events(user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_notification_events_type_date ON notification_events(notification_type, created_at);

-- Tabla para tracking de emails
CREATE TABLE IF NOT EXISTS email_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email_type TEXT NOT NULL CHECK (email_type IN (
        'welcome',
        'reactivation', 
        'urgent_reactivation',
        'motivation',
        'achievement',
        'streak_danger',
        'newsletter',
        'system'
    )),
    event_type TEXT NOT NULL CHECK (event_type IN (
        'sent',           -- Email enviado
        'delivered',      -- Email entregado
        'opened',         -- Email abierto
        'clicked',        -- Link clickeado
        'bounced',        -- Email rebotó
        'complained',     -- Marcado como spam
        'unsubscribed'    -- Usuario se desuscribió
    )),
    email_address TEXT NOT NULL,
    subject TEXT,
    template_id TEXT,
    campaign_id TEXT,
    email_content_preview TEXT, -- Primeros 200 caracteres
    link_clicked TEXT, -- URL del link clickeado
    click_count INTEGER DEFAULT 0,
    open_count INTEGER DEFAULT 0,
    device_type TEXT, -- mobile, desktop, tablet
    client_name TEXT, -- Gmail, Outlook, etc.
    ip_address INET,
    user_agent TEXT,
    geolocation JSONB DEFAULT '{}', -- País, ciudad si disponible
    error_details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para email_events
CREATE INDEX IF NOT EXISTS idx_email_events_user_id ON email_events(user_id);
CREATE INDEX IF NOT EXISTS idx_email_events_email_type ON email_events(email_type);
CREATE INDEX IF NOT EXISTS idx_email_events_event_type ON email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_created_at ON email_events(created_at);
CREATE INDEX IF NOT EXISTS idx_email_events_email_address ON email_events(email_address);
CREATE INDEX IF NOT EXISTS idx_email_events_campaign ON email_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_events_user_email_type ON email_events(user_id, email_type);

-- Tabla para resumen de métricas de notificaciones por usuario
CREATE TABLE IF NOT EXISTS user_notification_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    
    -- Métricas de notificaciones push
    push_permission_status TEXT DEFAULT 'not_requested',
    push_subscriptions_count INTEGER DEFAULT 0,
    push_notifications_sent INTEGER DEFAULT 0,
    push_notifications_clicked INTEGER DEFAULT 0,
    push_notifications_dismissed INTEGER DEFAULT 0,
    push_click_rate DECIMAL(5,2) DEFAULT 0.00,
    last_push_interaction TIMESTAMP WITH TIME ZONE,
    
    -- Métricas de emails
    emails_sent INTEGER DEFAULT 0,
    emails_delivered INTEGER DEFAULT 0,
    emails_opened INTEGER DEFAULT 0,
    emails_clicked INTEGER DEFAULT 0,
    emails_bounced INTEGER DEFAULT 0,
    email_open_rate DECIMAL(5,2) DEFAULT 0.00,
    email_click_rate DECIMAL(5,2) DEFAULT 0.00,
    last_email_opened TIMESTAMP WITH TIME ZONE,
    last_email_clicked TIMESTAMP WITH TIME ZONE,
    
    -- Dispositivos más utilizados
    primary_device_type TEXT,
    primary_browser TEXT,
    
    -- Engagement score (0-100)
    notification_engagement_score INTEGER DEFAULT 0,
    email_engagement_score INTEGER DEFAULT 0,
    overall_engagement_score INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para user_notification_metrics
CREATE INDEX IF NOT EXISTS idx_user_notification_metrics_user_id ON user_notification_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notification_metrics_engagement ON user_notification_metrics(overall_engagement_score);
CREATE INDEX IF NOT EXISTS idx_user_notification_metrics_updated ON user_notification_metrics(updated_at);

-- Función para actualizar métricas automáticamente
CREATE OR REPLACE FUNCTION update_user_notification_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar métricas cuando se inserta un nuevo evento
    IF TG_TABLE_NAME = 'notification_events' THEN
        INSERT INTO user_notification_metrics (user_id) 
        VALUES (NEW.user_id)
        ON CONFLICT (user_id) DO UPDATE SET
            push_notifications_sent = CASE 
                WHEN NEW.event_type = 'notification_sent' THEN user_notification_metrics.push_notifications_sent + 1
                ELSE user_notification_metrics.push_notifications_sent
            END,
            push_notifications_clicked = CASE
                WHEN NEW.event_type = 'notification_clicked' THEN user_notification_metrics.push_notifications_clicked + 1
                ELSE user_notification_metrics.push_notifications_clicked
            END,
            push_notifications_dismissed = CASE
                WHEN NEW.event_type = 'notification_dismissed' THEN user_notification_metrics.push_notifications_dismissed + 1
                ELSE user_notification_metrics.push_notifications_dismissed
            END,
            last_push_interaction = CASE
                WHEN NEW.event_type IN ('notification_clicked', 'notification_dismissed') THEN NEW.created_at
                ELSE user_notification_metrics.last_push_interaction
            END,
            updated_at = NOW();
            
    ELSIF TG_TABLE_NAME = 'email_events' THEN
        INSERT INTO user_notification_metrics (user_id)
        VALUES (NEW.user_id)
        ON CONFLICT (user_id) DO UPDATE SET
            emails_sent = CASE
                WHEN NEW.event_type = 'sent' THEN user_notification_metrics.emails_sent + 1
                ELSE user_notification_metrics.emails_sent
            END,
            emails_delivered = CASE
                WHEN NEW.event_type = 'delivered' THEN user_notification_metrics.emails_delivered + 1
                ELSE user_notification_metrics.emails_delivered
            END,
            emails_opened = CASE
                WHEN NEW.event_type = 'opened' THEN user_notification_metrics.emails_opened + 1
                ELSE user_notification_metrics.emails_opened
            END,
            emails_clicked = CASE
                WHEN NEW.event_type = 'clicked' THEN user_notification_metrics.emails_clicked + 1
                ELSE user_notification_metrics.emails_clicked
            END,
            last_email_opened = CASE
                WHEN NEW.event_type = 'opened' THEN NEW.created_at
                ELSE user_notification_metrics.last_email_opened
            END,
            last_email_clicked = CASE
                WHEN NEW.event_type = 'clicked' THEN NEW.created_at
                ELSE user_notification_metrics.last_email_clicked
            END,
            updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para actualizar métricas automáticamente
CREATE TRIGGER trigger_update_notification_metrics
    AFTER INSERT ON notification_events
    FOR EACH ROW
    EXECUTE FUNCTION update_user_notification_metrics();

CREATE TRIGGER trigger_update_email_metrics
    AFTER INSERT ON email_events
    FOR EACH ROW
    EXECUTE FUNCTION update_user_notification_metrics();

-- Vista para analytics del admin
CREATE OR REPLACE VIEW admin_notification_analytics AS
SELECT 
    -- Métricas generales
    COUNT(DISTINCT user_id) as total_users_with_notifications,
    COUNT(*) as total_notification_events,
    
    -- Métricas de push notifications
    COUNT(*) FILTER (WHERE event_type = 'permission_granted') as push_permissions_granted,
    COUNT(*) FILTER (WHERE event_type = 'permission_denied') as push_permissions_denied,
    COUNT(*) FILTER (WHERE event_type = 'notification_sent') as push_notifications_sent,
    COUNT(*) FILTER (WHERE event_type = 'notification_clicked') as push_notifications_clicked,
    COUNT(*) FILTER (WHERE event_type = 'notification_dismissed') as push_notifications_dismissed,
    
    -- Rates de push
    ROUND(
        (COUNT(*) FILTER (WHERE event_type = 'notification_clicked')::decimal / 
         NULLIF(COUNT(*) FILTER (WHERE event_type = 'notification_sent'), 0)) * 100, 2
    ) as push_click_rate,
    
    -- Dispositivos más populares
    (device_info->>'platform') as platform,
    (browser_info->>'name') as browser_name,
    
    -- Temporal
    DATE_TRUNC('day', created_at) as date
FROM notification_events
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at), (device_info->>'platform'), (browser_info->>'name');

-- Vista para analytics de emails
CREATE OR REPLACE VIEW admin_email_analytics AS
SELECT 
    email_type,
    COUNT(*) FILTER (WHERE event_type = 'sent') as emails_sent,
    COUNT(*) FILTER (WHERE event_type = 'delivered') as emails_delivered,
    COUNT(*) FILTER (WHERE event_type = 'opened') as emails_opened,
    COUNT(*) FILTER (WHERE event_type = 'clicked') as emails_clicked,
    COUNT(*) FILTER (WHERE event_type = 'bounced') as emails_bounced,
    COUNT(*) FILTER (WHERE event_type = 'unsubscribed') as unsubscribed,
    
    -- Rates
    ROUND(
        (COUNT(*) FILTER (WHERE event_type = 'opened')::decimal / 
         NULLIF(COUNT(*) FILTER (WHERE event_type = 'delivered'), 0)) * 100, 2
    ) as open_rate,
    
    ROUND(
        (COUNT(*) FILTER (WHERE event_type = 'clicked')::decimal / 
         NULLIF(COUNT(*) FILTER (WHERE event_type = 'delivered'), 0)) * 100, 2
    ) as click_rate,
    
    DATE_TRUNC('day', created_at) as date
FROM email_events
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY email_type, DATE_TRUNC('day', created_at);

-- RLS (Row Level Security) - Solo admins pueden ver estos datos
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_metrics ENABLE ROW LEVEL SECURITY;

-- Política para admins (debes ajustar según tu sistema de roles)
CREATE POLICY "Admin can view all notification events" ON notification_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND (plan_type = 'admin' OR email = 'ilovetestpro@gmail.com')
        )
    );

CREATE POLICY "Admin can view all email events" ON email_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND (plan_type = 'admin' OR email = 'ilovetestpro@gmail.com')
        )
    );

CREATE POLICY "Admin can view all notification metrics" ON user_notification_metrics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND (plan_type = 'admin' OR email = 'ilovetestpro@gmail.com')
        )
    );

-- Usuarios pueden ver solo sus propios eventos
CREATE POLICY "Users can view own notification events" ON notification_events
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can view own email events" ON email_events
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can view own notification metrics" ON user_notification_metrics
    FOR SELECT USING (user_id = auth.uid());

-- Permitir insertar eventos (para el tracking)
CREATE POLICY "Allow insert notification events" ON notification_events
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow insert email events" ON email_events
    FOR INSERT WITH CHECK (true);

COMMENT ON TABLE notification_events IS 'Tracking de todos los eventos relacionados con notificaciones push';
COMMENT ON TABLE email_events IS 'Tracking de todos los eventos relacionados con emails automáticos';
COMMENT ON TABLE user_notification_metrics IS 'Métricas agregadas por usuario para análisis rápido';