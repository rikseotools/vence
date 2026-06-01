// lib/teoriaFetchers.ts - FETCHERS PARA SISTEMA DE TEORÍA
import 'server-only'
import { getDb, getPoolerDb } from '@/db/client'
import { articles, laws, lawSections } from '@/db/schema'
import { eq, and, asc, ilike, isNotNull, ne, or, sql as dsql } from 'drizzle-orm'
import { getShortNameBySlug, loadSlugMappingCache, generateSlugFromShortName } from './api/laws/queries'
import { isDisposicionArticle } from './boe-extractor'
import { normalizeArticleNumber } from './boeScrapingUtils'
import { compareArticleNumbers } from '@/lib/utils/articleOrder'

/**
 * Helper: carga el cache de slugs de BD (Drizzle) y devuelve una función sync para resolver slugs.
 * Usar al inicio de cada función async, antes de .map() u otros contextos sync.
 */
async function getSlugResolver(): Promise<(shortName: string) => string> {
  const cache = await loadSlugMappingCache()
  return (shortName: string) => {
    return cache.shortNameToSlug.get(shortName) ?? generateSlugFromShortName(shortName)
  }
}

/**
 * Verifica si un article_number es un artículo válido (numérico, bis/ter/quater, o disposición).
 * Excluye formatos no estándar como "General", "Compromiso8", "A.2.1", "Primero", etc.
 */
function isValidArticleNumber(articleNum: string): boolean {
  const trimmed = articleNum.trim()
  if (!trimmed) return false
  // Artículos numéricos con posible sufijo: "1", "48 bis", "103 bis", "70 ter", "84 quater"
  if (/^\d+(\s*(bis|ter|qu[aá]ter|quinquies|sexies|septies|octies|nonies|novies|decies|undecies|duodecies))?(\s+\d+)?$/i.test(trimmed)) return true
  // Disposiciones: DA1, DT2, DD, DFunica, etc.
  if (isDisposicionArticle(trimmed)) return true
  return false
}

interface LawWithStats {
  id: string
  name: string
  short_name: string
  description: string | null
  articleCount: number
  slug: string
}

interface LawInfo {
  id: string
  name: string
  short_name: string
  description?: string | null
  slug?: string
}

interface ProcessedArticle {
  id: string
  article_number: string
  title: string | null
  content: string
  contentLength: number
  contentPreview: string
  hasRichContent: boolean
  law: LawInfo
}

interface LawArticlesResult {
  articles: ProcessedArticle[]
  law: LawInfo | null
  notFound?: boolean
  message?: string
}

interface ArticleContentResult {
  id: string
  article_number: string
  title: string | null
  content: string
  contentLength: number
  cleanContent: string
  hasRichContent: boolean
  created_at: string
  updated_at: string | null
  law: LawInfo
}

interface OfficialQuestion {
  id: string
  primary_article_id?: string
  is_official_exam: boolean
  exam_source: string | null
  exam_date: string | null
  exam_entity: string | null
  official_difficulty_level: string | null
}

interface ExamData {
  hasOfficialExams: boolean
  totalOfficialQuestions: number
  latestExamDate: string | null
  examSources: string[]
  examEntities: string[]
  difficultyLevels: string[]
  questions: OfficialQuestion[]
}

interface ExamDataAccumulator {
  hasOfficialExams: boolean
  totalOfficialQuestions: number
  latestExamDate: string | null
  examSources: Set<string>
  examEntities: Set<string>
  difficultyLevels: Set<string>
  questions: OfficialQuestion[]
}

interface SearchResult {
  id: string
  article_number: string
  title: string | null
  contentPreview: string
  law: {
    name: string
    short_name: string
    slug: string
  }
}

interface RelatedArticle {
  article_number: string
  title: string | null
  contentPreview: string
  lawSlug: string
}

export interface LawSection {
  id: string
  slug: string
  title: string
  description: string | null
  articleRange: { start: number; end: number } | null
  sectionNumber: number | null
  sectionType: string | null
  orderPosition: number
}

interface LawSectionsResult {
  law: LawInfo & { slug: string }
  sections: LawSection[]
}

interface FetchLawSectionsOptions {
  lawId?: string
  lawName?: string
  lawShortName?: string
}

function getTeoriaDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}

// ================================================================
// 🏛️ FETCHER: Lista de leyes con contenido de teoría disponible
// ================================================================
// 🚀 OPTIMIZADO: No traer content (17MB+), solo contar artículos válidos
export async function fetchLawsList(): Promise<LawWithStats[]> {
  try {
    const resolveSlug = await getSlugResolver()
    console.log('📚 Cargando lista de leyes con teoría disponible...')
    console.time('⏱️ fetchLawsList')

    // 🚀 Query ligera: NO traer content (17MB+), join laws⋈articles solo
    // con article_number. Equivale al laws!inner(articles!inner) de PostgREST.
    const db = getTeoriaDb()
    const rows = await db
      .select({
        id: laws.id,
        name: laws.name,
        shortName: laws.shortName,
        slug: laws.slug,
        description: laws.description,
        articleNumber: articles.articleNumber,
      })
      .from(laws)
      .innerJoin(articles, eq(articles.lawId, laws.id))
      .where(and(
        eq(laws.isActive, true),
        eq(articles.isActive, true),
        isNotNull(articles.content),
      ))

    // Agrupar artículos por ley (el join devuelve una fila por artículo)
    const byLaw = new Map<string, { name: string; shortName: string; slug: string | null; description: string | null; articleNumbers: string[] }>()
    for (const r of rows) {
      let entry = byLaw.get(r.id)
      if (!entry) {
        entry = { name: r.name, shortName: r.shortName, slug: r.slug, description: r.description, articleNumbers: [] }
        byLaw.set(r.id, entry)
      }
      if (r.articleNumber) entry.articleNumbers.push(r.articleNumber)
    }

    // Procesar en JS - filtrar artículos válidos (numéricos, bis/ter/quater, disposiciones)
    const lawsWithStats: LawWithStats[] = Array.from(byLaw.entries())
      .map(([id, law]) => {
        const validArticles = law.articleNumbers.filter((articleNum) => {
          if (!articleNum || articleNum.trim() === '') return false
          return isValidArticleNumber(articleNum)
        })

        return {
          id,
          name: law.name,
          short_name: law.shortName,
          description: law.description,
          articleCount: validArticles.length,
          slug: law.slug || resolveSlug(law.shortName)
        }
      })
      .filter((law: LawWithStats) => law.articleCount > 0)
      .sort((a: LawWithStats, b: LawWithStats) => b.articleCount - a.articleCount)

    console.timeEnd('⏱️ fetchLawsList')
    console.log(`✅ ${lawsWithStats.length} leyes con teoría`)
    return lawsWithStats

  } catch (error) {
    console.error('❌ Error en fetchLawsList:', error)
    throw new Error(`Error cargando leyes: ${(error as Error).message}`)
  }
}

// ================================================================
// 📄 FETCHER: Lista de artículos de una ley específica
// ================================================================
export async function fetchLawArticles(lawSlug: string): Promise<LawArticlesResult> {
  const resolveSlug = await getSlugResolver()

  try {
    // Convertir slug → short_name usando mapeo centralizado
    const lawShortName = await getShortNameBySlug(lawSlug)

    let actualShortName = lawShortName
    if (!lawShortName) {
      const db = getDb()
      const [match] = await db
        .select({ shortName: laws.shortName })
        .from(laws)
        .where(and(eq(laws.isActive, true), dsql`${laws.shortName} ILIKE ${lawSlug}`))
        .limit(1)
      actualShortName = match?.shortName || lawSlug
    }

    // Query Drizzle: solo preview del contenido (200 chars) en SQL.
    // Antes: PostgREST cargaba TODO el content (~46 MB para todas las leyes) → 1.8s+.
    // Ahora: LEFT(content, 200) en SQL → ~165ms. El content completo se carga
    // bajo demanda en ArticleModal via fetchArticleContent.
    const CONTENT_PREVIEW_LENGTH = 200
    const db = getDb()
    const data = await db
      .select({
        id: articles.id,
        articleNumber: articles.articleNumber,
        title: articles.title,
        contentPreviewRaw: dsql<string>`LEFT(${articles.content}, ${CONTENT_PREVIEW_LENGTH})`,
        contentLength: dsql<number>`LENGTH(${articles.content})`,
        fullContent: articles.content, // para extractContentPreview + isRichContent
        lawId: laws.id,
        lawName: laws.name,
        lawShortName: laws.shortName,
        lawSlug: laws.slug,
        lawDescription: laws.description,
      })
      .from(articles)
      .innerJoin(laws, eq(articles.lawId, laws.id))
      .where(and(
        eq(articles.isActive, true),
        eq(laws.isActive, true),
        eq(laws.shortName, actualShortName!),
        isNotNull(articles.content),
        isNotNull(articles.articleNumber),
        ne(articles.articleNumber, ''),
      ))
      .orderBy(articles.articleNumber)

    if (!data || data.length === 0) {
      return {
        articles: [],
        law: null,
        notFound: true,
        message: `No se encontró la ley: ${actualShortName}`
      }
    }

    // Filtrar solo artículos reales (excluir formatos no estándar)
    const articlesOnly = data.filter(item => {
      const articleNum = item.articleNumber
      if (!articleNum || articleNum.trim() === '') return false
      if (!isValidArticleNumber(articleNum)) return false

      const lowerTitle = (item.title || '').toLowerCase()
      if (lowerTitle.includes('título') || lowerTitle.includes('titulo') ||
          lowerTitle.includes('capítulo') || lowerTitle.includes('capitulo') ||
          lowerTitle.includes('preámbulo') || lowerTitle.includes('preambulo')) {
        return false
      }
      return true
    })

    // Ordenar según el orden lógico BOE (preámbulo → títulos → numéricos →
    // DA/DT/DD/DF → anexos). Fuente única de verdad en lib/utils/articleOrder.
    const sortedData = [...articlesOnly].sort((a, b) =>
      compareArticleNumbers(a.articleNumber!, b.articleNumber!)
    )

    const processedArticles: ProcessedArticle[] = sortedData.map(article => ({
      id: article.id,
      article_number: article.articleNumber!,
      title: article.title || null,
      content: article.contentPreviewRaw || '',
      contentLength: article.contentLength || 0,
      contentPreview: extractContentPreview(article.fullContent || ''),
      hasRichContent: isRichContent(article.fullContent || ''),
      law: {
        id: article.lawId,
        name: article.lawName || '',
        short_name: article.lawShortName || '',
        description: article.lawDescription || null,
        slug: article.lawSlug || resolveSlug(article.lawShortName || '')
      }
    }))

    if (processedArticles.length === 0) {
      return {
        articles: [],
        law: null,
        notFound: true,
        message: `No se encontraron artículos válidos para la ley "${lawSlug}"`
      }
    }
    return {
      articles: processedArticles,
      law: processedArticles[0].law
    }

  } catch (error) {
    console.error('❌ Error en fetchLawArticles:', error)
    throw new Error(`Error cargando artículos: ${(error as Error).message}`)
  }
}

// ================================================================
// 📑 FETCHER: Contenido completo de un artículo específico - CORREGIDO
// ================================================================

export async function fetchArticleContent(lawSlug: string, articleNumber: string | number): Promise<ArticleContentResult> {
  try {
    const resolveSlug = await getSlugResolver()
    console.log(`📑 Cargando artículo: ${lawSlug}/articulo-${articleNumber}`)

    const lawShortName = await getShortNameBySlug(lawSlug)

    if (!lawShortName) {
      throw new Error(`LEY_NO_RECONOCIDA: Ley "${lawSlug}" no es válida`)
    }

    // Normalizar número si viene sin espacio ("55bis" → "55 bis", "4BIS" → "4 bis")
    // para tolerar URLs externas/cacheadas con formato no canónico
    const rawArticleNumber = articleNumber.toString()
    const normalized = normalizeArticleNumber(rawArticleNumber)
    const candidates = normalized && normalized !== rawArticleNumber
      ? [rawArticleNumber, normalized]
      : [rawArticleNumber]

    let data: any = null
    let error: any = null
    const db = getTeoriaDb()
    for (const candidate of candidates) {
      const [row] = await db
        .select({
          id: articles.id,
          article_number: articles.articleNumber,
          title: articles.title,
          content: articles.content,
          is_active: articles.isActive,
          created_at: articles.createdAt,
          updated_at: articles.updatedAt,
          law_id: laws.id,
          law_name: laws.name,
          law_short_name: laws.shortName,
          law_slug: laws.slug,
          law_description: laws.description,
          law_is_virtual: laws.isVirtual,
        })
        .from(articles)
        .innerJoin(laws, eq(articles.lawId, laws.id))
        .where(and(
          eq(articles.isActive, true),
          eq(laws.isActive, true),
          eq(laws.shortName, lawShortName),
          eq(articles.articleNumber, candidate),
        ))
        .limit(1)

      if (row) {
        data = {
          id: row.id,
          article_number: row.article_number,
          title: row.title,
          content: row.content,
          is_active: row.is_active,
          created_at: row.created_at,
          updated_at: row.updated_at,
          laws: {
            id: row.law_id,
            name: row.law_name,
            short_name: row.law_short_name,
            slug: row.law_slug,
            description: row.law_description,
            is_virtual: row.law_is_virtual,
          },
        }
        error = null
        break
      }
      error = { code: 'PGRST116', message: 'No rows found' }
    }

    if (error) {
      console.error('❌ Error cargando artículo:', error)

      // 🔍 Si el artículo no existe (error PGRST116)
      if (error.code === 'PGRST116') {
        // Buscar artículos disponibles para dar contexto
        const availableArticles = await db
          .select({ article_number: articles.articleNumber })
          .from(articles)
          .innerJoin(laws, eq(articles.lawId, laws.id))
          .where(and(
            eq(articles.isActive, true),
            eq(laws.shortName, lawShortName),
          ))
          .orderBy(articles.articleNumber)
          .limit(5)

        const suggestions = availableArticles && availableArticles.length > 0
          ? `Artículos disponibles: ${availableArticles.map((a: { article_number: string }) => a.article_number).join(', ')}`
          : 'No hay artículos disponibles para esta ley'

        throw new Error(`ARTICULO_NO_ENCONTRADO: El artículo ${articleNumber} no existe en ${lawShortName}. ${suggestions}`)
      }

      throw new Error(`ERROR_BD: ${error.message}`)
    }

    if (!data) {
      throw new Error(`ARTICULO_NO_ENCONTRADO: Artículo ${articleNumber} no encontrado en ${lawShortName}`)
    }

    // Verificar que el contenido existe y no está vacío
    // Para leyes virtuales, no lanzar error si el contenido está vacío
    const isVirtualLaw = data.laws.is_virtual === true
    if (!data.content || data.content.trim().length === 0) {
      if (isVirtualLaw) {
        // Devolver artículo con flag isVirtual para que el cliente muestre mensaje adecuado
        return {
          id: data.id,
          article_number: data.article_number,
          title: data.title,
          content: '',
          contentLength: 0,
          cleanContent: '',
          hasRichContent: false,
          created_at: data.created_at,
          updated_at: data.updated_at,
          isVirtual: true,
          law: {
            id: data.laws.id,
            name: data.laws.name,
            short_name: data.laws.short_name,
            description: data.laws.description,
            slug: data.laws.slug || resolveSlug(data.laws.short_name)
          }
        } as ArticleContentResult & { isVirtual: boolean }
      }
      throw new Error(`CONTENIDO_VACIO: El artículo ${articleNumber} de ${lawShortName} no tiene contenido`)
    }

    // Procesar contenido
    const processedArticle: ArticleContentResult = {
      id: data.id,
      article_number: data.article_number,
      title: data.title,
      content: data.content,
      contentLength: data.content?.length || 0,
      cleanContent: cleanArticleContent(data.content),
      hasRichContent: isRichContent(data.content),
      created_at: data.created_at,
      updated_at: data.updated_at,
      ...(isVirtualLaw ? { isVirtual: true } : {}),
      law: {
        id: data.laws.id,
        name: data.laws.name,
        short_name: data.laws.short_name,
        description: data.laws.description,
        slug: data.laws.slug || resolveSlug(data.laws.short_name)
      }
    }

    console.log(`✅ Artículo cargado: ${processedArticle.title}`)
    return processedArticle

  } catch (error) {
    console.error('❌ Error en fetchArticleContent:', error)
    // Propagar el error original para que el componente lo maneje
    throw error
  }
}

// ================================================================
// 🏛️ Official exam data: migrated to lib/api/hot-articles/ (Drizzle + Zod)
// Use getArticleOfficialExamData and getMultipleArticlesOfficialExamData
// from '@/lib/api/hot-articles' instead
// ================================================================

// ================================================================
// 🔗 FETCHER: Artículos relacionados (mismo tema/ley) - CORREGIDO
// ================================================================
export async function fetchRelatedArticles(lawSlug: string, currentArticleNumber: string | number, limit: number = 5): Promise<RelatedArticle[]> {
  try {
    const resolveSlug = await getSlugResolver()
    console.log(`🔗 Cargando artículos relacionados para: ${lawSlug}`)

    const lawShortName = await getShortNameBySlug(lawSlug)

    const db = getTeoriaDb()
    const data = await db
      .select({
        articleNumber: articles.articleNumber,
        title: articles.title,
        content: articles.content,
        lawShortName: laws.shortName,
        lawSlug: laws.slug,
        lawName: laws.name,
      })
      .from(articles)
      .innerJoin(laws, eq(articles.lawId, laws.id))
      .where(and(
        eq(articles.isActive, true),
        eq(laws.shortName, lawShortName as string),
        ne(articles.articleNumber, currentArticleNumber.toString()),
        isNotNull(articles.content),
      ))
      .orderBy(asc(articles.articleNumber))
      .limit(limit)

    const relatedArticles: RelatedArticle[] = data.map((article) => ({
      article_number: article.articleNumber,
      title: article.title,
      contentPreview: extractContentPreview(article.content),
      lawSlug: article.lawSlug || resolveSlug(article.lawShortName)
    }))

    console.log(`✅ ${relatedArticles.length} artículos relacionados cargados`)
    return relatedArticles

  } catch (error) {
    console.error('❌ Error en fetchRelatedArticles:', error)
    return [] // No fallar si no hay relacionados
  }
}

// ================================================================
// 🛠️ FUNCIONES AUXILIARES
// ================================================================

// Extraer preview del contenido
function extractContentPreview(content: string | null, maxLength: number = 200): string {
  if (!content) return ''

  // Limpiar HTML básico
  const cleanText = content
    .replace(/<[^>]*>/g, ' ')       // Quitar tags HTML
    .replace(/\s+/g, ' ')           // Espacios múltiples a uno
    .trim()

  if (cleanText.length <= maxLength) {
    return cleanText
  }

  return cleanText.substring(0, maxLength).trim() + '...'
}

// Detectar si el contenido tiene formato rico (HTML)
function isRichContent(content: string | null): boolean {
  if (!content) return false

  const htmlTags = /<(div|header|h[1-6]|p|ul|ol|li|strong|em|br)\s*[^>]*>/i
  return htmlTags.test(content)
}

// Limpiar contenido HTML para mostrar
function cleanArticleContent(content: string | null): string {
  if (!content) return ''

  // Si no tiene HTML, devolverlo como está
  if (!isRichContent(content)) {
    return content
  }

  // Para contenido con HTML, preservar estructura básica
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

// ================================================================
// 🔍 FETCHER: Buscar artículos por texto
// ================================================================
export async function searchArticles(query: string, lawSlug: string | null = null, limit: number = 10): Promise<SearchResult[]> {
  try {
    const resolveSlug = await getSlugResolver()
    console.log(`🔍 Buscando artículos: "${query}"`)

    const conditions = [
      eq(articles.isActive, true),
      isNotNull(articles.content),
    ]

    // Filtrar por ley si se especifica
    if (lawSlug) {
      const lawShortName = await getShortNameBySlug(lawSlug)
      conditions.push(eq(laws.shortName, lawShortName as string))
    }

    // Buscar en título y contenido (OR de ILIKE)
    conditions.push(
      or(
        ilike(articles.title, `%${query}%`),
        ilike(articles.content, `%${query}%`)
      )!
    )

    const db = getTeoriaDb()
    const data = await db
      .select({
        id: articles.id,
        articleNumber: articles.articleNumber,
        title: articles.title,
        content: articles.content,
        lawName: laws.name,
        lawShortName: laws.shortName,
        lawSlug: laws.slug,
      })
      .from(articles)
      .innerJoin(laws, eq(articles.lawId, laws.id))
      .where(and(...conditions))
      .limit(limit)

    const results: SearchResult[] = data.map((article) => ({
      id: article.id,
      article_number: article.articleNumber,
      title: article.title,
      contentPreview: extractContentPreview(article.content),
      law: {
        name: article.lawName,
        short_name: article.lawShortName,
        slug: article.lawSlug || resolveSlug(article.lawShortName)
      }
    }))

    console.log(`✅ ${results.length} resultados encontrados`)
    return results

  } catch (error) {
    console.error('❌ Error en searchArticles:', error)
    return []
  }
}

// ================================================================
// 📚 FETCHER: Secciones/Títulos de una ley específica
// ================================================================
export async function fetchLawSections(lawSlugOrShortName: string, options: FetchLawSectionsOptions = {}): Promise<LawSectionsResult> {
  try {
    const resolveSlug = await getSlugResolver()
    console.log(`📚 Cargando secciones de ley: ${lawSlugOrShortName}`)

    // Resolver cualquier formato: slug, short_name, o variante
    const { resolveLawIdentifier } = await import('./api/laws/queries')
    const resolved = await resolveLawIdentifier(lawSlugOrShortName)

    if (!resolved) {
      throw new Error(`Ley "${lawSlugOrShortName}" no reconocida`)
    }

    const lawShortName = resolved.shortName
    console.log(`🔍 Mapeo: "${lawSlugOrShortName}" → "${lawShortName}" (id: ${resolved.id})`)

    const db = getTeoriaDb()

    // Si nos pasan lawId, reutilizarlo en vez de consultar de nuevo
    let lawData: { id: string; name: string; short_name: string }
    if (options.lawId) {
      console.log(`⚡ Reutilizando lawId=${options.lawId} (skip query a laws)`)
      lawData = {
        id: options.lawId,
        name: options.lawName || lawShortName,
        short_name: options.lawShortName || lawShortName,
      }
    } else {
      // Obtener ID de la ley (query original)
      const lawRows = await db
        .select({ id: laws.id, name: laws.name, shortName: laws.shortName })
        .from(laws)
        .where(and(eq(laws.shortName, lawShortName), eq(laws.isActive, true)))
        .limit(1)
      const queryResult = lawRows[0]

      if (!queryResult) {
        throw new Error(`Ley "${lawShortName}" no encontrada`)
      }
      lawData = { id: queryResult.id, name: queryResult.name, short_name: queryResult.shortName }
    }

    // Obtener secciones de la ley
    const sectionsData = await db
      .select()
      .from(lawSections)
      .where(and(eq(lawSections.lawId, lawData.id), eq(lawSections.isActive, true)))
      .orderBy(asc(lawSections.orderPosition))

    // Transformar datos para la interfaz
    const sections: LawSection[] = sectionsData.map((section) => ({
      id: section.id,
      slug: section.slug,
      title: section.title,
      description: section.description,
      articleRange: section.articleRangeStart && section.articleRangeEnd
        ? { start: section.articleRangeStart, end: section.articleRangeEnd }
        : null,
      // section_number es columna text en BD; el tipo es number|null (igual
      // que el cast anterior de supabase). Se preserva el valor runtime.
      sectionNumber: section.sectionNumber as unknown as number | null,
      sectionType: section.sectionType,
      orderPosition: section.orderPosition
    }))

    console.log(`✅ ${sections.length} secciones cargadas para ${lawShortName}`)

    // Generar slug correcto (si recibimos short_name, convertir a slug)
    const slug = lawSlugOrShortName.includes('/')
      ? resolveSlug(lawShortName)
      : lawSlugOrShortName

    return {
      law: {
        id: lawData.id,
        name: lawData.name,
        short_name: lawData.short_name,
        slug
      },
      sections
    }

  } catch (error) {
    console.error('❌ Error en fetchLawSections:', error)
    throw new Error(`Error cargando secciones: ${(error as Error).message}`)
  }
}
