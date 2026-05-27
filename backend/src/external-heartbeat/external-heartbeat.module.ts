import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../observability/observability.module';
import { ExternalHeartbeatCron } from './external-heartbeat.cron';
import { ExternalHeartbeatService } from './external-heartbeat.service';

@Module({
  imports: [ObservabilityModule],
  providers: [ExternalHeartbeatService, ExternalHeartbeatCron],
  exports: [ExternalHeartbeatService],
})
export class ExternalHeartbeatModule {}
