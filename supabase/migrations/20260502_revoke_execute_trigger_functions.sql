-- Migration: revoke_execute_trigger_functions (Fase C.1)
-- 2026-05-02
--
-- Cierra 14 issues del Advisor (7 funciones × 2: anon_executable +
-- authenticated_executable) en 7 trigger functions SECURITY DEFINER que
-- retornan tipo `trigger`.
--
-- Las trigger functions se ejecutan vía triggers (en el contexto del trigger),
-- no como RPC. No tiene sentido que sean ejecutables vía /rest/v1/rpc/X por
-- PostgREST. Si lo son y son SECURITY DEFINER, un atacante puede invocarlas
-- directamente y ejecutar su código con privilegios de postgres
-- (típicamente modificando filas que el trigger no esperaba).
--
-- Funciones afectadas:
--   - create_public_user_profile  (no-attached, legacy)
--   - create_user_avatar_settings_on_profile  (attached)
--   - handle_new_user  (attached - clave en signup)
--   - log_plan_type_change  (attached)
--   - notify_temario_change  (no-attached, legacy)
--   - sync_ciudad_to_public  (no-attached, legacy)
--   - update_public_user_profile  (no-attached, legacy)
--
-- Riesgo cero: cuando el trigger las invoca, NO necesita GRANT EXECUTE en
-- la función — el trigger ejecuta en el contexto interno de Postgres.
-- REVOKE EXECUTE solo bloquea la invocación directa vía PostgREST/RPC.
--
-- Idempotente.

REVOKE EXECUTE ON FUNCTION public.create_public_user_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_user_avatar_settings_on_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_plan_type_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_temario_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_ciudad_to_public() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_public_user_profile() FROM PUBLIC, anon, authenticated;
