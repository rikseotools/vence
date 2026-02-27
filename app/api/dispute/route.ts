// app/api/dispute/route.ts - API para crear impugnaciones de preguntas normales
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  safeParseCreateDisputeRequest,
  createDispute,
  getExistingDispute,
  type CreateDisputeResponse,
  type GetExistingDisputeResponse,
} from '@/lib/api/dispute'

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

export async function POST(
  request: NextRequest
): Promise<NextResponse<CreateDisputeResponse>> {
  try {
    // 1. Auth via Bearer token
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const {
      data: { user },
      error: authError,
    } = await getSupabase().auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

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

export async function GET(
  request: NextRequest
): Promise<NextResponse<GetExistingDisputeResponse>> {
  try {
    // 1. Auth via Bearer token
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, data: null, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const {
      data: { user },
      error: authError,
    } = await getSupabase().auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { success: false, data: null, error: 'Token inválido' },
        { status: 401 }
      )
    }

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
