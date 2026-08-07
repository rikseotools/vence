// app/api/v2/user-stats/route.ts - Stats de usuario optimizadas (reemplaza RPC get_user_public_stats)
import { NextRequest, NextResponse } from 'next/server'
import { getUserPublicStats } from '@/lib/api/user-stats/queries'
import { getOrSet } from '@/lib/cache/redis'
import { requireUsuarioPropio } from '@/lib/api/shared/auth'

import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const maxDuration = 30

const ENDPOINT = '/api/v2/user-stats'

// SIN esto la guarda de abajo NO PROTEGE — mismo gotcha que en
// app/api/tests/[testId]/review/route.ts: un GET sin declarar `dynamic` es candidato a
// servirse desde la caché de rutas de Next antes de que el código de autenticación corra.
export const dynamic = 'force-dynamic'

// Hasta [T-565] esto validaba solo que `userId` fuera un UUID y lo usaba TAL CUAL para leer
// las stats — sin sesión. Cualquiera con el UUID de otra persona (viaja en la URL que mandan
// las tres pantallas que llaman a este endpoint: UserAvatar, TemaTestPage, la página de tema)
// le leía la racha, el progreso y la oposición objetivo. La identidad sale SIEMPRE del token;
// el query param solo se contrasta (y si no coincide, se corta: ningún llamante real necesita
// pedir las stats de otra persona).
async function _GET(request: NextRequest) {
  try {
    const rawUserId = request.nextUrl.searchParams.get('userId')
    const identidad = await requireUsuarioPropio(request, ENDPOINT, rawUserId)
    if (!identidad.ok) return identidad.response

    // Cache server-side compartido (Redis Upstash, TTL 30s).
    // Reduce carga BD ~80% para usuarios que recargan dashboard. Se invalida
    // tras INSERT en test_questions (en /api/v2/answer-and-save) para reflejar
    // cambios al instante. Si Redis falla, cae a BD (graceful degradation).
    const stats = await getOrSet(
      `user_stats:${identidad.userId}`,
      30,
      () => getUserPublicStats(identidad.userId),
    )
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
    // FK violation: user_id no existe en user_profiles (eliminado por admin-delete-user).
    // El browser sigue activo con sesion zombie. Devolver 401 para que cliente
    // detecte y haga logout. NO loguear como error 500 (no es bug del servidor).
    const pgCode = (error as { code?: string; cause?: { code?: string } })?.code
                || (error as { cause?: { code?: string } })?.cause?.code
    if (pgCode === '23503') {
      console.info('🧟 [API/v2/user-stats] FK violation (zombie session de user eliminado)')
      return NextResponse.json(
        { success: false, error: 'Usuario no existe', sessionInvalid: true },
        { status: 401 }
      )
    }
    console.error('❌ [API/v2/user-stats]', error)
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/v2/user-stats', _GET)
