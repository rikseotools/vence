// canary-shared.module.ts — provee la infraestructura común de canaries.
// Cada módulo de canary la importa para inyectar CanaryRunnerService.
import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../observability/observability.module';
import { CanaryRunnerService } from './canary-runner.service';

@Module({
  imports: [ObservabilityModule],
  providers: [CanaryRunnerService],
  exports: [CanaryRunnerService],
})
export class CanarySharedModule {}
