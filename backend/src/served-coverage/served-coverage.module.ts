import { Module } from '@nestjs/common';
import { ServedCoverageCron } from './served-coverage.cron';
import { ServedCoverageService } from './served-coverage.service';

@Module({
  providers: [ServedCoverageService, ServedCoverageCron],
  exports: [ServedCoverageService],
})
export class ServedCoverageModule {}
