// app/api/v2/admin/dashboard/route.ts - Dashboard admin con Drizzle
// Reemplaza 13 queries secuenciales del cliente por ~10 queries paralelas en servidor
//
// Cache HTTP privado (2026-05-17): 11 queries en Promise.all sobre pool max:1
// se serializan en cascada BD → 4 timeouts 504 observados el 16/05. Como es
// admin-only, basta con cache privado del navegador (300s fresh + 600s stale).
// Primera visita ejecuta queries; siguientes 5 min se sirven del navegador
// sin tocar la lambda ni la BD. Si BD satura justo en el refresco, el browser
// usa el stale durante 10 min.
import { NextResponse } from 'next/server'
import { getDashboardData } from '@/lib/api/admin-dashboard'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { withDbTimeout, isDbTimeoutError } from '@/lib/db/timeout'

// 2026-05-25: 504 observado (Vercel runtime kill a 300s, default sin
// maxDuration explícito) que el wrapper withErrorLogging NO pudo
// capturar — la lambda muere por SIGTERM antes de retornar response.
// Acotamos: maxDuration 15s + quick-fail BD a 12s → handler retorna
// 503 capturable en validation_error_logs en vez de 504 invisible.
export const maxDuration = 15
const DASHBOARD_QUERY_TIMEOUT_MS = 12000

async function _GET() {
  try {
    const data = await withDbTimeout(() => getDashboardData(), DASHBOARD_QUERY_TIMEOUT_MS)
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    console.error('[API/v2/admin/dashboard] Error:', error)
    if (isDbTimeoutError(error)) {
      return NextResponse.json(
        { error: 'Dashboard saturado, reintenta en unos segundos' },
        { status: 503, headers: { 'Retry-After': '15' } },
      )
    }
    return NextResponse.json(
      { error: 'Error loading dashboard data' },
      { status: 500 },
    )
  }
}

export const GET = withErrorLogging('/api/v2/admin/dashboard', _GET)
