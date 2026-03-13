// app/api/test/save-answer/route.ts - Guardar respuesta de test server-side
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { safeParseSaveAnswerRequest, type SaveAnswerResponse } from '@/lib/api/test-answers'
import { insertTestAnswer } from '@/lib/api/test-answers'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
async function _POST(request: NextRequest): Promise<NextResponse<SaveAnswerResponse>> {
  try {
    // 1. Auth: verificar Bearer token
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, action: 'error' as const, error: 'No autorizado' },
        { status: 401 },
      )
    }

    const token = authHeader.split(' ')[1]

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    )

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, action: 'error' as const, error: 'Usuario no autenticado' },
        { status: 401 },
      )
    }

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
