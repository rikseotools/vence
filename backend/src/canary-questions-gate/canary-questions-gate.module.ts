import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../observability/observability.module';
import { CanaryQuestionsGateController } from './canary-questions-gate.controller';
import { CanaryQuestionsGateService } from './canary-questions-gate.service';

/**
 * Canary del gate anti-scraping. Sin @Cron: se dispara on-demand (post-deploy)
 * vía POST /api/v2/canary/run-questions-gate (CRON_SECRET).
 */
@Module({
  imports: [ObservabilityModule],
  controllers: [CanaryQuestionsGateController],
  providers: [CanaryQuestionsGateService],
  exports: [CanaryQuestionsGateService],
})
export class CanaryQuestionsGateModule {}
