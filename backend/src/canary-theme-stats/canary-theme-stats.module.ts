import { Module } from '@nestjs/common';
import { DatabaseModule } from '../db/database.module';
import { ObservabilityModule } from '../observability/observability.module';
import { CanaryThemeStatsCron } from './canary-theme-stats.cron';
import { CanaryThemeStatsService } from './canary-theme-stats.service';

@Module({
  imports: [DatabaseModule, ObservabilityModule],
  providers: [CanaryThemeStatsService, CanaryThemeStatsCron],
  exports: [CanaryThemeStatsService],
})
export class CanaryThemeStatsModule {}
