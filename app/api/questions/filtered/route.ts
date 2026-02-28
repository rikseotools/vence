// app/api/questions/filtered/route.ts - API para obtener preguntas filtradas
// Usa Drizzle ORM + Zod para validación tipada
import { NextRequest, NextResponse } from 'next/server'
import {
  getFilteredQuestions,
  countFilteredQuestions,
  safeParseGetFilteredQuestions,
  safeParseCountFilteredQuestions,
} from '@/lib/api/filtered-questions'

// ============================================
// POST /api/questions/filtered
// Obtener preguntas filtradas para test
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 🔍 DEBUG: Ver qué recibe la API
    console.log('📥 [API/questions/filtered] Request recibido:', {
      selectedLaws: body.selectedLaws,
      selectedArticlesByLaw: body.selectedArticlesByLaw,
      numQuestions: body.numQuestions,
    })

    // Validar request con Zod
    const validation = safeParseGetFilteredQuestions(body)
    if (!validation.success) {
      const issues = validation.error?.issues || []
      console.error('❌ Validación fallida:', issues)
      return NextResponse.json(
        {
          success: false,
          error: 'Parámetros inválidos',
          details: issues.map((e) => ({
            path: (e.path ?? []).map(String).join('.'),
            message: e.message || 'Error desconocido',
          })),
        },
        { status: 400 }
      )
    }

    // Obtener preguntas filtradas via Drizzle
    const result = await getFilteredQuestions(validation.data)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.error?.includes('No se encontró') ? 404 : 400 }
      )
    }

    return NextResponse.json({
      success: true,
      questions: result.questions,
      totalAvailable: result.totalAvailable,
      filtersApplied: result.filtersApplied,
    })
  } catch (error) {
    console.error('❌ Error en API /questions/filtered:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// ============================================
// GET /api/questions/filtered/count
// Contar preguntas disponibles (para UI)
// ============================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action !== 'count') {
      return NextResponse.json(
        { success: false, error: 'Usa POST para obtener preguntas o GET?action=count para contar' },
        { status: 400 }
      )
    }

    // Parsear parámetros de la URL
    const topicNumber = parseInt(searchParams.get('topicNumber') || '0')
    const positionType = searchParams.get('positionType') || 'auxiliar_administrativo'
    const onlyOfficialQuestions = searchParams.get('onlyOfficialQuestions') === 'true'

    let selectedLaws: string[] = []
    let selectedArticlesByLaw: Record<string, number[]> = {}
    let selectedSectionFilters: unknown[] = []

    try {
      const lawsParam = searchParams.get('selectedLaws')
      if (lawsParam) selectedLaws = JSON.parse(lawsParam)

      const articlesParam = searchParams.get('selectedArticlesByLaw')
      if (articlesParam) selectedArticlesByLaw = JSON.parse(articlesParam)

      const sectionsParam = searchParams.get('selectedSectionFilters')
      if (sectionsParam) selectedSectionFilters = JSON.parse(sectionsParam)
    } catch (parseError) {
      console.error('Error parsing URL params:', parseError)
    }

    // Validar con Zod
    const validation = safeParseCountFilteredQuestions({
      topicNumber,
      positionType,
      selectedLaws,
      selectedArticlesByLaw,
      selectedSectionFilters,
      onlyOfficialQuestions,
    })

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Parámetros inválidos' },
        { status: 400 }
      )
    }

    // Contar preguntas via Drizzle
    const result = await countFilteredQuestions(validation.data)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      count: result.count,
      byLaw: result.byLaw,
    })
  } catch (error) {
    console.error('❌ Error en API /questions/filtered (count):', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
