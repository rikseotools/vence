// app/api/v2/official-exams/failed-questions/route.ts
// API v2 para obtener preguntas falladas de un examen oficial completado
import { NextRequest, NextResponse } from 'next/server'
import {
  getOfficialExamFailedQuestions,
  safeParseGetOfficialExamFailedQuestions,
} from '@/lib/api/official-exams'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'

async function _GET(request: NextRequest) {
  console.log('🎯 [API/v2/official-exams/failed-questions] Request received')

  try {
    // Verificar autenticación (wrapper Fase 0.7 — soporta off/shadow/on)
    const auth = await verifyAuth(request, '/api/v2/official-exams/failed-questions')
    if (!auth.success) {
      return NextResponse.json(
        { success: false, error: auth.reason === 'no_bearer_token' ? 'No autorizado' : 'Token inválido' },
        { status: 401 }
      )
    }
    const user = { id: auth.userId, email: auth.email }

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

export const GET = withErrorLogging('/api/v2/official-exams/failed-questions', _GET)
