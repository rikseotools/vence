-- =====================================================
-- SISTEMA DE MENSAJES MOTIVACIONALES PERSONALIZADOS
-- Con likes, shares y analytics completos
-- =====================================================

-- Tabla principal de mensajes motivacionales
CREATE TABLE IF NOT EXISTS motivational_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Categorización
  category text NOT NULL, -- 'daily_progress', 'exam_result', 'streak', 'loading', 'achievement', 'welcome'
  subcategory text, -- 'morning', 'afternoon', 'night', 'weekend', 'high_score', 'low_score'

  -- Contenido del mensaje (con placeholders: {nombre}, {ciudad}, {dias})
  message_variants jsonb NOT NULL, -- ["Mensaje 1", "Mensaje 2", "Mensaje 3"]

  -- Personalización demográfica
  gender_target text DEFAULT 'neutral', -- 'male', 'female', 'neutral', 'any'
  region_target text[], -- ['Madrid', 'Barcelona', 'Valencia'] o NULL para todas

  -- Condiciones de activación
  min_accuracy numeric, -- Mostrar solo si accuracy >= X
  max_accuracy numeric, -- Mostrar solo si accuracy <= X
  min_streak integer, -- Mostrar solo si racha >= X
  max_streak integer, -- Mostrar solo si racha <= X
  time_of_day text[], -- ['morning', 'afternoon', 'night']
  day_of_week integer[], -- [1,2,3,4,5,6,7] (1=Lunes, 7=Domingo)

  -- Metadata visual
  emoji text NOT NULL DEFAULT '💪',
  tone text NOT NULL DEFAULT 'motivational', -- 'motivational', 'celebratory', 'supportive', 'urgent', 'friendly'
  color_scheme text DEFAULT 'blue', -- 'blue', 'green', 'yellow', 'red', 'purple'

  -- Control de frecuencia
  priority integer DEFAULT 1, -- Mayor número = más frecuente (1-10)
  max_shows_per_user integer DEFAULT NULL, -- NULL = ilimitado
  cooldown_hours integer DEFAULT 0, -- Horas antes de poder mostrarse de nuevo al mismo usuario

  -- Estado
  is_active boolean DEFAULT true,

  -- Analytics (se actualizan automáticamente)
  total_views integer DEFAULT 0,
  total_likes integer DEFAULT 0,
  total_shares integer DEFAULT 0,
  like_rate numeric DEFAULT 0.00, -- Calculado automáticamente
  share_rate numeric DEFAULT 0.00,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de interacciones de usuarios con mensajes
CREATE TABLE IF NOT EXISTS user_message_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES motivational_messages(id) ON DELETE CASCADE,

  -- Tipo de interacción
  action_type text NOT NULL, -- 'view', 'like', 'unlike', 'share'

  -- Contexto de la interacción
  shown_in text, -- 'dashboard', 'exam_result', 'loading', 'notification'
  message_text text, -- El mensaje exacto que se mostró (con variables reemplazadas)

  -- Info del share
  share_platform text, -- 'twitter', 'facebook', 'whatsapp', 'linkedin', 'copy'

  -- Metadata
  device_info jsonb DEFAULT '{}',

  created_at timestamptz DEFAULT now(),

  -- Un usuario solo puede dar like una vez por mensaje
  UNIQUE(user_id, message_id, action_type)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_motivational_messages_category ON motivational_messages(category);
CREATE INDEX IF NOT EXISTS idx_motivational_messages_active ON motivational_messages(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_message_interactions_user ON user_message_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_message_interactions_message ON user_message_interactions(message_id);
CREATE INDEX IF NOT EXISTS idx_user_message_interactions_action ON user_message_interactions(action_type);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_motivational_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER motivational_messages_updated_at
  BEFORE UPDATE ON motivational_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_motivational_messages_updated_at();

-- Trigger para actualizar analytics automáticamente
CREATE OR REPLACE FUNCTION update_message_analytics()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.action_type = 'view' THEN
    UPDATE motivational_messages
    SET
      total_views = total_views + 1,
      like_rate = CASE WHEN total_views + 1 > 0 THEN (total_likes::numeric / (total_views + 1)) * 100 ELSE 0 END,
      share_rate = CASE WHEN total_views + 1 > 0 THEN (total_shares::numeric / (total_views + 1)) * 100 ELSE 0 END
    WHERE id = NEW.message_id;

  ELSIF NEW.action_type = 'like' THEN
    UPDATE motivational_messages
    SET
      total_likes = total_likes + 1,
      like_rate = CASE WHEN total_views > 0 THEN ((total_likes + 1)::numeric / total_views) * 100 ELSE 0 END
    WHERE id = NEW.message_id;

  ELSIF NEW.action_type = 'unlike' THEN
    UPDATE motivational_messages
    SET
      total_likes = GREATEST(0, total_likes - 1),
      like_rate = CASE WHEN total_views > 0 THEN (GREATEST(0, total_likes - 1)::numeric / total_views) * 100 ELSE 0 END
    WHERE id = NEW.message_id;

  ELSIF NEW.action_type = 'share' THEN
    UPDATE motivational_messages
    SET
      total_shares = total_shares + 1,
      share_rate = CASE WHEN total_views > 0 THEN ((total_shares + 1)::numeric / total_views) * 100 ELSE 0 END
    WHERE id = NEW.message_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_message_analytics_trigger
  AFTER INSERT ON user_message_interactions
  FOR EACH ROW
  EXECUTE FUNCTION update_message_analytics();

-- RLS Policies
ALTER TABLE motivational_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_message_interactions ENABLE ROW LEVEL SECURITY;

-- Todos pueden leer mensajes activos
CREATE POLICY "Anyone can read active messages"
  ON motivational_messages FOR SELECT
  USING (is_active = true);

-- Solo admins pueden crear/editar mensajes
CREATE POLICY "Only admins can manage messages"
  ON motivational_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
      AND user_roles.is_active = true
    )
  );

-- Usuarios pueden ver sus propias interacciones
CREATE POLICY "Users can read own interactions"
  ON user_message_interactions FOR SELECT
  USING (auth.uid() = user_id);

-- Usuarios pueden crear sus propias interacciones
CREATE POLICY "Users can create own interactions"
  ON user_message_interactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Usuarios pueden actualizar sus propias interacciones (para unlike)
CREATE POLICY "Users can update own interactions"
  ON user_message_interactions FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins pueden ver todas las interacciones
CREATE POLICY "Admins can read all interactions"
  ON user_message_interactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
      AND user_roles.is_active = true
    )
  );

COMMENT ON TABLE motivational_messages IS 'Mensajes motivacionales personalizables con sistema de likes y shares';
COMMENT ON TABLE user_message_interactions IS 'Tracking de interacciones de usuarios con mensajes motivacionales';
