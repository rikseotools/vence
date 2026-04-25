// app/api/spelling/session/route.ts
// Crear y completar sesiones de test de ortografía
import { NextRequest, NextResponse } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getUserIdFromToken } from '@/lib/api/dailyLimit'
import {
  createSpellingSessionRequestSchema,
  completeSpellingSessionRequestSchema,
  createSpellingSession,
  completeSpellingSession,
} from '@/lib/api/spelling-answer'

export const maxDuration = 15

// POST: crear sesión o completar sesión (según action)
async function _POST(request: NextRequest) {
  const tokenUserId = await getUserIdFromToken(request)
  if (!tokenUserId) {
    return NextResponse.json({ success: false, error: 'Auth required' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const action = body.action as string

    if (action === 'create') {
      const validation = createSpellingSessionRequestSchema.safeParse({
        ...body,
        userId: tokenUserId,
      })
      if (!validation.success) {
        return NextResponse.json(
          { success: false, error: 'Datos inválidos', details: validation.error.flatten() },
          { status: 400 }
        )
      }

      const result = await createSpellingSession(validation.data)
      return NextResponse.json(result)
    }

    if (action === 'complete') {
      const validation = completeSpellingSessionRequestSchema.safeParse({
        ...body,
        userId: tokenUserId,
      })
      if (!validation.success) {
        return NextResponse.json(
          { success: false, error: 'Datos inválidos', details: validation.error.flatten() },
          { status: 400 }
        )
      }

      await completeSpellingSession(validation.data)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: 'action must be "create" or "complete"' }, { status: 400 })

  } catch (error) {
    console.error('❌ [API/spelling/session] Error:', error)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}

export const POST = withErrorLogging('/api/spelling/session', _POST)
