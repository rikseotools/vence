import { Global, Module } from '@nestjs/common';
import { ObservabilityCleanupCron } from './cleanup.cron';
import { ObservabilityService } from './observability.service';

/**
 * Módulo Global de observabilidad — escribe a la tabla
 * `observable_events` (Bloque 4 del roadmap).
 *
 * Global porque cualquier service/controller puede inyectarlo para
 * emitir eventos sin tener que importarlo en cada module.
 *
 * Incluye:
 * - ObservabilityService: emit/emitFireAndForget para escribir eventos.
 * - ObservabilityCleanupCron: poda diaria 04:00 UTC de eventos >30 días
 *   (Gap 10 del manual).
 *
 * El AllExceptionsFilter (Gap 3) se registra como APP_FILTER global en
 * app.module.ts, no aquí — necesita acceso al HttpAdapterHost del core.
 */
@Global()
@Module({
  providers: [ObservabilityService, ObservabilityCleanupCron],
  exports: [ObservabilityService],
})
export class ObservabilityModule {}
