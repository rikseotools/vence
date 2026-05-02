-- Migration: search_path_invoker_functions
-- 2026-05-02
--
-- Cierra ~80 issues "Function Search Path Mutable" del Supabase Advisor para
-- funciones SECURITY INVOKER (la migración previa 20260502_security_advisor_fixes.sql
-- cubrió las 71 SECURITY DEFINER).
--
-- Aplica `SET search_path = public, pg_temp` a las 83 funciones owner=postgres
-- en schema public que aún no tienen search_path fijo. Las 54 funciones
-- restantes son owner=supabase_admin (provienen de extensiones http/unaccent/
-- pg_trgm/etc.) — las gestiona Supabase, no podemos ni debemos tocarlas.
--
-- Para SECURITY INVOKER el riesgo es menor (la función ejecuta como el caller,
-- no como el owner) pero fijar search_path sigue siendo defensa en
-- profundidad: previene que un atacante con CREATE en pg_temp pueda
-- shadowear nombres no calificados dentro de la función.
--
-- Riesgo cero: las funciones siguen ejecutándose en el mismo contexto, solo
-- congela el search_path para que no pueda ser manipulado externamente.
--
-- Idempotente: ALTER FUNCTION SET es no-op si ya está aplicado.

ALTER FUNCTION public.activate_premium_user(user_id uuid, stripe_customer_id text) SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_article_hotness_by_oposicion() SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_global_law_question_difficulty(question_uuid uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_global_psychometric_difficulty(question_uuid uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_knowledge_retention_score(time_spent_sec integer, is_correct boolean, difficulty_level text) SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_personal_difficulty(p_success_rate numeric, p_total_attempts bigint) SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_personal_law_question_difficulty(user_uuid uuid, question_uuid uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_personal_psychometric_difficulty(p_user_id uuid, p_question_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_question_global_difficulty(p_question_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_question_hash(p_question_text text, p_option_a text, p_option_b text, p_option_c text, p_option_d text, p_correct_option integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_trace_duration() SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_trend(p_user_id uuid, p_question_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_user_risk_level(p_user_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.check_hot_article_for_current_user(article_id_param uuid, user_id_param uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.check_if_article_is_hot_for_user_oposicion(article_id_param uuid, user_oposicion text) SET search_path = public, pg_temp;
ALTER FUNCTION public.check_user_access(user_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.cleanup_old_pwa_sessions() SET search_path = public, pg_temp;
ALTER FUNCTION public.detect_learning_style(user_uuid uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.diagnose_null_question_ids() SET search_path = public, pg_temp;
ALTER FUNCTION public.diagnose_question_references() SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_content_hash(content_text text) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_article_context_clean(p_article_number text, p_oposicion_name text) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_article_context_final(p_article_number text, p_oposicion_name text) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_complete_test_analytics(test_session_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_disputes_with_users() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_disputes_with_users_simple() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_effective_law_question_difficulty(user_uuid uuid, question_uuid uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_effective_psychometric_difficulty(p_question_id uuid, p_user_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_estadisticas_examenes_oficiales(p_oposicion_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_examen_oficial_exacto(p_convocatoria_id uuid, p_parte_examen text) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_inactive_users_for_emails() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_law_difficulty_stats() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_laws_with_question_counts() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_personalized_message(p_user_id uuid, p_category text, p_context jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_preguntas_oficiales_por_tema(p_oposicion_id uuid, p_topic_name text, p_num_questions integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_question_counts_by_law() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_questions_by_tema_and_difficulty(p_tema_number integer, p_total_questions integer, p_difficulty_filter text) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_unmotivated_new_users() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_problematic_articles_weekly(user_uuid uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_theme_stats(p_user_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.hybrid_search_articles(query_embedding vector, query_text text, match_count integer, semantic_weight double precision, text_weight double precision, priority_law_ids uuid[]) SET search_path = public, pg_temp;
ALTER FUNCTION public.init_user_stats_summary() SET search_path = public, pg_temp;
ALTER FUNCTION public.mark_article_embedding_stale() SET search_path = public, pg_temp;
ALTER FUNCTION public.match_articles(query_embedding vector, match_threshold double precision, match_count integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.match_help_articles(query_embedding vector, match_threshold double precision, match_count integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.match_knowledge_base(query_embedding vector, match_threshold double precision, match_count integer, filter_category text) SET search_path = public, pg_temp;
ALTER FUNCTION public.migrate_existing_data() SET search_path = public, pg_temp;
ALTER FUNCTION public.predict_exam_readiness(user_uuid uuid, opos_type text) SET search_path = public, pg_temp;
ALTER FUNCTION public.register_device(p_user_id uuid, p_device_id text, p_device_label text, p_hw_fingerprint text) SET search_path = public, pg_temp;
ALTER FUNCTION public.reset_question_verification() SET search_path = public, pg_temp;
ALTER FUNCTION public.reset_questions_on_article_update() SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_nickname_simple() SET search_path = public, pg_temp;
ALTER FUNCTION public.test_complete_flow(p_user_id uuid, p_accuracy numeric) SET search_path = public, pg_temp;
ALTER FUNCTION public.test_full_select_with_joins(p_user_id uuid, p_accuracy numeric) SET search_path = public, pg_temp;
ALTER FUNCTION public.test_into_variables() SET search_path = public, pg_temp;
ALTER FUNCTION public.test_variant_extraction(p_user_id uuid, p_accuracy numeric) SET search_path = public, pg_temp;
ALTER FUNCTION public.track_question_first_attempt() SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_calculate_question_hash() SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_calculate_retention_score() SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_cleanup_old_sessions() SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_update_article_stats() SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_update_custom_oposiciones_timestamp() SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_update_law_question_difficulty() SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_update_psychometric_difficulty() SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_update_timestamp() SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_update_user_analytics() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_convocatorias_boe_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_daily_usage_timestamp() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_email_templates_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_global_psychometric_difficulty(question_uuid uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.update_message_analytics() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_motivational_messages_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_question_difficulty_immediate() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_question_global_difficulty(p_question_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_user_avatar_settings_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_user_learning_analytics(user_uuid uuid, article_uuid uuid, tema_num integer, opos_type text) SET search_path = public, pg_temp;
ALTER FUNCTION public.update_user_notification_metrics() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_user_question_history() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_user_roles_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_user_stats_summary() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_user_streak_function() SET search_path = public, pg_temp;
ALTER FUNCTION public.verify_triggers_working() SET search_path = public, pg_temp;
