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
    AvatarRotationModule,
  ],
})
export class AppModule {}
