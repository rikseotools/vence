-- ============================================
-- SISTEMA DE TRACKING DE SHARES V2
-- Fecha: 2025-12-18
-- Mejoras: question_id, respuestas a shares, métricas de usuario
-- ============================================

-- ============================================
-- 1. MEJORAS A LA TABLA share_events
-- ============================================

-- Añadir question_id para trackear qué preguntas se comparten
ALTER TABLE share_events
ADD COLUMN IF NOT EXISTS question_id uuid REFERENCES questions(id) ON DELETE SET NULL;

-- Añadir streak compartida (para cuando compartan rachas)
ALTER TABLE share_events
ADD COLUMN IF NOT EXISTS streak_days integer;

-- Índice para buscar shares por pregunta
CREATE INDEX IF NOT EXISTS idx_share_events_question ON share_events(question_id);

-- ============================================
-- 2. TABLA: Respuestas a preguntas compartidas
-- Trackea cuando alguien responde a una pregunta desde un share
-- ============================================
CREATE TABLE IF NOT EXISTS shared_question_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,

  -- Respuesta del visitante
  answer_selected integer NOT NULL, -- 0-3 (A-D)
  is_correct boolean NOT NULL,
  time_to_answer_ms integer, -- Tiempo que tardó en responder

  -- Origen del tráfico
  source_platform text, -- 'whatsapp', 'telegram', 'twitter', etc. (de UTM o referer)
  share_mode text, -- 'quiz' o 'educational'
  referrer text, -- URL de origen

  -- Si el visitante está logueado
  visitor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Metadata
  device_info jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_shared_responses_question ON shared_question_responses(question_id);
CREATE INDEX IF NOT EXISTS idx_shared_responses_created ON shared_question_responses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_responses_platform ON shared_question_responses(source_platform);

-- RLS - Cualquiera puede insertar (visitantes anónimos), solo admins pueden leer
ALTER TABLE shared_question_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert responses" ON shared_question_responses;
CREATE POLICY "Anyone can insert responses"
  ON shared_question_responses FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read responses" ON shared_question_responses;
CREATE POLICY "Admins can read responses"
  ON shared_question_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- ============================================
-- 3. TABLA: Métricas de shares por usuario (cache)
-- Para consultas rápidas sin hacer agregaciones
-- ============================================
CREATE TABLE IF NOT EXISTS user_share_metrics (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Contadores totales
  total_shares integer DEFAULT 0,
  total_question_shares integer DEFAULT 0,
  total_exam_shares integer DEFAULT 0,
  total_streak_shares integer DEFAULT 0,

  -- Actividad reciente
  shares_last_7_days integer DEFAULT 0,
  shares_last_30_days integer DEFAULT 0,

  -- Plataformas
  platforms_used text[] DEFAULT '{}',
  favorite_platform text,

  -- Fechas
  first_share_at timestamptz,
  last_share_at timestamptz,

  -- Efectividad (cuántas visitas/respuestas generaron sus shares)
  total_clicks_generated integer DEFAULT 0,
  total_responses_generated integer DEFAULT 0,

  -- Para decidir cuándo mostrar prompts
  tests_since_last_share integer DEFAULT 0,
  days_since_last_share integer DEFAULT 0,

  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE user_share_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own metrics" ON user_share_metrics;
CREATE POLICY "Users can read own metrics"
  ON user_share_metrics FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can manage metrics" ON user_share_metrics;
CREATE POLICY "System can manage metrics"
  ON user_share_metrics FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 4. FUNCIÓN: Actualizar métricas de share del usuario
-- Se llama después de cada share o test
-- ============================================
CREATE OR REPLACE FUNCTION update_user_share_metrics(p_user_id uuid)
RETURNS void AS $$
DECLARE
  v_stats RECORD;
  v_tests_count integer;
  v_last_share timestamptz;
BEGIN
  -- Calcular estadísticas de shares
  SELECT
    COUNT(*)::integer as total_shares,
    COUNT(*) FILTER (WHERE share_type = 'question_quiz' OR share_type = 'question_educational')::integer as question_shares,
    COUNT(*) FILTER (WHERE share_type = 'exam_result')::integer as exam_shares,
    COUNT(*) FILTER (WHERE share_type = 'streak')::integer as streak_shares,
    COUNT(*) FILTER (WHERE created_at > now() - interval '7 days')::integer as last_7,
    COUNT(*) FILTER (WHERE created_at > now() - interval '30 days')::integer as last_30,
    ARRAY_AGG(DISTINCT platform) FILTER (WHERE platform IS NOT NULL) as platforms,
    MODE() WITHIN GROUP (ORDER BY platform) as fav_platform,
    MIN(created_at) as first_share,
    MAX(created_at) as last_share
  INTO v_stats
  FROM share_events
  WHERE user_id = p_user_id;

  -- Contar tests desde último share
  SELECT COUNT(*)::integer INTO v_tests_count
  FROM test_sessions
  WHERE user_id = p_user_id
    AND created_at > COALESCE(v_stats.last_share, '1970-01-01'::timestamptz);

  -- Insertar o actualizar métricas
  INSERT INTO user_share_metrics (
    user_id,
    total_shares,
    total_question_shares,
    total_exam_shares,
    total_streak_shares,
    shares_last_7_days,
    shares_last_30_days,
    platforms_used,
    favorite_platform,
    first_share_at,
    last_share_at,
    tests_since_last_share,
    days_since_last_share,
    updated_at
  ) VALUES (
    p_user_id,
    COALESCE(v_stats.total_shares, 0),
    COALESCE(v_stats.question_shares, 0),
    COALESCE(v_stats.exam_shares, 0),
    COALESCE(v_stats.streak_shares, 0),
    COALESCE(v_stats.last_7, 0),
    COALESCE(v_stats.last_30, 0),
    COALESCE(v_stats.platforms, '{}'),
    v_stats.fav_platform,
    v_stats.first_share,
    v_stats.last_share,
    v_tests_count,
    EXTRACT(DAY FROM now() - COALESCE(v_stats.last_share, now()))::integer,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_shares = EXCLUDED.total_shares,
    total_question_shares = EXCLUDED.total_question_shares,
    total_exam_shares = EXCLUDED.total_exam_shares,
    total_streak_shares = EXCLUDED.total_streak_shares,
    shares_last_7_days = EXCLUDED.shares_last_7_days,
    shares_last_30_days = EXCLUDED.shares_last_30_days,
    platforms_used = EXCLUDED.platforms_used,
    favorite_platform = EXCLUDED.favorite_platform,
    first_share_at = EXCLUDED.first_share_at,
    last_share_at = EXCLUDED.last_share_at,
    tests_since_last_share = EXCLUDED.tests_since_last_share,
    days_since_last_share = EXCLUDED.days_since_last_share,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. TRIGGER: Actualizar métricas cuando se crea un share
-- ============================================
CREATE OR REPLACE FUNCTION trigger_update_share_metrics()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_user_share_metrics(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_share_events_update_metrics ON share_events;
CREATE TRIGGER trg_share_events_update_metrics
  AFTER INSERT ON share_events
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_share_metrics();

-- ============================================
-- 6. FUNCIÓN MEJORADA: Obtener estadísticas de shares
-- ============================================
CREATE OR REPLACE FUNCTION get_user_share_stats_v2(p_user_id uuid)
RETURNS TABLE (
  total_shares integer,
  total_tests integer,
  share_ratio numeric,
  shares_last_7_days integer,
  shares_last_30_days integer,
  tests_since_last_share integer,
  days_since_last_share integer,
  platforms_used text[],
  favorite_platform text,
  last_share_at timestamptz,
  should_show_prompt boolean,
  prompt_type text
) AS $$
DECLARE
  v_metrics user_share_metrics%ROWTYPE;
  v_total_tests integer;
  v_should_show boolean := false;
  v_prompt_type text := 'none';
BEGIN
  -- Obtener métricas cacheadas o calcular si no existen
  SELECT * INTO v_metrics FROM user_share_metrics WHERE user_id = p_user_id;

  IF v_metrics IS NULL THEN
    PERFORM update_user_share_metrics(p_user_id);
    SELECT * INTO v_metrics FROM user_share_metrics WHERE user_id = p_user_id;
  END IF;

  -- Contar tests totales
  SELECT COUNT(*)::integer INTO v_total_tests FROM test_sessions WHERE user_id = p_user_id;

  -- Lógica para decidir si mostrar prompt
  IF v_metrics.total_shares = 0 THEN
    -- Nunca ha compartido
    v_should_show := true;
    v_prompt_type := 'first';
  ELSIF v_metrics.tests_since_last_share >= 10 THEN
    -- Ha hecho 10+ tests sin compartir
    v_should_show := true;
    v_prompt_type := 'reminder_tests';
  ELSIF v_metrics.days_since_last_share >= 14 THEN
    -- Hace 2+ semanas que no comparte
    v_should_show := true;
    v_prompt_type := 'reminder_time';
  ELSIF v_total_tests >= 20 AND v_metrics.total_shares <= 2 THEN
    -- Usuario muy activo que casi no comparte
    v_should_show := true;
    v_prompt_type := 'power_user';
  ELSIF v_metrics.total_shares > 0 AND
        v_total_tests > 0 AND
        (v_metrics.total_shares::numeric / v_total_tests::numeric) < 0.05 THEN
    -- Menos del 5% de ratio de compartición, mostrar ocasionalmente
    v_should_show := random() < 0.15; -- 15% de probabilidad
    v_prompt_type := 'occasional';
  END IF;

  RETURN QUERY SELECT
    COALESCE(v_metrics.total_shares, 0),
    v_total_tests,
    CASE WHEN v_total_tests > 0
      THEN ROUND((COALESCE(v_metrics.total_shares, 0)::numeric / v_total_tests::numeric) * 100, 1)
      ELSE 0
    END,
    COALESCE(v_metrics.shares_last_7_days, 0),
    COALESCE(v_metrics.shares_last_30_days, 0),
    COALESCE(v_metrics.tests_since_last_share, 0),
    COALESCE(v_metrics.days_since_last_share, 0),
    COALESCE(v_metrics.platforms_used, '{}'),
    v_metrics.favorite_platform,
    v_metrics.last_share_at,
    v_should_show,
    v_prompt_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. VISTA: Analytics de shares para admin (mejorada)
-- ============================================
DROP VIEW IF EXISTS admin_share_analytics_v2;
CREATE VIEW admin_share_analytics_v2 AS
SELECT
  DATE_TRUNC('day', se.created_at) as fecha,
  se.share_type,
  se.platform,
  COUNT(*) as total_shares,
  COUNT(DISTINCT se.user_id) as usuarios_unicos,
  COUNT(se.question_id) as preguntas_compartidas,
  AVG(se.score) FILTER (WHERE se.score IS NOT NULL) as nota_promedio,
  AVG(se.streak_days) FILTER (WHERE se.streak_days IS NOT NULL) as racha_promedio
FROM share_events se
GROUP BY DATE_TRUNC('day', se.created_at), se.share_type, se.platform
ORDER BY fecha DESC;

-- ============================================
-- 8. VISTA: Efectividad de shares por pregunta
-- ============================================
CREATE OR REPLACE VIEW admin_question_share_effectiveness AS
SELECT
  q.id as question_id,
  q.question_text,
  COUNT(DISTINCT se.id) as veces_compartida,
  COUNT(DISTINCT sqr.id) as respuestas_recibidas,
  ROUND(AVG(CASE WHEN sqr.is_correct THEN 1 ELSE 0 END) * 100, 1) as porcentaje_aciertos,
  ARRAY_AGG(DISTINCT se.platform) as plataformas_usadas
FROM questions q
LEFT JOIN share_events se ON se.question_id = q.id
LEFT JOIN shared_question_responses sqr ON sqr.question_id = q.id
GROUP BY q.id, q.question_text
HAVING COUNT(DISTINCT se.id) > 0
ORDER BY veces_compartida DESC;

-- ============================================
-- 9. VISTA: Resumen de efectividad por tipo de share
-- ============================================
DROP VIEW IF EXISTS admin_share_type_effectiveness;
CREATE VIEW admin_share_type_effectiveness AS
SELECT
  share_type,
  COUNT(*) as total_shares,
  COUNT(DISTINCT user_id) as usuarios_que_comparten,
  COUNT(DISTINCT platform) as plataformas_usadas,
  ROUND(AVG(score) FILTER (WHERE score IS NOT NULL), 2) as nota_promedio,
  ROUND(AVG(streak_days) FILTER (WHERE streak_days IS NOT NULL), 1) as racha_promedio,
  MIN(created_at) as primer_share,
  MAX(created_at) as ultimo_share
FROM share_events
GROUP BY share_type
ORDER BY total_shares DESC;

COMMENT ON VIEW admin_share_type_effectiveness IS 'Resumen de efectividad por tipo de share (exam_result, question_quiz, question_educational, streak)';

-- ============================================
-- 10. VISTA: Ranking de usuarios que más comparten
-- ============================================
DROP VIEW IF EXISTS admin_top_sharers;
CREATE VIEW admin_top_sharers AS
SELECT
  up.display_name,
  up.email,
  usm.total_shares,
  usm.total_question_shares,
  usm.total_exam_shares,
  usm.total_streak_shares,
  usm.shares_last_30_days,
  usm.favorite_platform,
  usm.first_share_at,
  usm.last_share_at,
  ts.total_tests,
  CASE WHEN ts.total_tests > 0
    THEN ROUND((usm.total_shares::numeric / ts.total_tests::numeric) * 100, 1)
    ELSE 0
  END as share_ratio_percent
FROM user_share_metrics usm
JOIN user_profiles up ON up.id = usm.user_id
LEFT JOIN LATERAL (
  SELECT COUNT(*) as total_tests
  FROM test_sessions
  WHERE user_id = usm.user_id
) ts ON true
WHERE usm.total_shares > 0
ORDER BY usm.total_shares DESC
LIMIT 100;

COMMENT ON VIEW admin_top_sharers IS 'Ranking de los 100 usuarios que más comparten';

-- ============================================
-- 11. VISTA: Efectividad de shares de preguntas
-- ============================================
DROP VIEW IF EXISTS admin_question_share_stats;
CREATE VIEW admin_question_share_stats AS
SELECT
  q.id as question_id,
  LEFT(q.question_text, 100) as pregunta_preview,
  COUNT(DISTINCT se.id) as veces_compartida,
  COUNT(DISTINCT sqr.id) as respuestas_recibidas,
  ROUND(AVG(CASE WHEN sqr.is_correct THEN 100 ELSE 0 END), 1) as porcentaje_aciertos,
  ROUND(AVG(sqr.time_to_answer_ms) / 1000.0, 1) as segundos_promedio_respuesta,
  MODE() WITHIN GROUP (ORDER BY sqr.source_platform) as plataforma_mas_efectiva
FROM questions q
LEFT JOIN share_events se ON se.question_id = q.id
LEFT JOIN shared_question_responses sqr ON sqr.question_id = q.id
WHERE se.question_id IS NOT NULL
GROUP BY q.id, q.question_text
ORDER BY respuestas_recibidas DESC, veces_compartida DESC
LIMIT 200;

COMMENT ON VIEW admin_question_share_stats IS 'Estadísticas de preguntas compartidas y sus respuestas';

-- ============================================
-- 12. VISTA: Conversión por plataforma
-- ============================================
DROP VIEW IF EXISTS admin_platform_conversion;
CREATE VIEW admin_platform_conversion AS
SELECT
  se.platform,
  COUNT(DISTINCT se.id) as total_shares,
  COUNT(DISTINCT sqr.id) as respuestas_generadas,
  CASE WHEN COUNT(DISTINCT se.id) > 0
    THEN ROUND((COUNT(DISTINCT sqr.id)::numeric / COUNT(DISTINCT se.id)::numeric) * 100, 1)
    ELSE 0
  END as conversion_rate_percent,
  ROUND(AVG(CASE WHEN sqr.is_correct THEN 100 ELSE 0 END), 1) as porcentaje_aciertos
FROM share_events se
LEFT JOIN shared_question_responses sqr ON sqr.source_platform = se.platform
WHERE se.share_type IN ('question_quiz', 'question_educational')
GROUP BY se.platform
ORDER BY respuestas_generadas DESC;

COMMENT ON VIEW admin_platform_conversion IS 'Tasa de conversión (shares -> respuestas) por plataforma';

-- ============================================
-- 13. COMENTARIOS FINALES
-- ============================================
COMMENT ON TABLE shared_question_responses IS 'Respuestas de visitantes a preguntas compartidas (modo quiz)';
COMMENT ON TABLE user_share_metrics IS 'Cache de métricas de shares por usuario para consultas rápidas';
COMMENT ON FUNCTION update_user_share_metrics IS 'Actualiza las métricas de shares del usuario';
COMMENT ON FUNCTION get_user_share_stats_v2 IS 'Obtiene estadísticas de shares con lógica inteligente para prompts';
