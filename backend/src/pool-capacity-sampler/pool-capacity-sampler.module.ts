import { Module } from '@nestjs/common';
import { PoolCapacitySamplerCron } from './pool-capacity-sampler.cron';
import { PoolCapacitySamplerService } from './pool-capacity-sampler.service';

/**
 * Acción 2 del roadmap docs/roadmap/observability-capacity.md.
 * Muestreo continuo del pool de Postgres cada minuto, persiste en
 * `pool_capacity_samples`. Convierte el script ad-hoc en monitorización
 * permanente con detección leading-indicator de saturación.
 */
@Module({
  providers: [PoolCapacitySamplerService, PoolCapacitySamplerCron],
  exports: [PoolCapacitySamplerService],
})
export class PoolCapacitySamplerModule {}
