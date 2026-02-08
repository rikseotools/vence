-- ============================================================
-- FIX: Proteger plan_type en RPCs de creación de usuarios
--
-- PROBLEMA: Las RPCs create_organic_user, create_google_ads_user,
-- y create_meta_ads_user usaban ON CONFLICT DO UPDATE que sobrescribía
-- plan_type, causando que usuarios premium fueran degradados a free.
--
-- SOLUCIÓN: Modificar las RPCs para que:
-- 1. Solo establezcan plan_type en INSERT (usuarios nuevos)
-- 2. En ON CONFLICT, NO actualicen plan_type
-- 3. Solo actualicen campos seguros (nombre, avatar, etc.)
--
-- FECHA: 2026-02-08
-- ============================================================

-- ============================================================
-- 1. CREATE_ORGANIC_USER
-- ============================================================
CREATE OR REPLACE FUNCTION create_organic_user(
  user_id UUID,
  user_email TEXT,
  user_name TEXT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_profiles (
    id,
    email,
    full_name,
    registration_source,
    requires_payment,
    plan_type,
    created_at,
    updated_at
  ) VALUES (
    user_id,
    user_email,
    user_name,
    'organic',
    FALSE,
    'free',  -- Solo se establece en INSERT (usuario nuevo)
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    -- 🛡️ NUNCA actualizar plan_type - protege usuarios premium
    full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
    updated_at = NOW()
    -- registration_source NO se actualiza para preservar origen real
    -- plan_type NO se incluye para NUNCA degradar usuarios
  ;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. CREATE_GOOGLE_ADS_USER
-- ============================================================
CREATE OR REPLACE FUNCTION create_google_ads_user(
  user_id UUID,
  user_email TEXT,
  user_name TEXT,
  campaign_id TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_profiles (
    id,
    email,
    full_name,
    registration_source,
    requires_payment,
    plan_type,
    google_ads_campaign_id,
    created_at,
    updated_at
  ) VALUES (
    user_id,
    user_email,
    user_name,
    'google_ads',
    TRUE,
    'free',  -- Inicia como free, requiere pago
    campaign_id,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    -- 🛡️ NUNCA actualizar plan_type - protege usuarios premium
    full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
    google_ads_campaign_id = COALESCE(EXCLUDED.google_ads_campaign_id, user_profiles.google_ads_campaign_id),
    updated_at = NOW()
    -- registration_source NO se actualiza para preservar origen real
    -- plan_type NO se incluye para NUNCA degradar usuarios
    -- requires_payment NO se actualiza para no forzar pago a premium
  ;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. CREATE_META_ADS_USER
-- ============================================================
CREATE OR REPLACE FUNCTION create_meta_ads_user(
  user_id UUID,
  user_email TEXT,
  user_name TEXT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_profiles (
    id,
    email,
    full_name,
    registration_source,
    requires_payment,
    plan_type,
    created_at,
    updated_at
  ) VALUES (
    user_id,
    user_email,
    user_name,
    'meta_ads',
    FALSE,
    'free',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    -- 🛡️ NUNCA actualizar plan_type - protege usuarios premium
    full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
    updated_at = NOW()
    -- registration_source NO se actualiza para preservar origen real
    -- plan_type NO se incluye para NUNCA degradar usuarios
  ;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- Después de ejecutar, verificar con:
--
-- SELECT proname, prosrc
-- FROM pg_proc
-- WHERE proname IN ('create_organic_user', 'create_google_ads_user', 'create_meta_ads_user');
--
-- Confirmar que plan_type NO aparece en la sección ON CONFLICT DO UPDATE
-- ============================================================

-- ============================================================
-- NOTAS IMPORTANTES:
--
-- 1. El webhook de Stripe SIGUE pudiendo degradar usuarios:
--    Hace UPDATE directo, no usa estas RPCs.
--
-- 2. Usuarios nuevos SÍ reciben plan_type correcto:
--    El INSERT establece plan_type = 'free' para nuevos.
--
-- 3. Usuarios existentes NUNCA son degradados por estas RPCs:
--    El ON CONFLICT no toca plan_type.
--
-- 4. Si un usuario cancela su suscripción:
--    El webhook de Stripe (líneas 610, 697) hace el UPDATE directo
--    y SÍ cambia plan_type a 'free' cuando corresponde.
-- ============================================================
