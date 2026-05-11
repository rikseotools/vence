// app/api/v2/dispute/route.ts
// API unificada para impugnaciones (legislativas y psicotécnicas)
// Usa Drizzle + Zod + Bearer auth

import { NextRequest, NextResponse } from 'next/server'
import {
  createDisputeRequestSchema,
  getDisputeRequestSchema,
  getExistingDispute,
  createDispute,
} from '@/lib/api/v2/dispute'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuthOptional } from '@/lib/api/auth/verifyAuth'

export const dynamic = 'force-dynamic'

// Extraer y verificar usuario del Bearer token (wrapper Fase 0.7)
async function getUserFromToken(request: NextRequest): Promise<{ id: string; email?: string } | null> {
  const auth = await verifyAuthOptional(request, '/api/v2/dispute')
  if (!auth) return null
  return { id: auth.userId, email: auth.email ?? undefined }
}

// GET - Obtener impugnación existente
async function _GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request)
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const parsed = getDisputeRequestSchema.safeParse({
      questionId: searchParams.get('questionId'),
      questionType: searchParams.get('questionType') || 'legislative',
    })

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Datos invalidos' },
        { status: 400 }
      )
    }

    const result = await getExistingDispute(parsed.data.questionId, user.id, parsed.data.questionType)
    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error en GET /api/v2/dispute:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
}

// POST - Crear nueva impugnación
async function _POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request)
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createDisputeRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Datos invalidos' },
        { status: 400 }
      )
    }

    const result = await createDispute(parsed.data, user.id)
    if (!result.success) {
      const status = result.error.includes('Ya has impugnado') ? 409
        : result.error.includes('no encontrada') ? 404
        : 400
      return NextResponse.json(result, { status })
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error en POST /api/v2/dispute:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/v2/dispute', _GET)
export const POST = withErrorLogging('/api/v2/dispute', _POST)
