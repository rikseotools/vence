// app/api/v2/psychometric/difficulty/route.ts
// Dificultad efectiva (global + personal) de una pregunta psicotécnica para el
// usuario AUTENTICADO. NO es anti-scraping (no expone la respuesta correcta, solo
// metadatos de dificultad). user_id del TOKEN → la dificultad personal es la propia.
//
// AGNÓSTICO (Fase C1): sustituye supabase.rpc('get_effective_psychometric_difficulty')
// + el fallback supabase.from('psychometric_questions') de cliente por Drizzle.
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

function rows(res: unknown): Record<string, unknown>[] {
  return (Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []) as Record<string, unknown>[]
}

async function _GET(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/psychometric/difficulty')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const questionId = new URL(request.url).searchParams.get('questionId')
  if (!questionId) {
    return NextResponse.json({ success: false, error: 'questionId requerido' }, { status: 400 })
  }

  const db = getAdminDb()

  // 1) RPC de dificultad efectiva (la función vive en Postgres → portable a Neon).
  try {
    const rpc = rows(await db.execute(sql`
      SELECT base_difficulty, global_difficulty, personal_difficulty, sample_size,
             effective_difficulty::float8 AS effective_difficulty, recommendation
      FROM get_effective_psychometric_difficulty(${questionId}::uuid, ${auth.userId}::uuid)
    `))[0]
    if (rpc) {
      return NextResponse.json({ success: true, rpc, fallbackBaseDifficulty: null })
    }
  } catch (e) {
    console.warn('⚠️ [difficulty] rpc falló, usando fallback:', (e as Error).message)
  }

  // 2) Fallback: dificultad base de la pregunta.
  const fb = rows(await db.execute(sql`
    SELECT difficulty FROM psychometric_questions WHERE id = ${questionId}::uuid LIMIT 1
  `))[0]

  return NextResponse.json({
    success: true,
    rpc: null,
    fallbackBaseDifficulty: (fb?.difficulty as string) ?? null,
  })
}

export const GET = withErrorLogging('/api/v2/psychometric/difficulty', _GET)
