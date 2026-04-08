// app/api/v2/complete-onboarding/route.ts
// Endpoint server-side para completar onboarding con todos los campos en una sola operación
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseCompleteOnboardingRequest,
  completeOnboarding,
  type CompleteOnboardingResponse,
} from '@/lib/api/v2/complete-onboarding'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const maxDuration = 15

async function _POST(request: NextRequest): Promise<NextResponse<CompleteOnboardingResponse | { success: false; error: string }>> {
  try {
    // 1. Auth
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' } as const,
        { status: 401 },
      )
    }

    const token = authHeader.split(' ')[1]
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Usuario no autenticado' } as const,
        { status: 401 },
      )
    }

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
