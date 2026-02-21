// lib/api/topic-review/queries.ts - Queries tipadas para revisión de temas
import { getDb } from '@/db/client'
import {
  topics, topicScope, laws, articles, questions,
  psychometricCategories, psychometricQuestions,
  aiVerificationResults,
} from '@/db/schema'
import { eq, and, inArray, isNotNull, sql } from 'drizzle-orm'
import { getOposicionByPositionType } from '@/lib/config/oposiciones'
import {
  type ReviewStats,
  type TopicWithStats,
  type TopicBlock,
  createEmptyStats,
} from './schemas'

// ============================================
// HELPERS
// ============================================

function isVirtualLaw(description: string | null): boolean {
  return description?.toLowerCase().includes('ficticia') ?? false
}

/**
 * Calcula stats de revisión a partir de un array de preguntas con sus campos de verificación.
 */
function computeStats(rows: {
  topicReviewStatus: string | null
  verifiedAt: string | null
  verificationStatus: string | null
}[]): ReviewStats {
  const stats = createEmptyStats()
  stats.total_questions = rows.length

  for (const q of rows) {
    const status = q.topicReviewStatus

    if (status && status !== 'pending') {
      stats.verified++
      const numericStats = stats as unknown as Record<string, number>
      if (status in numericStats && status !== 'total_questions' && status !== 'verified' && status !== 'last_verified_at') {
        numericStats[status]++
      }
    } else if (q.verifiedAt) {
      stats.verified++
      if (q.verificationStatus === 'ok') {
        stats.perfect++
      } else if (q.verificationStatus === 'problem') {
        stats.bad_answer++
      }
    } else {
      stats.pending++
    }

    if (q.verifiedAt) {
      const d = new Date(q.verifiedAt)
      if (!stats.last_verified_at || d > new Date(stats.last_verified_at)) {
        stats.last_verified_at = q.verifiedAt
      }
    }
  }

  return stats
}

/**
 * Deriva review_status combinando topic_review_status, ai_verification, y verified_at.
 * Replica la lógica completa de [topicId]/route.js L148-183.
 */
function deriveReviewStatus(
  topicReviewStatus: string | null,
  verifiedAt: string | null,
  verificationStatus: string | null,
  aiV: {
    discarded: boolean | null
    fixApplied: boolean | null
    articleOk: boolean | null
    answerOk: boolean | null
    explanationOk: boolean | null
    isCorrect: boolean | null
  } | null,
): string {
  let reviewStatus = topicReviewStatus || 'pending'

  if (!topicReviewStatus && aiV) {
    if (aiV.discarded || aiV.fixApplied) {
      reviewStatus = 'perfect'
    } else if (aiV.articleOk !== null && aiV.articleOk !== undefined) {
      const articleOk = aiV.articleOk === true
      const answerOk = aiV.answerOk === true
      const explanationOk = aiV.explanationOk === true

      if (articleOk) {
        if (answerOk && explanationOk) reviewStatus = 'perfect'
        else if (answerOk && !explanationOk) reviewStatus = 'bad_explanation'
        else if (!answerOk && explanationOk) reviewStatus = 'bad_answer'
        else reviewStatus = 'bad_answer_and_explanation'
      } else {
        if (answerOk && explanationOk) reviewStatus = 'wrong_article'
        else if (answerOk && !explanationOk) reviewStatus = 'wrong_article_bad_explanation'
        else if (!answerOk && explanationOk) reviewStatus = 'wrong_article_bad_answer'
        else reviewStatus = 'all_wrong'
      }
    } else if (aiV.isCorrect !== null && aiV.isCorrect !== undefined) {
      reviewStatus = aiV.isCorrect === true ? 'perfect' : 'bad_answer'
    }
  } else if (!topicReviewStatus && verifiedAt) {
    reviewStatus = verificationStatus === 'ok' ? 'perfect'
      : verificationStatus === 'problem' ? 'bad_answer' : 'pending'
  }

  return reviewStatus
}

// ============================================
// 1. getPositions()
// ============================================

export async function getPositions(): Promise<string[]> {
  const db = getDb()

  const rows = await db
    .selectDistinct({ positionType: topics.positionType })
    .from(topics)
    .where(isNotNull(topics.positionType))

  const positionTypes = rows.map(r => r.positionType)
  // Siempre añadir psicotécnicos
  return [...positionTypes, 'psicotecnicos']
}

// ============================================
// 2. getTopicsWithStats()
// ============================================

export async function getTopicsWithStats(positionType: string): Promise<TopicWithStats[]> {
  const db = getDb()

  // 1. Todos los topics de esta oposición
  const topicRows = await db
    .select({
      id: topics.id,
      topicNumber: topics.topicNumber,
      title: topics.title,
      description: topics.description,
      positionType: topics.positionType,
      isActive: topics.isActive,
    })
    .from(topics)
    .where(and(
      eq(topics.positionType, positionType),
      eq(topics.isActive, true),
    ))
    .orderBy(topics.topicNumber)

  if (topicRows.length === 0) return []

  const topicIds = topicRows.map(t => t.id)

  // 2. Todos los topic_scope con JOIN a laws para esos topics
  const scopeRows = await db
    .select({
      topicId: topicScope.topicId,
      articleNumbers: topicScope.articleNumbers,
      lawId: laws.id,
      lawShortName: laws.shortName,
      lawName: laws.name,
      lawDescription: laws.description,
    })
    .from(topicScope)
    .innerJoin(laws, eq(topicScope.lawId, laws.id))
    .where(inArray(topicScope.topicId, topicIds))

  // Agrupar scopes por topic
  const scopesByTopic = new Map<string, typeof scopeRows>()
  for (const s of scopeRows) {
    const tid = s.topicId!
    if (!scopesByTopic.has(tid)) scopesByTopic.set(tid, [])
    scopesByTopic.get(tid)!.push(s)
  }

  // 3. Recopilar todos los pares (lawId, articleNumbers) para obtener artículos
  // Creamos una lista de {lawId, articleNumbers} para batch query
  const articleQueries: { lawId: string; articleNumbers: string[] }[] = []
  for (const s of scopeRows) {
    if (s.lawId && s.articleNumbers?.length) {
      articleQueries.push({ lawId: s.lawId, articleNumbers: s.articleNumbers })
    }
  }

  // Obtener TODOS los artículos de todas las leyes involucradas de golpe
  // Usamos: lawId IN (...) para obtener todos, luego filtramos en JS
  const uniqueLawIds = [...new Set(articleQueries.map(q => q.lawId))]
  let allArticleRows: { id: string; lawId: string | null; articleNumber: string }[] = []

  if (uniqueLawIds.length > 0) {
    allArticleRows = await db
      .select({
        id: articles.id,
        lawId: articles.lawId,
        articleNumber: articles.articleNumber,
      })
      .from(articles)
      .where(inArray(articles.lawId, uniqueLawIds))
  }

  // Mapa: lawId → Map<articleNumber, articleId>
  const articlesByLaw = new Map<string, Map<string, string>>()
  for (const a of allArticleRows) {
    if (!a.lawId) continue
    if (!articlesByLaw.has(a.lawId)) articlesByLaw.set(a.lawId, new Map())
    articlesByLaw.get(a.lawId)!.set(a.articleNumber, a.id)
  }

  // Resolver articleIds por topic
  const articleIdsByTopic = new Map<string, string[]>()
  for (const [topicId, scopes] of scopesByTopic) {
    const ids: string[] = []
    for (const s of scopes) {
      if (!s.lawId || !s.articleNumbers?.length) continue
      const lawArticles = articlesByLaw.get(s.lawId)
      if (!lawArticles) continue
      for (const num of s.articleNumbers) {
        const artId = lawArticles.get(num)
        if (artId) ids.push(artId)
      }
    }
    articleIdsByTopic.set(topicId, ids)
  }

  // 4. Obtener TODAS las preguntas para todos los articleIds
  const allArticleIds = [...new Set([...articleIdsByTopic.values()].flat())]
  let allQuestionRows: {
    id: string
    primaryArticleId: string
    topicReviewStatus: string | null
    verifiedAt: string | null
    verificationStatus: string | null
  }[] = []

  if (allArticleIds.length > 0) {
    allQuestionRows = await db
      .select({
        id: questions.id,
        primaryArticleId: questions.primaryArticleId,
        topicReviewStatus: questions.topicReviewStatus,
        verifiedAt: questions.verifiedAt,
        verificationStatus: questions.verificationStatus,
      })
      .from(questions)
      .where(and(
        inArray(questions.primaryArticleId, allArticleIds),
        eq(questions.isActive, true),
      ))
  }

  // Mapa: articleId → questions[]
  const questionsByArticle = new Map<string, typeof allQuestionRows>()
  for (const q of allQuestionRows) {
    if (!questionsByArticle.has(q.primaryArticleId)) questionsByArticle.set(q.primaryArticleId, [])
    questionsByArticle.get(q.primaryArticleId)!.push(q)
  }

  // 5. Ensamblar resultados
  return topicRows.map(topic => {
    const scopes = scopesByTopic.get(topic.id) || []

    const hasVirtualLaws = scopes.some(s => isVirtualLaw(s.lawDescription))

    // Calcular stats
    const topicArticleIds = articleIdsByTopic.get(topic.id) || []
    const topicQuestions: typeof allQuestionRows = []
    for (const artId of topicArticleIds) {
      const qs = questionsByArticle.get(artId)
      if (qs) topicQuestions.push(...qs)
    }
    const stats = computeStats(topicQuestions)

    // Formatear leyes
    const lawsForTopic = scopes
      .filter(s => s.lawId)
      .map(s => ({
        id: s.lawId!,
        short_name: s.lawShortName,
        name: s.lawName,
        is_virtual: isVirtualLaw(s.lawDescription),
        article_numbers: s.articleNumbers,
      }))

    return {
      id: topic.id,
      topic_number: topic.topicNumber,
      title: topic.title,
      description: topic.description,
      position_type: topic.positionType,
      is_active: topic.isActive,
      stats,
      laws: lawsForTopic,
      hasVirtualLaws,
    }
  })
}

// ============================================
// 3. groupTopicsIntoBlocks()
// ============================================

export function groupTopicsIntoBlocks(positionType: string, topicsArr: TopicWithStats[]): TopicBlock[] {
  const oposicion = getOposicionByPositionType(positionType)

  if (!oposicion) {
    // Fallback: un solo bloque con todos los temas
    return [{
      id: 'block1',
      title: 'Todos los temas',
      topics: topicsArr,
    }]
  }

  return oposicion.blocks.map(block => {
    const themeNumbers = new Set(block.themes.map(t => t.id))
    return {
      id: block.id,
      title: block.title,
      topics: topicsArr.filter(t => themeNumbers.has(t.topic_number)),
    }
  })
}

// ============================================
// 4. getPsychometricTopics()
// ============================================

export async function getPsychometricTopics(): Promise<TopicBlock[]> {
  const db = getDb()

  // 1. Categorías activas
  const categoryRows = await db
    .select({
      id: psychometricCategories.id,
      displayOrder: psychometricCategories.displayOrder,
      displayName: psychometricCategories.displayName,
      description: psychometricCategories.description,
      isActive: psychometricCategories.isActive,
    })
    .from(psychometricCategories)
    .where(eq(psychometricCategories.isActive, true))
    .orderBy(psychometricCategories.displayOrder)

  if (categoryRows.length === 0) return []

  const categoryIds = categoryRows.map(c => c.id)

  // 2. Preguntas agrupadas por categoría
  const questionRows = await db
    .select({
      categoryId: psychometricQuestions.categoryId,
      isVerified: psychometricQuestions.isVerified,
    })
    .from(psychometricQuestions)
    .where(and(
      inArray(psychometricQuestions.categoryId, categoryIds),
      eq(psychometricQuestions.isActive, true),
    ))

  // Agrupar
  const questionsByCategory = new Map<string, { total: number; verified: number }>()
  for (const q of questionRows) {
    if (!questionsByCategory.has(q.categoryId)) {
      questionsByCategory.set(q.categoryId, { total: 0, verified: 0 })
    }
    const entry = questionsByCategory.get(q.categoryId)!
    entry.total++
    if (q.isVerified) entry.verified++
  }

  const categoriesAsTopics: TopicWithStats[] = categoryRows.map(cat => {
    const qStats = questionsByCategory.get(cat.id) || { total: 0, verified: 0 }
    return {
      id: cat.id,
      topic_number: cat.displayOrder ?? 0,
      title: cat.displayName,
      description: cat.description,
      position_type: 'psicotecnicos',
      is_active: cat.isActive,
      stats: {
        ...createEmptyStats(),
        total_questions: qStats.total,
        verified: qStats.verified,
        pending: qStats.total - qStats.verified,
        tech_perfect: qStats.verified,
      },
      laws: [],
      hasVirtualLaws: true,
    }
  })

  return [{
    id: 'psychometric',
    title: '🧠 Pruebas Psicotécnicas',
    topics: categoriesAsTopics,
  }]
}

// ============================================
// 5. getTopicQuestions()
// ============================================

export async function getTopicQuestions(topicId: string): Promise<{
  success: true
  topic: { id: string; title: string; topic_number: number }
  questions: {
    id: string
    question_text: string
    topic_review_status: string
    verified_at: string | null
    verification_status: string | null
    primary_article_id: string | null
  }[]
} | { success: false; error: string; status: number }> {
  const db = getDb()

  // Primero intentar si es categoría psicotécnica
  const psychoRows = await db
    .select({
      id: psychometricCategories.id,
      displayName: psychometricCategories.displayName,
      categoryKey: psychometricCategories.categoryKey,
    })
    .from(psychometricCategories)
    .where(eq(psychometricCategories.id, topicId))
    .limit(1)

  if (psychoRows.length > 0) {
    const cat = psychoRows[0]

    const psychoQuestionRows = await db
      .select({
        id: psychometricQuestions.id,
        questionText: psychometricQuestions.questionText,
        isVerified: psychometricQuestions.isVerified,
      })
      .from(psychometricQuestions)
      .where(and(
        eq(psychometricQuestions.categoryId, topicId),
        eq(psychometricQuestions.isActive, true),
      ))
      .orderBy(psychometricQuestions.createdAt)

    return {
      success: true,
      topic: {
        id: cat.id,
        title: cat.displayName,
        topic_number: 0,
      },
      questions: psychoQuestionRows.map(q => ({
        id: q.id,
        question_text: q.questionText,
        topic_review_status: q.isVerified ? 'tech_perfect' : 'pending',
        verified_at: q.isVerified ? new Date().toISOString() : null,
        verification_status: q.isVerified ? 'ok' : null,
        primary_article_id: null,
      })),
    }
  }

  // Topic normal
  const topicRows = await db
    .select({
      id: topics.id,
      title: topics.title,
      topicNumber: topics.topicNumber,
    })
    .from(topics)
    .where(eq(topics.id, topicId))
    .limit(1)

  if (topicRows.length === 0) {
    return { success: false, error: 'Tema no encontrado', status: 404 }
  }

  const topic = topicRows[0]

  // Obtener scope
  const scopeRows = await db
    .select({
      articleNumbers: topicScope.articleNumbers,
      lawId: laws.id,
    })
    .from(topicScope)
    .innerJoin(laws, eq(topicScope.lawId, laws.id))
    .where(eq(topicScope.topicId, topicId))

  // Obtener artículos
  let allArticleIds: string[] = []
  for (const scope of scopeRows) {
    if (!scope.lawId || !scope.articleNumbers?.length) continue

    const artRows = await db
      .select({ id: articles.id })
      .from(articles)
      .where(and(
        eq(articles.lawId, scope.lawId),
        inArray(articles.articleNumber, scope.articleNumbers),
      ))

    allArticleIds.push(...artRows.map(a => a.id))
  }

  if (allArticleIds.length === 0) {
    return {
      success: true,
      topic: { id: topic.id, title: topic.title, topic_number: topic.topicNumber },
      questions: [],
    }
  }

  // Obtener preguntas
  const questionRows = await db
    .select({
      id: questions.id,
      questionText: questions.questionText,
      topicReviewStatus: questions.topicReviewStatus,
      verifiedAt: questions.verifiedAt,
      verificationStatus: questions.verificationStatus,
      primaryArticleId: questions.primaryArticleId,
    })
    .from(questions)
    .where(and(
      inArray(questions.primaryArticleId, allArticleIds),
      eq(questions.isActive, true),
    ))
    .orderBy(questions.createdAt)

  return {
    success: true,
    topic: { id: topic.id, title: topic.title, topic_number: topic.topicNumber },
    questions: questionRows.map(q => ({
      id: q.id,
      question_text: q.questionText,
      topic_review_status: q.topicReviewStatus || 'pending',
      verified_at: q.verifiedAt,
      verification_status: q.verificationStatus,
      primary_article_id: q.primaryArticleId,
    })),
  }
}

// ============================================
// 6. getTopicDetail()
// ============================================

export async function getTopicDetail(topicId: string) {
  const db = getDb()

  // 1. Obtener el tema
  const topicRows = await db
    .select({
      id: topics.id,
      topicNumber: topics.topicNumber,
      title: topics.title,
      description: topics.description,
      positionType: topics.positionType,
    })
    .from(topics)
    .where(eq(topics.id, topicId))
    .limit(1)

  if (topicRows.length === 0) {
    return { success: false as const, error: 'Tema no encontrado', status: 404 }
  }

  const topic = topicRows[0]

  // 2. Obtener topic_scope con leyes
  const scopeRows = await db
    .select({
      id: topicScope.id,
      articleNumbers: topicScope.articleNumbers,
      titleNumbers: topicScope.titleNumbers,
      chapterNumbers: topicScope.chapterNumbers,
      lawId: laws.id,
      lawShortName: laws.shortName,
      lawName: laws.name,
      lawBoeUrl: laws.boeUrl,
      lawDescription: laws.description,
    })
    .from(topicScope)
    .innerJoin(laws, eq(topicScope.lawId, laws.id))
    .where(eq(topicScope.topicId, topicId))

  // 3. Para cada ley/scope, obtener artículos
  const lawsResult = await Promise.all(
    scopeRows.map(async (scope) => {
      const articleNumbers = scope.articleNumbers || []

      // Obtener artículos de esta ley en el scope
      const articleRows = articleNumbers.length > 0
        ? await db
          .select({
            id: articles.id,
            articleNumber: articles.articleNumber,
            title: articles.title,
            content: articles.content,
          })
          .from(articles)
          .where(and(
            eq(articles.lawId, scope.lawId),
            inArray(articles.articleNumber, articleNumbers),
          ))
          .orderBy(articles.articleNumber)
        : []

      if (articleRows.length === 0) {
        return {
          id: scope.lawId,
          short_name: scope.lawShortName,
          name: scope.lawName,
          boe_url: scope.lawBoeUrl,
          is_virtual: isVirtualLaw(scope.lawDescription),
          articles: [],
          stats: {
            total_articles: 0,
            total_questions: 0,
            perfect: 0, bad_explanation: 0, bad_answer: 0, bad_answer_and_explanation: 0,
            wrong_article: 0, wrong_article_bad_explanation: 0, wrong_article_bad_answer: 0, all_wrong: 0,
            tech_perfect: 0, tech_bad_explanation: 0, tech_bad_answer: 0, tech_bad_answer_and_explanation: 0,
            pending: 0,
          },
        }
      }

      const articleIds = articleRows.map(a => a.id)

      // 4. Obtener preguntas de todos los artículos de esta ley
      const questionRows = await db
        .select({
          id: questions.id,
          questionText: questions.questionText,
          optionA: questions.optionA,
          optionB: questions.optionB,
          optionC: questions.optionC,
          optionD: questions.optionD,
          correctOption: questions.correctOption,
          explanation: questions.explanation,
          verifiedAt: questions.verifiedAt,
          verificationStatus: questions.verificationStatus,
          topicReviewStatus: questions.topicReviewStatus,
          isOfficialExam: questions.isOfficialExam,
          primaryArticleId: questions.primaryArticleId,
        })
        .from(questions)
        .where(and(
          inArray(questions.primaryArticleId, articleIds),
          eq(questions.isActive, true),
        ))
        .orderBy(questions.createdAt)

      // 5. Obtener verificaciones IA
      const questionIds = questionRows.map(q => q.id)
      let aiVerificationsMap: Record<string, {
        questionId: string | null
        isCorrect: boolean | null
        confidence: string | null
        explanation: string | null
        articleQuote: string | null
        suggestedFix: string | null
        correctOptionShouldBe: string | null
        verifiedAt: string | null
        fixApplied: boolean | null
        discarded: boolean | null
        articleOk: boolean | null
        answerOk: boolean | null
        explanationOk: boolean | null
      }> = {}

      if (questionIds.length > 0) {
        const verificationRows = await db
          .select({
            questionId: aiVerificationResults.questionId,
            isCorrect: aiVerificationResults.isCorrect,
            confidence: aiVerificationResults.confidence,
            explanation: aiVerificationResults.explanation,
            articleQuote: aiVerificationResults.articleQuote,
            suggestedFix: aiVerificationResults.suggestedFix,
            correctOptionShouldBe: aiVerificationResults.correctOptionShouldBe,
            verifiedAt: aiVerificationResults.verifiedAt,
            fixApplied: aiVerificationResults.fixApplied,
            discarded: aiVerificationResults.discarded,
            articleOk: aiVerificationResults.articleOk,
            answerOk: aiVerificationResults.answerOk,
            explanationOk: aiVerificationResults.explanationOk,
          })
          .from(aiVerificationResults)
          .where(inArray(aiVerificationResults.questionId, questionIds))

        for (const v of verificationRows) {
          if (v.questionId) {
            aiVerificationsMap[v.questionId] = v
          }
        }
      }

      // Agrupar preguntas por artículo
      const questionsByArticleId = new Map<string, typeof questionRows>()
      for (const q of questionRows) {
        if (!questionsByArticleId.has(q.primaryArticleId)) {
          questionsByArticleId.set(q.primaryArticleId, [])
        }
        questionsByArticleId.get(q.primaryArticleId)!.push(q)
      }

      // Ensamblar artículos con preguntas y stats
      const articlesWithQuestions = articleRows.map(article => {
        const artQuestions = questionsByArticleId.get(article.id) || []

        const questionsWithVerification = artQuestions.map(q => {
          const aiV = aiVerificationsMap[q.id] || null
          const reviewStatus = deriveReviewStatus(
            q.topicReviewStatus,
            q.verifiedAt,
            q.verificationStatus,
            aiV,
          )

          return {
            id: q.id,
            question_text: q.questionText,
            option_a: q.optionA,
            option_b: q.optionB,
            option_c: q.optionC,
            option_d: q.optionD,
            correct_option: q.correctOption,
            explanation: q.explanation,
            verified_at: q.verifiedAt,
            verification_status: q.verificationStatus,
            topic_review_status: q.topicReviewStatus,
            is_official_exam: q.isOfficialExam,
            review_status: reviewStatus,
            ai_verification: aiV ? {
              question_id: aiV.questionId,
              is_correct: aiV.isCorrect,
              confidence: aiV.confidence,
              explanation: aiV.explanation,
              article_quote: aiV.articleQuote,
              suggested_fix: aiV.suggestedFix,
              correct_option_should_be: aiV.correctOptionShouldBe,
              verified_at: aiV.verifiedAt,
              fix_applied: aiV.fixApplied,
              discarded: aiV.discarded,
            } : null,
          }
        })

        // Stats del artículo
        const articleStats: Record<string, number> = {
          total: questionsWithVerification.length,
          perfect: 0, bad_explanation: 0, bad_answer: 0, bad_answer_and_explanation: 0,
          wrong_article: 0, wrong_article_bad_explanation: 0, wrong_article_bad_answer: 0, all_wrong: 0,
          tech_perfect: 0, tech_bad_explanation: 0, tech_bad_answer: 0, tech_bad_answer_and_explanation: 0,
          pending: 0,
        }
        for (const q of questionsWithVerification) {
          if (q.review_status in articleStats) {
            articleStats[q.review_status]++
          }
        }

        return {
          id: article.id,
          article_number: article.articleNumber,
          title: article.title,
          content: article.content,
          questions: questionsWithVerification,
          stats: articleStats,
        }
      })

      // Stats de la ley
      const lawStats = {
        total_articles: articlesWithQuestions.length,
        total_questions: articlesWithQuestions.reduce((s, a) => s + a.stats.total, 0),
        perfect: articlesWithQuestions.reduce((s, a) => s + a.stats.perfect, 0),
        bad_explanation: articlesWithQuestions.reduce((s, a) => s + a.stats.bad_explanation, 0),
        bad_answer: articlesWithQuestions.reduce((s, a) => s + a.stats.bad_answer, 0),
        bad_answer_and_explanation: articlesWithQuestions.reduce((s, a) => s + a.stats.bad_answer_and_explanation, 0),
        wrong_article: articlesWithQuestions.reduce((s, a) => s + a.stats.wrong_article, 0),
        wrong_article_bad_explanation: articlesWithQuestions.reduce((s, a) => s + a.stats.wrong_article_bad_explanation, 0),
        wrong_article_bad_answer: articlesWithQuestions.reduce((s, a) => s + a.stats.wrong_article_bad_answer, 0),
        all_wrong: articlesWithQuestions.reduce((s, a) => s + a.stats.all_wrong, 0),
        tech_perfect: articlesWithQuestions.reduce((s, a) => s + a.stats.tech_perfect, 0),
        tech_bad_explanation: articlesWithQuestions.reduce((s, a) => s + a.stats.tech_bad_explanation, 0),
        tech_bad_answer: articlesWithQuestions.reduce((s, a) => s + a.stats.tech_bad_answer, 0),
        tech_bad_answer_and_explanation: articlesWithQuestions.reduce((s, a) => s + a.stats.tech_bad_answer_and_explanation, 0),
        pending: articlesWithQuestions.reduce((s, a) => s + a.stats.pending, 0),
      }

      return {
        id: scope.lawId,
        short_name: scope.lawShortName,
        name: scope.lawName,
        boe_url: scope.lawBoeUrl,
        is_virtual: isVirtualLaw(scope.lawDescription),
        articles: articlesWithQuestions,
        stats: lawStats,
      }
    }),
  )

  const hasVirtualLaws = lawsResult.some(l => l.is_virtual)

  // Stats globales del tema
  const topicStats = {
    total_laws: lawsResult.length,
    total_articles: lawsResult.reduce((s, l) => s + l.stats.total_articles, 0),
    total_questions: lawsResult.reduce((s, l) => s + l.stats.total_questions, 0),
    perfect: lawsResult.reduce((s, l) => s + l.stats.perfect, 0),
    bad_explanation: lawsResult.reduce((s, l) => s + l.stats.bad_explanation, 0),
    bad_answer: lawsResult.reduce((s, l) => s + l.stats.bad_answer, 0),
    bad_answer_and_explanation: lawsResult.reduce((s, l) => s + l.stats.bad_answer_and_explanation, 0),
    wrong_article: lawsResult.reduce((s, l) => s + l.stats.wrong_article, 0),
    wrong_article_bad_explanation: lawsResult.reduce((s, l) => s + l.stats.wrong_article_bad_explanation, 0),
    wrong_article_bad_answer: lawsResult.reduce((s, l) => s + l.stats.wrong_article_bad_answer, 0),
    all_wrong: lawsResult.reduce((s, l) => s + l.stats.all_wrong, 0),
    tech_perfect: lawsResult.reduce((s, l) => s + l.stats.tech_perfect, 0),
    tech_bad_explanation: lawsResult.reduce((s, l) => s + l.stats.tech_bad_explanation, 0),
    tech_bad_answer: lawsResult.reduce((s, l) => s + l.stats.tech_bad_answer, 0),
    tech_bad_answer_and_explanation: lawsResult.reduce((s, l) => s + l.stats.tech_bad_answer_and_explanation, 0),
    pending: lawsResult.reduce((s, l) => s + l.stats.pending, 0),
    hasVirtualLaws,
  }

  return {
    success: true as const,
    topic: {
      id: topic.id,
      topic_number: topic.topicNumber,
      title: topic.title,
      description: topic.description,
      position_type: topic.positionType,
      stats: topicStats,
    },
    laws: lawsResult,
  }
}

// ============================================
// 7. updateQuestionStatus()
// ============================================

export async function updateQuestionStatus(
  questionId: string,
  status: string,
): Promise<{ success: boolean; message?: string; error?: string; questionId?: string; newStatus?: string }> {
  const db = getDb()

  // Actualizar questions
  await db
    .update(questions)
    .set({
      topicReviewStatus: status,
      verifiedAt: new Date().toISOString(),
    })
    .where(eq(questions.id, questionId))

  // Si existe verificación IA, marcar como descartada (override manual)
  const existingVerification = await db
    .select({ id: aiVerificationResults.id })
    .from(aiVerificationResults)
    .where(eq(aiVerificationResults.questionId, questionId))
    .limit(1)

  if (existingVerification.length > 0) {
    await db
      .update(aiVerificationResults)
      .set({ discarded: true })
      .where(eq(aiVerificationResults.questionId, questionId))
  }

  return {
    success: true,
    message: `Estado actualizado a "${status}"`,
    questionId,
    newStatus: status,
  }
}
