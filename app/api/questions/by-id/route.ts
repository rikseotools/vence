// app/api/questions/by-id/route.ts
// Endpoint para obtener una pregunta individual por ID con artículo y ley.
// Usado por /pregunta/[id] (página pública de pregunta compartida).
// Usa Drizzle ORM (DATABASE_URL), no Supabase client → no afectado por RLS.

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db/client'
import { questions, articles, laws } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'

async function _GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const questionId = searchParams.get('id')

  if (!questionId) {
    return NextResponse.json({ success: false, error: 'Falta parámetro id' }, { status: 400 })
  }

  try {
    const db = getDb()

    const [row] = await db
      .select({
        id: questions.id,
        questionText: questions.questionText,
        optionA: questions.optionA,
        optionB: questions.optionB,
        optionC: questions.optionC,
        optionD: questions.optionD,
        optionE: questions.optionE,
        correctOption: questions.correctOption,
        explanation: questions.explanation,
        isOfficialExam: questions.isOfficialExam,
        examSource: questions.examSource,
        examDate: questions.examDate,
        primaryArticleId: questions.primaryArticleId,
        articleId: articles.id,
        articleNumber: articles.articleNumber,
        articleTitle: articles.title,
        articleContent: articles.content,
        lawId: laws.id,
        lawShortName: laws.shortName,
        lawName: laws.name,
      })
      .from(questions)
      .leftJoin(articles, eq(questions.primaryArticleId, articles.id))
      .leftJoin(laws, eq(articles.lawId, laws.id))
      .where(eq(questions.id, questionId))
      .limit(1)

    if (!row) {
      return NextResponse.json({ success: false, error: 'Pregunta no encontrada' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      question: {
        id: row.id,
        question_text: row.questionText,
        option_a: row.optionA,
        option_b: row.optionB,
        option_c: row.optionC,
        option_d: row.optionD,
        option_e: row.optionE,
        correct_option: row.correctOption,
        explanation: row.explanation,
        is_official_exam: row.isOfficialExam,
        exam_source: row.examSource,
        exam_date: row.examDate,
        primary_article_id: row.primaryArticleId,
        articles: row.articleId ? {
          id: row.articleId,
          article_number: row.articleNumber,
          title: row.articleTitle,
          content: row.articleContent,
          laws: row.lawId ? {
            id: row.lawId,
            short_name: row.lawShortName,
            name: row.lawName,
          } : undefined,
        } : undefined,
      },
    })
  } catch (error) {
    console.error('❌ [API/questions/by-id] Error:', error)
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 })
  }
}

export const GET = withErrorLogging('/api/questions/by-id', _GET)
