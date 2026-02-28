// app/api/debug/question/[id]/route.ts - Debug UI para preguntas
// 🔒 SEGURIDAD: Esta API es para debug de UI, NO devuelve correct_option
// La validación de respuestas se hace via /api/answer o /api/answer/psychometric
import { getDb } from '@/db/client'
import {
  questions,
  articles,
  laws,
  psychometricQuestions,
  psychometricSections,
  psychometricCategories,
} from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return Response.json({ error: 'Question ID required' }, { status: 400 })
    }

    const db = getDb()

    // Primero intentar buscar en la tabla questions (preguntas de leyes)
    // 🔒 SEGURIDAD: NO seleccionar correct_option
    const lawResults = await db
      .select({
        id: questions.id,
        questionText: questions.questionText,
        optionA: questions.optionA,
        optionB: questions.optionB,
        optionC: questions.optionC,
        optionD: questions.optionD,
        explanation: questions.explanation,
        primaryArticleId: questions.primaryArticleId,
        isActive: questions.isActive,
        createdAt: questions.createdAt,
        articleId: articles.id,
        articleNumber: articles.articleNumber,
        articleTitle: articles.title,
        lawId: laws.id,
        lawShortName: laws.shortName,
        lawOfficialName: laws.name,
      })
      .from(questions)
      .leftJoin(articles, eq(questions.primaryArticleId, articles.id))
      .leftJoin(laws, eq(articles.lawId, laws.id))
      .where(eq(questions.id, id))
      .limit(1)

    if (lawResults.length > 0) {
      const q = lawResults[0]

      return Response.json({
        success: true,
        question: {
          id: q.id,
          question_text: q.questionText,
          question_subtype: 'text_question',
          options: {
            A: q.optionA,
            B: q.optionB,
            C: q.optionC,
            D: q.optionD,
          },
          content_data: null,
          explanation: q.explanation,
          category_id: q.lawId ?? null,
          category: {
            key: q.lawShortName ?? 'ley',
            name: q.lawOfficialName ?? 'Ley',
          },
          section: {
            key: `articulo-${q.articleNumber ?? '?'}`,
            name: `Artículo ${q.articleNumber ?? '?'} - ${q.articleTitle ?? ''}`,
          },
          primary_article_id: q.primaryArticleId,
          is_active: q.isActive,
          created_at: q.createdAt,
          question_type: 'law',
        },
      })
    }

    // Si no está en questions, buscar en psychometric_questions
    // 🔒 SEGURIDAD: NO seleccionar correct_option
    const psychResults = await db
      .select({
        id: psychometricQuestions.id,
        questionText: psychometricQuestions.questionText,
        questionSubtype: psychometricQuestions.questionSubtype,
        optionA: psychometricQuestions.optionA,
        optionB: psychometricQuestions.optionB,
        optionC: psychometricQuestions.optionC,
        optionD: psychometricQuestions.optionD,
        contentData: psychometricQuestions.contentData,
        explanation: psychometricQuestions.explanation,
        isActive: psychometricQuestions.isActive,
        createdAt: psychometricQuestions.createdAt,
        sectionKey: psychometricSections.sectionKey,
        sectionDisplayName: psychometricSections.displayName,
        categoryKey: psychometricCategories.categoryKey,
        categoryDisplayName: psychometricCategories.displayName,
      })
      .from(psychometricQuestions)
      .innerJoin(psychometricSections, eq(psychometricQuestions.sectionId, psychometricSections.id))
      .innerJoin(psychometricCategories, eq(psychometricSections.categoryId, psychometricCategories.id))
      .where(eq(psychometricQuestions.id, id))
      .limit(1)

    if (psychResults.length === 0) {
      return Response.json({ error: 'Question not found' }, { status: 404 })
    }

    const q = psychResults[0]

    return Response.json({
      success: true,
      question: {
        id: q.id,
        question_text: q.questionText,
        question_subtype: q.questionSubtype,
        options: {
          A: q.optionA,
          B: q.optionB,
          C: q.optionC,
          D: q.optionD,
        },
        content_data: q.contentData,
        explanation: q.explanation,
        category: {
          key: q.categoryKey,
          name: q.categoryDisplayName,
        },
        section: {
          key: q.sectionKey,
          name: q.sectionDisplayName,
        },
        is_active: q.isActive,
        created_at: q.createdAt,
        question_type: 'psychometric',
      },
    })
  } catch (error) {
    console.error('API Error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
