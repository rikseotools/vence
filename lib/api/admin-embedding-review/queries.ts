// lib/api/admin-embedding-review/queries.ts - Queries para revisión de embeddings
import { getDb } from '@/db/client'
import { aiVerificationResults, questions, articles, laws, topicScope, topics } from '@/db/schema'
import { eq, and, inArray, sql } from 'drizzle-orm'

// ============================================
// GET FLAGGED QUESTIONS (article_ok = false, embedding_similarity)
// ============================================

export async function getFlaggedQuestions() {
  const db = getDb()

  // 1. Get verifications with article_ok = false from embedding_similarity
  const verifications = await db
    .select({
      id: aiVerificationResults.id,
      questionId: aiVerificationResults.questionId,
      articleOk: aiVerificationResults.articleOk,
      confidence: aiVerificationResults.confidence,
      correctArticleSuggestion: aiVerificationResults.correctArticleSuggestion,
      explanation: aiVerificationResults.explanation,
      verifiedAt: aiVerificationResults.verifiedAt,
    })
    .from(aiVerificationResults)
    .where(
      and(
        eq(aiVerificationResults.aiProvider, 'embedding_similarity'),
        eq(aiVerificationResults.articleOk, false)
      )
    )
    .orderBy(sql`${aiVerificationResults.verifiedAt} DESC`)

  if (verifications.length === 0) {
    return { questions: [], stats: { total: 0, withTopic: 0, withoutTopic: 0 } }
  }

  const questionIds = verifications.map(v => v.questionId).filter(Boolean) as string[]

  // 2. Get question data with article + law info
  const questionsData = await db
    .select({
      id: questions.id,
      questionText: questions.questionText,
      primaryArticleId: questions.primaryArticleId,
      topicReviewStatus: questions.topicReviewStatus,
      articleNumber: articles.articleNumber,
      lawShortName: laws.shortName,
    })
    .from(questions)
    .leftJoin(articles, eq(questions.primaryArticleId, articles.id))
    .leftJoin(laws, eq(articles.lawId, laws.id))
    .where(inArray(questions.id, questionIds))

  const questionMap = new Map(questionsData.map(q => [q.id, q]))

  // 3. Get topics per question via topicScope (law_id + article_numbers)
  const articlesForTopics = await db
    .select({
      questionId: questions.id,
      lawId: articles.lawId,
      articleNumber: articles.articleNumber,
    })
    .from(questions)
    .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
    .where(inArray(questions.id, questionIds))

  // For each article, find matching topicScope entries
  const topicsByQuestion = new Map<string, Array<{ topic_id: string; topic_title: string; topic_number: number | null; position: string | null }>>()

  if (articlesForTopics.length > 0) {
    const lawIds = [...new Set(articlesForTopics.map(a => a.lawId).filter(Boolean))] as string[]

    if (lawIds.length > 0) {
      const scopeData = await db
        .select({
          topicId: topicScope.topicId,
          lawId: topicScope.lawId,
          articleNumbers: topicScope.articleNumbers,
          topicTitle: topics.title,
          topicNumber: topics.topicNumber,
          positionType: topics.positionType,
        })
        .from(topicScope)
        .innerJoin(topics, eq(topicScope.topicId, topics.id))
        .where(inArray(topicScope.lawId, lawIds))

      // Match questions to topics via law_id + article_number containment
      for (const aft of articlesForTopics) {
        if (!aft.lawId || !aft.articleNumber) continue
        const matchingTopics = scopeData.filter(
          s => s.lawId === aft.lawId && s.articleNumbers?.includes(aft.articleNumber!)
        )
        if (matchingTopics.length > 0) {
          topicsByQuestion.set(
            aft.questionId,
            matchingTopics.map(t => ({
              topic_id: t.topicId ?? '',
              topic_title: t.topicTitle ?? '',
              topic_number: t.topicNumber,
              position: t.positionType,
            }))
          )
        }
      }
    }
  }

  // 4. Build response
  const result = verifications.map(v => {
    const q = v.questionId ? questionMap.get(v.questionId) : undefined
    const qTopics = v.questionId ? (topicsByQuestion.get(v.questionId) || []) : []

    let suggestedSimilarity: number | null = null
    try {
      const explanation = JSON.parse(v.explanation || '{}')
      suggestedSimilarity = explanation.suggestedSimilarity
        ? Math.round(explanation.suggestedSimilarity * 100)
        : null
    } catch {
      // Ignore parse error
    }

    const similarity = v.confidence ? Math.round(parseFloat(v.confidence)) : 0

    return {
      id: v.questionId ?? '',
      question_text: q?.questionText || 'Pregunta no encontrada',
      assigned_article: q?.lawShortName && q?.articleNumber
        ? `${q.lawShortName} Art. ${q.articleNumber}`
        : 'N/A',
      similarity,
      suggested_article: v.correctArticleSuggestion || null,
      suggested_similarity: suggestedSimilarity,
      topics: qTopics,
      verified_at: v.verifiedAt,
      topic_review_status: q?.topicReviewStatus ?? null,
    }
  })

  const withTopic = result.filter(r => r.topics.length > 0).length
  const withoutTopic = result.filter(r => r.topics.length === 0).length

  return {
    questions: result,
    stats: { total: result.length, withTopic, withoutTopic },
  }
}

// ============================================
// MARK AS CORRECT
// ============================================

export async function markCorrect(questionId: string) {
  const db = getDb()

  await db
    .update(aiVerificationResults)
    .set({
      articleOk: true,
      verifiedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(aiVerificationResults.questionId, questionId),
        eq(aiVerificationResults.aiProvider, 'embedding_similarity')
      )
    )

  // Clear topic_review_status if it was wrong_article
  await db
    .update(questions)
    .set({
      topicReviewStatus: null,
      verificationStatus: null,
    })
    .where(
      and(
        eq(questions.id, questionId),
        eq(questions.topicReviewStatus, 'wrong_article')
      )
    )
}

// ============================================
// MARK NEEDS LLM REVIEW
// ============================================

export async function markNeedsReview(questionId: string) {
  const db = getDb()

  await db
    .update(questions)
    .set({
      topicReviewStatus: 'wrong_article',
      verificationStatus: 'needs_llm_review',
    })
    .where(eq(questions.id, questionId))
}
