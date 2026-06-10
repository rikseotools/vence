// app/api/admin/revalidate-temario/route.ts
// Invalida la cache del temario. Solo se dispara manualmente: POST sin body.
//
// Los triggers PG sobre topics/topic_scope/oposicion_bloques/oposiciones
// fueron eliminados el 16/04/2026 (migración 20260416_drop_revalidate_triggers.sql)
// porque generaban ~5M ISR Writes/mes (~$20 facturados por el hosting/CDN).
// El cron check-seguimiento por sí solo disparaba 41 invalidaciones/día sin
// que cambiara nada visible para el usuario. Mismo patrón ya aplicado a
// feedback (commit 166c1ddf) y disputes (commit 3774509e).
//
// Tras cambios manuales en BD, invocar: curl -X POST https://www.vence.es/api/admin/revalidate-temario
// Ver docs/maintenance/cache-revalidation.md.
//
// La verificación SUPABASE_WEBHOOK_SECRET se mantiene por compatibilidad
// retroactiva (por si en el futuro se restablece algún trigger filtrado).

import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

const WEBHOOK_SECRET = process.env.SUPABASE_WEBHOOK_SECRET

async function _POST(request: NextRequest) {
  // Si viene con body (webhook de Supabase), verificar secret
  const authHeader = request.headers.get('x-webhook-secret') || request.headers.get('authorization')
  const contentType = request.headers.get('content-type') || ''
  const isWebhook = contentType.includes('application/json')

  if (isWebhook && WEBHOOK_SECRET) {
    const secret = authHeader?.replace('Bearer ', '')
    if (secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Next.js 16 requiere segundo argumento con el profile de cacheLife
  revalidateTag('temario', 'max')

  // También revalidar landings (oposiciones usan datos de BD)
  revalidateTag('landing', 'max')

  // Leyes (getLawsWithQuestionCounts, 30 días de caché)
  revalidateTag('laws', 'max')

  return NextResponse.json({
    success: true,
    message: 'Cache temario + landing + laws invalidada.',
    timestamp: new Date().toISOString(),
  })
}

export const POST = withErrorLogging('/api/admin/revalidate-temario', _POST)
