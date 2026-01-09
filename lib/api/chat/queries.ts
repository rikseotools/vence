// lib/api/chat/queries.ts - Queries tipadas para el chat AI
import { getDb } from '@/db/client'
import {
  topics,
  topicScope,
  oposiciones,
  questions,
  articles,
  laws,
  userQuestionHistory,
  userProfiles,
  aiApiConfig
} from '@/db/schema'
import { eq, and, inArray, ilike, desc, sql, isNotNull } from 'drizzle-orm'

// Mapeo de oposición del usuario a position_type de topics
const OPOSICION_TO_POSITION_TYPE: Record<string, string> = {
  'auxiliar_administrativo_estado': 'auxiliar_administrativo',
  'administrativo_estado': 'administrativo',
  'gestion_procesal': 'gestion_procesal'
}

// ============================================
// TEMARIO
// ============================================
export type TopicInfo = {
  topicNumber: number
  title: string
  description: string | null
}

export async function getTemario(
  userOposicion: string | null,
  limit = 50
): Promise<TopicInfo[]> {
  if (!userOposicion) return []

  const positionType = OPOSICION_TO_POSITION_TYPE[userOposicion]
  if (!positionType) return []

  const result = await getDb()
    .select({
      topicNumber: topics.topicNumber,
      title: topics.title,
      description: topics.description
    })
    .from(topics)
    .where(and(
      eq(topics.positionType, positionType),
      eq(topics.isActive, true)
    ))
    .orderBy(topics.topicNumber)
    .limit(limit)

  return result
}

// ============================================
// LEYES DE OPOSICIÓN
// ============================================
export async function getOposicionLawIds(userOposicion: string | null): Promise<string[]> {
  if (!userOposicion) return []

  const positionType = OPOSICION_TO_POSITION_TYPE[userOposicion]
  if (!positionType) return []

  // Obtener todos los topics de esta oposición
  const topicsResult = await getDb()
    .select({ id: topics.id })
    .from(topics)
    .where(eq(topics.positionType, positionType))

  if (topicsResult.length === 0) return []

  const topicIds = topicsResult.map(t => t.id)

  // Obtener las leyes de estos topics desde topic_scope
  const scopesResult = await getDb()
    .select({ lawId: topicScope.lawId })
    .from(topicScope)
    .where(inArray(topicScope.topicId, topicIds))

  if (scopesResult.length === 0) return []

  // Retornar IDs únicos de leyes
  const lawIds = scopesResult
    .map(s => s.lawId)
    .filter((id): id is string => id !== null)

  return [...new Set(lawIds)]
}

// ============================================
// INFORMACIÓN DE OPOSICIÓN
// ============================================
export type OposicionInfo = {
  id: string
  nombre: string
  plazasLibres: number | null
  plazasPromocionInterna: number | null
  plazasDiscapacidad: number | null
  examDate: string | null
  inscriptionStart: string | null
  inscriptionDeadline: string | null
  tituloRequerido: string | null
  salarioMin: number | null
  salarioMax: number | null
  isConvocatoriaActiva: boolean | null
  boeReference: string | null
}

export async function getOposicionInfo(userOposicion: string): Promise<OposicionInfo | null> {
  const oposicionMap: Record<string, string> = {
    'auxiliar_administrativo_estado': 'Auxiliar Administrativo del Estado',
    'administrativo_estado': 'Cuerpo General Administrativo de la Administración del Estado'
  }

  const oposicionNombre = oposicionMap[userOposicion]
  if (!oposicionNombre) return null

  // Buscar por nombre similar
  const searchTerm = userOposicion.includes('auxiliar') ? 'Auxiliar' : 'Administrativo'

  const result = await getDb()
    .select({
      id: oposiciones.id,
      nombre: oposiciones.nombre,
      plazasLibres: oposiciones.plazasLibres,
      plazasPromocionInterna: oposiciones.plazasPromocionInterna,
      plazasDiscapacidad: oposiciones.plazasDiscapacidad,
      examDate: oposiciones.examDate,
      inscriptionStart: oposiciones.inscriptionStart,
      inscriptionDeadline: oposiciones.inscriptionDeadline,
      tituloRequerido: oposiciones.tituloRequerido,
      salarioMin: oposiciones.salarioMin,
      salarioMax: oposiciones.salarioMax,
      isConvocatoriaActiva: oposiciones.isConvocatoriaActiva,
      boeReference: oposiciones.boeReference
    })
    .from(oposiciones)
    .where(and(
      ilike(oposiciones.nombre, `%${searchTerm}%`),
      eq(oposiciones.isActive, true)
    ))
    .limit(1)

  return result[0] || null
}

// ============================================
// API KEY
// ============================================
export async function getOpenAIKey(): Promise<string | null> {
  const result = await getDb()
    .select({ apiKeyEncrypted: aiApiConfig.apiKeyEncrypted })
    .from(aiApiConfig)
    .where(and(
      eq(aiApiConfig.provider, 'openai'),
      eq(aiApiConfig.isActive, true)
    ))
    .limit(1)

  if (!result[0]?.apiKeyEncrypted) return null

  return Buffer.from(result[0].apiKeyEncrypted, 'base64').toString('utf-8')
}

// ============================================
// OPOSICIÓN DEL USUARIO
// ============================================
export async function getUserOposicion(userId: string): Promise<string | null> {
  const result = await getDb()
    .select({ targetOposicion: userProfiles.targetOposicion })
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1)

  return result[0]?.targetOposicion || null
}

// ============================================
// ESTADÍSTICAS DE EXAMEN
// ============================================
export type ExamArticleStat = {
  articleNumber: string
  lawShortName: string
  lawName: string
  count: number
}

export async function getExamStats(
  lawShortName: string | null = null,
  limit = 15,
  examPosition: string | null = null
): Promise<ExamArticleStat[]> {
  // Query base con join a articles y laws
  let query = getDb()
    .select({
      articleNumber: articles.articleNumber,
      lawShortName: laws.shortName,
      lawName: laws.name,
      questionId: questions.id
    })
    .from(questions)
    .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
    .innerJoin(laws, eq(articles.lawId, laws.id))
    .where(and(
      eq(questions.isOfficialExam, true),
      eq(questions.isActive, true),
      isNotNull(questions.primaryArticleId)
    ))
    .$dynamic()

  // Filtrar por ley si se especifica
  if (lawShortName) {
    query = query.where(eq(laws.shortName, lawShortName))
  }

  // Filtrar por posición de examen si se especifica
  if (examPosition) {
    query = query.where(eq(questions.examPosition, examPosition))
  }

  const results = await query

  // Agrupar y contar manualmente (Drizzle no soporta GROUP BY con count fácilmente)
  const counts = new Map<string, ExamArticleStat>()

  for (const row of results) {
    if (!row.articleNumber || !row.lawShortName) continue

    const key = `${row.lawShortName}-${row.articleNumber}`
    const existing = counts.get(key)

    if (existing) {
      existing.count++
    } else {
      counts.set(key, {
        articleNumber: row.articleNumber,
        lawShortName: row.lawShortName,
        lawName: row.lawName || '',
        count: 1
      })
    }
  }

  // Ordenar por count descendente y limitar
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

// ============================================
// ESTADÍSTICAS DEL USUARIO
// ============================================
export type UserArticleStat = {
  articleNumber: string
  lawShortName: string
  totalAnswers: number
  correctAnswers: number
  accuracy: number
}

export async function getUserStats(
  userId: string,
  lawShortName: string | null = null,
  limit = 10
): Promise<UserArticleStat[]> {
  // Query con join a questions, articles y laws
  // userQuestionHistory almacena datos agregados por pregunta (totalAttempts, correctAttempts)
  let query = getDb()
    .select({
      articleNumber: articles.articleNumber,
      lawShortName: laws.shortName,
      totalAttempts: userQuestionHistory.totalAttempts,
      correctAttempts: userQuestionHistory.correctAttempts
    })
    .from(userQuestionHistory)
    .innerJoin(questions, eq(userQuestionHistory.questionId, questions.id))
    .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
    .innerJoin(laws, eq(articles.lawId, laws.id))
    .where(and(
      eq(userQuestionHistory.userId, userId),
      isNotNull(questions.primaryArticleId)
    ))
    .$dynamic()

  if (lawShortName) {
    query = query.where(eq(laws.shortName, lawShortName))
  }

  const results = await query

  // Agrupar y calcular estadísticas por artículo
  const stats = new Map<string, { total: number; correct: number; articleNumber: string; lawShortName: string }>()

  for (const row of results) {
    if (!row.articleNumber || !row.lawShortName) continue

    const key = `${row.lawShortName}-${row.articleNumber}`
    const existing = stats.get(key)
    const rowTotal = row.totalAttempts || 0
    const rowCorrect = row.correctAttempts || 0

    if (existing) {
      existing.total += rowTotal
      existing.correct += rowCorrect
    } else {
      stats.set(key, {
        articleNumber: row.articleNumber,
        lawShortName: row.lawShortName,
        total: rowTotal,
        correct: rowCorrect
      })
    }
  }

  // Convertir a array con accuracy y ordenar por más fallados
  return Array.from(stats.values())
    .map(s => ({
      articleNumber: s.articleNumber,
      lawShortName: s.lawShortName,
      totalAnswers: s.total,
      correctAnswers: s.correct,
      accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0
    }))
    .sort((a, b) => a.accuracy - b.accuracy) // Menor accuracy primero (más fallados)
    .slice(0, limit)
}
