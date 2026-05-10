// app/api/medals/route.ts - API endpoint para medallas de ranking
import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseGetMedalsRequest,
  safeParseCheckMedalsRequest,
  getUserMedals,
  checkAndSaveNewMedals,
} from '@/lib/api/medals'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { withDbTimeout, isDbTimeoutError } from '@/lib/db/timeout'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Quick-fail timeouts (Phase 3)
const READ_TIMEOUT_MS = 8000
const WRITE_TIMEOUT_MS = 15000  // checkAndSaveNewMedals hace SELECT + N inserts

function timeoutResponse() {
  return NextResponse.json(
    { success: false, error: 'Servicio saturado momentáneamente. Reintenta en 5 minutos.', retryable: true },
    { status: 503, headers: { 'Retry-After': '300' } },
  )
}

// ============================================
// GET: Obtener medallas del usuario
// ============================================

async function _GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    const parseResult = safeParseGetMedalsRequest({ userId })
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'userId invalido o faltante' },
        { status: 400 }
      )
    }

    const result = await withDbTimeout(
      () => getUserMedals(parseResult.data.userId),
      READ_TIMEOUT_MS,
    )

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    if (isDbTimeoutError(error)) {
      console.warn('⏱️ [API/medals GET] Timeout (quick-fail):', error.timeoutMs, 'ms')
      return timeoutResponse()
    }
    console.error('❌ [API/medals] Error GET:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// ============================================
// POST: Verificar y guardar medallas nuevas
// ============================================

async function _POST(request: NextRequest) {
  try {
    const body = await request.json()

    const parseResult = safeParseCheckMedalsRequest(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'userId invalido o faltante' },
        { status: 400 }
      )
    }

    const result = await withDbTimeout(
      () => checkAndSaveNewMedals(parseResult.data.userId),
      WRITE_TIMEOUT_MS,
    )

    return NextResponse.json(result)
  } catch (error) {
    if (isDbTimeoutError(error)) {
      console.warn('⏱️ [API/medals POST] Timeout (quick-fail):', error.timeoutMs, 'ms')
      return timeoutResponse()
    }
    console.error('❌ [API/medals] Error POST:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/medals', _GET)
export const POST = withErrorLogging('/api/medals', _POST)
