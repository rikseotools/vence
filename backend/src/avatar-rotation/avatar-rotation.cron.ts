import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { AvatarRotationService } from './avatar-rotation.service';

/**
 * Disparador del cron `avatar-rotation`.
 *
 * Sustituye el endpoint `POST /api/cron/avatar-rotation` (Next.js) que el
 * workflow de GitHub Actions invocaba los domingos a las 04:00 UTC.
 * Aquí el scheduler es in-app y el job corre sin límite de duración
 * (el original requería maxDuration=300s en Vercel Pro).
 *
 * Schedule: domingos a las 04:00 UTC.
 */
@Injectable()
export class AvatarRotationCron {
  private readonly logger = new Logger(AvatarRotationCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: AvatarRotationService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    // Weekly → threshold 8 días para tolerar 1 día de retraso.
    heartbeatRegistry.register(
      'avatar-rotation',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 691_200_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('0 4 * * 0', { name: 'avatar-rotation', timeZone: 'UTC' })
  async handle(): Promise<void> {
    await runWithHeartbeat(this, 'lastTickAtMs', async () => this.runImpl());
  }

  private async runImpl(): Promise<void> {
    this.logger.log('Cron avatar-rotation disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'avatar-rotation',
        durationMs: Date.now() - startedAt,
        metadata: {
          status: 'success',
          totalUsers: result.totalUsers,
          rotated: result.rotated,
          unchanged: result.unchanged,
          errors: result.errors,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron avatar-rotation falló: ${errorMessage}`);
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'avatar-rotation',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}
