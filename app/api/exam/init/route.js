// app/api/exam/init/route.js - API para guardar todas las preguntas al iniciar examen
import { NextResponse } from 'next/server'
import { initExamQuestions, verifyTestOwnership, getQuestionsCorrectAnswers } from '@/lib/api/exam'

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

    // 🔒 SEGURIDAD: Obtener correct_option DIRECTAMENTE de la BD
    // NO confiamos en los datos del cliente (que no tienen correct_option por diseño anti-scraping)
    const questionIds = questions
      .map(q => q.id || q.questionId)
      .filter(Boolean)

    console.log(`🔍 [exam/init] Obteniendo respuestas correctas para ${questionIds.length} preguntas...`)

    const correctAnswersMap = await getQuestionsCorrectAnswers(questionIds)

    console.log(`✅ [exam/init] Obtenidas ${correctAnswersMap.size} respuestas correctas de BD`)

    // Preparar preguntas para guardar (con correctAnswer de la BD)
    const preparedQuestions = questions.map((q, index) => {
      const questionId = q.id || q.questionId
      // 🔒 Usar respuesta de BD, NO del cliente
      const correctFromDb = correctAnswersMap.get(questionId)

      if (!correctFromDb) {
        console.warn(`⚠️ [exam/init] Pregunta ${questionId} no encontrada en BD, usando fallback`)
      }

      return {
        questionId,
        questionOrder: index + 1,
        questionText: q.question_text || q.questionText || '',
        // 🔒 CRÍTICO: Priorizar respuesta de BD sobre cualquier dato del cliente
        correctAnswer: correctFromDb || 'x', // 'x' como flag de error en lugar de 'a'
        articleId: q.articles?.id || q.primary_article_id || q.articleId || null,
        articleNumber: q.articles?.article_number || q.articleNumber || null,
        lawName: q.articles?.laws?.short_name || q.lawName || null,
        temaNumber: q.tema_number || q.temaNumber || null,
        difficulty: q.difficulty || null,
      }
    })

    // Verificar que tenemos respuestas correctas para todas las preguntas
    const questionsWithoutCorrect = preparedQuestions.filter(q => q.correctAnswer === 'x')
    if (questionsWithoutCorrect.length > 0) {
      console.error(`❌ [exam/init] ${questionsWithoutCorrect.length} preguntas sin respuesta correcta en BD`)
    }

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
      savedCount: result.savedCount,
      correctAnswersFromDb: correctAnswersMap.size
    })
  } catch (error) {
    console.error('Error en API /exam/init:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
