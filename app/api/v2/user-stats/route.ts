// app/api/v2/user-stats/route.ts - Stats de usuario optimizadas (reemplaza RPC get_user_public_stats)
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserPublicStats } from '@/lib/api/user-stats/queries'

import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const maxDuration = 30

// Validar que userId sea UUID antes de tocar SQL — sin esta validación,
// cualquier string corrupto genera HTTP 500 con stack trace SQL
// (`invalid input syntax for type uuid`, código pg 22P02).
const userIdSchema = z.string().uuid()

async function _GET(request: NextRequest) {
  try {
    const rawUserId = request.nextUrl.searchParams.get('userId')
    const parsed = userIdSchema.safeParse(rawUserId)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'userId inválido o faltante (debe ser UUID)' },
        { status: 400 }
      )
    }

    const stats = await getUserPublicStats(parsed.data)
    return NextResponse.json(
      { success: true, ...stats },
      {
        // Cache navegador 30s. Reduce repeat hits cuando user refresca o navega
        // rapido entre pantallas. NO se cachea en CDN (private) porque las
        // stats son por-usuario. Tras Fase 1 (Redis) este cache sera el L2.
        // SWR 60s: si caduca pero llega request, sirve cached + revalida atras.
        headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
      }
    )
  } catch (error) {
    console.error('❌ [API/v2/user-stats]', error)
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/v2/user-stats', _GET)
