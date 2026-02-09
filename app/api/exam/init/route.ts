
// app/api/exam/init/route.ts - API para guardar todas las preguntas al iniciar examen
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { initExamQuestions, verifyTestOwnership, getQuestionsCorrectAnswers } from '@/lib/api/exam'

// Schema de validación para la request
const initExamRequestSchema = z.object({
  testId: z.string().uuid('testId debe ser un UUID válido'),
  userId: z.string().uuid().optional().nullable(),
  questions: z.array(z.object({
    id: z.string().uuid().optional(),
    questionId: z.string().uuid().optional(),
    question_text: z.string().optional(),
    questionText: z.string().optional(),
    articles: z.object({
      id: z.string().uuid().optional(),
      article_number: z.string().optional(),
      laws: z.object({
        short_name: z.string().optional(),
      }).optional(),
    }).optional(),
    primary_article_id: z.string().uuid().optional().nullable(),
    articleId: z.string().uuid().optional().nullable(),
    articleNumber: z.string().optional().nullable(),
    lawName: z.string().optional().nullable(),
    tema_number: z.number().optional().nullable(),
    temaNumber: z.number().optional().nullable(),
    difficulty: z.string().optional().nullable(),
  })).min(1, 'Debe haber al menos una pregunta'),
})

type InitExamRequest = z.infer<typeof initExamRequestSchema>

/**
 * POST /api/exam/init
 *
 * Inicializa un examen guardando todas las preguntas en test_questions.
 * Obtiene las respuestas correctas de la BD (seguridad anti-scraping).
 *
 * Request body:
 * - testId: string (UUID)
 * - userId?: string (UUID, opcional para verificar ownership)
 * - questions: array de objetos con datos de preguntas
 *
 * Returns:
 * - success: boolean
 * - savedCount: number
 * - correctAnswersFromDb: number
 * - error: string (si falla)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validar con Zod
    const parseResult = initExamRequestSchema.safeParse(body)

    if (!parseResult.success) {
      console.error('❌ [API/exam/init] Validation error:', parseResult.error.issues)
      return NextResponse.json(
        {
          success: false,
          error: 'Datos de entrada inválidos',
          details: parseResult.error.issues.map(i => i.message),
        },
        { status: 400 }
      )
    }

    const { testId, userId, questions } = parseResult.data

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
      .filter((id): id is string => Boolean(id))

    console.log(`🔍 [exam/init] Obteniendo respuestas correctas para ${questionIds.length} preguntas...`)

    const correctAnswersMap = await getQuestionsCorrectAnswers(questionIds)

    console.log(`✅ [exam/init] Obtenidas ${correctAnswersMap.size} respuestas correctas de BD`)

    // Preparar preguntas para guardar (con correctAnswer de la BD)
    const preparedQuestions = questions
      .map((q, index) => {
        const questionId = q.id || q.questionId
        if (!questionId) {
          console.warn(`⚠️ [exam/init] Pregunta sin ID en posición ${index}, será ignorada`)
          return null
        }
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
          correctAnswer: correctFromDb || 'x', // 'x' como flag de error
          articleId: q.articles?.id || q.primary_article_id || q.articleId || null,
          articleNumber: q.articles?.article_number || q.articleNumber || null,
          lawName: q.articles?.laws?.short_name || q.lawName || null,
          temaNumber: q.tema_number || q.temaNumber || null,
          difficulty: q.difficulty || null,
        }
      })
      .filter((q): q is NonNullable<typeof q> => q !== null)

    // Verificar que tenemos respuestas correctas para todas las preguntas
    const questionsWithoutCorrect = preparedQuestions.filter(q => q.correctAnswer === 'x')
    if (questionsWithoutCorrect.length > 0) {
      console.error(`❌ [exam/init] ${questionsWithoutCorrect.length} preguntas sin respuesta correcta en BD`)
    }

    // Guardar todas las preguntas
    const result = await initExamQuestions(testId, preparedQuestions)

    if (!result.success) {
      console.error('❌ [API/exam/init] Init failed:', result.error)
      return NextResponse.json(
        { success: false, error: result.error || 'Error guardando preguntas' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      savedCount: result.savedCount,
      correctAnswersFromDb: correctAnswersMap.size,
    })
  } catch (error) {
    console.error('❌ [API/exam/init] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}
