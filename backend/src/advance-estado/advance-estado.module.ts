import { Module } from '@nestjs/common';
import { AdvanceEstadoCron } from './advance-estado.cron';
import { AdvanceEstadoService } from './advance-estado.service';

/**
 * Módulo del cron `advance-estado`. Depende solo del cliente Drizzle global
 * (`DRIZZLE`), la observabilidad y el heartbeat (ambos globales/registrados).
 */
@Module({
  providers: [AdvanceEstadoService, AdvanceEstadoCron],
})
export class AdvanceEstadoModule {}
