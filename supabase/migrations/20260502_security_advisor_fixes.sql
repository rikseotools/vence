-- Migration: security_advisor_fixes
-- 2026-05-02
--
-- Cierra los 21 issues de seguridad reportados por el Supabase Advisor:
--
--   A) RLS desactivado en 3 tablas con datos personales (user_learning_analytics,
--      user_stats_summary, user_interactions_archive). Cualquier user con la
--      anon key (pública) podía SELECT/UPDATE/DELETE/TRUNCATE TODAS las filas.
--
--   B) 71 funciones SECURITY DEFINER sin `search_path` fijo. Vector clásico
--      de privilege escalation: un atacante con CREATE en pg_temp puede
--      shadowear nombres no calificados dentro de la función y ejecutar
--      código con los privilegios del owner (postgres).
--
-- Verificaciones previas (commit asociado documenta resultado):
--   - 0 accesos a las 3 tablas vía supabase-js cliente (.from(...) en
--     componentes, hooks o app/). Toda la app server-side las accede con
--     getDb()/getAdminDb() (rol postgres del DATABASE_URL → BYPASS RLS),
--     por tanto activar RLS no rompe nada server-side.
--   - El cron archive-interactions usa getAdminDb (rol postgres) → BYPASS
--     RLS al INSERT/DELETE en user_interactions_archive.
--   - El trigger update_user_stats_summary_trigger se ejecuta en el rol del
--     caller (Drizzle = postgres) → BYPASS RLS al INSERT/UPDATE.
--
-- Idempotente: re-ejecutable sin efectos.

-- ============================================================================
-- A) RLS — 3 tablas con datos personales
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A.1) user_learning_analytics — ya tenía 2 policies pero RLS desactivado.
--      Las 2 policies actuales (`Users can manage their own analytics` ALL +
--      `Users can view their own analytics` SELECT) son redundantes (ALL
--      cubre SELECT) y usan auth.uid() sin SELECT envolvente, lo que hace
--      que se evalúe POR FILA — costoso en seq scans.
--      Las reescribo: una sola policy ALL con (SELECT auth.uid()), TO
--      authenticated (skip eval para anon), WITH CHECK explícito.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own analytics" ON public.user_learning_analytics;
DROP POLICY IF EXISTS "Users can manage their own analytics" ON public.user_learning_analytics;

CREATE POLICY "users_manage_own_analytics" ON public.user_learning_analytics
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER TABLE public.user_learning_analytics ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- A.2) user_stats_summary — sin policies. Defensa en profundidad: policy
--      SELECT propio para que el día que algún componente cliente quiera
--      leer su stats, ya esté protegido. INSERT/UPDATE/DELETE NO se exponen
--      vía policy (los hace el trigger / postgres role server-side).
-- ----------------------------------------------------------------------------
ALTER TABLE public.user_stats_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_stats_summary" ON public.user_stats_summary;
CREATE POLICY "users_read_own_stats_summary" ON public.user_stats_summary
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ----------------------------------------------------------------------------
-- A.3) user_interactions_archive — sin policies. Mismo patrón. INSERT/DELETE
--      solo via cron con rol postgres (bypass RLS).
--      Tabla con 2.6M filas → (SELECT auth.uid()) crítico para evitar
--      eval por fila bajo seq scan.
-- ----------------------------------------------------------------------------
ALTER TABLE public.user_interactions_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_archived_interactions" ON public.user_interactions_archive;
CREATE POLICY "users_read_own_archived_interactions" ON public.user_interactions_archive
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ============================================================================
-- B) GRANTS — TRUNCATE/REFERENCES/TRIGGER NO se controlan por RLS
-- ============================================================================
-- Las 3 tablas tenían `GRANT ALL TO anon, authenticated` (incluido TRUNCATE).
-- Aunque RLS bloquea SELECT/INSERT/UPDATE/DELETE de filas ajenas, NO
-- bloquea TRUNCATE — un atacante con la anon key podía truncar las 3 tablas
-- enteras. Defensa explícita: revocar todo y conceder solo lo necesario.

-- user_learning_analytics: cliente authenticated puede SELECT/INSERT/UPDATE/DELETE
-- (filtrado por RLS); anon nada.
REVOKE ALL ON public.user_learning_analytics FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_learning_analytics TO authenticated;

-- user_stats_summary: cliente authenticated solo SELECT (filtrado por RLS);
-- escritura via trigger / server. anon nada.
REVOKE ALL ON public.user_stats_summary FROM anon, authenticated;
GRANT SELECT ON public.user_stats_summary TO authenticated;

-- user_interactions_archive: cliente authenticated solo SELECT (filtrado por
-- RLS); escritura solo via cron server-side. anon nada.
REVOKE ALL ON public.user_interactions_archive FROM anon, authenticated;
GRANT SELECT ON public.user_interactions_archive TO authenticated;

-- ============================================================================
-- C) search_path en 71 funciones SECURITY DEFINER
-- ============================================================================
-- Patrón aplicado: SET search_path = public, pg_temp.
-- pg_temp al final → ningún atacante puede precrear una función shadow en
-- pg_temp para interceptar nombres no calificados. public primero porque
-- es donde están todas las tablas que las funciones referencian.
-- Las funciones siguen ejecutándose como antes — esto solo congela el
-- search_path para que un caller malicioso no pueda manipularlo con
-- `SET search_path = ...` antes de invocarlas.

ALTER FUNCTION public.assign_role(p_user_id uuid, p_role text, p_notes text) SET search_path = public, pg_temp;
ALTER FUNCTION public.check_questions_availability(p_tema_number integer, p_difficulty_filter text) SET search_path = public, pg_temp;
ALTER FUNCTION public.cleanup_expired_unsubscribe_tokens() SET search_path = public, pg_temp;
ALTER FUNCTION public.complete_user_onboarding(p_user_id uuid, p_target_oposicion text, p_target_oposicion_data jsonb, p_age integer, p_gender text, p_daily_study_hours integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.complete_user_onboarding(p_user_id uuid, p_target_oposicion text, p_target_oposicion_data jsonb, p_age integer, p_gender text, p_daily_study_hours integer, p_ciudad text) SET search_path = public, pg_temp;
ALTER FUNCTION public.create_google_ads_user(user_id uuid, user_email text, user_name text, campaign_id text) SET search_path = public, pg_temp;
ALTER FUNCTION public.create_meta_ads_user(user_id uuid, user_email text, user_name text) SET search_path = public, pg_temp;
ALTER FUNCTION public.create_or_select_custom_oposicion(p_user_id uuid, p_nombre text, p_categoria text, p_administracion text, p_descripcion text, p_is_public boolean, p_created_by_username text) SET search_path = public, pg_temp;
ALTER FUNCTION public.create_organic_user(user_id uuid, user_email text, user_name text) SET search_path = public, pg_temp;
ALTER FUNCTION public.create_public_user_profile() SET search_path = public, pg_temp;
ALTER FUNCTION public.create_user_avatar_settings_on_profile() SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_test_by_topic(p_topic_id uuid, p_total_questions integer, p_difficulty_filter text) SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_unsubscribe_token(user_uuid uuid, user_email text, email_type_param text) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_accounts_on_device(p_device_id text) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_active_users_with_automatic_avatar(p_days_back integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_all_users_with_subscriptions() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_article_exam_history(p_article_id uuid, p_oposicion_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_article_exam_stats(p_article_id uuid, p_oposicion_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_article_questions(p_article_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_current_user_roles() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_daily_question_status(p_user_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_dashboard_stats() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_device_daily_usage(p_device_id text) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_disputes_with_users_debug() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_engagement_metrics() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_exam_date(p_oposicion_slug text) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_mastered_questions(p_user_id uuid, p_limit integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_oposicion_articles(p_oposicion_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_oposicion_coverage_stats(p_oposicion_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_personalized_recommendations(p_user_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_popular_custom_oposiciones(p_limit integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_question_exam_context_v2(p_question_id uuid, p_user_oposicion_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_question_stats_by_position(p_position_type text) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_random_upgrade_message(p_user_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_ranking_for_period(p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_min_questions integer, p_limit integer, p_offset integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_recent_tests_data(days_back integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_struggling_questions(p_user_id uuid, p_limit integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_subscription_count() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_tema_stats(p_tema_number integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_theme_performance_by_scope(p_user_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_topic_questions_simple(p_topic_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_topic_questions_v2(p_topic_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_complete_stats(p_user_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_conversion_journey(p_user_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_difficulty_metrics(p_user_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_progress_trends(p_user_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_public_stats(p_user_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_ranking_position(p_user_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_min_questions integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_share_stats(p_user_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.increment_daily_questions(p_user_id uuid, p_limit integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.is_current_user_admin() SET search_path = public, pg_temp;
ALTER FUNCTION public.log_plan_type_change() SET search_path = public, pg_temp;
ALTER FUNCTION public.mark_upgrade_conversion(p_user_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_temario_change() SET search_path = public, pg_temp;
ALTER FUNCTION public.process_unsubscribe_by_token(token_param text, unsubscribe_all_param boolean, specific_types_param text[]) SET search_path = public, pg_temp;
ALTER FUNCTION public.refresh_all_theme_performance_cache() SET search_path = public, pg_temp;
ALTER FUNCTION public.refresh_user_theme_performance_cache(p_user_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.search_available_oposiciones(p_search_term text) SET search_path = public, pg_temp;
ALTER FUNCTION public.search_convocatorias(search_term text, p_categoria text, p_tipo text, p_ambito text, p_ccaa text, p_provincia text, p_orden text, p_limit integer, p_offset integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.search_convocatorias_grouped(search_term text, p_categoria text, p_tipo text, p_ambito text, p_ccaa text, p_provincia text, p_orden text, p_limit integer, p_offset integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_ciudad_to_public() SET search_path = public, pg_temp;
ALTER FUNCTION public.track_conversion_event(p_user_id uuid, p_event_type text, p_event_data jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.track_upgrade_message_click(p_impression_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.track_upgrade_message_dismiss(p_impression_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.track_upgrade_message_shown(p_user_id uuid, p_message_id uuid, p_trigger_type text, p_questions_answered integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.update_article_embedding(article_id uuid, embedding_json text) SET search_path = public, pg_temp;
ALTER FUNCTION public.update_public_user_profile() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_user_progress(p_user_id uuid, p_test_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.user_has_role(p_user_id uuid, p_role text) SET search_path = public, pg_temp;
ALTER FUNCTION public.user_needs_onboarding(p_user_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.validate_unsubscribe_token(token_param text) SET search_path = public, pg_temp;
