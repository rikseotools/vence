// lib/api/filtered-questions/queries.ts - Queries Drizzle para preguntas filtradas
import { getDb } from '@/db/client'
import { questions, articles, laws, topicScope, topics } from '@/db/schema'
import { eq, and, inArray, sql } from 'drizzle-orm'
import type {
  GetFilteredQuestionsRequest,
  GetFilteredQuestionsResponse,
  FilteredQuestion,
  CountFilteredQuestionsRequest,
  CountFilteredQuestionsResponse,
  SectionFilter,
} from './schemas'

// ============================================
// HELPER: Aplicar filtro de secciones a artículos
// ============================================
function applyArticleSectionFilter(
  articleNumbers: string[],
  sectionFilters: SectionFilter[]
): string[] {
  if (!sectionFilters || sectionFilters.length === 0) {
    return articleNumbers
  }

  // Obtener rangos de artículos de los filtros de sección
  const ranges = sectionFilters
    .filter(s => s.articleRange)
    .map(s => ({
      start: s.articleRange!.start,
      end: s.articleRange!.end,
    }))

  if (ranges.length === 0) {
    return articleNumbers
  }

  // Filtrar artículos que estén dentro de algún rango
  return articleNumbers.filter(articleNum => {
    const num = parseInt(articleNum, 10)
    if (isNaN(num)) return false
    return ranges.some(range => num >= range.start && num <= range.end)
  })
}

// ============================================
// OBTENER PREGUNTAS FILTRADAS
// ============================================
export async function getFilteredQuestions(
  params: GetFilteredQuestionsRequest
): Promise<GetFilteredQuestionsResponse> {
  try {
    const db = getDb()
    const {
      topicNumber,
      positionType,
      numQuestions,
      selectedLaws,
      selectedArticlesByLaw,
      selectedSectionFilters,
      onlyOfficialQuestions,
      difficultyMode,
      excludeRecentDays,
      userId,
    } = params

    // 1️⃣ Obtener topic_scope para este tema
    const topicScopeResults = await db
      .select({
        articleNumbers: topicScope.articleNumbers,
        lawId: topicScope.lawId,
        lawShortName: laws.shortName,
        lawName: laws.name,
      })
      .from(topicScope)
      .innerJoin(topics, eq(topicScope.topicId, topics.id))
      .innerJoin(laws, eq(topicScope.lawId, laws.id))
      .where(and(
        eq(topics.topicNumber, topicNumber),
        eq(topics.positionType, positionType)
      ))

    if (!topicScopeResults || topicScopeResults.length === 0) {
      return {
        success: false,
        error: `No se encontró mapeo para tema ${topicNumber} (${positionType})`,
      }
    }

    // 2️⃣ Filtrar por leyes seleccionadas
    let filteredMappings = topicScopeResults
    if (selectedLaws && selectedLaws.length > 0) {
      filteredMappings = filteredMappings.filter(m =>
        m.lawShortName && selectedLaws.includes(m.lawShortName)
      )
    }

    // 3️⃣ Aplicar filtro de artículos por ley
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

    // 4️⃣ Aplicar filtro de secciones/títulos
    if (selectedSectionFilters && selectedSectionFilters.length > 0) {
      filteredMappings = filteredMappings.map(mapping => {
        const filteredArticleNumbers = applyArticleSectionFilter(
          mapping.articleNumbers || [],
          selectedSectionFilters
        )
        return { ...mapping, articleNumbers: filteredArticleNumbers }
      }).filter(m => m.articleNumbers && m.articleNumbers.length > 0)
    }

    if (filteredMappings.length === 0) {
      return {
        success: false,
        error: 'No hay preguntas disponibles con los filtros seleccionados',
      }
    }

    // 5️⃣ Obtener preguntas para cada ley filtrada
    let allQuestions: Array<{
      id: string
      questionText: string
      optionA: string
      optionB: string
      optionC: string
      optionD: string
      explanation: string
      difficulty: string | null
      questionType: string | null
      tags: string[] | null
      isActive: boolean | null
      createdAt: string | null
      updatedAt: string | null
      primaryArticleId: string
      isOfficialExam: boolean | null
      examSource: string | null
      examDate: string | null
      examEntity: string | null
      officialDifficultyLevel: string | null
      articleId: string
      articleNumber: string
      articleTitle: string | null
      articleContent: string | null
      lawId: string
      lawName: string
      lawShortName: string
    }> = []

    for (const mapping of filteredMappings) {
      if (!mapping.articleNumbers || mapping.articleNumbers.length === 0) continue

      // Query base para preguntas de esta ley
      const questionsQuery = db
        .select({
          id: questions.id,
          questionText: questions.questionText,
          optionA: questions.optionA,
          optionB: questions.optionB,
          optionC: questions.optionC,
          optionD: questions.optionD,
          explanation: questions.explanation,
          difficulty: questions.difficulty,
          questionType: questions.questionType,
          tags: questions.tags,
          isActive: questions.isActive,
          createdAt: questions.createdAt,
          updatedAt: questions.updatedAt,
          primaryArticleId: questions.primaryArticleId,
          isOfficialExam: questions.isOfficialExam,
          examSource: questions.examSource,
          examDate: questions.examDate,
          examEntity: questions.examEntity,
          officialDifficultyLevel: questions.officialDifficultyLevel,
          // Article info
          articleId: articles.id,
          articleNumber: articles.articleNumber,
          articleTitle: articles.title,
          articleContent: articles.content,
          // Law info
          lawId: laws.id,
          lawName: laws.name,
          lawShortName: laws.shortName,
        })
        .from(questions)
        .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
        .innerJoin(laws, eq(articles.lawId, laws.id))
        .where(and(
          eq(questions.isActive, true),
          eq(laws.id, mapping.lawId!),
          inArray(articles.articleNumber, mapping.articleNumbers),
          // Filtro de preguntas oficiales si se solicita
          onlyOfficialQuestions ? eq(questions.isOfficialExam, true) : sql`true`
        ))

      const lawQuestions = await questionsQuery
      allQuestions = [...allQuestions, ...lawQuestions]
    }

    if (allQuestions.length === 0) {
      return {
        success: false,
        error: 'No se encontraron preguntas para esta configuración',
      }
    }

    // 6️⃣ Shuffle y limitar cantidad
    const shuffled = allQuestions.sort(() => Math.random() - 0.5)
    const limited = shuffled.slice(0, numQuestions)

    // 7️⃣ Transformar al formato esperado por el frontend
    const transformedQuestions: FilteredQuestion[] = limited.map((q, index) => ({
      id: q.id,
      question: q.questionText,
      options: [q.optionA, q.optionB, q.optionC, q.optionD] as [string, string, string, string],
      explanation: q.explanation,
      primary_article_id: q.primaryArticleId,
      tema: topicNumber,
      article: {
        id: q.articleId,
        number: q.articleNumber || (index + 1).toString(),
        title: q.articleTitle || `Artículo ${index + 1}`,
        full_text: q.articleContent || `Artículo ${q.articleNumber || index + 1}`,
        law_name: q.lawName || 'Ley desconocida',
        law_short_name: q.lawShortName || 'Ley',
        display_number: `Art. ${q.articleNumber || index + 1} ${q.lawShortName || 'Ley'}`,
      },
      metadata: {
        id: q.id,
        difficulty: q.difficulty || 'medium',
        question_type: q.questionType || 'single',
        tags: q.tags,
        is_active: q.isActive ?? true,
        created_at: q.createdAt,
        updated_at: q.updatedAt,
        is_official_exam: q.isOfficialExam,
        exam_source: q.examSource,
        exam_date: q.examDate,
        exam_entity: q.examEntity,
        official_difficulty_level: q.officialDifficultyLevel,
      },
    }))

    return {
      success: true,
      questions: transformedQuestions,
      totalAvailable: allQuestions.length,
      filtersApplied: {
        laws: selectedLaws?.length || 0,
        articles: Object.keys(selectedArticlesByLaw || {}).length,
        sections: selectedSectionFilters?.length || 0,
      },
    }
  } catch (error) {
    console.error('❌ Error obteniendo preguntas filtradas:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ============================================
// CONTAR PREGUNTAS DISPONIBLES (para UI)
// ============================================
export async function countFilteredQuestions(
  params: CountFilteredQuestionsRequest
): Promise<CountFilteredQuestionsResponse> {
  try {
    const db = getDb()
    const {
      topicNumber,
      positionType,
      selectedLaws,
      selectedArticlesByLaw,
      selectedSectionFilters,
      onlyOfficialQuestions,
    } = params

    // 1️⃣ Obtener topic_scope para este tema
    const topicScopeResults = await db
      .select({
        articleNumbers: topicScope.articleNumbers,
        lawId: topicScope.lawId,
        lawShortName: laws.shortName,
      })
      .from(topicScope)
      .innerJoin(topics, eq(topicScope.topicId, topics.id))
      .innerJoin(laws, eq(topicScope.lawId, laws.id))
      .where(and(
        eq(topics.topicNumber, topicNumber),
        eq(topics.positionType, positionType)
      ))

    if (!topicScopeResults || topicScopeResults.length === 0) {
      return {
        success: false,
        error: `No se encontró mapeo para tema ${topicNumber}`,
      }
    }

    // 2️⃣ Aplicar filtros
    let filteredMappings = topicScopeResults
    if (selectedLaws && selectedLaws.length > 0) {
      filteredMappings = filteredMappings.filter(m =>
        m.lawShortName && selectedLaws.includes(m.lawShortName)
      )
    }

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

    if (selectedSectionFilters && selectedSectionFilters.length > 0) {
      filteredMappings = filteredMappings.map(mapping => {
        const filteredArticleNumbers = applyArticleSectionFilter(
          mapping.articleNumbers || [],
          selectedSectionFilters
        )
        return { ...mapping, articleNumbers: filteredArticleNumbers }
      }).filter(m => m.articleNumbers && m.articleNumbers.length > 0)
    }

    // 3️⃣ Contar preguntas por ley
    const byLaw: Record<string, number> = {}
    let totalCount = 0

    for (const mapping of filteredMappings) {
      if (!mapping.articleNumbers || mapping.articleNumbers.length === 0) continue

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(questions)
        .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
        .where(and(
          eq(questions.isActive, true),
          eq(articles.lawId, mapping.lawId!),
          inArray(articles.articleNumber, mapping.articleNumbers),
          onlyOfficialQuestions ? eq(questions.isOfficialExam, true) : sql`true`
        ))

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
    console.error('❌ Error contando preguntas filtradas:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
