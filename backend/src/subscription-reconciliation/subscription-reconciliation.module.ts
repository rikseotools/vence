import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../observability/observability.module';
import { SubscriptionReconciliationCron } from './subscription-reconciliation.cron';
import { SubscriptionReconciliationService } from './subscription-reconciliation.service';

@Module({
  imports: [ObservabilityModule],
  providers: [SubscriptionReconciliationService, SubscriptionReconciliationCron],
  exports: [SubscriptionReconciliationService],
})
export class SubscriptionReconciliationModule {}
