import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';

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

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      this.logger.warn(
        'STRIPE_WEBHOOK_SECRET no configurado en el task — canary inactivo. ' +
          'Añadir cross-namespace SSM read en backend/infra/main.tf + apply.',
      );
      return {
        skipped: true,
        reason: 'secret_not_configured',
        durationMs: Date.now() - startedAt,
      };
    }

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
        ok: false,
        step: 'sign',
        errorMessage: `Firma sintética falló: ${msg}`,
        durationMs: Date.now() - startedAt,
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
          ok: false,
          step: 'http',
          httpStatus: res.status,
          errorMessage: `HTTP ${res.status}: ${body.slice(0, 200)}`,
          eventId,
          durationMs: Date.now() - startedAt,
        };
      }

      const data = await res.json().catch(() => ({}));
      if (data?.received !== true) {
        return {
          ok: false,
          step: 'validate_response',
          httpStatus: res.status,
          errorMessage: `Response sin {received:true}: ${JSON.stringify(data).slice(0, 200)}`,
          eventId,
          durationMs: Date.now() - startedAt,
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        step: 'http',
        errorMessage: `Excepción POST webhook: ${msg}`,
        eventId,
        durationMs: Date.now() - startedAt,
      };
    }

    // ─── Validar latencia ───
    const durationMs = Date.now() - startedAt;
    if (durationMs > this.MAX_DURATION_MS) {
      return {
        ok: false,
        step: 'validate_latency',
        errorMessage: `Latencia ${durationMs}ms > umbral ${this.MAX_DURATION_MS}ms`,
        eventId,
        durationMs,
      };
    }

    return { ok: true, eventId, durationMs };
  }
}

export type CanaryWebhookResult =
  | { ok: true; eventId: string; durationMs: number }
  | { skipped: true; reason: string; durationMs: number }
  | {
      ok: false;
      step: 'sign' | 'http' | 'validate_response' | 'validate_latency';
      httpStatus?: number;
      errorMessage: string;
      eventId?: string;
      durationMs: number;
    };
