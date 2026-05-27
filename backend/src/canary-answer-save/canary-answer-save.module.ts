import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../observability/observability.module';
import { CanaryAnswerSaveCron } from './canary-answer-save.cron';
import { CanaryAnswerSaveService } from './canary-answer-save.service';

@Module({
  imports: [ObservabilityModule],
  providers: [CanaryAnswerSaveService, CanaryAnswerSaveCron],
  exports: [CanaryAnswerSaveService],
})
export class CanaryAnswerSaveModule {}
