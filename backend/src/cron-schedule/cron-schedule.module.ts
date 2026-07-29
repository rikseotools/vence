import { Module } from '@nestjs/common';
import { CronRunnerController } from './cron-runner.controller';
import {
  CronScheduleService,
  EXTERNAL_SCHEDULED_JOBS_TOKEN,
} from './cron-schedule.service';
import { EXTERNAL_SCHEDULED_JOBS } from './external-jobs.registry';

@Module({
  controllers: [CronRunnerController],
  providers: [
    CronScheduleService,
    // El catálogo REAL de jobs externos entra por DI (los specs inyectan el suyo).
    { provide: EXTERNAL_SCHEDULED_JOBS_TOKEN, useValue: EXTERNAL_SCHEDULED_JOBS },
  ],
  exports: [CronScheduleService],
})
export class CronScheduleModule {}
