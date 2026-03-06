// lib/api/test-config/queries.ts - Queries Drizzle para configurador de tests
import { getDb } from '@/db/client'
import { questions, articles, laws, topicScope, topics } from '@/db/schema'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { getValidExamPositions } from '@/lib/config/exam-positions'
import type {
  GetArticlesRequest,
  GetArticlesResponse,
  EstimateQuestionsRequest,
  EstimateQuestionsResponse,
  GetEssentialArticlesRequest,
  GetEssentialArticlesResponse,
} from './schemas'
import type { SectionFilter } from '@/lib/api/filtered-questions/schemas'

// ============================================
// HELPER: Filtro de artículos por secciones
// ============================================

function applyArticleSectionFilter(
  articleNumbers: string[],
  sectionFilters: SectionFilter[]
): string[] {
  if (!sectionFilters || sectionFilters.length === 0) {
    return articleNumbers
  }

  const ranges = sectionFilters
    .filter(s => s.articleRange)
    .map(s => ({
      start: s.articleRange!.start,
      end: s.articleRange!.end,
    }))

  if (ranges.length === 0) {
    return articleNumbers
  }

  return articleNumbers.filter(articleNum => {
    const num = parseInt(articleNum, 10)
    if (isNaN(num)) return false
    return ranges.some(range => num >= range.start && num <= range.end)
  })
}

// ============================================
// HELPER: Obtener topic_scope mappings
// ============================================

async function getTopicScopeMappings(
  db: ReturnType<typeof getDb>,
  topicNumber: number,
  positionType: string,
  lawShortName?: string
) {
  const conditions = [
    eq(topics.topicNumber, topicNumber),
    eq(topics.positionType, positionType),
  ]

  if (lawShortName) {
    conditions.push(eq(laws.shortName, lawShortName))
  }

  return db
    .select({
      articleNumbers: topicScope.articleNumbers,
      lawId: topicScope.lawId,
      lawShortName: laws.shortName,
    })
    .from(topicScope)
    .innerJoin(topics, eq(topicScope.topicId, topics.id))
    .innerJoin(laws, eq(topicScope.lawId, laws.id))
    .where(and(...conditions))
}

// ============================================
// 1. ARTÍCULOS POR LEY
// ============================================

export async function getArticlesForLaw(
  params: GetArticlesRequest
): Promise<GetArticlesResponse> {
  try {
    const db = getDb()
    const { lawShortName, topicNumber, positionType, includeOfficialCount } = params

    // Buscar law_id
    const lawResult = await db
      .select({ id: laws.id })
      .from(laws)
      .where(eq(laws.shortName, lawShortName))
      .limit(1)

    if (!lawResult || lawResult.length === 0) {
      return { success: false, error: `Ley no encontrada: ${lawShortName}` }
    }

    const lawId = lawResult[0].id

    // Determinar artículos válidos según contexto
    let validArticleNumbers: string[] | null = null

    if (topicNumber) {
      // Modo tema: filtrar por topic_scope
      const mappings = await getTopicScopeMappings(db, topicNumber, positionType, lawShortName)
      if (!mappings || mappings.length === 0) {
        return { success: true, articles: [] }
      }
      validArticleNumbers = mappings[0].articleNumbers || []
    }

    // Query: artículos con conteo de preguntas
    const articleConditions = [
      eq(questions.isActive, true),
      eq(articles.lawId, lawId),
    ]

    if (validArticleNumbers) {
      articleConditions.push(inArray(articles.articleNumber, validArticleNumbers))
    }

    const articleData = await db
      .select({
        articleNumber: articles.articleNumber,
        title: articles.title,
        questionCount: sql<number>`count(${questions.id})`,
      })
      .from(questions)
      .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
      .where(and(...articleConditions))
      .groupBy(articles.articleNumber, articles.title)
      .orderBy(sql`CAST(${articles.articleNumber} AS INTEGER) NULLS LAST`)

    // Construir resultado
    const result = articleData.map(row => ({
      article_number: isNaN(parseInt(row.articleNumber)) ? row.articleNumber : parseInt(row.articleNumber),
      title: row.title,
      question_count: Number(row.questionCount),
      ...(includeOfficialCount ? { official_question_count: 0 } : {}),
    }))

    // Si se piden conteos oficiales, hacer query adicional
    if (includeOfficialCount) {
      const validPositions = getValidExamPositions(positionType)

      const officialConditions = [
        eq(questions.isActive, true),
        eq(questions.isOfficialExam, true),
        eq(articles.lawId, lawId),
      ]

      if (validArticleNumbers) {
        officialConditions.push(inArray(articles.articleNumber, validArticleNumbers))
      }

      if (validPositions.length > 0) {
        officialConditions.push(inArray(questions.examPosition, validPositions))
      }

      const officialData = await db
        .select({
          articleNumber: articles.articleNumber,
          officialCount: sql<number>`count(${questions.id})`,
        })
        .from(questions)
        .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
        .where(and(...officialConditions))
        .groupBy(articles.articleNumber)

      const officialMap = new Map(
        officialData.map(row => [row.articleNumber, Number(row.officialCount)])
      )

      for (const article of result) {
        article.official_question_count = officialMap.get(String(article.article_number)) || 0
      }
    }

    return { success: true, articles: result }
  } catch (error) {
    console.error('❌ Error obteniendo artículos para ley:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ============================================
// 2. ESTIMACIÓN DE PREGUNTAS DISPONIBLES
// ============================================

export async function estimateAvailableQuestions(
  params: EstimateQuestionsRequest
): Promise<EstimateQuestionsResponse> {
  try {
    const db = getDb()
    const {
      topicNumber,
      positionType,
      selectedLaws,
      selectedArticlesByLaw,
      selectedSectionFilters,
      onlyOfficialQuestions,
      difficultyMode,
      focusEssentialArticles,
    } = params

    // Si no hay tema, no podemos estimar (necesitamos topic_scope)
    if (!topicNumber) {
      return { success: false, error: 'topicNumber es requerido para estimar' }
    }

    // 1. Obtener topic_scope
    const topicScopeResults = await getTopicScopeMappings(db, topicNumber, positionType)

    if (!topicScopeResults || topicScopeResults.length === 0) {
      return {
        success: false,
        error: `No se encontró mapeo para tema ${topicNumber}`,
      }
    }

    // 2. Aplicar filtros de leyes
    let filteredMappings = topicScopeResults
    if (selectedLaws && selectedLaws.length > 0) {
      filteredMappings = filteredMappings.filter(m =>
        m.lawShortName && selectedLaws.includes(m.lawShortName)
      )
    }

    // 3. Aplicar filtros de artículos
    if (selectedArticlesByLaw && Object.keys(selectedArticlesByLaw).length > 0) {
      filteredMappings = filteredMappings.map(mapping => {
        const lawShortName = mapping.lawShortName
        if (!lawShortName) return mapping
        const selectedArticles = selectedArticlesByLaw[lawShortName]
        if (selectedArticles && selectedArticles.length > 0) {
          const selectedArticlesAsStrings = selectedArticles.map(num => String(num))
          const filteredArticleNumbers = (mapping.articleNumbers || []).filter(articleNum =>
            selectedArticlesAsStrings.includes(String(articleNum))
          )
          return { ...mapping, articleNumbers: filteredArticleNumbers }
        }
        return mapping
      }).filter(m => m.articleNumbers && m.articleNumbers.length > 0)
    }

    // 4. Aplicar filtros de secciones
    if (selectedSectionFilters && selectedSectionFilters.length > 0) {
      filteredMappings = filteredMappings.map(mapping => {
        const filteredArticleNumbers = applyArticleSectionFilter(
          mapping.articleNumbers || [],
          selectedSectionFilters
        )
        return { ...mapping, articleNumbers: filteredArticleNumbers }
      }).filter(m => m.articleNumbers && m.articleNumbers.length > 0)
    }

    // 5. Contar preguntas por ley
    const byLaw: Record<string, number> = {}
    let totalCount = 0

    for (const mapping of filteredMappings) {
      const articleNums = mapping.articleNumbers || []
      if (articleNums.length === 0) continue

      // Construir condiciones de la query
      const conditions = [
        eq(questions.isActive, true),
        eq(articles.lawId, mapping.lawId!),
        inArray(articles.articleNumber, articleNums),
      ]

      // Filtro de preguntas oficiales por oposición
      if (onlyOfficialQuestions || focusEssentialArticles) {
        const validPositions = getValidExamPositions(positionType)

        if (focusEssentialArticles) {
          // Solo artículos que tengan al menos 1 pregunta oficial
          // Primero obtener artículos "esenciales" (con preguntas oficiales)
          const officialConditions = [
            eq(questions.isActive, true),
            eq(questions.isOfficialExam, true),
            eq(articles.lawId, mapping.lawId!),
            inArray(articles.articleNumber, articleNums),
          ]

          if (validPositions.length > 0) {
            officialConditions.push(inArray(questions.examPosition, validPositions))
          }

          const essentialArticleNums = await db
            .select({ articleNumber: articles.articleNumber })
            .from(questions)
            .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
            .where(and(...officialConditions))
            .groupBy(articles.articleNumber)

          const essentialNums = essentialArticleNums.map(r => r.articleNumber)
          if (essentialNums.length === 0) continue

          // Reemplazar el filtro de artículos con solo los esenciales
          // Remove the original articleNumber condition and add essential one
          conditions.length = 0
          conditions.push(
            eq(questions.isActive, true),
            eq(articles.lawId, mapping.lawId!),
            inArray(articles.articleNumber, essentialNums),
          )
        } else {
          // Solo preguntas oficiales
          conditions.push(eq(questions.isOfficialExam, true))
          if (validPositions.length > 0) {
            conditions.push(inArray(questions.examPosition, validPositions))
          }
        }
      }

      // Filtro de dificultad
      if (difficultyMode && difficultyMode !== 'random' && difficultyMode !== 'adaptive') {
        conditions.push(eq(questions.difficulty, difficultyMode))
      }

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(questions)
        .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
        .where(and(...conditions))

      const count = Number(countResult[0]?.count || 0)
      if (mapping.lawShortName) {
        byLaw[mapping.lawShortName] = (byLaw[mapping.lawShortName] || 0) + count
      }
      totalCount += count
    }

    return {
      success: true,
      count: totalCount,
      byLaw,
    }
  } catch (error) {
    console.error('❌ Error estimando preguntas disponibles:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ============================================
// 3. ARTÍCULOS IMPRESCINDIBLES
// ============================================

export async function getEssentialArticles(
  params: GetEssentialArticlesRequest
): Promise<GetEssentialArticlesResponse> {
  try {
    const db = getDb()
    const { topicNumber, positionType } = params

    // 1. Obtener topic_scope
    const topicScopeResults = await getTopicScopeMappings(db, topicNumber, positionType)

    if (!topicScopeResults || topicScopeResults.length === 0) {
      return {
        success: false,
        error: `No se encontró mapeo para tema ${topicNumber}`,
      }
    }

    const validPositions = getValidExamPositions(positionType)
    const essentialArticles: Array<{ number: string | number; law: string; questionsCount: number }> = []
    let totalQuestions = 0
    const byDifficulty: Record<string, number> = {}

    // 2. Para cada ley, encontrar artículos con preguntas oficiales
    for (const mapping of topicScopeResults) {
      const articleNums = mapping.articleNumbers || []
      if (articleNums.length === 0) continue
      if (!mapping.lawShortName) continue

      // Query: artículos con al menos 1 pregunta oficial (agrupado)
      const officialConditions = [
        eq(questions.isActive, true),
        eq(questions.isOfficialExam, true),
        eq(articles.lawId, mapping.lawId!),
        inArray(articles.articleNumber, articleNums),
      ]

      if (validPositions.length > 0) {
        officialConditions.push(inArray(questions.examPosition, validPositions))
      }

      const articlesWithOfficial = await db
        .select({
          articleNumber: articles.articleNumber,
          officialCount: sql<number>`count(${questions.id})`,
        })
        .from(questions)
        .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
        .where(and(...officialConditions))
        .groupBy(articles.articleNumber)

      if (articlesWithOfficial.length === 0) continue

      const essentialNums = articlesWithOfficial.map(r => r.articleNumber)

      // Añadir a la lista de artículos imprescindibles
      for (const row of articlesWithOfficial) {
        essentialArticles.push({
          number: isNaN(parseInt(row.articleNumber)) ? row.articleNumber : parseInt(row.articleNumber),
          law: mapping.lawShortName,
          questionsCount: Number(row.officialCount),
        })
      }

      // 3. Contar TODAS las preguntas de artículos imprescindibles (no solo oficiales)
      const totalCountResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(questions)
        .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
        .where(and(
          eq(questions.isActive, true),
          eq(articles.lawId, mapping.lawId!),
          inArray(articles.articleNumber, essentialNums),
        ))

      totalQuestions += Number(totalCountResult[0]?.count || 0)

      // 4. Desglose por dificultad
      const difficultyResult = await db
        .select({
          difficulty: questions.difficulty,
          count: sql<number>`count(*)`,
        })
        .from(questions)
        .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
        .where(and(
          eq(questions.isActive, true),
          eq(articles.lawId, mapping.lawId!),
          inArray(articles.articleNumber, essentialNums),
        ))
        .groupBy(questions.difficulty)

      for (const row of difficultyResult) {
        const difficulty = row.difficulty || 'unknown'
        byDifficulty[difficulty] = (byDifficulty[difficulty] || 0) + Number(row.count)
      }
    }

    return {
      success: true,
      essentialCount: essentialArticles.length,
      essentialArticles,
      totalQuestions,
      byDifficulty,
    }
  } catch (error) {
    console.error('❌ Error obteniendo artículos imprescindibles:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
