// lib/api/answers/queries.ts - Queries tipadas para validación de respuestas
import { getDb } from '@/db/client'
import { questions, articles, laws, psychometricQuestions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { ValidateAnswerRequest, ValidateAnswerResponse } from './schemas'

// ============================================
// VALIDAR RESPUESTA DE USUARIO
// ============================================
// Esta función es el núcleo de la protección anti-scraping.
// La respuesta correcta SOLO se revela después de que el usuario responde.
// Busca primero en questions, luego en psychometric_questions si no encuentra.

export async function validateAnswer(
  params: ValidateAnswerRequest
): Promise<ValidateAnswerResponse> {
  try {
    const db = getDb()

    // Query con joins para obtener información completa (legislative questions)
    const result = await db
      .select({
        correctOption: questions.correctOption,
        explanation: questions.explanation,
        articleNumber: articles.articleNumber,
        lawShortName: laws.shortName,
        lawName: laws.name
      })
      .from(questions)
      .leftJoin(articles, eq(questions.primaryArticleId, articles.id))
      .leftJoin(laws, eq(articles.lawId, laws.id))
      .where(eq(questions.id, params.questionId))
      .limit(1)

    const question = result[0]

    if (!question) {
      // Not found in questions table, try psychometric_questions
      const psyResult = await db
        .select({
          correctOption: psychometricQuestions.correctOption,
          explanation: psychometricQuestions.explanation,
        })
        .from(psychometricQuestions)
        .where(eq(psychometricQuestions.id, params.questionId))
        .limit(1)

      const psyQuestion = psyResult[0]

      if (!psyQuestion) {
        console.error('❌ [API/answer] Pregunta no encontrada en ninguna tabla:', params.questionId)
        return {
          success: false,
          isCorrect: false,
          correctAnswer: 0,
          explanation: null
        }
      }

      const isCorrect = params.userAnswer === psyQuestion.correctOption

      return {
        success: true,
        isCorrect,
        correctAnswer: psyQuestion.correctOption,
        explanation: psyQuestion.explanation,
        articleNumber: null,
        lawShortName: null,
        lawName: null
      }
    }

    const isCorrect = params.userAnswer === question.correctOption

    console.log('✅ [API/answer] Respuesta validada:', {
      questionId: params.questionId,
      userAnswer: params.userAnswer,
      correctAnswer: question.correctOption,
      isCorrect
    })

    return {
      success: true,
      isCorrect,
      correctAnswer: question.correctOption,
      explanation: question.explanation,
      articleNumber: question.articleNumber,
      lawShortName: question.lawShortName,
      lawName: question.lawName
    }

  } catch (error) {
    console.error('❌ [API/answer] Error validando respuesta:', error)
    return {
      success: false,
      isCorrect: false,
      correctAnswer: 0,
      explanation: null
    }
  }
}

// ============================================
// OBTENER SOLO LA RESPUESTA CORRECTA
// ============================================
// Versión simplificada para casos donde solo necesitas validar

export async function getCorrectAnswer(questionId: string): Promise<number | null> {
  try {
    const db = getDb()

    const [result] = await db
      .select({ correctOption: questions.correctOption })
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1)

    return result?.correctOption ?? null

  } catch (error) {
    console.error('❌ [API/answer] Error obteniendo respuesta:', error)
    return null
  }
}
