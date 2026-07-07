import { Module } from '@nestjs/common';
import { InternalCronTriggersCron } from './internal-cron-triggers.cron';
import { InternalCronTriggersService } from './internal-cron-triggers.service';

@Module({
  providers: [InternalCronTriggersService, InternalCronTriggersCron],
  exports: [InternalCronTriggersService],
})
export class InternalCronTriggersModule {}
