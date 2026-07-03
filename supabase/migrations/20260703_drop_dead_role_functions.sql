-- Drop de 2 funciones RBAC muertas que usan auth.* (no portables a RDS/Neon).
-- Sistema user_roles abandonado: la autorización admin va por allowlist de email
-- (lib/auth/adminEmails.isAdminEmail), no por roles en BD.
-- Verificado 2026-07-03 contra prod:
--   - assign_role: 0 código, 0 RLS, 0 funciones lo llaman (solo él llama a is_current_user_admin).
--   - get_current_user_roles: 0 código, 0 RLS, 0 funciones. Dead total.
-- Reduce el blocker "3 fns auth.*" del §3.1 a solo is_current_user_admin (+ sus 2 RLS
-- de user_roles), que se retira con C4 (drop RLS).
-- Firmas reales verificadas contra prod al aplicar.
DROP FUNCTION IF EXISTS public.assign_role(p_user_id uuid, p_role text, p_notes text);
DROP FUNCTION IF EXISTS public.get_current_user_roles();
