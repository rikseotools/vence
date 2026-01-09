// app/api/exam/resume/route.js - API para obtener datos de examen a reanudar
import { NextResponse } from 'next/server'
import { getResumedExamData, verifyTestOwnership } from '@/lib/api/exam'
import { createClient } from '@supabase/supabase-js'

// Supabase para obtener preguntas completas (questions table)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const testId = searchParams.get('testId')
    const userId = searchParams.get('userId')

    if (!testId) {
      return NextResponse.json(
        { success: false, error: 'testId es requerido' },
        { status: 400 }
      )
    }

    // Validar UUID básico
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
          { success: false, error: 'No tienes acceso a este examen' },
          { status: 403 }
        )
      }
    }

    // Obtener datos básicos del examen via Drizzle
    const examData = await getResumedExamData(testId)

    if (!examData.success) {
      return NextResponse.json(
        { success: false, error: examData.error },
        { status: examData.error === 'Test no encontrado' ? 404 : 400 }
      )
    }

    // Obtener question_ids de las respuestas guardadas
    const questionIds = examData.questions
      ?.filter(q => q.questionId)
      .map(q => q.questionId) || []

    if (questionIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay preguntas guardadas para reanudar' },
        { status: 400 }
      )
    }

    // Obtener preguntas completas desde Supabase
    const { data: fullQuestions, error: questionsError } = await supabase
      .from('questions')
      .select(`
        id, question_text, option_a, option_b, option_c, option_d,
        correct_option, explanation, difficulty, is_official_exam,
        primary_article_id,
        articles(
          id, article_number, title, content,
          laws(short_name, name)
        )
      `)
      .in('id', questionIds)

    if (questionsError) {
      console.error('Error obteniendo preguntas completas:', questionsError)
      return NextResponse.json(
        { success: false, error: 'Error obteniendo preguntas' },
        { status: 500 }
      )
    }

    // Crear mapa de preguntas por ID para acceso rápido
    const questionsMap = new Map(fullQuestions.map(q => [q.id, q]))

    // Construir respuesta ordenada con preguntas completas y respuestas
    const orderedQuestions = []
    const savedAnswers = {}

    examData.questions?.forEach((savedQ, index) => {
      if (savedQ.questionId && questionsMap.has(savedQ.questionId)) {
        orderedQuestions.push(questionsMap.get(savedQ.questionId))

        // Guardar respuesta del usuario si existe (no vacía)
        // userAnswer = '' significa no respondida
        if (savedQ.userAnswer && savedQ.userAnswer.trim() !== '') {
          savedAnswers[index] = savedQ.userAnswer.toLowerCase()
        }
      }
    })

    return NextResponse.json({
      success: true,
      testId: examData.testId,
      temaNumber: examData.temaNumber,
      totalQuestions: orderedQuestions.length,
      answeredCount: examData.answeredCount,
      questions: orderedQuestions,
      savedAnswers
    })
  } catch (error) {
    console.error('Error en API /exam/resume:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
