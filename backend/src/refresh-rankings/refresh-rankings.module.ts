import { Module } from '@nestjs/common';
import { RefreshRankingsCron } from './refresh-rankings.cron';
import { RefreshRankingsService } from './refresh-rankings.service';

@Module({
  providers: [RefreshRankingsService, RefreshRankingsCron],
  exports: [RefreshRankingsService],
})
export class RefreshRankingsModule {}
