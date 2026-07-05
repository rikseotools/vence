import { Module } from '@nestjs/common';
import { DatabaseModule } from '../db/database.module';
import { ObservabilityModule } from '../observability/observability.module';
import { CanarySaveContractCron } from './canary-save-contract.cron';
import { CanarySaveContractService } from './canary-save-contract.service';

@Module({
  imports: [DatabaseModule, ObservabilityModule],
  providers: [CanarySaveContractService, CanarySaveContractCron],
  exports: [CanarySaveContractService],
})
export class CanarySaveContractModule {}
