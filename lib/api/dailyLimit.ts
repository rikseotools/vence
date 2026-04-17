// lib/api/dailyLimit.ts — Server-side enforcement of 25 questions/day for free users
// The client hook (useDailyQuestionLimit) shows the UI modal,
// but this module is the actual gate that prevents bypassing via direct API calls.

import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

const DAILY_LIMIT = 25

interface DailyLimitResult {
  allowed: boolean
  questionsToday: number
  questionsRemaining: number
  isPremium: boolean
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

/**
 * Extract the authenticated userId from the Bearer token.
 * Returns null if no token or invalid — never throws.
 */
export async function getUserIdFromToken(request: NextRequest): Promise<string | null> {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return null

    const token = authHeader.split(' ')[1]
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    )
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
}

/**
 * Check and increment the daily question counter for a user.
 * Returns { allowed: true } for premium users or free users under the limit.
 * Returns { allowed: false } for free users who've hit 25/day.
 *
 * If userId is null (anonymous), always allows (rate limiting handles anonymous abuse).
 */
export async function checkAndIncrementDailyLimit(
  userId: string | null | undefined,
): Promise<DailyLimitResult> {
  if (!userId) {
    return { allowed: true, questionsToday: 0, questionsRemaining: DAILY_LIMIT, isPremium: false }
  }

  try {
    const { data, error } = await getSupabaseAdmin().rpc('increment_daily_questions', {
      p_user_id: userId,
      p_limit: DAILY_LIMIT,
    })

    if (error) {
      console.error('❌ [DailyLimit] RPC error:', error.message)
      // Fail open: don't block users if the check itself fails
      return { allowed: true, questionsToday: 0, questionsRemaining: DAILY_LIMIT, isPremium: false }
    }

    const result = Array.isArray(data) ? data[0] : data

    if (!result) {
      return { allowed: true, questionsToday: 0, questionsRemaining: DAILY_LIMIT, isPremium: false }
    }

    return {
      allowed: result.can_answer,
      questionsToday: result.questions_today,
      questionsRemaining: result.questions_remaining,
      isPremium: result.is_premium,
    }
  } catch (err) {
    console.error('❌ [DailyLimit] Unexpected error:', err)
    return { allowed: true, questionsToday: 0, questionsRemaining: DAILY_LIMIT, isPremium: false }
  }
}

/**
 * Check if a device (across all its free accounts) has exceeded the daily limit.
 * If user A used 15 questions and user B used 10 on the same device, total = 25 → blocked.
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
      allowed: total < DAILY_LIMIT,
      deviceTotal: total,
    }
  } catch {
    return null
  }
}

/**
 * Read-only check (doesn't increment). Use before loading questions, not after answering.
 */
export async function getDailyLimitStatus(
  userId: string | null | undefined,
): Promise<DailyLimitResult> {
  if (!userId) {
    return { allowed: true, questionsToday: 0, questionsRemaining: DAILY_LIMIT, isPremium: false }
  }

  try {
    const { data, error } = await getSupabaseAdmin().rpc('get_daily_question_status', {
      p_user_id: userId,
    })

    if (error) {
      console.error('❌ [DailyLimit] Status RPC error:', error.message)
      return { allowed: true, questionsToday: 0, questionsRemaining: DAILY_LIMIT, isPremium: false }
    }

    const result = Array.isArray(data) ? data[0] : data

    if (!result) {
      return { allowed: true, questionsToday: 0, questionsRemaining: DAILY_LIMIT, isPremium: false }
    }

    return {
      allowed: !result.is_limit_reached,
      questionsToday: result.questions_today,
      questionsRemaining: result.questions_remaining,
      isPremium: result.is_premium,
    }
  } catch (err) {
    console.error('❌ [DailyLimit] Unexpected error:', err)
    return { allowed: true, questionsToday: 0, questionsRemaining: DAILY_LIMIT, isPremium: false }
  }
}
