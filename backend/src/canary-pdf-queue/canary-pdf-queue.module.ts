import { Module } from '@nestjs/common';
import { DatabaseModule } from '../db/database.module';
import { ObservabilityModule } from '../observability/observability.module';
import { CanarySharedModule } from '../canary-shared/canary-shared.module';
import { CanaryPdfQueueCron } from './canary-pdf-queue.cron';
import { CanaryPdfQueueService } from './canary-pdf-queue.service';

@Module({
  imports: [DatabaseModule, ObservabilityModule, CanarySharedModule],
  providers: [CanaryPdfQueueService, CanaryPdfQueueCron],
  exports: [CanaryPdfQueueService],
})
export class CanaryPdfQueueModule {}
