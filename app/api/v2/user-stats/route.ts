// app/api/v2/user-stats/route.ts - Stats de usuario optimizadas (reemplaza RPC get_user_public_stats)
import { NextRequest, NextResponse } from 'next/server'
import { getUserPublicStats } from '@/lib/api/user-stats/queries'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
async function _GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId')
    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId requerido' }, { status: 400 })
    }

    const stats = await getUserPublicStats(userId)
    return NextResponse.json({ success: true, ...stats })
  } catch (error) {
    console.error('❌ [API/v2/user-stats]', error)
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/v2/user-stats', _GET)
