import { Module } from '@nestjs/common';
import { CanaryPorLeyesScopeCron } from './canary-por-leyes-scope.cron';
import { CanaryPorLeyesScopeService } from './canary-por-leyes-scope.service';

@Module({
  providers: [CanaryPorLeyesScopeService, CanaryPorLeyesScopeCron],
  exports: [CanaryPorLeyesScopeService],
})
export class CanaryPorLeyesScopeModule {}
