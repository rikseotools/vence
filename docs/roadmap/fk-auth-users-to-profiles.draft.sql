-- ============================================================================
-- RE-POINT de FKs auth.users(id) -> user_profiles(id) (DRAFT — ⚠️ NO APLICAR TODAVÍA)
-- ============================================================================
-- docs/roadmap/auth-agnostico-jwks-y-rls.md · GENERADO por scripts/gen-fk-auth-to-profiles.cjs
-- (regenerable desde pg_constraint; NO editar a mano). FUERA de supabase/migrations/ a propósito.
--
-- POR QUÉ: en Neon/RDS NO existe el schema `auth` (GoTrue). Cada FK que apunta a
-- auth.users(id) rompe el swap. user_profiles.id == auth.users.id (mismo UUID) y
-- user_profiles vive en NUESTRA Postgres → re-apuntamos los FK ahí.
--
-- ESTADO (regenerar antes de aplicar; las tablas crecen): 53 FKs (52 re-point + 1 drop de identidad).
--
-- 🚨 PRECONDICIÓN DE DATOS — el ADD CONSTRAINT FALLA si hay huérfanos (filas con
--    user-ref en auth.users pero NO en user_profiles). Estado actual del audit:
--    ❌ 18 columna(s) con 504 filas huérfanas — LIMPIAR/backfill ANTES:
--       - conversion_events.user_id: 2
--       - custom_oposiciones.user_id: 1
--       - daily_question_usage.user_id: 3
--       - email_preferences.user_id: 6
--       - law_question_first_attempts_pre_outbox.user_id: 143
--       - notification_events.user_id: 18
--       - psychometric_test_answers.user_id: 12
--       - psychometric_test_sessions.user_id: 1
--       - public_user_profiles.id: 8
--       - pwa_events.user_id: 41
--       - pwa_sessions.user_id: 109
--       - question_first_attempts_pre_outbox.user_id: 143
--       - upgrade_message_impressions.user_id: 7
--       - user_avatar_settings.user_id: 2
--       - user_message_interactions.user_id: 1
--       - user_notification_metrics.user_id: 5
--       - user_notification_settings.user_id: 1
--       - user_streaks.user_id: 1
--    (Decidir por tabla: DELETE de la fila huérfana, o backfill del user_profiles que falta.
--     Las *_pre_outbox son tablas de archivo — probablemente droppables sin backfill.)
--
-- ROLLBACK: bloque DOWN (re-apunta de vuelta a auth.users). Solo válido mientras auth.users exista.
-- ============================================================================

-- Verificación de precondición (debe devolver 0 filas para poder aplicar el UP):
--   Ejecuta este SELECT y confirma 0 antes de continuar.
/*
SELECT * FROM (
  SELECT 'ai_chat_logs.user_id' AS fk, count(*)::int AS orphans FROM public.ai_chat_logs t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'ai_verification_results.verified_by' AS fk, count(*)::int AS orphans FROM public.ai_verification_results t WHERE t.verified_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.verified_by)
  UNION ALL
  SELECT 'attribution_touches.user_id' AS fk, count(*)::int AS orphans FROM public.attribution_touches t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'cancellation_feedback.user_id' AS fk, count(*)::int AS orphans FROM public.cancellation_feedback t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'conversion_events.user_id' AS fk, count(*)::int AS orphans FROM public.conversion_events t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'custom_oposiciones.user_id' AS fk, count(*)::int AS orphans FROM public.custom_oposiciones t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'daily_question_usage.user_id' AS fk, count(*)::int AS orphans FROM public.daily_question_usage t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'email_events.user_id' AS fk, count(*)::int AS orphans FROM public.email_events t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'email_preferences.user_id' AS fk, count(*)::int AS orphans FROM public.email_preferences t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'fraud_alerts.reviewed_by' AS fk, count(*)::int AS orphans FROM public.fraud_alerts t WHERE t.reviewed_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.reviewed_by)
  UNION ALL
  SELECT 'fraud_confirmations.action_taken_by' AS fk, count(*)::int AS orphans FROM public.fraud_confirmations t WHERE t.action_taken_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.action_taken_by)
  UNION ALL
  SELECT 'fraud_watch_list.user_id' AS fk, count(*)::int AS orphans FROM public.fraud_watch_list t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'law_question_first_attempts_pre_outbox.user_id' AS fk, count(*)::int AS orphans FROM public.law_question_first_attempts_pre_outbox t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'notification_events.user_id' AS fk, count(*)::int AS orphans FROM public.notification_events t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'notification_logs.user_id' AS fk, count(*)::int AS orphans FROM public.notification_logs t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'problematic_questions_tracking.resolved_by' AS fk, count(*)::int AS orphans FROM public.problematic_questions_tracking t WHERE t.resolved_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.resolved_by)
  UNION ALL
  SELECT 'psychometric_first_attempts.user_id' AS fk, count(*)::int AS orphans FROM public.psychometric_first_attempts t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'psychometric_question_disputes.admin_user_id' AS fk, count(*)::int AS orphans FROM public.psychometric_question_disputes t WHERE t.admin_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.admin_user_id)
  UNION ALL
  SELECT 'psychometric_question_disputes.user_id' AS fk, count(*)::int AS orphans FROM public.psychometric_question_disputes t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'psychometric_test_answers.user_id' AS fk, count(*)::int AS orphans FROM public.psychometric_test_answers t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'psychometric_test_sessions.user_id' AS fk, count(*)::int AS orphans FROM public.psychometric_test_sessions t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'psychometric_user_question_history.user_id' AS fk, count(*)::int AS orphans FROM public.psychometric_user_question_history t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'public_user_profiles.id' AS fk, count(*)::int AS orphans FROM public.public_user_profiles t WHERE t.id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.id)
  UNION ALL
  SELECT 'pwa_events.user_id' AS fk, count(*)::int AS orphans FROM public.pwa_events t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'pwa_sessions.user_id' AS fk, count(*)::int AS orphans FROM public.pwa_sessions t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'question_first_attempts_pre_outbox.user_id' AS fk, count(*)::int AS orphans FROM public.question_first_attempts_pre_outbox t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'session_block_events.user_id' AS fk, count(*)::int AS orphans FROM public.session_block_events t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'share_events.user_id' AS fk, count(*)::int AS orphans FROM public.share_events t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'spelling_test_answers.user_id' AS fk, count(*)::int AS orphans FROM public.spelling_test_answers t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'spelling_test_sessions.user_id' AS fk, count(*)::int AS orphans FROM public.spelling_test_sessions t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'telegram_session.user_id' AS fk, count(*)::int AS orphans FROM public.telegram_session t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'upgrade_message_impressions.user_id' AS fk, count(*)::int AS orphans FROM public.upgrade_message_impressions t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'user_acquisition.user_id' AS fk, count(*)::int AS orphans FROM public.user_acquisition t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'user_avatar_settings.user_id' AS fk, count(*)::int AS orphans FROM public.user_avatar_settings t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'user_devices.user_id' AS fk, count(*)::int AS orphans FROM public.user_devices t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'user_difficulty_metrics.user_id' AS fk, count(*)::int AS orphans FROM public.user_difficulty_metrics t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'user_feedback.admin_user_id' AS fk, count(*)::int AS orphans FROM public.user_feedback t WHERE t.admin_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.admin_user_id)
  UNION ALL
  SELECT 'user_feedback.user_id' AS fk, count(*)::int AS orphans FROM public.user_feedback t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'user_inscription_banner_dismissals.user_id' AS fk, count(*)::int AS orphans FROM public.user_inscription_banner_dismissals t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'user_interactions.user_id' AS fk, count(*)::int AS orphans FROM public.user_interactions t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'user_medals.user_id' AS fk, count(*)::int AS orphans FROM public.user_medals t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'user_message_interactions.user_id' AS fk, count(*)::int AS orphans FROM public.user_message_interactions t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'user_notification_metrics.user_id' AS fk, count(*)::int AS orphans FROM public.user_notification_metrics t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'user_notification_settings.user_id' AS fk, count(*)::int AS orphans FROM public.user_notification_settings t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'user_oposicion_alerts.user_id' AS fk, count(*)::int AS orphans FROM public.user_oposicion_alerts t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'user_oposiciones_seguidas.user_id' AS fk, count(*)::int AS orphans FROM public.user_oposiciones_seguidas t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'user_psychometric_preferences.user_id' AS fk, count(*)::int AS orphans FROM public.user_psychometric_preferences t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'user_streaks.user_id' AS fk, count(*)::int AS orphans FROM public.user_streaks t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'user_test_sessions.user_id' AS fk, count(*)::int AS orphans FROM public.user_test_sessions t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'user_theme_performance_cache.user_id' AS fk, count(*)::int AS orphans FROM public.user_theme_performance_cache t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'user_video_progress.user_id' AS fk, count(*)::int AS orphans FROM public.user_video_progress t WHERE t.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.user_id)
  UNION ALL
  SELECT 'verification_queue.created_by' AS fk, count(*)::int AS orphans FROM public.verification_queue t WHERE t.created_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.created_by)
) q WHERE orphans > 0;
*/

-- ============================================================================
-- UP — drop de identidad raíz + re-point del resto (ejecutar tras precondiciones)
-- ============================================================================
BEGIN;

-- identidad raíz: user_profiles.id deja de referenciar auth.users (pasa a ser raíz)
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS "user_profiles_id_fkey";

ALTER TABLE public.ai_chat_logs DROP CONSTRAINT IF EXISTS "ai_chat_logs_user_id_fkey";
ALTER TABLE public.ai_chat_logs ADD CONSTRAINT "ai_chat_logs_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE public.ai_verification_results DROP CONSTRAINT IF EXISTS "ai_verification_results_verified_by_fkey";
ALTER TABLE public.ai_verification_results ADD CONSTRAINT "ai_verification_results_verified_by_profiles_fkey" FOREIGN KEY (verified_by) REFERENCES public.user_profiles(id) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE public.attribution_touches DROP CONSTRAINT IF EXISTS "attribution_touches_user_id_fkey";
ALTER TABLE public.attribution_touches ADD CONSTRAINT "attribution_touches_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.cancellation_feedback DROP CONSTRAINT IF EXISTS "cancellation_feedback_user_id_fkey";
ALTER TABLE public.cancellation_feedback ADD CONSTRAINT "cancellation_feedback_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.conversion_events DROP CONSTRAINT IF EXISTS "conversion_events_user_id_fkey";
ALTER TABLE public.conversion_events ADD CONSTRAINT "conversion_events_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.custom_oposiciones DROP CONSTRAINT IF EXISTS "custom_oposiciones_user_id_fkey";
ALTER TABLE public.custom_oposiciones ADD CONSTRAINT "custom_oposiciones_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.daily_question_usage DROP CONSTRAINT IF EXISTS "daily_question_usage_user_id_fkey";
ALTER TABLE public.daily_question_usage ADD CONSTRAINT "daily_question_usage_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.email_events DROP CONSTRAINT IF EXISTS "email_events_user_id_fkey";
ALTER TABLE public.email_events ADD CONSTRAINT "email_events_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.email_preferences DROP CONSTRAINT IF EXISTS "email_preferences_user_id_fkey";
ALTER TABLE public.email_preferences ADD CONSTRAINT "email_preferences_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.fraud_alerts DROP CONSTRAINT IF EXISTS "fraud_alerts_reviewed_by_fkey";
ALTER TABLE public.fraud_alerts ADD CONSTRAINT "fraud_alerts_reviewed_by_profiles_fkey" FOREIGN KEY (reviewed_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE public.fraud_confirmations DROP CONSTRAINT IF EXISTS "fraud_confirmations_action_taken_by_fkey";
ALTER TABLE public.fraud_confirmations ADD CONSTRAINT "fraud_confirmations_action_taken_by_profiles_fkey" FOREIGN KEY (action_taken_by) REFERENCES public.user_profiles(id) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE public.fraud_watch_list DROP CONSTRAINT IF EXISTS "fraud_watch_list_user_id_fkey";
ALTER TABLE public.fraud_watch_list ADD CONSTRAINT "fraud_watch_list_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.law_question_first_attempts_pre_outbox DROP CONSTRAINT IF EXISTS "law_question_first_attempts_user_id_fkey";
ALTER TABLE public.law_question_first_attempts_pre_outbox ADD CONSTRAINT "law_question_first_attempts_pre_outbox_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.notification_events DROP CONSTRAINT IF EXISTS "notification_events_user_id_fkey";
ALTER TABLE public.notification_events ADD CONSTRAINT "notification_events_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.notification_logs DROP CONSTRAINT IF EXISTS "notification_logs_user_id_fkey";
ALTER TABLE public.notification_logs ADD CONSTRAINT "notification_logs_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.problematic_questions_tracking DROP CONSTRAINT IF EXISTS "problematic_questions_tracking_resolved_by_fkey";
ALTER TABLE public.problematic_questions_tracking ADD CONSTRAINT "problematic_questions_tracking_resolved_by_profiles_fkey" FOREIGN KEY (resolved_by) REFERENCES public.user_profiles(id) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE public.psychometric_first_attempts DROP CONSTRAINT IF EXISTS "psychometric_first_attempts_user_id_fkey";
ALTER TABLE public.psychometric_first_attempts ADD CONSTRAINT "psychometric_first_attempts_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.psychometric_question_disputes DROP CONSTRAINT IF EXISTS "psychometric_question_disputes_admin_user_id_fkey";
ALTER TABLE public.psychometric_question_disputes ADD CONSTRAINT "psychometric_question_disputes_admin_user_id_profiles_fkey" FOREIGN KEY (admin_user_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE public.psychometric_question_disputes DROP CONSTRAINT IF EXISTS "psychometric_question_disputes_user_id_fkey";
ALTER TABLE public.psychometric_question_disputes ADD CONSTRAINT "psychometric_question_disputes_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE public.psychometric_test_answers DROP CONSTRAINT IF EXISTS "psychometric_test_answers_user_id_fkey";
ALTER TABLE public.psychometric_test_answers ADD CONSTRAINT "psychometric_test_answers_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE public.psychometric_test_sessions DROP CONSTRAINT IF EXISTS "psychometric_test_sessions_user_id_fkey";
ALTER TABLE public.psychometric_test_sessions ADD CONSTRAINT "psychometric_test_sessions_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.psychometric_user_question_history DROP CONSTRAINT IF EXISTS "psychometric_user_question_history_user_id_fkey";
ALTER TABLE public.psychometric_user_question_history ADD CONSTRAINT "psychometric_user_question_history_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.public_user_profiles DROP CONSTRAINT IF EXISTS "public_user_profiles_id_fkey";
ALTER TABLE public.public_user_profiles ADD CONSTRAINT "public_user_profiles_id_profiles_fkey" FOREIGN KEY (id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.pwa_events DROP CONSTRAINT IF EXISTS "pwa_events_user_id_fkey";
ALTER TABLE public.pwa_events ADD CONSTRAINT "pwa_events_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE public.pwa_sessions DROP CONSTRAINT IF EXISTS "pwa_sessions_user_id_fkey";
ALTER TABLE public.pwa_sessions ADD CONSTRAINT "pwa_sessions_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE public.question_first_attempts_pre_outbox DROP CONSTRAINT IF EXISTS "question_first_attempts_user_id_fkey";
ALTER TABLE public.question_first_attempts_pre_outbox ADD CONSTRAINT "question_first_attempts_pre_outbox_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.session_block_events DROP CONSTRAINT IF EXISTS "session_block_events_user_id_fkey";
ALTER TABLE public.session_block_events ADD CONSTRAINT "session_block_events_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.share_events DROP CONSTRAINT IF EXISTS "share_events_user_id_fkey";
ALTER TABLE public.share_events ADD CONSTRAINT "share_events_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.spelling_test_answers DROP CONSTRAINT IF EXISTS "spelling_test_answers_user_id_fkey";
ALTER TABLE public.spelling_test_answers ADD CONSTRAINT "spelling_test_answers_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.spelling_test_sessions DROP CONSTRAINT IF EXISTS "spelling_test_sessions_user_id_fkey";
ALTER TABLE public.spelling_test_sessions ADD CONSTRAINT "spelling_test_sessions_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.telegram_session DROP CONSTRAINT IF EXISTS "telegram_session_user_id_fkey";
ALTER TABLE public.telegram_session ADD CONSTRAINT "telegram_session_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.upgrade_message_impressions DROP CONSTRAINT IF EXISTS "upgrade_message_impressions_user_id_fkey";
ALTER TABLE public.upgrade_message_impressions ADD CONSTRAINT "upgrade_message_impressions_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE public.user_acquisition DROP CONSTRAINT IF EXISTS "user_acquisition_user_id_fkey";
ALTER TABLE public.user_acquisition ADD CONSTRAINT "user_acquisition_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.user_avatar_settings DROP CONSTRAINT IF EXISTS "user_avatar_settings_user_id_fkey";
ALTER TABLE public.user_avatar_settings ADD CONSTRAINT "user_avatar_settings_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.user_devices DROP CONSTRAINT IF EXISTS "user_devices_user_id_fkey";
ALTER TABLE public.user_devices ADD CONSTRAINT "user_devices_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.user_difficulty_metrics DROP CONSTRAINT IF EXISTS "user_difficulty_metrics_user_id_fkey";
ALTER TABLE public.user_difficulty_metrics ADD CONSTRAINT "user_difficulty_metrics_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.user_feedback DROP CONSTRAINT IF EXISTS "user_feedback_admin_user_id_fkey";
ALTER TABLE public.user_feedback ADD CONSTRAINT "user_feedback_admin_user_id_profiles_fkey" FOREIGN KEY (admin_user_id) REFERENCES public.user_profiles(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE public.user_feedback DROP CONSTRAINT IF EXISTS "user_feedback_user_id_fkey";
ALTER TABLE public.user_feedback ADD CONSTRAINT "user_feedback_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE public.user_inscription_banner_dismissals DROP CONSTRAINT IF EXISTS "user_inscription_banner_dismissals_user_id_fkey";
ALTER TABLE public.user_inscription_banner_dismissals ADD CONSTRAINT "user_inscription_banner_dismissals_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.user_interactions DROP CONSTRAINT IF EXISTS "user_interactions_user_id_fkey";
ALTER TABLE public.user_interactions ADD CONSTRAINT "user_interactions_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.user_medals DROP CONSTRAINT IF EXISTS "user_medals_user_id_fkey";
ALTER TABLE public.user_medals ADD CONSTRAINT "user_medals_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.user_message_interactions DROP CONSTRAINT IF EXISTS "user_message_interactions_user_id_fkey";
ALTER TABLE public.user_message_interactions ADD CONSTRAINT "user_message_interactions_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.user_notification_metrics DROP CONSTRAINT IF EXISTS "user_notification_metrics_user_id_fkey";
ALTER TABLE public.user_notification_metrics ADD CONSTRAINT "user_notification_metrics_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.user_notification_settings DROP CONSTRAINT IF EXISTS "user_notification_settings_user_id_fkey";
ALTER TABLE public.user_notification_settings ADD CONSTRAINT "user_notification_settings_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.user_oposicion_alerts DROP CONSTRAINT IF EXISTS "user_oposicion_alerts_user_id_fkey";
ALTER TABLE public.user_oposicion_alerts ADD CONSTRAINT "user_oposicion_alerts_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.user_oposiciones_seguidas DROP CONSTRAINT IF EXISTS "user_oposiciones_seguidas_user_id_fkey";
ALTER TABLE public.user_oposiciones_seguidas ADD CONSTRAINT "user_oposiciones_seguidas_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.user_psychometric_preferences DROP CONSTRAINT IF EXISTS "user_psychometric_preferences_user_id_fkey";
ALTER TABLE public.user_psychometric_preferences ADD CONSTRAINT "user_psychometric_preferences_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.user_streaks DROP CONSTRAINT IF EXISTS "user_streaks_user_id_fkey";
ALTER TABLE public.user_streaks ADD CONSTRAINT "user_streaks_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE public.user_test_sessions DROP CONSTRAINT IF EXISTS "user_test_sessions_user_id_fkey";
ALTER TABLE public.user_test_sessions ADD CONSTRAINT "user_test_sessions_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.user_theme_performance_cache DROP CONSTRAINT IF EXISTS "user_theme_performance_cache_user_id_fkey";
ALTER TABLE public.user_theme_performance_cache ADD CONSTRAINT "user_theme_performance_cache_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.user_video_progress DROP CONSTRAINT IF EXISTS "user_video_progress_user_id_fkey";
ALTER TABLE public.user_video_progress ADD CONSTRAINT "user_video_progress_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.verification_queue DROP CONSTRAINT IF EXISTS "verification_queue_created_by_fkey";
ALTER TABLE public.verification_queue ADD CONSTRAINT "verification_queue_created_by_profiles_fkey" FOREIGN KEY (created_by) REFERENCES public.user_profiles(id) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT;

-- ============================================================================
-- DOWN — revertir a auth.users (descomentar; solo válido si auth.users aún existe)
-- ============================================================================
-- ALTER TABLE public.ai_chat_logs DROP CONSTRAINT IF EXISTS "ai_chat_logs_user_id_profiles_fkey";
-- ALTER TABLE public.ai_chat_logs ADD CONSTRAINT "ai_chat_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL ON UPDATE NO ACTION;
-- ALTER TABLE public.ai_verification_results DROP CONSTRAINT IF EXISTS "ai_verification_results_verified_by_profiles_fkey";
-- ALTER TABLE public.ai_verification_results ADD CONSTRAINT "ai_verification_results_verified_by_fkey" FOREIGN KEY (verified_by) REFERENCES auth.users(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
-- ALTER TABLE public.attribution_touches DROP CONSTRAINT IF EXISTS "attribution_touches_user_id_profiles_fkey";
-- ALTER TABLE public.attribution_touches ADD CONSTRAINT "attribution_touches_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.cancellation_feedback DROP CONSTRAINT IF EXISTS "cancellation_feedback_user_id_profiles_fkey";
-- ALTER TABLE public.cancellation_feedback ADD CONSTRAINT "cancellation_feedback_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.conversion_events DROP CONSTRAINT IF EXISTS "conversion_events_user_id_profiles_fkey";
-- ALTER TABLE public.conversion_events ADD CONSTRAINT "conversion_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.custom_oposiciones DROP CONSTRAINT IF EXISTS "custom_oposiciones_user_id_profiles_fkey";
-- ALTER TABLE public.custom_oposiciones ADD CONSTRAINT "custom_oposiciones_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.daily_question_usage DROP CONSTRAINT IF EXISTS "daily_question_usage_user_id_profiles_fkey";
-- ALTER TABLE public.daily_question_usage ADD CONSTRAINT "daily_question_usage_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.email_events DROP CONSTRAINT IF EXISTS "email_events_user_id_profiles_fkey";
-- ALTER TABLE public.email_events ADD CONSTRAINT "email_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.email_preferences DROP CONSTRAINT IF EXISTS "email_preferences_user_id_profiles_fkey";
-- ALTER TABLE public.email_preferences ADD CONSTRAINT "email_preferences_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.fraud_alerts DROP CONSTRAINT IF EXISTS "fraud_alerts_reviewed_by_profiles_fkey";
-- ALTER TABLE public.fraud_alerts ADD CONSTRAINT "fraud_alerts_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL ON UPDATE NO ACTION;
-- ALTER TABLE public.fraud_confirmations DROP CONSTRAINT IF EXISTS "fraud_confirmations_action_taken_by_profiles_fkey";
-- ALTER TABLE public.fraud_confirmations ADD CONSTRAINT "fraud_confirmations_action_taken_by_fkey" FOREIGN KEY (action_taken_by) REFERENCES auth.users(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
-- ALTER TABLE public.fraud_watch_list DROP CONSTRAINT IF EXISTS "fraud_watch_list_user_id_profiles_fkey";
-- ALTER TABLE public.fraud_watch_list ADD CONSTRAINT "fraud_watch_list_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.law_question_first_attempts_pre_outbox DROP CONSTRAINT IF EXISTS "law_question_first_attempts_pre_outbox_user_id_profiles_fkey";
-- ALTER TABLE public.law_question_first_attempts_pre_outbox ADD CONSTRAINT "law_question_first_attempts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.notification_events DROP CONSTRAINT IF EXISTS "notification_events_user_id_profiles_fkey";
-- ALTER TABLE public.notification_events ADD CONSTRAINT "notification_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.notification_logs DROP CONSTRAINT IF EXISTS "notification_logs_user_id_profiles_fkey";
-- ALTER TABLE public.notification_logs ADD CONSTRAINT "notification_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.problematic_questions_tracking DROP CONSTRAINT IF EXISTS "problematic_questions_tracking_resolved_by_profiles_fkey";
-- ALTER TABLE public.problematic_questions_tracking ADD CONSTRAINT "problematic_questions_tracking_resolved_by_fkey" FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
-- ALTER TABLE public.psychometric_first_attempts DROP CONSTRAINT IF EXISTS "psychometric_first_attempts_user_id_profiles_fkey";
-- ALTER TABLE public.psychometric_first_attempts ADD CONSTRAINT "psychometric_first_attempts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.psychometric_question_disputes DROP CONSTRAINT IF EXISTS "psychometric_question_disputes_admin_user_id_profiles_fkey";
-- ALTER TABLE public.psychometric_question_disputes ADD CONSTRAINT "psychometric_question_disputes_admin_user_id_fkey" FOREIGN KEY (admin_user_id) REFERENCES auth.users(id) ON DELETE SET NULL ON UPDATE NO ACTION;
-- ALTER TABLE public.psychometric_question_disputes DROP CONSTRAINT IF EXISTS "psychometric_question_disputes_user_id_profiles_fkey";
-- ALTER TABLE public.psychometric_question_disputes ADD CONSTRAINT "psychometric_question_disputes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL ON UPDATE NO ACTION;
-- ALTER TABLE public.psychometric_test_answers DROP CONSTRAINT IF EXISTS "psychometric_test_answers_user_id_profiles_fkey";
-- ALTER TABLE public.psychometric_test_answers ADD CONSTRAINT "psychometric_test_answers_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
-- ALTER TABLE public.psychometric_test_sessions DROP CONSTRAINT IF EXISTS "psychometric_test_sessions_user_id_profiles_fkey";
-- ALTER TABLE public.psychometric_test_sessions ADD CONSTRAINT "psychometric_test_sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.psychometric_user_question_history DROP CONSTRAINT IF EXISTS "psychometric_user_question_history_user_id_profiles_fkey";
-- ALTER TABLE public.psychometric_user_question_history ADD CONSTRAINT "psychometric_user_question_history_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.public_user_profiles DROP CONSTRAINT IF EXISTS "public_user_profiles_id_profiles_fkey";
-- ALTER TABLE public.public_user_profiles ADD CONSTRAINT "public_user_profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.pwa_events DROP CONSTRAINT IF EXISTS "pwa_events_user_id_profiles_fkey";
-- ALTER TABLE public.pwa_events ADD CONSTRAINT "pwa_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
-- ALTER TABLE public.pwa_sessions DROP CONSTRAINT IF EXISTS "pwa_sessions_user_id_profiles_fkey";
-- ALTER TABLE public.pwa_sessions ADD CONSTRAINT "pwa_sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
-- ALTER TABLE public.question_first_attempts_pre_outbox DROP CONSTRAINT IF EXISTS "question_first_attempts_pre_outbox_user_id_profiles_fkey";
-- ALTER TABLE public.question_first_attempts_pre_outbox ADD CONSTRAINT "question_first_attempts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.session_block_events DROP CONSTRAINT IF EXISTS "session_block_events_user_id_profiles_fkey";
-- ALTER TABLE public.session_block_events ADD CONSTRAINT "session_block_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.share_events DROP CONSTRAINT IF EXISTS "share_events_user_id_profiles_fkey";
-- ALTER TABLE public.share_events ADD CONSTRAINT "share_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.spelling_test_answers DROP CONSTRAINT IF EXISTS "spelling_test_answers_user_id_profiles_fkey";
-- ALTER TABLE public.spelling_test_answers ADD CONSTRAINT "spelling_test_answers_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.spelling_test_sessions DROP CONSTRAINT IF EXISTS "spelling_test_sessions_user_id_profiles_fkey";
-- ALTER TABLE public.spelling_test_sessions ADD CONSTRAINT "spelling_test_sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.telegram_session DROP CONSTRAINT IF EXISTS "telegram_session_user_id_profiles_fkey";
-- ALTER TABLE public.telegram_session ADD CONSTRAINT "telegram_session_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.upgrade_message_impressions DROP CONSTRAINT IF EXISTS "upgrade_message_impressions_user_id_profiles_fkey";
-- ALTER TABLE public.upgrade_message_impressions ADD CONSTRAINT "upgrade_message_impressions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL ON UPDATE NO ACTION;
-- ALTER TABLE public.user_acquisition DROP CONSTRAINT IF EXISTS "user_acquisition_user_id_profiles_fkey";
-- ALTER TABLE public.user_acquisition ADD CONSTRAINT "user_acquisition_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.user_avatar_settings DROP CONSTRAINT IF EXISTS "user_avatar_settings_user_id_profiles_fkey";
-- ALTER TABLE public.user_avatar_settings ADD CONSTRAINT "user_avatar_settings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.user_devices DROP CONSTRAINT IF EXISTS "user_devices_user_id_profiles_fkey";
-- ALTER TABLE public.user_devices ADD CONSTRAINT "user_devices_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.user_difficulty_metrics DROP CONSTRAINT IF EXISTS "user_difficulty_metrics_user_id_profiles_fkey";
-- ALTER TABLE public.user_difficulty_metrics ADD CONSTRAINT "user_difficulty_metrics_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.user_feedback DROP CONSTRAINT IF EXISTS "user_feedback_admin_user_id_profiles_fkey";
-- ALTER TABLE public.user_feedback ADD CONSTRAINT "user_feedback_admin_user_id_fkey" FOREIGN KEY (admin_user_id) REFERENCES auth.users(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
-- ALTER TABLE public.user_feedback DROP CONSTRAINT IF EXISTS "user_feedback_user_id_profiles_fkey";
-- ALTER TABLE public.user_feedback ADD CONSTRAINT "user_feedback_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
-- ALTER TABLE public.user_inscription_banner_dismissals DROP CONSTRAINT IF EXISTS "user_inscription_banner_dismissals_user_id_profiles_fkey";
-- ALTER TABLE public.user_inscription_banner_dismissals ADD CONSTRAINT "user_inscription_banner_dismissals_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.user_interactions DROP CONSTRAINT IF EXISTS "user_interactions_user_id_profiles_fkey";
-- ALTER TABLE public.user_interactions ADD CONSTRAINT "user_interactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.user_medals DROP CONSTRAINT IF EXISTS "user_medals_user_id_profiles_fkey";
-- ALTER TABLE public.user_medals ADD CONSTRAINT "user_medals_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.user_message_interactions DROP CONSTRAINT IF EXISTS "user_message_interactions_user_id_profiles_fkey";
-- ALTER TABLE public.user_message_interactions ADD CONSTRAINT "user_message_interactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.user_notification_metrics DROP CONSTRAINT IF EXISTS "user_notification_metrics_user_id_profiles_fkey";
-- ALTER TABLE public.user_notification_metrics ADD CONSTRAINT "user_notification_metrics_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.user_notification_settings DROP CONSTRAINT IF EXISTS "user_notification_settings_user_id_profiles_fkey";
-- ALTER TABLE public.user_notification_settings ADD CONSTRAINT "user_notification_settings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.user_oposicion_alerts DROP CONSTRAINT IF EXISTS "user_oposicion_alerts_user_id_profiles_fkey";
-- ALTER TABLE public.user_oposicion_alerts ADD CONSTRAINT "user_oposicion_alerts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.user_oposiciones_seguidas DROP CONSTRAINT IF EXISTS "user_oposiciones_seguidas_user_id_profiles_fkey";
-- ALTER TABLE public.user_oposiciones_seguidas ADD CONSTRAINT "user_oposiciones_seguidas_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.user_psychometric_preferences DROP CONSTRAINT IF EXISTS "user_psychometric_preferences_user_id_profiles_fkey";
-- ALTER TABLE public.user_psychometric_preferences ADD CONSTRAINT "user_psychometric_preferences_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.user_streaks DROP CONSTRAINT IF EXISTS "user_streaks_user_id_profiles_fkey";
-- ALTER TABLE public.user_streaks ADD CONSTRAINT "user_streaks_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
-- ALTER TABLE public.user_test_sessions DROP CONSTRAINT IF EXISTS "user_test_sessions_user_id_profiles_fkey";
-- ALTER TABLE public.user_test_sessions ADD CONSTRAINT "user_test_sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.user_theme_performance_cache DROP CONSTRAINT IF EXISTS "user_theme_performance_cache_user_id_profiles_fkey";
-- ALTER TABLE public.user_theme_performance_cache ADD CONSTRAINT "user_theme_performance_cache_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.user_video_progress DROP CONSTRAINT IF EXISTS "user_video_progress_user_id_profiles_fkey";
-- ALTER TABLE public.user_video_progress ADD CONSTRAINT "user_video_progress_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- ALTER TABLE public.verification_queue DROP CONSTRAINT IF EXISTS "verification_queue_created_by_profiles_fkey";
-- ALTER TABLE public.verification_queue ADD CONSTRAINT "verification_queue_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
