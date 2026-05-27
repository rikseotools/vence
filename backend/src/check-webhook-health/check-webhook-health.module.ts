import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../observability/observability.module';
import { CheckWebhookHealthCron } from './check-webhook-health.cron';
import { CheckWebhookHealthService } from './check-webhook-health.service';

@Module({
  imports: [ObservabilityModule],
  providers: [CheckWebhookHealthService, CheckWebhookHealthCron],
  exports: [CheckWebhookHealthService],
})
export class CheckWebhookHealthModule {}
