import { Module } from '@nestjs/common';
import { ContentHealthSweepCron } from './content-health-sweep.cron';
import { ContentHealthSweepService } from './content-health-sweep.service';

@Module({
  providers: [ContentHealthSweepService, ContentHealthSweepCron],
  exports: [ContentHealthSweepService],
})
export class ContentHealthSweepModule {}
