import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { SentryModule } from '@sentry/nestjs/setup';
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
import { TestConfigModule } from './test-config/test-config.module';
import { ObservabilityModule } from './observability/observability.module';
import { AllExceptionsFilter } from './observability/all-exceptions.filter';
import { AlertsModule } from './alerts/alerts.module';
import { AntifraudModule } from './antifraud/antifraud.module';
import { AuthModule } from './auth/auth.module';
import { BackgroundModule } from './background/background.module';
import { CacheModule } from './cache/cache.module';
import { DailyLimitModule } from './daily-limit/daily-limit.module';
import { EmailModule } from './email/email.module';
import { MedalsModule } from './medals/medals.module';
import { TemaResolverModule } from './tema-resolver/tema-resolver.module';
import { TestAnswersModule } from './test-answers/test-answers.module';
// Crons Stripe — migrados de GHA workflows (lag de horas bajo carga, ver
// memory/project_gha_cron_lag_migrate_fargate.md). Scheduler in-app garantiza
// ejecución puntual.
import { CheckWebhookHealthModule } from './check-webhook-health/check-webhook-health.module';
import { SubscriptionReconciliationModule } from './subscription-reconciliation/subscription-reconciliation.module';
// Canary HTTP autenticado — Nivel 3 sistema canary+simulaciones (27/05/2026
// post-incidente Rocío/Mercedes). Detecta regresión auth+profile en <5min.
import { CanarySmokeAuthModule } from './canary-smoke-auth/canary-smoke-auth.module';
// Canary Stripe webhook sintético — cierra el gap del incidente
// Rocío/Mercedes (27/05/2026): envía evento firmado al /api/stripe/webhook
// real cada 5min. Detecta SSM no propagada / handler 404 / signature code
// roto en <=5min. Ver docs/roadmap/canary-y-simulaciones.md §Nivel 3.
import { CanaryStripeWebhookModule } from './canary-stripe-webhook/canary-stripe-webhook.module';

@Module({
  imports: [
    // Sentry NestJS auto-instrumentation (debe ir PRIMERO en imports).
    // El SDK se inicializa en instrument.ts (importado al top de main.ts).
    // Este módulo añade interceptors para enriquecer eventos con scope
    // de la request (route, method, etc.) automáticamente.
    SentryModule.forRoot(),
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
    // Background tasks (fire-and-forget tras response) — Global, runAfter().
    BackgroundModule,
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
    // Crons Stripe (migrados de GHA 27/05/2026 post-incidente Rocío/Mercedes
    // donde GHA lag impidió detectar webhook roto en >5h):
    CheckWebhookHealthModule, // cada 15min — salud webhook entrante
    SubscriptionReconciliationModule, // cada 1h — Pass-1 BD + Pass-2 Stripe directo
    CanarySmokeAuthModule, // cada 5min — login + GET /api/profile contra prod (Nivel 3)
    CanaryStripeWebhookModule, // cada 5min — evento sintético firmado a /api/stripe/webhook
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
    // test-config family — 4 endpoints públicos (articles/sections/
    // essential-articles/estimate) con cache versionado cross-runtime.
    TestConfigModule,
    // Bloque 4: tabla observable_events unificada (Vercel+Fargate+GHA).
    ObservabilityModule,
    // Bloque 4 Gap 8: rules engine de alertas activas (cron 5min sobre
    // observable_events) + NotificationAdapter swappable (Email Resend
    // hoy → SNS post-AWS).
    AlertsModule,
  ],
  providers: [
    // Gap 3 — ExceptionFilter GLOBAL: cualquier error ≥500 de cualquier
    // controller emite a observable_events automáticamente. Errores 4xx
    // NO se emiten (son comportamiento esperado del cliente).
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
