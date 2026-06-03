import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../observability/observability.module';
import { DisputeEmailReconciliationCron } from './dispute-email-reconciliation.cron';
import { DisputeEmailReconciliationService } from './dispute-email-reconciliation.service';

@Module({
  imports: [ObservabilityModule],
  providers: [
    DisputeEmailReconciliationService,
    DisputeEmailReconciliationCron,
  ],
  exports: [DisputeEmailReconciliationService],
})
export class DisputeEmailReconciliationModule {}
