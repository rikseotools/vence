import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ArchiveInteractionsModule } from './archive-interactions/archive-interactions.module';
import { BoeChangesModule } from './boe-changes/boe-changes.module';
import { validateEnv } from './config/env';
import { DatabaseModule } from './db/database.module';
import { HealthModule } from './health/health.module';
import { RefreshRankingsModule } from './refresh-rankings/refresh-rankings.module';
import { RefreshThemeCacheModule } from './refresh-theme-cache/refresh-theme-cache.module';
import { UpdateStreaksModule } from './update-streaks/update-streaks.module';
import { AvatarRotationModule } from './avatar-rotation/avatar-rotation.module';
import { CheckSeguimientoModule } from './check-seguimiento/check-seguimiento.module';
import { ProcessOutboxModule } from './process-outbox/process-outbox.module';
import { AnthropicModule } from './anthropic/anthropic.module';
import { DetectTimelineSilenceModule } from './detect-timeline-silence/detect-timeline-silence.module';
import { DetectOepLlmModule } from './detect-oep-llm/detect-oep-llm.module';
import { DetectRegionalOepsModule } from './detect-regional-oeps/detect-regional-oeps.module';
import { DetectGenericSourcesModule } from './detect-generic-sources/detect-generic-sources.module';
import { ProcessVerificationQueueModule } from './process-verification-queue/process-verification-queue.module';
import { AnswerSaveModule } from './answer-save/answer-save.module';
import { AntifraudModule } from './antifraud/antifraud.module';
import { AuthModule } from './auth/auth.module';
import { CacheModule } from './cache/cache.module';
import { DailyLimitModule } from './daily-limit/daily-limit.module';
import { EmailModule } from './email/email.module';
import { MedalsModule } from './medals/medals.module';
import { TemaResolverModule } from './tema-resolver/tema-resolver.module';
import { TestAnswersModule } from './test-answers/test-answers.module';

@Module({
  imports: [
    // Config global con validación estricta del entorno al arrancar (fail-fast).
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    // Scheduler in-app — sustituye a Vercel Cron / GitHub Actions.
    ScheduleModule.forRoot(),
    DatabaseModule,
    HealthModule,
    // Cache compartido con Vercel (Bloque 3) — Global, exporta CacheService.
    CacheModule,
    // Auth agnóstica con JwtGuard — Global, exporta JwtVerifier + JwtGuard.
    AuthModule,
    // Email transaccional Resend SDK directo — Global, exporta MedalEmailService.
    EmailModule,
    // Crons — sub-etapa 1a
    BoeChangesModule,
    // Crons — sub-etapa 1b tanda 1 (mantenimiento)
    ArchiveInteractionsModule,
    RefreshThemeCacheModule,
    RefreshRankingsModule,
    UpdateStreaksModule,
    // Crons — sub-etapa 1b tanda 2 (monitoreo + colas)
    CheckSeguimientoModule,
    ProcessOutboxModule,
    ProcessVerificationQueueModule,
    AvatarRotationModule,
    // Crons — sub-etapa 1b tanda 3 (sensores OEP)
    AnthropicModule,
    DetectTimelineSilenceModule,
    DetectOepLlmModule,
    DetectRegionalOepsModule,
    DetectGenericSourcesModule,
    // HTTP endpoints — Bloque 3 canary (Etapa 2)
    MedalsModule,
    // answer-and-save (Fase 1 foundational, esqueletos sin lógica todavía).
    // Ver docs/architecture/bloque3-answer-save-plan.md
    AntifraudModule,
    DailyLimitModule,
    TestAnswersModule,
    TemaResolverModule,
    AnswerSaveModule,
  ],
})
export class AppModule {}
