import { Module } from '@nestjs/common';
import { SimCanaryService } from './sim-canary.service';
import { SimCanaryCron } from './sim-canary.cron';

@Module({
  providers: [SimCanaryService, SimCanaryCron],
})
export class SimCanaryModule {}
