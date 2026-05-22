import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ArchiveInteractionsService } from './archive-interactions.service';

/**
 * Disparador del cron `archive-interactions`.
 *
 * Sustituye al workflow de GitHub Actions que ejecutaba el endpoint Vercel con
 * `maxDuration: 300`. Aquí el scheduler es in-app y corre sin límite de tiempo.
 *
 * Horario: 03:30 UTC (fuera de pico de usuarios).
 */
@Injectable()
export class ArchiveInteractionsCron {
  private readonly logger = new Logger(ArchiveInteractionsCron.name);

  constructor(private readonly service: ArchiveInteractionsService) {}

  @Cron('30 3 * * *', { name: 'archive-interactions', timeZone: 'UTC' })
  async handle(): Promise<void> {
    this.logger.log('Cron archive-interactions disparado');
    try {
      await this.service.run();
    } catch (error) {
      this.logger.error(
        `Cron archive-interactions falló: ${error instanceof Error ? error.stack : String(error)}`,
      );
    }
  }
}
