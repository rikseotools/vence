import { NextRequest, NextResponse } from 'next/server'
import {
  getArticlesByLawAndNumbers,
  getQuestionsByArticleIds,
  getVerificationResultsByQuestionIds,
} from '@/lib/api/verify-articles/queries'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lawId = searchParams.get('lawId')
    const articlesParam = searchParams.get('articles')

    if (!lawId || !articlesParam) {
      return NextResponse.json(
        { success: false, error: 'Se requiere lawId y articles' },
        { status: 400 }
      )
    }

    const articleNumbers = [...new Set(articlesParam.split(',').map(a => a.trim()).filter(Boolean))]

    if (articleNumbers.length === 0) {
      return NextResponse.json({ success: true, summaries: {}, appliedFixes: {} })
    }

    const articleRows = await getArticlesByLawAndNumbers(lawId, articleNumbers)

    if (!articleRows || articleRows.length === 0) {
      return NextResponse.json({ success: true, summaries: {}, appliedFixes: {} })
    }

    const articleIdToNumber: Record<string, string> = {}
    const articleIds: string[] = []
    articleRows.forEach(a => {
      articleIdToNumber[a.id] = a.articleNumber
      articleIds.push(a.id)
    })

    const questionRows = await getQuestionsByArticleIds(articleIds)

    if (!questionRows || questionRows.length === 0) {
      return NextResponse.json({ success: true, summaries: {}, appliedFixes: {} })
    }

    const questionsByArticle: Record<string, string[]> = {}
    const questionIds: string[] = []
    questionRows.forEach(q => {
      const articleNumber = articleIdToNumber[q.primaryArticleId!]
      if (!articleNumber) return
      if (!questionsByArticle[articleNumber]) questionsByArticle[articleNumber] = []
      questionsByArticle[articleNumber].push(q.id)
      questionIds.push(q.id)
    })

    const verifications = await getVerificationResultsByQuestionIds(questionIds)

    const verificationMap: Record<string, typeof verifications[0]> = {}
    const appliedFixes: Record<string, boolean> = {}
    for (const v of verifications) {
      if (!verificationMap[v.questionId!]) {
        verificationMap[v.questionId!] = v
      }
      if (v.fixApplied) {
        appliedFixes[v.questionId!] = true
      }
    }

    const summaries: Record<string, { total: number; verified: number; ok: number; fixed: number; problems: number; lastVerifiedAt: string | null }> = {}
    for (const articleNumber of articleNumbers) {
      const articleQuestionIds = questionsByArticle[articleNumber] || []
      if (articleQuestionIds.length === 0) continue

      let ok = 0, fixed = 0, problems = 0, verified = 0
      let lastVerifiedAt: string | null = null

      for (const qId of articleQuestionIds) {
        const verification = verificationMap[qId]
        if (!verification) continue
        verified++

        if (verification.verifiedAt) {
          const date = new Date(verification.verifiedAt)
          if (!lastVerifiedAt || date > new Date(lastVerifiedAt)) {
            lastVerifiedAt = verification.verifiedAt
          }
        }

        if (verification.fixApplied || appliedFixes[qId]) {
          fixed++
        } else if (verification.isCorrect === true) {
          ok++
        } else if (verification.isCorrect === false) {
          problems++
        }
      }

      summaries[articleNumber] = { total: articleQuestionIds.length, verified, ok, fixed, problems, lastVerifiedAt }
    }

    return NextResponse.json({ success: true, summaries, appliedFixes })
  } catch (error) {
    console.error('Error obteniendo resúmenes de verificación:', error)
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}
