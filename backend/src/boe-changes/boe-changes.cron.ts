import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BoeChangesService } from './boe-changes.service';

/**
 * Disparador del cron `check-boe-changes`.
 *
 * Sustituye al workflow de GitHub Actions `check-boe-changes.yml` (cron
 * `0 8 * * *`) que ejecutaba el endpoint Vercel con `maxDuration`. Aquí el
 * scheduler es in-app y el job corre sin límite de duración.
 */
@Injectable()
export class BoeChangesCron {
  private readonly logger = new Logger(BoeChangesCron.name);

  constructor(private readonly service: BoeChangesService) {}

  @Cron('0 8 * * *', { name: 'check-boe-changes', timeZone: 'UTC' })
  async handle(): Promise<void> {
    this.logger.log('Cron check-boe-changes disparado');
    try {
      await this.service.runCheck();
    } catch (error) {
      this.logger.error(
        `Cron check-boe-changes falló: ${error instanceof Error ? error.stack : String(error)}`,
      );
    }
  }
}
