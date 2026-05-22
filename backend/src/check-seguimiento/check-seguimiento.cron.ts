import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CheckSeguimientoService } from './check-seguimiento.service';

/**
 * Disparador del cron `check-seguimiento`.
 *
 * Sustituye al workflow de GitHub Actions `check-seguimiento.yml`
 * (cron `0 9 * * 1-5`) que ejecutaba el endpoint Vercel con `maxDuration=300`.
 * Aquí el scheduler es in-app y el job corre sin límite de duración.
 *
 * Horario: L-V a las 09:00 UTC (igual que el workflow anterior).
 */
@Injectable()
export class CheckSeguimientoCron {
  private readonly logger = new Logger(CheckSeguimientoCron.name);

  constructor(private readonly service: CheckSeguimientoService) {}

  @Cron('0 9 * * 1-5', { name: 'check-seguimiento', timeZone: 'UTC' })
  async handle(): Promise<void> {
    this.logger.log('Cron check-seguimiento disparado');
    try {
      await this.service.run();
    } catch (error) {
      this.logger.error(
        `Cron check-seguimiento falló: ${error instanceof Error ? error.stack : String(error)}`,
      );
    }
  }
}
