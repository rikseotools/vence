// app/api/v2/tests/favorite-questions/route.ts
// Test de repaso con las preguntas que el usuario ha guardado (T-261).
//
// Gemelo de `/api/v2/tests/failed-questions`: mismo contrato de entrada/salida y el
// mismo shape `TestLayoutQuestion`, para que la página cliente sea idéntica salvo el
// origen de las preguntas (elección manual del usuario vs. fallos automáticos).
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import {
  safeParseFavoriteQuestionsTest,
  getFavoriteQuestionsForUser,
} from '@/lib/api/question-favorites'

export const maxDuration = 30

async function _POST(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/tests/favorite-questions')
  if (!auth.success) {
    return NextResponse.json(
      { success: false, error: auth.reason === 'no_bearer_token' ? 'No autorizado' : 'Token inválido' },
      { status: 401 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const parsed = safeParseFavoriteQuestionsTest(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 },
    )
  }

  const result = await getFavoriteQuestionsForUser({
    userId: auth.userId,
    numQuestions: parsed.data.numQuestions,
    orderBy: parsed.data.orderBy,
  })

  // Sin favoritas NO es un error: es el estado inicial de cualquier usuario. Se
  // devuelve 200 con lista vacía y mensaje, y la página pinta el vacío explicativo.
  return NextResponse.json(result, { status: result.success ? 200 : 500 })
}

export const POST = withErrorLogging('/api/v2/tests/favorite-questions', _POST)
