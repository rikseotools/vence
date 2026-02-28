import { NextRequest, NextResponse } from 'next/server'
import { batchInfoParamsSchema } from '@/lib/api/verify-articles/schemas'
import {
  getArticlesByLawAndNumbers,
  countActiveQuestionsByArticle,
} from '@/lib/api/verify-articles/queries'
import { MODEL_BATCH_LIMITS } from '@/lib/api/verify-articles/ai-helpers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = batchInfoParamsSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: `Datos inválidos: ${validation.error.errors.map(e => e.message).join(', ')}` },
        { status: 400 }
      )
    }

    const { lawId, articleNumbers, model } = validation.data
    const batchSize = (model && MODEL_BATCH_LIMITS[model]) || 4

    const articleRows = await getArticlesByLawAndNumbers(lawId, articleNumbers)

    const articleInfo: { articleNumber: string; questionCount: number; batches: number; batchSize: number }[] = []
    let totalQuestions = 0
    let totalBatches = 0

    for (const article of articleRows) {
      const questionCount = await countActiveQuestionsByArticle(article.id)
      const batches = Math.ceil(questionCount / batchSize)

      articleInfo.push({
        articleNumber: article.articleNumber,
        questionCount,
        batches,
        batchSize,
      })

      totalQuestions += questionCount
      totalBatches += batches
    }

    return NextResponse.json({
      success: true,
      model,
      batchSize,
      articles: articleInfo,
      totals: {
        articles: articleInfo.length,
        questions: totalQuestions,
        batches: totalBatches,
      },
    })
  } catch (error) {
    console.error('Error obteniendo batch info:', error)
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}
