import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../observability/observability.module';
import { CanarySharedModule } from '../canary-shared/canary-shared.module';
import { CanaryRedisUpstashCron } from './canary-redis-upstash.cron';
import { CanaryRedisUpstashService } from './canary-redis-upstash.service';

@Module({
  imports: [ObservabilityModule, CanarySharedModule],
  providers: [CanaryRedisUpstashService, CanaryRedisUpstashCron],
  exports: [CanaryRedisUpstashService],
})
export class CanaryRedisUpstashModule {}
