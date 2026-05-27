import { Module } from '@nestjs/common';
import { CanaryAnswerSaveModule } from '../canary-answer-save/canary-answer-save.module';
import { CanaryDatabasePoolModule } from '../canary-database-pool/canary-database-pool.module';
import { CanaryRedisUpstashModule } from '../canary-redis-upstash/canary-redis-upstash.module';
import { CanarySmokeAuthModule } from '../canary-smoke-auth/canary-smoke-auth.module';
import { CanaryStripeWebhookModule } from '../canary-stripe-webhook/canary-stripe-webhook.module';
import { ExternalHeartbeatModule } from '../external-heartbeat/external-heartbeat.module';
import { CanaryRunnerController } from './canary-runner.controller';

/**
 * Endpoint admin que dispara los 5 canarios on-demand. Solo importa los
 * 5 módulos (cada uno exporta su service) — sin providers propios.
 */
@Module({
  imports: [
    CanarySmokeAuthModule,
    CanaryStripeWebhookModule,
    CanaryAnswerSaveModule,
    CanaryDatabasePoolModule,
    CanaryRedisUpstashModule,
    ExternalHeartbeatModule,
  ],
  controllers: [CanaryRunnerController],
})
export class CanaryRunnerModule {}
