// app/api/psychometric/review/route.ts
// GET - Obtener datos de revisión de una sesión psicotécnica completada

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db/client'
import { psychometricTestSessions, psychometricTestAnswers, psychometricQuestions, psychometricCategories } from '@/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { z } from 'zod/v3'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

const requestSchema = z.object({
  sessionId: z.string().uuid('ID de sesion invalido'),
})

export const dynamic = 'force-dynamic'

async function _GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parsed = requestSchema.safeParse({
      sessionId: searchParams.get('sessionId'),
    })

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Datos invalidos' },
        { status: 400 }
      )
    }

    const { sessionId } = parsed.data
    const db = getDb()

    // 1. Get session info
    const [session] = await db
      .select({
        id: psychometricTestSessions.id,
        userId: psychometricTestSessions.userId,
        totalQuestions: psychometricTestSessions.totalQuestions,
        correctAnswers: psychometricTestSessions.correctAnswers,
        accuracyPercentage: psychometricTestSessions.accuracyPercentage,
        completedAt: psychometricTestSessions.completedAt,
        startedAt: psychometricTestSessions.startedAt,
        isCompleted: psychometricTestSessions.isCompleted,
        totalTimeSeconds: psychometricTestSessions.totalTimeSeconds,
        categoryName: psychometricCategories.displayName,
      })
      .from(psychometricTestSessions)
      .leftJoin(psychometricCategories, eq(psychometricTestSessions.categoryId, psychometricCategories.id))
      .where(eq(psychometricTestSessions.id, sessionId))
      .limit(1)

    if (!session) {
      return NextResponse.json({ success: false, error: 'Test no encontrado' }, { status: 404 })
    }

    if (!session.isCompleted) {
      return NextResponse.json({ success: false, error: 'El test no esta completado' }, { status: 400 })
    }

    // 2. Get answers with question details
    const answers = await db
      .select({
        id: psychometricTestAnswers.id,
        questionId: psychometricTestAnswers.questionId,
        questionOrder: psychometricTestAnswers.questionOrder,
        userAnswer: psychometricTestAnswers.userAnswer,
        isCorrect: psychometricTestAnswers.isCorrect,
        timeSpentSeconds: psychometricTestAnswers.timeSpentSeconds,
        questionText: psychometricQuestions.questionText,
        optionA: psychometricQuestions.optionA,
        optionB: psychometricQuestions.optionB,
        optionC: psychometricQuestions.optionC,
        optionD: psychometricQuestions.optionD,
        correctOption: psychometricQuestions.correctOption,
        explanation: psychometricQuestions.explanation,
        difficulty: psychometricQuestions.difficulty,
        questionSubtype: psychometricQuestions.questionSubtype,
      })
      .from(psychometricTestAnswers)
      .leftJoin(psychometricQuestions, eq(psychometricTestAnswers.questionId, psychometricQuestions.id))
      .where(eq(psychometricTestAnswers.testSessionId, sessionId))
      .orderBy(asc(psychometricTestAnswers.questionOrder))

    // 3. Build response
    const totalQuestions = answers.length || session.totalQuestions || 0
    const correctCount = answers.filter(a => a.isCorrect).length
    const incorrectCount = answers.filter(a => !a.isCorrect && a.userAnswer).length
    const blankCount = answers.filter(a => !a.userAnswer).length
    const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0

    const indexToLetter = (i: number | null) => i !== null && i !== undefined ? ['a', 'b', 'c', 'd'][i] || null : null

    const reviewQuestions = answers.map((a, index) => ({
      id: a.questionId || a.id,
      order: a.questionOrder ?? index + 1,
      questionText: a.questionText || 'Pregunta no disponible',
      options: [a.optionA || '', a.optionB || '', a.optionC || '', a.optionD || ''],
      difficulty: a.difficulty || 'medium',
      tema: null,
      articleNumber: null,
      lawName: null,
      explanation: a.explanation || null,
      article: null,
      isPsychometric: true,
      userAnswer: indexToLetter(a.userAnswer),
      correctAnswer: indexToLetter(a.correctOption) || 'a',
      isCorrect: a.isCorrect ?? false,
      timeSpent: a.timeSpentSeconds || 0,
    }))

    return NextResponse.json({
      success: true,
      test: {
        id: session.id,
        title: session.categoryName || 'Test Psicotecnico',
        testType: 'psychometric',
        tema: null,
        createdAt: session.startedAt,
        completedAt: session.completedAt,
        totalTimeSeconds: session.totalTimeSeconds || 0,
      },
      summary: {
        totalQuestions,
        correctCount,
        incorrectCount,
        blankCount,
        score: String(correctCount),
        percentage,
      },
      questions: reviewQuestions,
      temaBreakdown: [],
      difficultyBreakdown: [],
    })
  } catch (error) {
    console.error('Error en API /api/psychometric/review:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/psychometric/review', _GET)
