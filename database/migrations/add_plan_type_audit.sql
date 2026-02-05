-- ============================================================
-- AUDIT LOG PARA CAMBIOS DE PLAN_TYPE
-- Registra cada cambio de plan_type en user_profiles
-- para debugging de inconsistencias
-- ============================================================

-- 1. TABLA DE AUDIT
-- ============================================================
CREATE TABLE IF NOT EXISTS plan_type_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT,
  old_plan_type TEXT,
  new_plan_type TEXT,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Contexto adicional para debugging
  trigger_source TEXT DEFAULT 'database_trigger'
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_plan_audit_user_id ON plan_type_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_audit_changed_at ON plan_type_audit_log(changed_at DESC);

-- RLS: Solo admins pueden ver el audit log
ALTER TABLE plan_type_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log" ON plan_type_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (plan_type = 'admin' OR email = 'manueltrader@gmail.com')
    )
  );

-- 2. TRIGGER FUNCTION (con manejo de errores)
-- ============================================================
CREATE OR REPLACE FUNCTION log_plan_type_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo registrar si plan_type realmente cambió
  IF OLD.plan_type IS DISTINCT FROM NEW.plan_type THEN
    BEGIN
      INSERT INTO plan_type_audit_log (
        user_id,
        user_email,
        old_plan_type,
        new_plan_type,
        changed_at
      ) VALUES (
        NEW.id,
        NEW.email,
        OLD.plan_type,
        NEW.plan_type,
        NOW()
      );
    EXCEPTION WHEN OTHERS THEN
      -- Si falla el audit log, NO bloquear el cambio principal
      -- Solo loguear el error (visible en logs de Supabase)
      RAISE WARNING 'Error logging plan_type change for user %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. CREAR TRIGGER (AFTER UPDATE para no bloquear)
-- ============================================================
DROP TRIGGER IF EXISTS trigger_log_plan_type_change ON user_profiles;

CREATE TRIGGER trigger_log_plan_type_change
  AFTER UPDATE OF plan_type ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION log_plan_type_change();

-- ============================================================
-- NOTAS:
--
-- Consultar cambios de un usuario:
--   SELECT * FROM plan_type_audit_log
--   WHERE user_id = 'uuid'
--   ORDER BY changed_at DESC;
--
-- Ver cambios recientes (últimas 24h):
--   SELECT * FROM plan_type_audit_log
--   WHERE changed_at > NOW() - INTERVAL '24 hours'
--   ORDER BY changed_at DESC;
--
-- Detectar degradaciones sospechosas:
--   SELECT * FROM plan_type_audit_log
--   WHERE old_plan_type = 'premium' AND new_plan_type = 'free'
--   ORDER BY changed_at DESC;
-- ============================================================
