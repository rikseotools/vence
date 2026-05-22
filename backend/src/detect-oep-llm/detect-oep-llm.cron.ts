import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DetectOepLlmService } from './detect-oep-llm.service';

/**
 * Disparador del cron `detect-oep-llm`.
 *
 * Equivale al endpoint `app/api/cron/detect-oep-llm/route.ts`.
 * Schedule: L-V a las 10:00 UTC.
 */
@Injectable()
export class DetectOepLlmCron {
  private readonly logger = new Logger(DetectOepLlmCron.name);

  constructor(private readonly service: DetectOepLlmService) {}

  @Cron('0 10 * * 1-5', { name: 'detect-oep-llm', timeZone: 'UTC' })
  async handle(): Promise<void> {
    this.logger.log('Cron detect-oep-llm disparado');
    try {
      await this.service.run();
    } catch (error) {
      this.logger.error(
        `Cron detect-oep-llm falló: ${error instanceof Error ? error.stack : String(error)}`,
      );
    }
  }
}
