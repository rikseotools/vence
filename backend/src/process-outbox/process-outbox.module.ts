import { Module } from '@nestjs/common';
import { ProcessOutboxCron } from './process-outbox.cron';
import { ProcessOutboxService } from './process-outbox.service';

@Module({
  providers: [ProcessOutboxService, ProcessOutboxCron],
  exports: [ProcessOutboxService],
})
export class ProcessOutboxModule {}
