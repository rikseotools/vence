import { Module } from '@nestjs/common';
import { ProcessVerificationQueueCron } from './process-verification-queue.cron';
import { ProcessVerificationQueueService } from './process-verification-queue.service';

@Module({
  providers: [ProcessVerificationQueueService, ProcessVerificationQueueCron],
  exports: [ProcessVerificationQueueService],
})
export class ProcessVerificationQueueModule {}
