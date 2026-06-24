// app/api/v2/share-stats/route.ts
// Estadísticas de compartición del usuario AUTENTICADO (SharePrompt: decide si
// mostrar el prompt de compartir).
//
// AGNÓSTICO (Fase C1): sustituye supabase.rpc('get_user_share_stats') por la MISMA
// función plpgsql vía Drizzle. p_user_id del TOKEN. Best-effort: si la función falla,
// el cliente degrada (asume 0 shares), igual que antes.
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

async function _GET(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/share-stats')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  // Best-effort: la función get_user_share_stats está rota en BD (referencia la
  // tabla detailed_answers, ya eliminada) → degradamos a stats:null en vez de
  // 500-spamear logs en cada carga de SharePrompt. El cliente ya asume "nunca
  // compartió" cuando no hay stats (comportamiento idéntico al .rpc original, que
  // fallaba en silencio en cliente). Cuando se arregle la función, esto funciona solo.
  try {
    const res = await getAdminDb().execute(sql`SELECT * FROM get_user_share_stats(${auth.userId}::uuid)`)
    const rows = Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []
    return NextResponse.json({ success: true, stats: rows[0] ?? null })
  } catch (err) {
    console.warn('⚠️ [share-stats] get_user_share_stats falló (función rota en BD), degradando:', (err as Error)?.message)
    return NextResponse.json({ success: true, stats: null })
  }
}

export const GET = withErrorLogging('/api/v2/share-stats', _GET)
