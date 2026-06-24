// lib/api/dailyLimit.ts — Server-side enforcement of daily question limits
// Uses graduated limits: new users get 25/day, veterans who repeatedly hit the limit get less.
// The client hook (useDailyQuestionLimit) shows the UI modal,
// but this module is the actual gate that prevents bypassing via direct API calls.

import { sql } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'
import { NextRequest } from 'next/server'
import { getDynamicLimit, invalidateLimitCache, GRADUATED_LIMIT_CONFIG } from './daily-limit'
import type { DailyLimitStatus } from './daily-limit'
// Fase 1.5 outbox sprint (28/05/2026): cache Redis cross-lambda para
// las 2 RPCs daily-limit. Ver docs/roadmap/sprint-outbox-test-questions.md
import { getOrSet, invalidate as redisInvalidate } from '@/lib/cache/redis'

interface DailyLimitResult {
  allowed: boolean
  questionsToday: number
  questionsRemaining: number
  dailyLimit: number
  isPremium: boolean
  isGraduated: boolean
  tierLabel: string | null
  // true cuando el resultado proviene de un FALLBACK por error/timeout de la BD
  // (no de una lectura real). Los callers deben tratarlo como "no sé" y NO
  // aplicar límites secundarios (device-daily-limit) sobre él — fail-open. Un
  // blip de BD nunca debe bloquear a un usuario (free o premium). Ver
  // project_exam_mode_answers_not_persisting + ARCHITECTURE_ROADMAP TRAMPA 2.
  degraded?: boolean
}

// AGNÓSTICO (Fase C1): server-only (solo lo importan app/api/*). Las RPCs plpgsql
// se invocan vía Drizzle (getAdminDb, bypass RLS = equivalente al service role) en
// vez de supabase.rpc — portable a RDS/Neon (PostgREST no existe allí).
function rowsOf(res: unknown): any[] {
  return (Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []) as any[]
}

// ============================================
// CACHE in-memory PREMIUM-ONLY (TTL 60s)
// ============================================
// Solo cachea getDailyLimitStatus cuando isPremium=true (no tienen límite,
// cero riesgo de bypass). Free users SIEMPRE consultan BD para mantener
// anti-fraud preciso. Cache in-memory por lambda (no shared) — no toca
// Vercel Data Cache.
//
// Edge case: si user pierde premium (downgrade Stripe), cache devuelve
// isPremium=true durante hasta 60s. Aceptable porque downgrade post-checkout
// es muy raro y la ventana es corta.
const dailyLimitPremiumCache = new Map<string, { data: DailyLimitResult; t: number }>()
const DAILY_LIMIT_CACHE_TTL_MS = 60_000

/**
 * Extract the authenticated userId from the Bearer token.
 * Returns null if no token or invalid — never throws.
 *
 * Refactor 2026-05-11: delegado a verifyAuthOptional (Fase 0.7).
 * Hereda los modos off/shadow/on del wrapper.
 */
export async function getUserIdFromToken(request: NextRequest): Promise<string | null> {
  const { verifyAuthOptional } = await import('@/lib/api/auth/verifyAuth')
  const auth = await verifyAuthOptional(request, '/lib/api/dailyLimit')
  return auth?.userId ?? null
}

/**
 * Check and increment the daily question counter for a user.
 * Uses graduated limits based on registration age and limit hit history.
 *
 * If userId is null (anonymous), always allows (rate limiting handles anonymous abuse).
 */
export async function checkAndIncrementDailyLimit(
  userId: string | null | undefined,
): Promise<DailyLimitResult> {
  const defaultLimit = GRADUATED_LIMIT_CONFIG.defaultLimit

  if (!userId) {
    return { allowed: true, questionsToday: 0, questionsRemaining: defaultLimit, dailyLimit: defaultLimit, isPremium: false, isGraduated: false, tierLabel: null }
  }

  try {
    // Get the personalized limit for this user
    const dynamicLimit = await getDynamicLimit(userId)

    const incRes = await getAdminDb().execute(sql`
      SELECT * FROM increment_daily_questions(${userId}::uuid, ${dynamicLimit.dailyLimit})
    `)
    const result = rowsOf(incRes)[0]

    if (!result) {
      return { allowed: true, questionsToday: 0, questionsRemaining: defaultLimit, dailyLimit: defaultLimit, isPremium: false, isGraduated: false, tierLabel: null }
    }

    // Log graduated limits for observability
    if (dynamicLimit.isGraduated) {
      console.log(`📉 [DailyLimit] Graduated limit applied: user=${userId.slice(0, 8)} tier=${dynamicLimit.tierLabel} limit=${dynamicLimit.dailyLimit} today=${result.questions_today} age=${dynamicLimit.registrationAgeDays}d hits=${dynamicLimit.totalLimitHits}`)
    }

    // Log when a graduated user hits their reduced limit
    if (dynamicLimit.isGraduated && !result.can_answer) {
      console.log(`🚫 [DailyLimit] Graduated user blocked: user=${userId.slice(0, 8)} tier=${dynamicLimit.tierLabel} limit=${dynamicLimit.dailyLimit}`)
    }

    return {
      allowed: result.can_answer,
      questionsToday: result.questions_today,
      questionsRemaining: result.questions_remaining,
      dailyLimit: dynamicLimit.dailyLimit,
      isPremium: result.is_premium,
      isGraduated: dynamicLimit.isGraduated,
      tierLabel: dynamicLimit.tierLabel,
    }
  } catch (err) {
    console.error('❌ [DailyLimit] Unexpected error:', err)
    return { allowed: true, questionsToday: 0, questionsRemaining: defaultLimit, dailyLimit: defaultLimit, isPremium: false, isGraduated: false, tierLabel: null }
  }
}

/**
 * Check if a device (across all its free accounts) has exceeded the daily limit.
 * Uses the DEFAULT limit (25) for device-level checks — graduation is per-user.
 * Returns null if no deviceId or check fails (fail open).
 *
 * Fase 1.5 outbox (28/05/2026): cache Redis TTL 30s. Más corto que las otras
 * 2 porque el conteo de respuestas/día de un device cambia con cada answer.
 * Aceptable: si user hace 25q en 30s y excede, BD bloqueará en el próximo
 * miss (30s después).
 */
export async function checkDeviceDailyUsage(
  deviceId: string | null | undefined,
): Promise<{ allowed: boolean; deviceTotal: number } | null> {
  if (!deviceId) return null

  return getOrSet<{ allowed: boolean; deviceTotal: number } | null>(
    `device_daily:${deviceId}`,
    30,
    async () => {
      try {
        const devRes = await getAdminDb().execute(sql`SELECT get_device_daily_usage(${deviceId}) AS total`)
        const total = Number(rowsOf(devRes)[0]?.total) || 0

        return {
          allowed: total < GRADUATED_LIMIT_CONFIG.defaultLimit,
          deviceTotal: total,
        }
      } catch {
        return null
      }
    },
  )
}

/**
 * Increment the daily counter AFTER a successful save.
 * Call this only when the answer was actually persisted — never before.
 * Fail-silent: if increment fails, the user just gets a free question.
 *
 * Fase 1.5 outbox (28/05/2026): tras incrementar, invalidamos las 2 caches
 * (L1 in-memory premium + L2 Redis cross-lambda) para que el próximo
 * `getDailyLimitStatus` lea de BD el nuevo conteo. Si no invalidamos,
 * un user free podría seguir viendo `questionsToday=N` durante hasta
 * TTL_CACHE segundos tras hacer la pregunta N+1 → bypass del límite.
 */
export async function incrementDailyCount(
  userId: string | null | undefined,
): Promise<void> {
  if (!userId) return

  try {
    const dynamicLimit = await getDynamicLimit(userId)

    await getAdminDb().execute(sql`
      SELECT increment_daily_questions(${userId}::uuid, ${dynamicLimit.dailyLimit})
    `)

    // Invalidar cache tras incrementar — siguiente lectura forzada a BD.
    await invalidateDailyLimitCache(userId)
  } catch {
    // Fail silent — better to give a free question than block a paying user
  }
}

/**
 * Read-only check (doesn't increment). Use before loading questions, not after answering.
 *
 * Fase 1.5 outbox sprint (28/05/2026): cache L1 in-memory (premium only) +
 * cache L2 Redis cross-lambda (TTL 30s para free, 60s para premium).
 * Para free el TTL es corto porque el conteo cambia con cada answer; si
 * user excede entre miss y miss, BD bloqueará en próximo cache miss.
 * `incrementDailyCount` invalida explícitamente el cache tras cada save.
 */
export async function getDailyLimitStatus(
  userId: string | null | undefined,
): Promise<DailyLimitResult> {
  const defaultLimit = GRADUATED_LIMIT_CONFIG.defaultLimit

  if (!userId) {
    return { allowed: true, questionsToday: 0, questionsRemaining: defaultLimit, dailyLimit: defaultLimit, isPremium: false, isGraduated: false, tierLabel: null }
  }

  // Resultado de FALLBACK ante error/timeout de la BD. Si el usuario era premium
  // conocido (caché L1, ignorando TTL: el plan no cambia en un blip), preservamos
  // su premium → no pierde el bypass por un timeout. Si no lo sabemos, fail-open
  // marcado `degraded` para que los callers NO le apliquen el device-daily-limit.
  const degradedFallback = (): DailyLimitResult => {
    const cp = dailyLimitPremiumCache.get(userId)
    if (cp && cp.data.isPremium) return cp.data
    return { allowed: true, questionsToday: 0, questionsRemaining: defaultLimit, dailyLimit: defaultLimit, isPremium: false, isGraduated: false, tierLabel: null, degraded: true }
  }

  // L1 in-memory premium-only (mantiene fast-path lambda local)
  const cached = dailyLimitPremiumCache.get(userId)
  if (cached && cached.data.isPremium && Date.now() - cached.t < DAILY_LIMIT_CACHE_TTL_MS) {
    return cached.data
  }

  // L2 Redis cross-lambda. TTL 30s para free (conservador), pero la lógica
  // interna sube a 60s si detecta isPremium (no hay límite que enforce).
  return getOrSet<DailyLimitResult>(`daily_limit:${userId}`, 30, async () => {
    try {
      const dynamicLimit = await getDynamicLimit(userId)

      const stRes = await getAdminDb().execute(sql`SELECT * FROM get_daily_question_status(${userId}::uuid)`)
      const result = rowsOf(stRes)[0]

      if (!result) {
        return degradedFallback()
      }

      const questionsToday = result.questions_today || 0
      const remaining = Math.max(0, dynamicLimit.dailyLimit - questionsToday)
      const isLimitReached = questionsToday >= dynamicLimit.dailyLimit

      const returnValue: DailyLimitResult = {
        allowed: !isLimitReached,
        questionsToday,
        questionsRemaining: remaining,
        dailyLimit: dynamicLimit.dailyLimit,
        isPremium: result.is_premium,
        isGraduated: dynamicLimit.isGraduated,
        tierLabel: dynamicLimit.tierLabel,
      }

      // L1 update (premium): mantenemos el fast-path lambda local
      if (returnValue.isPremium) {
        dailyLimitPremiumCache.set(userId, { data: returnValue, t: Date.now() })
      }

      return returnValue
    } catch (err) {
      console.error('❌ [DailyLimit] Unexpected error:', err)
      return degradedFallback()
    }
  })
}

/**
 * Invalida cache daily_limit (L1 premium + L2 Redis) tras cambio relevante
 * (increment, downgrade Stripe, etc.). Llamar tras cada save exitoso.
 */
export async function invalidateDailyLimitCache(userId: string): Promise<void> {
  dailyLimitPremiumCache.delete(userId)
  await redisInvalidate(`daily_limit:${userId}`)
}

/**
 * Invalida el cache premium para un user (usar tras downgrade Stripe).
 * NO necesario para flujos normales — el TTL 60s lo cubre. Llamar solo si
 * quieres invalidación inmediata (ej. webhook Stripe subscription.deleted).
 */
export function invalidateDailyLimitPremiumCache(userId: string): void {
  dailyLimitPremiumCache.delete(userId)
}

// Re-export for convenience
export { invalidateLimitCache } from './daily-limit'
