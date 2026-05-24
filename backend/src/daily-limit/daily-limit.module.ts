import { Global, Module } from '@nestjs/common';
import { DailyLimitService } from './daily-limit.service';

/**
 * Módulo Global de daily limit: enforcement de preguntas/día por user y
 * por device (anti-fraud compartido).
 *
 * Port de `lib/api/dailyLimit.ts` + `lib/api/daily-limit.ts` del frontend.
 * Las funciones SQL Postgres (`get_daily_question_status`,
 * `get_device_daily_usage`, `increment_daily_questions`) ya existen — se
 * invocan vía Drizzle, no `supabase.rpc()`.
 *
 * Cache premium-only 60s (free users siempre consultan BD para anti-fraud).
 *
 * Ver docs/architecture/bloque3-answer-save-plan.md §2.3.
 */
@Global()
@Module({
  providers: [DailyLimitService],
  exports: [DailyLimitService],
})
export class DailyLimitModule {}
