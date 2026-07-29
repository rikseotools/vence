// app/api/v2/question-favorites/route.ts
// Preguntas marcadas como favoritas por el usuario AUTENTICADO (T-261).
//
//   GET    → ids marcados (para pintar el corazón relleno en un test en curso)
//   POST   → marcar    { questionId }
//   DELETE → desmarcar { questionId }
//
// El `userId` sale SIEMPRE del token, nunca del body: nadie puede marcar
// preguntas en la cuenta de otro. Mismo patrón que el resto de la API v2.
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { emitFireAndForget } from '@/lib/observability/emit'
import {
  safeParseToggleFavorite,
  setFavorite,
  listFavoriteIds,
} from '@/lib/api/question-favorites'

export const maxDuration = 15

async function _GET(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/question-favorites')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const ids = await listFavoriteIds(auth.userId)
  return NextResponse.json({ success: true, questionIds: ids, total: ids.length })
}

async function marcar(request: NextRequest, deseado: boolean): Promise<NextResponse> {
  const ruta = '/api/v2/question-favorites'
  const auth = await verifyAuth(request, ruta)
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const parsed = safeParseToggleFavorite(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 },
    )
  }

  const res = await setFavorite(auth.userId, parsed.data.questionId, deseado, {
    positionType: parsed.data.positionType ?? null,
    topicNumber: parsed.data.topicNumber ?? null,
  })

  // Observabilidad: sin esto no se puede saber si la función se usa (y por tanto si
  // merece evolucionarla). Volumen bajo (una acción deliberada del usuario), así que
  // no se muestrea. `total` permite ver la distribución sin consultar la tabla.
  emitFireAndForget({
    source: 'vercel',
    severity: 'info',
    eventType: 'question_favorite_toggled',
    endpoint: ruta,
    userId: auth.userId,
    metadata: {
      action: deseado ? 'add' : 'remove',
      questionId: parsed.data.questionId,
      total: res.total,
    },
  })

  return NextResponse.json({ success: true, ...res })
}

async function _POST(request: NextRequest): Promise<NextResponse> {
  return marcar(request, true)
}

async function _DELETE(request: NextRequest): Promise<NextResponse> {
  return marcar(request, false)
}

export const GET = withErrorLogging('/api/v2/question-favorites', _GET)
export const POST = withErrorLogging('/api/v2/question-favorites', _POST)
export const DELETE = withErrorLogging('/api/v2/question-favorites', _DELETE)
