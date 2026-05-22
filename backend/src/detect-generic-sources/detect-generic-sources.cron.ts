import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DetectGenericSourcesService } from './detect-generic-sources.service';

/**
 * Disparador del cron `detect-generic-sources`.
 *
 * Equivale al endpoint `app/api/cron/detect-generic-sources/route.ts`.
 * Schedule: L-V a las 08:00 UTC.
 */
@Injectable()
export class DetectGenericSourcesCron {
  private readonly logger = new Logger(DetectGenericSourcesCron.name);

  constructor(private readonly service: DetectGenericSourcesService) {}

  @Cron('0 8 * * 1-5', { name: 'detect-generic-sources', timeZone: 'UTC' })
  async handle(): Promise<void> {
    this.logger.log('Cron detect-generic-sources disparado');
    try {
      await this.service.run();
    } catch (error) {
      this.logger.error(
        `Cron detect-generic-sources falló: ${error instanceof Error ? error.stack : String(error)}`,
      );
    }
  }
}
