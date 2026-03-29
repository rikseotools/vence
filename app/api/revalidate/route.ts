// app/api/revalidate/route.ts
// Endpoint para invalidar cache ISR de páginas específicas.
// Uso: POST /api/revalidate { "path": "/auxiliar-administrativo-cyl/test" }
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

async function _POST(request: NextRequest) {
  const cronSecret = request.headers.get('x-cron-secret')
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { path } = await request.json()
  if (!path || typeof path !== 'string') {
    return NextResponse.json({ error: 'path requerido' }, { status: 400 })
  }

  revalidatePath(path)

  return NextResponse.json({
    success: true,
    revalidated: path,
    timestamp: new Date().toISOString(),
  })
}

export const POST = withErrorLogging('/api/revalidate', _POST)
