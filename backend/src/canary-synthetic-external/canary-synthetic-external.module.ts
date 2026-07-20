import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../observability/observability.module';
import { CanarySharedModule } from '../canary-shared/canary-shared.module';
import { CanarySyntheticExternalCron } from './canary-synthetic-external.cron';
import { CanarySyntheticExternalService } from './canary-synthetic-external.service';

@Module({
  imports: [ObservabilityModule, CanarySharedModule],
  providers: [CanarySyntheticExternalService, CanarySyntheticExternalCron],
  exports: [CanarySyntheticExternalService],
})
export class CanarySyntheticExternalModule {}
