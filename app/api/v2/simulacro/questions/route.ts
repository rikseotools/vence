// app/api/v2/simulacro/questions/route.ts
//
// Endpoint público que genera un Simulacro de Examen aleatorio.
//
// Diferencia con /api/v2/official-exams/questions: las preguntas son ALEATORIAS
// del catálogo, no de una convocatoria histórica fija. La distribución (30+30+50
// para Aux Admin Estado) replica el formato oficial.
//
// SECURITY: NO devuelve correct_option — validación se hace en /api/answer y
// /api/answer/psychometric (igual que examen oficial).

import { NextRequest, NextResponse } from 'next/server'
import {
  getSimulacroQuestions,
  safeParseGetSimulacroQuestions,
} from '@/lib/api/simulacro'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuthOptional } from '@/lib/api/auth/verifyAuth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function _GET(request: NextRequest) {
  console.log('🎯 [API/v2/simulacro/questions] Request received')

  try {
    const auth = await verifyAuthOptional(request, '/api/v2/simulacro/questions')
    if (auth) {
      console.log(`🔒 [API/v2/simulacro/questions] Authenticated user: ${auth.userId}`)
    }

    const { searchParams } = new URL(request.url)
    const oposicion = searchParams.get('oposicion')

    const parseResult = safeParseGetSimulacroQuestions({ oposicion })

    if (!parseResult.success) {
      console.log('❌ [API/v2/simulacro/questions] Validation failed:', parseResult.error.issues)
      return NextResponse.json(
        {
          success: false,
          error: 'Parámetros inválidos',
          details: parseResult.error.issues.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 },
      )
    }

    const result = await getSimulacroQuestions(parseResult.data)

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    console.log(`✅ [API/v2/simulacro/questions] Returning ${result.questions?.length || 0} preguntas`)

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('❌ [API/v2/simulacro/questions] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 },
    )
  }
}

export const GET = withErrorLogging('/api/v2/simulacro/questions', _GET)
