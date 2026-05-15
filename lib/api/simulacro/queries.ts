// lib/api/simulacro/queries.ts
// Simulacro de examen: genera 110 preguntas aleatorias del catálogo replicando
// la distribución oficial (Aux Admin Estado: 30 leg I + 30 psicotécnicas + 50 Bloque II).
//
// Diferencia con `getOfficialExamQuestions`:
// - Examen oficial → preguntas FIJAS de una convocatoria histórica concreta
// - Simulacro      → preguntas ALEATORIAS del catálogo con misma distribución

import { getDb, getPoolerDb } from '@/db/client'
import { questions, psychometricQuestions, articles, laws, topics, topicScope } from '@/db/schema'
import { eq, and, inArray, sql, ilike } from 'drizzle-orm'
import type {
  GetSimulacroQuestionsRequest,
  GetSimulacroQuestionsResponse,
} from './schemas'
import type { OfficialExamQuestion } from '../official-exams/schemas'

function getSimulacroDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}

// ============================================
// CONFIGURACIÓN POR OPOSICIÓN
// ============================================
//
// distLegI / distPsicotecnico / distLegII: cuántas preguntas de cada tipo.
// blockI / blockII: rangos de topic_number que componen cada bloque.
// examSourcePattern: filtro para buscar psicotécnicas oficiales y derivar examFrequency.

interface SimulacroOpoConfig {
  positionType: string
  examSourcePattern: string
  blockI: { minTopic: number; maxTopic: number; count: number }
  psicotecnicaCount: number
  blockII: { minTopic: number; maxTopic: number; count: number }
  durationMinutes: number
  // Desglose en formato bases oficiales de la convocatoria (Primera/Segunda parte)
  breakdown: string[]
}

// Bases oficiales Aux Admin Estado (BOE convocatoria 9 julio 2024, OEP 2023-2024):
//   Primera parte: 60 preguntas = 30 bloque I del programa + 30 psicotécnicas (50 pts)
//   Segunda parte: 50 preguntas ejercicio práctico de ofimática (50 pts)
//   Duración total: 90 min · Penalización: 1/3 por respuesta incorrecta
const SIMULACRO_CONFIGS: Record<string, SimulacroOpoConfig> = {
  'auxiliar-administrativo-estado': {
    positionType: 'auxiliar_administrativo_estado',
    examSourcePattern: '%Auxiliar Administrativo Estado%',
    blockI: { minTopic: 1, maxTopic: 99, count: 30 },
    psicotecnicaCount: 30,
    blockII: { minTopic: 100, maxTopic: 999, count: 50 },
    durationMinutes: 90,
    breakdown: [
      'Primera parte (60): 30 del Bloque I del programa + 30 psicotécnicas',
      'Segunda parte (50): ejercicio práctico de ofimática (Windows + Microsoft 365)',
    ],
  },
}

// ============================================
// HELPERS
// ============================================

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Sacar IDs de artículos que componen un bloque (rango de topic_number) de
 * una oposición. Devuelve el conjunto de article_ids para usar como filtro
 * en preguntas.
 */
async function getArticleIdsForBlock(
  positionType: string,
  minTopic: number,
  maxTopic: number,
): Promise<string[]> {
  const db = getSimulacroDb()

  // Topics de la oposición en el rango
  const topicsRows = await db
    .select({ id: topics.id })
    .from(topics)
    .where(
      and(
        eq(topics.positionType, positionType),
        sql`${topics.topicNumber} >= ${minTopic}`,
        sql`${topics.topicNumber} <= ${maxTopic}`,
      ),
    )

  const topicIds = topicsRows.map((t) => t.id)
  if (topicIds.length === 0) return []

  // topic_scope (law_id + article_numbers[])
  const scopes = await db
    .select({
      lawId: topicScope.lawId,
      articleNumbers: topicScope.articleNumbers,
    })
    .from(topicScope)
    .where(inArray(topicScope.topicId, topicIds))

  // Agrupar por law_id → set de article_numbers
  const lawToArtNums = new Map<string, Set<string>>()
  for (const s of scopes) {
    if (!s.lawId || !s.articleNumbers) continue
    if (!lawToArtNums.has(s.lawId)) lawToArtNums.set(s.lawId, new Set())
    const set = lawToArtNums.get(s.lawId)!
    for (const n of s.articleNumbers as string[]) set.add(n)
  }

  // Resolver article_id por (law_id, article_number)
  const allArticleIds: string[] = []
  for (const [lawId, nums] of lawToArtNums.entries()) {
    if (nums.size === 0) continue
    const arts = await db
      .select({ id: articles.id })
      .from(articles)
      .where(
        and(
          eq(articles.lawId, lawId),
          inArray(articles.articleNumber, [...nums]),
        ),
      )
    for (const a of arts) allArticleIds.push(a.id)
  }
  return allArticleIds
}

/**
 * Sacar subtipos psicotécnicos que aparecen en exámenes oficiales de esta oposición
 * (mismo cálculo que usa el sistema examFrequency). Devuelve un array de subtipos
 * priorizado: primero los `frequent` (≥3 exámenes distintos), luego los `appears`.
 */
async function getEligiblePsychometricSubtypes(
  examSourcePattern: string,
): Promise<string[]> {
  const db = getSimulacroDb()

  const rows = await db
    .select({
      subtype: psychometricQuestions.questionSubtype,
      examCount: sql<number>`count(DISTINCT ${psychometricQuestions.examSource})::int`,
    })
    .from(psychometricQuestions)
    .where(
      and(
        eq(psychometricQuestions.isOfficialExam, true),
        eq(psychometricQuestions.isActive, true),
        ilike(psychometricQuestions.examSource, examSourcePattern),
      ),
    )
    .groupBy(psychometricQuestions.questionSubtype)

  // Ordenar: examCount DESC (frequent primero)
  const sorted = rows
    .filter((r) => r.subtype && r.examCount > 0)
    .sort((a, b) => b.examCount - a.examCount)

  return sorted.map((r) => r.subtype as string)
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
    const db = getSimulacroDb()

    console.log(`🎯 [Simulacro] Generando para ${oposicion}: ${config.blockI.count} leg I + ${config.psicotecnicaCount} psico + ${config.blockII.count} leg II`)

    // ---------------------------------------
    // PARTE 1: 30 preguntas legislativas BLOQUE I (aleatorias)
    // ---------------------------------------
    const blockIArticleIds = await getArticleIdsForBlock(
      config.positionType,
      config.blockI.minTopic,
      config.blockI.maxTopic,
    )

    if (blockIArticleIds.length === 0) {
      return { success: false, error: 'No se encontraron artículos del Bloque I' }
    }

    const blockIQuestions = await db
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
          inArray(questions.primaryArticleId, blockIArticleIds),
        ),
      )
      .orderBy(sql`random()`)
      .limit(config.blockI.count)

    console.log(`✅ [Simulacro] Bloque I: ${blockIQuestions.length}/${config.blockI.count} preguntas`)

    // ---------------------------------------
    // PARTE 2: 30 psicotécnicas (de subtipos que caen en esta oposición)
    // ---------------------------------------
    const eligibleSubtypes = await getEligiblePsychometricSubtypes(
      config.examSourcePattern,
    )

    if (eligibleSubtypes.length === 0) {
      return {
        success: false,
        error: 'No se encontraron subtipos psicotécnicos elegibles para esta oposición',
      }
    }

    const psicotecnicaQuestions = await db
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
          inArray(psychometricQuestions.questionSubtype, eligibleSubtypes),
        ),
      )
      .orderBy(sql`random()`)
      .limit(config.psicotecnicaCount)

    console.log(`✅ [Simulacro] Psicotécnicas: ${psicotecnicaQuestions.length}/${config.psicotecnicaCount} preguntas (${eligibleSubtypes.length} subtipos elegibles)`)

    // ---------------------------------------
    // PARTE 3: 50 preguntas legislativas BLOQUE II (aleatorias)
    // ---------------------------------------
    const blockIIArticleIds = await getArticleIdsForBlock(
      config.positionType,
      config.blockII.minTopic,
      config.blockII.maxTopic,
    )

    if (blockIIArticleIds.length === 0) {
      return { success: false, error: 'No se encontraron artículos del Bloque II' }
    }

    const blockIIQuestions = await db
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
          inArray(questions.primaryArticleId, blockIIArticleIds),
        ),
      )
      .orderBy(sql`random()`)
      .limit(config.blockII.count)

    console.log(`✅ [Simulacro] Bloque II: ${blockIIQuestions.length}/${config.blockII.count} preguntas`)

    // ---------------------------------------
    // FORMATEAR (mismo formato que getOfficialExamQuestions)
    // ---------------------------------------
    const formattedBlockI: OfficialExamQuestion[] = shuffleArray(blockIQuestions).map((q) => ({
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

    const formattedPsico: OfficialExamQuestion[] = shuffleArray(psicotecnicaQuestions).map((q) => ({
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

    const formattedBlockII: OfficialExamQuestion[] = shuffleArray(blockIIQuestions).map((q) => ({
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
