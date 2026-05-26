// lib/api/random-test/queries.ts - Queries Drizzle para Test Aleatorio
// CANARY pooler (sweep masivo oleada 5 — todos user-facing 2026-05-10):
import { getDb, getPoolerDb } from '@/db/client'

function getRandomTestQDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}
import { topics, topicScope, laws, questions, articles, testQuestions, userQuestionHistory } from '@/db/schema'
import { eq, and, sql, inArray, desc, gte, isNotNull, isNull } from 'drizzle-orm'
import { getOposicionByPositionType, EXCLUSIVE_QUESTION_TAGS } from '@/lib/config/oposiciones'
import { unstable_cache } from 'next/cache'
import type {
  OposicionSlug,
  ThemeQuestionCount,
  UserThemeStats,
  GeneratedQuestion,
  CheckAvailabilityRequest,
  GenerateTestRequest,
} from './schemas'
import { getPositionType, getOposicionConfig } from './schemas'

// ============================================
// QUERIES DE CONFIGURACIÓN
// ============================================

/**
 * Implementación interna — la query pesada de 4-way JOIN.
 * No llamar directamente; usar getThemeQuestionCounts() que cachea.
 */
async function getThemeQuestionCountsInternal(
  oposicion: OposicionSlug
): Promise<ThemeQuestionCount[]> {
  const db = getRandomTestQDb()
  const positionType = getPositionType(oposicion)
  const config = getOposicionConfig(oposicion)
  const allThemeIds = config.blocks.flatMap(b => b.themes.map(t => t.id))

  // Obtener posiciones válidas para contar solo oficiales propias
  const { getValidExamPositions } = await import('@/lib/config/exam-positions')
  const validPositions = getValidExamPositions(positionType)

  // UNA SOLA QUERY: Obtener conteos agrupados por tema
  // officialCount: solo cuenta oficiales de esta oposición (por exam_position),
  // NO de otras oposiciones que comparten leyes — para no confundir al usuario.
  const countsResult = await db
    .select({
      topicNumber: topics.topicNumber,
      total: sql<number>`count(DISTINCT ${questions.id})::int`,
      official: validPositions.length > 0
        ? sql<number>`count(DISTINCT CASE WHEN ${questions.isOfficialExam} = true AND ${questions.examPosition} IN (${sql.join(validPositions.map(p => sql`${p}`), sql`, `)}) THEN ${questions.id} END)::int`
        : sql<number>`0`,
    })
    .from(topics)
    .innerJoin(topicScope, eq(topicScope.topicId, topics.id))
    .innerJoin(articles, and(
      eq(articles.lawId, topicScope.lawId),
      sql`(${topicScope.articleNumbers} IS NULL OR ${articles.articleNumber} = ANY(${topicScope.articleNumbers}))`
    ))
    .innerJoin(questions, and(
      eq(questions.primaryArticleId, articles.id),
      eq(questions.isActive, true),
      // Excluir preguntas de casos prácticos: requieren el contexto narrativo
      // del exam_case que solo se renderiza en OfficialExamLayout/ExamReview.
      // En tests aislados aparecerían sin contexto → incomprensibles.
      isNull(questions.examCaseId)
    ))
    .where(and(
      eq(topics.positionType, positionType),
      eq(topics.isActive, true),
      inArray(topics.topicNumber, allThemeIds)
    ))
    .groupBy(topics.topicNumber)

  // Convertir a mapa para acceso rápido
  const countsMap = new Map(
    countsResult.map(r => [r.topicNumber, { total: r.total, official: r.official }])
  )

  // Devolver resultados para todos los temas (incluso los que tienen 0)
  return allThemeIds.map(themeId => ({
    themeId,
    count: countsMap.get(themeId)?.total || 0,
    officialCount: countsMap.get(themeId)?.official || 0,
  }))
}

/**
 * Obtiene el conteo de preguntas por tema para una oposición.
 * Cacheado permanentemente (mismo patrón que temario/teoría).
 * Invalidar con: revalidateTag('test-counts')
 */
export const getThemeQuestionCounts = unstable_cache(
  getThemeQuestionCountsInternal,
  ['theme-question-counts-v1'],
  { revalidate: false, tags: ['test-counts'] }
)

/**
 * Cuenta preguntas para un topic específico
 */
async function getQuestionCountForTopic(
  db: ReturnType<typeof getDb>,
  topicId: string
): Promise<{ total: number; official: number }> {
  // Obtener mapeo del tema
  const scopeMappings = await db
    .select({
      articleNumbers: topicScope.articleNumbers,
      lawId: topicScope.lawId,
    })
    .from(topicScope)
    .where(eq(topicScope.topicId, topicId))

  if (!scopeMappings.length) {
    return { total: 0, official: 0 }
  }

  let totalCount = 0
  let officialCount = 0

  for (const mapping of scopeMappings) {
    if (!mapping.lawId) continue
    // articleNumbers [] (vacío) = sin artículos → skip
    if (mapping.articleNumbers !== null && mapping.articleNumbers.length === 0) continue

    const hasSpecificArticles = mapping.articleNumbers && mapping.articleNumbers.length > 0

    // Query para contar todas las preguntas
    const countQuery = db
      .select({ count: sql<number>`count(*)::int` })
      .from(questions)
      .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
      .where(and(
        eq(questions.isActive, true),
        isNull(questions.examCaseId), // excluir casos prácticos (requieren contexto narrativo)
        eq(articles.lawId, mapping.lawId),
        ...(hasSpecificArticles ? [inArray(articles.articleNumber, mapping.articleNumbers!)] : [])
      ))

    const [totalResult] = await countQuery
    totalCount += totalResult?.count || 0

    // Query para contar preguntas oficiales
    const officialQuery = db
      .select({ count: sql<number>`count(*)::int` })
      .from(questions)
      .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
      .where(and(
        eq(questions.isActive, true),
        eq(questions.isOfficialExam, true),
        isNull(questions.examCaseId), // excluir casos prácticos
        eq(articles.lawId, mapping.lawId),
        ...(hasSpecificArticles ? [inArray(articles.articleNumber, mapping.articleNumbers!)] : [])
      ))

    const [officialResult] = await officialQuery
    officialCount += officialResult?.count || 0
  }

  return { total: totalCount, official: officialCount }
}

// ============================================
// QUERIES DE DISPONIBILIDAD
// ============================================

/**
 * Verifica cuántas preguntas están disponibles con los filtros dados
 * OPTIMIZADO: Una sola query con filtros dinámicos
 */
export async function checkQuestionAvailability(
  request: CheckAvailabilityRequest
): Promise<{ total: number; neverSeen: number; byTheme: Record<string, number> }> {
  const db = getRandomTestQDb()
  const positionType = getPositionType(request.oposicion)

  // Construir condiciones base
  const conditions = [
    eq(topics.positionType, positionType),
    eq(topics.isActive, true),
    eq(questions.isActive, true),
    // Excluir preguntas de casos prácticos (exam_case_id): requieren contexto
    // narrativo que solo se renderiza en OfficialExamLayout/ExamReview.
    // En tests aislados (aleatorio, por tema, por ley) aparecerían sin contexto.
    isNull(questions.examCaseId),
    inArray(topics.topicNumber, request.selectedThemes),
  ]

  // Filtro de dificultad
  if (request.difficulty !== 'mixed') {
    conditions.push(
      sql`(${questions.globalDifficultyCategory} = ${request.difficulty} OR
          (${questions.globalDifficultyCategory} IS NULL AND ${questions.difficulty} = ${request.difficulty}))`
    )
  }

  // Filtro de preguntas oficiales
  if (request.onlyOfficialQuestions) {
    conditions.push(eq(questions.isOfficialExam, true))
  }
  // 🏛️ Filtro anti-contaminación de OFICIALES (caso Laura + caso Sergio):
  // aplica SIEMPRE salvo opt-in includeSharedOfficials. buildOfficialExamFilter
  // ya permite todas las no-oficiales y solo restringe las oficiales por
  // exam_position. Antes solo se aplicaba con onlyOfficialQuestions=true.
  if (!request.includeSharedOfficials) {
    const { buildOfficialExamFilter } = await import('@/lib/api/oposicion-scope/queries')
    const filter = buildOfficialExamFilter(positionType)
    if (filter) conditions.push(filter)
  }

  // UNA SOLA QUERY con GROUP BY
  const countsResult = await db
    .select({
      topicNumber: topics.topicNumber,
      count: sql<number>`count(DISTINCT ${questions.id})::int`,
    })
    .from(topics)
    .innerJoin(topicScope, eq(topicScope.topicId, topics.id))
    .innerJoin(articles, and(
      eq(articles.lawId, topicScope.lawId),
      sql`(${topicScope.articleNumbers} IS NULL OR ${articles.articleNumber} = ANY(${topicScope.articleNumbers}))`
    ))
    .innerJoin(questions, eq(questions.primaryArticleId, articles.id))
    .where(and(...conditions))
    .groupBy(topics.topicNumber)

  // Convertir a formato esperado
  const byTheme: Record<string, number> = {}
  let total = 0

  for (const themeId of request.selectedThemes) {
    const found = countsResult.find(r => r.topicNumber === themeId)
    const count = found?.count || 0
    byTheme[String(themeId)] = count
    total += count
  }

  // Si el request no trae userId, neverSeen == total (sin historial que descontar).
  // Mantiene compat para callers anónimos / pre-auth.
  if (!request.userId) {
    return { total, neverSeen: total, byTheme }
  }

  // Descontar las que el usuario YA respondió. Subquery: count distinct
  // questions del pool actual que existen también en user_question_history.
  // Replica la condición del pool (mismos JOINs + mismas conditions) y la
  // intersecta con history. Postgres optimiza el plan; el coste es ~similar
  // al count base, no se duplica.
  const seenResult = await db
    .select({
      seen: sql<number>`count(DISTINCT ${questions.id})::int`,
    })
    .from(topics)
    .innerJoin(topicScope, eq(topicScope.topicId, topics.id))
    .innerJoin(articles, and(
      eq(articles.lawId, topicScope.lawId),
      sql`(${topicScope.articleNumbers} IS NULL OR ${articles.articleNumber} = ANY(${topicScope.articleNumbers}))`
    ))
    .innerJoin(questions, eq(questions.primaryArticleId, articles.id))
    .innerJoin(userQuestionHistory, and(
      eq(userQuestionHistory.questionId, questions.id),
      eq(userQuestionHistory.userId, request.userId),
    ))
    .where(and(...conditions))

  const seen = seenResult[0]?.seen ?? 0
  const neverSeen = Math.max(0, total - seen)

  return { total, neverSeen, byTheme }
}

// ============================================
// QUERIES DE ESTADÍSTICAS DE USUARIO
// ============================================

/**
 * Obtiene estadísticas del usuario por tema
 * OPTIMIZADO: Una sola query usando tema_number de test_questions
 */
export async function getUserThemeStats(
  oposicion: OposicionSlug,
  userId: string
): Promise<UserThemeStats[]> {
  const db = getRandomTestQDb()
  const config = getOposicionConfig(oposicion)
  const allThemeIds = config.blocks.flatMap(b => b.themes.map(t => t.id))

  // Últimos 6 meses
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  // UNA SOLA QUERY: Estadísticas agrupadas por tema
  // Usar test_questions.user_id denormalizado evita el JOIN con tests, que para
  // heavy users estaba agotando statement_timeout en /api/random-test/user-stats.
  // El índice idx_tq_user_tema_covering cubre user_id + tema_number.
  const statsResult = await db
    .select({
      themeId: testQuestions.temaNumber,
      totalAnswered: sql<number>`count(*)::int`,
      correctAnswers: sql<number>`sum(case when ${testQuestions.isCorrect} = true then 1 else 0 end)::int`,
      lastStudied: sql<string>`max(${testQuestions.createdAt})`,
    })
    .from(testQuestions)
    .where(and(
      eq(testQuestions.userId, userId),
      gte(testQuestions.createdAt, sixMonthsAgo.toISOString()),
      isNotNull(testQuestions.temaNumber),
      isNotNull(testQuestions.userAnswer),
      inArray(testQuestions.temaNumber, allThemeIds)
    ))
    .groupBy(testQuestions.temaNumber)

  // Convertir a mapa
  const statsMap = new Map(
    statsResult.map(r => [r.themeId!, {
      totalAnswered: r.totalAnswered,
      correctAnswers: r.correctAnswers,
      lastStudied: r.lastStudied,
    }])
  )

  // Devolver para todos los temas
  return allThemeIds.map(themeId => {
    const stat = statsMap.get(themeId)
    const totalAnswered = stat?.totalAnswered || 0
    const correctAnswers = stat?.correctAnswers || 0
    return {
      themeId,
      totalAnswered,
      correctAnswers,
      accuracy: totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0,
      lastStudied: stat?.lastStudied || null,
    }
  })
}

// ============================================
// QUERIES DE GENERACIÓN DE TEST
// ============================================

/**
 * Genera un test aleatorio con los parámetros dados
 */
export async function generateRandomTest(
  request: GenerateTestRequest
): Promise<{ questions: GeneratedQuestion[]; testId: string | null }> {
  const db = getRandomTestQDb()
  const positionType = getPositionType(request.oposicion)

  // 🏷️ Tag filter (NULL-safe: tags IS NULL no debe excluir preguntas)
  const opoConfig = getOposicionByPositionType(positionType)
  const questionTag = opoConfig?.questionTag ?? null
  const tagFilter = questionTag
    ? sql`${questions.tags} @> ARRAY[${sql.raw(`'${questionTag}'`)}]::text[]`
    : EXCLUSIVE_QUESTION_TAGS.length > 0
      ? sql`(${questions.tags} IS NULL OR NOT (${questions.tags} && ARRAY[${sql.raw(EXCLUSIVE_QUESTION_TAGS.map(t => `'${t}'`).join(','))}]::text[]))`
      : sql`true`

  const allQuestions: GeneratedQuestion[] = []

  // Obtener preguntas de cada tema seleccionado
  for (const themeId of request.selectedThemes) {
    // Obtener topic
    const [topic] = await db
      .select({ id: topics.id })
      .from(topics)
      .where(and(
        eq(topics.positionType, positionType),
        eq(topics.topicNumber, themeId),
        eq(topics.isActive, true)
      ))
      .limit(1)

    if (!topic) continue

    // Obtener mapeo
    const scopeMappings = await db
      .select({
        articleNumbers: topicScope.articleNumbers,
        lawId: topicScope.lawId,
      })
      .from(topicScope)
      .where(eq(topicScope.topicId, topic.id))

    for (const mapping of scopeMappings) {
      if (!mapping.lawId) continue
      if (mapping.articleNumbers !== null && mapping.articleNumbers.length === 0) continue

      const hasSpecificArticles = mapping.articleNumbers && mapping.articleNumbers.length > 0

      // Construir condiciones
      const conditions = [
        eq(questions.isActive, true),
        eq(articles.lawId, mapping.lawId),
        ...(hasSpecificArticles ? [inArray(articles.articleNumber, mapping.articleNumbers!)] : []),
        tagFilter,
      ]

      // Filtro de dificultad
      if (request.difficulty !== 'mixed') {
        conditions.push(
          sql`(${questions.globalDifficultyCategory} = ${request.difficulty} OR
              (${questions.globalDifficultyCategory} IS NULL AND ${questions.difficulty} = ${request.difficulty}))`
        )
      }

      // Filtro de preguntas oficiales
      if (request.onlyOfficialQuestions) {
        conditions.push(eq(questions.isOfficialExam, true))
      }
      // 🏛️ Filtro anti-contaminación de OFICIALES (caso Laura + caso Sergio):
      // aplica SIEMPRE salvo opt-in includeSharedOfficials (ver comentario en
      // checkQuestionAvailability arriba).
      if (!request.includeSharedOfficials) {
        const { buildOfficialExamFilter } = await import('@/lib/api/oposicion-scope/queries')
        const officialFilter = buildOfficialExamFilter(positionType)
        if (officialFilter) conditions.push(officialFilter)
      }

      const qs = await db
        .select({
          id: questions.id,
          questionText: questions.questionText,
          optionA: questions.optionA,
          optionB: questions.optionB,
          optionC: questions.optionC,
          optionD: questions.optionD,
        optionE: questions.optionE,
          difficulty: questions.difficulty,
          globalDifficultyCategory: questions.globalDifficultyCategory,
          isOfficialExam: questions.isOfficialExam,
          examSource: questions.examSource,
          articleNumber: articles.articleNumber,
          lawShortName: laws.shortName,
        })
        .from(questions)
        .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
        .innerJoin(laws, eq(articles.lawId, laws.id))
        .where(and(...conditions))
        .orderBy(sql`random()`)

      allQuestions.push(...qs.map(q => ({
        id: q.id,
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        difficulty: q.difficulty,
        globalDifficultyCategory: q.globalDifficultyCategory,
        isOfficialExam: q.isOfficialExam,
        examSource: q.examSource,
        articleNumber: q.articleNumber,
        lawShortName: q.lawShortName,
      })))
    }
  }

  // Mezclar y limitar
  const shuffled = allQuestions.sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, request.numQuestions)

  return {
    questions: selected,
    testId: null, // Se creará en el cliente si es necesario
  }
}

// ============================================
// EXPORT INDEX
// ============================================

export * from './schemas'
