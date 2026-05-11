// app/api/v2/complete-onboarding/route.ts
// Endpoint server-side para completar onboarding con todos los campos en una sola operación
import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseCompleteOnboardingRequest,
  completeOnboarding,
  type CompleteOnboardingResponse,
} from '@/lib/api/v2/complete-onboarding'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'

export const maxDuration = 15

async function _POST(request: NextRequest): Promise<NextResponse<CompleteOnboardingResponse | { success: false; error: string }>> {
  try {
    // 1. Auth (wrapper Fase 0.7 — soporta off/shadow/on)
    const auth = await verifyAuth(request, '/api/v2/complete-onboarding')
    if (!auth.success) {
      return NextResponse.json(
        { success: false, error: auth.reason === 'no_bearer_token' ? 'No autorizado' : 'Usuario no autenticado' } as const,
        { status: 401 },
      )
    }
    const user = { id: auth.userId, email: auth.email }

    // 2. Parse + validate body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'JSON inválido' } as const,
        { status: 400 },
      )
    }

    const parsed = safeParseCompleteOnboardingRequest(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { success: false, error: `Validación: ${firstError?.path.join('.')} - ${firstError?.message}` } as const,
        { status: 400 },
      )
    }

    // 3. Ejecutar
    const result = await completeOnboarding(parsed.data, user.id)

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [complete-onboarding] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' } as const,
      { status: 500 },
    )
  }
}

export const POST = withErrorLogging('/api/v2/complete-onboarding', _POST)
