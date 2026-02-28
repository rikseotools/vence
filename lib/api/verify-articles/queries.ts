// lib/api/verify-articles/queries.ts - Queries Drizzle para verificación de artículos
import { getDb } from '@/db/client'
import {
  articles,
  laws,
  questions,
  aiVerificationResults,
  aiVerificationErrors,
  aiApiUsage,
  aiApiConfig,
  articleUpdateLogs,
  verificationQueue,
  topicScope,
  topics,
} from '@/db/schema'
import { eq, and, inArray, desc, sql } from 'drizzle-orm'

// ============================================
// LAW QUERIES
// ============================================

export async function getLawById(lawId: string) {
  const db = getDb()
  const result = await db
    .select({
      id: laws.id,
      shortName: laws.shortName,
      name: laws.name,
      boeUrl: laws.boeUrl,
    })
    .from(laws)
    .where(eq(laws.id, lawId))
    .limit(1)

  return result[0] ?? null
}

export async function getLawByShortName(shortName: string) {
  const db = getDb()
  const result = await db
    .select({
      id: laws.id,
      shortName: laws.shortName,
      name: laws.name,
      boeUrl: laws.boeUrl,
    })
    .from(laws)
    .where(sql`${laws.shortName} ILIKE ${'%' + shortName + '%'}`)
    .limit(1)

  return result[0] ?? null
}

export async function getAllLawsWithVerification() {
  const db = getDb()
  return db
    .select({
      id: laws.id,
      shortName: laws.shortName,
      lastChecked: laws.lastChecked,
      verificationStatus: laws.verificationStatus,
      lastVerificationSummary: laws.lastVerificationSummary,
    })
    .from(laws)
}

export async function updateLawVerification(lawId: string, summary: Record<string, unknown>) {
  const db = getDb()
  await db
    .update(laws)
    .set({
      lastChecked: new Date().toISOString(),
      lastVerificationSummary: summary,
    })
    .where(eq(laws.id, lawId))
}

// ============================================
// ARTICLE QUERIES
// ============================================

export async function getArticleByLawAndNumber(lawId: string, articleNumber: string) {
  const db = getDb()
  const result = await db
    .select({
      id: articles.id,
      articleNumber: articles.articleNumber,
      title: articles.title,
      content: articles.content,
    })
    .from(articles)
    .where(and(eq(articles.lawId, lawId), eq(articles.articleNumber, articleNumber)))
    .limit(1)

  return result[0] ?? null
}

export async function getActiveArticlesByLaw(lawId: string) {
  const db = getDb()
  return db
    .select({
      id: articles.id,
      articleNumber: articles.articleNumber,
      title: articles.title,
      content: articles.content,
    })
    .from(articles)
    .where(and(eq(articles.lawId, lawId), eq(articles.isActive, true)))
    .orderBy(articles.articleNumber)
}

export async function getArticleIdsByLaw(lawId: string) {
  const db = getDb()
  return db
    .select({
      id: articles.id,
      articleNumber: articles.articleNumber,
      title: articles.title,
    })
    .from(articles)
    .where(and(eq(articles.lawId, lawId), eq(articles.isActive, true)))
    .orderBy(articles.articleNumber)
}

export async function getArticlesByLawAndNumbers(lawId: string, articleNumbers: string[]) {
  const db = getDb()
  return db
    .select({
      id: articles.id,
      articleNumber: articles.articleNumber,
    })
    .from(articles)
    .where(and(eq(articles.lawId, lawId), inArray(articles.articleNumber, articleNumbers)))
}

export async function getExistingArticleNumbers(lawId: string) {
  const db = getDb()
  const result = await db
    .select({ articleNumber: articles.articleNumber })
    .from(articles)
    .where(and(eq(articles.lawId, lawId), eq(articles.isActive, true)))

  return result.map(a => a.articleNumber)
}

export async function insertArticles(
  articleData: {
    lawId: string
    articleNumber: string
    title: string | null
    content: string
    contentHash: string
    isActive: boolean
    isVerified: boolean
    verificationDate: string
    lastModificationDate: string
    createdAt: string
    updatedAt: string
  }[]
) {
  const db = getDb()
  return db.insert(articles).values(articleData).returning({
    id: articles.id,
    articleNumber: articles.articleNumber,
    title: articles.title,
  })
}

export async function updateArticle(
  articleId: string,
  data: { title?: string | null; content?: string; updatedAt?: string }
) {
  const db = getDb()
  await db.update(articles).set(data).where(eq(articles.id, articleId))
}

// ============================================
// QUESTION QUERIES
// ============================================

export async function getQuestionById(questionId: string) {
  const db = getDb()
  const result = await db
    .select({
      id: questions.id,
      questionText: questions.questionText,
      optionA: questions.optionA,
      optionB: questions.optionB,
      optionC: questions.optionC,
      optionD: questions.optionD,
      correctOption: questions.correctOption,
      explanation: questions.explanation,
    })
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1)

  return result[0] ?? null
}

export async function getActiveQuestionsByArticleId(articleId: string, questionIds?: string[] | null) {
  const db = getDb()
  const conditions = [eq(questions.primaryArticleId, articleId), eq(questions.isActive, true)]

  if (questionIds && questionIds.length > 0) {
    conditions.push(inArray(questions.id, questionIds))
  }

  return db
    .select({
      id: questions.id,
      questionText: questions.questionText,
      optionA: questions.optionA,
      optionB: questions.optionB,
      optionC: questions.optionC,
      optionD: questions.optionD,
      correctOption: questions.correctOption,
      explanation: questions.explanation,
    })
    .from(questions)
    .where(and(...conditions))
}

export async function getQuestionsByArticleIds(articleIds: string[]) {
  const db = getDb()
  return db
    .select({
      id: questions.id,
      primaryArticleId: questions.primaryArticleId,
      verifiedAt: questions.verifiedAt,
      verificationStatus: questions.verificationStatus,
    })
    .from(questions)
    .where(and(inArray(questions.primaryArticleId, articleIds), eq(questions.isActive, true)))
}

export async function countActiveQuestionsByArticle(articleId: string) {
  const db = getDb()
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(questions)
    .where(and(eq(questions.primaryArticleId, articleId), eq(questions.isActive, true)))

  return result[0]?.count ?? 0
}

export async function updateQuestion(
  questionId: string,
  data: {
    correctOption?: number
    explanation?: string
    updatedAt?: string
    verifiedAt?: string
    verificationStatus?: string | null
  }
) {
  const db = getDb()
  await db.update(questions).set(data).where(eq(questions.id, questionId))
}

export async function getQuestionsByArticleForDisplay(articleId: string) {
  const db = getDb()
  return db
    .select({
      id: questions.id,
      questionText: questions.questionText,
      optionA: questions.optionA,
      optionB: questions.optionB,
      optionC: questions.optionC,
      optionD: questions.optionD,
      correctOption: questions.correctOption,
      explanation: questions.explanation,
      isOfficialExam: questions.isOfficialExam,
      difficulty: questions.difficulty,
    })
    .from(questions)
    .where(and(eq(questions.primaryArticleId, articleId), eq(questions.isActive, true)))
    .limit(50)
}

// ============================================
// AI VERIFICATION RESULTS
// ============================================

export async function upsertVerificationResult(data: {
  questionId: string
  articleId: string
  lawId: string
  isCorrect: boolean | null
  confidence: string | null
  explanation: string | null
  articleQuote: string | null
  suggestedFix: string | null
  correctOptionShouldBe: string | null
  newExplanation?: string | null
  aiProvider: string
  aiModel: string
  verifiedAt: string
}) {
  const db = getDb()
  await db
    .insert(aiVerificationResults)
    .values(data)
    .onConflictDoUpdate({
      target: [aiVerificationResults.questionId, aiVerificationResults.aiProvider],
      set: {
        isCorrect: data.isCorrect,
        confidence: data.confidence,
        explanation: data.explanation,
        articleQuote: data.articleQuote,
        suggestedFix: data.suggestedFix,
        correctOptionShouldBe: data.correctOptionShouldBe,
        newExplanation: data.newExplanation,
        aiModel: data.aiModel,
        verifiedAt: data.verifiedAt,
      },
    })
}

export async function getVerificationResultsByArticle(articleId: string) {
  const db = getDb()
  return db
    .select()
    .from(aiVerificationResults)
    .where(eq(aiVerificationResults.articleId, articleId))
    .orderBy(desc(aiVerificationResults.verifiedAt))
}

export async function getVerificationResultsByQuestionIds(questionIds: string[]) {
  const db = getDb()
  return db
    .select({
      questionId: aiVerificationResults.questionId,
      isCorrect: aiVerificationResults.isCorrect,
      fixApplied: aiVerificationResults.fixApplied,
      verifiedAt: aiVerificationResults.verifiedAt,
    })
    .from(aiVerificationResults)
    .where(inArray(aiVerificationResults.questionId, questionIds))
    .orderBy(desc(aiVerificationResults.verifiedAt))
}

export async function updateVerificationDiscard(questionId: string, discarded: boolean) {
  const db = getDb()
  return db
    .update(aiVerificationResults)
    .set({
      discarded,
      discardedAt: discarded ? new Date().toISOString() : null,
    })
    .where(eq(aiVerificationResults.questionId, questionId))
    .returning()
}

export async function markVerificationFixApplied(verificationId: string) {
  const db = getDb()
  await db
    .update(aiVerificationResults)
    .set({
      fixApplied: true,
      fixAppliedAt: new Date().toISOString(),
    })
    .where(eq(aiVerificationResults.id, verificationId))
}

// ============================================
// AI VERIFICATION ERRORS
// ============================================

export async function logVerificationError(data: {
  lawId: string
  articleNumber: string
  provider: string
  model: string
  prompt?: string
  rawResponse?: string
  errorMessage: string
  errorType: string
  questionsCount: number
  tokensUsed?: Record<string, unknown>
}) {
  const db = getDb()
  await db.insert(aiVerificationErrors).values({
    ...data,
    prompt: data.prompt?.substring(0, 50000),
    rawResponse: data.rawResponse?.substring(0, 50000),
  })
}

export async function getVerificationErrors(lawId: string, limit: number, articleList?: string[]) {
  const db = getDb()
  const conditions = [eq(aiVerificationErrors.lawId, lawId)]

  if (articleList && articleList.length > 0) {
    conditions.push(inArray(aiVerificationErrors.articleNumber, articleList))
  }

  return db
    .select()
    .from(aiVerificationErrors)
    .where(and(...conditions))
    .orderBy(desc(aiVerificationErrors.createdAt))
    .limit(limit)
}

// ============================================
// AI API USAGE
// ============================================

export async function logApiUsage(data: {
  provider: string
  model: string
  endpoint: string
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  feature: string
  lawId: string
  articleNumber: string
  questionsCount: number
}) {
  const db = getDb()
  await db.insert(aiApiUsage).values(data)
}

// ============================================
// AI API CONFIG
// ============================================

export async function getAiApiConfig(provider: string) {
  const db = getDb()
  const result = await db
    .select({
      apiKeyEncrypted: aiApiConfig.apiKeyEncrypted,
      defaultModel: aiApiConfig.defaultModel,
      isActive: aiApiConfig.isActive,
    })
    .from(aiApiConfig)
    .where(eq(aiApiConfig.provider, provider))
    .limit(1)

  return result[0] ?? null
}

// ============================================
// ARTICLE UPDATE LOGS
// ============================================

export async function insertArticleUpdateLog(data: {
  lawId: string
  articleId: string
  articleNumber: string
  oldTitle?: string | null
  newTitle?: string | null
  changeType: string
  source: string
}) {
  const db = getDb()
  await db.insert(articleUpdateLogs).values(data)
}

export async function getArticleUpdateLogs(lawId: string, limit = 100) {
  const db = getDb()
  return db
    .select()
    .from(articleUpdateLogs)
    .where(eq(articleUpdateLogs.lawId, lawId))
    .orderBy(desc(articleUpdateLogs.createdAt))
    .limit(limit)
}

// ============================================
// VERIFICATION QUEUE
// ============================================

export async function getVerificationQueueEntries(
  filters: { topicId?: string; status?: string }
) {
  const db = getDb()
  const conditions: ReturnType<typeof eq>[] = []

  if (filters.topicId) {
    conditions.push(eq(verificationQueue.topicId, filters.topicId))
  }

  if (filters.status) {
    conditions.push(eq(verificationQueue.status, filters.status))
  } else {
    conditions.push(inArray(verificationQueue.status, ['pending', 'processing']))
  }

  return db
    .select()
    .from(verificationQueue)
    .where(conditions.length > 1 ? and(...conditions) : conditions[0])
    .orderBy(desc(verificationQueue.createdAt))
    .limit(50)
}

export async function getExistingQueueEntry(topicId: string) {
  const db = getDb()
  const result = await db
    .select({ id: verificationQueue.id, status: verificationQueue.status })
    .from(verificationQueue)
    .where(
      and(
        eq(verificationQueue.topicId, topicId),
        inArray(verificationQueue.status, ['pending', 'processing'])
      )
    )
    .limit(1)

  return result[0] ?? null
}

export async function insertQueueEntry(data: {
  topicId: string
  aiProvider: string
  aiModel: string
  questionIds: string[]
  totalQuestions: number
  status: string
}) {
  const db = getDb()
  const result = await db
    .insert(verificationQueue)
    .values(data)
    .returning()

  return result[0] ?? null
}

export async function cancelQueueEntry(id: string) {
  const db = getDb()
  const result = await db
    .update(verificationQueue)
    .set({ status: 'cancelled' })
    .where(and(eq(verificationQueue.id, id), eq(verificationQueue.status, 'pending')))
    .returning()

  return result[0] ?? null
}

// ============================================
// TOPIC QUERIES
// ============================================

export async function getTopicById(topicId: string) {
  const db = getDb()
  const result = await db
    .select({
      id: topics.id,
      title: topics.title,
      topicNumber: topics.topicNumber,
    })
    .from(topics)
    .where(eq(topics.id, topicId))
    .limit(1)

  return result[0] ?? null
}

export async function getTopicScopesByTopic(topicId: string) {
  const db = getDb()
  return db
    .select({
      articleNumbers: topicScope.articleNumbers,
      lawId: topicScope.lawId,
    })
    .from(topicScope)
    .where(eq(topicScope.topicId, topicId))
}
