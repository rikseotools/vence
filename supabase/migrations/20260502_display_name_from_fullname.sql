-- Migration: display_name_from_fullname
-- 2026-05-02
--
-- Mejora del trigger sync_nickname_simple:
--   Antes: display_name = COALESCE(NEW.nickname, 'Usuario')
--   Ahora: display_name = nickname custom > primer nombre de full_name > 'Usuario'
--
-- Recupera el nombre legible para el RankingModal sin exponer PII (apellidos
-- completos, email). Solo primer token del full_name.
--
-- Tras eliminar el fallback PII en UserProfileModal.js (commit 46a5de24),
-- 92.5% de users (3984/4303) mostraban "Usuario" en el ranking porque el
-- trigger sync_nickname_simple solo usaba `nickname` (NULL para users de
-- Google OAuth/email signup, que solo tienen full_name). Esta migración
-- corrige eso usando full_name como fallback.
--
-- Casos:
--   - User con nickname='maria_rocks' (custom)        → 'maria_rocks' (sin cambio)
--   - User con full_name='María Pérez', nickname=NULL → 'María' (NUEVO, antes 'Usuario')
--   - User con full_name='ignacio vélez bermejo'      → 'Ignacio' (NUEVO, initcap aplicado)
--   - User sin full_name ni nickname                  → 'Usuario' (igual que antes)
--
-- NO toca users que ya tienen display_name custom (preserva personalizaciones).
-- Idempotente.

-- ============================================================================
-- 1) Función helper derive_display_name (utility IMMUTABLE, reusable)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.derive_display_name(p_nickname text, p_full_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    -- 1. nickname custom (no vacío, no genérico "Usuario")
    CASE
      WHEN p_nickname IS NOT NULL
        AND length(trim(p_nickname)) > 0
        AND p_nickname <> 'Usuario'
      THEN p_nickname
      ELSE NULL
    END,
    -- 2. Primer token (nombre) de full_name, capitalizado
    CASE
      WHEN p_full_name IS NOT NULL AND length(trim(p_full_name)) > 0
      THEN initcap(split_part(trim(p_full_name), ' ', 1))
      ELSE NULL
    END,
    -- 3. Fallback final
    'Usuario'
  )
$$;

-- ============================================================================
-- 2) Reemplazar sync_nickname_simple (mantiene mismo trigger,
--    misma signature, solo mejora la lógica del display_name)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_nickname_simple()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public_user_profiles
  SET
    display_name = derive_display_name(NEW.nickname, NEW.full_name),
    updated_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 3) Backfill — solo users con full_name y display_name genérico
--    NO toca users que ya tienen display_name custom
-- ============================================================================
UPDATE public_user_profiles pup
SET
  display_name = derive_display_name(up.nickname, up.full_name),
  updated_at = NOW()
FROM user_profiles up
WHERE pup.id = up.id
  AND (pup.display_name IS NULL OR pup.display_name = 'Usuario')
  AND up.full_name IS NOT NULL
  AND length(trim(up.full_name)) > 0;
