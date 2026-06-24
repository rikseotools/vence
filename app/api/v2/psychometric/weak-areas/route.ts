// app/api/v2/psychometric/weak-areas/route.ts
// Respuestas psicotécnicas del usuario AUTENTICADO (su historial) con el detalle de
// pregunta/sección/categoría/sesión, para el análisis de áreas débiles
// (PsychometricWeakAreasAnalysis). NO es anti-scraping: son respuestas ya dadas por
// el propio usuario y el embed NO incluye la opción correcta.
//
// AGNÓSTICO (Fase C1): sustituye el embed PostgREST anidado de cliente por Drizzle
// (JOINs + json_build_object). user_id del TOKEN → solo el historial propio.
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 20

async function _GET(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/psychometric/weak-areas')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const daysParam = Number(new URL(request.url).searchParams.get('days'))
  const days = Number.isFinite(daysParam) && daysParam > 0 && daysParam <= 3650 ? Math.floor(daysParam) : null
  const dateFilter = days ? sql` AND a.created_at >= now() - (${days}::int * interval '1 day')` : sql``

  const res = await getAdminDb().execute(sql`
    SELECT a.*,
      json_build_object(
        'id', q.id, 'question_text', q.question_text,
        -- BUG pre-existente: el embed original pedía difficulty_level/estimated_time_seconds/
        -- question_type, columnas INEXISTENTES → la query erraba y el análisis salía vacío.
        -- Mapeo a las columnas reales preservando las keys que espera el cliente.
        'difficulty_level', q.difficulty,
        'estimated_time_seconds', q.time_limit_seconds,
        'psychometric_sections', json_build_object(
          'section_key', sec.section_key, 'display_name', sec.display_name, 'question_type', q.question_subtype,
          'psychometric_categories', json_build_object('category_key', cat.category_key, 'display_name', cat.display_name)
        )
      ) AS psychometric_questions,
      -- (el JOIN a sessions es solo por el !inner del original; el cliente no usa
      --  estos campos. 'score' no existe en la tabla → omitido.)
      json_build_object('session_type', s.session_type, 'total_questions', s.total_questions) AS psychometric_test_sessions
    FROM psychometric_test_answers a
    JOIN psychometric_questions q ON q.id = a.question_id
    JOIN psychometric_sections sec ON sec.id = q.section_id
    JOIN psychometric_categories cat ON cat.id = sec.category_id
    JOIN psychometric_test_sessions s ON s.id = a.test_session_id
    WHERE a.user_id = ${auth.userId}::uuid${dateFilter}
    ORDER BY a.created_at DESC
  `)
  const answers = Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []

  return NextResponse.json({ success: true, answers })
}

export const GET = withErrorLogging('/api/v2/psychometric/weak-areas', _GET)
