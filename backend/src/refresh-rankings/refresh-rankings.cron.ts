import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RefreshRankingsService } from './refresh-rankings.service';

/**
 * Disparador del cron `refresh-rankings`.
 *
 * Sustituye al workflow de GitHub Actions que ejecutaba el endpoint Vercel
 * `/api/cron/refresh-rankings` cada 5 minutos. Aquí el scheduler es in-app
 * y el job corre sin límite de duración (vs `maxDuration = 60` en Vercel).
 *
 * El filtro `month` puede tardar 15-20s con el dataset actual; con el backend
 * NestJS esto ya no es un problema.
 */
@Injectable()
export class RefreshRankingsCron {
  private readonly logger = new Logger(RefreshRankingsCron.name);

  constructor(private readonly service: RefreshRankingsService) {}

  @Cron('*/5 * * * *', { name: 'refresh-rankings', timeZone: 'UTC' })
  async handle(): Promise<void> {
    this.logger.log('Cron refresh-rankings disparado');
    try {
      await this.service.run();
    } catch (error) {
      this.logger.error(
        `Cron refresh-rankings falló: ${error instanceof Error ? error.stack : String(error)}`,
      );
    }
  }
}
