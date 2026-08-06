import { Global, Module } from '@nestjs/common';
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
 *
 * La PODA de `observable_events` vive en `TelemetryRetentionService` (cron
 * `telemetry-retention`, 04:10 UTC) y NO aquí. Hubo un segundo cron propio
 * (`observability-cleanup`, 04:00) que hacía la misma poda de un solo `DELETE`
 * gigante: se borró en T-613 porque llevaba desde el 04/08 muriendo en el
 * `statement_timeout` a los 30 s —y mandando un correo al día— y porque podaba por
 * `ts` en vez de por `created_at`, que es el criterio bueno (un `ts` corrupto de
 * cliente nunca cumple «> 30 días» y viviría para siempre). Dos puertas al mismo
 * recurso con criterios distintos no protegen: se contradicen.
 *
 * El AllExceptionsFilter (Gap 3) se registra como APP_FILTER global en
 * app.module.ts, no aquí — necesita acceso al HttpAdapterHost del core.
 */
@Global()
@Module({
  providers: [ObservabilityService],
  exports: [ObservabilityService],
})
export class ObservabilityModule {}
