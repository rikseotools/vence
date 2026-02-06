// lib/api/teoria/queries.ts - Queries Drizzle Optimizadas para Teoría
import { getDb } from '@/db/client'
import { articles, laws } from '@/db/schema'
import { eq, and, ne, isNotNull, sql } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'
import { mapLawSlugToShortName, generateLawSlug } from '@/lib/lawMappingUtils'
import type {
  ArticleDetail,
  ArticleNavigation,
  RelatedArticle,
  LawBasic,
} from './schemas'

// ============================================
// HELPERS
// ============================================

function extractContentPreview(content: string | null, maxLength = 200): string {
  if (!content) return ''
  const cleanText = content
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleanText.length <= maxLength
    ? cleanText
    : cleanText.substring(0, maxLength).trim() + '...'
}

function isRichContent(content: string | null): boolean {
  if (!content) return false
  return /<(div|header|h[1-6]|p|ul|ol|li|strong|em|br)\s*[^>]*>/i.test(content)
}

function cleanArticleContent(content: string | null): string {
  if (!content) return ''
  if (!isRichContent(content)) return content
  return content
    .replace(/<div class="article-content"[^>]*>/g, '')
    .replace(/<\/div>/g, '')
    .replace(/<header class="article-header"[^>]*>/g, '')
    .replace(/<\/header>/g, '')
    .replace(/<h4 class="article-title"[^>]*>/g, '<h3>')
    .replace(/<\/h4>/g, '</h3>')
    .replace(/<div class="article-body"[^>]*>/g, '<div>')
    .trim()
}

function isValidArticleNumber(num: string | null): boolean {
  if (!num || num.trim() === '') return false
  return /^\d+$/.test(num.trim())
}

// ============================================
// QUERY: OBTENER CONTENIDO DE UN ARTÍCULO
// ============================================

async function getArticleContentInternal(
  lawSlug: string,
  articleNumber: number
): Promise<ArticleDetail | null> {
  const db = getDb()
  const lawShortName = mapLawSlugToShortName(lawSlug)

  // Query única con JOIN
  const result = await db
    .select({
      id: articles.id,
      articleNumber: articles.articleNumber,
      title: articles.title,
      content: articles.content,
      createdAt: articles.createdAt,
      updatedAt: articles.updatedAt,
      lawId: laws.id,
      lawShortName: laws.shortName,
      lawName: laws.name,
      lawDescription: laws.description,
    })
    .from(articles)
    .innerJoin(laws, eq(articles.lawId, laws.id))
    .where(
      and(
        eq(laws.shortName, lawShortName),
        eq(articles.articleNumber, articleNumber.toString()),
        eq(articles.isActive, true),
        eq(laws.isActive, true),
        isNotNull(articles.content)
      )
    )
    .limit(1)

  if (result.length === 0) return null

  const row = result[0]

  // Verificar contenido
  if (!row.content || row.content.trim().length === 0) {
    return null
  }

  return {
    id: row.id,
    articleNumber: row.articleNumber,
    title: row.title,
    content: row.content,
    contentLength: row.content.length,
    contentPreview: extractContentPreview(row.content),
    hasRichContent: isRichContent(row.content),
    cleanContent: cleanArticleContent(row.content),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    law: {
      id: row.lawId,
      shortName: row.lawShortName,
      name: row.lawName,
      description: row.lawDescription,
      slug: generateLawSlug(row.lawShortName),
    },
  }
}

// 🚀 VERSIÓN CACHEADA (permanente - el contenido de artículos no cambia)
// Para invalidar: revalidateTag('teoria')
export const getArticleContent = unstable_cache(
  getArticleContentInternal,
  ['teoria-article-content'],
  { revalidate: false, tags: ['teoria'] }
)

// ============================================
// QUERY: NAVEGACIÓN DE ARTÍCULOS (MUY LIGERA)
// ============================================
// Solo obtiene los números de artículos para prev/next
// NO carga contenido, títulos, etc.

async function getArticleNavigationInternal(
  lawSlug: string
): Promise<ArticleNavigation> {
  const db = getDb()
  const lawShortName = mapLawSlugToShortName(lawSlug)

  // Query MUY ligera - solo article_number
  const result = await db
    .select({
      articleNumber: articles.articleNumber,
    })
    .from(articles)
    .innerJoin(laws, eq(articles.lawId, laws.id))
    .where(
      and(
        eq(laws.shortName, lawShortName),
        eq(articles.isActive, true),
        eq(laws.isActive, true),
        isNotNull(articles.content),
        // Solo artículos numéricos (excluyendo 0 que es metadata)
        sql`${articles.articleNumber} ~ '^[1-9][0-9]*$'`
      )
    )

  // Convertir a números y ordenar
  const articleNumbers = result
    .map(r => parseInt(r.articleNumber))
    .filter(n => !isNaN(n) && n > 0)
    .sort((a, b) => a - b)

  return {
    articleNumbers,
    totalCount: articleNumbers.length,
  }
}

// 🚀 VERSIÓN CACHEADA (permanente - la estructura de artículos no cambia)
// Para invalidar: revalidateTag('teoria')
export const getArticleNavigation = unstable_cache(
  getArticleNavigationInternal,
  ['teoria-article-navigation'],
  { revalidate: false, tags: ['teoria'] }
)

// ============================================
// QUERY: ARTÍCULOS RELACIONADOS
// ============================================

async function getRelatedArticlesInternal(
  lawSlug: string,
  excludeArticleNumber: number,
  limit = 3
): Promise<RelatedArticle[]> {
  const db = getDb()
  const lawShortName = mapLawSlugToShortName(lawSlug)

  const result = await db
    .select({
      articleNumber: articles.articleNumber,
      title: articles.title,
      content: articles.content,
      lawShortName: laws.shortName,
    })
    .from(articles)
    .innerJoin(laws, eq(articles.lawId, laws.id))
    .where(
      and(
        eq(laws.shortName, lawShortName),
        ne(articles.articleNumber, excludeArticleNumber.toString()),
        eq(articles.isActive, true),
        eq(laws.isActive, true),
        isNotNull(articles.content),
        // Solo artículos numéricos reales (excluyendo 0)
        sql`${articles.articleNumber} ~ '^[1-9][0-9]*$'`
      )
    )
    .orderBy(sql`
      CASE
        WHEN ${articles.articleNumber} ~ '^[0-9]+$'
        THEN CAST(${articles.articleNumber} AS INTEGER)
        ELSE 9999
      END
    `)
    .limit(limit)

  return result.map(row => ({
    articleNumber: row.articleNumber,
    title: row.title,
    contentPreview: extractContentPreview(row.content),
    lawSlug: generateLawSlug(row.lawShortName),
  }))
}

// 🚀 VERSIÓN CACHEADA (permanente - artículos relacionados no cambian)
// Para invalidar: revalidateTag('teoria')
export const getRelatedArticles = unstable_cache(
  getRelatedArticlesInternal,
  ['teoria-related-articles'],
  { revalidate: false, tags: ['teoria'] }
)

// ============================================
// QUERY: INFO BÁSICA DE LEY (para metadata)
// ============================================

async function getLawBasicInfoInternal(
  lawSlug: string
): Promise<LawBasic | null> {
  const db = getDb()
  const lawShortName = mapLawSlugToShortName(lawSlug)

  const result = await db
    .select({
      id: laws.id,
      shortName: laws.shortName,
      name: laws.name,
      description: laws.description,
    })
    .from(laws)
    .where(
      and(
        eq(laws.shortName, lawShortName),
        eq(laws.isActive, true)
      )
    )
    .limit(1)

  if (result.length === 0) return null

  return {
    ...result[0],
    slug: generateLawSlug(result[0].shortName),
  }
}

// 🚀 VERSIÓN CACHEADA (permanente - info de leyes no cambia)
// Para invalidar: revalidateTag('teoria')
export const getLawBasicInfo = unstable_cache(
  getLawBasicInfoInternal,
  ['teoria-law-basic-info'],
  { revalidate: false, tags: ['teoria'] }
)
