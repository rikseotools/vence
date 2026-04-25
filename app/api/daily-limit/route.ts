// app/api/daily-limit/route.ts
// Returns the user's current daily limit status including graduated limits.
// Called by the client hook to get the personalized limit.
import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromToken, getDailyLimitStatus } from '@/lib/api/dailyLimit'

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromToken(request)

    if (!userId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const status = await getDailyLimitStatus(userId)

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
    console.error('❌ [API/daily-limit] Error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
