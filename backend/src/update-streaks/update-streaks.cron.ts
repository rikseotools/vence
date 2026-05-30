import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { UpdateStreaksService } from './update-streaks.service';

/**
 * Disparador del cron `update-streaks`.
 *
 * Sustituye al endpoint Vercel `app/api/cron/update-streaks/route.js`
 * invocado por GitHub Actions. Aquí el scheduler es in-app y el job
 * corre sin límite de duración.
 */
@Injectable()
export class UpdateStreaksCron {
  private readonly logger = new Logger(UpdateStreaksCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: UpdateStreaksService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    heartbeatRegistry.register(
      'update-streaks',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 90_000_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('0 3 * * *', { name: 'update-streaks', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl());
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron update-streaks disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();
      this.logger.log(
        `Cron update-streaks completado: ${result.updated} actualizados, ` +
          `${result.errors} errores, ${result.resetCount} resets`,
      );
      await this.observability.emit({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'update-streaks',
        durationMs: Date.now() - startedAt,
        metadata: {
          status: 'success',
          activeUsers: result.activeUsers,
          updated: result.updated,
          errors: result.errors,
          resetCount: result.resetCount,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron update-streaks falló: ${errorMessage}`);
      await this.observability.emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'update-streaks',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}
