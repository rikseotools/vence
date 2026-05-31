import { Module } from '@nestjs/common';
import { CanaryTopicDataCron } from './canary-topic-data.cron';
import { CanaryTopicDataService } from './canary-topic-data.service';

@Module({
  providers: [CanaryTopicDataService, CanaryTopicDataCron],
  exports: [CanaryTopicDataService],
})
export class CanaryTopicDataModule {}
