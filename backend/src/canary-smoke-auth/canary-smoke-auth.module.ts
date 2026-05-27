import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../observability/observability.module';
import { CanarySmokeAuthCron } from './canary-smoke-auth.cron';
import { CanarySmokeAuthService } from './canary-smoke-auth.service';

@Module({
  imports: [ObservabilityModule],
  providers: [CanarySmokeAuthService, CanarySmokeAuthCron],
  exports: [CanarySmokeAuthService],
})
export class CanarySmokeAuthModule {}
