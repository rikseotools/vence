// lib/teoriaFetchers.js - FETCHERS PARA SISTEMA DE TEORÍA
import { getSupabaseClient } from './supabase'
import { mapLawSlugToShortName, generateLawSlug, getCanonicalSlug } from './lawMappingUtils'

const supabase = getSupabaseClient()

// ================================================================
// 🏛️ FETCHER: Lista de leyes con contenido de teoría disponible
// ================================================================
// 🚀 OPTIMIZADO: No traer content (17MB+), solo contar artículos válidos
export async function fetchLawsList() {
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
    const lawsWithStats = data
      .map(law => {
        // Filtrar solo artículos numéricos (1, 2, 10, etc.)
        const validArticles = (law.articles || []).filter(article => {
          const articleNum = article.article_number
          if (!articleNum || articleNum.trim() === '') return false
          // Solo números puros (excluir T1, C1, etc.)
          return /^\d+$/.test(articleNum.trim())
        })

        return {
          id: law.id,
          name: law.name,
          short_name: law.short_name,
          description: law.description,
          articleCount: validArticles.length,
          slug: generateLawSlug(law.short_name)
        }
      })
      .filter(law => law.articleCount > 0)
      .sort((a, b) => b.articleCount - a.articleCount)

    console.timeEnd('⏱️ fetchLawsList')
    console.log(`✅ ${lawsWithStats.length} leyes con teoría`)
    return lawsWithStats

  } catch (error) {
    console.error('❌ Error en fetchLawsList:', error)
    throw new Error(`Error cargando leyes: ${error.message}`)
  }
}

// ================================================================
// 📄 FETCHER: Lista de artículos de una ley específica
// ================================================================
export async function fetchLawArticles(lawSlug) {
  try {
    console.log(`📖 Cargando artículos de ley: ${lawSlug}`)

    // Convertir slug back to short_name usando mapeo centralizado
    const lawShortName = mapLawSlugToShortName(lawSlug)
    console.log(`🔍 Mapeo: "${lawSlug}" → "${lawShortName}"`)

    // Buscar la ley primero (case-insensitive) para obtener el short_name real
    const { data: lawMatch } = await supabase
      .from('laws')
      .select('short_name')
      .or(`short_name.ilike.${lawShortName},short_name.ilike.${lawSlug}`)
      .eq('is_active', true)
      .limit(1)
      .single()

    const actualShortName = lawMatch?.short_name || lawShortName
    if (lawMatch && lawMatch.short_name !== lawShortName) {
      console.log(`🔍 Encontrado en BD: "${actualShortName}"`)
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
    const articlesOnly = data.filter(item => {
      const articleNum = item.article_number
      // Excluir si es null, vacío
      if (!articleNum || articleNum.trim() === '') return false
      
      // Solo permitir números puros (1, 2, 3, 10, 100, etc.)
      // Excluir cualquier cosa que contenga letras (T1, T1C1, etc.)
      const isNumericOnly = /^\d+$/.test(articleNum.trim())
      if (!isNumericOnly) return false
      
      // Excluir títulos y capítulos comunes por título
      const lowerTitle = (item.title || '').toLowerCase()
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
    const sortedData = articlesOnly.sort((a, b) => {
      const numA = parseInt(a.article_number) || 0
      const numB = parseInt(b.article_number) || 0
      return numA - numB
    })
    
    // Procesar artículos
    const processedArticles = sortedData.map(article => ({
      id: article.id,
      article_number: article.article_number,
      title: article.title,
      content: article.content,
      contentLength: article.content?.length || 0,
      contentPreview: extractContentPreview(article.content),
      hasRichContent: isRichContent(article.content),
      law: {
        id: article.laws.id,
        name: article.laws.name,
        short_name: article.laws.short_name,
        description: article.laws.description,
        slug: generateLawSlug(article.laws.short_name)
      }
    }))
    
    console.log(`✅ ${processedArticles.length} artículos cargados`)
    return {
      articles: processedArticles,
      law: processedArticles[0].law
    }
    
  } catch (error) {
    console.error('❌ Error en fetchLawArticles:', error)
    throw new Error(`Error cargando artículos: ${error.message}`)
  }
}

// ================================================================
// 📑 FETCHER: Contenido completo de un artículo específico - CORREGIDO
// ================================================================

export async function fetchArticleContent(lawSlug, articleNumber) {
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
          id, name, short_name, description
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
          .select('article_number')
          .eq('is_active', true)
          .eq('laws.short_name', lawShortName)
          .order('article_number')
          .limit(5)
        
        const suggestions = availableArticles && availableArticles.length > 0
          ? `Artículos disponibles: ${availableArticles.map(a => a.article_number).join(', ')}`
          : 'No hay artículos disponibles para esta ley'
        
        throw new Error(`ARTICULO_NO_ENCONTRADO: El artículo ${articleNumber} no existe en ${lawShortName}. ${suggestions}`)
      }
      
      throw new Error(`ERROR_BD: ${error.message}`)
    }
    
    if (!data) {
      throw new Error(`ARTICULO_NO_ENCONTRADO: Artículo ${articleNumber} no encontrado en ${lawShortName}`)
    }
    
    // Verificar que el contenido existe y no está vacío
    if (!data.content || data.content.trim().length === 0) {
      throw new Error(`CONTENIDO_VACIO: El artículo ${articleNumber} de ${lawShortName} no tiene contenido`)
    }
    
    // Procesar contenido
    const processedArticle = {
      id: data.id,
      article_number: data.article_number,
      title: data.title,
      content: data.content,
      contentLength: data.content?.length || 0,
      cleanContent: cleanArticleContent(data.content),
      hasRichContent: isRichContent(data.content),
      created_at: data.created_at,
      updated_at: data.updated_at,
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
const OPOSICION_EXAM_SOURCE_PATTERNS = {
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
function examSourceMatchesOposicion(examSource, oposicionSlug) {
  if (!examSource || !oposicionSlug) return true

  const patterns = OPOSICION_EXAM_SOURCE_PATTERNS[oposicionSlug]
  if (!patterns) return true // Si no hay patrón definido, mostrar todo

  return patterns.some(pattern => examSource.includes(pattern))
}

export async function fetchArticleOfficialExamData(articleId, userOposicion = null) {
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
    const filteredData = oposicionSlug
      ? data.filter(q => examSourceMatchesOposicion(q.exam_source, oposicionSlug))
      : data

    if (filteredData.length === 0) {
      console.log(`📭 No hay preguntas oficiales de ${oposicionSlug} para este artículo`)
      return null
    }

    // Procesar datos de exámenes oficiales (solo los de la oposición del usuario)
    const examData = {
      hasOfficialExams: true,
      totalOfficialQuestions: filteredData.length,
      latestExamDate: filteredData[0].exam_date,
      examSources: [...new Set(filteredData.map(q => q.exam_source).filter(Boolean))],
      examEntities: [...new Set(filteredData.map(q => q.exam_entity).filter(Boolean))],
      difficultyLevels: [...new Set(filteredData.map(q => q.official_difficulty_level).filter(Boolean))],
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
export async function fetchMultipleArticlesOfficialExamData(articleNumbers, lawShortName, userOposicion = null) {
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
    const articleIdMap = {}
    articlesData.forEach(article => {
      articleIdMap[article.article_number] = article.id
    })

    const articleIds = articlesData.map(a => a.id)

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
    const filteredData = oposicionSlug
      ? data.filter(q => examSourceMatchesOposicion(q.exam_source, oposicionSlug))
      : data

    if (filteredData.length === 0) {
      console.log(`📭 No hay preguntas oficiales de ${oposicionSlug} para estos artículos`)
      return {}
    }

    // Agrupar por artículo
    const examDataByArticle = {}

    filteredData.forEach(question => {
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
    Object.values(examDataByArticle).forEach(data => {
      data.examSources = Array.from(data.examSources)
      data.examEntities = Array.from(data.examEntities)
      data.difficultyLevels = Array.from(data.difficultyLevels)
    })
    
    console.log(`✅ Datos de examen oficial cargados para ${Object.keys(examDataByArticle).length} artículos (${oposicionSlug || 'todas las oposiciones'})`)
    return examDataByArticle
    
  } catch (error) {
    console.error('❌ Error en fetchMultipleArticlesOfficialExamData:', error)
    return {}
  }
}

// ================================================================
// 🔗 FETCHER: Artículos relacionados (mismo tema/ley) - CORREGIDO
// ================================================================
export async function fetchRelatedArticles(lawSlug, currentArticleNumber, limit = 5) {
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
      //.gte('content', 'length', 100)
      .order('article_number')
      .limit(limit)
    
    if (error) throw error
    
    const relatedArticles = data.map(article => ({
      article_number: article.article_number,
      title: article.title,
      contentPreview: extractContentPreview(article.content),
      lawSlug: generateLawSlug(article.laws.short_name)
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

// Generar slug limpio para URLs


// Extraer preview del contenido
function extractContentPreview(content, maxLength = 200) {
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
function isRichContent(content) {
  if (!content) return false
  
  const htmlTags = /<(div|header|h[1-6]|p|ul|ol|li|strong|em|br)\s*[^>]*>/i
  return htmlTags.test(content)
}

// Limpiar contenido HTML para mostrar
function cleanArticleContent(content) {
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
export async function searchArticles(query, lawSlug = null, limit = 10) {
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
    
    const results = data.map(article => ({
      id: article.id,
      article_number: article.article_number,
      title: article.title,
      contentPreview: extractContentPreview(article.content),
      law: {
        name: article.laws.name,
        short_name: article.laws.short_name,
        slug: generateLawSlug(article.laws.short_name)
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
export async function fetchLawSections(lawSlugOrShortName) {
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
    
    // Obtener ID de la ley
    const { data: lawData, error: lawError } = await supabase
      .from('laws')
      .select('id, name, short_name')
      .eq('short_name', lawShortName)
      .single()
    
    if (lawError || !lawData) {
      throw new Error(`Ley "${lawShortName}" no encontrada`)
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
    const sections = sectionsData.map(section => ({
      id: section.id,
      slug: section.slug,
      title: section.title,
      description: section.description,
      articleRange: section.article_range_start && section.article_range_end 
        ? { start: section.article_range_start, end: section.article_range_end }
        : null,
      sectionNumber: section.section_number,
      sectionType: section.section_type,
      orderPosition: section.order_position
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
    throw new Error(`Error cargando secciones: ${error.message}`)
  }
}