import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, count, eq, sql } from 'drizzle-orm';
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

  /** Cache premium-only para getDailyLimitStatus. Free users SIEMPRE
   *  consultan BD para anti-fraud preciso. TTL 60s. */
  private readonly statusPremiumCache = new Map<
    string,
    { result: DailyLimitResult; timestamp: number }
  >();
  private static readonly STATUS_CACHE_TTL_MS = 60_000;

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

  // ─── RPC wrappers vía SQL puro (Fase 3) ──────────────────
  //
  // Las funciones SQL `get_daily_question_status`, `get_device_daily_usage`
  // y `increment_daily_questions` ya existen en Postgres (CREATE FUNCTION
  // estándar). Las invocamos vía Drizzle `db.execute(sql\`SELECT * FROM
  // rpc(...)\`)` en lugar de `supabase.rpc()` — cero lock-in al SDK.

  /**
   * Estado del daily limit del user (informativo, NO incrementa).
   * Premium-only cache 60s (free users siempre consultan BD).
   */
  async getDailyLimitStatus(userId: string | null): Promise<DailyLimitResult> {
    if (!userId) return FAIL_OPEN;

    // Cache premium-only.
    const cached = this.statusPremiumCache.get(userId);
    if (
      cached &&
      cached.result.isPremium &&
      Date.now() - cached.timestamp < DailyLimitService.STATUS_CACHE_TTL_MS
    ) {
      return cached.result;
    }

    try {
      // Límite dinámico (graduado por edad + hits) calculado en local.
      const dynamic = await this.getDynamicLimit(userId);

      // RPC SQL puro — devuelve TABLE(questions_today, questions_remaining,
      // daily_limit, is_limit_reached, is_premium, reset_time).
      const rows = (await this.db.execute(sql`
        SELECT * FROM get_daily_question_status(${userId}::uuid)
      `)) as unknown as Array<{
        questions_today: number;
        questions_remaining: number;
        daily_limit: number;
        is_limit_reached: boolean;
        is_premium: boolean;
        reset_time: string;
      }>;

      const row = rows[0];
      if (!row) return FAIL_OPEN;

      // Override del daily_limit de la RPC con nuestro cálculo dinámico
      // (la RPC trae un hardcoded del schema BD; nosotros mandamos el
      // graduado actual).
      const questionsToday = row.questions_today ?? 0;
      const remaining = Math.max(0, dynamic.dailyLimit - questionsToday);

      const result: DailyLimitResult = {
        allowed: questionsToday < dynamic.dailyLimit,
        questionsToday,
        questionsRemaining: remaining,
        dailyLimit: dynamic.dailyLimit,
        isPremium: row.is_premium ?? false,
        isGraduated: dynamic.isGraduated,
        tierLabel: dynamic.tierLabel,
      };

      // Cachear SOLO si premium (sin límite real, cero riesgo de bypass).
      if (result.isPremium) {
        this.statusPremiumCache.set(userId, { result, timestamp: Date.now() });
      }

      return result;
    } catch (err) {
      this.logger.warn(
        `Error en get_daily_question_status para user ${userId.slice(0, 8)} — fail-open:`,
        err,
      );
      return FAIL_OPEN;
    }
  }

  /**
   * Uso diario agregado por device (todos los users del mismo device).
   * Devuelve null si no hay deviceId o RPC falla (fail-open).
   */
  async checkDeviceDailyUsage(
    deviceId: string | null,
  ): Promise<{ allowed: boolean; deviceTotal: number } | null> {
    if (!deviceId) return null;
    try {
      // RPC devuelve scalar integer (NO table).
      const rows = (await this.db.execute(sql`
        SELECT get_device_daily_usage(${deviceId}::text) AS total
      `)) as unknown as Array<{ total: number | null }>;

      const total = Number(rows[0]?.total ?? 0);
      return {
        allowed: total < GRADUATED_LIMIT_CONFIG.defaultLimit,
        deviceTotal: total,
      };
    } catch (err) {
      this.logger.warn(
        `Error en get_device_daily_usage para device ${deviceId.slice(0, 8)} — fail-open:`,
        err,
      );
      return null;
    }
  }

  /**
   * Incrementa el counter diario (llamar SOLO tras INSERT OK de answer).
   * Fail-silent: si falla, el user obtiene una pregunta gratis.
   *
   * En el endpoint answer-and-save del POST original Vercel, esto NO se
   * llama (el incremento lo hace el frontend tras OK para evitar doble
   * conteo). Lo dejamos disponible aquí para otros endpoints.
   */
  async incrementDailyCount(userId: string | null): Promise<void> {
    if (!userId) return;
    try {
      const dynamic = await this.getDynamicLimit(userId);
      await this.db.execute(sql`
        SELECT * FROM increment_daily_questions(
          ${userId}::uuid,
          ${dynamic.dailyLimit}::integer
        )
      `);
    } catch (err) {
      this.logger.warn(
        `Error en increment_daily_questions para user ${userId.slice(0, 8)} — fail-silent:`,
        err,
      );
    }
  }

  /** Invalida cache premium (usar tras downgrade Stripe). */
  invalidateStatusPremiumCache(userId: string): void {
    this.statusPremiumCache.delete(userId);
  }
}
