import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';

/**
 * Verifica la salud del webhook entrante de Stripe.
 *
 * Métrica: % de eventos en Stripe API con `pending_webhooks > 0` en la última
 * hora. Si supera el umbral (10%), indica que nuestro endpoint
 * `/api/stripe/webhook` está respondiendo non-2xx sostenidamente (firma
 * inválida, body parse error, 5xx, etc.) y los pagos no se están aplicando.
 *
 * Originalmente vivía en GHA workflow (`check-webhook-health.yml`, cada 15min)
 * pero el cron sufría lag de horas en GitHub Actions bajo carga (descubierto
 * 27/05/2026 — durante el incidente Rocío/Mercedes el cron no corrió en 5h
 * pese a estar configurado cada 15min). Migrado a backend Fargate scheduler
 * que no depende de la cola GHA.
 *
 * Roadmap origen: docs/runbooks/observability.md + project_gha_cron_lag_migrate_fargate.md
 */
@Injectable()
export class CheckWebhookHealthService {
  private readonly logger = new Logger(CheckWebhookHealthService.name);

  // Umbral del % pending para considerar unhealthy.
  private readonly UNHEALTHY_THRESHOLD_PCT = 10;
  // Ventana de análisis: 1 hora hacia atrás.
  private readonly LOOKBACK_SECONDS = 3600;

  async run(): Promise<WebhookHealthResult> {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY no configurada');
    }

    const stripe = new Stripe(stripeKey);
    const since = Math.floor(Date.now() / 1000) - this.LOOKBACK_SECONDS;

    let total = 0;
    let pending = 0;
    let oldestPendingTs: number | null = null;
    let oldestPendingType: string | null = null;
    let starting_after: string | undefined;

    // Paginar todos los eventos de la última hora. Límite 10 páginas (1000
    // eventos) como tope defensivo — Vence típicamente tiene <500/h.
    // Tipos de params inferidos por TS (Stripe v22 no expone el namespace
    // EventListParams desde el import default — usar inferencia).
    for (let page = 0; page < 10; page++) {
      const opts: Parameters<typeof stripe.events.list>[0] = { limit: 100 };
      if (starting_after) opts.starting_after = starting_after;
      const result = await stripe.events.list(opts);

      let cutoff = false;
      for (const ev of result.data) {
        if (ev.created < since) {
          cutoff = true;
          break;
        }
        total++;
        if (ev.pending_webhooks > 0) {
          pending++;
          if (oldestPendingTs === null || ev.created < oldestPendingTs) {
            oldestPendingTs = ev.created;
            oldestPendingType = ev.type;
          }
        }
      }

      if (cutoff || !result.has_more) break;
      starting_after = result.data[result.data.length - 1].id;
    }

    const pendingPct = total > 0 ? (pending * 100) / total : 0;
    const healthy = pendingPct < this.UNHEALTHY_THRESHOLD_PCT;

    this.logger.log(
      `Stripe webhook health: total=${total} pending=${pending} pct=${pendingPct.toFixed(1)}% healthy=${healthy}`,
    );

    return {
      totalEvents: total,
      pendingEvents: pending,
      pendingPct: Math.round(pendingPct * 10) / 10,
      healthy,
      thresholdPct: this.UNHEALTHY_THRESHOLD_PCT,
      oldestPendingType,
      oldestPendingAgeS: oldestPendingTs
        ? Math.floor(Date.now() / 1000) - oldestPendingTs
        : null,
    };
  }
}

export interface WebhookHealthResult {
  totalEvents: number;
  pendingEvents: number;
  pendingPct: number;
  healthy: boolean;
  thresholdPct: number;
  oldestPendingType: string | null;
  oldestPendingAgeS: number | null;
}
