-- 20260710_fk_indexes_user_deletion_perf.sql
--
-- CAUSA RAÍZ del 504/timeout al BORRAR usuarios (memoria delete_user_api_504_fallback):
-- 17 foreign keys a user_profiles/auth.users NO tenían índice en la columna FK.
-- Al hacer `DELETE FROM user_profiles WHERE id=X`, Postgres verifica la integridad
-- referencial de CADA una de esas 17 tablas (algunas grandes: ai_verification_results
-- ~184k filas, payment_settlements, user_feedback…) con un SEQ SCAN por tabla →
-- ~22-32s por borrado incluso para un usuario mínimo, y >60s (timeout) para usuarios
-- con datos (caso Nuria, 10/07/2026: borrado a medias — auth de Supabase ya borrada,
-- datos RDS intactos hasta aplicar estos índices).
--
-- Con índice en la columna FK, el chequeo referencial es un index lookup (instantáneo)
-- en vez de un seq scan → el borrado deja de escanear esas tablas.
--
-- Aplicado a PROD el 10/07/2026 con CREATE INDEX CONCURRENTLY (no bloquea escrituras).
-- Aquí se deja idempotente (IF NOT EXISTS) como registro/repro; en un entorno que
-- envuelva las migraciones en transacción, quitar CONCURRENTLY (IF NOT EXISTS basta).

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_question_disputes_user_id_fk ON public.question_disputes (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_question_disputes_admin_user_id_fk ON public.question_disputes (admin_user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_roles_granted_by_fk ON public.user_roles (granted_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_verification_results_verified_by_fk ON public.ai_verification_results (verified_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feedback_conversations_user_id_fk ON public.feedback_conversations (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feedback_conversations_admin_user_id_fk ON public.feedback_conversations (admin_user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feedback_messages_sender_id_fk ON public.feedback_messages (sender_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fraud_alerts_reviewed_by_fk ON public.fraud_alerts (reviewed_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fraud_confirmations_action_taken_by_fk ON public.fraud_confirmations (action_taken_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_settlements_user_id_fk ON public.payment_settlements (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_problematic_questions_tracking_resolved_by_fk ON public.problematic_questions_tracking (resolved_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_psychometric_question_disputes_admin_user_id_fk ON public.psychometric_question_disputes (admin_user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscription_adjustments_applied_by_user_id_fk ON public.subscription_adjustments (applied_by_user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_feedback_user_id_fk ON public.user_feedback (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_feedback_admin_user_id_fk ON public.user_feedback (admin_user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_recommendations_user_id_fk ON public.user_recommendations (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_verification_queue_created_by_fk ON public.verification_queue (created_by);
