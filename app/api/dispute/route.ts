// app/api/dispute/route.ts - API para crear impugnaciones de preguntas normales
import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseCreateDisputeRequest,
  safeParseAppealDisputeRequest,
  createDispute,
  getExistingDispute,
  handleDisputeAppeal,
  type CreateDisputeResponse,
  type GetExistingDisputeResponse,
  type AppealDisputeResponse,
} from '@/lib/api/dispute'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'

async function _POST(
  request: NextRequest
): Promise<NextResponse<CreateDisputeResponse>> {
  try {
    // 1. Auth (wrapper Fase 0.7 — soporta off/shadow/on)
    const auth = await verifyAuth(request, '/api/dispute')
    if (!auth.success) {
      return NextResponse.json(
        { success: false, error: auth.reason === 'no_bearer_token' ? 'No autorizado' : 'Token inválido' },
        { status: 401 }
      )
    }
    const user = { id: auth.userId, email: auth.email }

    // 2. Parse + validate body
    const body = await request.json()
    const validation = safeParseCreateDisputeRequest(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Datos inválidos: ${validation.error.errors.map((e) => e.message).join(', ')}`,
        },
        { status: 400 }
      )
    }

    // 3. Create dispute via query
    const result = await createDispute(
      validation.data.questionId,
      user.id,
      validation.data.disputeType,
      validation.data.description
    )

    if (!result.success) {
      // Duplicate → 409
      const isDuplicate = result.error?.includes('Ya has impugnado')
      return NextResponse.json(result, { status: isDuplicate ? 409 : 500 })
    }

    console.log('✅ [API/dispute] Impugnación creada:', result.data?.id)
    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [API/dispute] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

async function _GET(
  request: NextRequest
): Promise<NextResponse<GetExistingDisputeResponse>> {
  try {
    // 1. Auth (wrapper Fase 0.7 — soporta off/shadow/on)
    const auth = await verifyAuth(request, '/api/dispute')
    if (!auth.success) {
      return NextResponse.json(
        { success: false, data: null, error: auth.reason === 'no_bearer_token' ? 'No autorizado' : 'Token inválido' },
        { status: 401 }
      )
    }
    const user = { id: auth.userId, email: auth.email }

    // 2. Parse questionId from query params
    const { searchParams } = new URL(request.url)
    const questionId = searchParams.get('questionId')

    if (!questionId) {
      return NextResponse.json(
        { success: false, data: null, error: 'questionId es requerido' },
        { status: 400 }
      )
    }

    // Basic UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(questionId)) {
      return NextResponse.json(
        { success: false, data: null, error: 'questionId debe ser un UUID válido' },
        { status: 400 }
      )
    }

    // 3. Query existing dispute
    const result = await getExistingDispute(questionId, user.id)
    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [API/dispute] GET Error:', error)
    return NextResponse.json(
      { success: false, data: null, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

async function _PATCH(
  request: NextRequest
): Promise<NextResponse<AppealDisputeResponse>> {
  try {
    // 1. Auth (wrapper Fase 0.7 — soporta off/shadow/on)
    const auth = await verifyAuth(request, '/api/dispute')
    if (!auth.success) {
      return NextResponse.json(
        { success: false, error: auth.reason === 'no_bearer_token' ? 'No autorizado' : 'Token inválido' },
        { status: 401 }
      )
    }
    const user = { id: auth.userId, email: auth.email }

    const body = await request.json()
    const validation = safeParseAppealDisputeRequest(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: `Datos inválidos: ${validation.error.errors.map((e) => e.message).join(', ')}` },
        { status: 400 }
      )
    }

    const result = await handleDisputeAppeal(
      validation.data.disputeId,
      user.id,
      validation.data.action,
      validation.data.appealText
    )

    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [API/dispute] PATCH Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/dispute', _POST)
export const GET = withErrorLogging('/api/dispute', _GET)
export const PATCH = withErrorLogging('/api/dispute', _PATCH)
