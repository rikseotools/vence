import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../observability/observability.module';
import { CanaryPsychometricIntegrityCron } from './canary-psychometric-integrity.cron';
import { CanaryPsychometricIntegrityService } from './canary-psychometric-integrity.service';

@Module({
  imports: [ObservabilityModule],
  providers: [CanaryPsychometricIntegrityService, CanaryPsychometricIntegrityCron],
  exports: [CanaryPsychometricIntegrityService],
})
export class CanaryPsychometricIntegrityModule {}
