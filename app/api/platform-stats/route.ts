// app/api/platform-stats/route.ts — las cifras de volumen para los componentes de CLIENTE [T-460].
//
// Los server components llaman a `getPlatformStats()` directamente; esta ruta existe solo para los
// que son `'use client'` (el Footer, que sale en todas las páginas, y la página de una pregunta).
// Una sola fuente para los dos caminos: aquí no se recalcula nada, se reexpone la misma función.
//
// Cacheado fuerte a propósito: el volumen se mueve despacio y esto lo pide cada carga de página.
import { NextResponse } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getPlatformStats } from '@/lib/api/platform-stats/queries'

export const revalidate = 86400 // 24 h

async function _GET() {
  const stats = await getPlatformStats()
  return NextResponse.json(stats, {
    headers: {
      // s-maxage para el CDN, stale-while-revalidate para que nadie espere a la revalidación.
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    },
  })
}

export const GET = withErrorLogging('/api/platform-stats', _GET)
