// app/api/v2/official-exams/failed-questions/route.ts
// API v2 para obtener preguntas falladas de un examen oficial completado
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getOfficialExamFailedQuestions,
  safeParseGetOfficialExamFailedQuestions,
} from '@/lib/api/official-exams'

// Cliente Supabase solo para auth
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  console.log('🎯 [API/v2/official-exams/failed-questions] Request received')

  try {
    // Verificar autenticación
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('🎯 [API/v2/official-exams/failed-questions] No auth header')
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.log('🎯 [API/v2/official-exams/failed-questions] Auth error:', authError?.message)
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

    console.log('🎯 [API/v2/official-exams/failed-questions] User authenticated:', user.id)

    // Parsear query params
    const { searchParams } = new URL(request.url)
    const examDate = searchParams.get('examDate')
    const parte = searchParams.get('parte') as 'primera' | 'segunda' | null
    const oposicion = searchParams.get('oposicion')

    // Validar con Zod
    const parseResult = safeParseGetOfficialExamFailedQuestions({
      userId: user.id,
      examDate,
      parte: parte || undefined,
      oposicion,
    })

    if (!parseResult.success) {
      console.log('🎯 [API/v2/official-exams/failed-questions] Validation error:', parseResult.error.issues)
      return NextResponse.json({
        success: false,
        error: 'Parámetros inválidos',
        details: parseResult.error.issues,
      }, { status: 400 })
    }

    console.log('🎯 [API/v2/official-exams/failed-questions] Validated params:', {
      examDate: parseResult.data.examDate,
      parte: parseResult.data.parte,
      oposicion: parseResult.data.oposicion,
    })

    // Ejecutar query
    const result = await getOfficialExamFailedQuestions(parseResult.data)

    if (!result.success) {
      return NextResponse.json(result, { status: result.error ? 404 : 200 })
    }

    console.log('🎯 [API/v2/official-exams/failed-questions] Returning', result.totalFailed, 'failed questions')

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ [API/v2/official-exams/failed-questions] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
