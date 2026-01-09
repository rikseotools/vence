-- Migration: add_theme_performance_cache
-- Sistema de caché para rendimiento por tema (evita cálculos lentos en tiempo real)

-- 1. Crear tabla de caché
CREATE TABLE IF NOT EXISTS user_theme_performance_cache (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_number INTEGER NOT NULL,
  topic_title TEXT,
  total_questions INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  accuracy NUMERIC(5,2) DEFAULT 0,
  average_time NUMERIC(10,2) DEFAULT 0,
  last_practiced TIMESTAMPTZ,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, topic_number)
);

-- 2. Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_theme_cache_user_id ON user_theme_performance_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_theme_cache_calculated_at ON user_theme_performance_cache(calculated_at);

-- 3. RLS Policies
ALTER TABLE user_theme_performance_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own theme cache"
  ON user_theme_performance_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can manage all theme cache"
  ON user_theme_performance_cache FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. Función para recalcular caché de UN usuario
CREATE OR REPLACE FUNCTION refresh_user_theme_performance_cache(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  -- Eliminar datos antiguos del usuario
  DELETE FROM user_theme_performance_cache WHERE user_id = p_user_id;

  -- Insertar datos frescos usando la función existente
  INSERT INTO user_theme_performance_cache (
    user_id, topic_number, topic_title, total_questions,
    correct_answers, accuracy, average_time, last_practiced, calculated_at
  )
  SELECT
    p_user_id,
    topic_number,
    topic_title,
    total_questions::INTEGER,
    correct_answers::INTEGER,
    accuracy,
    average_time,
    last_practiced,
    NOW()
  FROM get_theme_performance_by_scope(p_user_id);

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected;
END;
$$;

-- 5. Función para recalcular caché de TODOS los usuarios activos
CREATE OR REPLACE FUNCTION refresh_all_theme_performance_cache()
RETURNS TABLE(user_id UUID, topics_cached INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
  count INTEGER;
BEGIN
  -- Obtener usuarios que han respondido preguntas en los últimos 90 días
  FOR r IN
    SELECT DISTINCT t.user_id
    FROM tests t
    WHERE t.created_at > NOW() - INTERVAL '90 days'
      AND t.is_completed = true
  LOOP
    count := refresh_user_theme_performance_cache(r.user_id);
    user_id := r.user_id;
    topics_cached := count;
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;

-- 6. Permisos
GRANT SELECT ON user_theme_performance_cache TO authenticated;
GRANT SELECT ON user_theme_performance_cache TO anon;
GRANT EXECUTE ON FUNCTION refresh_user_theme_performance_cache(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION refresh_all_theme_performance_cache() TO service_role;

-- Comentarios
COMMENT ON TABLE user_theme_performance_cache IS
'Caché de rendimiento por tema por usuario. Se recalcula diariamente a las 00:00 via GitHub Actions.';

COMMENT ON FUNCTION refresh_user_theme_performance_cache IS
'Recalcula el caché de rendimiento por tema para un usuario específico.';

COMMENT ON FUNCTION refresh_all_theme_performance_cache IS
'Recalcula el caché de rendimiento por tema para todos los usuarios activos (últimos 90 días).';
