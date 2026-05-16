// lib/api/simulacro/queries.ts
// Simulacro de examen: genera 110 preguntas aleatorias del catálogo replicando
// la distribución oficial (Aux Admin Estado: 30 leg I + 30 psicotécnicas + 50 Bloque II).
//
// Diferencia con `getOfficialExamQuestions`:
// - Examen oficial → preguntas FIJAS de una convocatoria histórica concreta
// - Simulacro      → preguntas ALEATORIAS del catálogo con misma distribución
//
// Selección PROPORCIONAL: los topics (Bloque I/II) y los subtypes
// (psicotécnicas) NO se sortean uniformemente. Se calculan PESOS desde el
// histórico de exámenes oficiales (>= 2019) y se reparten los slots con el
// método Hamilton (largest remainder). Así un simulacro replica la composición
// real del examen, no una distribución plana sesgada por nº de preguntas en
// catálogo.

import { getDb, getPoolerDb } from '@/db/client'
import { questions, psychometricQuestions, articles, laws, topics, topicScope } from '@/db/schema'
import { eq, and, inArray, sql, ilike, gte } from 'drizzle-orm'
import type {
  GetSimulacroQuestionsRequest,
  GetSimulacroQuestionsResponse,
} from './schemas'
import type { OfficialExamQuestion } from '../official-exams/schemas'
import { distributeSlots, redistributeShortfall } from './proportionalSampling'

function getSimulacroDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}

// ============================================
// CONFIGURACIÓN POR OPOSICIÓN
// ============================================
//
// blockI / blockII: lista EXPLÍCITA de topic_numbers que componen cada parte
// del examen oficial (no rangos). Más robusto que minTopic/maxTopic: si en
// el futuro se crean topics 200+ para esta o cualquier otra oposición, no
// se cuelan por accidente en el simulacro de otra.
// examSourcePattern: filtro para buscar psicotécnicas oficiales.
// historicalSinceDate: fecha mínima para calcular pesos (convocatorias previas
//   pueden tener temarios obsoletos — para Aux Admin Estado, 2019+ ya cubre
//   las 4 convocatorias modernas con el temario actual).

interface SimulacroOpoConfig {
  positionType: string
  examSourcePattern: string
  blockI: { topicNumbers: number[]; count: number; parteFilter: string }
  psicotecnicaCount: number
  blockII: { topicNumbers: number[]; count: number; parteFilter: string }
  durationMinutes: number
  historicalSinceDate: string
  breakdown: string[]
}

// Bases oficiales Aux Admin Estado (BOE-A-2025-26262, convocatoria 22 dic 2025):
//   Primera parte:  60 preguntas = 30 Bloque I del programa + 30 psicotécnicas (50 pts)
//   Segunda parte:  50 preguntas sobre las materias del Bloque II del programa
//                   (atención al ciudadano, administración electrónica, ofimática
//                   Windows 11 + Microsoft 365 versión escritorio…) (50 pts)
//   Duración total: 90 min · Penalización: 1/3 por respuesta incorrecta
const SIMULACRO_CONFIGS: Record<string, SimulacroOpoConfig> = {
  'auxiliar-administrativo-estado': {
    positionType: 'auxiliar_administrativo_estado',
    examSourcePattern: '%Auxiliar Administrativo Estado%',
    historicalSinceDate: '2019-01-01',
    blockI: {
      topicNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
      count: 30,
      parteFilter: '%Primera parte%',
    },
    psicotecnicaCount: 30,
    blockII: {
      topicNumbers: [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112],
      count: 50,
      parteFilter: '%Segunda parte%',
    },
    durationMinutes: 90,
    breakdown: [
      'Primera parte (60): 30 del Bloque I del programa + 30 psicotécnicas',
      'Segunda parte (50): Bloque II — actividad administrativa + ofimática (Windows 11 y Microsoft 365)',
    ],
  },
}

// ============================================
// HELPERS GENÉRICOS
// ============================================

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// ============================================
// HELPERS DE SCOPE (topic ↔ artículos)
// ============================================

/**
 * Para una lista de topic_numbers de la oposición, devuelve un mapa
 * { topic_number → article_ids[] }. Permite samplear por topic individual
 * (no por bloque entero como antes).
 */
async function getArticleIdsByTopic(
  positionType: string,
  topicNumbers: number[],
): Promise<Map<number, string[]>> {
  const result = new Map<number, string[]>()
  if (topicNumbers.length === 0) return result
  const db = getSimulacroDb()

  // 1. Topics de la oposición
  const topicsRows = await db
    .select({ id: topics.id, topicNumber: topics.topicNumber })
    .from(topics)
    .where(
      and(
        eq(topics.positionType, positionType),
        inArray(topics.topicNumber, topicNumbers),
      ),
    )

  if (topicsRows.length === 0) return result

  // 2. topic_scope de cada topic
  const topicIds = topicsRows.map((t) => t.id)
  const scopes = await db
    .select({
      topicId: topicScope.topicId,
      lawId: topicScope.lawId,
      articleNumbers: topicScope.articleNumbers,
    })
    .from(topicScope)
    .where(inArray(topicScope.topicId, topicIds))

  // 3. Para cada scope, resolver article_ids. Cachear queries por law_id
  //    para no repetir.
  const articleCache = new Map<string, Map<string, string>>() // law_id → (article_number → article_id)

  for (const t of topicsRows) {
    const topicScopes = scopes.filter((s) => s.topicId === t.id)
    const articleIds: string[] = []

    for (const s of topicScopes) {
      if (!s.lawId || !s.articleNumbers) continue
      const nums = s.articleNumbers as string[]
      if (nums.length === 0) continue

      let lawCache = articleCache.get(s.lawId)
      if (!lawCache) {
        const arts = await db
          .select({ id: articles.id, num: articles.articleNumber })
          .from(articles)
          .where(eq(articles.lawId, s.lawId))
        lawCache = new Map(arts.map((a) => [a.num, a.id]))
        articleCache.set(s.lawId, lawCache)
      }

      for (const n of nums) {
        const id = lawCache.get(n)
        if (id) articleIds.push(id)
      }
    }

    if (articleIds.length > 0) result.set(t.topicNumber, articleIds)
  }

  return result
}

// ============================================
// HELPERS DE PESOS (desde histórico oficial)
// ============================================

/**
 * Calcula los pesos (count) por topic_number para una parte del examen,
 * agregando solo preguntas oficiales con `exam_date >= sinceDate` y cuyo
 * `exam_source` matchea `parteFilter`. Filtra a topics de `positionType`.
 *
 * Devuelve Map { topicNumber → count } solo con topics que tienen al menos
 * una pregunta histórica.
 */
async function getTopicWeights(
  positionType: string,
  topicNumbers: number[],
  parteFilter: string,
  sinceDate: string,
): Promise<Map<number, number>> {
  const result = new Map<number, number>()
  if (topicNumbers.length === 0) return result
  const db = getSimulacroDb()

  // Query con el builder de Drizzle. `article_number = ANY(article_numbers)`
  // se expresa como `sql\`a.article_number = ANY(ts.article_numbers)\`` —
  // Drizzle no tiene operador nativo para "scalar = ANY(array)" así que
  // ese trozo queda como SQL raw, pero sin valores → no rompe placeholders.
  const rows = await db
    .select({
      topicNumber: topics.topicNumber,
      cnt: sql<number>`count(*)::int`,
    })
    .from(questions)
    .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
    .innerJoin(
      topicScope,
      and(
        eq(topicScope.lawId, articles.lawId),
        sql`${articles.articleNumber} = ANY(${topicScope.articleNumbers})`,
      ),
    )
    .innerJoin(topics, eq(topics.id, topicScope.topicId))
    .where(
      and(
        eq(questions.isOfficialExam, true),
        ilike(questions.examSource, parteFilter),
        gte(questions.examDate, sinceDate),
        eq(topics.positionType, positionType),
        inArray(topics.topicNumber, topicNumbers),
      ),
    )
    .groupBy(topics.topicNumber)

  for (const r of rows) {
    if (r.topicNumber !== null && r.cnt > 0) {
      result.set(Number(r.topicNumber), Number(r.cnt))
    }
  }

  return result
}

/**
 * Pesos por subtype psicotécnico desde exámenes oficiales de la oposición.
 */
async function getSubtypeWeights(
  examSourcePattern: string,
  sinceDate: string,
): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  const db = getSimulacroDb()

  const rows = await db
    .select({
      subtype: psychometricQuestions.questionSubtype,
      cnt: sql<number>`count(*)::int`,
    })
    .from(psychometricQuestions)
    .where(
      and(
        eq(psychometricQuestions.isOfficialExam, true),
        ilike(psychometricQuestions.examSource, examSourcePattern),
        gte(psychometricQuestions.examDate, sinceDate),
      ),
    )
    .groupBy(psychometricQuestions.questionSubtype)

  for (const r of rows) {
    if (r.subtype && r.cnt > 0) result.set(r.subtype, Number(r.cnt))
  }

  return result
}

// ============================================
// HELPERS DE SAMPLING (por topic / por subtype)
// ============================================

type LegRow = {
  id: string
  questionText: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string | null
  optionE: string | null
  explanation: string | null
  difficulty: string | null
  examSource: string | null
  imageUrl: string | null
  articleNumber: string | null
  lawName: string | null
}

async function sampleLegislativeByArticles(
  articleIds: string[],
  limit: number,
): Promise<LegRow[]> {
  if (articleIds.length === 0 || limit <= 0) return []
  const db = getSimulacroDb()
  return db
    .select({
      id: questions.id,
      questionText: questions.questionText,
      optionA: questions.optionA,
      optionB: questions.optionB,
      optionC: questions.optionC,
      optionD: questions.optionD,
      optionE: questions.optionE,
      explanation: questions.explanation,
      difficulty: questions.difficulty,
      examSource: questions.examSource,
      imageUrl: questions.imageUrl,
      articleNumber: articles.articleNumber,
      lawName: laws.shortName,
    })
    .from(questions)
    .leftJoin(articles, eq(questions.primaryArticleId, articles.id))
    .leftJoin(laws, eq(articles.lawId, laws.id))
    .where(
      and(
        eq(questions.isActive, true),
        inArray(questions.primaryArticleId, articleIds),
      ),
    )
    .orderBy(sql`random()`)
    .limit(limit)
}

type PsyRow = {
  id: string
  questionText: string
  optionA: string | null
  optionB: string | null
  optionC: string | null
  optionD: string | null
  optionE: string | null
  explanation: string | null
  difficulty: string | null
  examSource: string | null
  questionSubtype: string | null
  contentData: unknown
  timeLimitSeconds: number | null
}

async function samplePsychometricBySubtype(
  subtype: string,
  limit: number,
): Promise<PsyRow[]> {
  if (limit <= 0) return []
  const db = getSimulacroDb()
  return db
    .select({
      id: psychometricQuestions.id,
      questionText: psychometricQuestions.questionText,
      optionA: psychometricQuestions.optionA,
      optionB: psychometricQuestions.optionB,
      optionC: psychometricQuestions.optionC,
      optionD: psychometricQuestions.optionD,
      optionE: psychometricQuestions.optionE,
      explanation: psychometricQuestions.explanation,
      difficulty: psychometricQuestions.difficulty,
      examSource: psychometricQuestions.examSource,
      questionSubtype: psychometricQuestions.questionSubtype,
      contentData: psychometricQuestions.contentData,
      timeLimitSeconds: psychometricQuestions.timeLimitSeconds,
    })
    .from(psychometricQuestions)
    .where(
      and(
        eq(psychometricQuestions.isActive, true),
        eq(psychometricQuestions.questionSubtype, subtype),
      ),
    )
    .orderBy(sql`random()`)
    .limit(limit)
}

// ============================================
// SELECCIÓN PROPORCIONAL DE UN BLOQUE LEGISLATIVO
// ============================================

/**
 * Selecciona `totalCount` preguntas legislativas distribuidas
 * proporcionalmente entre los topics del bloque, según pesos históricos.
 * Maneja déficits (topic con menos preguntas en BD de las que pide su slot).
 */
async function sampleLegislativeBlockProportional(
  positionType: string,
  topicNumbers: number[],
  parteFilter: string,
  sinceDate: string,
  totalCount: number,
): Promise<LegRow[]> {
  // 1. Articles disponibles por topic
  const articlesByTopic = await getArticleIdsByTopic(positionType, topicNumbers)

  // 2. Pesos históricos por topic
  const weights = await getTopicWeights(positionType, topicNumbers, parteFilter, sinceDate)

  // 3. Si no hay pesos (oposición nueva), fallback: pesos uniformes 1 por topic
  const weightsForDistrib =
    weights.size > 0
      ? new Map([...weights.entries()].map(([k, v]) => [String(k), v]))
      : new Map([...articlesByTopic.keys()].map((k) => [String(k), 1]))

  // 4. Stock disponible por topic = nº articles (proxy razonable; el LIMIT
  //    real lo decide la BD pero sirve para redistribuir déficits gruesos).
  const availableForRedistrib = new Map<string, number>()
  for (const [tNum, ids] of articlesByTopic.entries()) {
    availableForRedistrib.set(String(tNum), ids.length)
  }

  // 5. Reparto inicial Hamilton
  const initialSlots = distributeSlots(weightsForDistrib, totalCount)

  // 6. Sampling + detección de déficit real (cuántas preguntas devolvió cada topic)
  const results: LegRow[] = []
  const actualAvailable = new Map<string, number>()

  for (const [tNumStr, slots] of initialSlots.entries()) {
    const tNum = Number(tNumStr)
    const articleIds = articlesByTopic.get(tNum) ?? []
    if (slots <= 0 || articleIds.length === 0) {
      actualAvailable.set(tNumStr, 0)
      continue
    }
    const rows = await sampleLegislativeByArticles(articleIds, slots)
    results.push(...rows)
    actualAvailable.set(tNumStr, rows.length)
  }

  // 7. Si falta gente (catálogo insuficiente), redistribuir a topics con stock
  const got = results.length
  const deficit = totalCount - got

  if (deficit > 0) {
    // Estimar stock libre de cada topic excluyendo los ya tomados.
    // Como no consultamos COUNT, usamos articles.length como cota superior:
    // se puede sacar como MUCHO articles.length preguntas (1 por art).
    const stockMap = new Map<string, number>()
    for (const [tNumStr, articleCount] of availableForRedistrib.entries()) {
      const taken = actualAvailable.get(tNumStr) ?? 0
      stockMap.set(tNumStr, Math.max(0, articleCount - taken))
    }
    const extraSlots = distributeSlots(
      new Map([...weightsForDistrib.entries()].filter(([k]) => (stockMap.get(k) ?? 0) > 0)),
      deficit,
    )
    const capped = redistributeShortfall(extraSlots, stockMap, weightsForDistrib)

    for (const [tNumStr, slots] of capped.entries()) {
      if (slots <= 0) continue
      const tNum = Number(tNumStr)
      const articleIds = articlesByTopic.get(tNum) ?? []
      // Sacar `slots` MÁS preguntas — `excludeIds` no implementado por sencillez.
      // El random() puede repetir las ya elegidas; dedupe abajo.
      const rows = await sampleLegislativeByArticles(articleIds, slots * 2) // x2 margen
      for (const r of rows) {
        if (results.length >= totalCount) break
        if (!results.some((x) => x.id === r.id)) results.push(r)
      }
    }
  }

  return results.slice(0, totalCount)
}

// ============================================
// SELECCIÓN PROPORCIONAL DE PSICOTÉCNICAS
// ============================================

async function samplePsychometricProportional(
  examSourcePattern: string,
  sinceDate: string,
  totalCount: number,
): Promise<PsyRow[]> {
  const weights = await getSubtypeWeights(examSourcePattern, sinceDate)

  if (weights.size === 0) {
    // Fallback: sin histórico, coger N aleatorias de cualquier subtype activo
    const db = getSimulacroDb()
    return db
      .select({
        id: psychometricQuestions.id,
        questionText: psychometricQuestions.questionText,
        optionA: psychometricQuestions.optionA,
        optionB: psychometricQuestions.optionB,
        optionC: psychometricQuestions.optionC,
        optionD: psychometricQuestions.optionD,
        optionE: psychometricQuestions.optionE,
        explanation: psychometricQuestions.explanation,
        difficulty: psychometricQuestions.difficulty,
        examSource: psychometricQuestions.examSource,
        questionSubtype: psychometricQuestions.questionSubtype,
        contentData: psychometricQuestions.contentData,
        timeLimitSeconds: psychometricQuestions.timeLimitSeconds,
      })
      .from(psychometricQuestions)
      .where(eq(psychometricQuestions.isActive, true))
      .orderBy(sql`random()`)
      .limit(totalCount)
  }

  const slots = distributeSlots(weights, totalCount)
  const results: PsyRow[] = []

  for (const [subtype, n] of slots.entries()) {
    if (n <= 0) continue
    const rows = await samplePsychometricBySubtype(subtype, n)
    results.push(...rows)
  }

  // Si quedó déficit (catálogo insuficiente en algún subtype), rellenar con
  // un sampling abierto del resto.
  const deficit = totalCount - results.length
  if (deficit > 0) {
    const excludeIds = results.map((r) => r.id)
    const db = getSimulacroDb()
    const filler = await db
      .select({
        id: psychometricQuestions.id,
        questionText: psychometricQuestions.questionText,
        optionA: psychometricQuestions.optionA,
        optionB: psychometricQuestions.optionB,
        optionC: psychometricQuestions.optionC,
        optionD: psychometricQuestions.optionD,
        optionE: psychometricQuestions.optionE,
        explanation: psychometricQuestions.explanation,
        difficulty: psychometricQuestions.difficulty,
        examSource: psychometricQuestions.examSource,
        questionSubtype: psychometricQuestions.questionSubtype,
        contentData: psychometricQuestions.contentData,
        timeLimitSeconds: psychometricQuestions.timeLimitSeconds,
      })
      .from(psychometricQuestions)
      .where(
        and(
          eq(psychometricQuestions.isActive, true),
          inArray(psychometricQuestions.questionSubtype, [...weights.keys()]),
          excludeIds.length > 0
            ? sql`${psychometricQuestions.id} NOT IN (${sql.join(
                excludeIds.map((id) => sql`${id}::uuid`),
                sql`, `,
              )})`
            : sql`true`,
        ),
      )
      .orderBy(sql`random()`)
      .limit(deficit)
    results.push(...filler)
  }

  return results.slice(0, totalCount)
}

// ============================================
// QUERY PRINCIPAL
// ============================================

export async function getSimulacroQuestions(
  params: GetSimulacroQuestionsRequest,
): Promise<GetSimulacroQuestionsResponse> {
  const { oposicion } = params
  const config = SIMULACRO_CONFIGS[oposicion]

  if (!config) {
    return {
      success: false,
      error: `Simulacro no disponible para esta oposición: ${oposicion}`,
    }
  }

  try {
    console.log(
      `🎯 [Simulacro] Generando para ${oposicion}: ${config.blockI.count} leg I + ${config.psicotecnicaCount} psico + ${config.blockII.count} leg II (proporcional)`,
    )

    // PARTE 1: legislativas Bloque I (proporcional por topic)
    const blockIRows = await sampleLegislativeBlockProportional(
      config.positionType,
      config.blockI.topicNumbers,
      config.blockI.parteFilter,
      config.historicalSinceDate,
      config.blockI.count,
    )
    if (blockIRows.length === 0) {
      return { success: false, error: 'No se encontraron preguntas del Bloque I' }
    }
    console.log(`✅ [Simulacro] Bloque I: ${blockIRows.length}/${config.blockI.count}`)

    // PARTE 2: psicotécnicas (proporcional por subtype)
    const psyRows = await samplePsychometricProportional(
      config.examSourcePattern,
      config.historicalSinceDate,
      config.psicotecnicaCount,
    )
    if (psyRows.length === 0) {
      return { success: false, error: 'No se encontraron preguntas psicotécnicas' }
    }
    console.log(`✅ [Simulacro] Psicotécnicas: ${psyRows.length}/${config.psicotecnicaCount}`)

    // PARTE 3: legislativas Bloque II (proporcional por topic)
    const blockIIRows = await sampleLegislativeBlockProportional(
      config.positionType,
      config.blockII.topicNumbers,
      config.blockII.parteFilter,
      config.historicalSinceDate,
      config.blockII.count,
    )
    if (blockIIRows.length === 0) {
      return { success: false, error: 'No se encontraron preguntas del Bloque II' }
    }
    console.log(`✅ [Simulacro] Bloque II: ${blockIIRows.length}/${config.blockII.count}`)

    // ---------------------------------------
    // FORMATEAR (mismo formato que getOfficialExamQuestions)
    // ---------------------------------------
    const formattedBlockI: OfficialExamQuestion[] = shuffleArray(blockIRows).map((q) => ({
      id: q.id,
      questionText: q.questionText,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD ?? null,
      optionE: q.optionE ?? null,
      explanation: q.explanation,
      difficulty: q.difficulty,
      questionType: 'legislative' as const,
      questionSubtype: null,
      examSource: q.examSource,
      isReserva: false,
      contentData: null,
      imageUrl: q.imageUrl || null,
      timeLimitSeconds: null,
      articleNumber: q.articleNumber,
      lawName: q.lawName,
      examCaseId: null,
      examCaseText: null,
      examCaseTitle: null,
    }))

    const formattedPsico: OfficialExamQuestion[] = shuffleArray(psyRows).map((q) => ({
      id: q.id,
      questionText: q.questionText,
      optionA: q.optionA || '',
      optionB: q.optionB || '',
      optionC: q.optionC || '',
      optionD: q.optionD || '',
      optionE: q.optionE || '',
      explanation: q.explanation,
      difficulty: q.difficulty,
      questionType: 'psychometric' as const,
      questionSubtype: q.questionSubtype,
      examSource: q.examSource,
      isReserva: false,
      contentData: q.contentData as Record<string, unknown> | null,
      timeLimitSeconds: q.timeLimitSeconds,
      articleNumber: null,
      lawName: null,
      examCaseId: null,
      examCaseText: null,
      examCaseTitle: null,
    }))

    const formattedBlockII: OfficialExamQuestion[] = shuffleArray(blockIIRows).map((q) => ({
      id: q.id,
      questionText: q.questionText,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD ?? null,
      optionE: q.optionE ?? null,
      explanation: q.explanation,
      difficulty: q.difficulty,
      questionType: 'legislative' as const,
      questionSubtype: null,
      examSource: q.examSource,
      isReserva: false,
      contentData: null,
      imageUrl: q.imageUrl || null,
      timeLimitSeconds: null,
      articleNumber: q.articleNumber,
      lawName: q.lawName,
      examCaseId: null,
      examCaseText: null,
      examCaseTitle: null,
    }))

    // Orden final: leg I → psico → leg II (replica orden examen real)
    const allQuestions = [...formattedBlockI, ...formattedPsico, ...formattedBlockII]
    const legislativeCount = formattedBlockI.length + formattedBlockII.length
    const psychometricCount = formattedPsico.length

    return {
      success: true,
      questions: allQuestions,
      metadata: {
        isSimulacro: true,
        totalQuestions: allQuestions.length,
        durationMinutes: config.durationMinutes,
        legislativeCount,
        psychometricCount,
        reservaCount: 0,
        breakdown: config.breakdown,
      },
    }
  } catch (error) {
    console.error('❌ [Simulacro] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
