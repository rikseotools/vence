// app/api/v2/official-exams/review/route.ts
// API to get all questions from a completed official exam for review

import { NextRequest, NextResponse } from 'next/server'
import { getOfficialExamReview } from '@/lib/api/official-exams/queries'
import { safeParseGetOfficialExamReview } from '@/lib/api/official-exams/schemas'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'

async function _GET(request: NextRequest) {
  try {
    // Verify authentication (wrapper Fase 0.7 — soporta off/shadow/on)
    const auth = await verifyAuth(request, '/api/v2/official-exams/review')
    if (!auth.success) {
      return NextResponse.json(
        { success: false, error: auth.reason === 'no_bearer_token' ? 'No autorizado' : 'Token inválido' },
        { status: 401 }
      )
    }
    const user = { id: auth.userId, email: auth.email }

    // Get query params
    const { searchParams } = new URL(request.url)
    const examDate = searchParams.get('examDate')
    const oposicion = searchParams.get('oposicion')
    const parte = searchParams.get('parte') as 'primera' | 'segunda' | null

    // Validate request
    const validation = safeParseGetOfficialExamReview({
      userId: user.id,
      examDate,
      oposicion,
      parte: parte || undefined,
    })

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Parámetros inválidos', details: validation.error.issues },
        { status: 400 }
      )
    }

    // Get review data
    const result = await getOfficialExamReview(validation.data)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 404 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [API/official-exams/review] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/v2/official-exams/review', _GET)
