-- Sistema de medallas de usuario para ranking
-- Almacena medallas conseguidas por los usuarios

CREATE TABLE IF NOT EXISTS user_medals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    medal_id TEXT NOT NULL,
    medal_data JSONB NOT NULL, -- Datos completos de la medalla
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Evitar duplicados
    UNIQUE(user_id, medal_id)
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_user_medals_user_id ON user_medals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_medals_medal_id ON user_medals(medal_id);
CREATE INDEX IF NOT EXISTS idx_user_medals_unlocked_at ON user_medals(unlocked_at);

-- RLS para seguridad
ALTER TABLE user_medals ENABLE ROW LEVEL SECURITY;

-- Solo el usuario puede ver sus propias medallas
CREATE POLICY "Users can view own medals" 
    ON user_medals FOR SELECT 
    TO authenticated 
    USING (auth.uid() = user_id);

-- Solo el sistema puede insertar medallas (via service role)
CREATE POLICY "System can insert medals" 
    ON user_medals FOR INSERT 
    TO service_role 
    WITH CHECK (true);

-- Vista para estadísticas de medallas públicas (leaderboard de medallas)
CREATE VIEW public_medal_stats AS
SELECT 
    medal_id,
    COUNT(*) as total_users,
    COUNT(*) / (SELECT COUNT(DISTINCT user_id) FROM user_medals)::float * 100 as rarity_percentage
FROM user_medals
GROUP BY medal_id
ORDER BY total_users ASC;

-- Función para obtener medallas del usuario
CREATE OR REPLACE FUNCTION get_user_medals(p_user_id UUID)
RETURNS TABLE (
    medal_id TEXT,
    medal_data JSONB,
    unlocked_at TIMESTAMP WITH TIME ZONE,
    is_recent BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        um.medal_id,
        um.medal_data,
        um.unlocked_at,
        (um.unlocked_at >= NOW() - INTERVAL '7 days') as is_recent
    FROM user_medals um
    WHERE um.user_id = p_user_id
    ORDER BY um.unlocked_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_medals TO authenticated;

COMMENT ON TABLE user_medals IS 'Medallas conseguidas por usuarios en el sistema de ranking';
COMMENT ON FUNCTION get_user_medals IS 'Obtiene todas las medallas de un usuario con indicador de medallas recientes';