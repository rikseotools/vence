/**
 * backend/src/alerts/benign-signals.ts — señales error/warn que son ruido conocido.
 *
 * ⚠️ COPIA de `lib/observability/benignSignals.ts` (frontend). El backend NestJS es un
 * paquete AISLADO (`backend/tsconfig.json` no tiene paths al frontend), igual que con
 * `shuffle/permute.ts` y `debeConsumirCupo`: copia + guardarraíl de PARIDAD que falla
 * en CI si divergen (`__tests__/guardrails/senalesBenignasParidad.test.ts`).
 *
 * Lo consume la regla catch-all `senal_error_sin_vigilancia`: manda email ante
 * cualquier señal NO listada aquí que supere el umbral, tenga o no regla propia. Esa
 * es la garantía de que un tipo de evento nuevo no puede volver a pasar un mes sin que
 * nadie se entere (auditoría 29/07/2026: 991 `server_render_error` invisibles).
 */
export const BENIGN_SIGNALS: readonly string[] = [
  'request_completed',
  'auth',
  'forbidden',
  'rate_limit',
  'scraping_challenge_shown',
  'scraping_force_challenge_set',
  'react_hydration_mismatch',
  'external_heartbeat_skipped',
  'console_warn',
  'tts_session_end',
  'custom',
  'test_size_shortfall',
  'browser_extension_error',
];

/**
 * Señales que YA tienen su propia regla de alerta fina en `backend/src/alerts/alert-rules.ts`.
 *
 * No son benignas —son fallos de verdad— pero su regla decide mejor que un umbral de
 * volumen: `dispute_submit_failed` avisa a partir de 3/h porque tres impugnaciones
 * perdidas son tres usuarios jodidos, y `shuffle_option_order_invalid` a partir de 1.
 * Si el catch-all las contase otra vez, el mismo incidente mandaría dos correos y el
 * umbral grueso taparía al fino.
 *
 * Guardarraíl: cada entrada debe aparecer de verdad como `event_type` en una regla
 * (`__tests__/guardrails/senalesBenignasParidad.test.ts`). Sacar una regla del catálogo
 * sin sacarla de aquí dejaría un hueco silencioso — el test lo impide.
 */
export const CON_REGLA_PROPIA: readonly string[] = [
  'alert_rule_failed', 'canary_answer_save_failed', 'canary_auth_failed',
  'canary_db_pool_failed', 'canary_pdf_queue_failed', 'canary_questions_gate_failed',
  'canary_redis_failed', 'canary_save_contract_failed', 'canary_stats_pipeline_failed',
  'canary_stripe_webhook_failed', 'canary_synthetic_external_failed',
  'canary_theme_stats_failed', 'canary_topic_data_failed',
  'client_error', 'deploy_failed', 'dispute_submit_failed', 'event_loop_lag',
  'exam_integrity_drift', 'filtered_questions_validation_rejected',
  'http_4xx', 'http_5xx', 'http_network_error', 'http_timeout', 'invariant_violation',
  'laws_configurator_error', 'network_retry', 'react_error_boundary', 'runtime_kill',
  'shuffle_option_order_invalid', 'subscription_cancel_error', 'subscription_drift',
  'subscription_drift_missing_in_db', 'subscription_force_canceled_past_due',
  'subscription_void_invoice_failed', 'tts_error', 'unhandled_error',
  'unhandled_rejection', 'webhook_unhealthy', 'workflow_failed', 'workflow_failure',
];
