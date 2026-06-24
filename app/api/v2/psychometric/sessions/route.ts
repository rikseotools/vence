// app/api/v2/psychometric/sessions/route.ts
// Sesiones psicotécnicas del usuario AUTENTICADO (su propio historial) para
// /mis-estadisticas/psicotecnicos. NO es anti-scraping: son sesiones ya completadas
// del propio usuario (post-respuesta), no preguntas pre-respuesta.
//
// AGNÓSTICO (Fase C1): sustituye supabase.from('psychometric_test_sessions') de
// cliente por Drizzle. user_id del TOKEN. La agrupación byCategory la hace el cliente.
// NOTA: el filtro de categoría del original (.eq('psychometric_questions...category_key'))
// usaba un embed-path INEXISTENTE en esta tabla (sessions no tiene esa relación) →
// estaba roto; se omite. El cliente ya agrupa por categoría sobre los datos devueltos.
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

async function _GET(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/psychometric/sessions')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const daysParam = Number(new URL(request.url).searchParams.get('days'))
  const days = Number.isFinite(daysParam) && daysParam > 0 && daysParam <= 3650 ? Math.floor(daysParam) : null

  const dateFilter = days ? sql` AND created_at >= now() - (${days}::int * interval '1 day')` : sql``
  const res = await getAdminDb().execute(sql`
    SELECT * FROM psychometric_test_sessions
    WHERE user_id = ${auth.userId}::uuid AND session_type = 'psychometric'${dateFilter}
    ORDER BY created_at DESC
  `)
  const sessions = Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []

  return NextResponse.json({ success: true, sessions })
}

export const GET = withErrorLogging('/api/v2/psychometric/sessions', _GET)
