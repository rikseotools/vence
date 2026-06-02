import { NextRequest, NextResponse } from 'next/server'
import {
  getArticleByLawAndNumber,
  getQuestionsByArticleForDisplay,
  getLawById,
} from '@/lib/api/verify-articles/queries'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getReadDb } from '@/db/client'
import { questions as questionsTable, articles } from '@/db/schema'
import { eq, and, or, ilike } from 'drizzle-orm'

async function _GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lawId = searchParams.get('lawId')
  const articleNumber = searchParams.get('articleNumber')

  if (!lawId || !articleNumber) {
    return NextResponse.json(
      { success: false, error: 'Se requiere lawId y articleNumber' },
      { status: 400 }
    )
  }

  try {
    const article = await getArticleByLawAndNumber(lawId, articleNumber)

    let questions: Record<string, unknown>[] = []

    // Method 1: By FK direct
    if (article?.id) {
      const directQuestions = await getQuestionsByArticleForDisplay(article.id)
      console.log(`📋 Artículo ${articleNumber} (id: ${article.id}): ${directQuestions.length} preguntas encontradas`)
      questions = directQuestions
    }

    // Method 2: Text search if no FK results
    if (questions.length === 0) {
      const law = await getLawById(lawId)

      if (law) {
        const searchPatterns = [
          `artículo ${articleNumber}`,
          `art. ${articleNumber}`,
          `Art. ${articleNumber}`,
          `articulo ${articleNumber}`,
        ]

        const rows = await getReadDb()
          .select({
            id: questionsTable.id,
            question_text: questionsTable.questionText,
            option_a: questionsTable.optionA,
            option_b: questionsTable.optionB,
            option_c: questionsTable.optionC,
            option_d: questionsTable.optionD,
            correct_option: questionsTable.correctOption,
            explanation: questionsTable.explanation,
            is_official_exam: questionsTable.isOfficialExam,
            difficulty: questionsTable.difficulty,
            primary_article_id: questionsTable.primaryArticleId,
            law_id: articles.lawId,
          })
          .from(questionsTable)
          .innerJoin(articles, eq(questionsTable.primaryArticleId, articles.id))
          .where(and(
            eq(articles.lawId, lawId),
            eq(questionsTable.isActive, true),
            or(...searchPatterns.map(p => ilike(questionsTable.questionText, `%${p}%`))),
          ))
          .limit(50)

        // Reconstruir la forma del embed supabase (articles anidado) + mismo filtro JS.
        questions = rows
          .map(({ law_id, ...q }) => ({ ...q, articles: { law_id } }))
          .filter((q) => {
            const text = (q.question_text as string).toLowerCase()
            return searchPatterns.some(p => text.includes(p.toLowerCase()))
          })
      }
    }

    return NextResponse.json({
      success: true,
      articleNumber,
      article: article ? {
        id: article.id,
        title: article.title,
        content: article.content?.substring(0, 500) + (article.content && article.content.length > 500 ? '...' : ''),
      } : null,
      questions,
      count: questions.length,
    })
  } catch (error) {
    console.error('Error obteniendo preguntas:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor', details: (error as Error).message },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/verify-articles/questions', _GET)
