import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ArchiveInteractionsModule } from './archive-interactions/archive-interactions.module';
import { BoeChangesModule } from './boe-changes/boe-changes.module';
import { validateEnv } from './config/env';
import { DatabaseModule } from './db/database.module';
import { HealthModule } from './health/health.module';
import { HeartbeatModule } from './heartbeat/heartbeat.registry';
import { RefreshRankingsModule } from './refresh-rankings/refresh-rankings.module';
import { RefreshThemeCacheModule } from './refresh-theme-cache/refresh-theme-cache.module';
import { UpdateStreaksModule } from './update-streaks/update-streaks.module';
import { AutoPromoteCoverageModule } from './auto-promote-coverage/auto-promote-coverage.module';
import { RefreshMvOposicionesModule } from './refresh-mv-oposiciones/refresh-mv-oposiciones.module';
import { AvatarRotationModule } from './avatar-rotation/avatar-rotation.module';
import { CheckSeguimientoModule } from './check-seguimiento/check-seguimiento.module';
import { SeoSnapshotModule } from './seo-snapshot/seo-snapshot.module';
import { ProcessOutboxModule } from './process-outbox/process-outbox.module';
import { AnthropicModule } from './anthropic/anthropic.module';
import { DetectTimelineSilenceModule } from './detect-timeline-silence/detect-timeline-silence.module';
import { DetectOepLlmModule } from './detect-oep-llm/detect-oep-llm.module';
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
import { DisputeEmailReconciliationModule } from './dispute-email-reconciliation/dispute-email-reconciliation.module';
// Canary HTTP autenticado — Nivel 3 sistema canary+simulaciones (27/05/2026
// post-incidente Rocío/Mercedes). Detecta regresión auth+profile en <5min.
import { CanarySmokeAuthModule } from './canary-smoke-auth/canary-smoke-auth.module';
// Canary Stripe webhook sintético — cierra el gap del incidente
// Rocío/Mercedes (27/05/2026): envía evento firmado al /api/stripe/webhook
// real cada 5min. Detecta SSM no propagada / handler 404 / signature code
// roto en <=5min. Ver docs/roadmap/canary-y-simulaciones.md §Nivel 3.
import { CanaryStripeWebhookModule } from './canary-stripe-webhook/canary-stripe-webhook.module';
// Canary del endpoint MÁS caliente: POST /api/v2/answer-and-save. Cubre
// Drizzle transactional save, antifraud, daily-limit, RLS. Smoke user
// (premium) responde 1 pregunta hardcodeada cada 5min — 288 inserts/día
// son irrelevantes vs miles de users reales.
import { CanaryAnswerSaveModule } from './canary-answer-save/canary-answer-save.module';
// Canarios de INFRA externa (Sprint 5, 27/05/2026). Únicos canarios
// adicionales que pasan la regla anti-duplicación: NO existe test CI
// que cubra saturación PgBouncer ni caída Upstash en runtime real.
import { CanaryDatabasePoolModule } from './canary-database-pool/canary-database-pool.module';
import { CanaryRedisUpstashModule } from './canary-redis-upstash/canary-redis-upstash.module';
// Canary GET /api/topics/[numero] sintético (31/05/2026, post Fase D-bis Iter 1.5).
// Detecta caída del path Next.js + Redis + BD + flag TOPIC_MV_ENABLED en
// runtime real. Regla de oro PASS: ningún test CI cubre el endpoint vivo.
import { CanaryTopicDataModule } from './canary-topic-data/canary-topic-data.module';
// Endpoint admin POST /api/v2/canary/run-now (dispara los 5 canarios on-demand).
import { CanaryRunnerModule } from './canary-runner/canary-runner.module';
// Canary del gate anti-scraping (Turnstile en /api/questions/filtered). SIN cron:
// se dispara POST-DEPLOY vía POST /api/v2/canary/run-questions-gate (CRON_SECRET).
import { CanaryQuestionsGateModule } from './canary-questions-gate/canary-questions-gate.module';
// External heartbeat — watcher del watcher. Único monitoreo que SOBREVIVE
// a una caída total del Fargate (la alarma viene de Healthchecks.io externo).
import { ExternalHeartbeatModule } from './external-heartbeat/external-heartbeat.module';
// Outbox processor (Sprint 1 fase 1.2, 28/05/2026) — worker async que
// procesa eventos generados por trigger `tg_test_questions_emit_outbox`
// (migración `20260528_test_questions_outbox.sql`). Reemplaza
// progresivamente los 20 triggers analíticos del path crítico de
// answer-and-save. Ver docs/roadmap/sprint-outbox-test-questions.md
import { OutboxProcessorModule } from './outbox-processor/outbox-processor.module';
// Refresh diario de las materialized views Fase D-bis Iter 1.5
// (topic_law_question_summary + topic_official_by_position). Aplica también
// endpoint admin POST /api/v2/admin/topic-summary/refresh para on-demand.
import { RefreshTopicSummaryModule } from './refresh-topic-summary/refresh-topic-summary.module';
// Snapshot diario de pg_stat_statements para cálculo de deltas 24h vía
// vista `v_pg_stat_statements_delta`. Cierra el gap "queries lentas HOY vs
// ruido histórico acumulado" del incidente 31/05. Ver
// docs/roadmap/observability-capacity.md Acción 3.
import { PgStatSnapshotModule } from './pg-stat-snapshot/pg-stat-snapshot.module';
// Muestreo continuo del pool de Postgres cada minuto. Leading indicator
// vs los 5xx (lagging). Detecta saturación ANTES de que se traduzca en
// errores user-facing. Ver docs/roadmap/observability-capacity.md Acción 2.
import { PoolCapacitySamplerModule } from './pool-capacity-sampler/pool-capacity-sampler.module';

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
    // HeartbeatModule global — provee HeartbeatRegistry singleton para que
    // cada cron se registre y el HealthController exponga /health/crons.
    // Debe ir ANTES de HealthModule (que lo consume).
    HeartbeatModule,
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
    // Sprint D roadmap oposiciones-coverage-level — cron diario 04:00 UTC.
    AutoPromoteCoverageModule,
    // Sprint G.4 roadmap sprint-g-oposiciones-vs-convocatorias — cron cada 30 min.
    RefreshMvOposicionesModule,
    // Crons — sub-etapa 1b tanda 2 (monitoreo + colas)
    CheckSeguimientoModule,
    SeoSnapshotModule, // semanal lunes 05:17 UTC — snapshot posición GSC de keywords objetivo
    ProcessOutboxModule,
    ProcessVerificationQueueModule,
    AvatarRotationModule,
    // Crons Stripe (migrados de GHA 27/05/2026 post-incidente Rocío/Mercedes
    // donde GHA lag impidió detectar webhook roto en >5h):
    CheckWebhookHealthModule, // cada 15min — salud webhook entrante
    SubscriptionReconciliationModule, // cada 1h — Pass-1 BD + Pass-2 Stripe directo
    DisputeEmailReconciliationModule, // cada 1h (:15) — invariante impugnación resuelta ⇒ email (Gap 17)
    CanarySmokeAuthModule, // cada 5min — login + GET /api/profile contra prod (Nivel 3)
    CanaryStripeWebhookModule, // cada 5min — evento sintético firmado a /api/stripe/webhook
    CanaryAnswerSaveModule, // cada 5min — POST sintético al endpoint más caliente
    CanaryDatabasePoolModule, // cada 5min — SELECT 1 con timeout 1s (saturación pool)
    CanaryRedisUpstashModule, // cada 5min — SET/GET/DEL Upstash (caída cache)
    CanaryTopicDataModule, // cada 5min — GET /api/topics/5 con shape assertions
    CanaryRunnerModule, // POST /api/v2/canary/run-now — dispara los 5 on-demand
    CanaryQuestionsGateModule, // POST /api/v2/canary/run-questions-gate — gate post-deploy
    ExternalHeartbeatModule, // cada 5min — ping a Healthchecks.io (watcher del watcher)
    // Sprint 1 outbox test_questions (28/05/2026) — Fase 1.2 infra worker
    // (no-op handlers todavía; Fases 1.3+ añaden lógica con shadow mode).
    OutboxProcessorModule, // cada 1s — procesa batches de hasta 100 eventos
    // Fase D-bis Iter 1.5 (31/05/2026) — refresh diario 03:30 UTC de las MVs
    // topic_law_question_summary + topic_official_by_position.
    RefreshTopicSummaryModule,
    // Acción 3 observability-capacity (01/06/2026) — snapshot diario 00:05 UTC
    // de pg_stat_statements + poda 30d. Habilita v_pg_stat_statements_delta.
    PgStatSnapshotModule,
    // Acción 2 observability-capacity (01/06/2026) — muestreo continuo del
    // pool cada minuto (leading indicator de saturación vs lagging 5xx).
    PoolCapacitySamplerModule,
    // Crons — sub-etapa 1b tanda 3 (sensores OEP)
    AnthropicModule,
    DetectTimelineSilenceModule,
    DetectOepLlmModule,
    // detect-regional-oeps RETIRADO (01/06/2026): scraper autónomo de 167 fuentes
    // con 56% de tasa de error + falsos positivos. Descubrimiento de oposiciones
    // nuevas pasa a ser on-demand por Claude. Ver docs/roadmap/deteccion-convocatorias-oeps-completo.md
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
