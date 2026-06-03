import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../observability/observability.module';
import { CanaryStatsPipelineCron } from './canary-stats-pipeline.cron';
import { CanaryStatsPipelineService } from './canary-stats-pipeline.service';

@Module({
  imports: [ObservabilityModule],
  providers: [CanaryStatsPipelineService, CanaryStatsPipelineCron],
  exports: [CanaryStatsPipelineService],
})
export class CanaryStatsPipelineModule {}
