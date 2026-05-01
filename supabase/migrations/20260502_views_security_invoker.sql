-- Migration: views_security_invoker (Fase 2 del fix de Security Definer Views)
-- 2026-05-02
--
-- Cierra los 16 issues "Security Definer View" del Supabase Advisor.
--
-- En PostgreSQL, las views por default son SECURITY DEFINER: se ejecutan
-- como el OWNER (postgres), bypassando RLS de tablas subyacentes. Si la
-- view tiene grants a anon/authenticated, esos roles ven datos que RLS
-- de las tablas debería proteger.
--
-- Cambios:
--   A) ALTER VIEW SET (security_invoker = on) en las 16 views:
--      - La view se ejecuta como el CALLER, no como postgres
--      - RLS de tablas subyacentes aplica
--      - service_role sigue con bypass (BYPASSRLS attribute del rol)
--      - postgres (Drizzle/getAdminDb) sigue con bypass (BYPASSRLS)
--
--   B) REVOKE SELECT FROM authenticated en las 16 views:
--      - Tras Fase 1 (commit 36311fd1) authenticated solo tenía SELECT
--      - Tras refactor (commit anterior en este push):
--        - app/admin/conversiones/page.tsx ya NO consulta las views
--          directamente — usa /api/admin/conversions/views (service_role)
--        - components/UserProfileModal.js ya NO consulta admin_users_with_roles
--          (era un PII leak — eliminado el fallback)
--      - Ningún componente browser consume estas views ahora
--      - Cierre defensivo: revocar SELECT a authenticated cierra el vector
--
-- Después de esta migración:
--   - anon: cero acceso (Fase 1)
--   - authenticated: cero acceso (Fase 2)
--   - service_role: SELECT + bypass RLS (uso server-side via supabase-js admin)
--   - postgres: SELECT + bypass RLS (uso server-side via Drizzle)
--
-- Idempotente: ALTER VIEW SET y REVOKE son no-op si ya están aplicados.

DO $$
DECLARE
  v text;
  views text[] := ARRAY[
    'admin_disputes_dashboard',
    'admin_email_analytics',
    'admin_notification_analytics',
    'admin_pwa_stats',
    'admin_role_stats',
    'admin_share_analytics',
    'admin_upgrade_message_stats',
    'admin_users_with_roles',
    'ai_chat_traces_summary',
    'conversion_funnel_stats',
    'conversion_time_analysis',
    'hot_articles_dashboard',
    'prediction_accuracy_by_method',
    'prediction_history',
    'settlement_summary',
    'users_needing_notifications'
  ];
BEGIN
  FOREACH v IN ARRAY views LOOP
    -- A) Cambiar a security_invoker (RLS de tablas subyacentes aplica al caller)
    EXECUTE format('ALTER VIEW public.%I SET (security_invoker = on)', v);

    -- B) Revocar SELECT a authenticated (browser ya no las consume)
    EXECUTE format('REVOKE SELECT ON public.%I FROM authenticated', v);

    -- service_role: garantizar SELECT (idempotente — ya lo tiene desde Fase 1)
    EXECUTE format('GRANT SELECT ON public.%I TO service_role', v);
  END LOOP;
END $$;
