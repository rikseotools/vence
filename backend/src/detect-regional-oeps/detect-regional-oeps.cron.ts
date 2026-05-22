import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
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

  constructor(private readonly service: DetectRegionalOepsService) {}

  @Cron('0 8 * * 1', { name: 'detect-regional-oeps', timeZone: 'UTC' })
  async handle(): Promise<void> {
    this.logger.log('Cron detect-regional-oeps disparado');
    try {
      await this.service.run();
    } catch (error) {
      this.logger.error(
        `Cron detect-regional-oeps falló: ${error instanceof Error ? error.stack : String(error)}`,
      );
    }
  }
}
