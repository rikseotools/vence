// app/api/v2/psychometric/first-attempt/route.ts
// ¿Es la primera vez que el usuario AUTENTICADO responde esta pregunta psicotécnica?
// user_id del TOKEN. AGNÓSTICO (Fase C1): sustituye supabase.from('psychometric_first_attempts').
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

async function _GET(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/psychometric/first-attempt')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const questionId = new URL(request.url).searchParams.get('questionId')
  if (!questionId) {
    return NextResponse.json({ success: false, error: 'questionId requerido' }, { status: 400 })
  }

  const res = await getAdminDb().execute(sql`
    SELECT 1 FROM psychometric_first_attempts
    WHERE user_id = ${auth.userId}::uuid AND question_id = ${questionId}::uuid
    LIMIT 1
  `)
  const found = (Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []).length > 0

  // Sin registro previo → primera vez.
  return NextResponse.json({ success: true, isFirstAttempt: !found })
}

export const GET = withErrorLogging('/api/v2/psychometric/first-attempt', _GET)
