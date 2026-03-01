// app/api/psychometric-test-data/questions/route.ts
// GET - Devuelve preguntas psicotécnicas filtradas por categoría (SIN correct_option)

import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseGetPsychometricQuestionsRequest,
  getPsychometricQuestions,
} from '@/lib/api/psychometric-test-data'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const categoriesParam = searchParams.get('categories')
    const numQuestionsParam = searchParams.get('numQuestions')

    if (!categoriesParam) {
      return NextResponse.json(
        { success: false, error: 'Parámetro "categories" requerido' },
        { status: 400 }
      )
    }

    const categories = categoriesParam.split(',').filter(Boolean)
    const numQuestions = numQuestionsParam ? parseInt(numQuestionsParam, 10) : 25

    // Validate with Zod
    const parseResult = safeParseGetPsychometricQuestionsRequest({
      categories,
      numQuestions,
    })

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Parámetros inválidos',
          details: parseResult.error.issues.map(i => i.message),
        },
        { status: 400 }
      )
    }

    const result = await getPsychometricQuestions(
      parseResult.data.categories,
      parseResult.data.numQuestions
    )

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error en API /api/psychometric-test-data/questions:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}
