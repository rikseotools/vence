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
import { safeParseGetScopedSections, getScopedLawSections } from '@/lib/api/test-config'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

async function _GET(request: NextRequest) {
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

  const result = await getScopedLawSections(parseResult.data)

  if (!result.success) {
    return NextResponse.json(result, { status: 500 })
  }

  return NextResponse.json(result)
}

export const GET = withErrorLogging('/api/v2/test-config/sections', _GET)
