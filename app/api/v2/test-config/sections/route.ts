// app/api/v2/test-config/sections/route.ts
// GET /api/v2/test-config/sections?lawShortName=Ley%2039/2015&topicNumber=5&positionType=auxiliar_administrativo_estado
//
// Devuelve los títulos/capítulos de una ley enriquecidos con metadatos de
// intersección con el topic_scope del tema. Permite al configurador mostrar
// sólo los títulos útiles (con artículos dentro del scope) y deshabilitar
// los que no tienen preguntas disponibles dentro del tema.
//
// Backward compat: el endpoint legacy /api/teoria/sections sigue funcionando
// para páginas de teoría y configuradores sin contexto de tema.

import { NextRequest, NextResponse } from 'next/server'
import { safeParseGetScopedSections, getScopedLawSectionsCached } from '@/lib/api/test-config'
import { shouldRouteToBackend, backendUrlFor } from '@/lib/api/backend-router'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

async function _GET(request: NextRequest) {
  // ─── Bloque 3 canary: proxy condicional al backend NestJS/Fargate ──
  if (shouldRouteToBackend('test-config')) {
    try {
      const { search } = new URL(request.url)
      const backendUrl = backendUrlFor(`api/v2/test-config/sections${search}`)
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5000)
      try {
        const backendRes = await fetch(backendUrl, {
          signal: controller.signal,
          headers: { 'x-forwarded-by': 'vercel-proxy' },
        })
        clearTimeout(timer)
        const body = await backendRes.text()
        return new NextResponse(body, {
          status: backendRes.status,
          headers: {
            'Content-Type': backendRes.headers.get('content-type') ?? 'application/json',
            'x-served-by': backendRes.headers.get('x-served-by') ?? 'vence-backend-proxy',
          },
        })
      } finally {
        clearTimeout(timer)
      }
    } catch (backendError) {
      console.warn(
        `⚠️ [test-config/sections proxy] backend canary falló (${(backendError as Error).message ?? 'unknown'}), fallback Vercel local`,
      )
    }
  }

  const { searchParams } = new URL(request.url)

  const rawData = {
    lawShortName: searchParams.get('lawShortName') || undefined,
    topicNumber: searchParams.get('topicNumber')
      ? Number(searchParams.get('topicNumber'))
      : undefined,
    positionType: searchParams.get('positionType') || undefined,
  }

  const parseResult = safeParseGetScopedSections(rawData)

  if (!parseResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Parámetros inválidos',
        details: parseResult.error.issues,
      },
      { status: 400 }
    )
  }

  const result = await getScopedLawSectionsCached(parseResult.data)

  if (!result.success) {
    return NextResponse.json(result, { status: 500 })
  }

  return NextResponse.json(result)
}

export const GET = withErrorLogging('/api/v2/test-config/sections', _GET)
