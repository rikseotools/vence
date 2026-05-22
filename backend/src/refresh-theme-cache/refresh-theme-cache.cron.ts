import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RefreshThemeCacheService } from './refresh-theme-cache.service';

/**
 * Disparador del cron `refresh-theme-cache`.
 *
 * Sustituye al endpoint Vercel `app/api/cron/refresh-theme-cache/route.js`
 * (antes invocado vía GitHub Actions con maxDuration=60s).
 * Aquí corre a las 23:00 UTC sin límite de duración.
 */
@Injectable()
export class RefreshThemeCacheCron {
  private readonly logger = new Logger(RefreshThemeCacheCron.name);

  constructor(private readonly service: RefreshThemeCacheService) {}

  @Cron('0 23 * * *', { name: 'refresh-theme-cache', timeZone: 'UTC' })
  async handle(): Promise<void> {
    this.logger.log('Cron refresh-theme-cache disparado');
    try {
      await this.service.run();
    } catch (error) {
      this.logger.error(
        `Cron refresh-theme-cache falló: ${error instanceof Error ? error.stack : String(error)}`,
      );
    }
  }
}
