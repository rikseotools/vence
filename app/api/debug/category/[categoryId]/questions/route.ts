// app/api/debug/category/[categoryId]/questions/route.ts - Debug preguntas por categoría
import { getDb } from '@/db/client'
import {
  questions,
  articles,
  laws,
  psychometricQuestions,
} from '@/db/schema'
import { eq, and, inArray, asc } from 'drizzle-orm'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
async function _GET(
  _request: Request,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    const { categoryId } = await params
    const db = getDb()

    console.log('🔍 Debug API: Obteniendo preguntas de categoría:', categoryId)

    // Primero intentar buscar en laws (para preguntas de leyes)
    const lawResult = await db
      .select({ id: laws.id })
      .from(laws)
      .where(eq(laws.id, categoryId))
      .limit(1)

    if (lawResult.length > 0) {
      // Es una ley - buscar artículos activos
      const articleResults = await db
        .select({ id: articles.id })
        .from(articles)
        .where(and(eq(articles.lawId, categoryId), eq(articles.isActive, true)))

      const articleIds = articleResults.map(a => a.id)

      if (articleIds.length > 0) {
        const questionResults = await db
          .select({
            id: questions.id,
            question_text: questions.questionText,
            created_at: questions.createdAt,
            primary_article_id: questions.primaryArticleId,
          })
          .from(questions)
          .where(
            and(
              inArray(questions.primaryArticleId, articleIds),
              eq(questions.isActive, true)
            )
          )
          .orderBy(asc(questions.createdAt))

        console.log(`✅ Encontradas ${questionResults.length} preguntas en ley ${categoryId}`)
        return Response.json({
          questions: questionResults,
          total: questionResults.length,
        })
      }
    }

    // Si no es una ley, buscar en psychometric_questions
    const psychResults = await db
      .select({
        id: psychometricQuestions.id,
        question_text: psychometricQuestions.questionText,
        question_subtype: psychometricQuestions.questionSubtype,
        created_at: psychometricQuestions.createdAt,
        category_id: psychometricQuestions.categoryId,
        section_id: psychometricQuestions.sectionId,
      })
      .from(psychometricQuestions)
      .where(
        and(
          eq(psychometricQuestions.categoryId, categoryId),
          eq(psychometricQuestions.isActive, true)
        )
      )
      .orderBy(asc(psychometricQuestions.createdAt))

    console.log(`✅ Encontradas ${psychResults.length} preguntas en categoría ${categoryId}`)

    return Response.json({
      questions: psychResults,
      total: psychResults.length,
    })
  } catch (error) {
    console.error('❌ Error inesperado en debug/category API:', error)
    return Response.json(
      {
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/debug/category/[categoryId]/questions', _GET)
