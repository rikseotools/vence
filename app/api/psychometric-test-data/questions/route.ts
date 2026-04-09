// app/api/psychometric-test-data/questions/route.ts
// GET - Devuelve preguntas psicotécnicas filtradas por categoría (SIN correct_option)

import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseGetPsychometricQuestionsRequest,
  getPsychometricQuestions,
} from '@/lib/api/psychometric-test-data'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { checkRateLimit, getClientIp, RATE_LIMIT_PSYCHOMETRIC } from '@/lib/api/rateLimit'
import { logValidationError } from '@/lib/api/validation-error-log'
export const dynamic = 'force-dynamic'

async function _GET(request: NextRequest) {
  // Rate limiting anti-scraping
  const ip = getClientIp(request)
  const rateCheck = checkRateLimit(ip, RATE_LIMIT_PSYCHOMETRIC)
  if (!rateCheck.allowed) {
    logValidationError({
      endpoint: '/api/psychometric-test-data/questions',
      errorType: 'rate_limit',
      errorMessage: `Rate limit exceeded: ${ip}`,
      severity: 'warning',
      httpStatus: 429,
      userAgent: request.headers.get('user-agent'),
    })
    return NextResponse.json(
      { success: false, error: 'Demasiadas solicitudes. Espera un momento.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rateCheck.resetMs / 1000)) } }
    )
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const categoriesParam = searchParams.get('categories')
    const sectionsParam = searchParams.get('sections')
    const numQuestionsParam = searchParams.get('numQuestions')

    if (!categoriesParam) {
      return NextResponse.json(
        { success: false, error: 'Parámetro "categories" requerido' },
        { status: 400 }
      )
    }

    const categories = categoriesParam.split(',').filter(Boolean)
    const sections = sectionsParam ? sectionsParam.split(',').filter(Boolean) : undefined
    const numQuestions = numQuestionsParam ? parseInt(numQuestionsParam, 10) : 25

    // Validate with Zod
    const parseResult = safeParseGetPsychometricQuestionsRequest({
      categories,
      sections,
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
      parseResult.data.numQuestions,
      parseResult.data.sections
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

export const GET = withErrorLogging('/api/psychometric-test-data/questions', _GET)
