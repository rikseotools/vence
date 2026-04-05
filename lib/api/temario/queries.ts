// lib/api/temario/queries.ts - Queries Drizzle para Temario Dinámico
// NOTA: Simplificado - ya no hay sistema de bloqueo, todos los temas son accesibles
import { getDb } from '@/db/client'
import { topics, topicScope, articles, laws, questions } from '@/db/schema'
import { eq, and, inArray, sql, count } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'
import type {
  TopicContent,
  LawWithArticles,
} from './schemas'
import {
  OPOSICIONES,
  type OposicionSlug,
} from './schemas'

import { getValidExamPositions } from '@/lib/config/exam-positions'

// ============================================
// OBTENER CONTENIDO COMPLETO DE UN TEMA
// ============================================

// Tipo interno para contenido cacheado
type TopicContentBase = {
  topicNumber: number
  title: string
  description: string | null
  oposicion: OposicionSlug
  oposicionName: string
  laws: LawWithArticles[]
  totalArticles: number
}

// Función interna que obtiene el contenido del tema
// OPTIMIZADA: Usa queries en batch en lugar de N+1
async function getTopicContentBaseInternal(
  oposicionSlug: OposicionSlug,
  topicNumber: number
): Promise<TopicContentBase | null> {
  const db = getDb()
  const oposicion = OPOSICIONES[oposicionSlug]

  if (!oposicion) {
    return null
  }

  // 1. Obtener topic + scope en una sola query con subquery
  const topicResult = await db
    .select({
      id: topics.id,
      topicNumber: topics.topicNumber,
      title: topics.title,
      description: topics.description,
      positionType: topics.positionType,
    })
    .from(topics)
    .where(
      and(
        eq(topics.positionType, oposicion.positionType),
        eq(topics.topicNumber, topicNumber)
      )
    )
    .limit(1)

  if (topicResult.length === 0) {
    return null
  }

  const topic = topicResult[0]

  // 2. Obtener topic_scope
  const scopeResult = await db
    .select({
      id: topicScope.id,
      lawId: topicScope.lawId,
      articleNumbers: topicScope.articleNumbers,
      weight: topicScope.weight,
    })
    .from(topicScope)
    .where(eq(topicScope.topicId, topic.id))

  // Filtrar scopes válidos: con lawId Y (artículos específicos O toda la ley con null)
  const validScopes = scopeResult.filter(s => s.lawId && (s.articleNumbers === null || (s.articleNumbers && s.articleNumbers.length > 0)))
  if (validScopes.length === 0) {
    return {
      topicNumber: topic.topicNumber,
      title: topic.title,
      description: topic.description,
      oposicion: oposicionSlug,
      oposicionName: oposicion.name,
      laws: [],
      totalArticles: 0,
    }
  }

  const lawIds = [...new Set(validScopes.map(s => s.lawId!))]

  // 3. Obtener TODAS las leyes en una sola query
  const lawsResult = await db
    .select({
      id: laws.id,
      shortName: laws.shortName,
      name: laws.name,
      description: laws.description,
      year: laws.year,
      boeUrl: laws.boeUrl,
    })
    .from(laws)
    .where(inArray(laws.id, lawIds))

  // Crear mapa de leyes para lookup rápido
  const lawsMap = new Map(lawsResult.map(l => [l.id, l]))

  // 4. Obtener artículos por ley - queries separadas para evitar timeout
  // con muchos parámetros IN (problema cuando hay 4+ leyes con 90+ artículos)
  // articleNumbers: null = toda la ley, articleNumbers: ['1','2'] = artículos específicos
  const scopeByLaw = new Map<string, string[] | null>()

  for (const scope of validScopes) {
    const existing = scopeByLaw.get(scope.lawId!)
    if (scope.articleNumbers === null) {
      // Toda la ley - marcar como null (override cualquier lista parcial)
      scopeByLaw.set(scope.lawId!, null)
    } else if (existing !== null) {
      // Artículos específicos - agregar a la lista (solo si no es ya "toda la ley")
      scopeByLaw.set(scope.lawId!, [...(existing || []), ...scope.articleNumbers])
    }
    // Si existing === null, ya es "toda la ley", no cambiar
  }

  // Query separada por cada ley - usa mejor el índice (law_id, article_number)
  const filteredArticles: {
    id: string
    lawId: string | null
    articleNumber: string
    title: string | null
    content: string | null
    titleNumber: string | null
    chapterNumber: string | null
    section: string | null
  }[] = []

  // Ejecutar queries en paralelo para cada ley
  const articlePromises = Array.from(scopeByLaw.entries()).map(async ([lawId, articleNums]) => {
    const selectFields = {
      id: articles.id,
      lawId: articles.lawId,
      articleNumber: articles.articleNumber,
      title: articles.title,
      content: articles.content,
      titleNumber: articles.titleNumber,
      chapterNumber: articles.chapterNumber,
      section: articles.section,
    }

    if (articleNums === null) {
      // Toda la ley - sin filtro de article_number
      return db.select(selectFields).from(articles).where(eq(articles.lawId, lawId))
    }

    // Artículos específicos
    const uniqueArticleNums = [...new Set(articleNums)]
    return db.select(selectFields).from(articles).where(
      and(eq(articles.lawId, lawId), inArray(articles.articleNumber, uniqueArticleNums))
    )
  })

  const articlesResults = await Promise.all(articlePromises)
  for (const result of articlesResults) {
    filteredArticles.push(...result)
  }

  // 5. Obtener conteos de preguntas en UNA sola query (total + oficiales)
  const allArticleIds = filteredArticles.map(a => a.id)
  let officialCounts: Record<string, number> = {}
  let totalQuestionCounts: Record<string, number> = {}

  if (allArticleIds.length > 0) {
    const validExamPositions = getValidExamPositions(oposicion.positionType)

    const officialFilter = validExamPositions && validExamPositions.length > 0
      ? sql`CASE WHEN ${questions.isOfficialExam} = true AND ${questions.examPosition} IN (${sql.join(validExamPositions.map(p => sql`${p}`), sql`, `)}) THEN 1 END`
      : sql`CASE WHEN false THEN 1 END`

    const countsResult = await db
      .select({
        articleId: questions.primaryArticleId,
        totalCount: count(),
        officialCount: sql<number>`count(${officialFilter})`,
      })
      .from(questions)
      .where(
        and(
          inArray(questions.primaryArticleId, allArticleIds),
          eq(questions.isActive, true),
        )
      )
      .groupBy(questions.primaryArticleId)

    for (const row of countsResult) {
      totalQuestionCounts[row.articleId!] = Number(row.totalCount)
      officialCounts[row.articleId!] = Number(row.officialCount)
    }
  }

  // 6. Agrupar artículos por ley y construir resultado
  const articlesByLaw = new Map<string, typeof filteredArticles>()
  for (const article of filteredArticles) {
    const existing = articlesByLaw.get(article.lawId!) || []
    existing.push(article)
    articlesByLaw.set(article.lawId!, existing)
  }

  const lawsWithArticles: LawWithArticles[] = []
  let totalArticles = 0

  // Ordenar por weight del scope (si existe)
  const sortedLawIds = validScopes
    .sort((a, b) => (Number(a.weight) || 0) - (Number(b.weight) || 0))
    .map(s => s.lawId!)
    .filter((v, i, a) => a.indexOf(v) === i) // unique

  for (const lawId of sortedLawIds) {
    const law = lawsMap.get(lawId)
    if (!law) continue

    const lawArticles = articlesByLaw.get(lawId) || []
    if (lawArticles.length === 0) continue

    // Ordenar artículos numéricamente
    const sortedArticles = [...lawArticles].sort((a, b) => {
      const numA = parseInt(a.articleNumber) || 9999
      const numB = parseInt(b.articleNumber) || 9999
      return numA - numB
    })

    lawsWithArticles.push({
      law: {
        id: law.id,
        shortName: law.shortName,
        name: law.name,
        description: law.description ?? null,
        year: law.year,
        boeUrl: law.boeUrl,
      },
      articles: sortedArticles.map(a => ({
        id: a.id,
        articleNumber: a.articleNumber,
        title: a.title,
        content: a.content,
        titleNumber: a.titleNumber,
        chapterNumber: a.chapterNumber,
        section: a.section,
        officialQuestionCount: officialCounts[a.id] || 0,
        questionCount: totalQuestionCounts[a.id] || 0,
      })),
      articleCount: sortedArticles.length,
    })
    totalArticles += sortedArticles.length
  }

  return {
    topicNumber: topic.topicNumber,
    title: topic.title,
    description: topic.description,
    oposicion: oposicionSlug,
    oposicionName: oposicion.name,
    laws: lawsWithArticles,
    totalArticles,
  }
}

// 🚀 VERSIÓN CACHEADA del contenido base (cache permanente)
// El contenido de leyes/artículos casi nunca cambia
// Para invalidar manualmente: revalidateTag('temario')
const getTopicContentBaseCached = unstable_cache(
  getTopicContentBaseInternal,
  ['topic-content-base-v2'], // v2: fix filtro exam_position
  { revalidate: false, tags: ['temario'] }
)

// Función pública para obtener contenido del tema
export async function getTopicContent(
  oposicionSlug: OposicionSlug,
  topicNumber: number
): Promise<TopicContent | null> {
  const baseContent = await getTopicContentBaseCached(oposicionSlug, topicNumber)

  if (!baseContent) {
    return null
  }

  // Todos los temas están desbloqueados (ya no hay sistema de bloqueo)
  return {
    ...baseContent,
    isUnlocked: true,
    unlockRequirements: null,
    userProgress: null,
    lastUpdated: null,
    generatedAt: new Date().toISOString(),
  }
}

// ============================================
// OBTENER TEMARIO COMPLETO DE UNA OPOSICIÓN (bloques + temas)
// ============================================
// Usado por la página listado del temario /[oposicion]/temario
// Lee de tabla `oposicion_bloques` + `topics` (fuente única de verdad)

export type TemaListItem = {
  id: number              // topic_number (usado por URL: /temario/tema-N)
  displayNum: number      // número mostrado al usuario (ej: 3 para T103)
  titulo: string          // título del tema
  descripcion: string | null  // descripción corta pedagógica
  disponible: boolean     // si false, marcado "En elaboración"
}

export type BloqueListItem = {
  bloqueNumber: number
  titulo: string
  icon: string | null
  temas: TemaListItem[]
}

export type TemarioCompleto = {
  positionType: string
  oposicionName: string
  bloques: BloqueListItem[]
  totalTemas: number
  lastUpdated: string
}

async function getTemarioByPositionTypeInternal(
  positionType: string
): Promise<TemarioCompleto | null> {
  const db = getDb()

  // 1. Obtener bloques
  const bloquesResult = await db.execute(sql`
    SELECT bloque_number, titulo, icon, sort_order
    FROM oposicion_bloques
    WHERE position_type = ${positionType}
    ORDER BY sort_order, bloque_number
  `)

  const bloquesRows = (bloquesResult as any).rows ?? bloquesResult ?? []

  if (bloquesRows.length === 0) {
    return null
  }

  // 2. Obtener temas de todos los bloques
  const topicsResult = await db
    .select({
      topicNumber: topics.topicNumber,
      title: topics.title,
      descripcionCorta: sql<string>`descripcion_corta`.as('descripcion_corta'),
      displayNumber: sql<number>`display_number`.as('display_number'),
      bloqueNumber: sql<number>`bloque_number`.as('bloque_number'),
      disponible: sql<boolean>`disponible`.as('disponible'),
    })
    .from(topics)
    .where(
      and(
        eq(topics.positionType, positionType),
        eq(topics.isActive, true)
      )
    )
    .orderBy(topics.topicNumber)

  // 3. Obtener nombre de oposición (desde primer topic o configuración)
  // Usamos el position_type tal cual como identificador
  const oposicionName = positionType
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

  // 4. Agrupar temas por bloque
  const bloques: BloqueListItem[] = bloquesRows.map((b: any) => {
    const temasBloque = topicsResult
      .filter(t => t.bloqueNumber === b.bloque_number)
      .map(t => ({
        id: t.topicNumber,
        displayNum: t.displayNumber ?? t.topicNumber,
        titulo: t.title,
        descripcion: t.descripcionCorta,
        disponible: t.disponible ?? true,
      }))

    return {
      bloqueNumber: b.bloque_number,
      titulo: b.titulo,
      icon: b.icon,
      temas: temasBloque,
    }
  })

  return {
    positionType,
    oposicionName,
    bloques,
    totalTemas: topicsResult.length,
    lastUpdated: new Date().toISOString(),
  }
}

// 🚀 Cacheado permanente (invalidar con revalidateTag('temario'))
const getTemarioByPositionTypeCached = unstable_cache(
  getTemarioByPositionTypeInternal,
  ['temario-by-position-type-v1'],
  { revalidate: false, tags: ['temario'] }
)

/**
 * Obtiene el temario completo (bloques + temas) de una oposición.
 * Lee desde BD (oposicion_bloques + topics). Cacheado permanente.
 *
 * @param positionType - ej: 'auxilio_judicial', 'auxiliar_administrativo_estado'
 * @returns Estructura completa con bloques y temas, o null si no existe la oposición
 */
export async function getTemarioByPositionType(
  positionType: string
): Promise<TemarioCompleto | null> {
  return getTemarioByPositionTypeCached(positionType)
}
