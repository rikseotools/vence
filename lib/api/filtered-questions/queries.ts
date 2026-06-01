// lib/api/filtered-questions/queries.ts - Queries Drizzle para preguntas filtradas
//
// CANARY self-hosted pooler (Fase 3, 2026-05-10):
// /api/questions/filtered GET ?action=count migrado en oleada 2 (read-only,
// determinista, ya tiene fresh-cache 60s + stale-if-error). El POST con
// random-selection sigue contra replica/primary hasta migrar todo el módulo
// en una fase posterior (alto tráfico, requiere observación cuidadosa).
import { getDb, getReadDb, getPoolerDb } from '@/db/client'

function getFilteredCountDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getReadDb()
}
import { questions, articles, laws, topicScope, topics, testQuestions, userQuestionHistoryV2 } from '@/db/schema'
import { eq, and, inArray, sql, notInArray, desc, or, lt, isNull } from 'drizzle-orm'
import {
  getAllowedLawIds,
  type AllowedLawsResult,
} from '@/lib/api/oposicion-scope/queries'
import type {
  GetFilteredQuestionsRequest,
  GetFilteredQuestionsResponse,
  FilteredQuestion,
  CountFilteredQuestionsRequest,
  CountFilteredQuestionsResponse,
  SectionFilter,
} from './schemas'

import { getValidExamPositions } from '@/lib/config/exam-positions'
import { getOposicionByPositionType, EXCLUSIVE_QUESTION_TAGS } from '@/lib/config/oposiciones'
import { buildOfficialExamFilter } from '@/lib/api/oposicion-scope/queries'
import { logValidationError } from '@/lib/api/validation-error-log'

// ============================================
// COLUMNAS COMPARTIDAS: Usado por todos los selects de preguntas
// Definir una sola vez para evitar que se olviden campos (como image_url)
// ============================================
const questionColumns = {
  id: questions.id,
  questionText: questions.questionText,
  optionA: questions.optionA,
  optionB: questions.optionB,
  optionC: questions.optionC,
  optionD: questions.optionD,
  optionE: questions.optionE,
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
  imageUrl: questions.imageUrl,
  contentData: questions.contentData,
  correctOption: questions.correctOption,
  globalDifficultyCategory: questions.globalDifficultyCategory,
} as const

const articleColumns = {
  articleId: articles.id,
  articleNumber: articles.articleNumber,
  articleTitle: articles.title,
  articleContent: articles.content,
  lawId: laws.id,
  lawName: laws.name,
  lawShortName: laws.shortName,
} as const

type QuestionRow = {
  id: string
  questionText: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string | null
  optionE: string | null
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
  examPosition: string | null
  officialDifficultyLevel: string | null
  imageUrl: string | null
  contentData: Record<string, unknown> | null
  correctOption: number
  globalDifficultyCategory: string | null
  articleId: string
  articleNumber: string
  articleTitle: string | null
  articleContent: string | null
  lawId: string
  lawName: string
  lawShortName: string
  sourceTopic: number | null
}

// ============================================
// ID-FIRST refactor (sesión Tier 1, 2026-05-09)
// ============================================
// Tipo "esqueleto": solo las columnas que necesitan los filtros JS y
// los helpers de selección (selectEquitativeByLaw, selectProportionally,
// selectProportionallyByArticle, focusEssentialArticles, prioritizeNeverSeen).
//
// Sustituye el QuestionRow completo en el for-loop de paths 5-6 (modo
// tema/multi-tema y modo ley-only). El payload por petición pasa de
// ~2.5k filas × 25 cols (~5 MB) a ~2.5k filas × 5 cols (~250 KB).
// La hidratación final (Q2) trae las 25 ganadoras con todas las columnas.
//
// Helpers ya operan sobre {id, articleNumber, lawShortName} — verificado
// en __tests__/lib/selectProportionallyByArticle.test.ts. Cero cambios
// en helpers ni en transformQuestion.
type LightweightQuestionRow = {
  id: string
  articleNumber: string
  lawShortName: string
  isOfficialExam: boolean | null
  sourceTopic: number | null
}

const lightweightQuestionColumns = {
  id: questions.id,
  isOfficialExam: questions.isOfficialExam,
} as const

const lightweightArticleColumns = {
  articleNumber: articles.articleNumber,
  lawShortName: laws.shortName,
} as const

export function transformQuestion(q: QuestionRow, index: number): FilteredQuestion {
  return {
    id: q.id,
    question: q.questionText,
    options: [q.optionA, q.optionB, q.optionC, q.optionD, q.optionE].filter((v): v is string => v != null && v !== ''),
    explanation: q.explanation,
    correct_option: q.correctOption,
    primary_article_id: q.primaryArticleId,
    tema: q.sourceTopic ?? null,
    image_url: q.imageUrl || null,
    content_data: q.contentData || null,
    article: {
      id: q.articleId,
      number: q.articleNumber || (index + 1).toString(),
      // Fallback usa articleNumber real (no index de test, que confunde con
      // "Pregunta N" cuando el title está NULL en BD).
      title: q.articleTitle || `Artículo ${q.articleNumber || index + 1}`,
      full_text: q.articleContent || `Artículo ${q.articleNumber || index + 1}`,
      law_name: q.lawName || 'Ley desconocida',
      law_short_name: q.lawShortName || 'Ley',
      display_number: `Art. ${q.articleNumber || index + 1} ${q.lawShortName || 'Ley'}`,
    },
    metadata: {
      id: q.id,
      difficulty: q.globalDifficultyCategory || q.difficulty || 'medium',
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
  }
}

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
    .where(and(
      eq(testQuestions.userId, userId),
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
  const uniqueCandidateIds = [...new Set(candidateQuestionIds.filter(Boolean))]
  if (uniqueCandidateIds.length === 0) return []

  // Obtener preguntas que el usuario ya ha visto. Usar user_question_history
  // evita el JOIN test_questions×tests y aprovecha la unique key
  // (user_id, question_id); en producción el IN contra test_questions con miles
  // de IDs estaba agotando statement_timeout.
  const seenAnswers = await db
    .select({ questionId: userQuestionHistoryV2.questionId })
    .from(userQuestionHistoryV2)
    .where(and(
      eq(userQuestionHistoryV2.userId, userId),
      inArray(userQuestionHistoryV2.questionId, uniqueCandidateIds)
    ))

  const seenIds = new Set((seenAnswers || []).map(r => r.questionId).filter(Boolean))

  // Devolver solo las que no ha visto
  return uniqueCandidateIds.filter(id => !seenIds.has(id))
}

// ============================================
// HELPER: Selección proporcional por tema
// ============================================
export function selectProportionally<T extends { sourceTopic: number | null }>(
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
// HELPER: Distribución proporcional por artículo
// Evita que artículos con muchas preguntas monopolicen el test
// ============================================
export function selectProportionallyByArticle<T extends { id: string; articleNumber: string; lawShortName: string }>(
  candidates: T[],
  fullPool: T[],
  numQuestions: number,
  options?: { maxPerArticle?: number; log?: boolean }
): T[] {
  candidates = candidates.filter(Boolean)
  fullPool = fullPool.filter(Boolean)

  if (candidates.length <= numQuestions && fullPool.length <= numQuestions) {
    return candidates // No hay margen para redistribuir
  }

  const log = options?.log ?? true

  // Agrupar por artículo (clave compuesta para evitar colisiones entre leyes)
  const articleKey = (q: T) => `${q.articleNumber}@${q.lawShortName}`
  const byArticle = new Map<string, T[]>()

  // Usar el pool completo para tener más candidatos por artículo
  const poolById = new Map<string, T>()
  for (const q of fullPool) poolById.set(q.id, q)
  for (const q of candidates) poolById.set(q.id, q) // candidates tienen prioridad

  for (const q of poolById.values()) {
    const key = articleKey(q)
    if (!byArticle.has(key)) byArticle.set(key, [])
    byArticle.get(key)!.push(q)
  }

  const uniqueArticles = byArticle.size
  const maxPerArticle = options?.maxPerArticle ?? Math.max(1, Math.ceil(numQuestions / uniqueArticles))

  // Shuffle cada grupo de artículo
  for (const [, qs] of byArticle) {
    for (let i = qs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[qs[i], qs[j]] = [qs[j], qs[i]]
    }
  }

  // Round-robin: 1 pregunta por artículo por ronda
  const selected: T[] = []
  const selectedIds = new Set<string>()
  const articleKeys = [...byArticle.keys()].sort(() => Math.random() - 0.5)
  const articleCounts = new Map<string, number>()

  const maxRounds = Math.max(maxPerArticle, Math.ceil(numQuestions / Math.max(1, uniqueArticles)))
  let round = 0
  while (selected.length < numQuestions && round < maxRounds) {
    let addedThisRound = false
    for (const key of articleKeys) {
      if (selected.length >= numQuestions) break
      const qs = byArticle.get(key)!
      const used = articleCounts.get(key) || 0
      if (used < qs.length && used === round) {
        const q = qs[used]
        if (!selectedIds.has(q.id)) {
          selected.push(q)
          selectedIds.add(q.id)
          articleCounts.set(key, used + 1)
          addedThisRound = true
        }
      }
    }
    if (!addedThisRound) break
    round++
  }

  // Fallback: si el round-robin no llenó, añadir preguntas restantes del pool
  if (selected.length < numQuestions) {
    for (const q of [...poolById.values()].sort(() => Math.random() - 0.5)) {
      if (selected.length >= numQuestions) break
      if (!selectedIds.has(q.id)) {
        selected.push(q)
        selectedIds.add(q.id)
      }
    }
  }

  // Shuffle final para mezclar artículos
  for (let i = selected.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[selected[i], selected[j]] = [selected[j], selected[i]]
  }

  if (log) {
    const diversityScore = selected.length > 0
      ? (new Set(selected.map(articleKey)).size / selected.length).toFixed(2)
      : '0.00'
    const topArticles = [...articleCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k, v]) => `${k}:${v}`)
      .join(', ')
    console.log(`[ArticleDist] ${selected.length} preguntas, ${new Set(selected.map(articleKey)).size} artículos distintos (max ${maxPerArticle}/art). Diversity: ${diversityScore}. Top: ${topArticles}`)
  }

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
// HELPERS ID-FIRST
// ============================================

/**
 * Mapping post-construcción + filtros (artículos, secciones).
 */
type PathMapping = {
  articleNumbers: string[] | null
  lawId: string | null
  lawShortName: string | null
  lawName: string | null
  topicNumber: number | null
}

/**
 * Q1 ligera: trae solo {id, articleNumber, lawShortName, isOfficialExam} +
 * sourceTopic añadido en JS desde mapping. Mismos filtros WHERE que la
 * legacy (tag, exam_position, difficulty coalesce, isActive, law_id,
 * articleNumber IN(...)). El payload baja de ~25 cols a 5 cols.
 *
 * Llamadas secuenciales por mapping (mismo orden que legacy) para
 * preservar duplicate behavior cuando una pregunta aparece en múltiples
 * mappings (multi-tema con scope solapado).
 */
async function queryQuestionsForMappingsLightweight(
  db: ReturnType<typeof getReadDb>,
  filteredMappings: PathMapping[],
  opts: {
    positionType: GetFilteredQuestionsRequest['positionType']
    onlyOfficialQuestions: boolean
    includeSharedOfficials: boolean
    difficultyMode: GetFilteredQuestionsRequest['difficultyMode']
    tagFilter: ReturnType<typeof sql>
  }
): Promise<LightweightQuestionRow[]> {
  let allQuestions: LightweightQuestionRow[] = []

  for (const mapping of filteredMappings) {
    // articleNumbers NULL = ley virtual (incluir TODAS), [] = skip, valores = filtrar
    if (mapping.articleNumbers !== null && mapping.articleNumbers.length === 0) continue
    const hasSpecificArticles = mapping.articleNumbers && mapping.articleNumbers.length > 0

    const lawQuestions = await db
      .select({ ...lightweightQuestionColumns, ...lightweightArticleColumns })
      .from(questions)
      .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
      .innerJoin(laws, eq(articles.lawId, laws.id))
      .where(and(
        eq(questions.isActive, true),
        // Excluir casos prácticos (ver comentario consolidado en este archivo).
        isNull(questions.examCaseId),
        eq(laws.id, mapping.lawId!),
        ...(hasSpecificArticles ? [inArray(articles.articleNumber, mapping.articleNumbers!)] : []),
        // 🏛️ Filtro anti-contaminación de OFICIALES (caso Laura 15/04/2026 +
        // caso Sergio 26/05/2026). Aplica SIEMPRE excepto si el premium
        // marcó explícitamente includeSharedOfficials. Antes solo se aplicaba
        // cuando onlyOfficialQuestions=true → oficiales de otra oposición
        // vinculadas a leyes estatales compartidas se colaban en cualquier
        // modo practice (incluido /leyes/[slug]/avanzado).
        opts.includeSharedOfficials
          ? sql`true`
          : buildOfficialExamFilter(opts.positionType),
        opts.onlyOfficialQuestions ? eq(questions.isOfficialExam, true) : sql`true`,
        // Difficulty coalesce idéntico al legacy (línea 1004-1007 original)
        opts.difficultyMode && opts.difficultyMode !== 'random'
          ? sql`(${questions.globalDifficultyCategory} = ${opts.difficultyMode} OR
                (${questions.globalDifficultyCategory} IS NULL AND ${questions.difficulty} = ${opts.difficultyMode}))`
          : sql`true`,
        opts.tagFilter,
      ))

    if (!lawQuestions || !Array.isArray(lawQuestions)) {
      console.warn('⚠️ [id-first] lawQuestions vacío para ley:', mapping.lawShortName)
      continue
    }

    const questionsWithTopic: LightweightQuestionRow[] = lawQuestions.map(q => ({
      id: q.id,
      articleNumber: q.articleNumber,
      lawShortName: q.lawShortName,
      isOfficialExam: q.isOfficialExam,
      sourceTopic: mapping.topicNumber ?? null,
    }))
    allQuestions = [...allQuestions, ...questionsWithTopic]
  }

  return allQuestions
}

/**
 * Q2 hidratación: dado un array de IDs (post selección JS), trae las
 * filas completas con todos los joins. Devuelve un Map<id, row> para
 * que el caller preserve el orden original.
 *
 * Postgres no garantiza orden de WHERE id IN (...). Por eso devolvemos
 * un Map y el caller reconstruye el orden.
 *
 * Si una pregunta fue desactivada entre Q1 y Q2 (race muy poco probable
 * — microsegundos), no aparece en el Map y el caller la skippea.
 */
async function hydrateSelectedQuestions(
  db: ReturnType<typeof getReadDb>,
  selectedIds: string[]
): Promise<Map<string, Omit<QuestionRow, 'sourceTopic'>>> {
  if (selectedIds.length === 0) return new Map()

  const rows = await db
    .select({ ...questionColumns, ...articleColumns })
    .from(questions)
    .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
    .innerJoin(laws, eq(articles.lawId, laws.id))
    .where(inArray(questions.id, selectedIds))

  const byId = new Map<string, Omit<QuestionRow, 'sourceTopic'>>()
  for (const r of rows) {
    byId.set(r.id, r as Omit<QuestionRow, 'sourceTopic'>)
  }
  return byId
}

// ============================================
// OBTENER PREGUNTAS FILTRADAS
// ============================================
// Paths 1-4 (content_scope, failed-questions con/sin IDs, global) usan
// queries con LIMIT en SQL — eficientes desde siempre.
//
// Paths 5-6 (modo tema/multi-tema y modo ley-only) usan ID-first split:
// Q1 ligera trae {id, articleNumber, lawShortName, isOfficialExam} para
// los ~2.5k candidatos; JS filtra/selecciona; Q2 hidrata las ~25 ganadoras
// con todas las columnas. Speedup real demostrado 6-9x vs traer las 25
// columnas para todos los candidatos solo para shuffle in-memory.
export async function getFilteredQuestions(
  params: GetFilteredQuestionsRequest
): Promise<GetFilteredQuestionsResponse> {
  try {
    // Canary pooler propio (Fase 4 oleada 4 URGENTE) si flag ON, replica fallback.
    // Hot path: 240 errors 5xx 24h en blip Supavisor 20:35 — migración crítica.
    // Read-only puro, lag ≤1s aceptable (preguntas nuevas tardan ese tiempo).
    const db = getFilteredCountDb()  // mismo helper que el count — read-only canary
    const {
      topicNumber,
      positionType,
      multipleTopics,
      numQuestions,
      selectedLaws,
      selectedArticlesByLaw,
      selectedSectionFilters,
      onlyOfficialQuestions,
      includeSharedOfficials,
      difficultyMode,
      excludeRecentDays,
      userId,
      focusEssentialArticles,
      prioritizeNeverSeen,
      proportionalByTopic,
      onlyFailedQuestions,
      failedQuestionIds,
      primaryArticleIds,
    } = params

    // 🏷️ Tag de oposición: filtra preguntas por tag cuando la oposición lo define.
    // - Con questionTag (ej: PN): solo preguntas con ese tag
    // - Sin questionTag: excluir preguntas de oposiciones exclusivas (ej: excluir tag PN)
    const opoConfig = getOposicionByPositionType(positionType)
    const questionTag = opoConfig?.questionTag ?? null
    // NULL-safe: `NOT (NULL && ARRAY[...])` es NULL (falsy) en PostgreSQL,
    // lo que excluiría silenciosamente todas las preguntas con tags IS NULL.
    const tagFilter = questionTag
      ? sql`${questions.tags} @> ARRAY[${sql.raw(`'${questionTag}'`)}]::text[]`
      : EXCLUSIVE_QUESTION_TAGS.length > 0
        ? sql`(${questions.tags} IS NULL OR NOT (${questions.tags} && ARRAY[${sql.raw(EXCLUSIVE_QUESTION_TAGS.map(t => `'${t}'`).join(','))}]::text[]))`
        : sql`true`

    // 📋 CASO: Filtro por article UUIDs (content_scope)
    if (primaryArticleIds && primaryArticleIds.length > 0) {
      console.log(`📋 Modo content_scope: ${primaryArticleIds.length} artículos específicos`)

      const scopeQuestions = await db
        .select({ ...questionColumns, ...articleColumns })
        .from(questions)
        .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
        .innerJoin(laws, eq(articles.lawId, laws.id))
        .where(and(
          eq(questions.isActive, true),
          isNull(questions.examCaseId), // casos prácticos solo en exam oficial
          inArray(questions.primaryArticleId, primaryArticleIds),
          tagFilter,
        ))
        .orderBy(sql`RANDOM()`)
        .limit(numQuestions)

      return {
        success: true,
        questions: scopeQuestions.map((q, i) => transformQuestion({ ...q, sourceTopic: null } as QuestionRow, i)),
        totalAvailable: scopeQuestions.length,
        filtersApplied: { laws: 0, articles: primaryArticleIds.length, sections: 0 },
      }
    }

    // Guard: onlyFailedQuestions sin userId Y sin IDs específicos → fallback con warning.
    // Si hay failedQuestionIds, no necesita userId (usa los IDs directos).
    if (onlyFailedQuestions && !userId && (!failedQuestionIds || failedQuestionIds.length === 0)) {
      console.warn(`⚠️ [failed-questions] onlyFailedQuestions=true pero userId es null y no hay IDs. Fallback a preguntas aleatorias.`)
      logValidationError({
        endpoint: '/api/questions/filtered',
        errorType: 'failed_questions_no_auth',
        errorMessage: `onlyFailedQuestions=true sin userId ni IDs. Fallback a aleatorias. positionType=${positionType}`,
        severity: 'warning',
      })
    }

    // 🔄 CASO: "Solo falladas" sin IDs — single JOIN con user_question_history
    //
    // Filtros aplicados:
    //   - selectedLaws (si el usuario eligió leyes concretas en el configurador)
    //   - positionType: la pregunta debe pertenecer a algún topic de la oposición activa.
    //     Evita que un usuario que estudia varias oposiciones desde la misma cuenta vea
    //     falladas cruzadas (incidente Isabel Iglesias 2026-05-03).
    //   - topicNumber (si > 0): además acota al tema concreto que está repasando.
    //     Si topicNumber es 0/null (vista general), no se aplica este filtro y trae
    //     falladas de cualquier tema de la oposición activa.
    if (onlyFailedQuestions && (!failedQuestionIds || failedQuestionIds.length === 0) && userId) {
      const hasLawFilter = selectedLaws && selectedLaws.length > 0
      const hasTopicFilter = !!topicNumber && topicNumber > 0

      // Pre-check: ¿la oposición activa tiene scopes configurados?
      // Si no (ej. celador_sescam_clm, celador_sermas_madrid), aplicar el filtro
      // dejaría 0 resultados — caso Lidia (18/04/2026). Fallback al modo legacy
      // (filtro por selectedLaws solo) cuando la oposición carece de scopes.
      const scopeAvailable = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(topicScope)
        .innerJoin(topics, eq(topics.id, topicScope.topicId))
        .where(eq(topics.positionType, positionType))
        .limit(1)
      const hasScopes = (scopeAvailable[0]?.n ?? 0) > 0

      console.log(`🔄 [failed-questions] Modo historial: userId=${userId}, positionType=${positionType}, topicNumber=${topicNumber || '(todos)'}, selectedLaws=${hasLawFilter ? selectedLaws.join(', ') : '(todas)'}, hasScopes=${hasScopes}`)

      // Pre-computar el set de (law_id, article_number) válidos para la oposición.
      // Aproach v2 (incidente 2026-05-04): el EXISTS con `article_number = ANY(text[])`
      // forzaba Parallel Seq Scan sobre articles (41k rows / 534MB) al no poder usar
      // el GIN index sobre article_numbers. Con pool max:1 + concurrencia + tabla
      // grande → cascada de 504s en /api/interactions y endpoints colaterales.
      //
      // Fix: pre-computar `allowed (law_id, article_number)` con LATERAL unnest y
      // hacer JOIN normal. Resultado: cost 9533 → 2898 (3.3x), p50 340ms → 200ms,
      // sin Seq Scan, plan estable. Paridad 100% verificada con 80 casos
      // (4 users × 4 positions × 5 topics).
      //
      // Nota Drizzle: usamos sql template para el CTE inline porque mezclar
      // db.with() con joins complejos requiere refactor mayor del select shape.

      const lawConditions = []
      lawConditions.push(eq(questions.isActive, true))

      if (hasLawFilter) {
        lawConditions.push(inArray(laws.shortName, selectedLaws))
      }

      let failedQuestions
      if (hasScopes) {
        // Construimos la query con CTE inline. drizzle.execute con sql template
        // no nos da type safety completo, así que mantenemos el query builder y
        // añadimos un EXISTS contra una subquery LATERAL preparada (equivalente
        // semántico al CTE pero compatible con el query builder de Drizzle).
        const scopeFilter = hasTopicFilter
          ? sql`EXISTS (
              SELECT 1
              FROM ${topicScope} ts
              INNER JOIN ${topics} t ON t.id = ts.topic_id
              CROSS JOIN LATERAL unnest(ts.article_numbers) AS an(num)
              WHERE ts.law_id = ${articles.lawId}
                AND t.position_type = ${positionType}
                AND t.topic_number = ${topicNumber}
                AND an.num = ${articles.articleNumber}::text
            )`
          : sql`EXISTS (
              SELECT 1
              FROM ${topicScope} ts
              INNER JOIN ${topics} t ON t.id = ts.topic_id
              CROSS JOIN LATERAL unnest(ts.article_numbers) AS an(num)
              WHERE ts.law_id = ${articles.lawId}
                AND t.position_type = ${positionType}
                AND an.num = ${articles.articleNumber}::text
            )`
        lawConditions.push(scopeFilter)
      } else {
        console.warn(`⚠️ [failed-questions] positionType="${positionType}" no tiene topic_scopes configurados — fallback a modo legacy (sin filtro de oposición). Solo se respeta selectedLaws.`)
      }

      failedQuestions = await db
        .select({ ...questionColumns, ...articleColumns })
        .from(questions)
        .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
        .innerJoin(laws, eq(articles.lawId, laws.id))
        .innerJoin(
          userQuestionHistoryV2,
          and(
            eq(userQuestionHistoryV2.questionId, questions.id),
            eq(userQuestionHistoryV2.userId, userId),
            lt(userQuestionHistoryV2.successRate, '1.00')
          )
        )
        .where(and(...lawConditions))
        .orderBy(sql`random()`)
        .limit(numQuestions)

      console.log(`✅ [failed-questions] ${failedQuestions.length} preguntas falladas${hasTopicFilter ? ` del T${topicNumber}` : ''} en ${positionType}${hasLawFilter ? ` (leyes: ${selectedLaws.join(', ')})` : ''} (limit ${numQuestions})`)

      if (failedQuestions.length === 0) {
        const emptyReason = hasTopicFilter
          ? (hasLawFilter
              ? `No tienes preguntas falladas en ${selectedLaws.join(', ')} dentro del Tema ${topicNumber} de tu oposición`
              : `No tienes preguntas falladas en el Tema ${topicNumber} de tu oposición`)
          : (hasLawFilter
              ? `No tienes preguntas falladas en ${selectedLaws.join(', ')} en tu oposición`
              : 'No tienes preguntas falladas aún en tu oposición')
        return { success: true, questions: [], totalAvailable: 0, filtersApplied: { laws: selectedLaws?.length || 0, articles: 0, sections: 0 }, emptyReason }
      }

      const transformedQuestions = failedQuestions.map((q, i) => transformQuestion({ ...q, sourceTopic: topicNumber || null } as QuestionRow, i))

      return {
        success: true,
        questions: transformedQuestions,
        totalAvailable: transformedQuestions.length,
        filtersApplied: { laws: selectedLaws?.length || 0, articles: 0, sections: 0 },
      }
    }

    // 🔄 CASO: Preguntas falladas con IDs específicos (del sessionStorage)
    //
    // Post-26/05/2026 (caso Cristina, dispute cluster c7196843 — 9 disputes):
    // ANTES no aplicaba scope filter "el usuario ya falló estas preguntas
    // concretas". Premisa rota cuando el usuario CAMBIA de oposición: las
    // IDs en sessionStorage / cliente vienen del histórico de la oposición
    // anterior y se sirven en la nueva. Cristina (Estado→CyL el 25/05) pidió
    // "falladas T5 CyL" y recibió Ley 50/1997/CE 98 (T5 Estado).
    //
    // Fix: aplicar scope filter (EXISTS topic_scope) igual que el path 3.
    // Si todas las IDs son in-scope (caso normal), comportamiento idéntico.
    // Si hay out-of-scope (cambio de oposición), se filtran silenciosamente.
    // Si la oposición no tiene scopes configurados (caso Lidia 18/04 —
    // celador_sescam_clm, etc.), fallback legacy sin scope.
    if (onlyFailedQuestions && failedQuestionIds && failedQuestionIds.length > 0) {
      console.log(`🔄 [failed-questions-ids] ${failedQuestionIds.length} IDs específicas`)

      // Pre-check: ¿la oposición tiene scopes configurados? (idéntico path 3)
      const scopeAvailable = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(topicScope)
        .innerJoin(topics, eq(topics.id, topicScope.topicId))
        .where(eq(topics.positionType, positionType))
        .limit(1)
      const hasScopes = (scopeAvailable[0]?.n ?? 0) > 0

      const hasTopicFilter = !!topicNumber && topicNumber > 0
      const scopeFilter = hasScopes
        ? (hasTopicFilter
            ? sql`EXISTS (
                SELECT 1 FROM ${topicScope} ts
                INNER JOIN ${topics} t ON t.id = ts.topic_id
                CROSS JOIN LATERAL unnest(ts.article_numbers) AS an(num)
                WHERE ts.law_id = ${articles.lawId}
                  AND t.position_type = ${positionType}
                  AND t.topic_number = ${topicNumber}
                  AND an.num = ${articles.articleNumber}::text
              )`
            : sql`EXISTS (
                SELECT 1 FROM ${topicScope} ts
                INNER JOIN ${topics} t ON t.id = ts.topic_id
                CROSS JOIN LATERAL unnest(ts.article_numbers) AS an(num)
                WHERE ts.law_id = ${articles.lawId}
                  AND t.position_type = ${positionType}
                  AND an.num = ${articles.articleNumber}::text
              )`)
        : sql`true`

      const failedQuestions = await db
        .select({ ...questionColumns, ...articleColumns })
        .from(questions)
        .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
        .innerJoin(laws, eq(articles.lawId, laws.id))
        .where(and(
          eq(questions.isActive, true),
          isNull(questions.examCaseId), // casos prácticos solo en exam oficial
          inArray(questions.id, failedQuestionIds),
          scopeFilter,
        ))

      // Ordenar según el orden de failedQuestionIds (mantener orden original)
      const questionMap = new Map(failedQuestions.map(q => [q.id, q]))
      const orderedQuestions = failedQuestionIds
        .map(id => questionMap.get(id))
        .filter((q): q is NonNullable<typeof q> => q !== undefined)

      const missing = failedQuestionIds.length - orderedQuestions.length
      if (missing > 0) {
        console.warn(`⚠️ [failed-questions-ids] ${missing} preguntas no encontradas, inactivas u out-of-scope para ${positionType}${hasTopicFilter ? `/T${topicNumber}` : ''} (de ${failedQuestionIds.length})`)
        // Telemetría: detectar cambio de oposición (failedQuestionIds del histórico
        // anterior). Severity=info — no es bug, es síntoma de UX (caso Cristina).
        if (hasScopes && missing >= failedQuestionIds.length / 2 && userId) {
          logValidationError({
            endpoint: '/api/questions/filtered',
            errorType: 'failed_ids_out_of_scope',
            errorMessage: `${missing}/${failedQuestionIds.length} IDs out-of-scope para ${positionType}${hasTopicFilter ? `/T${topicNumber}` : ''}. Posible cambio de oposición.`,
            severity: 'info',
            userId,
          })
        }
      }

      const finalQuestions = orderedQuestions.slice(0, numQuestions)

      console.log(`✅ [failed-questions-ids] ${finalQuestions.length} preguntas${missing > 0 ? ` (${missing} no encontradas)` : ''}`)

      // Transformar al formato esperado
      const transformedQuestions = finalQuestions.map((q, i) => transformQuestion({ ...q, sourceTopic: topicNumber || null } as QuestionRow, i))

      return {
        success: true,
        questions: transformedQuestions,
        totalAvailable: failedQuestionIds.length,
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

    // 🆕 MODO GLOBAL: Si no hay tema ni ley, filtrar por topic_scope del positionType
    // IMPORTANTE: NO hacer query sin scope — causaría que leyes de otras oposiciones
    // (ej: LECrim para tramitacion_procesal) aparezcan en tests de auxiliar_administrativo.
    const isGlobalMode = topicsToQuery.length === 0 && !isLawOnlyMode

    if (isGlobalMode) {
      console.log(`🎯 Modo global con scope: Buscando ${numQuestions} preguntas de "${positionType}"`)

      // Fuente de verdad centralizada: helper getAllowedLawIds.
      // Deriva positionType de user_profiles.target_oposicion si hay userId.
      const allowed = await getAllowedLawIds({
        userId,
        fallbackPositionType: positionType,
      })
      const validLawIds = allowed.lawIds

      if (validLawIds.length === 0) {
        console.warn(`⚠️ Modo global: no hay topic_scope configurado para "${positionType}"`)
        return {
          success: true,
          questions: [],
          totalAvailable: 0,
          filtersApplied: { laws: 0, articles: 0, sections: 0 },
          emptyReason: `No hay contenido configurado para la oposición "${positionType}"`,
        }
      }

      console.log(`🔍 Modo global: ${validLawIds.length} leyes válidas para "${positionType}"`)

      const globalQuestions = await db
        .select({ ...questionColumns, ...articleColumns })
        .from(questions)
        .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
        .innerJoin(laws, eq(articles.lawId, laws.id))
        .where(and(
          eq(questions.isActive, true),
          isNull(questions.examCaseId), // casos prácticos solo en exam oficial
          inArray(laws.id, validLawIds),
          // 🏛️ Filtro anti-contaminación de OFICIALES — ver comentario en
          // queryQuestionsForMappingsLightweight. Aplica SIEMPRE salvo opt-in.
          includeSharedOfficials ? sql`true` : buildOfficialExamFilter(positionType),
          onlyOfficialQuestions ? eq(questions.isOfficialExam, true) : sql`true`,
        ))
        .orderBy(sql`RANDOM()`)
        .limit(numQuestions)

      if (!globalQuestions || globalQuestions.length === 0) {
        return {
          success: true,
          questions: [],
          totalAvailable: 0,
          filtersApplied: { laws: validLawIds.length, articles: 0, sections: 0 },
          emptyReason: `No hay preguntas disponibles para la oposición "${positionType}"`,
        }
      }

      console.log(`✅ Modo global: ${globalQuestions.length} preguntas de ${validLawIds.length} leyes válidas`)

      const transformedQuestions = globalQuestions.map((q, i) =>
        transformQuestion({ ...q, sourceTopic: null } as QuestionRow, i)
      )

      return {
        success: true,
        questions: transformedQuestions,
        totalAvailable: globalQuestions.length,
        filtersApplied: {
          laws: validLawIds.length,
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

      // Post-16/04/2026 (caso M, daluamva): en modo ley-only NO aplicamos
      // scope-check de leyes. El usuario ha entrado a /leyes/[slug]
      // explícitamente — sabe lo que quiere. Coherente con la promesa de
      // /premium ("estudia varias oposiciones a la vez").
      //
      // Post-26/05/2026 (caso Sergio, dispute 3135c4f2): el filtro
      // anti-contaminación de OFICIALES (buildOfficialExamFilter — caso Laura)
      // ahora se aplica SIEMPRE en queryQuestionsForMappingsLightweight, no
      // solo en modo only-oficial. Antes los call-sites lo condicionaban a
      // onlyOfficialQuestions y oficiales de otra oposición vinculadas a
      // leyes estatales compartidas (CE, L39, L40, TREBEP…) se colaban en
      // tests practice — Sergio (Estado) recibió una oficial de Andalucía
      // en /leyes/rdl-5-2015/avanzado. El opt-in sigue siendo el toggle
      // includeSharedOfficials del premium.
      //
      // El scope-check del modo tema/global (bug Mar — dispute 4e247ddc) se
      // mantiene intacto porque allí el sistema elige la ley, no el usuario.
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
          success: true,
          questions: [],
          totalAvailable: 0,
          filtersApplied: { laws: 0, articles: 0, sections: 0 },
          emptyReason: `Los temas seleccionados no tienen preguntas asignadas todavía`,
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
        success: true,
        questions: [],
        totalAvailable: 0,
        filtersApplied: { laws: selectedLaws?.length || 0, articles: Object.keys(selectedArticlesByLaw || {}).length, sections: selectedSectionFilters?.length || 0 },
        emptyReason: `No hay preguntas para las leyes o artículos seleccionados`,
      }
    }

    // 5️⃣ Q1 LIGERA: trae {id, articleNumber, lawShortName, isOfficialExam} +
    // sourceTopic (añadido en JS desde mapping). 5 cols vs 25 — payload de
    // ~250 KB en vez de ~5 MB para 2.5k candidatos. Filtros idénticos al
    // path 1-4 (tag, exam_position, difficulty NULL coalesce, isActive).
    const allQuestions = await queryQuestionsForMappingsLightweight(db, filteredMappings, {
      positionType,
      onlyOfficialQuestions,
      includeSharedOfficials,
      difficultyMode,
      tagFilter,
    })

    if (allQuestions.length === 0) {
      const reasons: string[] = []
      if (difficultyMode && difficultyMode !== 'random') reasons.push(`dificultad "${difficultyMode}"`)
      if (onlyOfficialQuestions) reasons.push('solo preguntas oficiales')
      if (selectedLaws?.length) reasons.push(`leyes: ${selectedLaws.join(', ')}`)
      return {
        success: true,
        questions: [],
        totalAvailable: 0,
        filtersApplied: { laws: selectedLaws?.length || 0, articles: Object.keys(selectedArticlesByLaw || {}).length, sections: selectedSectionFilters?.length || 0 },
        emptyReason: reasons.length > 0
          ? `No hay preguntas con los filtros: ${reasons.join(', ')}`
          : 'No hay preguntas disponibles para esta configuración',
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

    finalQuestions = finalQuestions.filter(Boolean)

    // 7b. Distribución proporcional por artículo (evita que artículos con muchas
    // preguntas monopolicen).
    //
    // IMPORTANTE: si ya se aplicó `proportionalByTopic` (multi-topic), SKIPEAR
    // este paso. selectProportionallyByArticle hace round-robin por artículo
    // único usando el pool ENTERO, lo que rehace la selección y rompe el
    // balance por topic. Caso real (bug Nila 15/05): test aleatorio "ambos
    // bloques" devolvía 94% Bloque I / 6% Bloque II porque Bloque I tiene
    // 1094 artículos únicos vs 172 de Bloque II — el round-robin por artículo
    // mata el balance hecho por topic.
    const skipArticleRedistribution = proportionalByTopic && topicsToQuery.length > 1
    if (finalQuestions.length > 3 && !skipArticleRedistribution) {
      finalQuestions = selectProportionallyByArticle(
        finalQuestions,
        sortedQuestions,
        numQuestions,
        { log: true }
      )
    }

    if (!finalQuestions || !Array.isArray(finalQuestions)) {
      console.error('❌ finalQuestions es undefined o no es array:', typeof finalQuestions)
      return {
        success: false,
        error: 'Error interno: resultado de preguntas inválido',
      }
    }

    // 8️⃣ Q2 HIDRATACIÓN: trae filas completas para los IDs ganadores.
    // Postgres no garantiza orden de WHERE id IN (...) → Map preserva orden
    // de selección JS. Si una pregunta fue desactivada entre Q1 y Q2 (race
    // muy poco probable, microsegundos), se loguea warn y se skippea.
    const selectedIds = finalQuestions.map(q => q.id).filter(Boolean)
    const hydrated = await hydrateSelectedQuestions(db, selectedIds)

    const orderedRows: QuestionRow[] = []
    let droppedDuringHydration = 0
    for (const lite of finalQuestions) {
      const full = hydrated.get(lite.id)
      if (!full) {
        droppedDuringHydration++
        continue
      }
      orderedRows.push({ ...full, sourceTopic: lite.sourceTopic })
    }
    if (droppedDuringHydration > 0) {
      console.warn(`⚠️ [hydrate] ${droppedDuringHydration}/${selectedIds.length} preguntas dropeadas (race con desactivación)`)
    }

    const transformedQuestions: FilteredQuestion[] = orderedRows.map((q, i) => transformQuestion(q, i))

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
    // Canary pooler propio (Fase 3) si flag ON, replica fallback. Count totalmente tolerable a stale.
    const db = getFilteredCountDb()
    const {
      topicNumber,
      positionType,
      selectedLaws,
      selectedArticlesByLaw,
      selectedSectionFilters,
      onlyOfficialQuestions,
      includeSharedOfficials,
    } = params

    // 🏷️ Tag filter (same logic as getFilteredQuestions)
    const opoConfigCount = getOposicionByPositionType(positionType)
    const questionTagCount = opoConfigCount?.questionTag ?? null
    const tagFilterCount = questionTagCount
      ? sql`${questions.tags} @> ARRAY[${sql.raw(`'${questionTagCount}'`)}]::text[]`
      : EXCLUSIVE_QUESTION_TAGS.length > 0
        ? sql`(${questions.tags} IS NULL OR NOT (${questions.tags} && ARRAY[${sql.raw(EXCLUSIVE_QUESTION_TAGS.map(t => `'${t}'`).join(','))}]::text[]))`
        : sql`true`

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
        success: true,
        count: 0,
        byLaw: {},
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
          isNull(questions.examCaseId), // casos prácticos solo en exam oficial
          eq(articles.lawId, mapping.lawId!),
          ...(hasSpecificArticles ? [inArray(articles.articleNumber, mapping.articleNumbers!)] : []),
          // 🏛️ Filtro anti-contaminación de OFICIALES — aplica SIEMPRE salvo opt-in.
          // Ver comentario en queryQuestionsForMappingsLightweight.
          includeSharedOfficials ? sql`true` : buildOfficialExamFilter(positionType),
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
            : sql`true`,
          tagFilterCount,
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
