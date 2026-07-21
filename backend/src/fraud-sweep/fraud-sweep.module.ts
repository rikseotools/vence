import { Module } from '@nestjs/common';
import { FraudSweepCron } from './fraud-sweep.cron';
import { FraudSweepService } from './fraud-sweep.service';

@Module({
  providers: [FraudSweepService, FraudSweepCron],
  exports: [FraudSweepService],
})
export class FraudSweepModule {}
