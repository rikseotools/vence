import { Module } from '@nestjs/common';
import { CanaryAiModelCron } from './canary-ai-model.cron';
import { CanaryAiModelService } from './canary-ai-model.service';

@Module({
  providers: [CanaryAiModelService, CanaryAiModelCron],
  exports: [CanaryAiModelService],
})
export class CanaryAiModelModule {}
