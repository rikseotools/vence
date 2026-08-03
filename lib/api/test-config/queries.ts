// lib/api/test-config/queries.ts - Queries Drizzle para configurador de tests
// CANARY pooler (sweep masivo oleada 5 — todos user-facing 2026-05-10):
import { getDb, getPoolerDb } from '@/db/client'

function getTestConfigDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}
import { questions, articles, laws, topicScope, topics, lawSections } from '@/db/schema'
import { eq, and, inArray, isNull, sql } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'
import { getValidExamPositions } from '@/lib/config/exam-positions'
import { buildOfficialExamFilter } from '@/lib/api/oposicion-scope/queries'
import { articleInPositionScopeExists } from '@/lib/api/_shared/topicScopeSql'
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
    const db = getTestConfigDb()
    const { lawShortName, topicNumber, positionType, includeOfficialCount, scopeToPosition } = params

    // Determinar artículos válidos y law_id según contexto
    let lawId: string
    let validArticleNumbers: string[] | null = null

    if (topicNumber) {
      // Modo tema: filtrar por topic_scope
      const mappings = await getTopicScopeMappings(db, topicNumber, positionType, lawShortName)
      if (!mappings || mappings.length === 0) {
        return { success: true, articles: [] }
      }
      // ⚠️ Usar el law_id que el topic_scope referencia EXPLÍCITAMENTE (fuente de
      // verdad). Resolver por short_name con LIMIT 1 es ambiguo cuando hay leyes
      // duplicadas (mismo short_name, una poblada y otra vacía, p.ej. "LO 1/2004"):
      // devolvía la fila vacía → 0 preguntas por artículo → todos en gris.
      if (!mappings[0].lawId) {
        return { success: true, articles: [] }
      }
      lawId = mappings[0].lawId
      // NULL = ley virtual (incluir todas), [] = skip, [valores] = filtrar
      validArticleNumbers = mappings[0].articleNumbers
    } else {
      // Sin tema (configurador "por leyes"): no hay topic_scope del que leer el
      // law_id, así que resolvemos por short_name. Con leyes duplicadas (mismo
      // short_name) preferimos DETERMINISTA la fila con más preguntas activas,
      // para no caer en la fila vacía.
      const activeQuestionsForLaw = sql<number>`(
        SELECT count(*) FROM ${questions} q
        JOIN ${articles} a ON q.primary_article_id = a.id
        WHERE a.law_id = ${laws.id} AND q.is_active = true
      )`
      const lawResult = await db
        .select({ id: laws.id })
        .from(laws)
        .where(eq(laws.shortName, lawShortName))
        .orderBy(sql`${activeQuestionsForLaw} DESC`, laws.id)
        .limit(1)

      if (!lawResult || lawResult.length === 0) {
        return { success: false, error: `Ley no encontrada: ${lawShortName}` }
      }

      lawId = lawResult[0].id
    }

    // Query: artículos con conteo de preguntas (LEFT JOIN para incluir artículos sin preguntas)
    const articleConditions = [
      eq(articles.lawId, lawId),
      eq(articles.isActive, true),
    ]

    if (validArticleNumbers && validArticleNumbers.length > 0) {
      articleConditions.push(inArray(articles.articleNumber, validArticleNumbers))
    }

    // 🎯 Configurador "por leyes" acotado (sin topicNumber): solo ofrecer los
    // artículos del temario del positionType (unión de sus temas), no la ley entera.
    // Así el selector no muestra artículos fuera del temario (la confusión de Ana).
    // Con topicNumber, el scope ya lo aplica validArticleNumbers arriba.
    if (scopeToPosition && !topicNumber) {
      articleConditions.push(
        articleInPositionScopeExists({ lawId: articles.lawId, articleNumber: articles.articleNumber, positionType }),
      )
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

/**
 * Resuelve el `law_id` de un short_name cuando NO hay topic_scope del que leerlo
 * (configurador "por leyes"). Con leyes duplicadas (mismo short_name, una poblada y
 * otra vacía) elige DETERMINISTA la que más preguntas activas tiene: resolver con
 * LIMIT 1 a secas devolvía la fila vacía y dejaba todo a 0.
 *
 * Es el mismo criterio que ya aplicaba `getArticlesForLaw`; vive aquí para que las dos
 * lecturas no puedan divergir.
 */
async function resolveLawIdByShortName(
  db: ReturnType<typeof getDb>,
  lawShortName: string,
): Promise<string | null> {
  const activeQuestionsForLaw = sql<number>`(
    SELECT count(*) FROM ${questions} q
    JOIN ${articles} a ON q.primary_article_id = a.id
    WHERE a.law_id = ${laws.id} AND q.is_active = true
  )`
  const rows = await db
    .select({ id: laws.id })
    .from(laws)
    .where(eq(laws.shortName, lawShortName))
    .orderBy(sql`${activeQuestionsForLaw} DESC`, laws.id)
    .limit(1)

  return rows[0]?.id ?? null
}

/**
 * Estimación en modo "por leyes" (sin tema): cuenta sobre la selección real de leyes,
 * artículos y secciones, con los MISMOS filtros que aplicará el test al servir.
 *
 * El conteo de oficiales usa `getValidExamPositions(positionType)` — solo las oficiales
 * DE ESA oposición, igual que el resto de la app. Contar cross-oposición infla el número
 * sobre leyes compartidas (CE, LOTC…) y haría mentir a la casilla.
 */
async function estimateByLaws(
  db: ReturnType<typeof getDb>,
  params: EstimateQuestionsRequest,
): Promise<EstimateQuestionsResponse> {
  const {
    positionType,
    selectedLaws,
    selectedArticlesByLaw,
    selectedSectionFilters,
    onlyOfficialQuestions,
    difficultyMode,
    scopeToPosition,
  } = params

  // Sin leyes seleccionadas no hay nada que contar (el configurador aún no ha elegido).
  if (!selectedLaws || selectedLaws.length === 0) {
    return { success: true, count: 0, byLaw: {} }
  }

  const validPositions = onlyOfficialQuestions ? getValidExamPositions(positionType) : []
  // Fail-safe: oposición no registrada en EXAM_POSITION_MAP → no tiene oficiales propias.
  // Omitir el filtro contaría las de OTRAS oposiciones y la casilla mentiría.
  if (onlyOfficialQuestions && validPositions.length === 0) {
    return { success: true, count: 0, byLaw: {} }
  }

  const byLaw: Record<string, number> = {}
  let totalCount = 0

  for (const lawShortName of selectedLaws) {
    const lawId = await resolveLawIdByShortName(db, lawShortName)
    if (!lawId) continue

    const conditions = [eq(questions.isActive, true), eq(articles.lawId, lawId)]

    // Artículos elegidos por el usuario para ESTA ley
    const chosen = selectedArticlesByLaw?.[lawShortName]
    let articleNumbers: string[] | null =
      chosen && chosen.length > 0 ? chosen.map(a => String(a)) : null

    // Filtros de sección: se resuelven sobre los artículos reales de la ley, con el
    // mismo helper que el modo tema (rangos → números), no con aritmética aparte.
    if (selectedSectionFilters && selectedSectionFilters.length > 0) {
      const candidateConditions = [eq(articles.lawId, lawId), eq(articles.isActive, true)]
      if (articleNumbers) {
        candidateConditions.push(inArray(articles.articleNumber, articleNumbers))
      }
      if (scopeToPosition) {
        candidateConditions.push(
          articleInPositionScopeExists({
            lawId: articles.lawId,
            articleNumber: articles.articleNumber,
            positionType,
          }),
        )
      }
      const candidates = await db
        .select({ articleNumber: articles.articleNumber })
        .from(articles)
        .where(and(...candidateConditions))

      articleNumbers = applyArticleSectionFilter(
        candidates.map(c => c.articleNumber).filter((n): n is string => n != null),
        selectedSectionFilters as SectionFilter[],
      )
      // Con secciones elegidas y ningún artículo dentro, esta ley aporta 0.
      if (articleNumbers.length === 0) {
        byLaw[lawShortName] = 0
        continue
      }
    }

    if (articleNumbers && articleNumbers.length > 0) {
      conditions.push(inArray(articles.articleNumber, articleNumbers))
    }

    // Acotar al temario de la oposición (mismo predicado que el selector de artículos,
    // para que el número y la lista que el usuario ve hablen de lo mismo).
    if (scopeToPosition) {
      conditions.push(
        articleInPositionScopeExists({
          lawId: articles.lawId,
          articleNumber: articles.articleNumber,
          positionType,
        }),
      )
    }

    if (onlyOfficialQuestions) {
      conditions.push(eq(questions.isOfficialExam, true))
      conditions.push(inArray(questions.examPosition, validPositions))
    }

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
    byLaw[lawShortName] = (byLaw[lawShortName] || 0) + count
    totalCount += count
  }

  return { success: true, count: totalCount, byLaw }
}

export async function estimateAvailableQuestions(
  params: EstimateQuestionsRequest
): Promise<EstimateQuestionsResponse> {
  try {
    const db = getTestConfigDb()
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

    // Sin tema = configurador "por leyes": no hay topic_scope del que partir, pero SÍ se
    // puede contar (la selección son leyes + artículos). Hace falta para que la casilla
    // "🏛️ Preguntas oficiales" pueda pintarse ahí con un número honesto — T-326.
    if (!topicNumber) {
      return estimateByLaws(db, params)
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

        // Fail-safe: si la oposición no está registrada en EXAM_POSITION_MAP, validPositions=[].
        // NO omitir el filtro de examPosition (eso contaría oficiales de OTRAS oposiciones y la
        // estimación mentiría: 94 vs 1 real). Sin posiciones válidas no hay oficiales propios → 0.
        if (validPositions.length === 0) continue

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

      // [T-507] Los dos filtros que el serve aplica SIEMPRE y que esta estimación
      // no aplicaba, así que prometía preguntas que el test no da:
      //   · oficiales de OTRA oposición (buildOfficialExamFilter, caso Laura)
      //   · supuestos prácticos (sin su contexto narrativo no se sirven en tests)
      // Van al final para cubrir también la rama focusEssentialArticles, que
      // reconstruye `conditions` desde cero.
      conditions.push(isNull(questions.examCaseId))
      const soloServibles = buildOfficialExamFilter(positionType)
      if (soloServibles) conditions.push(soloServibles)

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
    const db = getTestConfigDb()
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

      // Fail-safe: oposición no registrada en EXAM_POSITION_MAP → 0 imprescindibles (no contar
      // oficiales de otras oposiciones). Es la causa del bug Seg. Social (94 vs 1).
      if (validPositions.length === 0) continue
      officialConditions.push(inArray(questions.examPosition, validPositions))

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
    const db = getTestConfigDb()
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
//   CACHE_TEST_CONFIG_ESTIMATE=false        → bypass solo estimate (Phase 4f)
// Por defecto (var no definida o 'true') → cache activado.

const TTL_SECTIONS = 21600       // 6h
const TTL_ARTICLES = 21600       // 6h
const TTL_ESSENTIAL_ARTS = 86400 // 24h
const TTL_ESTIMATE = 3600        // 1h — más volátil, hits interactivos del configurador

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

// ============================================
// estimateAvailableQuestionsCached (Phase 4f) — KEY NORMALIZER
// ============================================
// estimate recibe params con objetos/arrays cuya serialización por defecto
// es inestable entre clientes (orden de keys, orden de elementos). Sin
// normalizar, dos requests con la misma intención lógica pueden caer en
// keys de cache distintas → 0% hit rate.
//
// El normalizador `normalizeEstimateParams`:
//   - Sortea selectedLaws alfabéticamente (es un set, no una lista)
//   - Sortea las keys de selectedArticlesByLaw + sus arrays internos
//   - Sortea selectedSectionFilters por title (campo siempre presente)
//   - Mantiene el resto de campos primitivos sin tocar
//
// Tag 'test-config' compartido con sections/articles/essential — todos
// dependen de questions.is_active (GENERATED desde lifecycle_state) y
// los 3 sitios que invalidan ese tag (transition, apply-fix*) cubren
// también estimate sin trabajo adicional.

function normalizeEstimateParams(
  params: EstimateQuestionsRequest,
): EstimateQuestionsRequest {
  // Sortear selectedLaws (set, no lista ordenada)
  const sortedLaws = params.selectedLaws ? [...params.selectedLaws].sort() : []

  // Sortear keys de selectedArticlesByLaw + valores internos.
  // Los valores son (number | string)[] mixto — convertimos todo a string
  // para sort estable, deduplicamos, y dejamos el shape mixto al runtime.
  const articlesByLaw: Record<string, (number | string)[]> = {}
  if (params.selectedArticlesByLaw) {
    const sortedKeys = Object.keys(params.selectedArticlesByLaw).sort()
    for (const lawKey of sortedKeys) {
      const arr = params.selectedArticlesByLaw[lawKey] ?? []
      // Deduplicar por toString y sortear
      const dedupedSorted = Array.from(new Set(arr.map(v => String(v)))).sort()
      articlesByLaw[lawKey] = dedupedSorted
    }
  }

  // Sortear selectedSectionFilters por title (siempre presente).
  // Si dos tienen el mismo title, ordena por sectionNumber como fallback.
  const sortedFilters: SectionFilter[] = params.selectedSectionFilters
    ? [...params.selectedSectionFilters].sort((a, b) => {
        if (a.title !== b.title) return a.title.localeCompare(b.title)
        return (a.sectionNumber ?? '').localeCompare(b.sectionNumber ?? '')
      })
    : []

  return {
    topicNumber: params.topicNumber,
    positionType: params.positionType,
    selectedLaws: sortedLaws,
    selectedArticlesByLaw: articlesByLaw,
    selectedSectionFilters: sortedFilters,
    onlyOfficialQuestions: params.onlyOfficialQuestions,
    difficultyMode: params.difficultyMode,
    focusEssentialArticles: params.focusEssentialArticles,
    // Va en la key a propósito: en modo "por leyes" (sin tema) decide si se cuenta el
    // temario de la oposición o la ley entera. Si se cae aquí, dos selecciones que dan
    // números distintos comparten entrada de cache y el segundo lee el del primero.
    scopeToPosition: params.scopeToPosition,
  }
}

// Export interno para tests del normalizer.
export const _normalizeEstimateParamsForTests = normalizeEstimateParams

const _cachedEstimateAvailableQuestions = unstable_cache(
  estimateAvailableQuestions,
  ['test-config-estimate-v1'],
  { revalidate: TTL_ESTIMATE, tags: ['test-config'] },
)

export async function estimateAvailableQuestionsCached(
  params: EstimateQuestionsRequest,
): Promise<EstimateQuestionsResponse> {
  if (process.env.CACHE_TEST_CONFIG_ESTIMATE === 'false') {
    return estimateAvailableQuestions(params)
  }
  // Normalizar antes de cachear: dos requests con la misma intención
  // lógica pero distinto orden de inputs comparten cache key.
  const normalized = normalizeEstimateParams(params)
  return _cachedEstimateAvailableQuestions(normalized)
}
