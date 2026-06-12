import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { jitter } from '../heartbeat/jitter.helper';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { CanarySmokeAuthService } from './canary-smoke-auth.service';

/**
 * Disparador del cron `canary-smoke-auth`.
 *
 * Sustituye al hueco que evidenció el incidente Rocío/Mercedes (27/05/2026):
 * el flow auth + profile rompió silenciosamente y nadie lo notó hasta que
 * los usuarios reportaron por feedback (~horas después). Este canary corre
 * cada 5 min y dispara alarma critical en <5 min ante cualquier regresión.
 *
 * Eventos emitidos a observability:
 *   - canary_auth_ok  → severity info  (durationMs, profilePlanType)
 *   - canary_auth_failed → severity critical (step, errorMessage, httpStatus)
 *   - canary_auth_skipped → severity warn  (cuando faltan credenciales SSM)
 *   - cron_run → siempre (liveness del cron)
 *
 * Regla de alarma asociada: `RULE_CANARY_AUTH_FAILED` en alert-rules.ts
 * (severity critical, dispara con 1 sola ocurrencia en 5min, cooldown 15min).
 */
@Injectable()
export class CanarySmokeAuthCron {
  private readonly logger = new Logger(CanarySmokeAuthCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: CanarySmokeAuthService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'canary-smoke-auth',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 720_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('*/5 * * * *', { name: 'canary-smoke-auth', timeZone: 'UTC' })
  async handle(): Promise<void> {
    // Jitter 0-10s para desacoplar de refresh-rankings + alerts-engine.
    await jitter(10_000);
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl(), {
      name: 'canary-smoke-auth',
      observability: this.observability,
    });
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron canary-smoke-auth disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();

      if ('skipped' in result) {
        // No credenciales → no spam de alarmas, solo warn liveness.
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'warn',
          eventType: 'canary_auth_skipped',
          endpoint: 'canary-smoke-auth',
          durationMs: result.durationMs,
          metadata: {
            cron: 'canary-smoke-auth',
            reason: result.reason,
          },
        });
      } else if (result.ok) {
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'info',
          eventType: 'canary_auth_ok',
          endpoint: 'canary-smoke-auth',
          durationMs: result.durationMs,
          metadata: {
            cron: 'canary-smoke-auth',
            plan_type: result.profilePlanType,
          },
        });
      } else {
        // Fallo real → severity critical, regla de alarma RULE_CANARY_AUTH_FAILED.
        this.observability.emitFireAndForget({
          source: 'fargate',
          severity: 'critical',
          eventType: 'canary_auth_failed',
          endpoint: 'canary-smoke-auth',
          durationMs: result.durationMs,
          errorMessage: result.errorMessage,
          httpStatus: result.httpStatus,
          metadata: {
            cron: 'canary-smoke-auth',
            step: result.step,
            plan_type: result.profilePlanType,
          },
        });
      }

      // Liveness del cron (siempre, independiente de resultado).
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'canary-smoke-auth',
        durationMs: Date.now() - startedAt,
        metadata: { cron: 'canary-smoke-auth', status: 'completed' },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron canary-smoke-auth falló: ${errorMessage}`);
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'canary-smoke-auth',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { cron: 'canary-smoke-auth', status: 'failure' },
      });
    }
  }
}
