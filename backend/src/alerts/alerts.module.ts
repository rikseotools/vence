import { Module } from '@nestjs/common';
import { CronScheduleModule } from '../cron-schedule/cron-schedule.module';
import { AlertsCron } from './alerts.cron';
import { EmailNotificationAdapter } from './email-notification.adapter';
import { NOTIFICATION_ADAPTER } from './notification-adapter';

/**
 * Módulo Alerts — Bloque 4 Gap 8 del manual de observabilidad.
 *
 * Wire-up del rules engine + adapter de notificación. El adapter se
 * inyecta via el token `NOTIFICATION_ADAPTER` — swappable para futuro:
 *   - Hoy: EmailNotificationAdapter (Resend SDK).
 *   - Post-AWS migración: SnsNotificationAdapter (AWS SDK SNS) — cambiar
 *     solo la línea `useClass` aquí, código de reglas/cron NO se entera.
 */
@Module({
  imports: [CronScheduleModule],
  providers: [
    AlertsCron,
    {
      provide: NOTIFICATION_ADAPTER,
      useClass: EmailNotificationAdapter,
    },
  ],
})
export class AlertsModule {}
