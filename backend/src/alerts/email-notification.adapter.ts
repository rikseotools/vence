import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type { AlertNotification, NotificationAdapter } from './notification-adapter';

/**
 * Implementación EMAIL del NotificationAdapter usando Resend SDK directo.
 *
 * Por qué Resend y no AWS SES o nodemailer:
 * - Ya configurado en producción (RESEND_API_KEY existe, validado con
 *   medal-email.service.ts). 0 setup nuevo.
 * - Agnóstico: si mañana migramos a SES en AWS, swappeamos la
 *   implementación de send() sin tocar reglas.
 *
 * Destinatario: ADMIN_ALERTS_EMAIL (env var). Si falta, log warn + skip.
 *
 * Operación degradada: si Resend cae o falta API key → log warn pero
 * NO romper el cron de alertas (los eventos siguen en BD para futura
 * investigación).
 */
@Injectable()
export class EmailNotificationAdapter implements NotificationAdapter {
  private readonly logger = new Logger(EmailNotificationAdapter.name);
  private readonly resend: Resend | null;
  private readonly fromAddress: string;
  private readonly fromName: string;
  private readonly toAddress: string | null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.fromAddress =
      this.config.get<string>('EMAIL_FROM_ADDRESS') ?? 'alerts@vence.es';
    this.fromName =
      this.config.get<string>('EMAIL_FROM_NAME') ?? 'Vence Alerts';
    this.toAddress =
      this.config.get<string>('ADMIN_ALERTS_EMAIL') ?? null;

    if (!apiKey) {
      this.logger.warn(
        'RESEND_API_KEY no configurada — alertas degradadas (solo log)',
      );
      this.resend = null;
      return;
    }
    if (!this.toAddress) {
      this.logger.warn(
        'ADMIN_ALERTS_EMAIL no configurada — alertas degradadas (solo log)',
      );
      this.resend = null;
      return;
    }
    this.resend = new Resend(apiKey);
    this.logger.log(`Alertas configuradas → ${this.toAddress}`);
  }

  async send(notification: AlertNotification): Promise<void> {
    if (!this.resend || !this.toAddress) {
      this.logger.warn(
        `[ALERT degradado] ${notification.rule} [${notification.severity}]: ${notification.title}`,
      );
      return;
    }

    const subject = `[Vence ${notification.severity.toUpperCase()}] ${notification.title}`;
    const html = this.formatHtml(notification);

    try {
      const { data, error } = await this.resend.emails.send({
        from: `${this.fromName} <${this.fromAddress}>`,
        to: this.toAddress,
        subject,
        html,
        // Categoría para filtrado en Resend dashboard
        tags: [
          { name: 'type', value: 'alert' },
          { name: 'rule', value: notification.rule },
          { name: 'severity', value: notification.severity },
        ],
      });

      if (error) {
        this.logger.error(
          `Resend error enviando alerta '${notification.rule}': ${JSON.stringify(error)}`,
        );
        return;
      }

      this.logger.log(
        `Alerta '${notification.rule}' [${notification.severity}] enviada (Resend id=${data?.id})`,
      );
    } catch (err) {
      this.logger.error(
        `send() falló para alerta '${notification.rule}': ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * HTML simple sin librerías de templating. Suficiente para mensajes
   * operacionales — no necesita branding ni layouts complejos.
   */
  private formatHtml(n: AlertNotification): string {
    const severityColor =
      n.severity === 'critical'
        ? '#c0392b'
        : n.severity === 'error'
          ? '#e67e22'
          : '#f1c40f';

    const metaRows = n.metadata
      ? Object.entries(n.metadata)
          .map(
            ([k, v]) =>
              `<tr><td style="padding:4px 12px;color:#666;">${escapeHtml(k)}</td><td style="padding:4px 12px;"><code>${escapeHtml(
                typeof v === 'string' ? v : JSON.stringify(v),
              )}</code></td></tr>`,
          )
          .join('')
      : '';

    return `
<!DOCTYPE html>
<html lang="es"><body style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:16px;">
  <div style="border-left:4px solid ${severityColor};padding-left:16px;margin-bottom:16px;">
    <div style="text-transform:uppercase;font-size:12px;font-weight:600;color:${severityColor};letter-spacing:0.5px;">${n.severity}</div>
    <h2 style="margin:4px 0 0 0;font-size:18px;">${escapeHtml(n.title)}</h2>
  </div>
  <pre style="background:#f6f8fa;padding:12px;border-radius:4px;white-space:pre-wrap;font-size:13px;line-height:1.5;">${escapeHtml(n.body)}</pre>
  ${
    metaRows
      ? `<table style="border-collapse:collapse;margin-top:16px;font-size:13px;width:100%;">${metaRows}</table>`
      : ''
  }
  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#999;">
    Regla: <code>${escapeHtml(n.rule)}</code> · Vence Alerts · <a href="https://www.vence.es/admin/salud-sistema" style="color:#666;">/admin/salud-sistema</a>
  </div>
</body></html>`.trim();
  }
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
