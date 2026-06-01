import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  getLastTickMsAgo,
  runWithHeartbeat,
} from '../heartbeat/heartbeat.helpers';
import { jitter } from '../heartbeat/jitter.helper';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { SyncUqhV1BridgeService } from './sync-uqh-v1-bridge.service';

// ⚠️  PUENTE TEMPORAL — ver comentario en sync-uqh-v1-bridge.service.ts.
@Injectable()
export class SyncUqhV1BridgeCron {
  private readonly logger = new Logger(SyncUqhV1BridgeCron.name);
  public lastTickAtMs: number | null = null;

  constructor(
    private readonly service: SyncUqhV1BridgeService,
    private readonly observability: ObservabilityService,
    heartbeatRegistry: HeartbeatRegistry,
  ) {
    // Cada 5min → threshold 12min (2.4× interval). Grace 120s para bootstrap.
    heartbeatRegistry.register(
      'sync-uqh-v1-bridge',
      () => getLastTickMsAgo(this, 'lastTickAtMs'),
      { thresholdMs: 720_000, gracePeriodMs: 120_000 },
    );
  }

  @Cron('*/5 * * * *', { name: 'sync-uqh-v1-bridge', timeZone: 'UTC' })
  async handle(): Promise<void> {
    // Jitter 0-30s para no colisionar con otros @Cron('*/5 * * * *').
    await jitter(30_000);
    const startedAt = Date.now();
    await runWithHeartbeat(this, 'lastTickAtMs', async () => {
      try {
        const result = await this.service.run();
        await this.observability.emit({
          source: 'fargate',
          severity: 'info',
          eventType: 'cron_run',
          endpoint: 'sync-uqh-v1-bridge',
          durationMs: Date.now() - startedAt,
          metadata: {
            status: 'success',
            rowsAffected: result.rowsAffected,
            startedFromTs: result.startedFromTs,
          },
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(`sync-uqh-v1-bridge falló: ${errorMessage}`);
        await this.observability.emit({
          source: 'fargate',
          severity: 'error',
          eventType: 'cron_run',
          endpoint: 'sync-uqh-v1-bridge',
          durationMs: Date.now() - startedAt,
          errorMessage,
          metadata: { status: 'failure' },
        });
      }
    });
  }
}
