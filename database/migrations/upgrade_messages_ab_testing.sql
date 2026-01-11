-- =====================================================
-- SISTEMA DE A/B TESTING PARA MODALES DE UPGRADE
-- Creado: 2025-12-26
-- =====================================================

-- 1. TABLA: Mensajes de upgrade (contenido de los modales)
CREATE TABLE IF NOT EXISTS upgrade_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_key TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  body_message TEXT NOT NULL,
  highlight TEXT NOT NULL,
  icon TEXT DEFAULT 'money',
  gradient TEXT DEFAULT 'from-amber-500 via-orange-500 to-red-500',
  is_active BOOLEAN DEFAULT true,
  weight INTEGER DEFAULT 1,  -- Mayor peso = mas probabilidad de aparecer
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indice para mensajes activos
CREATE INDEX IF NOT EXISTS idx_upgrade_messages_active ON upgrade_messages(is_active) WHERE is_active = true;

-- 2. TABLA: Impresiones de mensajes (tracking)
CREATE TABLE IF NOT EXISTS upgrade_message_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message_id UUID REFERENCES upgrade_messages(id) ON DELETE SET NULL,
  shown_at TIMESTAMPTZ DEFAULT now(),

  -- Tracking de acciones
  clicked_upgrade BOOLEAN DEFAULT false,
  clicked_at TIMESTAMPTZ,
  dismissed BOOLEAN DEFAULT false,
  dismissed_at TIMESTAMPTZ,

  -- Conversion final
  converted_to_premium BOOLEAN DEFAULT false,
  converted_at TIMESTAMPTZ,

  -- Contexto adicional
  trigger_type TEXT DEFAULT 'daily_limit',  -- daily_limit, manual, etc
  questions_answered INTEGER,

  -- Metadatos
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_upgrade_impressions_user ON upgrade_message_impressions(user_id);
CREATE INDEX IF NOT EXISTS idx_upgrade_impressions_message ON upgrade_message_impressions(message_id);
CREATE INDEX IF NOT EXISTS idx_upgrade_impressions_date ON upgrade_message_impressions(shown_at);

-- 3. RPC: Obtener mensaje aleatorio ponderado
-- FIX 2026-01-12: Añadido p_user_id param y eliminada ambiguedad de columna "id"
CREATE OR REPLACE FUNCTION get_random_upgrade_message(
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  message_key TEXT,
  title TEXT,
  subtitle TEXT,
  body_message TEXT,
  highlight TEXT,
  icon TEXT,
  gradient TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_weight INTEGER;
  v_random_weight INTEGER;
  v_cumulative INTEGER := 0;
  v_selected_id UUID;
BEGIN
  SELECT COALESCE(SUM(weight), 0) INTO v_total_weight
  FROM upgrade_messages
  WHERE is_active = true;

  IF v_total_weight = 0 THEN
    RETURN;
  END IF;

  v_random_weight := floor(random() * v_total_weight)::INTEGER;

  FOR v_selected_id IN
    SELECT um.id FROM upgrade_messages um WHERE um.is_active = true ORDER BY um.id
  LOOP
    SELECT v_cumulative + um.weight INTO v_cumulative
    FROM upgrade_messages um WHERE um.id = v_selected_id;

    IF v_cumulative > v_random_weight THEN
      RETURN QUERY
      SELECT um.id, um.message_key, um.title, um.subtitle,
             um.body_message, um.highlight, um.icon, um.gradient
      FROM upgrade_messages um WHERE um.id = v_selected_id;
      RETURN;
    END IF;
  END LOOP;

  RETURN QUERY
  SELECT um.id, um.message_key, um.title, um.subtitle,
         um.body_message, um.highlight, um.icon, um.gradient
  FROM upgrade_messages um WHERE um.is_active = true
  ORDER BY um.created_at LIMIT 1;
END;
$$;

-- 4. RPC: Registrar impresion de mensaje
CREATE OR REPLACE FUNCTION track_upgrade_message_shown(
  p_user_id UUID,
  p_message_id UUID,
  p_trigger_type TEXT DEFAULT 'daily_limit',
  p_questions_answered INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_impression_id UUID;
BEGIN
  INSERT INTO upgrade_message_impressions (
    user_id,
    message_id,
    trigger_type,
    questions_answered,
    shown_at
  ) VALUES (
    p_user_id,
    p_message_id,
    p_trigger_type,
    p_questions_answered,
    now()
  )
  RETURNING id INTO v_impression_id;

  RETURN v_impression_id;
END;
$$;

-- 5. RPC: Registrar clic en upgrade
CREATE OR REPLACE FUNCTION track_upgrade_message_click(
  p_impression_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE upgrade_message_impressions
  SET
    clicked_upgrade = true,
    clicked_at = now()
  WHERE id = p_impression_id;

  RETURN FOUND;
END;
$$;

-- 6. RPC: Registrar dismiss (cerrar modal)
CREATE OR REPLACE FUNCTION track_upgrade_message_dismiss(
  p_impression_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE upgrade_message_impressions
  SET
    dismissed = true,
    dismissed_at = now()
  WHERE id = p_impression_id;

  RETURN FOUND;
END;
$$;

-- 7. RPC: Marcar conversion a premium (llamar cuando usuario paga)
CREATE OR REPLACE FUNCTION mark_upgrade_conversion(
  p_user_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  -- Marcar todas las impresiones recientes del usuario como convertidas
  UPDATE upgrade_message_impressions
  SET
    converted_to_premium = true,
    converted_at = now()
  WHERE user_id = p_user_id
    AND converted_to_premium = false
    AND shown_at > now() - INTERVAL '7 days';  -- Ultimos 7 dias

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

-- 8. VISTA: Estadisticas de mensajes para admin
CREATE OR REPLACE VIEW admin_upgrade_message_stats AS
SELECT
  um.id,
  um.message_key,
  um.title,
  um.is_active,
  um.weight,
  COUNT(umi.id) AS total_impressions,
  COUNT(umi.id) FILTER (WHERE umi.clicked_upgrade = true) AS total_clicks,
  COUNT(umi.id) FILTER (WHERE umi.dismissed = true) AS total_dismisses,
  COUNT(umi.id) FILTER (WHERE umi.converted_to_premium = true) AS total_conversions,
  ROUND(
    COUNT(umi.id) FILTER (WHERE umi.clicked_upgrade = true)::NUMERIC /
    NULLIF(COUNT(umi.id), 0) * 100, 2
  ) AS click_rate,
  ROUND(
    COUNT(umi.id) FILTER (WHERE umi.converted_to_premium = true)::NUMERIC /
    NULLIF(COUNT(umi.id), 0) * 100, 2
  ) AS conversion_rate
FROM upgrade_messages um
LEFT JOIN upgrade_message_impressions umi ON umi.message_id = um.id
GROUP BY um.id, um.message_key, um.title, um.is_active, um.weight
ORDER BY total_impressions DESC;

-- 9. PERMISOS
GRANT SELECT ON upgrade_messages TO anon, authenticated;
GRANT SELECT ON admin_upgrade_message_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_random_upgrade_message() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION track_upgrade_message_shown(UUID, UUID, TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION track_upgrade_message_click(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION track_upgrade_message_dismiss(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_upgrade_conversion(UUID) TO authenticated;

-- 10. INSERTAR MENSAJES INICIALES
INSERT INTO upgrade_messages (message_key, title, subtitle, body_message, highlight, icon, gradient, weight) VALUES
(
  'price_monthly',
  'No te limites por 20 euros',
  'Tu plaza fija vale mucho mas',
  'Por menos de lo que cuesta una cena, tendras acceso ilimitado todo el mes.',
  '20 euros/mes',
  'money',
  'from-green-500 via-emerald-500 to-teal-500',
  2
),
(
  'price_semester',
  'No te limites por 59 euros',
  '6 meses de preparacion completa',
  'Menos de 10 euros al mes. Menos que un cafe a la semana.',
  '59 euros/6 meses',
  'calendar',
  'from-blue-500 via-indigo-500 to-purple-500',
  2
),
(
  'urgency',
  'Tu plaza no te esperara',
  'El tiempo corre en tu contra',
  'Cada dia que pasa sin prepararte es un dia que otros te adelantan.',
  'Actua ahora',
  'clock',
  'from-red-500 via-orange-500 to-amber-500',
  1
),
(
  'competition',
  'Otros ya estan estudiando',
  'Mientras tu esperas a manana',
  'Los que aprueban no se limitan. Hacen mas preguntas, no menos.',
  'No te quedes atras',
  'users',
  'from-purple-500 via-pink-500 to-rose-500',
  1
),
(
  'future',
  'Imagina tu vida con plaza fija',
  'Estabilidad, tranquilidad, futuro',
  'Sueldo fijo, vacaciones, pension asegurada. Todo por prepararte bien.',
  'Tu futuro te espera',
  'star',
  'from-amber-500 via-yellow-500 to-orange-500',
  1
),
(
  'practice',
  'La version gratis esta bien para probar',
  'Pero para aprobar necesitas mas',
  '25 preguntas al dia no son suficientes para dominar el temario.',
  'Pasa al siguiente nivel',
  'rocket',
  'from-cyan-500 via-blue-500 to-indigo-500',
  1
),
(
  'investment',
  'Es una inversion, no un gasto',
  'El retorno es tu plaza fija',
  'Un funcionario gana mas de 20.000 euros al ano. Esto es el 0.3% de tu primer sueldo.',
  'Invierte en ti',
  'chart',
  'from-emerald-500 via-green-500 to-lime-500',
  1
),
(
  'regret',
  'No quieras arrepentirte luego',
  'Cuando veas que no aprobaste',
  'Los que suspenden siempre dicen: deberia haber estudiado mas.',
  'Evita el arrepentimiento',
  'warning',
  'from-slate-600 via-gray-600 to-zinc-600',
  1
)
ON CONFLICT (message_key) DO NOTHING;

-- Comentarios
COMMENT ON TABLE upgrade_messages IS 'Mensajes para el modal de upgrade con A/B testing';
COMMENT ON TABLE upgrade_message_impressions IS 'Tracking de impresiones y conversiones de mensajes';
COMMENT ON VIEW admin_upgrade_message_stats IS 'Estadisticas de rendimiento de cada mensaje';
