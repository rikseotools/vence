// app/api/v2/answer-and-save/route.ts
// Endpoint unificado: validar respuesta + guardar en test_questions + actualizar score
// Reemplaza el flujo fragmentado de TestLayout (validate → save → updateScore → ...)
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import {
  safeParseAnswerAndSaveRequest,
  validateAndSaveAnswer,
  markActiveStudentIfFirst,
  type AnswerAndSaveResponse,
} from '@/lib/api/v2/answer-and-save'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

// Margen para cold start + conexión BD
export const maxDuration = 30

async function _POST(request: NextRequest): Promise<NextResponse<AnswerAndSaveResponse | { success: false; error: string }>> {
  const startTime = Date.now()

  try {
    // 1. Auth: verificar Bearer token
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

    const parsed = safeParseAnswerAndSaveRequest(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { success: false, error: `Validación: ${firstError?.path.join('.')} - ${firstError?.message}` } as const,
        { status: 400 },
      )
    }

    // 3. Ejecutar: validar + guardar + actualizar score
    const result = await validateAndSaveAnswer(parsed.data, user.id)

    const totalMs = Date.now() - startTime
    if (totalMs > 2000) {
      console.warn(`⚠️ [answer-and-save] Respuesta lenta: ${totalMs}ms questionId=${parsed.data.questionId}`)
    }

    // 4. Operaciones background (no bloquean la respuesta)
    after(async () => {
      try {
        await markActiveStudentIfFirst(user.id)
      } catch (e) {
        console.warn('⚠️ [after] Error en operaciones background:', e)
      }
    })

    if (!result.success) {
      return NextResponse.json(result, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error) {
    const totalMs = Date.now() - startTime
    console.error(`❌ [answer-and-save] Error tras ${totalMs}ms:`, error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' } as const,
      { status: 500 },
    )
  }
}

async function _GET() {
  return NextResponse.json(
    { success: false, error: 'Método no permitido. Usa POST.' } as const,
    { status: 405 },
  )
}

export const POST = withErrorLogging('/api/v2/answer-and-save', _POST)
export const GET = withErrorLogging('/api/v2/answer-and-save', _GET)
