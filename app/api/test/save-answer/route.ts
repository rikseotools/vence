// app/api/test/save-answer/route.ts - Guardar respuesta de test server-side
import { NextRequest, NextResponse } from 'next/server'
import { safeParseSaveAnswerRequest, type SaveAnswerResponse } from '@/lib/api/test-answers'
import { insertTestAnswer } from '@/lib/api/test-answers'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'

async function _POST(request: NextRequest): Promise<NextResponse<SaveAnswerResponse>> {
  try {
    // 1. Auth (wrapper Fase 0.7 — soporta off/shadow/on)
    const auth = await verifyAuth(request, '/api/test/save-answer')
    if (!auth.success) {
      return NextResponse.json(
        {
          success: false,
          action: 'error' as const,
          error: auth.reason === 'no_bearer_token' ? 'No autorizado' : 'Usuario no autenticado',
        },
        { status: 401 },
      )
    }
    const user = { id: auth.userId, email: auth.email }

    // 2. Parse body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, action: 'error' as const, error: 'JSON invalido' },
        { status: 400 },
      )
    }

    // 3. Validate
    const parsed = safeParseSaveAnswerRequest(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        {
          success: false,
          action: 'error' as const,
          error: `Validacion: ${firstError?.path.join('.')} - ${firstError?.message}`,
        },
        { status: 400 },
      )
    }

    // 4. Insert
    const result = await insertTestAnswer(parsed.data, user.id)

    if (result.action === 'error') {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('POST /api/test/save-answer error:', error)
    return NextResponse.json(
      {
        success: false,
        action: 'error' as const,
        error: 'Error interno del servidor',
      },
      { status: 500 },
    )
  }
}

async function _GET() {
  return NextResponse.json(
    { success: false, action: 'error' as const, error: 'Metodo no permitido' },
    { status: 405 },
  )
}

export const POST = withErrorLogging('/api/test/save-answer', _POST)
export const GET = withErrorLogging('/api/test/save-answer', _GET)
