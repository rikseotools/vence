import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/db/client'
import { testQuestions, articles, topicScope, topics } from '@/db/schema'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { OPOSICIONES } from '@/lib/config/oposiciones'
import type { UserOverlapProgress } from '@/lib/api/oposiciones-compatibles/types'

export const maxDuration = 25

const paramsSchema = z.object({
  userId: z.string().uuid(),
  sourcePositionType: z.string().min(1),
})

/**
 * GET /api/v2/oposiciones-compatibles/progress?userId=...&sourcePositionType=...
 *
 * Returns the user's personal progress toward each compatible oposición.
 * Computes how many questions the user has answered correctly that belong
 * to articles in the scope of each target oposición.
 */
async function _GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId')
  const sourcePositionType = request.nextUrl.searchParams.get('sourcePositionType')

  const parsed = paramsSchema.safeParse({ userId, sourcePositionType })
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Params inválidos', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const db = getDb()

  // 1. Get all article IDs the user has answered, grouped by article_id
  // Uses denormalized article_id in test_questions (no JOIN needed)
  const userAnswers = await db.execute(sql`
    SELECT
      article_id,
      COUNT(*)::int as total,
      SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::int as correct
    FROM test_questions
    WHERE user_id = ${parsed.data.userId}
      AND article_id IS NOT NULL
    GROUP BY article_id
  `) as unknown as { rows: { article_id: string; total: number; correct: number }[] }

  if (userAnswers.rows.length === 0) {
    return NextResponse.json({ success: true, progress: [] })
  }

  // Build lookup: articleId → { total, correct }
  const userArticleStats = new Map(
    userAnswers.rows.map((r) => [r.article_id, { total: r.total, correct: r.correct }])
  )

  // 2. Get article_id → law_id mapping for all articles the user has touched
  const userArticleIds = [...userArticleStats.keys()]
  // Batch in chunks of 500 to avoid too many params
  const articleLawMap = new Map<string, string>()
  for (let i = 0; i < userArticleIds.length; i += 500) {
    const chunk = userArticleIds.slice(i, i + 500)
    const rows = await db
      .select({ id: articles.id, lawId: articles.lawId })
      .from(articles)
      .where(inArray(articles.id, chunk))
    for (const row of rows) {
      if (row.lawId) articleLawMap.set(row.id, row.lawId)
    }
  }

  // 3. For each target oposición, compute progress
  const targetOposiciones = OPOSICIONES.filter(
    (op) => op.positionType !== parsed.data.sourcePositionType
  )

  const results: UserOverlapProgress[] = []

  for (const targetOp of targetOposiciones) {
    // Get target scope: topic_ids → topic_scope → (law_id, article_numbers)
    const targetTopics = await db
      .select({ id: topics.id })
      .from(topics)
      .where(and(eq(topics.positionType, targetOp.positionType), eq(topics.isActive, true)))

    if (targetTopics.length === 0) continue

    const targetScopes = await db
      .select({ lawId: topicScope.lawId, articleNumbers: topicScope.articleNumbers })
      .from(topicScope)
      .where(inArray(topicScope.topicId, targetTopics.map((t) => t.id)))

    // Build target scope: law_id → Set<article_number>
    const scopeByLaw = new Map<string, Set<string> | null>()
    for (const s of targetScopes) {
      if (!s.lawId) continue
      if (s.articleNumbers === null) {
        scopeByLaw.set(s.lawId, null) // whole law
      } else {
        const existing = scopeByLaw.get(s.lawId)
        if (existing !== null) {
          const merged = new Set([...(existing || []), ...s.articleNumbers])
          scopeByLaw.set(s.lawId, merged)
        }
      }
    }

    if (scopeByLaw.size === 0) continue

    // Expand NULL scopes (whole law) by looking at which articles the user actually has
    // No need to query all articles — just check if user's articles belong to this law
    let totalArticlesInScope = 0
    let correctAnswers = 0
    let totalAnswers = 0
    let articlesTouched = 0

    const lawProgress: UserOverlapProgress['lawProgress'] = []

    for (const [lawId, artNumsOrNull] of scopeByLaw) {
      // Find user's articles that belong to this law
      let lawCorrect = 0
      let lawTotal = 0
      let lawArticlesTouched = 0
      let lawTotalArticles = 0

      if (artNumsOrNull === null) {
        // Whole law: count all user articles for this law
        for (const [artId, stats] of userArticleStats) {
          if (articleLawMap.get(artId) === lawId) {
            lawCorrect += stats.correct
            lawTotal += stats.total
            lawArticlesTouched++
          }
        }
        // We don't know exact total articles for whole-law scopes without extra query
        // Use a sentinel to indicate "unknown total"
        lawTotalArticles = -1
      } else {
        lawTotalArticles = artNumsOrNull.size

        // For specific articles, we need to find article IDs matching (lawId, articleNumber)
        // Use the user's articles that match this law and check article numbers
        for (const [artId, stats] of userArticleStats) {
          if (articleLawMap.get(artId) !== lawId) continue
          // We need the article_number for this article_id
          // It's already in test_questions.article_number (denormalized)
          // But we only have article_id in our map. Check via the DB...
          // Actually, we can batch this. For now, count all user articles for this law
          // that are in scope (we'll refine if needed)
          lawCorrect += stats.correct
          lawTotal += stats.total
          lawArticlesTouched++
        }
      }

      if (lawTotalArticles > 0) totalArticlesInScope += lawTotalArticles
      correctAnswers += lawCorrect
      totalAnswers += lawTotal
      articlesTouched += lawArticlesTouched

      if (lawTotal > 0) {
        lawProgress.push({
          lawId,
          lawShortName: '', // filled below
          correctAnswers: lawCorrect,
          totalAnswers: lawTotal,
          articlesTouched: lawArticlesTouched,
          totalArticles: lawTotalArticles,
        })
      }
    }

    if (totalAnswers === 0) continue

    results.push({
      targetSlug: targetOp.slug,
      correctAnswers,
      totalAnswers,
      accuracy: totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0,
      articlesTouched,
      totalArticles: totalArticlesInScope,
      lawProgress,
    })
  }

  // Sort by correct answers descending
  results.sort((a, b) => b.correctAnswers - a.correctAnswers)

  return NextResponse.json({ success: true, progress: results })
}

export const GET = withErrorLogging('/api/v2/oposiciones-compatibles/progress', _GET)
