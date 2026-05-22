import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ProcessOutboxService } from './process-outbox.service';

/**
 * Disparador del cron `process-outbox`.
 *
 * Sustituye al endpoint Vercel `/api/cron/process-outbox` llamado por
 * GitHub Actions o vercel.json. Aquí el scheduler es in-app y el job corre
 * sin límite de duración.
 *
 * Cadencia: cada 5 minutos (* /5 * * * *), igual que la cadencia objetivo del
 * cron original de Vercel.
 *
 * `FOR UPDATE SKIP LOCKED` en processOutboxBatch garantiza que si dos
 * instancias del cron se solapan por algún motivo, cada una reserva filas
 * distintas sin colisión.
 */
@Injectable()
export class ProcessOutboxCron {
  private readonly logger = new Logger(ProcessOutboxCron.name);

  constructor(private readonly service: ProcessOutboxService) {}

  @Cron('*/5 * * * *', { name: 'process-outbox', timeZone: 'UTC' })
  async handle(): Promise<void> {
    this.logger.log('Cron process-outbox disparado');
    try {
      await this.service.run();
    } catch (error) {
      this.logger.error(
        `Cron process-outbox falló: ${error instanceof Error ? error.stack : String(error)}`,
      );
    }
  }
}
