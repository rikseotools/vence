-- C4 — DROP de políticas RLS que usan el schema auth.* de Supabase
-- Generado por scripts/gen-c4-drop-rls.cjs (bloque UP del draft docs/roadmap/c4-drop-rls.draft.sql).
-- Precondiciones verificadas 2026-07-04: C1/C2/C3 estables, 0 .from de cliente, draft probado en RDS piloto.
-- Rollback: bloque DOWN del draft (recrea verbatim) + scratchpad/policies_backup_pre_c4.json.
BEGIN;

DROP POLICY IF EXISTS "Admins can view ai_chat_traces" ON public.ai_chat_traces;

DROP POLICY IF EXISTS "Admins can view cancellation feedback" ON public.cancellation_feedback;

DROP POLICY IF EXISTS "Admins can view all conversion events" ON public.conversion_events;
DROP POLICY IF EXISTS "Users can view own conversion events" ON public.conversion_events;

DROP POLICY IF EXISTS "Users can delete own custom oposiciones" ON public.custom_oposiciones;
DROP POLICY IF EXISTS "Users can insert own custom oposiciones" ON public.custom_oposiciones;
DROP POLICY IF EXISTS "Users can update own custom oposiciones" ON public.custom_oposiciones;
DROP POLICY IF EXISTS "Users can view own and public custom oposiciones" ON public.custom_oposiciones;

DROP POLICY IF EXISTS "Users can insert own usage" ON public.daily_question_usage;
DROP POLICY IF EXISTS "Users can read own usage" ON public.daily_question_usage;
DROP POLICY IF EXISTS "Users can update own usage" ON public.daily_question_usage;

DROP POLICY IF EXISTS "Admin can view all email events" ON public.email_events;
DROP POLICY IF EXISTS "Users can view own email events" ON public.email_events;

DROP POLICY IF EXISTS "Admin can read email_logs" ON public.email_logs;

DROP POLICY IF EXISTS "Users can manage their own email preferences" ON public.email_preferences;

DROP POLICY IF EXISTS "Admin can update all conversations" ON public.feedback_conversations;
DROP POLICY IF EXISTS "Authenticated can insert own conversations" ON public.feedback_conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON public.feedback_conversations;

DROP POLICY IF EXISTS "Admin can update messages" ON public.feedback_messages;
DROP POLICY IF EXISTS "Authenticated can insert messages" ON public.feedback_messages;

DROP POLICY IF EXISTS "Admins can manage fraud_confirmations" ON public.fraud_confirmations;

DROP POLICY IF EXISTS "Admins can manage fraud_watch_list" ON public.fraud_watch_list;
DROP POLICY IF EXISTS "Users can check own watch status" ON public.fraud_watch_list;

DROP POLICY IF EXISTS "Users can insert their own first attempts" ON public.law_question_first_attempts_pre_outbox;
DROP POLICY IF EXISTS "Users can view their own first attempts" ON public.law_question_first_attempts_pre_outbox;

DROP POLICY IF EXISTS "Only admins can manage messages" ON public.motivational_messages;

DROP POLICY IF EXISTS "Admin can view all notification events" ON public.notification_events;
DROP POLICY IF EXISTS "Users can view own notification events" ON public.notification_events;

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notification_logs;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notification_logs;

DROP POLICY IF EXISTS "Admins can view audit log" ON public.plan_type_audit_log;

DROP POLICY IF EXISTS "Users can delete own first attempts" ON public.psychometric_first_attempts;
DROP POLICY IF EXISTS "Users can insert own first attempts" ON public.psychometric_first_attempts;
DROP POLICY IF EXISTS "Users can update own first attempts" ON public.psychometric_first_attempts;
DROP POLICY IF EXISTS "Users can view own first attempts" ON public.psychometric_first_attempts;

DROP POLICY IF EXISTS "Service role full access" ON public.psychometric_question_disputes;
DROP POLICY IF EXISTS "Users can create disputes" ON public.psychometric_question_disputes;
DROP POLICY IF EXISTS "Users can view own disputes" ON public.psychometric_question_disputes;

DROP POLICY IF EXISTS "Users can insert own answers" ON public.psychometric_test_answers;
DROP POLICY IF EXISTS "Users can update own answers" ON public.psychometric_test_answers;
DROP POLICY IF EXISTS "Users can view own answers" ON public.psychometric_test_answers;

DROP POLICY IF EXISTS "Users can delete own psychometric sessions" ON public.psychometric_test_sessions;
DROP POLICY IF EXISTS "Users can insert own psychometric sessions" ON public.psychometric_test_sessions;
DROP POLICY IF EXISTS "Users can update own psychometric sessions" ON public.psychometric_test_sessions;
DROP POLICY IF EXISTS "Users can view own psychometric sessions" ON public.psychometric_test_sessions;

DROP POLICY IF EXISTS "Users can view their own question history" ON public.psychometric_user_question_history;

DROP POLICY IF EXISTS "Users can update own public profile" ON public.public_user_profiles;

DROP POLICY IF EXISTS "Admin can view all pwa events" ON public.pwa_events;
DROP POLICY IF EXISTS "Service role can manage all PWA events" ON public.pwa_events;
DROP POLICY IF EXISTS "Users can insert own PWA events" ON public.pwa_events;
DROP POLICY IF EXISTS "Users can view own PWA events" ON public.pwa_events;

DROP POLICY IF EXISTS "Admin can view all pwa sessions" ON public.pwa_sessions;
DROP POLICY IF EXISTS "Service role can manage all PWA sessions" ON public.pwa_sessions;
DROP POLICY IF EXISTS "Users can insert own PWA sessions" ON public.pwa_sessions;
DROP POLICY IF EXISTS "Users can update own PWA sessions" ON public.pwa_sessions;
DROP POLICY IF EXISTS "Users can view own PWA sessions" ON public.pwa_sessions;

DROP POLICY IF EXISTS "Users can insert own disputes" ON public.question_disputes;
DROP POLICY IF EXISTS "Users can view own disputes" ON public.question_disputes;

DROP POLICY IF EXISTS "Users can create own shares" ON public.share_events;
DROP POLICY IF EXISTS "Users can read own shares" ON public.share_events;

DROP POLICY IF EXISTS "Users can insert own spelling answers" ON public.spelling_test_answers;
DROP POLICY IF EXISTS "Users can view own spelling answers" ON public.spelling_test_answers;

DROP POLICY IF EXISTS "Users can insert own spelling sessions" ON public.spelling_test_sessions;
DROP POLICY IF EXISTS "Users can update own spelling sessions" ON public.spelling_test_sessions;
DROP POLICY IF EXISTS "Users can view own spelling sessions" ON public.spelling_test_sessions;

DROP POLICY IF EXISTS "Users can manage own test configs" ON public.test_configurations;

DROP POLICY IF EXISTS "Users can insert own test answers" ON public.test_questions;
DROP POLICY IF EXISTS "Users can update own test answers" ON public.test_questions;
DROP POLICY IF EXISTS "Users can view own test answers" ON public.test_questions;

DROP POLICY IF EXISTS "Admins can view all tests" ON public.tests;
DROP POLICY IF EXISTS "Users can insert own tests" ON public.tests;
DROP POLICY IF EXISTS "Users can update own tests" ON public.tests;
DROP POLICY IF EXISTS "Users can view own tests" ON public.tests;

DROP POLICY IF EXISTS "Admin can read impressions" ON public.upgrade_message_impressions;
DROP POLICY IF EXISTS "Authenticated can insert impressions" ON public.upgrade_message_impressions;

DROP POLICY IF EXISTS "Service role full access to user_avatar_settings" ON public.user_avatar_settings;
DROP POLICY IF EXISTS "Users can insert own avatar settings" ON public.user_avatar_settings;
DROP POLICY IF EXISTS "Users can update own avatar settings" ON public.user_avatar_settings;
DROP POLICY IF EXISTS "Users can view own avatar settings" ON public.user_avatar_settings;

DROP POLICY IF EXISTS "Users can read own devices" ON public.user_devices;

DROP POLICY IF EXISTS "Users can view their own difficulty metrics" ON public.user_difficulty_metrics;

DROP POLICY IF EXISTS "Admin can update all feedback" ON public.user_feedback;
DROP POLICY IF EXISTS "Authenticated users can insert own feedback" ON public.user_feedback;
DROP POLICY IF EXISTS "Authenticated users can update own feedback" ON public.user_feedback;

DROP POLICY IF EXISTS "Admins can view all interactions" ON public.user_interactions;
DROP POLICY IF EXISTS "Users can insert own interactions" ON public.user_interactions;
DROP POLICY IF EXISTS "Users can view own interactions" ON public.user_interactions;

DROP POLICY IF EXISTS "users_read_own_archived_interactions" ON public.user_interactions_archive;

DROP POLICY IF EXISTS "users_manage_own_analytics" ON public.user_learning_analytics;

DROP POLICY IF EXISTS "Users can view own medals" ON public.user_medals;

DROP POLICY IF EXISTS "Admins can read all interactions" ON public.user_message_interactions;
DROP POLICY IF EXISTS "Users can create own interactions" ON public.user_message_interactions;
DROP POLICY IF EXISTS "Users can insert their own message interactions" ON public.user_message_interactions;
DROP POLICY IF EXISTS "Users can read own interactions" ON public.user_message_interactions;
DROP POLICY IF EXISTS "Users can update own interactions" ON public.user_message_interactions;
DROP POLICY IF EXISTS "Users can view their own message interactions" ON public.user_message_interactions;

DROP POLICY IF EXISTS "Admin can view all notification metrics" ON public.user_notification_metrics;
DROP POLICY IF EXISTS "Allow users to update notification metrics" ON public.user_notification_metrics;
DROP POLICY IF EXISTS "Allow users to update own notification metrics" ON public.user_notification_metrics;
DROP POLICY IF EXISTS "Users can view own notification metrics" ON public.user_notification_metrics;

DROP POLICY IF EXISTS "Admin can view all notification settings" ON public.user_notification_settings;

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;

DROP POLICY IF EXISTS "Users can insert own progress" ON public.user_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON public.user_progress;
DROP POLICY IF EXISTS "Users can view own progress" ON public.user_progress;

DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_psychometric_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_psychometric_preferences;
DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_psychometric_preferences;

DROP POLICY IF EXISTS "Users can update own recommendations" ON public.user_recommendations;
DROP POLICY IF EXISTS "Users can view own recommendations" ON public.user_recommendations;

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.user_sessions;

DROP POLICY IF EXISTS "users_read_own_stats_summary" ON public.user_stats_summary_pre_outbox;

DROP POLICY IF EXISTS "Users can insert own streaks" ON public.user_streaks;
DROP POLICY IF EXISTS "Users can update own streak only" ON public.user_streaks;
DROP POLICY IF EXISTS "Users can update own streaks" ON public.user_streaks;
DROP POLICY IF EXISTS "Users can view own streaks" ON public.user_streaks;

DROP POLICY IF EXISTS "Service role can manage subscriptions" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.user_subscriptions;

DROP POLICY IF EXISTS "users_manage_own_test_favorites" ON public.user_test_favorites;

DROP POLICY IF EXISTS "Users can insert their own test sessions" ON public.user_test_sessions;
DROP POLICY IF EXISTS "Users can update their own test sessions" ON public.user_test_sessions;
DROP POLICY IF EXISTS "Users can view their own test sessions" ON public.user_test_sessions;

DROP POLICY IF EXISTS "Users can read own theme cache" ON public.user_theme_performance_cache;

DROP POLICY IF EXISTS "users_read_own" ON public.validation_error_logs;

COMMIT;
