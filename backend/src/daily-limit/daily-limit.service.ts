import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';

export interface DailyLimitResult {
  allowed: boolean;
  questionsToday: number;
  questionsRemaining: number;
  dailyLimit: number;
  isPremium: boolean;
  isGraduated: boolean;
  tierLabel: string | null;
}

const DEFAULT_LIMIT = 25;

const FAIL_OPEN: DailyLimitResult = {
  allowed: true,
  questionsToday: 0,
  questionsRemaining: DEFAULT_LIMIT,
  dailyLimit: DEFAULT_LIMIT,
  isPremium: false,
  isGraduated: false,
  tierLabel: null,
};

/**
 * Servicio de daily limit — Fase 1 (esqueleto).
 *
 * Implementación REAL en Fase 3. Hoy define el contrato + métodos stub
 * que devuelven FAIL_OPEN.
 *
 * Funciones a implementar (port de lib/api/dailyLimit.ts):
 *  - getDailyLimitStatus (RPC get_daily_question_status vía SQL puro)
 *  - checkDeviceDailyUsage (RPC get_device_daily_usage vía SQL puro)
 *  - incrementDailyCount (RPC increment_daily_questions vía SQL puro)
 *  - getDynamicLimit (lógica pura: cálculo de límite graduado por edad+historial)
 */
@Injectable()
export class DailyLimitService {
  private readonly logger = new Logger(DailyLimitService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getDailyLimitStatus(userId: string | null): Promise<DailyLimitResult> {
    if (!userId) return FAIL_OPEN;
    // TODO Fase 3
    return FAIL_OPEN;
  }

  async checkDeviceDailyUsage(
    deviceId: string | null,
  ): Promise<{ allowed: boolean; deviceTotal: number } | null> {
    if (!deviceId) return null;
    // TODO Fase 3
    return { allowed: true, deviceTotal: 0 };
  }
}
