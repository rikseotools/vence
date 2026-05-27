import { Module } from '@nestjs/common';
import { DatabaseModule } from '../db/database.module';
import { ObservabilityModule } from '../observability/observability.module';
import { CanaryDatabasePoolCron } from './canary-database-pool.cron';
import { CanaryDatabasePoolService } from './canary-database-pool.service';

@Module({
  imports: [DatabaseModule, ObservabilityModule],
  providers: [CanaryDatabasePoolService, CanaryDatabasePoolCron],
  exports: [CanaryDatabasePoolService],
})
export class CanaryDatabasePoolModule {}
