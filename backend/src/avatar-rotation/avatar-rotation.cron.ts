import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AvatarRotationService } from './avatar-rotation.service';

/**
 * Disparador del cron `avatar-rotation`.
 *
 * Sustituye el endpoint `POST /api/cron/avatar-rotation` (Next.js) que el
 * workflow de GitHub Actions invocaba los domingos a las 04:00 UTC.
 * Aquí el scheduler es in-app y el job corre sin límite de duración
 * (el original requería maxDuration=300s en Vercel Pro).
 *
 * Schedule: domingos a las 04:00 UTC.
 */
@Injectable()
export class AvatarRotationCron {
  private readonly logger = new Logger(AvatarRotationCron.name);

  constructor(private readonly service: AvatarRotationService) {}

  @Cron('0 4 * * 0', { name: 'avatar-rotation', timeZone: 'UTC' })
  async handle(): Promise<void> {
    this.logger.log('Cron avatar-rotation disparado');
    try {
      await this.service.run();
    } catch (error) {
      this.logger.error(
        `Cron avatar-rotation falló: ${error instanceof Error ? error.stack : String(error)}`,
      );
    }
  }
}
