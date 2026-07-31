import { Module } from '@nestjs/common';
import { LawSourceWatchCron } from './law-source-watch.cron';
import { LawSourceWatchService } from './law-source-watch.service';

@Module({
  providers: [LawSourceWatchService, LawSourceWatchCron],
  exports: [LawSourceWatchService],
})
export class LawSourceWatchModule {}
