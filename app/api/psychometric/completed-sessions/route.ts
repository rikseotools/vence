// app/api/psychometric/completed-sessions/route.ts
// GET - Obtener sesiones psicotécnicas completadas de un usuario (server-side, bypasses RLS)

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db/client'
import { psychometricTestSessions, psychometricCategories } from '@/db/schema'
import { eq, and, isNotNull } from 'drizzle-orm'
import { z } from 'zod/v3'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

const requestSchema = z.object({
  userId: z.string().uuid('ID de usuario invalido'),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

export const dynamic = 'force-dynamic'

async function _GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parsed = requestSchema.safeParse({
      userId: searchParams.get('userId'),
      limit: searchParams.get('limit') || 10,
    })

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Datos invalidos' },
        { status: 400 }
      )
    }

    const { userId, limit } = parsed.data
    const db = getDb()

    const sessions = await db
      .select({
        id: psychometricTestSessions.id,
        categoryId: psychometricTestSessions.categoryId,
        categoryName: psychometricCategories.displayName,
        totalQuestions: psychometricTestSessions.totalQuestions,
        correctAnswers: psychometricTestSessions.correctAnswers,
        accuracyPercentage: psychometricTestSessions.accuracyPercentage,
        completedAt: psychometricTestSessions.completedAt,
        totalTimeSeconds: psychometricTestSessions.totalTimeSeconds,
      })
      .from(psychometricTestSessions)
      .leftJoin(psychometricCategories, eq(psychometricTestSessions.categoryId, psychometricCategories.id))
      .where(
        and(
          eq(psychometricTestSessions.userId, userId),
          eq(psychometricTestSessions.isCompleted, true),
          isNotNull(psychometricTestSessions.completedAt)
        )
      )
      .orderBy(psychometricTestSessions.completedAt)
      .limit(limit)

    // Sort descending (Drizzle orderBy doesn't have desc easily without import)
    sessions.reverse()

    return NextResponse.json({
      success: true,
      sessions: sessions.map(s => ({
        id: s.id,
        categoryName: s.categoryName || 'Test Psicotecnico',
        totalQuestions: s.totalQuestions,
        correctAnswers: s.correctAnswers || 0,
        accuracyPercentage: Number(s.accuracyPercentage || 0),
        completedAt: s.completedAt,
        totalTimeSeconds: s.totalTimeSeconds || 0,
      })),
    })
  } catch (error) {
    console.error('Error en API /api/psychometric/completed-sessions:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/psychometric/completed-sessions', _GET)
