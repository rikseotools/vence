import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
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

  constructor(private readonly service: DetectTimelineSilenceService) {}

  @Cron('0 7 * * *', { name: 'detect-timeline-silence', timeZone: 'UTC' })
  async handle(): Promise<void> {
    this.logger.log('Cron detect-timeline-silence disparado');
    try {
      await this.service.run();
    } catch (error) {
      this.logger.error(
        `Cron detect-timeline-silence falló: ${error instanceof Error ? error.stack : String(error)}`,
      );
    }
  }
}
