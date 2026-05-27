import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../observability/observability.module';
import { CanaryStripeWebhookCron } from './canary-stripe-webhook.cron';
import { CanaryStripeWebhookService } from './canary-stripe-webhook.service';

@Module({
  imports: [ObservabilityModule],
  providers: [CanaryStripeWebhookService, CanaryStripeWebhookCron],
  exports: [CanaryStripeWebhookService],
})
export class CanaryStripeWebhookModule {}
