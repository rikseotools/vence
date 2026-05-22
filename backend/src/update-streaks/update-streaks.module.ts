import { Module } from '@nestjs/common';
import { UpdateStreaksCron } from './update-streaks.cron';
import { UpdateStreaksService } from './update-streaks.service';

@Module({
  providers: [UpdateStreaksService, UpdateStreaksCron],
  exports: [UpdateStreaksService],
})
export class UpdateStreaksModule {}
