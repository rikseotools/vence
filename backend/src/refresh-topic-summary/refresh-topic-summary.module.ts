import { Module } from '@nestjs/common';
import { RefreshTopicSummaryController } from './refresh-topic-summary.controller';
import { RefreshTopicSummaryCron } from './refresh-topic-summary.cron';
import { RefreshTopicSummaryService } from './refresh-topic-summary.service';

@Module({
  controllers: [RefreshTopicSummaryController],
  providers: [RefreshTopicSummaryService, RefreshTopicSummaryCron],
  exports: [RefreshTopicSummaryService],
})
export class RefreshTopicSummaryModule {}
