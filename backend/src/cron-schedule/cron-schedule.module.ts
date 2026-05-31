import { Module } from '@nestjs/common';
import { CronScheduleService } from './cron-schedule.service';

@Module({
  providers: [CronScheduleService],
  exports: [CronScheduleService],
})
export class CronScheduleModule {}
