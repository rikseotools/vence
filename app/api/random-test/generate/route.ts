// app/api/random-test/generate/route.ts - API para generar test aleatorio
import { NextRequest, NextResponse } from 'next/server'
import { generateRandomTest } from '@/lib/api/random-test/queries'
import {
  safeParseGenerateTest,
  type GenerateTestResponse,
} from '@/lib/api/random-test/schemas'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest): Promise<NextResponse<GenerateTestResponse>> {
  try {
    const body = await request.json()

    // Validar request con Zod
    const parseResult = safeParseGenerateTest(body)
    if (!parseResult.success) {
      return NextResponse.json({
        success: false,
        error: parseResult.error.issues.map(e => e.message).join(', '),
      }, { status: 400 })
    }

    // Generar test
    const result = await generateRandomTest(parseResult.data)

    if (result.questions.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se encontraron preguntas con los filtros seleccionados',
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      questions: result.questions,
      totalGenerated: result.questions.length,
      testId: result.testId || undefined,
    })
  } catch (error) {
    console.error('❌ [API/random-test/generate] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    }, { status: 500 })
  }
}
