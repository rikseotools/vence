// app/api/admin/revalidate-temario/route.ts
// Invalida la cache del temario. Usar tras modificar topics, oposicion_bloques
// o topic_scope desde el panel admin o scripts de importación.

import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

async function _POST(_request: NextRequest) {
  revalidateTag('temario')
  return NextResponse.json({
    success: true,
    message: 'Cache temario invalidada. Las próximas requests regenerarán desde BD.',
    timestamp: new Date().toISOString(),
  })
}

export const POST = withErrorLogging(_POST, '/api/admin/revalidate-temario')
