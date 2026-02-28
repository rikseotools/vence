import { NextRequest, NextResponse } from 'next/server'
import {
  getArticleIdsByLaw,
  getQuestionsByArticleIds,
} from '@/lib/api/verify-articles/queries'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lawId = searchParams.get('lawId')

    if (!lawId) {
      return NextResponse.json(
        { success: false, error: 'lawId es requerido' },
        { status: 400 }
      )
    }

    const articleRows = await getArticleIdsByLaw(lawId)

    if (!articleRows || articleRows.length === 0) {
      return NextResponse.json({ success: true, articles: [], total: 0 })
    }

    const articleIds = articleRows.map(a => a.id)
    const questionRows = await getQuestionsByArticleIds(articleIds)

    // Count questions per article and track verification stats
    const questionCounts: Record<string, number> = {}
    const verificationStats: Record<string, { total: number; ok: number; problem: number; pending: number; lastVerified: string | null }> = {}

    for (const q of questionRows) {
      const artId = q.primaryArticleId!
      questionCounts[artId] = (questionCounts[artId] || 0) + 1

      if (!verificationStats[artId]) {
        verificationStats[artId] = { total: 0, ok: 0, problem: 0, pending: 0, lastVerified: null }
      }

      verificationStats[artId].total++

      if (!q.verifiedAt) {
        verificationStats[artId].pending++
      } else {
        if (!verificationStats[artId].lastVerified || q.verifiedAt > verificationStats[artId].lastVerified!) {
          verificationStats[artId].lastVerified = q.verifiedAt
        }
        if (q.verificationStatus === 'ok') {
          verificationStats[artId].ok++
        } else if (q.verificationStatus === 'problem') {
          verificationStats[artId].problem++
        }
      }
    }

    const sortByArticleNumber = (a: { article_number: string }, b: { article_number: string }) => {
      const numA = parseInt(a.article_number)
      const numB = parseInt(b.article_number)
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB
      return String(a.article_number).localeCompare(String(b.article_number))
    }

    const articlesWithQuestions = articleRows
      .filter(a => questionCounts[a.id] > 0)
      .map(a => ({
        article_number: a.articleNumber,
        title: a.title || `Artículo ${a.articleNumber}`,
        question_count: questionCounts[a.id] || 0,
        article_id: a.id,
        has_questions: true,
      }))
      .sort(sortByArticleNumber)

    const articlesWithoutQuestions = articleRows
      .filter(a => !questionCounts[a.id])
      .map(a => ({
        article_number: a.articleNumber,
        title: a.title || `Artículo ${a.articleNumber}`,
        question_count: 0,
        article_id: a.id,
        has_questions: false,
      }))
      .sort(sortByArticleNumber)

    const articlesWithVerification = articlesWithQuestions.map(article => {
      const stats = verificationStats[article.article_id] || {
        total: 0, ok: 0, problem: 0, pending: article.question_count, lastVerified: null,
      }
      return {
        ...article,
        last_verified: stats.lastVerified,
        verified_ok: stats.ok,
        with_problems: stats.problem,
        pending: stats.pending,
      }
    })

    return NextResponse.json({
      success: true,
      articles: articlesWithVerification,
      articlesWithoutQuestions,
      total: articlesWithVerification.length,
      totalWithoutQuestions: articlesWithoutQuestions.length,
    })
  } catch (error) {
    console.error('Error en all-articles:', error)
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}
