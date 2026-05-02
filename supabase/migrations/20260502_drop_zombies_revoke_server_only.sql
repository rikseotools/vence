-- Migration: drop_zombies_revoke_server_only
-- 2026-05-02
--
-- Cierra warnings del Supabase Security Advisor sin tocar lógica de negocio:
--
-- GRUPO 1 — DROP funciones zombie (cero callsites)
--   Auditoría confirmó que estas funciones no se invocan desde:
--     - Código JS/TS (grep en app/ lib/ components/ hooks/ contexts/ scripts/)
--     - Otras funciones SQL (búsqueda en pg_proc.prosrc)
--     - Triggers (búsqueda en pg_trigger)
--   Riesgo de DROP: cero.
--
--   - update_user_progress(p_user_id uuid, p_test_id uuid)
--     IDOR potencial: no validaba p_user_id == auth.uid().
--
--   - complete_user_onboarding(...)  (2 versiones)
--     IDOR potencial: ninguna validaba p_user_id == auth.uid(); la versión con
--     ciudad incluso CREABA un user_profiles para un user_id arbitrario.
--     La app actual usa lib/api/v2/complete-onboarding/queries.ts (Drizzle ORM
--     directo via endpoint server-side autenticado), no estas RPCs.
--
-- GRUPO 2 — REVOKE EXECUTE en funciones server-only
--   Estas funciones solo se invocan con service_role desde server-side
--   (verificado por grep). authenticated/anon no tienen ningún caso de uso
--   legítimo. service_role mantiene su EXECUTE explícito (es OWNER granteado).
--
--   - update_article_embedding(article_id uuid, embedding_json text)
--     Único caller: scripts/fix-embeddings.cjs con SUPABASE_SERVICE_ROLE_KEY.
--     Sin REVOKE, cualquier authenticated podía sobrescribir embeddings de
--     cualquier artículo y romper la búsqueda semántica.
--     (anon ya estaba revocado por 20260502_revoke_anon_admin_functions.sql)
--
--   - mark_upgrade_conversion(p_user_id uuid)
--     Único caller: app/api/stripe/webhook/route.ts (server-side).
--
--   - refresh_user_theme_performance_cache(p_user_id uuid)
--     Único caller: app/api/cron/refresh-theme-cache/route.js (cron server).
--
-- Idempotente. No incluye increment_daily_questions: pendiente de auditoría
-- a fondo del modelo freemium en sesión separada.

-- ============================================================
-- GRUPO 1: DROP funciones zombie
-- ============================================================

DROP FUNCTION IF EXISTS public.update_user_progress(p_user_id uuid, p_test_id uuid);

DROP FUNCTION IF EXISTS public.complete_user_onboarding(
  p_user_id uuid,
  p_target_oposicion text,
  p_target_oposicion_data jsonb,
  p_age integer,
  p_gender text,
  p_daily_study_hours integer
);

DROP FUNCTION IF EXISTS public.complete_user_onboarding(
  p_user_id uuid,
  p_target_oposicion text,
  p_target_oposicion_data jsonb,
  p_age integer,
  p_gender text,
  p_daily_study_hours integer,
  p_ciudad text
);

-- ============================================================
-- GRUPO 2: REVOKE EXECUTE en funciones server-only
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.update_article_embedding(article_id uuid, embedding_json text)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.mark_upgrade_conversion(p_user_id uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.refresh_user_theme_performance_cache(p_user_id uuid)
  FROM PUBLIC, anon, authenticated;
