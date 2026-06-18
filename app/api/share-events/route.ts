// app/api/share-events/route.ts
// Registra un evento de "compartir" (share_events) del usuario autenticado.
// Migrado de supabase.from client-side (PostgREST + RLS) → Drizzle server + authz.
// Desacople PostgREST (Batch D.2). Endpoint reutilizable por todos los puntos
// que registran shares (ShareQuestion, SharePrompt, ExamLayout).
//
// authz: user_id = <userId verificado del token> (NO del cliente). Solo se
// registran shares de usuarios autenticados (igual que antes: `if (!user) return`).

import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getDb, getPoolerDb } from '@/db/client'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

function getWriteDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}

async function _POST(request: NextRequest) {
  const auth = await verifyAuth(request, '/api/share-events')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: auth.status ?? 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  const shareType = typeof body.share_type === 'string' ? body.share_type : null
  const platform = typeof body.platform === 'string' ? body.platform : null
  if (!shareType || !platform) {
    return NextResponse.json({ success: false, error: 'share_type y platform requeridos' }, { status: 400 })
  }

  const score = typeof body.score === 'number' ? body.score : null
  const testSessionId = typeof body.test_session_id === 'string' ? body.test_session_id : null
  const shareText = typeof body.share_text === 'string' ? body.share_text : null
  const shareUrl = typeof body.share_url === 'string' ? body.share_url : null
  const deviceInfo = body.device_info && typeof body.device_info === 'object' ? body.device_info : null

  try {
    const db = getWriteDb()
    await db.execute(sql`
      INSERT INTO share_events
        (user_id, share_type, platform, score, test_session_id, share_text, share_url, device_info)
      VALUES (
        ${auth.userId}, ${shareType}, ${platform}, ${score}, ${testSessionId},
        ${shareText}, ${shareUrl}, ${deviceInfo ? JSON.stringify(deviceInfo) : null}::jsonb
      )
    `)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ [share-events] Error:', (error as Error).message)
    return NextResponse.json({ success: false, error: 'Error registrando share' }, { status: 500 })
  }
}

export const POST = withErrorLogging('/api/share-events', _POST)
