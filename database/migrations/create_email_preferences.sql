-- database/migrations/create_email_preferences.sql
-- Tabla para preferencias de email de usuarios

CREATE TABLE IF NOT EXISTS email_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    
    -- Preferencias específicas
    unsubscribed_all BOOLEAN DEFAULT false,
    unsubscribed_motivational BOOLEAN DEFAULT false,
    unsubscribed_achievements BOOLEAN DEFAULT false,
    unsubscribed_reminders BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_email_preferences_user_id ON email_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_email_preferences_unsubscribed_all ON email_preferences(unsubscribed_all);

-- RLS (Row Level Security)
ALTER TABLE email_preferences ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view own email preferences" 
    ON email_preferences FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own email preferences" 
    ON email_preferences FOR ALL 
    USING (auth.uid() = user_id);

-- Política para que el sistema pueda actualizar desde endpoints
CREATE POLICY "Service role can manage all email preferences"
    ON email_preferences FOR ALL
    USING (current_setting('role') = 'service_role');

-- Función para obtener preferencias de un usuario (con defaults)
CREATE OR REPLACE FUNCTION get_user_email_preferences(target_user_id UUID)
RETURNS TABLE (
    user_id UUID,
    unsubscribed_all BOOLEAN,
    unsubscribed_motivational BOOLEAN,
    unsubscribed_achievements BOOLEAN,
    unsubscribed_reminders BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        target_user_id,
        COALESCE(ep.unsubscribed_all, false) as unsubscribed_all,
        COALESCE(ep.unsubscribed_motivational, false) as unsubscribed_motivational,
        COALESCE(ep.unsubscribed_achievements, false) as unsubscribed_achievements,
        COALESCE(ep.unsubscribed_reminders, false) as unsubscribed_reminders
    FROM (SELECT target_user_id as user_id) base
    LEFT JOIN email_preferences ep ON ep.user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentarios
COMMENT ON TABLE email_preferences IS 'Preferencias de email de usuarios para sistema de unsubscribe';
COMMENT ON COLUMN email_preferences.unsubscribed_all IS 'Usuario dado de baja de TODOS los emails';
COMMENT ON COLUMN email_preferences.unsubscribed_motivational IS 'Usuario dado de baja de emails motivacionales';
COMMENT ON COLUMN email_preferences.unsubscribed_achievements IS 'Usuario dado de baja de emails de logros';
COMMENT ON COLUMN email_preferences.unsubscribed_reminders IS 'Usuario dado de baja de emails de recordatorios';