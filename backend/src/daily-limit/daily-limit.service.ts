import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, count, eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { conversionEvents, userProfiles } from '../db/schema';
import {
  GRADUATED_LIMIT_CONFIG,
  PREMIUM_PLAN_TYPES,
  type DynamicLimitResult,
  type PremiumPlanType,
  type UserLimitProfile,
} from './daily-limit.config';

export interface DailyLimitResult {
  allowed: boolean;
  questionsToday: number;
  questionsRemaining: number;
  dailyLimit: number;
  isPremium: boolean;
  isGraduated: boolean;
  tierLabel: string | null;
}

const FAIL_OPEN: DailyLimitResult = {
  allowed: true,
  questionsToday: 0,
  questionsRemaining: GRADUATED_LIMIT_CONFIG.defaultLimit,
  dailyLimit: GRADUATED_LIMIT_CONFIG.defaultLimit,
  isPremium: false,
  isGraduated: false,
  tierLabel: null,
};

/**
 * Servicio DailyLimit — Fase 2 (lógica pura + queries Drizzle, sin RPCs).
 *
 * Port de lib/api/daily-limit/queries.ts del frontend Vercel.
 *
 * Fase 3 añadirá los wrappers de las RPCs Postgres
 * (`get_daily_question_status`, `get_device_daily_usage`,
 * `increment_daily_questions`) invocándolas como SQL puro vía Drizzle
 * `db.execute(sql\`SELECT * FROM rpc(...)\`)`.
 */
@Injectable()
export class DailyLimitService {
  private readonly logger = new Logger(DailyLimitService.name);

  /** Cache in-memory por user del límite dinámico (cambia lento). 5 min TTL. */
  private readonly limitCache = new Map<
    string,
    { result: DynamicLimitResult; timestamp: number }
  >();
  private static readonly LIMIT_CACHE_TTL_MS = 5 * 60 * 1000;

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Lee el perfil de límites del user: registración + hits acumulados.
   * Single query con LEFT JOIN + COUNT.
   */
  async getUserLimitProfile(userId: string): Promise<UserLimitProfile | null> {
    const rows = await this.db
      .select({
        userId: userProfiles.id,
        planType: userProfiles.planType,
        createdAt: userProfiles.createdAt,
        totalLimitHits: count(conversionEvents.id),
      })
      .from(userProfiles)
      .leftJoin(
        conversionEvents,
        and(
          eq(conversionEvents.userId, userProfiles.id),
          eq(conversionEvents.eventType, 'limit_reached'),
        ),
      )
      .where(eq(userProfiles.id, userId))
      .groupBy(userProfiles.id, userProfiles.planType, userProfiles.createdAt)
      .limit(1);

    if (!rows.length) return null;

    const row = rows[0];
    const createdAt = row.createdAt ?? new Date().toISOString();
    const registrationAgeDays = Math.floor(
      (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    const isPremium = (PREMIUM_PLAN_TYPES as readonly string[]).includes(
      (row.planType ?? 'free'),
    );

    return {
      userId,
      planType: row.planType,
      createdAt,
      registrationAgeDays,
      totalLimitHits: Number(row.totalLimitHits),
      isPremium,
    };
  }

  /**
   * Helper puro estático — calcula el límite dinámico desde el perfil.
   * Sin BD, sin side effects. Ideal para testear el algoritmo aislado.
   *
   * Algoritmo (port literal del frontend):
   *  1. Premium → 999/día (sin límite real).
   *  2. Free con <minLimitHitsRequired (3) hits → defaultLimit (25).
   *  3. Free con suficientes hits → tier por días desde registro.
   */
  static calculateDynamicLimit(profile: UserLimitProfile): DynamicLimitResult {
    const config = GRADUATED_LIMIT_CONFIG;

    if (profile.isPremium) {
      return {
        dailyLimit: 999,
        tierLabel: null,
        isGraduated: false,
        registrationAgeDays: profile.registrationAgeDays,
        totalLimitHits: profile.totalLimitHits,
      };
    }

    if (profile.totalLimitHits < config.minLimitHitsRequired) {
      return {
        dailyLimit: config.defaultLimit,
        tierLabel: null,
        isGraduated: false,
        registrationAgeDays: profile.registrationAgeDays,
        totalLimitHits: profile.totalLimitHits,
      };
    }

    const tier = config.tiers.find(
      (t) =>
        profile.registrationAgeDays >= t.minDaysRegistered &&
        (t.maxDaysRegistered === null ||
          profile.registrationAgeDays < t.maxDaysRegistered),
    );

    if (!tier) {
      // Fallback: último tier (no debería ocurrir con maxDaysRegistered=null).
      const last = config.tiers[config.tiers.length - 1];
      return {
        dailyLimit: last.dailyLimit,
        tierLabel: last.label,
        isGraduated: last.dailyLimit < config.defaultLimit,
        registrationAgeDays: profile.registrationAgeDays,
        totalLimitHits: profile.totalLimitHits,
      };
    }

    return {
      dailyLimit: tier.dailyLimit,
      tierLabel: tier.label,
      isGraduated: tier.dailyLimit < config.defaultLimit,
      registrationAgeDays: profile.registrationAgeDays,
      totalLimitHits: profile.totalLimitHits,
    };
  }

  /**
   * Entry point combinado: BD + cálculo. Con cache 5min.
   * Fail-open: si el user no existe o algo peta, devuelve defaultLimit.
   */
  async getDynamicLimit(userId: string): Promise<DynamicLimitResult> {
    const cached = this.limitCache.get(userId);
    if (
      cached &&
      Date.now() - cached.timestamp < DailyLimitService.LIMIT_CACHE_TTL_MS
    ) {
      return cached.result;
    }

    try {
      const profile = await this.getUserLimitProfile(userId);
      if (!profile) {
        return {
          dailyLimit: GRADUATED_LIMIT_CONFIG.defaultLimit,
          tierLabel: null,
          isGraduated: false,
          registrationAgeDays: 0,
          totalLimitHits: 0,
        };
      }
      const result = DailyLimitService.calculateDynamicLimit(profile);
      this.limitCache.set(userId, { result, timestamp: Date.now() });
      return result;
    } catch (err) {
      this.logger.warn(
        `Error en getDynamicLimit para ${userId.slice(0, 8)} — devolviendo default:`,
        err,
      );
      return {
        dailyLimit: GRADUATED_LIMIT_CONFIG.defaultLimit,
        tierLabel: null,
        isGraduated: false,
        registrationAgeDays: 0,
        totalLimitHits: 0,
      };
    }
  }

  /** Invalida el cache de un user (e.g. tras cambio de plan). */
  invalidateLimitCache(userId: string): void {
    this.limitCache.delete(userId);
  }

  // ─── RPC wrappers (Fase 3) ────────────────────────────────
  // Stubs por ahora — Fase 3 las implementa con SQL puro.

  async getDailyLimitStatus(userId: string | null): Promise<DailyLimitResult> {
    if (!userId) return FAIL_OPEN;
    // TODO Fase 3: db.execute(sql`SELECT * FROM get_daily_question_status(...)`)
    return FAIL_OPEN;
  }

  async checkDeviceDailyUsage(
    deviceId: string | null,
  ): Promise<{ allowed: boolean; deviceTotal: number } | null> {
    if (!deviceId) return null;
    // TODO Fase 3: db.execute(sql`SELECT * FROM get_device_daily_usage(...)`)
    return { allowed: true, deviceTotal: 0 };
  }
}
