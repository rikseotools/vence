import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../observability/observability.module';
import { CanaryIdentidadPagoController } from './canary-identidad-pago.controller';
import { CanaryIdentidadPagoService } from './canary-identidad-pago.service';

/**
 * Canary de la política de identidad en los endpoints de pago. Sin @Cron: se dispara
 * post-deploy vía POST /api/v2/canary/run-identidad-pago (CRON_SECRET), que es el único
 * momento en que esa política puede cambiar de comportamiento.
 */
@Module({
  imports: [ObservabilityModule],
  controllers: [CanaryIdentidadPagoController],
  providers: [CanaryIdentidadPagoService],
  exports: [CanaryIdentidadPagoService],
})
export class CanaryIdentidadPagoModule {}
