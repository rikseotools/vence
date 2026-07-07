import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../observability/observability.module';
import { CanaryAnswerPremiumCron } from './canary-answer-premium.cron';
import { CanaryAnswerPremiumService } from './canary-answer-premium.service';

@Module({
  imports: [ObservabilityModule],
  providers: [CanaryAnswerPremiumService, CanaryAnswerPremiumCron],
  exports: [CanaryAnswerPremiumService],
})
export class CanaryAnswerPremiumModule {}
