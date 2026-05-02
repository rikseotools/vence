-- Migration: revoke_anon_admin_functions (Fase C.2)
-- 2026-05-02
--
-- Cierra ~50 issues "anon_security_definer_function_executable" del Supabase
-- Advisor en funciones SECURITY DEFINER que NO se llaman desde el browser.
--
-- Auditoría: grep `.rpc('X')` en components/, hooks/, app/ encontró 30 RPCs
-- llamadas por el cliente browser. Las 50 funciones de esta migración NO
-- aparecen en ese grep — son admin-only, cron-only, o invocadas únicamente
-- vía endpoints API server-side con service_role/Drizzle.
--
-- Estrategia: REVOKE EXECUTE FROM PUBLIC, anon. NO se toca authenticated
-- (defensa parcial — anon ya no puede invocar vía /rest/v1/rpc/X). Para
-- cerrar también `authenticated_security_definer_function_executable`
-- haría falta auditoría individual (algunas se invocan desde server-side
-- con cliente authenticated heredando el Bearer del user).
--
-- service_role mantiene su grant EXECUTE explícito (verificado: 213/213
-- funciones DEFINER tienen grant explícito a service_role en este schema).
-- postgres es OWNER y siempre puede ejecutar.
--
-- Idempotente.

-- Admin functions (gestión de roles, dashboards, métricas internas)
REVOKE EXECUTE ON FUNCTION public.assign_role(p_user_id uuid, p_role text, p_notes text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.batch_update_user_streaks() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.calculate_user_streak(p_user_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_unsubscribe_tokens() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_active_users_with_automatic_avatar(p_days_back integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_engagement_metrics() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_recent_tests_data(days_back integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.refresh_all_theme_performance_cache() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_article_embedding(article_id uuid, embedding_json text) FROM PUBLIC, anon;

-- Funciones internas (signup, ads tracking — invocadas desde server-side webhook)
REVOKE EXECUTE ON FUNCTION public.create_meta_ads_user(user_id uuid, user_email text, user_name text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_organic_user(user_id uuid, user_email text, user_name text) FROM PUBLIC, anon;

-- Test/onboarding helpers (invocados desde endpoints server, no desde browser)
REVOKE EXECUTE ON FUNCTION public.check_questions_availability(p_tema_number integer, p_difficulty_filter text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_user_onboarding(p_user_id uuid, p_target_oposicion text, p_target_oposicion_data jsonb, p_age integer, p_gender text, p_daily_study_hours integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_user_onboarding(p_user_id uuid, p_target_oposicion text, p_target_oposicion_data jsonb, p_age integer, p_gender text, p_daily_study_hours integer, p_ciudad text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_test_by_topic(p_topic_id uuid, p_total_questions integer, p_difficulty_filter text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_unsubscribe_token(user_uuid uuid, user_email text, email_type_param text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_accounts_on_device(p_device_id text) FROM PUBLIC, anon;

-- Article/exam queries (invocadas server-side, no via .rpc browser)
REVOKE EXECUTE ON FUNCTION public.get_article_exam_history(p_article_id uuid, p_oposicion_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_article_exam_stats(p_article_id uuid, p_oposicion_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_article_questions(p_article_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_question_exam_context_v2(p_question_id uuid, p_user_oposicion_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_question_stats_by_position(p_position_type text) FROM PUBLIC, anon;

-- Public queries (invocadas server-side desde landings con SSR)
REVOKE EXECUTE ON FUNCTION public.get_exam_date(p_oposicion_slug text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_oposicion_articles(p_oposicion_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_oposicion_coverage_stats(p_oposicion_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_tema_stats(p_tema_number integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.search_available_oposiciones(p_search_term text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.search_convocatorias(search_term text, p_categoria text, p_tipo text, p_ambito text, p_ccaa text, p_provincia text, p_orden text, p_limit integer, p_offset integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.search_convocatorias_grouped(search_term text, p_categoria text, p_tipo text, p_ambito text, p_ccaa text, p_provincia text, p_orden text, p_limit integer, p_offset integer) FROM PUBLIC, anon;

-- User-specific queries (invocadas server-side con userId del Bearer)
REVOKE EXECUTE ON FUNCTION public.get_current_user_roles() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_device_daily_usage(p_device_id text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_mastered_questions(p_user_id uuid, p_limit integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_personalized_recommendations(p_user_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_ranking_for_period(p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_min_questions integer, p_limit integer, p_offset integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_struggling_questions(p_user_id uuid, p_limit integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_theme_performance_by_scope(p_user_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_topic_questions_simple(p_topic_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_topic_questions_v2(p_topic_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_complete_stats(p_user_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_difficulty_metrics(p_user_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_progress_trends(p_user_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_ranking_position(p_user_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_min_questions integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_statistics_complete(p_user_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_user_progress(p_user_id uuid, p_test_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_has_role(p_user_id uuid, p_role text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_needs_onboarding(p_user_id uuid) FROM PUBLIC, anon;

-- Unsubscribe tokens (zombie — sin callers en código actual)
REVOKE EXECUTE ON FUNCTION public.process_unsubscribe_by_token(token_param text, unsubscribe_all_param boolean, specific_types_param text[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_unsubscribe_token(token_param text) FROM PUBLIC, anon;
