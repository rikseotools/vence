// app/api/v2/tests/failed-questions/route.ts
// API v2 para test de repaso de fallos - Usa Drizzle + Zod
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getFailedQuestionsForUser,
  safeParseCreateFailedQuestionsTest,
  type CreateFailedQuestionsTestRequest,
} from '@/lib/api/tests'

// Cliente Supabase solo para auth
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  console.log('🎯 [API/v2/failed-questions] Request received')

  try {
    // Verificar autenticación
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('🎯 [API/v2/failed-questions] No auth header')
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.log('🎯 [API/v2/failed-questions] Auth error:', authError?.message)
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

    console.log('🎯 [API/v2/failed-questions] User authenticated:', user.id)

    // Parsear y validar body con Zod
    const body = await request.json()
    const parseResult = safeParseCreateFailedQuestionsTest({
      ...body,
      userId: user.id,
    })

    if (!parseResult.success) {
      console.log('🎯 [API/v2/failed-questions] Validation error:', parseResult.error.errors)
      return NextResponse.json({
        success: false,
        error: 'Datos inválidos',
        details: parseResult.error.errors,
      }, { status: 400 })
    }

    const params: CreateFailedQuestionsTestRequest = parseResult.data
    console.log('🎯 [API/v2/failed-questions] Validated params:', {
      numQuestions: params.numQuestions,
      orderBy: params.orderBy,
      fromDate: params.fromDate,
      days: params.days,
    })

    // Ejecutar query con Drizzle
    const result = await getFailedQuestionsForUser(params)

    if (!result.success) {
      return NextResponse.json(result, { status: result.error ? 500 : 200 })
    }

    console.log('🎯 [API/v2/failed-questions] Returning', result.questionCount, 'questions')

    return NextResponse.json({
      success: true,
      questions: result.questions,
      questionCount: result.questionCount,
      message: result.message,
      testType: 'failed_questions',
    })

  } catch (error) {
    console.error('❌ [API/v2/failed-questions] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
