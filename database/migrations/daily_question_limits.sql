-- ============================================================
-- SISTEMA DE LIMITES DIARIOS DE PREGUNTAS
-- Limita usuarios FREE a 25 preguntas/dia
-- Reset: Medianoche Europe/Madrid
-- ============================================================

-- 1. TABLA DE TRACKING DIARIO
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_question_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  questions_answered INTEGER DEFAULT 0,
  last_question_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  CONSTRAINT unique_user_date UNIQUE(user_id, usage_date)
);

-- Indice para busquedas rapidas
CREATE INDEX IF NOT EXISTS idx_daily_usage_user_date
ON daily_question_usage(user_id, usage_date DESC);

-- RLS Policies
ALTER TABLE daily_question_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own usage" ON daily_question_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage" ON daily_question_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage" ON daily_question_usage
  FOR UPDATE USING (auth.uid() = user_id);


-- 2. FUNCION: CONSULTAR ESTADO (sin incrementar)
-- ============================================================
CREATE OR REPLACE FUNCTION get_daily_question_status(p_user_id UUID)
RETURNS TABLE(
  questions_today INTEGER,
  questions_remaining INTEGER,
  daily_limit INTEGER,
  is_limit_reached BOOLEAN,
  is_premium BOOLEAN,
  reset_time TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan_type TEXT;
  v_today DATE;
  v_current_count INTEGER;
  v_is_premium BOOLEAN;
  v_limit INTEGER := 25;
BEGIN
  -- Fecha actual en Madrid
  v_today := (NOW() AT TIME ZONE 'Europe/Madrid')::DATE;

  -- Verificar tipo de plan del usuario
  SELECT up.plan_type INTO v_plan_type
  FROM user_profiles up
  WHERE up.id = p_user_id;

  -- Determinar si es premium (sin limite)
  v_is_premium := COALESCE(v_plan_type, 'free') IN ('premium', 'trial', 'legacy_free', 'premium_semester', 'admin');

  -- Si es premium, siempre puede responder
  IF v_is_premium THEN
    RETURN QUERY SELECT
      0::INTEGER,
      999::INTEGER,
      v_limit,
      FALSE::BOOLEAN,
      TRUE::BOOLEAN,
      ((v_today + INTERVAL '1 day')::TIMESTAMP AT TIME ZONE 'Europe/Madrid');
    RETURN;
  END IF;

  -- Obtener contador actual para usuarios free
  SELECT COALESCE(dqu.questions_answered, 0) INTO v_current_count
  FROM daily_question_usage dqu
  WHERE dqu.user_id = p_user_id AND dqu.usage_date = v_today;

  IF v_current_count IS NULL THEN
    v_current_count := 0;
  END IF;

  RETURN QUERY SELECT
    v_current_count,
    GREATEST(0, v_limit - v_current_count),
    v_limit,
    v_current_count >= v_limit,
    FALSE::BOOLEAN,
    ((v_today + INTERVAL '1 day')::TIMESTAMP AT TIME ZONE 'Europe/Madrid');
END;
$$;


-- 3. FUNCION: INCREMENTAR CONTADOR (atomica)
-- ============================================================
CREATE OR REPLACE FUNCTION increment_daily_questions(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  can_answer BOOLEAN,
  questions_today INTEGER,
  questions_remaining INTEGER,
  is_limit_reached BOOLEAN,
  is_premium BOOLEAN,
  reset_time TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan_type TEXT;
  v_today DATE;
  v_current_count INTEGER;
  v_is_premium BOOLEAN;
  v_reset_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Fecha actual en Madrid
  v_today := (NOW() AT TIME ZONE 'Europe/Madrid')::DATE;

  -- Calcular hora de reset (medianoche Madrid del dia siguiente)
  v_reset_time := (v_today + INTERVAL '1 day')::TIMESTAMP AT TIME ZONE 'Europe/Madrid';

  -- Verificar tipo de plan del usuario
  SELECT up.plan_type INTO v_plan_type
  FROM user_profiles up
  WHERE up.id = p_user_id;

  -- Determinar si es premium (sin limite)
  v_is_premium := COALESCE(v_plan_type, 'free') IN ('premium', 'trial', 'legacy_free', 'premium_semester', 'admin');

  -- Si es premium, siempre puede responder (no incrementar contador)
  IF v_is_premium THEN
    RETURN QUERY SELECT
      TRUE::BOOLEAN,
      0::INTEGER,
      999::INTEGER,
      FALSE::BOOLEAN,
      TRUE::BOOLEAN,
      v_reset_time;
    RETURN;
  END IF;

  -- Para usuarios free: insertar o actualizar contador
  -- Solo incrementa si no ha llegado al limite
  INSERT INTO daily_question_usage (user_id, usage_date, questions_answered, last_question_at, updated_at)
  VALUES (p_user_id, v_today, 1, NOW(), NOW())
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET
    questions_answered = CASE
      WHEN daily_question_usage.questions_answered < p_limit
      THEN daily_question_usage.questions_answered + 1
      ELSE daily_question_usage.questions_answered
    END,
    last_question_at = NOW(),
    updated_at = NOW();

  -- Obtener contador actualizado
  SELECT dqu.questions_answered INTO v_current_count
  FROM daily_question_usage dqu
  WHERE dqu.user_id = p_user_id AND dqu.usage_date = v_today;

  IF v_current_count IS NULL THEN
    v_current_count := 1;
  END IF;

  -- Retornar estado
  RETURN QUERY SELECT
    v_current_count <= p_limit,            -- can_answer
    v_current_count,                        -- questions_today
    GREATEST(0, p_limit - v_current_count), -- questions_remaining
    v_current_count >= p_limit,             -- is_limit_reached
    FALSE::BOOLEAN,                         -- is_premium
    v_reset_time;
END;
$$;


-- 4. TRIGGER PARA ACTUALIZAR updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_daily_usage_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_daily_usage_timestamp ON daily_question_usage;
CREATE TRIGGER trigger_daily_usage_timestamp
  BEFORE UPDATE ON daily_question_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_usage_timestamp();


-- 5. FUNCION DE LIMPIEZA (opcional, para GDPR)
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_old_daily_usage()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Eliminar registros de mas de 90 dias
  DELETE FROM daily_question_usage
  WHERE usage_date < (NOW() AT TIME ZONE 'Europe/Madrid')::DATE - INTERVAL '90 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


-- ============================================================
-- NOTAS DE USO:
--
-- Consultar estado sin incrementar:
--   SELECT * FROM get_daily_question_status('user-uuid-here');
--
-- Incrementar contador al responder:
--   SELECT * FROM increment_daily_questions('user-uuid-here');
--
-- Ver uso de un usuario hoy:
--   SELECT * FROM daily_question_usage
--   WHERE user_id = 'user-uuid'
--   AND usage_date = (NOW() AT TIME ZONE 'Europe/Madrid')::DATE;
-- ============================================================
