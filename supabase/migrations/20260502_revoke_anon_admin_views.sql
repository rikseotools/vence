-- Migration: revoke_anon_admin_views (Fase 1 del fix de Security Definer Views)
-- 2026-05-02
--
-- 16 views administrativas estaban con `GRANT ALL TO anon, authenticated`
-- (incluido TRUNCATE) y SECURITY DEFINER (default). Esto permite a cualquier
-- user con la anon key (pública en el JS bundle) leer y BORRAR datos admin.
--
-- Ejemplos de exposición:
--   - SELECT * FROM admin_users_with_roles  → todos los users con tests
--   - SELECT * FROM settlement_summary       → datos financieros de pagos
--   - SELECT * FROM ai_chat_traces_summary   → logs de chat IA
--   - TRUNCATE admin_disputes_dashboard     → ataque destructivo
--
-- ESTA MIGRACIÓN (Fase 1) — defensa inmediata, sin tocar security_invoker:
--   - REVOKE INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER de anon y authenticated
--   - REVOKE SELECT de anon (admin views no se exponen anónimamente)
--   - Mantiene GRANT SELECT a authenticated (hay 2 componentes admin browser
--     consumiendo: app/admin/conversiones/page.tsx y components/UserProfileModal.js).
--   - Mantiene GRANT a service_role (los endpoints API server-side los usan).
--
-- FASE 2 (pendiente, requiere refactor):
--   - Cambiar a security_invoker=true para cerrar el aviso del Advisor.
--   - Requiere crear policies admin en tablas subyacentes O migrar los 2
--     componentes browser a /api/admin/* endpoints con service_role.
--
-- Idempotente: REVOKE en privilegio inexistente es no-op.

-- Lista exhaustiva de las 16 views afectadas
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
    -- Revocar todo de anon (no debe leer NI escribir admin views)
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', v);

    -- Revocar privilegios destructivos de authenticated (TRUNCATE, INSERT,
    -- UPDATE, DELETE, REFERENCES, TRIGGER) — admin views son de solo lectura
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM authenticated', v);

    -- Mantener SELECT para authenticated (hay componentes admin que lo necesitan).
    -- Re-conceder por idempotencia (no falla si ya estaba).
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', v);

    -- service_role mantiene todos los privilegios (uso server-side)
    EXECUTE format('GRANT SELECT ON public.%I TO service_role', v);
  END LOOP;
END $$;
