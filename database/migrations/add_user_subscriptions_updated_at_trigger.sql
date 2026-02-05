-- ============================================================
-- TRIGGER PARA ACTUALIZAR updated_at EN user_subscriptions
-- Asegura que updated_at se actualice automáticamente
-- ============================================================

-- 1. FUNCIÓN GENÉRICA (reutilizable)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. TRIGGER EN user_subscriptions
-- ============================================================
DROP TRIGGER IF EXISTS trigger_user_subscriptions_updated_at ON user_subscriptions;

CREATE TRIGGER trigger_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- NOTAS:
--
-- Este trigger asegura que cada UPDATE a user_subscriptions
-- automáticamente actualice el campo updated_at.
--
-- Útil para:
-- - Detectar cuándo se actualizó una suscripción
-- - Debugging de webhooks de Stripe
-- - Verificar si los eventos se procesaron correctamente
-- ============================================================
