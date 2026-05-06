// app/api/daily-limit/route.ts
// Returns the user's current daily limit status including graduated limits.
// Called by the client hook to get the personalized limit.
import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromToken, getDailyLimitStatus } from '@/lib/api/dailyLimit'
import { withDbTimeout, isDbTimeoutError } from '@/lib/db/timeout'

// Timeout 8s para la query de límite diario. El endpoint NO está cacheado
// y se llama en CADA page load del usuario logueado, lo que lo hace muy
// expuesto a cascadas si el pooler de Supabase parpadea. Quick-fail a 8s
// evita que cada lambda quede esperando 30s al statement_timeout y se
// propague a 504 en Vercel.
const DAILY_LIMIT_TIMEOUT_MS = 8000

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromToken(request)

    if (!userId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const status = await withDbTimeout(
      () => getDailyLimitStatus(userId),
      DAILY_LIMIT_TIMEOUT_MS,
    )

    return NextResponse.json({
      questionsToday: status.questionsToday,
      questionsRemaining: status.questionsRemaining,
      dailyLimit: status.dailyLimit,
      isLimitReached: !status.allowed,
      isPremium: status.isPremium,
      isGraduated: status.isGraduated,
      tierLabel: status.tierLabel,
    })
  } catch (err) {
    if (isDbTimeoutError(err)) {
      console.warn('⏱️ [API/daily-limit] Timeout (quick-fail):', err.timeoutMs, 'ms')
      return NextResponse.json(
        { error: 'Servicio temporalmente saturado. Reintenta.', retryable: true },
        { status: 503, headers: { 'Retry-After': '5' } },
      )
    }
    console.error('❌ [API/daily-limit] Error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
