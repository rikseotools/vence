-- Migration: revoke_admin_rpcs (Fase C.3 — última de C)
-- 2026-05-02
--
-- Cierra los 8 issues finales del Advisor (4 RPCs × anon + authenticated)
-- en funciones SECURITY DEFINER admin-only que se siguen llamando desde
-- el browser (Fase C.2 las dejó intactas para no romper UI).
--
-- Refactor previo (commit asociado en este push):
--   1) get_subscription_count: ya solo se llama via service_role en
--      app/api/admin/email-events/route.ts. Cero cambios de código.
--   2) get_disputes_with_users_debug: solo via service_role en
--      app/api/v2/admin/disputes/route.ts. Cero cambios.
--   3) get_all_users_with_subscriptions: refactor browser →
--      GET /api/admin/users/subscriptions con requireAdmin + service_role.
--   4) get_user_conversion_journey: refactor browser →
--      GET /api/admin/conversions/user-journey con requireAdmin + service_role.
--
-- Tras este refactor, NINGUNA de las 4 se llama vía cliente authenticated
-- desde el browser. Solo via service_role server-side.
--
-- REVOKE EXECUTE FROM PUBLIC, anon, authenticated. service_role mantiene
-- grant explícito (verificado: 213/213 funciones DEFINER del schema lo tienen).
--
-- Idempotente.

REVOKE EXECUTE ON FUNCTION public.get_all_users_with_subscriptions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_disputes_with_users_debug() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_subscription_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_conversion_journey(p_user_id uuid) FROM PUBLIC, anon, authenticated;
