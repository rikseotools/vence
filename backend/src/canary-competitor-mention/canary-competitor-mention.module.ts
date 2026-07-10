import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../observability/observability.module';
import { CanaryCompetitorMentionCron } from './canary-competitor-mention.cron';
import { CanaryCompetitorMentionService } from './canary-competitor-mention.service';

@Module({
  imports: [ObservabilityModule],
  providers: [CanaryCompetitorMentionService, CanaryCompetitorMentionCron],
  exports: [CanaryCompetitorMentionService],
})
export class CanaryCompetitorMentionModule {}
