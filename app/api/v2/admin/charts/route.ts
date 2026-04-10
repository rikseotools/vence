// app/api/v2/admin/charts/route.ts - Endpoint unificado para charts de admin
// Reemplaza 28 queries secuenciales del cliente por 2 queries SQL paralelas
import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { getActivityChartData, getRegistrationsChartData, chartRequestSchema } from '@/lib/api/admin-charts'

import { withErrorLogging } from '@/lib/api/withErrorLogging'

// Timeout agresivo: con el covering index las queries tardan <100ms incluso
// en frío. Si alguna supera 5s, algo va mal (red caída, contención extrema)
// y es mejor fallar rápido para que el frontend pueda mostrar un estado
// de error y reintentar, en lugar de hacer esperar al admin 15s.
const QUERY_TIMEOUT_MS = 5000

// Cache in-memory del endpoint.
//
// Los charts de admin son analíticas históricas que tolera 5 minutos de
// desfase sin problema — el admin los mira 1-2 veces al día. Cachear elimina:
//   1. El cold start de PG tras periodos sin tráfico a estas tablas.
//   2. La latencia Vercel↔Supabase (~100-300ms por query).
//   3. El coste de los GROUP BY para tráfico repetido.
//
// Next.js cachea por argumentos (days) y por tag. Invalidar con
// revalidateTag('admin-charts') si se necesita forzar refresh manual.
const CACHE_TTL_SECONDS = 300 // 5 min

const getCachedActivity = unstable_cache(
  async (days: number) => getActivityChartData(days),
  ['admin-charts-activity'],
  { revalidate: CACHE_TTL_SECONDS, tags: ['admin-charts'] },
)

const getCachedRegistrations = unstable_cache(
  async (days: number) => getRegistrationsChartData(days),
  ['admin-charts-registrations'],
  { revalidate: CACHE_TTL_SECONDS, tags: ['admin-charts'] },
)

async function _GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parseResult = chartRequestSchema.safeParse({
      days: parseInt(searchParams.get('days') || '14'),
    })

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: parseResult.error.issues },
        { status: 400 },
      )
    }

    const { days } = parseResult.data

    // 2 queries cacheadas ejecutadas en paralelo con timeout.
    // Si alguna tarda más de QUERY_TIMEOUT_MS, abortamos con error claro.
    const withTimeout = <T>(promise: Promise<T>, label: string): Promise<T> =>
      Promise.race([
        promise,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`${label} timeout after ${QUERY_TIMEOUT_MS}ms`)),
            QUERY_TIMEOUT_MS,
          ),
        ),
      ])

    const [activity, registrations] = await Promise.all([
      withTimeout(getCachedActivity(days), 'activity'),
      withTimeout(getCachedRegistrations(days), 'registrations'),
    ])

    return NextResponse.json({ activity, registrations })
  } catch (error) {
    console.error('[API/v2/admin/charts] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error loading chart data' },
      { status: 500 },
    )
  }
}

export const GET = withErrorLogging('/api/v2/admin/charts', _GET)
