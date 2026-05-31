import { Module } from '@nestjs/common';
import { CronRunnerController } from './cron-runner.controller';
import { CronScheduleService } from './cron-schedule.service';

@Module({
  controllers: [CronRunnerController],
  providers: [CronScheduleService],
  exports: [CronScheduleService],
})
export class CronScheduleModule {}
