// app/api/exam/init/route.js - API para guardar todas las preguntas al iniciar examen
import { NextResponse } from 'next/server'
import { initExamQuestions, verifyTestOwnership } from '@/lib/api/exam'

export async function POST(request) {
  try {
    const body = await request.json()
    const { testId, questions, userId } = body

    // Validar request
    if (!testId) {
      return NextResponse.json(
        { success: false, error: 'testId es requerido' },
        { status: 400 }
      )
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'questions es requerido y debe ser un array' },
        { status: 400 }
      )
    }

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(testId)) {
      return NextResponse.json(
        { success: false, error: 'testId inválido' },
        { status: 400 }
      )
    }

    // Si se proporciona userId, verificar propiedad
    if (userId) {
      const isOwner = await verifyTestOwnership(testId, userId)
      if (!isOwner) {
        return NextResponse.json(
          { success: false, error: 'No tienes acceso a este test' },
          { status: 403 }
        )
      }
    }

    // Preparar preguntas para guardar
    const preparedQuestions = questions.map((q, index) => ({
      questionId: q.id || q.questionId,
      questionOrder: index + 1,
      questionText: q.question_text || q.questionText || '',
      correctAnswer: typeof q.correct_option === 'number'
        ? String.fromCharCode(97 + q.correct_option)
        : q.correctAnswer || 'a',
      articleId: q.articles?.id || q.primary_article_id || q.articleId || null,
      articleNumber: q.articles?.article_number || q.articleNumber || null,
      lawName: q.articles?.laws?.short_name || q.lawName || null,
      temaNumber: q.tema_number || q.temaNumber || null,
      difficulty: q.difficulty || null,
    }))

    // Guardar todas las preguntas
    const result = await initExamQuestions(testId, preparedQuestions)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Error guardando preguntas' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      savedCount: result.savedCount
    })
  } catch (error) {
    console.error('Error en API /exam/init:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
