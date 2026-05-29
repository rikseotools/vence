import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ObservabilityService } from '../observability/observability.service';
import { DetectTimelineSilenceService } from './detect-timeline-silence.service';

/**
 * Disparador del cron `detect-timeline-silence`.
 *
 * Equivale al endpoint `app/api/cron/detect-timeline-silence/route.ts`.
 * Schedule: 07:00 UTC diario (ligeramente antes de inicio de jornada).
 */
@Injectable()
export class DetectTimelineSilenceCron {
  private readonly logger = new Logger(DetectTimelineSilenceCron.name);

  constructor(
    private readonly service: DetectTimelineSilenceService,
    private readonly observability: ObservabilityService,
  ) {}

  @Cron('0 7 * * *', { name: 'detect-timeline-silence', timeZone: 'UTC' })
  async handle(): Promise<void> {
    this.logger.log('Cron detect-timeline-silence disparado');
    const startedAt = Date.now();
    try {
      const result = await this.service.run();
      await this.observability.emit({
        source: 'fargate',
        severity: 'info',
        eventType: 'cron_run',
        endpoint: 'detect-timeline-silence',
        durationMs: Date.now() - startedAt,
        metadata: {
          status: 'success',
          candidates: result.candidates,
          signals: result.signals,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Cron detect-timeline-silence falló: ${errorMessage}`);
      await this.observability.emit({
        source: 'fargate',
        severity: 'error',
        eventType: 'cron_run',
        endpoint: 'detect-timeline-silence',
        durationMs: Date.now() - startedAt,
        errorMessage,
        metadata: { status: 'failure' },
      });
    }
  }
}
