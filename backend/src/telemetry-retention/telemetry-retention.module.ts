import { Module } from '@nestjs/common';
import { TelemetryRetentionCron } from './telemetry-retention.cron';
import { TelemetryRetentionService } from './telemetry-retention.service';

@Module({
  providers: [TelemetryRetentionService, TelemetryRetentionCron],
  exports: [TelemetryRetentionService],
})
export class TelemetryRetentionModule {}
