import { Global, Module } from '@nestjs/common';
import { ObservabilityService } from './observability.service';

/**
 * Módulo Global de observabilidad — escribe a la tabla
 * `observable_events` (Bloque 4 del roadmap).
 *
 * Global porque cualquier service/controller puede inyectarlo para
 * emitir eventos sin tener que importarlo en cada module.
 */
@Global()
@Module({
  providers: [ObservabilityService],
  exports: [ObservabilityService],
})
export class ObservabilityModule {}
