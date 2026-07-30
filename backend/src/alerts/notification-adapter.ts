/**
 * Interfaz agnóstica para enviar notificaciones de alertas.
 *
 * Hoy: EmailNotificationAdapter usa Resend (ya configurado en EmailModule).
 * Mañana en AWS: SnsNotificationAdapter usa AWS SDK SNS.
 * Hipotético: SlackNotificationAdapter, TelegramNotificationAdapter, etc.
 *
 * El AlertsService inyecta `NOTIFICATION_ADAPTER` por token DI — la
 * implementación concreta se decide al wirearlo en `AlertsModule`. Swap
 * futuro = 0 cambios en código de reglas.
 *
 * Bloque 4 Gap 8 del manual de observabilidad (§9 «Alertas activas»).
 */
export const NOTIFICATION_ADAPTER = Symbol('NOTIFICATION_ADAPTER');

export interface AlertNotification {
  rule: string;
  severity: 'warn' | 'error' | 'critical';
  title: string;
  body: string;
  /** Para deduplicación / cooldown: hash del contenido relevante. */
  fingerprint?: string;
  /** Métricas opcionales que la regla quiera incluir. */
  metadata?: Record<string, unknown>;
}

export interface NotificationAdapter {
  /**
   * Envía los avisos de UN tick del motor.
   *
   * Es un LOTE, no un aviso, desde T-272: el 29/07 una sola saturación de
   * `/api/interactions` mandó 6 correos porque disparaon 6 reglas distintas
   * (`5xx_spike`, `client_edge_sustained`, `endpoint_latency_sustained`,
   * `frontend_saturation`, `client_error_spike`×2) en la misma ventana. Un
   * incidente es UN correo; qué reglas lo vieron es contenido del correo, no
   * motivo para mandar otro.
   *
   * Contrato: con lista vacía no manda nada. NUNCA lanza — un fallo del canal
   * se registra (log + señal) pero no puede tumbar el tick del motor.
   */
  send(notifications: AlertNotification[]): Promise<void>;
}
