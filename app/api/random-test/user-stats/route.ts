// app/api/random-test/user-stats/route.ts - API para estadísticas de usuario por tema
import { NextRequest, NextResponse } from 'next/server'
import { getUserThemeStats } from '@/lib/api/random-test/queries'
import {
  GetUserStatsRequestSchema,
  type UserStatsResponse,
} from '@/lib/api/random-test/schemas'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest): Promise<NextResponse<UserStatsResponse>> {
  try {
    const body = await request.json()

    // Validar request con Zod
    const parseResult = GetUserStatsRequestSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json({
        success: false,
        error: parseResult.error.issues.map(e => e.message).join(', '),
      }, { status: 400 })
    }

    const { oposicion, userId } = parseResult.data

    // Obtener estadísticas
    const stats = await getUserThemeStats(oposicion, userId)

    return NextResponse.json({
      success: true,
      stats,
    })
  } catch (error) {
    console.error('❌ [API/random-test/user-stats] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    }, { status: 500 })
  }
}
