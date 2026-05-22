import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { UpdateStreaksService } from './update-streaks.service';

/**
 * Disparador del cron `update-streaks`.
 *
 * Sustituye al endpoint Vercel `app/api/cron/update-streaks/route.js`
 * invocado por GitHub Actions. Aquí el scheduler es in-app y el job
 * corre sin límite de duración.
 */
@Injectable()
export class UpdateStreaksCron {
  private readonly logger = new Logger(UpdateStreaksCron.name);

  constructor(private readonly service: UpdateStreaksService) {}

  @Cron('0 3 * * *', { name: 'update-streaks', timeZone: 'UTC' })
  async handle(): Promise<void> {
    this.logger.log('Cron update-streaks disparado');
    try {
      const result = await this.service.run();
      this.logger.log(
        `Cron update-streaks completado: ${result.updated} actualizados, ` +
          `${result.errors} errores, ${result.resetCount} resets`,
      );
    } catch (error) {
      this.logger.error(
        `Cron update-streaks falló: ${error instanceof Error ? error.stack : String(error)}`,
      );
    }
  }
}
