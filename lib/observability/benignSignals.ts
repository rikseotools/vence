/**
 * lib/observability/benignSignals.ts — FUENTE ÚNICA de qué señales error/warn son ruido conocido.
 *
 * Por qué existe (auditoría 29/07/2026): la misma lista estaba copiada a mano en TRES
 * sitios (el endpoint del panel, el comando del runbook §1.ter y la cabeza de quien
 * triaba). El catch-all de `/api/admin/system-health` prometía "sin gaps por diseño",
 * pero como cada copia envejecía por su cuenta, 13 tipos de evento graves llevaban un
 * mes emitiéndose sin que nadie los mirara — entre ellos 991 `server_render_error`.
 *
 * Regla de oro: **añadir aquí un event_type lo saca del semáforo Y del email**. Solo
 * entra lo que es esperado por diseño (un 401 pre-login, un heartbeat saltado), nunca
 * lo que "hace ruido pero deberíamos arreglar" — para eso se arregla o se sube el
 * umbral, no se silencia.
 *
 * Consumidores:
 *  · `app/api/admin/system-health/route.ts` → indicador `error_signals` del panel.
 *  · `backend/src/alerts/benign-signals.ts` → COPIA (el backend NestJS es un paquete
 *    aislado, mismo patrón que `shuffle/permute.ts`), que alimenta la regla catch-all
 *    `senal_error_sin_vigilancia`: cualquier señal NO benigna con volumen manda email
 *    aunque nadie le haya escrito una regla propia.
 *  · `docs/runbooks/health-check.md` §1.ter → el comando CLI.
 * Guardarraíl que impide que vuelvan a divergir: `__tests__/guardrails/senalesBenignasParidad.test.ts`.
 */

/**
 * Señales esperadas por diseño. Se LISTAN igual en el panel (nada oculto) pero no
 * cuentan para el semáforo ni disparan la alerta catch-all.
 */
export const BENIGN_SIGNALS: readonly string[] = [
  'request_completed', // telemetría de éxito muestreada, no un fallo
  'auth', // 401 pre-login: el flujo normal de un usuario anónimo
  'forbidden', // 403 esperado al tocar algo sin permiso
  'rate_limit', // el limitador haciendo su trabajo
  'scraping_challenge_shown', // anti-scraping actuando
  'scraping_force_challenge_set',
  'react_hydration_mismatch', // ruido de extensiones del navegador
  'external_heartbeat_skipped', // heartbeat saltado a propósito
  'console_warn',
  'tts_session_end', // fin de lectura en voz alta, informativo
  'custom', // evento sin taxonomía: el emisor decide su propia alerta
  'test_size_shortfall', // el banco no llega al tamaño pedido; es contenido, no fallo
  'browser_extension_error', // error inyectado por una extensión del usuario
] as const


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
  'canary_db_pool_failed', 'canary_identidad_pago_failed',
  'canary_pdf_queue_failed', 'canary_questions_gate_failed',
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
] as const

const BENIGN_SET = new Set<string>(BENIGN_SIGNALS)
const CON_REGLA_SET = new Set<string>(CON_REGLA_PROPIA)

/** ¿Tiene una regla de alerta propia y fina? (el catch-all no la duplica) */
export function tieneReglaPropia(eventType: string): boolean {
  return CON_REGLA_SET.has(eventType)
}

/** ¿Es ruido conocido? (no cuenta para semáforo ni email) */
export function esSenalBenigna(eventType: string): boolean {
  return BENIGN_SET.has(eventType)
}
