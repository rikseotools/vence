import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getArticleByLawAndNumber,
  getQuestionsByArticleForDisplay,
  getLawById,
} from '@/lib/api/verify-articles/queries'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
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

        const { data: textQuestions } = await getSupabase()
          .from('questions')
          .select(`
            id,
            question_text,
            option_a,
            option_b,
            option_c,
            option_d,
            correct_option,
            explanation,
            is_official_exam,
            difficulty,
            primary_article_id,
            articles!inner (
              law_id
            )
          `)
          .eq('articles.law_id', lawId)
          .eq('is_active', true)
          .or(searchPatterns.map(p => `question_text.ilike.%${p}%`).join(','))
          .limit(50)

        if (textQuestions) {
          questions = textQuestions.filter((q: { question_text: string }) => {
            const text = q.question_text.toLowerCase()
            return searchPatterns.some(p => text.includes(p.toLowerCase()))
          })
        }
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
