-- ============================================
-- SISTEMA DE TRACKING DE SHARES
-- Fecha: 2025-12-18
-- Propósito: Registrar cuando usuarios comparten resultados
--            para poder incentivar a los que no comparten
-- ============================================

-- Tabla principal de eventos de share
CREATE TABLE IF NOT EXISTS share_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Contexto del share
  share_type text NOT NULL DEFAULT 'exam_result', -- 'exam_result', 'achievement', 'streak', etc.
  platform text NOT NULL, -- 'twitter', 'facebook', 'whatsapp', 'linkedin', 'telegram', 'copy'

  -- Datos del resultado compartido (opcional)
  score numeric(4,2), -- Nota sobre 10
  test_session_id uuid REFERENCES test_sessions(id) ON DELETE SET NULL,

  -- Contenido compartido (para analytics)
  share_text text, -- El mensaje que se compartió
  share_url text, -- La URL de compartir que se abrió (ej: https://twitter.com/intent/tweet?...)

  -- Metadata
  device_info jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_share_events_user ON share_events(user_id);
CREATE INDEX IF NOT EXISTS idx_share_events_user_created ON share_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_events_type ON share_events(share_type);
CREATE INDEX IF NOT EXISTS idx_share_events_platform ON share_events(platform);

-- RLS (Row Level Security)
ALTER TABLE share_events ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
DROP POLICY IF EXISTS "Users can read own shares" ON share_events;
CREATE POLICY "Users can read own shares"
  ON share_events FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own shares" ON share_events;
CREATE POLICY "Users can create own shares"
  ON share_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read all shares" ON share_events;
CREATE POLICY "Admins can read all shares"
  ON share_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- ============================================
-- FUNCIÓN: Obtener estadísticas de shares del usuario
-- ============================================
CREATE OR REPLACE FUNCTION get_user_share_stats(p_user_id uuid)
RETURNS TABLE (
  total_shares bigint,
  shares_last_30_days bigint,
  last_share_at timestamptz,
  platforms_used text[],
  total_tests bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(se.id)::bigint as total_shares,
    COUNT(se.id) FILTER (WHERE se.created_at > now() - interval '30 days')::bigint as shares_last_30_days,
    MAX(se.created_at) as last_share_at,
    ARRAY_AGG(DISTINCT se.platform) FILTER (WHERE se.platform IS NOT NULL) as platforms_used,
    (SELECT COUNT(*) FROM test_sessions ts WHERE ts.user_id = p_user_id)::bigint as total_tests
  FROM share_events se
  WHERE se.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentarios
COMMENT ON TABLE share_events IS 'Tracking de cuando usuarios comparten sus resultados en redes sociales';
COMMENT ON FUNCTION get_user_share_stats IS 'Obtiene estadísticas de shares para decidir si mostrar prompt de compartir';

-- ============================================
-- VISTA: Analytics de shares para admin
-- ============================================
CREATE OR REPLACE VIEW admin_share_analytics AS
SELECT
  DATE_TRUNC('day', created_at) as fecha,
  share_type,
  platform,
  COUNT(*) as total_shares,
  COUNT(DISTINCT user_id) as usuarios_unicos,
  AVG(score) as nota_promedio_compartida
FROM share_events
GROUP BY DATE_TRUNC('day', created_at), share_type, platform
ORDER BY fecha DESC;

COMMENT ON VIEW admin_share_analytics IS 'Analytics de shares por día, tipo y plataforma';
