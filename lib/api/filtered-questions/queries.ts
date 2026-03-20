// lib/api/filtered-questions/queries.ts - Queries Drizzle para preguntas filtradas
import { getDb } from '@/db/client'
import { questions, articles, laws, topicScope, topics, tests, testQuestions, userQuestionHistory } from '@/db/schema'
import { eq, and, inArray, sql, notInArray, desc, or, lt } from 'drizzle-orm'
import type {
  GetFilteredQuestionsRequest,
  GetFilteredQuestionsResponse,
  FilteredQuestion,
  CountFilteredQuestionsRequest,
  CountFilteredQuestionsResponse,
  SectionFilter,
} from './schemas'

import { getValidExamPositions } from '@/lib/config/exam-positions'

// ============================================
// HELPER: Obtener IDs de preguntas respondidas recientemente
// ============================================
async function getRecentlyAnsweredQuestionIds(
  db: ReturnType<typeof getDb>,
  userId: string,
  daysAgo: number
): Promise<string[]> {
  const dateThreshold = new Date()
  dateThreshold.setDate(dateThreshold.getDate() - daysAgo)

  const recentAnswers = await db
    .select({ questionId: testQuestions.questionId })
    .from(testQuestions)
    .innerJoin(tests, eq(testQuestions.testId, tests.id))
    .where(and(
      eq(tests.userId, userId),
      sql`${testQuestions.createdAt} >= ${dateThreshold.toISOString()}`
    ))

  return (recentAnswers || [])
    .map(r => r.questionId)
    .filter((id): id is string => id !== null)
}

// ============================================
// HELPER: Obtener IDs de preguntas nunca vistas por usuario
// ============================================
async function getNeverSeenQuestionIds(
  db: ReturnType<typeof getDb>,
  userId: string,
  candidateQuestionIds: string[]
): Promise<string[]> {
  if (candidateQuestionIds.length === 0) return []

  // Obtener preguntas que el usuario ya ha visto
  const seenAnswers = await db
    .select({ questionId: testQuestions.questionId })
    .from(testQuestions)
    .innerJoin(tests, eq(testQuestions.testId, tests.id))
    .where(and(
      eq(tests.userId, userId),
      inArray(testQuestions.questionId, candidateQuestionIds)
    ))

  const seenIds = new Set((seenAnswers || []).map(r => r.questionId).filter(Boolean))

  // Devolver solo las que no ha visto
  return candidateQuestionIds.filter(id => !seenIds.has(id))
}

// ============================================
// HELPER: Selección proporcional por tema
// ============================================
function selectProportionally<T extends { sourceTopic: number | null }>(
  questions: T[],
  topics: number[],
  numQuestions: number
): T[] {
  if (topics.length <= 1) {
    // Single topic, just shuffle and slice
    return questions.sort(() => Math.random() - 0.5).slice(0, numQuestions)
  }

  // Group questions by topic
  const byTopic = new Map<number, T[]>()
  for (const topic of topics) {
    byTopic.set(topic, [])
  }

  for (const q of questions) {
    if (q.sourceTopic !== null && byTopic.has(q.sourceTopic)) {
      byTopic.get(q.sourceTopic)!.push(q)
    }
  }

  // Calculate base allocation per topic
  const questionsPerTopic = Math.floor(numQuestions / topics.length)
  const remainder = numQuestions % topics.length

  const selected: T[] = []
  const topicAllocations: { topic: number; count: number }[] = []

  // Shuffle each topic's questions and calculate available counts
  for (const topic of topics) {
    const topicQuestions = byTopic.get(topic) || []
    // Shuffle in place
    for (let i = topicQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[topicQuestions[i], topicQuestions[j]] = [topicQuestions[j], topicQuestions[i]]
    }
    topicAllocations.push({
      topic,
      count: Math.min(questionsPerTopic, topicQuestions.length)
    })
  }

  // Distribute remainder to topics that have extra questions
  let extraNeeded = remainder
  for (const allocation of topicAllocations) {
    if (extraNeeded <= 0) break
    const topicQuestions = byTopic.get(allocation.topic) || []
    if (topicQuestions.length > allocation.count) {
      allocation.count++
      extraNeeded--
    }
  }

  // Select from each topic
  for (const allocation of topicAllocations) {
    const topicQuestions = byTopic.get(allocation.topic) || []
    selected.push(...topicQuestions.slice(0, allocation.count))
  }

  // If we couldn't fill all slots, try to get more from topics with extras
  const deficit = numQuestions - selected.length
  if (deficit > 0) {
    // Get remaining questions from any topic
    const selectedIds = new Set(selected.map(q => (q as any).id))
    const remaining = questions.filter(q => !selectedIds.has((q as any).id))
    selected.push(...remaining.slice(0, deficit))
  }

  // Final shuffle to mix topics
  for (let i = selected.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[selected[i], selected[j]] = [selected[j], selected[i]]
  }

  console.log(`📊 Selección proporcional: ${selected.length} preguntas de ${topics.length} temas`)
  topicAllocations.forEach(a => {
    console.log(`  - Tema ${a.topic}: ${a.count} preguntas`)
  })

  return selected
}

// ============================================
// HELPER: Selección equitativa por ley
// ============================================
function selectEquitativeByLaw<T extends { lawShortName: string }>(
  questions: T[],
  selectedLaws: string[],
  numQuestions: number
): T[] {
  if (selectedLaws.length <= 1) {
    return questions.sort(() => Math.random() - 0.5).slice(0, numQuestions)
  }

  // Agrupar preguntas por ley
  const byLaw = new Map<string, T[]>()
  for (const law of selectedLaws) {
    byLaw.set(law, [])
  }

  for (const q of questions) {
    if (q.lawShortName && byLaw.has(q.lawShortName)) {
      byLaw.get(q.lawShortName)!.push(q)
    }
  }

  // Calcular asignación base por ley
  const questionsPerLaw = Math.floor(numQuestions / selectedLaws.length)
  const remainder = numQuestions % selectedLaws.length

  const selected: T[] = []
  const lawAllocations: { law: string; count: number; available: number }[] = []

  // Mezclar preguntas de cada ley y calcular disponibles
  for (const law of selectedLaws) {
    const lawQuestions = byLaw.get(law) || []
    // Shuffle
    for (let i = lawQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[lawQuestions[i], lawQuestions[j]] = [lawQuestions[j], lawQuestions[i]]
    }
    lawAllocations.push({
      law,
      count: Math.min(questionsPerLaw, lawQuestions.length),
      available: lawQuestions.length
    })
  }

  // Distribuir el resto a leyes con preguntas extra
  let extraNeeded = remainder
  for (const allocation of lawAllocations) {
    if (extraNeeded <= 0) break
    if (allocation.available > allocation.count) {
      allocation.count++
      extraNeeded--
    }
  }

  // Si alguna ley no tiene suficientes, redistribuir a otras
  let deficit = 0
  for (const allocation of lawAllocations) {
    if (allocation.available < allocation.count) {
      deficit += allocation.count - allocation.available
      allocation.count = allocation.available
    }
  }

  // Repartir déficit entre leyes con excedente
  while (deficit > 0) {
    let distributed = false
    for (const allocation of lawAllocations) {
      if (deficit <= 0) break
      if (allocation.available > allocation.count) {
        allocation.count++
        deficit--
        distributed = true
      }
    }
    if (!distributed) break // No hay más preguntas disponibles
  }

  // Seleccionar de cada ley
  for (const allocation of lawAllocations) {
    const lawQuestions = byLaw.get(allocation.law) || []
    selected.push(...lawQuestions.slice(0, allocation.count))
  }

  // Mezcla final para no agrupar por ley
  for (let i = selected.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[selected[i], selected[j]] = [selected[j], selected[i]]
  }

  console.log(`📊 Selección equitativa por ley: ${selected.length} preguntas de ${selectedLaws.length} leyes`)
  lawAllocations.forEach(a => {
    console.log(`  - ${a.law}: ${a.count} preguntas (${a.available} disponibles)`)
  })

  return selected
}

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
      multipleTopics,
      numQuestions,
      selectedLaws,
      selectedArticlesByLaw,
      selectedSectionFilters,
      onlyOfficialQuestions,
      difficultyMode,
      excludeRecentDays,
      userId,
      focusEssentialArticles,
      prioritizeNeverSeen,
      proportionalByTopic,
      onlyFailedQuestions,
      failedQuestionIds,
    } = params

    // IDs de preguntas falladas (pueden venir del cliente o resolverse del historial)
    let resolvedFailedIds = failedQuestionIds && failedQuestionIds.length > 0 ? failedQuestionIds : null

    // 🔄 CASO: "Solo falladas" sin IDs específicos — buscar en historial del usuario
    if (onlyFailedQuestions && !resolvedFailedIds && userId) {
      console.log(`🔄 Modo preguntas falladas por historial del usuario: ${userId}`)

      // Buscar question_ids donde el usuario ha fallado al menos una vez
      const failedHistory = await db
        .select({ questionId: userQuestionHistory.questionId })
        .from(userQuestionHistory)
        .where(
          and(
            eq(userQuestionHistory.userId, userId),
            lt(userQuestionHistory.successRate, '1.00')
          )
        )

      const userFailedIds = failedHistory.map(h => h.questionId)

      if (userFailedIds.length === 0) {
        console.log('📭 El usuario no tiene preguntas falladas')
        return { success: true, questions: [], totalAvailable: 0, filtersApplied: { laws: 0, articles: 0, sections: 0 } }
      }

      console.log(`❌ Encontradas ${userFailedIds.length} preguntas falladas en historial`)

      // Continuar al bloque siguiente con los IDs resueltos
      resolvedFailedIds = userFailedIds
    }


    // 🔄 CASO ESPECIAL: Preguntas falladas específicas
    // Si se proporcionan IDs de preguntas falladas, buscar directamente por ID
    if (onlyFailedQuestions && resolvedFailedIds && resolvedFailedIds.length > 0) {
      console.log(`🔄 Modo preguntas falladas: ${resolvedFailedIds.length} preguntas específicas`)

      const failedQuestions = await db
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
          examPosition: questions.examPosition,
          officialDifficultyLevel: questions.officialDifficultyLevel,
          articleId: articles.id,
          articleNumber: articles.articleNumber,
          articleTitle: articles.title,
          articleContent: articles.content,
          lawId: laws.id,
          lawName: laws.name,
          lawShortName: laws.shortName,
        })
        .from(questions)
        .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
        .innerJoin(laws, eq(articles.lawId, laws.id))
        .where(and(
          eq(questions.isActive, true),
          inArray(questions.id, resolvedFailedIds)
        ))

      // Ordenar según el orden de resolvedFailedIds (mantener orden original)
      const questionMap = new Map(failedQuestions.map(q => [q.id, q]))
      const orderedQuestions = resolvedFailedIds
        .map(id => questionMap.get(id))
        .filter((q): q is NonNullable<typeof q> => q !== undefined)

      // Limitar a numQuestions si es necesario
      const finalQuestions = orderedQuestions.slice(0, numQuestions)

      console.log(`✅ Encontradas ${finalQuestions.length} de ${resolvedFailedIds.length} preguntas falladas`)

      // Transformar al formato esperado
      const transformedQuestions: FilteredQuestion[] = finalQuestions.map((q, index) => ({
        id: q.id,
        question: q.questionText,
        options: [q.optionA, q.optionB, q.optionC, q.optionD] as [string, string, string, string],
        explanation: q.explanation,
        primary_article_id: q.primaryArticleId,
        tema: topicNumber || null,
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
          exam_position: q.examPosition,
          official_difficulty_level: q.officialDifficultyLevel,
        },
      }))

      return {
        success: true,
        questions: transformedQuestions,
        totalAvailable: resolvedFailedIds.length,
        filtersApplied: {
          laws: 0,
          articles: 0,
          sections: 0,
        },
      }
    }

    // 1️⃣ Determinar qué temas consultar
    let topicsToQuery = multipleTopics && multipleTopics.length > 0
      ? multipleTopics
      : topicNumber > 0 ? [topicNumber] : []

    // 🆕 MODO SIN TEMA: Si no hay tema pero sí hay leyes seleccionadas, filtrar directamente por ley
    const isLawOnlyMode = topicsToQuery.length === 0 && selectedLaws && selectedLaws.length > 0

    // 🆕 MODO GLOBAL: Si no hay tema ni ley, query directa sin filtros de tema (test rápido general)
    const isGlobalMode = topicsToQuery.length === 0 && !isLawOnlyMode

    if (isGlobalMode) {
      console.log(`🎯 Modo global: Buscando ${numQuestions} preguntas aleatorias de ${positionType}`)

      // Query directa: preguntas activas aleatorias, sin filtrar por tema
      const globalQuestions = await db
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
          examPosition: questions.examPosition,
          officialDifficultyLevel: questions.officialDifficultyLevel,
          articleId: articles.id,
          articleNumber: articles.articleNumber,
          articleTitle: articles.title,
          articleContent: articles.content,
          lawId: laws.id,
          lawName: laws.name,
          lawShortName: laws.shortName,
        })
        .from(questions)
        .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
        .innerJoin(laws, eq(articles.lawId, laws.id))
        .where(eq(questions.isActive, true))
        .orderBy(sql`RANDOM()`)
        .limit(numQuestions)

      if (!globalQuestions || globalQuestions.length === 0) {
        return {
          success: false,
          error: `No se encontraron preguntas para ${positionType}`,
        }
      }

      console.log(`✅ Modo global: ${globalQuestions.length} preguntas encontradas`)

      // Transformar al formato esperado
      const transformedQuestions = globalQuestions.map(q => ({
        id: q.id,
        question: q.questionText,
        options: [q.optionA, q.optionB, q.optionC, q.optionD] as [string, string, string, string],
        explanation: q.explanation || '',
        primary_article_id: q.primaryArticleId,
        tema: null,
        article: {
          id: q.articleId,
          number: q.articleNumber,
          title: q.articleTitle,
          full_text: q.articleContent,
          law_name: q.lawName,
          law_short_name: q.lawShortName,
          display_number: `Art. ${q.articleNumber}`,
        },
        metadata: {
          id: q.id,
          difficulty: q.difficulty || 'medium',
          question_type: q.questionType || 'test',
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
        totalAvailable: globalQuestions.length,
        filtersApplied: {
          laws: 0,
          articles: 0,
          sections: 0,
        },
      }
    }

    let filteredMappings: Array<{
      articleNumbers: string[] | null
      lawId: string | null
      lawShortName: string | null
      lawName: string | null
      topicNumber: number | null
    }> = []

    if (isLawOnlyMode) {
      // 🆕 MODO LEY: Obtener todos los artículos de las leyes seleccionadas
      console.log(`🎯 Modo ley-only: Buscando preguntas de leyes ${selectedLaws.join(', ')}`)

      const lawResults = await db
        .select({
          lawId: laws.id,
          lawShortName: laws.shortName,
          lawName: laws.name,
        })
        .from(laws)
        .where(inArray(laws.shortName, selectedLaws))

      // Construir mappings con todos los artículos de cada ley
      for (const law of lawResults) {
        // Obtener artículos específicos si se proporcionaron, sino usar todos
        const specificArticles = selectedArticlesByLaw?.[law.lawShortName || ''] || []

        if (specificArticles.length > 0) {
          // Usar artículos específicos
          filteredMappings.push({
            articleNumbers: specificArticles.map(String),
            lawId: law.lawId,
            lawShortName: law.lawShortName,
            lawName: law.lawName,
            topicNumber: null,
          })
        } else {
          // Obtener todos los artículos de la ley
          const allArticles = await db
            .select({ articleNumber: articles.articleNumber })
            .from(articles)
            .where(eq(articles.lawId, law.lawId!))

          filteredMappings.push({
            articleNumbers: allArticles.map(a => a.articleNumber),
            lawId: law.lawId,
            lawShortName: law.lawShortName,
            lawName: law.lawName,
            topicNumber: null,
          })
        }
      }
    } else {
      // 2️⃣ MODO TEMA: Obtener topic_scope para todos los temas solicitados
      const topicScopeResults = await db
        .select({
          articleNumbers: topicScope.articleNumbers,
          lawId: topicScope.lawId,
          lawShortName: laws.shortName,
          lawName: laws.name,
          topicNumber: topics.topicNumber,
        })
        .from(topicScope)
        .innerJoin(topics, eq(topicScope.topicId, topics.id))
        .innerJoin(laws, eq(topicScope.lawId, laws.id))
        .where(and(
          inArray(topics.topicNumber, topicsToQuery),
          eq(topics.positionType, positionType)
        ))

      if (!topicScopeResults || topicScopeResults.length === 0) {
        return {
          success: false,
          error: `No se encontró mapeo para los temas especificados (${positionType})`,
        }
      }

      filteredMappings = topicScopeResults

      // Filtrar por leyes seleccionadas si se proporcionaron
      if (selectedLaws && selectedLaws.length > 0) {
        filteredMappings = filteredMappings.filter(m =>
          m.lawShortName && selectedLaws.includes(m.lawShortName)
        )
      }
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
      examPosition: string | null // 🏛️ AÑADIDO: Campo para filtrar por oposición
      officialDifficultyLevel: string | null
      articleId: string
      articleNumber: string
      articleTitle: string | null
      articleContent: string | null
      lawId: string
      lawName: string
      lawShortName: string
      sourceTopic: number | null // Track which topic this question belongs to
    }> = []

    for (const mapping of filteredMappings) {
      // articleNumbers NULL = ley virtual (incluir TODAS las preguntas de la ley)
      // articleNumbers [] = sin artículos específicos → SKIP
      // articleNumbers con valores = filtrar solo esos artículos
      if (mapping.articleNumbers !== null && mapping.articleNumbers.length === 0) continue

      const hasSpecificArticles = mapping.articleNumbers && mapping.articleNumbers.length > 0

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
          examPosition: questions.examPosition, // 🏛️ AÑADIDO: Campo para filtrar por oposición
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
          ...(hasSpecificArticles ? [inArray(articles.articleNumber, mapping.articleNumbers!)] : []),
          // 🏛️ Filtro de preguntas oficiales POR OPOSICIÓN
          // Las preguntas sin exam_position NO se incluyen (deben categorizarse primero)
          onlyOfficialQuestions
            ? (() => {
                const validPositions = getValidExamPositions(positionType)
                // Si hay posiciones válidas, filtrar: is_official AND exam_position IN validPositions
                // Si no hay mapeo para esta oposición, solo filtrar por is_official (comportamiento legacy)
                if (validPositions.length > 0) {
                  return and(
                    eq(questions.isOfficialExam, true),
                    inArray(questions.examPosition, validPositions)
                  )
                }
                return eq(questions.isOfficialExam, true)
              })()
            : sql`true`,
          // Filtro de dificultad
          difficultyMode && difficultyMode !== 'random'
            ? eq(questions.globalDifficultyCategory, difficultyMode)
            : sql`true`
        ))

      const lawQuestions = await questionsQuery
      // Add source topic to each question
      if (!lawQuestions || !Array.isArray(lawQuestions)) {
        console.warn('⚠️ lawQuestions vacío para ley:', mapping.lawShortName)
        continue
      }
      const questionsWithTopic = lawQuestions.map(q => ({
        ...q,
        sourceTopic: mapping.topicNumber ?? null
      }))
      allQuestions = [...allQuestions, ...questionsWithTopic]
    }

    if (allQuestions.length === 0) {
      return {
        success: false,
        error: 'No se encontraron preguntas para esta configuración',
      }
    }

    // 6️⃣ Aplicar filtros avanzados de usuario
    let filteredQuestions = [...allQuestions]

    // 6a. Excluir preguntas respondidas recientemente
    if (excludeRecentDays && excludeRecentDays > 0 && userId) {
      const recentIds = await getRecentlyAnsweredQuestionIds(db, userId, excludeRecentDays)
      if (recentIds.length > 0) {
        const recentSet = new Set(recentIds)
        filteredQuestions = filteredQuestions.filter(q => !recentSet.has(q.id))
        console.log(`🔄 Excluidas ${recentIds.length} preguntas recientes, quedan ${filteredQuestions.length}`)
      }
    }

    // 6b. Filtrar solo artículos esenciales (con preguntas oficiales)
    if (focusEssentialArticles) {
      // Solo mantener preguntas de artículos que tienen al menos una pregunta oficial
      const articlesWithOfficial = new Set(
        allQuestions
          .filter(q => q.isOfficialExam === true)
          .map(q => q.articleNumber)
      )
      filteredQuestions = filteredQuestions.filter(q =>
        articlesWithOfficial.has(q.articleNumber)
      )
      console.log(`📌 Filtradas a ${filteredQuestions.length} preguntas de artículos esenciales`)
    }

    // 6c. Priorizar preguntas nunca vistas
    let sortedQuestions = filteredQuestions
    if (prioritizeNeverSeen && userId) {
      const allIds = filteredQuestions.map(q => q.id)
      const neverSeenIds = await getNeverSeenQuestionIds(db, userId, allIds)
      const neverSeenSet = new Set(neverSeenIds)

      // Ordenar: primero las nunca vistas, luego las ya vistas
      sortedQuestions = [
        ...filteredQuestions.filter(q => neverSeenSet.has(q.id)),
        ...filteredQuestions.filter(q => !neverSeenSet.has(q.id))
      ]
      console.log(`👁️ ${neverSeenIds.length} preguntas nunca vistas priorizadas`)
    }

    // 7️⃣ Selección final: equitativa por ley, proporcional por tema, priorizada, o aleatoria
    let finalQuestions: typeof sortedQuestions

    if (isLawOnlyMode && selectedLaws && selectedLaws.length > 1) {
      // 📖 Distribución equitativa entre leyes (modo multi-ley)
      finalQuestions = selectEquitativeByLaw(sortedQuestions, selectedLaws, numQuestions)
    } else if (proportionalByTopic && topicsToQuery.length > 1) {
      // Distribución proporcional entre temas
      finalQuestions = selectProportionally(sortedQuestions, topicsToQuery, numQuestions)
    } else if (prioritizeNeverSeen && userId) {
      // Tomar hasta numQuestions, priorizando las nunca vistas
      finalQuestions = sortedQuestions.slice(0, numQuestions)
    } else {
      // Shuffle completo y limitar
      finalQuestions = sortedQuestions.sort(() => Math.random() - 0.5).slice(0, numQuestions)
    }

    // 8️⃣ Transformar al formato esperado por el frontend
    if (!finalQuestions || !Array.isArray(finalQuestions)) {
      console.error('❌ finalQuestions es undefined o no es array:', typeof finalQuestions)
      return {
        success: false,
        error: 'Error interno: resultado de preguntas inválido',
      }
    }

    const transformedQuestions: FilteredQuestion[] = finalQuestions.map((q, index) => ({
      id: q.id,
      question: q.questionText,
      options: [q.optionA, q.optionB, q.optionC, q.optionD] as [string, string, string, string],
      explanation: q.explanation,
      primary_article_id: q.primaryArticleId,
      tema: q.sourceTopic, // Preserve the source topic for each question
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
        exam_position: q.examPosition, // 🏛️ AÑADIDO: Campo para filtrar por oposición
        official_difficulty_level: q.officialDifficultyLevel,
      },
    }))

    return {
      success: true,
      questions: transformedQuestions,
      totalAvailable: filteredQuestions.length, // Después de aplicar filtros de usuario
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
      // NULL = ley virtual (incluir todas), [] = skip, [valores] = filtrar
      if (mapping.articleNumbers !== null && mapping.articleNumbers.length === 0) continue

      const hasSpecificArticles = mapping.articleNumbers && mapping.articleNumbers.length > 0

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(questions)
        .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
        .where(and(
          eq(questions.isActive, true),
          eq(articles.lawId, mapping.lawId!),
          ...(hasSpecificArticles ? [inArray(articles.articleNumber, mapping.articleNumbers!)] : []),
          // 🏛️ Filtro de preguntas oficiales POR OPOSICIÓN
          // Las preguntas sin exam_position NO se incluyen (deben categorizarse primero)
          onlyOfficialQuestions
            ? (() => {
                const validPositions = getValidExamPositions(positionType)
                if (validPositions.length > 0) {
                  return and(
                    eq(questions.isOfficialExam, true),
                    inArray(questions.examPosition, validPositions)
                  )
                }
                return eq(questions.isOfficialExam, true)
              })()
            : sql`true`
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
