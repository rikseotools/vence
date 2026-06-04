import { Module } from '@nestjs/common';
import { PoolerInstanceSamplerCron } from './pooler-instance-sampler.cron';
import { PoolerInstanceSamplerService } from './pooler-instance-sampler.service';
import { PoolerDiscoveryService } from './pooler-discovery.service';

/**
 * Observabilidad por instancia del self-hosted PgBouncer (Fase 1).
 * ARCHITECTURE_ROADMAP §03/06 prioridad nº1. Cron 1×/min → scrape de cada VM
 * por red privada → tabla `pgbouncer_instance_samples` → alertas por instancia.
 */
@Module({
  providers: [
    PoolerInstanceSamplerService,
    PoolerInstanceSamplerCron,
    PoolerDiscoveryService,
  ],
  exports: [PoolerInstanceSamplerService],
})
export class PoolerInstanceSamplerModule {}
