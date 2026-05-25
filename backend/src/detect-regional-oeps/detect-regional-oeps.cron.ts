import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ObservabilityService } from '../observability/observability.service';
import { DetectRegionalOepsService } from './detect-regional-oeps.service';

/**
 * Disparador del cron `detect-regional-oeps`.
 *
 * Equivale al endpoint `app/api/cron/detect-regional-oeps/route.ts`.
 * Schedule: lunes a las 08:00 UTC (semanal).
 */
@Injectable()
export class DetectRegionalOepsCron {
  private readonly logger = new Logger(DetectRegionalOepsCron.name);

  constructor(
    private readonly service: DetectRegionalOepsService,
    private readonly observability: ObservabilityService,
  ) {}

  @Cron('0 8 * * 1', { name: 'detect-regional-oeps', timeZone: 'UTC' })
  async handle(): Promise<void> {
    this.logger.log('Cron detect-regional-oeps disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'detect-regional-oeps',
        durationMs: Date.now() - startedAt,
        metadata: {
          status: 'success',
          totalSources: result.totalSources,
          scanned: result.scanned,
          extractionOk: result.extractionOk,
          novelSignals: result.novelSignals,
          existingSignals: result.existingSignals,
          errors: result.errors,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron detect-regional-oeps falló: ${errorMessage}`);
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'detect-regional-oeps',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}
