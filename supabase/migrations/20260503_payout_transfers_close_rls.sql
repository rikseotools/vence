-- Migration: payout_transfers_close_rls
-- 2026-05-03
--
-- Cierre final del refactor de payout_transfers iniciado en commit 25d9a175
-- (2 may 2026) que migró /armando y /admin/cobros a usar APIs server-side
-- con service_role en lugar de Supabase JS client con anon/authenticated key.
--
-- Estado pre-migración (datos del Supabase Database Linter):
-- - 2 políticas RLS permissive abiertas:
--   * anon_full_access: USING (true), CHECK (true), CMD ALL para anon
--   * authenticated_full_access: USING (true), CHECK (true), CMD ALL para authenticated
-- - 7 grants completos (SELECT, INSERT, UPDATE, DELETE, etc.) a anon
-- - 7 grants completos a authenticated
--
-- Esto era una FUGA SEVERA: cualquier visitante anónimo podía leer/modificar
-- todos los payouts (datos financieros sensibles).
--
-- Auditoría 2026-05-03:
-- - 4 endpoints /api/finance/transfers/* todos usan getArmandoSupabaseAdmin()
--   (service_role)
-- - 0 callers de Supabase JS client (browser) sobre payout_transfers
-- - 0 queries en pg_stat_statements desde reset 07:23 UTC (3+h tráfico real)
-- - Comentarios en app/admin/cobros/page.tsx:51 y app/armando/page.tsx:9
--   ya anticipan el cierre del RLS
--
-- Esta migración:
-- 1. DROP las 2 políticas permissive
-- 2. REVOKE todos los grants a anon y authenticated
-- 3. service_role mantiene grants intactos (bypass RLS por defecto en Supabase)
-- 4. RLS sigue ENABLED en la tabla (la default de Supabase)
--
-- Resultado: solo service_role (vía endpoints API server-side) puede
-- acceder a payout_transfers. anon/authenticated → bloqueados.
--
-- Idempotente.

-- 1. Drop políticas permissive
DROP POLICY IF EXISTS "anon_full_access" ON public.payout_transfers;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.payout_transfers;

-- 2. Revoke grants completos
REVOKE ALL ON public.payout_transfers FROM anon;
REVOKE ALL ON public.payout_transfers FROM authenticated;

-- 3. RLS debe seguir enabled (default Supabase). Aseguramos:
ALTER TABLE public.payout_transfers ENABLE ROW LEVEL SECURITY;

-- Verificación post-aplicación (no ejecutable en migración, solo doc):
--   SELECT polname FROM pg_policy WHERE polrelid = 'payout_transfers'::regclass;
--   → Esperado: 0 políticas (solo service_role accede via bypass RLS)
--   SELECT grantee FROM information_schema.table_privileges
--     WHERE table_name = 'payout_transfers'
--     AND grantee IN ('anon', 'authenticated');
--   → Esperado: 0 filas
