// lib/api/test-config/queries.ts - Queries Drizzle para configurador de tests
import { getDb } from '@/db/client'
import { questions, articles, laws, topicScope, topics, lawSections } from '@/db/schema'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'
import { getValidExamPositions } from '@/lib/config/exam-positions'
import type {
  GetArticlesRequest,
  GetArticlesResponse,
  EstimateQuestionsRequest,
  EstimateQuestionsResponse,
  GetEssentialArticlesRequest,
  GetEssentialArticlesResponse,
  GetScopedSectionsRequest,
  GetScopedSectionsResponse,
  ScopedLawSection,
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
      // NULL = ley virtual (incluir todas), [] = skip, [valores] = filtrar
      validArticleNumbers = mappings[0].articleNumbers
    }

    // Query: artículos con conteo de preguntas (LEFT JOIN para incluir artículos sin preguntas)
    const articleConditions = [
      eq(articles.lawId, lawId),
      eq(articles.isActive, true),
    ]

    if (validArticleNumbers && validArticleNumbers.length > 0) {
      articleConditions.push(inArray(articles.articleNumber, validArticleNumbers))
    }

    const articleData = await db
      .select({
        articleNumber: articles.articleNumber,
        title: articles.title,
        questionCount: sql<number>`count(${questions.id})`,
      })
      .from(articles)
      .leftJoin(questions, and(
        eq(questions.primaryArticleId, articles.id),
        eq(questions.isActive, true),
      ))
      .where(and(...articleConditions))
      .groupBy(articles.articleNumber, articles.title)
      .orderBy(sql`NULLIF(regexp_replace(${articles.articleNumber}, '[^0-9]', '', 'g'), '')::int NULLS LAST, ${articles.articleNumber} NULLS LAST`)

    // Construir resultado
    const result = articleData.map(row => ({
      article_number: row.articleNumber,
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

      if (validArticleNumbers && validArticleNumbers.length > 0) {
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
      // articleNumbers NULL = ley virtual (incluir TODAS las preguntas de la ley)
      // articleNumbers [] = sin artículos específicos → SKIP
      // articleNumbers con valores = filtrar solo esos artículos
      if (mapping.articleNumbers !== null && mapping.articleNumbers.length === 0) continue

      const hasSpecificArticles = mapping.articleNumbers && mapping.articleNumbers.length > 0

      // Construir condiciones de la query
      const conditions = [
        eq(questions.isActive, true),
        eq(articles.lawId, mapping.lawId!),
        ...(hasSpecificArticles ? [inArray(articles.articleNumber, mapping.articleNumbers!)] : []),
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
            ...(hasSpecificArticles ? [inArray(articles.articleNumber, mapping.articleNumbers!)] : []),
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

      // Filtro de dificultad: prioriza global_difficulty_category (datos reales);
      // fallback a difficulty (legacy) si NULL. Mismo patrón que random-test y
      // filtered-questions. Asegura que el conteo del configurador coincida con
      // las preguntas reales que devolverá la query de filtered-questions.
      if (difficultyMode && difficultyMode !== 'random' && difficultyMode !== 'adaptive') {
        conditions.push(
          sql`(${questions.globalDifficultyCategory} = ${difficultyMode} OR
              (${questions.globalDifficultyCategory} IS NULL AND ${questions.difficulty} = ${difficultyMode}))`
        )
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
      // NULL = ley virtual (incluir todas), [] = skip, [valores] = filtrar
      if (mapping.articleNumbers !== null && mapping.articleNumbers.length === 0) continue
      if (!mapping.lawShortName) continue

      const hasSpecificArticles = mapping.articleNumbers && mapping.articleNumbers.length > 0

      // Query: artículos con al menos 1 pregunta oficial (agrupado)
      const officialConditions = [
        eq(questions.isActive, true),
        eq(questions.isOfficialExam, true),
        eq(articles.lawId, mapping.lawId!),
        ...(hasSpecificArticles ? [inArray(articles.articleNumber, mapping.articleNumbers!)] : []),
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
          number: row.articleNumber,
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

// ============================================
// 4. SECCIONES (TÍTULOS/CAPÍTULOS) CON SCOPE DE TEMA
// ============================================
//
// Devuelve todas las secciones (law_sections) de una ley enriquecidas con
// metadatos de intersección con topic_scope del tema indicado. Esto permite
// al configurador de tests (cuando opera dentro de un tema) mostrar sólo los
// títulos que realmente contienen artículos dentro del scope — evitando que
// el usuario seleccione títulos que darían 0 preguntas.
//
// Los títulos fuera de scope no se eliminan: se devuelven con articleCountInScope=0
// para que el frontend pueda mostrarlos deshabilitados y explicar por qué.

export async function getScopedLawSections(
  params: GetScopedSectionsRequest
): Promise<GetScopedSectionsResponse> {
  try {
    const db = getDb()
    const { lawShortName, topicNumber, positionType } = params

    // 1. Resolver law_id (buscar ley activa por short_name)
    const lawResult = await db
      .select({ id: laws.id })
      .from(laws)
      .where(and(eq(laws.shortName, lawShortName), eq(laws.isActive, true)))
      .limit(1)

    if (!lawResult || lawResult.length === 0) {
      return { success: false, error: `Ley no encontrada: ${lawShortName}` }
    }

    const lawId = lawResult[0].id

    // 2. Obtener topic_scope para esta ley+tema
    //    - null = ley virtual (incluye TODOS los artículos)
    //    - []   = ley presente pero sin artículos asignados (caso raro)
    //    - [...] = set específico de artículos
    const mappings = await getTopicScopeMappings(db, topicNumber, positionType, lawShortName)

    if (!mappings || mappings.length === 0) {
      // La ley no pertenece al scope del tema → sin secciones útiles
      return { success: true, sections: [], totalInScope: 0 }
    }

    const scopeArticleNumbers: string[] | null = mappings[0].articleNumbers

    // 3. Obtener secciones activas de la ley (Drizzle)
    const sections = await db
      .select({
        id: lawSections.id,
        slug: lawSections.slug,
        title: lawSections.title,
        description: lawSections.description,
        articleRangeStart: lawSections.articleRangeStart,
        articleRangeEnd: lawSections.articleRangeEnd,
        sectionNumber: lawSections.sectionNumber,
        sectionType: lawSections.sectionType,
        orderPosition: lawSections.orderPosition,
      })
      .from(lawSections)
      .where(and(eq(lawSections.lawId, lawId), eq(lawSections.isActive, true)))
      .orderBy(lawSections.orderPosition)

    // 4. Enriquecer con intersección con topic_scope
    //    Si scopeArticleNumbers === null → ley virtual, todos los artículos cuentan
    //    Si scopeArticleNumbers === []   → ningún artículo, scopeMeta = 0 para todo
    //    Si scopeArticleNumbers tiene valores → interseccionar por rango
    const enriched: ScopedLawSection[] = sections.map(s => {
      const hasRange = s.articleRangeStart != null && s.articleRangeEnd != null
      let articlesInScope: string[] = []

      if (hasRange) {
        if (scopeArticleNumbers === null) {
          // Ley virtual: no tenemos lista explícita — tratamos como "todos en rango"
          // pero no podemos enumerar artículos sin consultar la tabla articles.
          // En este caso devolvemos el propio rango como placeholder (count > 0 suficiente).
          // Esto es seguro porque en el pipeline de filtros la ley virtual siempre pasa.
          articlesInScope = []
        } else {
          articlesInScope = scopeArticleNumbers.filter(a => {
            const n = parseInt(a, 10)
            if (isNaN(n)) return false
            return n >= s.articleRangeStart! && n <= s.articleRangeEnd!
          })
        }
      }

      // Para leyes virtuales, consideramos toda sección con rango como "en scope"
      const countInScope =
        scopeArticleNumbers === null && hasRange
          ? Math.max(0, s.articleRangeEnd! - s.articleRangeStart! + 1)
          : articlesInScope.length

      return {
        id: s.id,
        slug: s.slug,
        title: s.title,
        description: s.description,
        articleRange: hasRange
          ? { start: s.articleRangeStart!, end: s.articleRangeEnd! }
          : null,
        sectionNumber: s.sectionNumber,
        sectionType: s.sectionType,
        orderPosition: s.orderPosition,
        scopeMeta: {
          articlesInScope,
          articleCountInScope: countInScope,
        },
      }
    })

    const totalInScope = enriched.filter(s => s.scopeMeta.articleCountInScope > 0).length

    // Telemetría estructurada: si hay secciones pero ninguna útil, probable
    // tema mal mapeado o ley con un único artículo fuera de los títulos.
    // No es un error — sólo una señal que monitorizamos en producción.
    if (enriched.length > 0 && totalInScope === 0) {
      console.warn(
        `⚠️ [getScopedLawSections] ${lawShortName} tema ${topicNumber}/${positionType}: ` +
        `${enriched.length} secciones, 0 con artículos en scope. ` +
        `El botón Títulos quedará oculto para este caso.`
      )
    } else {
      console.log(
        `📚 [getScopedLawSections] ${lawShortName} tema ${topicNumber}/${positionType}: ` +
        `${totalInScope}/${enriched.length} secciones útiles en scope`
      )
    }

    return {
      success: true,
      sections: enriched,
      totalInScope,
    }
  } catch (error) {
    console.error('❌ Error obteniendo secciones con scope de tema:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ============================================
// CACHED WRAPPERS (Fase 4 — tag 'test-config')
// ============================================
// Endpoints test-config son globales (no auth, no userId), con params
// primitivos deterministas → unstable_cache key-by-args funciona limpio.
// Los 3 endpoints comparten un tag único 'test-config' invalidado por:
//   - lifecycle transition (is_active de questions cambia → counts cambian)
//   - apply-fix / apply-fix-bulk (idem)
//   - verify-articles updateQuestion (idem si toca lifecycle metadata)
//
// Helper para invalidar: lib/cache/test-config.ts:invalidateTestConfigCache.
//
// Feature flag por endpoint para rollback granular:
//   CACHE_TEST_CONFIG_SECTIONS=false        → bypass solo sections
//   CACHE_TEST_CONFIG_ARTICLES=false        → bypass solo articles
//   CACHE_TEST_CONFIG_ESSENTIAL=false       → bypass solo essential-articles
// Por defecto (var no definida o 'true') → cache activado.
//
// estimateAvailableQuestions NO se cachea aquí — sus params incluyen objetos
// (selectedArticlesByLaw, selectedSectionFilters) cuya serialización puede
// no ser estable entre clientes. Se aborda en commit aparte.

const TTL_SECTIONS = 21600       // 6h
const TTL_ARTICLES = 21600       // 6h
const TTL_ESSENTIAL_ARTS = 86400 // 24h

const _cachedScopedSections = unstable_cache(
  getScopedLawSections,
  ['test-config-sections-v1'],
  { revalidate: TTL_SECTIONS, tags: ['test-config'] },
)

const _cachedArticlesForLaw = unstable_cache(
  getArticlesForLaw,
  ['test-config-articles-v1'],
  { revalidate: TTL_ARTICLES, tags: ['test-config'] },
)

const _cachedEssentialArticles = unstable_cache(
  getEssentialArticles,
  ['test-config-essential-v1'],
  { revalidate: TTL_ESSENTIAL_ARTS, tags: ['test-config'] },
)

export async function getScopedLawSectionsCached(
  params: GetScopedSectionsRequest,
): Promise<GetScopedSectionsResponse> {
  if (process.env.CACHE_TEST_CONFIG_SECTIONS === 'false') {
    return getScopedLawSections(params)
  }
  return _cachedScopedSections(params)
}

export async function getArticlesForLawCached(
  params: GetArticlesRequest,
): Promise<GetArticlesResponse> {
  if (process.env.CACHE_TEST_CONFIG_ARTICLES === 'false') {
    return getArticlesForLaw(params)
  }
  return _cachedArticlesForLaw(params)
}

export async function getEssentialArticlesCached(
  params: GetEssentialArticlesRequest,
): Promise<GetEssentialArticlesResponse> {
  if (process.env.CACHE_TEST_CONFIG_ESSENTIAL === 'false') {
    return getEssentialArticles(params)
  }
  return _cachedEssentialArticles(params)
}
