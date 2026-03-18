// lib/teoriaFetchers.ts - FETCHERS PARA SISTEMA DE TEORÍA
import { getSupabaseClient } from './supabase'
import { mapLawSlugToShortName, generateLawSlug, getCanonicalSlug } from './lawMappingUtils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClientAny = any

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

const supabase: SupabaseClientAny = getSupabaseClient()

// ================================================================
// 🏛️ FETCHER: Lista de leyes con contenido de teoría disponible
// ================================================================
// 🚀 OPTIMIZADO: No traer content (17MB+), solo contar artículos válidos
export async function fetchLawsList(): Promise<LawWithStats[]> {
  try {
    console.log('📚 Cargando lista de leyes con teoría disponible...')
    console.time('⏱️ fetchLawsList')

    // 🚀 Query ligera: NO traer content, solo id y article_number
    const { data, error } = await supabase
      .from('laws')
      .select(`
        id, name, short_name, description,
        articles!inner(id, article_number)
      `)
      .eq('is_active', true)
      .eq('articles.is_active', true)
      .not('articles.content', 'is', null)

    if (error) {
      console.error('❌ Error cargando leyes:', error)
      throw error
    }

    // Procesar en JS - filtrar artículos numéricos válidos
    const lawsWithStats: LawWithStats[] = data
      .map((law: Record<string, unknown>) => {
        // Filtrar solo artículos numéricos (1, 2, 10, etc.)
        const articles = (law.articles || []) as Array<{ article_number: string }>
        const validArticles = articles.filter((article: { article_number: string }) => {
          const articleNum = article.article_number
          if (!articleNum || articleNum.trim() === '') return false
          // Solo números puros (excluir T1, C1, etc.)
          return /^\d+$/.test(articleNum.trim())
        })

        return {
          id: law.id as string,
          name: law.name as string,
          short_name: law.short_name as string,
          description: law.description as string | null,
          articleCount: validArticles.length,
          slug: generateLawSlug(law.short_name as string)
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
  // Calentar cache BD → lawMappingUtils (no-op si ya cargado)
  try { const { warmSlugCache } = await import('./api/laws/warmCache'); await warmSlugCache() } catch {}

  try {
    console.log(`📖 Cargando artículos de ley: ${lawSlug}`)

    // Convertir slug back to short_name usando mapeo centralizado
    const lawShortName = mapLawSlugToShortName(lawSlug)
    console.log(`🔍 Mapeo: "${lawSlug}" → "${lawShortName}"`)

    // Si el mapeo ya resolvió el short_name, usarlo directamente (evita query redundante a laws)
    // Solo hacer lookup case-insensitive en BD si el mapeo no encontró resultado
    let actualShortName = lawShortName
    if (!lawShortName) {
      const { data: lawMatch } = await supabase
        .from('laws')
        .select('short_name')
        .or(`short_name.ilike.${lawSlug}`)
        .eq('is_active', true)
        .limit(1)
        .single()

      actualShortName = lawMatch?.short_name || lawSlug
      if (lawMatch) {
        console.log(`🔍 Encontrado en BD: "${actualShortName}"`)
      }
    }

    const { data, error } = await supabase
      .from('articles')
      .select(`
        id,
        article_number,
        title,
        content,
        is_active,
        created_at,
        laws!inner(
          id, name, short_name, description
        )
      `)
      .eq('is_active', true)
      .eq('laws.is_active', true)
      .eq('laws.short_name', actualShortName)
      .not('content', 'is', null)
      .not('article_number', 'is', null)
      .neq('article_number', '')
      .order('article_number')

    if (error) {
      console.error('❌ Error cargando artículos:', error)
      throw error
    }

    if (!data || data.length === 0) {
      // Retornar objeto vacío en lugar de lanzar error - permite manejar 404 gracefully
      return {
        articles: [],
        law: null,
        notFound: true,
        message: `No se encontró la ley: ${lawShortName}`
      }
    }

    // Filtrar solo artículos reales (excluir títulos, capítulos, etc.)
    const articlesOnly = data.filter((item: Record<string, unknown>) => {
      const articleNum = item.article_number as string
      // Excluir si es null, vacío
      if (!articleNum || (articleNum as string).trim() === '') return false

      // Solo permitir números puros (1, 2, 3, 10, 100, etc.)
      const isNumericOnly = /^\d+$/.test((articleNum as string).trim())
      if (!isNumericOnly) return false

      // Excluir títulos y capítulos comunes por título
      const lowerTitle = ((item.title as string) || '').toLowerCase()
      if (lowerTitle.includes('título') ||
          lowerTitle.includes('titulo') ||
          lowerTitle.includes('capítulo') ||
          lowerTitle.includes('capitulo') ||
          lowerTitle.includes('preámbulo') ||
          lowerTitle.includes('preambulo')) {
        return false
      }

      return true
    })

    // Ordenar artículos numéricamente por article_number
    const sortedData = articlesOnly.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const numA = parseInt(a.article_number as string) || 0
      const numB = parseInt(b.article_number as string) || 0
      return numA - numB
    })

    // Procesar artículos
    const processedArticles: ProcessedArticle[] = sortedData.map((article: Record<string, unknown>) => {
      const laws = article.laws as Record<string, unknown>
      return {
        id: article.id as string,
        article_number: article.article_number as string,
        title: article.title as string | null,
        content: article.content as string,
        contentLength: (article.content as string)?.length || 0,
        contentPreview: extractContentPreview(article.content as string),
        hasRichContent: isRichContent(article.content as string),
        law: {
          id: laws.id as string,
          name: laws.name as string,
          short_name: laws.short_name as string,
          description: laws.description as string | null,
          slug: generateLawSlug(laws.short_name as string)
        }
      }
    })

    console.log(`✅ ${processedArticles.length} artículos cargados`)
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
    console.log(`📑 Cargando artículo: ${lawSlug}/articulo-${articleNumber}`)

    const lawShortName = mapLawSlugToShortName(lawSlug)

    if (!lawShortName) {
      throw new Error(`LEY_NO_RECONOCIDA: Ley "${lawSlug}" no es válida`)
    }

    const { data, error } = await supabase
      .from('articles')
      .select(`
        id,
        article_number,
        title,
        content,
        is_active,
        created_at,
        updated_at,
        laws!inner(
          id, name, short_name, description, is_virtual
        )
      `)
      .eq('is_active', true)
      .eq('laws.is_active', true)
      .eq('laws.short_name', lawShortName)
      .eq('article_number', articleNumber.toString())
      .single()

    if (error) {
      console.error('❌ Error cargando artículo:', error)

      // 🔍 Si el artículo no existe (error PGRST116)
      if (error.code === 'PGRST116') {
        // Buscar artículos disponibles para dar contexto
        const { data: availableArticles } = await supabase
          .from('articles')
          .select('article_number, laws!inner(short_name)')
          .eq('is_active', true)
          .eq('laws.short_name', lawShortName)
          .order('article_number')
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
            slug: generateLawSlug(data.laws.short_name)
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
        slug: generateLawSlug(data.laws.short_name)
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
// 🏛️ FETCHER: Datos de examen oficial para un artículo específico
// ================================================================

// Mapeo de slugs de oposición a patrones en exam_source
const OPOSICION_EXAM_SOURCE_PATTERNS: Record<string, string[]> = {
  'auxiliar-administrativo-estado': ['Auxiliar Administrativo', 'Auxiliar Estado', 'AGE'],
  'auxiliar_administrativo_estado': ['Auxiliar Administrativo', 'Auxiliar Estado', 'AGE'],
  'tramitacion-procesal': ['Tramitaci'],
  'tramitacion_procesal': ['Tramitaci'],
  'auxilio-judicial': ['Auxilio Judicial'],
  'auxilio_judicial': ['Auxilio Judicial'],
  'gestion-procesal': ['Gesti'],
  'gestion_procesal': ['Gesti'],
  'administrativo-estado': ['Administrativo'],
  'administrativo_estado': ['Administrativo'],
}

// Función auxiliar para verificar si un exam_source corresponde a una oposición
function examSourceMatchesOposicion(examSource: string | null, oposicionSlug: string | null): boolean {
  if (!examSource || !oposicionSlug) return true

  const patterns = OPOSICION_EXAM_SOURCE_PATTERNS[oposicionSlug]
  if (!patterns) return true // Si no hay patrón definido, mostrar todo

  return patterns.some(pattern => examSource.includes(pattern))
}

export async function fetchArticleOfficialExamData(articleId: string | null, userOposicion: string | null = null): Promise<ExamData | null> {
  try {
    if (!articleId) return null

    console.log(`🏛️ Verificando examen oficial para artículo: ${articleId}, oposición: ${userOposicion}`)

    // Si userOposicion es un UUID, resolver a slug
    let oposicionSlug = userOposicion
    if (userOposicion && userOposicion.includes('-') && userOposicion.length === 36) {
      const { data: oposicion } = await supabase
        .from('oposiciones')
        .select('slug')
        .eq('id', userOposicion)
        .single()

      if (oposicion) {
        oposicionSlug = oposicion.slug
        console.log(`🔄 UUID resuelto a slug: ${oposicionSlug}`)
      }
    }

    // Query para obtener preguntas oficiales de este artículo
    const { data, error } = await supabase
      .from('questions')
      .select(`
        id,
        is_official_exam,
        exam_source,
        exam_date,
        exam_entity,
        official_difficulty_level
      `)
      .eq('primary_article_id', articleId)
      .eq('is_official_exam', true)
      .eq('is_active', true)
      .order('exam_date', { ascending: false })

    if (error) {
      console.error('❌ Error obteniendo datos de examen oficial:', error)
      return null
    }

    if (!data || data.length === 0) {
      return null
    }

    // Filtrar preguntas por oposición del usuario
    const filteredData: OfficialQuestion[] = oposicionSlug
      ? data.filter((q: OfficialQuestion) => examSourceMatchesOposicion(q.exam_source, oposicionSlug))
      : data

    if (filteredData.length === 0) {
      console.log(`📭 No hay preguntas oficiales de ${oposicionSlug} para este artículo`)
      return null
    }

    // Procesar datos de exámenes oficiales (solo los de la oposición del usuario)
    const examData: ExamData = {
      hasOfficialExams: true,
      totalOfficialQuestions: filteredData.length,
      latestExamDate: filteredData[0].exam_date,
      examSources: [...new Set(filteredData.map(q => q.exam_source).filter((s): s is string => !!s))],
      examEntities: [...new Set(filteredData.map(q => q.exam_entity).filter((s): s is string => !!s))],
      difficultyLevels: [...new Set(filteredData.map(q => q.official_difficulty_level).filter((s): s is string => !!s))],
      questions: filteredData
    }

    console.log(`✅ Datos de examen oficial cargados (${oposicionSlug}):`, examData)
    return examData

  } catch (error) {
    console.error('❌ Error en fetchArticleOfficialExamData:', error)
    return null
  }
}

// ================================================================
// 🏛️ FETCHER: Datos de examen oficial para múltiples artículos
// ================================================================
export async function fetchMultipleArticlesOfficialExamData(articleNumbers: string[], lawShortName: string, userOposicion: string | null = null): Promise<Record<string, ExamData>> {
  try {
    if (!articleNumbers || articleNumbers.length === 0) return {}

    console.log(`🏛️ Verificando exámenes oficiales para ${articleNumbers.length} artículos de ${lawShortName}`)

    // Si userOposicion es un UUID, resolver a slug
    let oposicionSlug = userOposicion
    if (userOposicion && userOposicion.includes('-') && userOposicion.length === 36) {
      const { data: oposicion } = await supabase
        .from('oposiciones')
        .select('slug')
        .eq('id', userOposicion)
        .single()

      if (oposicion) {
        oposicionSlug = oposicion.slug
        console.log(`🔄 UUID resuelto a slug: ${oposicionSlug}`)
      }
    }

    // Query para obtener IDs de artículos primero
    const { data: articlesData, error: articlesError } = await supabase
      .from('articles')
      .select(`
        id,
        article_number,
        laws!inner(short_name)
      `)
      .eq('laws.short_name', lawShortName)
      .in('article_number', articleNumbers.map(String))
      .eq('is_active', true)

    if (articlesError || !articlesData) {
      console.error('❌ Error obteniendo artículos:', articlesError)
      return {}
    }

    // Crear mapeo de article_number -> id
    const articleIdMap: Record<string, string> = {}
    articlesData.forEach((article: Record<string, unknown>) => {
      articleIdMap[article.article_number as string] = article.id as string
    })

    const articleIds = articlesData.map((a: Record<string, unknown>) => a.id)

    // Query para obtener preguntas oficiales de estos artículos
    const { data, error } = await supabase
      .from('questions')
      .select(`
        id,
        primary_article_id,
        is_official_exam,
        exam_source,
        exam_date,
        exam_entity,
        official_difficulty_level
      `)
      .in('primary_article_id', articleIds)
      .eq('is_official_exam', true)
      .eq('is_active', true)
      .order('exam_date', { ascending: false })

    if (error) {
      console.error('❌ Error obteniendo datos de examen oficial:', error)
      return {}
    }

    if (!data || data.length === 0) {
      return {}
    }

    // Filtrar preguntas por oposición del usuario
    const filteredData: OfficialQuestion[] = oposicionSlug
      ? data.filter((q: OfficialQuestion) => examSourceMatchesOposicion(q.exam_source, oposicionSlug))
      : data

    if (filteredData.length === 0) {
      console.log(`📭 No hay preguntas oficiales de ${oposicionSlug} para estos artículos`)
      return {}
    }

    // Agrupar por artículo
    const examDataByArticle: Record<string, ExamDataAccumulator> = {}

    filteredData.forEach((question: OfficialQuestion) => {
      const articleId = question.primary_article_id
      const articleNumber = Object.keys(articleIdMap).find(key => articleIdMap[key] === articleId)

      if (!articleNumber) return

      if (!examDataByArticle[articleNumber]) {
        examDataByArticle[articleNumber] = {
          hasOfficialExams: true,
          totalOfficialQuestions: 0,
          latestExamDate: null,
          examSources: new Set(),
          examEntities: new Set(),
          difficultyLevels: new Set(),
          questions: []
        }
      }

      const articleData = examDataByArticle[articleNumber]
      articleData.totalOfficialQuestions++
      articleData.questions.push(question)

      if (question.exam_date && (!articleData.latestExamDate || question.exam_date > articleData.latestExamDate)) {
        articleData.latestExamDate = question.exam_date
      }

      if (question.exam_source) articleData.examSources.add(question.exam_source)
      if (question.exam_entity) articleData.examEntities.add(question.exam_entity)
      if (question.official_difficulty_level) articleData.difficultyLevels.add(question.official_difficulty_level)
    })

    // Convertir Sets a arrays
    const result: Record<string, ExamData> = {}
    for (const [key, acc] of Object.entries(examDataByArticle)) {
      result[key] = {
        hasOfficialExams: acc.hasOfficialExams,
        totalOfficialQuestions: acc.totalOfficialQuestions,
        latestExamDate: acc.latestExamDate,
        examSources: Array.from(acc.examSources),
        examEntities: Array.from(acc.examEntities),
        difficultyLevels: Array.from(acc.difficultyLevels),
        questions: acc.questions
      }
    }

    console.log(`✅ Datos de examen oficial cargados para ${Object.keys(result).length} artículos (${oposicionSlug || 'todas las oposiciones'})`)
    return result

  } catch (error) {
    console.error('❌ Error en fetchMultipleArticlesOfficialExamData:', error)
    return {}
  }
}

// ================================================================
// 🔗 FETCHER: Artículos relacionados (mismo tema/ley) - CORREGIDO
// ================================================================
export async function fetchRelatedArticles(lawSlug: string, currentArticleNumber: string | number, limit: number = 5): Promise<RelatedArticle[]> {
  try {
    console.log(`🔗 Cargando artículos relacionados para: ${lawSlug}`)

    const lawShortName = mapLawSlugToShortName(lawSlug)

    const { data, error } = await supabase
      .from('articles')
      .select(`
        id,
        article_number,
        title,
        content,
        laws!inner(short_name, name)
      `)
      .eq('is_active', true)
      .eq('laws.short_name', lawShortName)
      .neq('article_number', currentArticleNumber.toString()) // 🔥 CONVERTIR A STRING
      .not('content', 'is', null)
      .order('article_number')
      .limit(limit)

    if (error) throw error

    const relatedArticles: RelatedArticle[] = data.map((article: Record<string, unknown>) => {
      const laws = article.laws as Record<string, unknown>
      return {
        article_number: article.article_number as string,
        title: article.title as string | null,
        contentPreview: extractContentPreview(article.content as string),
        lawSlug: generateLawSlug(laws.short_name as string)
      }
    })

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
    console.log(`🔍 Buscando artículos: "${query}"`)

    let supabaseQuery = supabase
      .from('articles')
      .select(`
        id,
        article_number,
        title,
        content,
        laws!inner(name, short_name)
      `)
      .eq('is_active', true)
      .not('content', 'is', null)

    // Filtrar por ley si se especifica
    if (lawSlug) {
      const lawShortName = mapLawSlugToShortName(lawSlug)
      supabaseQuery = supabaseQuery.eq('laws.short_name', lawShortName)
    }

    // Buscar en título y contenido
    supabaseQuery = supabaseQuery
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      .limit(limit)

    const { data, error } = await supabaseQuery

    if (error) throw error

    const results: SearchResult[] = data.map((article: Record<string, unknown>) => {
      const laws = article.laws as Record<string, unknown>
      return {
        id: article.id as string,
        article_number: article.article_number as string,
        title: article.title as string | null,
        contentPreview: extractContentPreview(article.content as string),
        law: {
          name: laws.name as string,
          short_name: laws.short_name as string,
          slug: generateLawSlug(laws.short_name as string)
        }
      }
    })

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
    console.log(`📚 Cargando secciones de ley: ${lawSlugOrShortName}`)

    // Intentar convertir slug a short_name, o usar directamente si ya es short_name
    let lawShortName = mapLawSlugToShortName(lawSlugOrShortName)

    // Si no se encontró como slug, puede que ya sea el short_name
    if (!lawShortName && lawSlugOrShortName.includes('/')) {
      lawShortName = lawSlugOrShortName // Ya es short_name (ej: "Ley 29/1998")
    }

    console.log(`🔍 Mapeo: "${lawSlugOrShortName}" → "${lawShortName}"`)

    if (!lawShortName) {
      throw new Error(`Ley "${lawSlugOrShortName}" no reconocida`)
    }

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
      const { data: queryResult, error: lawError } = await supabase
        .from('laws')
        .select('id, name, short_name')
        .eq('short_name', lawShortName)
        .single()

      if (lawError || !queryResult) {
        throw new Error(`Ley "${lawShortName}" no encontrada`)
      }
      lawData = queryResult
    }

    // Obtener secciones de la ley
    const { data: sectionsData, error: sectionsError } = await supabase
      .from('law_sections')
      .select('*')
      .eq('law_id', lawData.id)
      .eq('is_active', true)
      .order('order_position')

    if (sectionsError) {
      throw sectionsError
    }

    // Transformar datos para la interfaz
    const sections: LawSection[] = sectionsData.map((section: Record<string, unknown>) => ({
      id: section.id as string,
      slug: section.slug as string,
      title: section.title as string,
      description: section.description as string | null,
      articleRange: section.article_range_start && section.article_range_end
        ? { start: section.article_range_start as number, end: section.article_range_end as number }
        : null,
      sectionNumber: section.section_number as number | null,
      sectionType: section.section_type as string | null,
      orderPosition: section.order_position as number
    }))

    console.log(`✅ ${sections.length} secciones cargadas para ${lawShortName}`)

    // Generar slug correcto (si recibimos short_name, convertir a slug)
    const slug = lawSlugOrShortName.includes('/')
      ? getCanonicalSlug(lawShortName) || lawSlugOrShortName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
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
