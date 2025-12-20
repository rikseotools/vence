-- Migración para tracking de PWA
-- Ejecutar en Supabase SQL Editor

-- Tabla para eventos específicos de PWA (instalación, desinstalación, prompts)
CREATE TABLE IF NOT EXISTS pwa_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  event_type text NOT NULL, -- 'install_prompt_shown', 'pwa_installed', 'pwa_uninstalled', 'session_started'
  device_info jsonb,
  browser_info jsonb,
  user_agent text,
  referrer text,
  created_at timestamp DEFAULT now()
);

-- Tabla para sesiones de uso en modo PWA vs navegador web
CREATE TABLE IF NOT EXISTS pwa_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  session_start timestamp DEFAULT now(),
  session_end timestamp,
  session_duration_minutes integer,
  device_info jsonb,
  is_standalone boolean DEFAULT false, -- true si está usando PWA instalada
  pages_visited integer DEFAULT 1,
  actions_performed integer DEFAULT 0
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pwa_events_user_id ON pwa_events(user_id);
CREATE INDEX IF NOT EXISTS idx_pwa_events_type ON pwa_events(event_type);
CREATE INDEX IF NOT EXISTS idx_pwa_events_created_at ON pwa_events(created_at);
CREATE INDEX IF NOT EXISTS idx_pwa_sessions_user_id ON pwa_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_pwa_sessions_standalone ON pwa_sessions(is_standalone);
CREATE INDEX IF NOT EXISTS idx_pwa_sessions_start ON pwa_sessions(session_start);

-- Comentarios explicativos
COMMENT ON TABLE pwa_events IS 'Eventos específicos de PWA: instalación, desinstalación, prompts, sesiones';
COMMENT ON TABLE pwa_sessions IS 'Sesiones de uso diferenciando entre modo PWA y navegador web normal';

-- Políticas RLS (Row Level Security)
ALTER TABLE pwa_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pwa_sessions ENABLE ROW LEVEL SECURITY;

-- Política para que usuarios solo vean sus datos
CREATE POLICY "Users can view own PWA events" ON pwa_events
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own PWA events" ON pwa_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own PWA sessions" ON pwa_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own PWA sessions" ON pwa_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own PWA sessions" ON pwa_sessions
    FOR UPDATE USING (auth.uid() = user_id);

-- Política para admins (usando service role)
CREATE POLICY "Service role can manage all PWA events" ON pwa_events
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all PWA sessions" ON pwa_sessions
    FOR ALL USING (auth.role() = 'service_role');

-- Vista para estadísticas de admin
CREATE OR REPLACE VIEW admin_pwa_stats AS
SELECT 
  COUNT(DISTINCT pe.user_id) FILTER (WHERE pe.event_type = 'pwa_installed') as total_installations,
  COUNT(DISTINCT ps.user_id) FILTER (WHERE ps.is_standalone = true) as active_pwa_users,
  COUNT(DISTINCT pe.user_id) FILTER (WHERE pe.event_type = 'install_prompt_shown') as prompt_shows,
  COUNT(*) FILTER (WHERE pe.event_type = 'pwa_installed') as total_installs,
  COUNT(*) FILTER (WHERE pe.event_type = 'install_prompt_shown') as total_prompts,
  ROUND(
    COUNT(*) FILTER (WHERE pe.event_type = 'pwa_installed')::numeric / 
    NULLIF(COUNT(*) FILTER (WHERE pe.event_type = 'install_prompt_shown'), 0) * 100, 
    2
  ) as conversion_rate_percentage
FROM pwa_events pe
LEFT JOIN pwa_sessions ps ON pe.user_id = ps.user_id
WHERE pe.created_at >= NOW() - INTERVAL '30 days';

-- Función para limpiar sesiones antiguas (opcional, para maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_pwa_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM pwa_sessions 
  WHERE session_start < NOW() - INTERVAL '90 days';
  
  DELETE FROM pwa_events 
  WHERE created_at < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;