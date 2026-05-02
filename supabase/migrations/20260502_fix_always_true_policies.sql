-- Migration: fix_always_true_policies
-- 2026-05-02
--
-- Cierra 2 de las 3 policies "rls_policy_always_true" más críticas del
-- Supabase Advisor. La 3ª (payout_transfers) requiere refactor de
-- /admin/cobros + /armando (anotado como tarea pendiente).
--
-- ============================================================================
-- A) user_test_favorites — policy ALL true → per-user
-- ============================================================================
-- 157 filas. Todos los accesos del código son via Drizzle/getDb (rol postgres
-- → bypass RLS). Cero accesos browser via supabase-js. Defensa en profundidad:
-- policy per-user para que si en el futuro se consume desde browser, RLS
-- proteja automáticamente.

DROP POLICY IF EXISTS "Allow all operations" ON public.user_test_favorites;

CREATE POLICY "users_manage_own_test_favorites" ON public.user_test_favorites
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Revocar anon (favoritos requieren autenticación)
REVOKE ALL ON public.user_test_favorites FROM anon;

-- Authenticated: SELECT/INSERT/UPDATE/DELETE (filtrado por policy), no TRUNCATE/REFERENCES/TRIGGER
REVOKE ALL ON public.user_test_favorites FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_test_favorites TO authenticated;

-- service_role: garantizar SELECT (idempotente)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_test_favorites TO service_role;

-- ============================================================================
-- B) payment_settlements — policies public read+update → solo service_role
-- ============================================================================
-- 186 filas con datos financieros sensibles (user_email, stripe_customer_id,
-- importes brutos/netos por pago). Antes: cualquier user con anon key podía
-- leer Y modificar settlements (UPDATE public true).
--
-- Consumers:
--   - app/api/stripe/webhook/route.ts → SUPABASE_SERVICE_ROLE_KEY → bypass RLS
--   - lib/api/admin-delete-user/queries.ts → Drizzle → bypass RLS
-- Cero accesos browser legítimos.

DROP POLICY IF EXISTS "Allow public read on payment_settlements" ON public.payment_settlements;
DROP POLICY IF EXISTS "Allow public update on payment_settlements" ON public.payment_settlements;

-- Sin policies para anon/authenticated → cero acceso desde el browser via
-- PostgREST. Solo service_role (uso server-side) y postgres (Drizzle, bypass).
REVOKE ALL ON public.payment_settlements FROM anon, authenticated;

-- service_role: garantizar todos los privilegios
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_settlements TO service_role;
