// app/api/random-test-data/check-availability/route.ts
// Endpoint para verificar preguntas disponibles con filtros
import { NextRequest, NextResponse } from 'next/server'
import { checkAvailableQuestions } from '@/lib/api/random-test-data/queries'
import { safeParseCheckAvailableQuestionsRequest } from '@/lib/api/random-test-data/schemas'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validar request con Zod
    const parseResult = safeParseCheckAvailableQuestionsRequest(body)

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Parámetros inválidos',
          details: parseResult.error.issues,
        },
        { status: 400 }
      )
    }

    const { oposicion, selectedThemes, difficulty, onlyOfficialQuestions, focusEssentialArticles } = parseResult.data

    // Ejecutar query
    const result = await checkAvailableQuestions(
      oposicion,
      selectedThemes,
      difficulty,
      onlyOfficialQuestions,
      focusEssentialArticles
    )

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error en check-availability:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}

// También soportar GET para compatibilidad (con query params)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    const oposicion = searchParams.get('oposicion')
    const themesParam = searchParams.get('themes')
    const difficulty = searchParams.get('difficulty') || 'mixed'
    const onlyOfficial = searchParams.get('onlyOfficial') === 'true'
    const focusEssential = searchParams.get('focusEssential') === 'true'

    if (!oposicion || !themesParam) {
      return NextResponse.json(
        {
          success: false,
          error: 'Parámetros requeridos: oposicion, themes',
        },
        { status: 400 }
      )
    }

    // Parsear temas
    const selectedThemes = themesParam.split(',').map(t => parseInt(t.trim())).filter(t => !isNaN(t))

    if (selectedThemes.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Al menos un tema debe ser seleccionado',
        },
        { status: 400 }
      )
    }

    // Validar con Zod
    const parseResult = safeParseCheckAvailableQuestionsRequest({
      oposicion,
      selectedThemes,
      difficulty,
      onlyOfficialQuestions: onlyOfficial,
      focusEssentialArticles: focusEssential,
    })

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Parámetros inválidos',
          details: parseResult.error.issues,
        },
        { status: 400 }
      )
    }

    // Ejecutar query
    const result = await checkAvailableQuestions(
      parseResult.data.oposicion,
      parseResult.data.selectedThemes,
      parseResult.data.difficulty,
      parseResult.data.onlyOfficialQuestions,
      parseResult.data.focusEssentialArticles
    )

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error en check-availability GET:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}
