import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type {
  AlertNotification,
  NotificationAdapter,
} from './notification-adapter';

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
    this.toAddress = this.config.get<string>('ADMIN_ALERTS_EMAIL') ?? null;

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

  async send(notifications: AlertNotification[]): Promise<void> {
    const avisos = (notifications ?? []).filter(Boolean);
    if (!avisos.length) return;

    if (!this.resend || !this.toAddress) {
      avisos.forEach((n) =>
        this.logger.warn(
          `[ALERT degradado] ${n.rule} [${n.severity}]: ${n.title}`,
        ),
      );
      return;
    }

    // El asunto lo manda el aviso MÁS GRAVE del lote: es lo que decide si esto
    // se abre ahora o después. Con varios, el conteo va delante para que se vea
    // sin abrir que es un incidente y no un aviso suelto.
    const principal = masGrave(avisos);
    const subject =
      avisos.length === 1
        ? `[Vence ${principal.severity.toUpperCase()}] ${principal.title}`
        : `[Vence ${principal.severity.toUpperCase()}] ${avisos.length} avisos — ${principal.title}`;
    const html =
      avisos.length === 1
        ? this.formatHtml(principal)
        : this.formatDigestHtml(avisos, principal);

    const reglas = avisos.map((n) => n.rule).join(',');
    try {
      const { data, error } = await this.resend.emails.send({
        from: `${this.fromName} <${this.fromAddress}>`,
        to: this.toAddress,
        subject,
        html,
        // Categoría para filtrado en Resend dashboard. Con lote, `rule` lleva
        // todas: filtrar por una regla concreta sigue encontrando su correo.
        tags: [
          { name: 'type', value: 'alert' },
          { name: 'rule', value: sanitizeTag(reglas) },
          { name: 'severity', value: principal.severity },
        ],
      });

      if (error) {
        this.logger.error(
          `Resend error enviando alerta(s) '${reglas}': ${JSON.stringify(error)}`,
        );
        return;
      }

      this.logger.log(
        `Alerta(s) '${reglas}' [${principal.severity}] enviadas en 1 correo (Resend id=${data?.id})`,
      );
    } catch (err) {
      this.logger.error(
        `send() falló para alerta(s) '${reglas}': ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Varios avisos del mismo tick en UN correo (T-272).
   *
   * El cuerpo íntegro de cada aviso se conserva: los cuerpos de este repo llevan
   * las consultas de diagnóstico y el "qué mirar, en orden" (`event_loop_lag`
   * avisa incluso contra su propia conclusión fácil). Recortarlos para que el
   * correo quede bonito destruiría justo lo que lo hace útil a las 3 de la
   * mañana. Lo que se ahorra es el CORREO, no el contenido.
   */
  private formatDigestHtml(
    avisos: AlertNotification[],
    principal: AlertNotification,
  ): string {
    const orden = [...avisos].sort(
      (a, b) => severityRank(b.severity) - severityRank(a.severity),
    );
    const indice = orden
      .map(
        (n) =>
          `<li style="margin-bottom:4px;"><strong style="color:${severityColor(n.severity)};">${n.severity.toUpperCase()}</strong> ${escapeHtml(n.title)} <code style="color:#999;font-size:11px;">${escapeHtml(n.rule)}</code></li>`,
      )
      .join('');

    const secciones = orden.map((n) => this.formatHtml(n, true)).join('');

    return `
<!DOCTYPE html>
<html lang="es"><body style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:16px;">
  <div style="border-left:4px solid ${severityColor(principal.severity)};padding-left:16px;margin-bottom:16px;">
    <div style="text-transform:uppercase;font-size:12px;font-weight:600;color:${severityColor(principal.severity)};letter-spacing:0.5px;">${orden.length} avisos en el mismo tick</div>
    <h2 style="margin:4px 0 0 0;font-size:18px;">${escapeHtml(principal.title)}</h2>
    <p style="margin:8px 0 0 0;font-size:13px;color:#666;">Varias reglas vieron algo a la vez. Suele ser UN incidente visto desde varios sitios — empieza por el más grave.</p>
  </div>
  <ol style="font-size:13px;line-height:1.6;padding-left:20px;">${indice}</ol>
  ${secciones}
  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#999;">
    Vence Alerts · <a href="https://www.vence.es/admin/salud-sistema" style="color:#666;">/admin/salud-sistema</a>
  </div>
</body></html>`.trim();
  }

  /**
   * HTML simple sin librerías de templating. Suficiente para mensajes
   * operacionales — no necesita branding ni layouts complejos.
   *
   * `comoSeccion` lo reutiliza el digest: mismo contenido, sin el `<html>` ni el
   * pie (que en un lote irían repetidos N veces).
   */
  private formatHtml(n: AlertNotification, comoSeccion = false): string {
    const color = severityColor(n.severity);

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

    const cuerpo = `
  <div style="border-left:4px solid ${color};padding-left:16px;margin-bottom:16px;${comoSeccion ? 'margin-top:24px;' : ''}">
    <div style="text-transform:uppercase;font-size:12px;font-weight:600;color:${color};letter-spacing:0.5px;">${n.severity}</div>
    <h2 style="margin:4px 0 0 0;font-size:18px;">${escapeHtml(n.title)}</h2>
    ${comoSeccion ? `<div style="font-size:11px;color:#999;margin-top:4px;">Regla: <code>${escapeHtml(n.rule)}</code></div>` : ''}
  </div>
  <pre style="background:#f6f8fa;padding:12px;border-radius:4px;white-space:pre-wrap;font-size:13px;line-height:1.5;">${escapeHtml(n.body)}</pre>
  ${
    metaRows
      ? `<table style="border-collapse:collapse;margin-top:16px;font-size:13px;width:100%;">${metaRows}</table>`
      : ''
  }`;

    if (comoSeccion) return cuerpo;

    return `
<!DOCTYPE html>
<html lang="es"><body style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:16px;">${cuerpo}
  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#999;">
    Regla: <code>${escapeHtml(n.rule)}</code> · Vence Alerts · <a href="https://www.vence.es/admin/salud-sistema" style="color:#666;">/admin/salud-sistema</a>
  </div>
</body></html>`.trim();
  }
}

const RANGO_SEVERIDAD: Record<string, number> = {
  warn: 1,
  error: 2,
  critical: 3,
};

function severityRank(s: string): number {
  return RANGO_SEVERIDAD[s] ?? 0;
}

function severityColor(s: string): string {
  return s === 'critical' ? '#c0392b' : s === 'error' ? '#e67e22' : '#f1c40f';
}

/** El aviso que decide el asunto: el más grave del lote (empate → el primero). */
function masGrave(avisos: AlertNotification[]): AlertNotification {
  return avisos.reduce((peor, n) =>
    severityRank(n.severity) > severityRank(peor.severity) ? n : peor,
  );
}

/**
 * Los tags de Resend no admiten cualquier carácter (solo ASCII alfanumérico,
 * guiones y bajos). Un lote une reglas con comas, así que hay que sanear: un tag
 * inválido hace que Resend RECHACE el correo entero — el aviso se perdería por
 * un detalle de formato, que es el peor cambio posible en un canal de alertas.
 */
function sanitizeTag(s: string): string {
  return String(s)
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .slice(0, 250);
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
