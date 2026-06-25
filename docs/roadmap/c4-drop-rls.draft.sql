-- ============================================================================
-- C4 — DROP de políticas RLS auth.uid() (DRAFT — ⚠️ NO APLICAR TODAVÍA)
-- ============================================================================
-- docs/roadmap/auth-agnostico-jwks-y-rls.md · generado desde pg_policies (25/06/2026)
--
-- ESTE FICHERO ES UN BORRADOR. Está FUERA de supabase/migrations/ A PROPÓSITO
-- (las de esa carpeta se aplican a mano; aquí evitamos cualquier riesgo de que se
-- ejecute por error). Cuando se cumplan las precondiciones, mover el bloque "UP"
-- a supabase/migrations/<timestamp>_c4_drop_rls.sql y aplicarlo.
--
-- PRECONDICIONES OBLIGATORIAS antes de aplicar (si falta una, NO aplicar):
--   1. C1+C2+C3 llevan ~1 semana estables en prod (autorización en app probada).
--   2. Resueltos los 3 .from de CLIENTE que aún tocan tablas user-scoped por
--      PostgREST (si se dropa RLS con ellos vivos = FUGA cross-user):
--        - contexts/AuthContext.tsx (dual-path flag-gated) → flip de Fase B.
--        - hooks/useIntelligentNotifications.ts loadProblematicArticles (×2) →
--          canary FASE 4/5 (user_problematic_articles / problematic_articles_logs).
--   3. Revisadas las políticas public-read (qual=true, inocuas) y lockdown — este
--      script SOLO dropa las 99 políticas con auth.uid(); las demás se quedan.
--   4. Backup / probado contra copia de staging antes de prod.
--
-- ROLLBACK: ejecutar el bloque "DOWN" (recrea las 99 políticas verbatim). Reversible.
-- Nº de políticas auth.uid() afectadas: 99 (sobre 40 tablas user-scoped).
--
-- ============================================================================
-- UP — DROP de las políticas auth.uid() (ejecutar tras precondiciones)
-- ============================================================================
BEGIN;

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
DROP POLICY IF EXISTS "Users can manage their own email preferences" ON public.email_preferences;
DROP POLICY IF EXISTS "Admins can manage fraud_confirmations" ON public.fraud_confirmations;
DROP POLICY IF EXISTS "Admins can manage fraud_watch_list" ON public.fraud_watch_list;
DROP POLICY IF EXISTS "Users can check own watch status" ON public.fraud_watch_list;
DROP POLICY IF EXISTS "Admin can view all notification events" ON public.notification_events;
DROP POLICY IF EXISTS "Users can view own notification events" ON public.notification_events;
DROP POLICY IF EXISTS "Admins can view audit log" ON public.plan_type_audit_log;
DROP POLICY IF EXISTS "Users can delete own first attempts" ON public.psychometric_first_attempts;
DROP POLICY IF EXISTS "Users can insert own first attempts" ON public.psychometric_first_attempts;
DROP POLICY IF EXISTS "Users can update own first attempts" ON public.psychometric_first_attempts;
DROP POLICY IF EXISTS "Users can view own first attempts" ON public.psychometric_first_attempts;
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
DROP POLICY IF EXISTS "Admin can view all pwa events" ON public.pwa_events;
DROP POLICY IF EXISTS "Users can insert own PWA events" ON public.pwa_events;
DROP POLICY IF EXISTS "Users can view own PWA events" ON public.pwa_events;
DROP POLICY IF EXISTS "Admin can view all pwa sessions" ON public.pwa_sessions;
DROP POLICY IF EXISTS "Users can insert own PWA sessions" ON public.pwa_sessions;
DROP POLICY IF EXISTS "Users can update own PWA sessions" ON public.pwa_sessions;
DROP POLICY IF EXISTS "Users can view own PWA sessions" ON public.pwa_sessions;
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
DROP POLICY IF EXISTS "Users can insert own avatar settings" ON public.user_avatar_settings;
DROP POLICY IF EXISTS "Users can update own avatar settings" ON public.user_avatar_settings;
DROP POLICY IF EXISTS "Users can view own avatar settings" ON public.user_avatar_settings;
DROP POLICY IF EXISTS "Users can view their own difficulty metrics" ON public.user_difficulty_metrics;
DROP POLICY IF EXISTS "Admins can view all interactions" ON public.user_interactions;
DROP POLICY IF EXISTS "Users can insert own interactions" ON public.user_interactions;
DROP POLICY IF EXISTS "Users can view own interactions" ON public.user_interactions;
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
DROP POLICY IF EXISTS "Users can insert own streaks" ON public.user_streaks;
DROP POLICY IF EXISTS "Users can update own streak only" ON public.user_streaks;
DROP POLICY IF EXISTS "Users can update own streaks" ON public.user_streaks;
DROP POLICY IF EXISTS "Users can view own streaks" ON public.user_streaks;
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can insert their own test sessions" ON public.user_test_sessions;
DROP POLICY IF EXISTS "Users can update their own test sessions" ON public.user_test_sessions;
DROP POLICY IF EXISTS "Users can view their own test sessions" ON public.user_test_sessions;
DROP POLICY IF EXISTS "Users can read own theme cache" ON public.user_theme_performance_cache;

COMMIT;

-- ============================================================================
-- DOWN — recreación verbatim (rollback)
-- ============================================================================
-- BEGIN;
--
-- CREATE POLICY "Admins can view all conversion events" ON public.conversion_events AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
--    FROM user_profiles
--   WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.plan_type = 'admin'::text)))));
-- CREATE POLICY "Users can view own conversion events" ON public.conversion_events AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can delete own custom oposiciones" ON public.custom_oposiciones AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can insert own custom oposiciones" ON public.custom_oposiciones AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
-- CREATE POLICY "Users can update own custom oposiciones" ON public.custom_oposiciones AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
-- CREATE POLICY "Users can view own and public custom oposiciones" ON public.custom_oposiciones AS PERMISSIVE FOR SELECT TO public USING (((auth.uid() = user_id) OR (is_public = true)));
-- CREATE POLICY "Users can insert own usage" ON public.daily_question_usage AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
-- CREATE POLICY "Users can read own usage" ON public.daily_question_usage AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can update own usage" ON public.daily_question_usage AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Admin can view all email events" ON public.email_events AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
--    FROM user_profiles
--   WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.plan_type = 'admin'::text) OR (user_profiles.email = 'ilovetestpro@gmail.com'::text))))));
-- CREATE POLICY "Users can view own email events" ON public.email_events AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
-- CREATE POLICY "Users can manage their own email preferences" ON public.email_preferences AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Admins can manage fraud_confirmations" ON public.fraud_confirmations AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
--    FROM user_roles
--   WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::text, 'super_admin'::text])) AND (user_roles.is_active = true)))));
-- CREATE POLICY "Admins can manage fraud_watch_list" ON public.fraud_watch_list AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
--    FROM user_roles
--   WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::text, 'super_admin'::text])) AND (user_roles.is_active = true)))));
-- CREATE POLICY "Users can check own watch status" ON public.fraud_watch_list AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
-- CREATE POLICY "Admin can view all notification events" ON public.notification_events AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
--    FROM user_profiles
--   WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.plan_type = 'admin'::text) OR (user_profiles.email = 'ilovetestpro@gmail.com'::text))))));
-- CREATE POLICY "Users can view own notification events" ON public.notification_events AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
-- CREATE POLICY "Admins can view audit log" ON public.plan_type_audit_log AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
--    FROM user_profiles
--   WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.plan_type = 'admin'::text) OR (user_profiles.email = 'manueltrader@gmail.com'::text))))));
-- CREATE POLICY "Users can delete own first attempts" ON public.psychometric_first_attempts AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can insert own first attempts" ON public.psychometric_first_attempts AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
-- CREATE POLICY "Users can update own first attempts" ON public.psychometric_first_attempts AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can view own first attempts" ON public.psychometric_first_attempts AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can create disputes" ON public.psychometric_question_disputes AS PERMISSIVE FOR INSERT TO public WITH CHECK (((auth.uid() = user_id) OR (user_id IS NULL)));
-- CREATE POLICY "Users can view own disputes" ON public.psychometric_question_disputes AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can insert own answers" ON public.psychometric_test_answers AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
-- CREATE POLICY "Users can update own answers" ON public.psychometric_test_answers AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = auth.uid()));
-- CREATE POLICY "Users can view own answers" ON public.psychometric_test_answers AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
-- CREATE POLICY "Users can delete own psychometric sessions" ON public.psychometric_test_sessions AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can insert own psychometric sessions" ON public.psychometric_test_sessions AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
-- CREATE POLICY "Users can update own psychometric sessions" ON public.psychometric_test_sessions AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can view own psychometric sessions" ON public.psychometric_test_sessions AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can view their own question history" ON public.psychometric_user_question_history AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Admin can view all pwa events" ON public.pwa_events AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
--    FROM user_profiles
--   WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.plan_type = 'admin'::text) OR (user_profiles.email = 'ilovetestpro@gmail.com'::text) OR (user_profiles.email = 'manueltrader@gmail.com'::text))))));
-- CREATE POLICY "Users can insert own PWA events" ON public.pwa_events AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
-- CREATE POLICY "Users can view own PWA events" ON public.pwa_events AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Admin can view all pwa sessions" ON public.pwa_sessions AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
--    FROM user_profiles
--   WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.plan_type = 'admin'::text) OR (user_profiles.email = 'ilovetestpro@gmail.com'::text) OR (user_profiles.email = 'manueltrader@gmail.com'::text))))));
-- CREATE POLICY "Users can insert own PWA sessions" ON public.pwa_sessions AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
-- CREATE POLICY "Users can update own PWA sessions" ON public.pwa_sessions AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can view own PWA sessions" ON public.pwa_sessions AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can create own shares" ON public.share_events AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
-- CREATE POLICY "Users can read own shares" ON public.share_events AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can insert own spelling answers" ON public.spelling_test_answers AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
-- CREATE POLICY "Users can view own spelling answers" ON public.spelling_test_answers AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can insert own spelling sessions" ON public.spelling_test_sessions AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
-- CREATE POLICY "Users can update own spelling sessions" ON public.spelling_test_sessions AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can view own spelling sessions" ON public.spelling_test_sessions AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can manage own test configs" ON public.test_configurations AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can insert own test answers" ON public.test_questions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
-- CREATE POLICY "Users can update own test answers" ON public.test_questions AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = auth.uid()));
-- CREATE POLICY "Users can view own test answers" ON public.test_questions AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
-- CREATE POLICY "Admins can view all tests" ON public.tests AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
--    FROM user_roles
--   WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::text)))));
-- CREATE POLICY "Users can insert own tests" ON public.tests AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
-- CREATE POLICY "Users can update own tests" ON public.tests AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can view own tests" ON public.tests AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can insert own avatar settings" ON public.user_avatar_settings AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
-- CREATE POLICY "Users can update own avatar settings" ON public.user_avatar_settings AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can view own avatar settings" ON public.user_avatar_settings AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can view their own difficulty metrics" ON public.user_difficulty_metrics AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Admins can view all interactions" ON public.user_interactions AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
--    FROM user_profiles
--   WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.plan_type = 'admin'::text) OR (user_profiles.email = 'ilovetestpro@gmail.com'::text))))));
-- CREATE POLICY "Users can insert own interactions" ON public.user_interactions AS PERMISSIVE FOR INSERT TO public WITH CHECK (((auth.uid() = user_id) OR (user_id IS NULL)));
-- CREATE POLICY "Users can view own interactions" ON public.user_interactions AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "users_manage_own_analytics" ON public.user_learning_analytics AS PERMISSIVE FOR ALL TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
-- CREATE POLICY "Users can view own medals" ON public.user_medals AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
-- CREATE POLICY "Admins can read all interactions" ON public.user_message_interactions AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
--    FROM user_roles
--   WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::text, 'super_admin'::text])) AND (user_roles.is_active = true)))));
-- CREATE POLICY "Users can create own interactions" ON public.user_message_interactions AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
-- CREATE POLICY "Users can insert their own message interactions" ON public.user_message_interactions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
-- CREATE POLICY "Users can read own interactions" ON public.user_message_interactions AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can update own interactions" ON public.user_message_interactions AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can view their own message interactions" ON public.user_message_interactions AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
-- CREATE POLICY "Admin can view all notification metrics" ON public.user_notification_metrics AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
--    FROM user_profiles
--   WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.plan_type = 'admin'::text) OR (user_profiles.email = 'ilovetestpro@gmail.com'::text))))));
-- CREATE POLICY "Allow users to update notification metrics" ON public.user_notification_metrics AS PERMISSIVE FOR UPDATE TO public USING ((user_id = auth.uid()));
-- CREATE POLICY "Allow users to update own notification metrics" ON public.user_notification_metrics AS PERMISSIVE FOR INSERT TO public WITH CHECK ((user_id = auth.uid()));
-- CREATE POLICY "Users can view own notification metrics" ON public.user_notification_metrics AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
-- CREATE POLICY "Admin can view all notification settings" ON public.user_notification_settings AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
--    FROM user_profiles
--   WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.plan_type = 'admin'::text) OR (user_profiles.email = 'manueltrader@gmail.com'::text))))));
-- CREATE POLICY "Admins can view all profiles" ON public.user_profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
--    FROM user_roles
--   WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::text)))));
-- CREATE POLICY "Users can insert their own profile" ON public.user_profiles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));
-- CREATE POLICY "Users can update own profile" ON public.user_profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));
-- CREATE POLICY "Users can view own profile" ON public.user_profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = id));
-- CREATE POLICY "Users can insert own progress" ON public.user_progress AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
-- CREATE POLICY "Users can update own progress" ON public.user_progress AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can view own progress" ON public.user_progress AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can insert own preferences" ON public.user_psychometric_preferences AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
-- CREATE POLICY "Users can update own preferences" ON public.user_psychometric_preferences AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can view own preferences" ON public.user_psychometric_preferences AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can update own recommendations" ON public.user_recommendations AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can view own recommendations" ON public.user_recommendations AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can view their own roles" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
-- CREATE POLICY "Users can insert their own sessions" ON public.user_sessions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
-- CREATE POLICY "Users can update their own sessions" ON public.user_sessions AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
-- CREATE POLICY "Users can view their own sessions" ON public.user_sessions AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
-- CREATE POLICY "Users can insert own streaks" ON public.user_streaks AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
-- CREATE POLICY "Users can update own streak only" ON public.user_streaks AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
-- CREATE POLICY "Users can update own streaks" ON public.user_streaks AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can view own streaks" ON public.user_streaks AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can view own subscriptions" ON public.user_subscriptions AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
-- CREATE POLICY "Users can insert their own test sessions" ON public.user_test_sessions AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
-- CREATE POLICY "Users can update their own test sessions" ON public.user_test_sessions AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can view their own test sessions" ON public.user_test_sessions AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "Users can read own theme cache" ON public.user_theme_performance_cache AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
--
-- COMMIT;
