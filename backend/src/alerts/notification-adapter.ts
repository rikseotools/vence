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
  send(notification: AlertNotification): Promise<void>;
}
