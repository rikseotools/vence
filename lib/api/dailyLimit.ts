// lib/api/dailyLimit.ts — Server-side enforcement of daily question limits
// Uses graduated limits: new users get 25/day, veterans who repeatedly hit the limit get less.
// The client hook (useDailyQuestionLimit) shows the UI modal,
// but this module is the actual gate that prevents bypassing via direct API calls.

import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { getDynamicLimit, invalidateLimitCache, GRADUATED_LIMIT_CONFIG } from './daily-limit'
import type { DailyLimitStatus } from './daily-limit'

interface DailyLimitResult {
  allowed: boolean
  questionsToday: number
  questionsRemaining: number
  dailyLimit: number
  isPremium: boolean
  isGraduated: boolean
  tierLabel: string | null
}

let _supabaseAdmin: ReturnType<typeof createClient> | null = null
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _supabaseAdmin
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

    const { data, error } = await getSupabaseAdmin().rpc('increment_daily_questions', {
      p_user_id: userId,
      p_limit: dynamicLimit.dailyLimit,
    })

    if (error) {
      console.error('❌ [DailyLimit] RPC error:', error.message)
      // Fail open: don't block users if the check itself fails
      return { allowed: true, questionsToday: 0, questionsRemaining: defaultLimit, dailyLimit: defaultLimit, isPremium: false, isGraduated: false, tierLabel: null }
    }

    const result = Array.isArray(data) ? data[0] : data

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
 */
export async function checkDeviceDailyUsage(
  deviceId: string | null | undefined,
): Promise<{ allowed: boolean; deviceTotal: number } | null> {
  if (!deviceId) return null

  try {
    const { data, error } = await getSupabaseAdmin().rpc('get_device_daily_usage', {
      p_device_id: deviceId,
    })

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST202') return null
      console.error('❌ [DailyLimit] Device usage RPC error:', error.message)
      return null
    }

    const total = typeof data === 'number' ? data : 0

    return {
      allowed: total < GRADUATED_LIMIT_CONFIG.defaultLimit,
      deviceTotal: total,
    }
  } catch {
    return null
  }
}

/**
 * Increment the daily counter AFTER a successful save.
 * Call this only when the answer was actually persisted — never before.
 * Fail-silent: if increment fails, the user just gets a free question.
 */
export async function incrementDailyCount(
  userId: string | null | undefined,
): Promise<void> {
  if (!userId) return

  try {
    const dynamicLimit = await getDynamicLimit(userId)

    await getSupabaseAdmin().rpc('increment_daily_questions', {
      p_user_id: userId,
      p_limit: dynamicLimit.dailyLimit,
    })
  } catch {
    // Fail silent — better to give a free question than block a paying user
  }
}

/**
 * Read-only check (doesn't increment). Use before loading questions, not after answering.
 */
export async function getDailyLimitStatus(
  userId: string | null | undefined,
): Promise<DailyLimitResult> {
  const defaultLimit = GRADUATED_LIMIT_CONFIG.defaultLimit

  if (!userId) {
    return { allowed: true, questionsToday: 0, questionsRemaining: defaultLimit, dailyLimit: defaultLimit, isPremium: false, isGraduated: false, tierLabel: null }
  }

  // Cache hit (premium only): ahorra ~100-200ms del round-trip a BD
  const cached = dailyLimitPremiumCache.get(userId)
  if (cached && cached.data.isPremium && Date.now() - cached.t < DAILY_LIMIT_CACHE_TTL_MS) {
    return cached.data
  }

  try {
    // Get the personalized limit for this user
    const dynamicLimit = await getDynamicLimit(userId)

    const { data, error } = await getSupabaseAdmin().rpc('get_daily_question_status', {
      p_user_id: userId,
    })

    if (error) {
      console.error('❌ [DailyLimit] Status RPC error:', error.message)
      return { allowed: true, questionsToday: 0, questionsRemaining: defaultLimit, dailyLimit: defaultLimit, isPremium: false, isGraduated: false, tierLabel: null }
    }

    const result = Array.isArray(data) ? data[0] : data

    if (!result) {
      return { allowed: true, questionsToday: 0, questionsRemaining: defaultLimit, dailyLimit: defaultLimit, isPremium: false, isGraduated: false, tierLabel: null }
    }

    // Override the RPC's hardcoded limit with our dynamic calculation
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

    // Cachear SOLO si es premium (sin límite que respetar → cero riesgo)
    if (returnValue.isPremium) {
      dailyLimitPremiumCache.set(userId, { data: returnValue, t: Date.now() })
    }

    return returnValue
  } catch (err) {
    console.error('❌ [DailyLimit] Unexpected error:', err)
    return { allowed: true, questionsToday: 0, questionsRemaining: defaultLimit, dailyLimit: defaultLimit, isPremium: false, isGraduated: false, tierLabel: null }
  }
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
