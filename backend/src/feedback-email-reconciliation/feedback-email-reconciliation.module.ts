import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../observability/observability.module';
import { FeedbackEmailReconciliationCron } from './feedback-email-reconciliation.cron';
import { FeedbackEmailReconciliationService } from './feedback-email-reconciliation.service';

@Module({
  imports: [ObservabilityModule],
  providers: [
    FeedbackEmailReconciliationService,
    FeedbackEmailReconciliationCron,
  ],
  exports: [FeedbackEmailReconciliationService],
})
export class FeedbackEmailReconciliationModule {}
