import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import {
  getStripeWebhookSecrets,
  type StripeAccount,
} from '../stripe/stripe-accounts';

/**
 * Canary Stripe webhook sintético — Nivel 3 extendido del roadmap canary.
 *
 * Cierra el gap del incidente Rocío/Mercedes (27/05/2026): el webhook
 * /api/stripe/webhook estuvo devolviendo 400 signature failed durante
 * horas tras un redeploy con STRIPE_WEBHOOK_SECRET stale, y solo lo
 * detectamos cuando un usuario reportó por chat de soporte.
 *
 * Approach:
 *   1. Construir un Event sintético con type='canary.synthetic' (NO un
 *      type real de Stripe — el handler lo entra a la rama `default:`
 *      que loguea "Unhandled event type" y devuelve 200 sin tocar BD).
 *   2. Firmar el body con `stripe.webhooks.generateTestHeaderString()`
 *      usando STRIPE_WEBHOOK_SECRET — la MISMA key que el handler usa
 *      para verificar eventos reales.
 *   3. POST a https://www.vence.es/api/stripe/webhook con el header
 *      Stripe-Signature. Esperar 200 {received:true}.
 *
 * Lo que detecta (≤5min):
 *   - SSM /vence-frontend/STRIPE_WEBHOOK_SECRET no propagada al ECS task.
 *   - Handler /api/stripe/webhook 404 (route eliminada / deploy roto).
 *   - constructEvent() throw inesperado (regresión código signature).
 *   - App caída / 5xx / timeout.
 *
 * Lo que NO detecta (cabo conocido — cubierto por RULE_STRIPE_WEBHOOK_SIGNATURE_FAILED):
 *   - Secret rotado en Stripe Dashboard sin actualizar SSM frontend.
 *     Caso: canary firma con SSM (viejo) → handler verifica con SSM
 *     (viejo) → ambos coinciden → canary verde. Eventos reales de Stripe
 *     vienen firmados con secret NUEVO → handler verifica con SSM
 *     (viejo) → signature fail → RULE_STRIPE_WEBHOOK_SIGNATURE_FAILED
 *     dispara con el primer evento real fallido.
 *
 * Ventaja arquitectónica: usa el MISMO SSM que el frontend (no duplica),
 * vía cross-namespace IAM permission. Imposible desincronización.
 *
 * MULTI-CUENTA (29/07/2026): cada cuenta Stripe firma con SU signing secret
 * (STRIPE_WEBHOOK_SECRET / _NILA) y el handler los verifica todos. Firmar solo
 * con el de Manuel dejaba SIN sonda la ruta de firma de la cuenta por la que
 * entran hoy todas las altas: se prueba una vez POR CUENTA, y una cuenta sin
 * secret en el task sale como `degraded` (no como verde).
 *
 * Origen: docs/roadmap/canary-y-simulaciones.md §Nivel 3 (variante).
 */
@Injectable()
export class CanaryStripeWebhookService {
  private readonly logger = new Logger(CanaryStripeWebhookService.name);

  private readonly TARGET_URL =
    process.env.SMOKE_TARGET_URL ?? 'https://www.vence.es';
  private readonly MAX_DURATION_MS = 10_000;

  async run(): Promise<CanaryWebhookResult> {
    const startedAt = Date.now();
    const secrets = getStripeWebhookSecrets();

    if (secrets.every((s) => !s.secret)) {
      this.logger.warn(
        `Ningún signing secret configurado en el task (${secrets.map((s) => s.envVar).join(', ')}) — canary inactivo. ` +
          'Añadir cross-namespace SSM read en backend/infra/main.tf + apply.',
      );
      return {
        skipped: true,
        reason: 'secret_not_configured',
        durationMs: Date.now() - startedAt,
      };
    }

    const accounts: CanaryAccountProbe[] = [];
    for (const { account, secret, envVar } of secrets) {
      if (!secret) {
        // Cuenta conocida sin secret en el task: su ruta de firma NO se está
        // probando. Se reporta como punto ciego, no se omite.
        this.logger.warn(
          `Cuenta '${account}' sin ${envVar} en el task — su webhook NO tiene sonda`,
        );
        accounts.push({
          account,
          probed: false,
          ok: false,
          errorMessage: `Falta ${envVar}`,
        });
        continue;
      }
      accounts.push(await this.probeAccount(account, secret));
    }

    const durationMs = Date.now() - startedAt;
    const probed = accounts.filter((a) => a.probed);
    const failed = probed.filter((a) => !a.ok);
    const degraded = accounts.some((a) => !a.probed);

    if (failed.length > 0) {
      const first = failed[0];
      return {
        ok: false,
        step: first.step ?? 'http',
        httpStatus: first.httpStatus,
        errorMessage: `${failed.map((f) => `[${f.account}] ${f.errorMessage}`).join(' | ')}`,
        eventId: first.eventId,
        accounts,
        degraded,
        durationMs,
      };
    }

    return {
      ok: true,
      eventId: probed[0]?.eventId ?? 'n/a',
      accounts,
      degraded,
      durationMs,
    };
  }

  /** Firma y entrega un evento sintético con el secret de UNA cuenta. */
  private async probeAccount(
    account: StripeAccount,
    webhookSecret: string,
  ): Promise<CanaryAccountProbe> {
    const startedAt = Date.now();

    // ─── Construir evento sintético ───
    // type='canary.synthetic' entra a `default:` en /api/stripe/webhook,
    // se loguea como "Unhandled event type" y devuelve 200 sin side effects.
    const timestamp = Math.floor(Date.now() / 1000);
    const eventId = `evt_canary_${timestamp}_${Math.random().toString(36).slice(2, 8)}`;
    const payload = JSON.stringify({
      id: eventId,
      object: 'event',
      api_version: '2025-12-15.clover',
      created: timestamp,
      type: 'canary.synthetic',
      livemode: false,
      pending_webhooks: 0,
      request: { id: null, idempotency_key: null },
      data: {
        object: {
          purpose: 'canary_health_check',
          source: 'vence-backend-canary-stripe-webhook',
        },
      },
    });

    // ─── Firmar como Stripe lo hace en producción ───
    let signature: string;
    try {
      signature = Stripe.webhooks.generateTestHeaderString({
        payload,
        secret: webhookSecret,
        timestamp,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        account,
        probed: true,
        ok: false,
        step: 'sign',
        errorMessage: `Firma sintética falló: ${msg}`,
      };
    }

    // ─── POST al handler real ───
    try {
      const res = await fetch(`${this.TARGET_URL}/api/stripe/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Stripe-Signature': signature,
          'User-Agent': 'Vence-Canary-StripeWebhook/1.0',
          'x-vence-canary': '1',
        },
        body: payload,
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '<no body>');
        return {
          account,
          probed: true,
          ok: false,
          step: 'http',
          httpStatus: res.status,
          errorMessage: `HTTP ${res.status}: ${body.slice(0, 200)}`,
          eventId,
        };
      }

      const data = (await res.json().catch(() => ({}))) as {
        received?: unknown;
      };
      if (data?.received !== true) {
        return {
          account,
          probed: true,
          ok: false,
          step: 'validate_response',
          httpStatus: res.status,
          errorMessage: `Response sin {received:true}: ${JSON.stringify(data).slice(0, 200)}`,
          eventId,
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        account,
        probed: true,
        ok: false,
        step: 'http',
        errorMessage: `Excepción POST webhook: ${msg}`,
        eventId,
      };
    }

    // ─── Validar latencia ───
    const durationMs = Date.now() - startedAt;
    if (durationMs > this.MAX_DURATION_MS) {
      return {
        account,
        probed: true,
        ok: false,
        step: 'validate_latency',
        errorMessage: `Latencia ${durationMs}ms > umbral ${this.MAX_DURATION_MS}ms`,
        eventId,
      };
    }

    return { account, probed: true, ok: true, eventId, durationMs };
  }
}

/** Resultado de la sonda de UNA cuenta. */
export interface CanaryAccountProbe {
  account: StripeAccount;
  /** false = no se probó (sin signing secret en el task) */
  probed: boolean;
  ok: boolean;
  step?: 'sign' | 'http' | 'validate_response' | 'validate_latency';
  httpStatus?: number;
  errorMessage?: string;
  eventId?: string;
  durationMs?: number;
}

export type CanaryWebhookResult =
  | {
      ok: true;
      eventId: string;
      durationMs: number;
      accounts?: CanaryAccountProbe[];
      /** true si alguna cuenta conocida se quedó sin sondear */
      degraded?: boolean;
    }
  | { skipped: true; reason: string; durationMs: number }
  | {
      ok: false;
      step: 'sign' | 'http' | 'validate_response' | 'validate_latency';
      httpStatus?: number;
      errorMessage: string;
      eventId?: string;
      durationMs: number;
      accounts?: CanaryAccountProbe[];
      degraded?: boolean;
    };
