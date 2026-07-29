import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import {
  getStripeAccountKeys,
  type StripeAccount,
} from '../stripe/stripe-accounts';

/**
 * Verifica la salud del webhook entrante de Stripe, POR CUENTA.
 *
 * Métrica: % de eventos en Stripe API con `pending_webhooks > 0` en la última
 * hora. Si supera el umbral (10%), indica que nuestro endpoint
 * `/api/stripe/webhook` está respondiendo non-2xx sostenidamente para esa
 * cuenta (firma inválida, body parse error, 5xx, etc.) y los pagos no se están
 * aplicando.
 *
 * Originalmente vivía en GHA workflow (`check-webhook-health.yml`, cada 15min)
 * pero el cron sufría lag de horas en GitHub Actions bajo carga (descubierto
 * 27/05/2026 — durante el incidente Rocío/Mercedes el cron no corrió en 5h
 * pese a estar configurado cada 15min). Migrado a backend Fargate scheduler
 * que no depende de la cola GHA.
 *
 * MULTI-CUENTA (29/07/2026): antes leía `STRIPE_SECRET_KEY` a pelo = cuenta
 * Manuel. Con las altas nuevas en Nila, el webhook de Nila podía estar caído al
 * 100% y este cron seguía diciendo "sano" mirando la otra cuenta. Dos reglas:
 *   1. Cada cuenta se evalúa POR SEPARADO — agregar los eventos de todas
 *      diluiría el fallo de la cuenta pequeña por debajo del umbral.
 *   2. Una cuenta conocida sin secret key (o que la API no deja leer) NO es un
 *      verde: sale como `degraded`, que el cron emite con severity warn.
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
    const keys = getStripeAccountKeys();
    if (keys.every((k) => !k.secretKey)) {
      throw new Error(
        `Ninguna cuenta Stripe configurada (${keys.map((k) => k.envVar).join(', ')})`,
      );
    }

    const since = Math.floor(Date.now() / 1000) - this.LOOKBACK_SECONDS;

    const accounts: AccountWebhookHealth[] = await Promise.all(
      keys.map(async ({ account, secretKey, envVar }) => {
        if (!secretKey) {
          // Punto ciego: la cuenta existe en el registro pero este entorno no
          // puede mirarla. Se reporta, no se omite.
          return this.blindAccount(account, `Falta ${envVar}`);
        }
        try {
          return await this.scanAccount(account, secretKey, since);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.error(
            `No se pudo leer eventos de la cuenta '${account}': ${message}`,
          );
          return this.blindAccount(account, message);
        }
      }),
    );

    const readable = accounts.filter((a) => a.readable);
    const unhealthyAccounts = readable
      .filter((a) => !a.healthy)
      .map((a) => a.account);

    // `healthy` = ninguna cuenta LEGIBLE por encima del umbral (lo que dispara
    // la alerta). `degraded` = alguna cuenta que no hemos podido mirar (lo que
    // se emite como warn: no es un fallo de pagos, es falta de vigilancia).
    const healthy = unhealthyAccounts.length === 0;
    const degraded = accounts.some((a) => !a.readable);

    const totalEvents = readable.reduce((acc, a) => acc + a.totalEvents, 0);
    const pendingEvents = readable.reduce((acc, a) => acc + a.pendingEvents, 0);
    const pendingPct =
      totalEvents > 0 ? (pendingEvents * 100) / totalEvents : 0;

    // Evento pending más antiguo entre todas las cuentas legibles.
    const oldest = readable
      .filter((a) => a.oldestPendingAgeS !== null)
      .sort(
        (a, b) => (b.oldestPendingAgeS ?? 0) - (a.oldestPendingAgeS ?? 0),
      )[0];

    this.logger.log(
      `Stripe webhook health: ${accounts
        .map((a) =>
          a.readable
            ? `${a.account}=${a.pendingEvents}/${a.totalEvents} (${a.pendingPct}%)`
            : `${a.account}=SIN LEER (${a.error})`,
        )
        .join(' · ')} → healthy=${healthy} degraded=${degraded}`,
    );

    return {
      totalEvents,
      pendingEvents,
      pendingPct: Math.round(pendingPct * 10) / 10,
      healthy,
      degraded,
      unhealthyAccounts,
      accounts,
      thresholdPct: this.UNHEALTHY_THRESHOLD_PCT,
      oldestPendingType: oldest?.oldestPendingType ?? null,
      oldestPendingAgeS: oldest?.oldestPendingAgeS ?? null,
    };
  }

  private blindAccount(
    account: StripeAccount,
    error: string,
  ): AccountWebhookHealth {
    return {
      account,
      readable: false,
      error,
      totalEvents: 0,
      pendingEvents: 0,
      pendingPct: 0,
      healthy: false,
      oldestPendingType: null,
      oldestPendingAgeS: null,
    };
  }

  private async scanAccount(
    account: StripeAccount,
    secretKey: string,
    since: number,
  ): Promise<AccountWebhookHealth> {
    let total = 0;
    let pending = 0;
    let oldestPendingTs: number | null = null;
    let oldestPendingType: string | null = null;
    let starting_after: string | undefined;

    // Paginar todos los eventos de la última hora. Límite 10 páginas (1000
    // eventos) como tope defensivo — Vence típicamente tiene <500/h.
    for (let page = 0; page < 10; page++) {
      const result = await this.listEvents(secretKey, {
        limit: 100,
        ...(starting_after ? { starting_after } : {}),
      });

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

      if (cutoff || !result.has_more || result.data.length === 0) break;
      starting_after = result.data[result.data.length - 1].id;
    }

    const pendingPct = total > 0 ? (pending * 100) / total : 0;

    return {
      account,
      readable: true,
      totalEvents: total,
      pendingEvents: pending,
      pendingPct: Math.round(pendingPct * 10) / 10,
      healthy: pendingPct < this.UNHEALTHY_THRESHOLD_PCT,
      oldestPendingType,
      oldestPendingAgeS: oldestPendingTs
        ? Math.floor(Date.now() / 1000) - oldestPendingTs
        : null,
    };
  }

  /**
   * Una página de `events.list` para una cuenta. Aislado en un método propio
   * para poder sustituirlo en los tests sin tocar la red.
   *
   * Tipos de params inferidos por TS (Stripe v22 no expone el namespace
   * EventListParams desde el import default — usar inferencia).
   */
  protected async listEvents(
    secretKey: string,
    opts: { limit: number; starting_after?: string },
  ): Promise<{ data: StripeEventLite[]; has_more: boolean }> {
    const stripe = new Stripe(secretKey);
    const result = await stripe.events.list(opts);
    return { data: result.data, has_more: result.has_more };
  }
}

/** Lo mínimo que necesita el chequeo de un evento de Stripe. */
export interface StripeEventLite {
  id: string;
  type: string;
  created: number;
  pending_webhooks: number;
}

export interface AccountWebhookHealth {
  account: StripeAccount;
  /** false = no se pudo mirar esta cuenta (sin key o error de API). */
  readable: boolean;
  error?: string;
  totalEvents: number;
  pendingEvents: number;
  pendingPct: number;
  /** Por debajo del umbral. Una cuenta no legible NUNCA es healthy. */
  healthy: boolean;
  oldestPendingType: string | null;
  oldestPendingAgeS: number | null;
}

export interface WebhookHealthResult {
  totalEvents: number;
  pendingEvents: number;
  pendingPct: number;
  /** true si NINGUNA cuenta legible supera el umbral. */
  healthy: boolean;
  /** true si alguna cuenta conocida no se pudo mirar (falta de vigilancia). */
  degraded: boolean;
  unhealthyAccounts: StripeAccount[];
  accounts: AccountWebhookHealth[];
  thresholdPct: number;
  oldestPendingType: string | null;
  oldestPendingAgeS: number | null;
}
