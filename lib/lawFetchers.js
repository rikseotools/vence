// lib/lawFetchers.js - FETCHERS ESPECÍFICOS PARA TESTS POR LEY
import { getSupabaseClient } from './supabase'

const supabase = getSupabaseClient()

// =================================================================
// 🔧 FUNCIÓN AUXILIAR UNIVERSAL: Extraer parámetros de diferentes fuentes
// =================================================================
function getParam(searchParams, key, defaultValue = null) {
  if (!searchParams) return defaultValue
  
  // Si es URLSearchParams (desde hook useSearchParams)
  if (typeof searchParams.get === 'function') {
    return searchParams.get(key) || defaultValue
  }
  
  // Si es objeto plano (desde server component o props)
  if (typeof searchParams === 'object') {
    return searchParams[key] || defaultValue
  }
  
  return defaultValue
}

// =================================================================
// 🏛️ MAPEO: positionType → valores válidos de exam_position
// =================================================================
// Las preguntas oficiales tienen exam_position con valores inconsistentes.
// Este mapeo permite filtrar preguntas oficiales por oposición del usuario.
const EXAM_POSITION_MAP = {
  'auxiliar_administrativo': [
    'auxiliar administrativo del estado',
    'auxiliar administrativo',
    'auxiliar_administrativo',
    'auxiliar_administrativo_estado',
  ],
  'administrativo': [
    'administrativo',
    'cuerpo_general_administrativo',
    'cuerpo general administrativo de la administración del estado',
  ],
  'gestion_administracion_civil': [
    'cuerpo_gestion_administracion_civil',
    'cuerpo de gestión de la administración civil del estado',
  ],
  'tramitacion_procesal': [
    'tramitacion_procesal',
    'tramitación procesal',
  ],
  'auxilio_judicial': [
    'auxilio_judicial',
    'auxilio judicial',
  ],
  'gestion_procesal': [
    'gestion_procesal',
    'gestión procesal',
  ],
}

/**
 * Construye el filtro de exam_position para Supabase
 * @param {string} positionType - Tipo de oposición del usuario
 * @returns {string|null} - Filtro OR para Supabase o null si no hay mapeo
 */
function buildExamPositionFilter(positionType) {
  if (!positionType) return null
  const normalized = positionType.toLowerCase().replace(/-/g, '_')
  const validPositions = EXAM_POSITION_MAP[normalized]
  if (!validPositions || validPositions.length === 0) return null

  // Construir filtro: solo exam_position IN (valores) - NO incluir NULL
  // Las preguntas sin exam_position no están categorizadas y no deben mostrarse
  const escaped = validPositions.map(p => p.replace(/,/g, '\\,')).join(',')
  return `exam_position.in.(${escaped})`
}

// =================================================================
// 🔧 FUNCIÓN DE TRANSFORMACIÓN (misma que testFetchers.js)
// =================================================================
export function transformQuestions(supabaseQuestions) {
  if (!supabaseQuestions || !Array.isArray(supabaseQuestions)) {
    console.error('❌ transformQuestions: Datos inválidos recibidos')
    return []
  }

  return supabaseQuestions.map((q, index) => {
    return {
      // ✅ PRESERVAR ID ORIGINAL DE LA BASE DE DATOS
      id: q.id,
      question: q.question_text,
      options: [
        q.option_a,
        q.option_b,
        q.option_c,
        q.option_d
      ],
      // 🔒 SEGURIDAD: correct_option eliminado - validación solo via API /api/answer
      explanation: q.explanation,
      
      // 🔥 INCLUIR primary_article_id PARA HOT ARTICLES
      primary_article_id: q.primary_article_id,
      
      article: {
        id: q.articles?.id,
        number: q.articles?.article_number || (index + 1).toString(),
        title: q.articles?.title || `Artículo ${index + 1}`,
        full_text: q.articles?.content || `Contenido del artículo ${q.articles?.article_number || index + 1}`,
        law_name: q.articles?.laws?.name || q.articles?.laws?.short_name || 'Ley',
        law_short_name: q.articles?.laws?.short_name || 'Ley',
        display_number: `Art. ${q.articles?.article_number || index + 1} ${q.articles?.laws?.short_name || 'Ley'}`,
      },
      
      // 🎛️ METADATOS
      metadata: {
        id: q.id,
        difficulty: q.difficulty || 'auto',
        question_type: q.question_type || 'single',
        tags: q.tags || [],
        is_active: q.is_active,
        created_at: q.created_at,
        updated_at: q.updated_at,
        // 🏛️ Información de exámenes oficiales si aplica
        is_official_exam: q.is_official_exam,
        exam_source: q.exam_source,
        exam_date: q.exam_date,
        exam_entity: q.exam_entity,
        official_difficulty_level: q.official_difficulty_level,
      }
    }
  })
}

// =================================================================
// 🔧 FUNCIÓN AUXILIAR: Mezclar arrays
// =================================================================
function shuffleArray(array) {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// =================================================================
// 📚 FETCHER PRINCIPAL: TEST POR LEY ESPECÍFICA - CORREGIDO
// =================================================================
export async function fetchQuestionsByLaw(lawShortName, searchParams = {}, config = {}) {
  try {
    console.log('📚 [LAW FETCHER] 🚀 INICIANDO fetchQuestionsByLaw:', { lawShortName, searchParams, config })
    
    // ✅ USAR FUNCIÓN getParam UNIVERSAL
    let numQuestions = parseInt(getParam(searchParams, 'n')) || 
                        config?.numQuestions || 
                        config?.defaultConfig?.numQuestions || 
                        10
    
    const testType = config?.testType || 'aleatorio'
    const onlyOfficial = getParam(searchParams, 'only_official') === 'true' || testType === 'oficial'
    
    console.log('🔧 [LAW FETCHER] Configuración:', { 
      lawShortName, 
      numQuestions, 
      testType, 
      onlyOfficial,
      searchParamsType: typeof searchParams?.get === 'function' ? 'URLSearchParams' : 'object',
      sectionFilterParam: getParam(searchParams, 'section_filter')
    })

    // 🔍 ESTRATEGIA: Query directa por ley a través de articles
    let baseQuery = supabase
      .from('questions')
      .select(`
        id, question_text, option_a, option_b, option_c, option_d,
        correct_option, explanation, difficulty, question_type, tags,
        primary_article_id, is_official_exam, exam_source, exam_date,
        exam_entity, official_difficulty_level, is_active, created_at, updated_at,
        articles!inner (
          id, article_number, title, content, section,
          laws!inner (id, name, short_name, year, type, scope)
        )
      `)
      .eq('is_active', true)
      .eq('articles.laws.short_name', lawShortName)

    // 🏛️ Filtro por preguntas oficiales si está activado (CON FILTRO POR OPOSICIÓN)
    if (onlyOfficial) {
      baseQuery = baseQuery.eq('is_official_exam', true)
      // Añadir filtro por exam_position para evitar preguntas de otras oposiciones
      const positionType = config?.positionType || 'auxiliar_administrativo'
      const examPositionFilter = buildExamPositionFilter(positionType)
      if (examPositionFilter) {
        baseQuery = baseQuery.or(examPositionFilter)
      }
      console.log(`🏛️ [LAW FETCHER] Filtro aplicado: Solo preguntas oficiales de ${positionType}`)
    }

    // 📚 Parsear filtro por sección/título para aplicar después
    const sectionFilter = getParam(searchParams, 'section_filter')
    let parsedSectionFilter = null
    console.log('🔍 [LAW FETCHER] Verificando section_filter:', { sectionFilter, type: typeof sectionFilter })
    
    if (sectionFilter) {
      try {
        parsedSectionFilter = JSON.parse(sectionFilter)
        console.log('📚 [LAW FETCHER] Datos de sección parseados:', parsedSectionFilter)
        
        if (parsedSectionFilter.articleRange) {
          console.log(`📚 [LAW FETCHER] ✅ FILTRO PREPARADO: ${parsedSectionFilter.title} (Arts. ${parsedSectionFilter.articleRange.start}-${parsedSectionFilter.articleRange.end})`)
          console.log('📚 [LAW FETCHER] Filtro se aplicará en post-procesamiento')
        } else {
          console.warn('⚠️ [LAW FETCHER] sectionData no tiene articleRange')
          parsedSectionFilter = null
        }
      } catch (error) {
        console.error('❌ [LAW FETCHER] Error parseando section_filter:', error)
        parsedSectionFilter = null
      }
    } else {
      console.log('📚 [LAW FETCHER] No hay filtro de sección activo')
    }

    // 📄 Parsear filtro por artículos específicos
    const selectedArticlesParam = getParam(searchParams, 'selected_articles')
    let selectedArticles = null
    console.log('🔍 [LAW FETCHER] Verificando selected_articles:', { selectedArticlesParam, type: typeof selectedArticlesParam })
    
    if (selectedArticlesParam) {
      try {
        selectedArticles = selectedArticlesParam.split(',').map(art => art.trim()).filter(Boolean)
        console.log(`📄 [LAW FETCHER] ✅ FILTRO DE ARTÍCULOS PREPARADO: ${selectedArticles.length} artículos (${selectedArticles.join(', ')})`)
        console.log('📄 [LAW FETCHER] Filtro se aplicará en post-procesamiento')
        
        // 📄 Al usar artículos específicos, usar todas las preguntas disponibles
        console.log('📄 [LAW FETCHER] Artículos específicos detectados - usando todas las preguntas disponibles')
        numQuestions = 1000 // Usar un número alto para obtener todas las preguntas
      } catch (error) {
        console.error('❌ [LAW FETCHER] Error parseando selected_articles:', error)
        selectedArticles = null
      }
    } else {
      console.log('📄 [LAW FETCHER] No hay filtro de artículos específicos activo')
    }

    // 🔄 Obtener preguntas (más de las necesarias para mezclar)
    let multiplier = Math.min(3, Math.max(1.5, 50 / numQuestions)) // Entre 1.5x y 3x
    
    // Si hay filtro de sección, necesitamos más preguntas porque vamos a filtrar muchas
    if (parsedSectionFilter && parsedSectionFilter.articleRange) {
      multiplier = Math.min(20, Math.max(10, 200 / numQuestions)) // Multiplicador más alto para filtrado
      console.log('📚 [LAW FETCHER] Incrementando query limit por filtro de sección')
    }
    
    // Si hay filtro de artículos específicos, también necesitamos más preguntas
    if (selectedArticles && selectedArticles.length > 0) {
      multiplier = Math.min(20, Math.max(10, 200 / numQuestions)) // Multiplicador más alto para filtrado
      console.log('📄 [LAW FETCHER] Incrementando query limit por filtro de artículos específicos')
    }
    
    // Para filtros, usar límite mucho mayor para asegurar que se obtengan todas las preguntas relevantes
    const hasAnyFilter = parsedSectionFilter || (selectedArticles && selectedArticles.length > 0)
    let queryLimit
    
    if (selectedArticles && selectedArticles.length > 0) {
      // Para filtros de artículos específicos, usar un límite muy alto para asegurar que se encuentren todas las preguntas
      queryLimit = 556 // Prácticamente todas las preguntas de CE
      console.log('📄 [LAW FETCHER] Usando límite máximo para filtro de artículos específicos')
    } else if (parsedSectionFilter) {
      queryLimit = Math.min(600, Math.ceil(numQuestions * multiplier))
    } else {
      queryLimit = Math.min(300, Math.ceil(numQuestions * multiplier))
    }
    
    console.log(`📊 [LAW FETCHER] Solicitando ${queryLimit} preguntas (${multiplier}x) para seleccionar ${numQuestions}`)
    
    const { data: lawQuestions, error: lawError } = await baseQuery
      .limit(queryLimit)
      .order('created_at', { ascending: false })

    if (lawError) {
      console.error('❌ [LAW FETCHER] Error consultando preguntas:', lawError)
      throw new Error(`Error consultando preguntas de ${lawShortName}: ${lawError.message}`)
    }

    if (!lawQuestions || lawQuestions.length === 0) {
      console.warn(`⚠️ [LAW FETCHER] No se encontraron preguntas para ${lawShortName}`)
      throw new Error(`No hay preguntas disponibles para ${lawShortName}`)
    }

    console.log(`📊 [LAW FETCHER] ${lawShortName}: ${lawQuestions.length} preguntas encontradas`)
    
    // 🔍 DEBUG: Verificar artículos de las preguntas obtenidas
    const articleNumbers = lawQuestions.map(q => q.articles?.article_number).filter(Boolean)
    const uniqueArticles = [...new Set(articleNumbers)].sort((a, b) => a - b)
    console.log('📚 [LAW FETCHER] Artículos en preguntas obtenidas:', {
      count: articleNumbers.length,
      range: articleNumbers.length > 0 ? `${Math.min(...articleNumbers)}-${Math.max(...articleNumbers)}` : 'N/A',
      uniqueArticles: uniqueArticles,
      totalUniqueArticles: uniqueArticles.length
    })
    
    // 🔍 BUSCAR ESPECÍFICAMENTE ARTÍCULOS 0-9
    const articulos0a9 = uniqueArticles.filter(art => art >= 0 && art <= 9)
    console.log('🔍 [DEBUG] Artículos 0-9 encontrados:', articulos0a9)
    
    // 🔍 DEBUG: Mostrar primera muestra de artículos para validar
    console.log('🔍 [DEBUG] Primeras 5 preguntas por artículo:', lawQuestions.slice(0, 5).map(q => `Art.${q.articles?.article_number}`).join(', '))
    
    // 🔍 VERIFICAR SI HAY PREGUNTAS CON ARTÍCULO NaN o problemáticos
    const problemArticles = lawQuestions.filter(q => !q.articles?.article_number || isNaN(parseInt(q.articles.article_number)))
    console.log('⚠️ [DEBUG] Preguntas con artículos problemáticos:', problemArticles.length)
    
    // 🔍 Validar que las preguntas tienen la estructura correcta
    const validQuestions = lawQuestions.filter(q => {
      const isValid = q.question_text && 
                     q.option_a && q.option_b && q.option_c && q.option_d &&
                     typeof q.correct_option === 'number' &&
                     q.articles && q.articles.laws
      
      if (!isValid) {
        console.warn('⚠️ [LAW FETCHER] Pregunta inválida descartada:', q.id)
      }
      
      return isValid
    })
    
    if (validQuestions.length === 0) {
      throw new Error(`Las preguntas de ${lawShortName} no tienen el formato correcto`)
    }
    
    console.log(`✅ [LAW FETCHER] ${validQuestions.length} preguntas válidas de ${lawQuestions.length} total`)

    // 📚 Aplicar filtro de sección si está especificado
    let filteredQuestions = validQuestions
    if (parsedSectionFilter && parsedSectionFilter.articleRange) {
      const { start, end } = parsedSectionFilter.articleRange
      const startArticle = parseInt(start)
      const endArticle = parseInt(end)
      
      filteredQuestions = validQuestions.filter(q => {
        const articleNumber = parseInt(q.articles?.article_number)
        let isInRange = articleNumber >= startArticle && articleNumber <= endArticle
        
        // 🏛️ CASO ESPECIAL: Para "PREÁMBULO Y TÍTULO PRELIMINAR" (arts. 1-9), incluir también artículo 0
        if (parsedSectionFilter.title === "PREÁMBULO Y TÍTULO PRELIMINAR" && articleNumber === 0) {
          isInRange = true
        }
        
        // Solo mostrar logs para preguntas incluidas para reducir spam en consola
        if (isInRange) {
          console.log(`📚 [FILTER] Pregunta: Art. ${articleNumber} ✅ INCLUIDA`)
        }
        
        return isInRange
      })
      
      console.log(`📚 [LAW FETCHER] ✅ FILTRO APLICADO: ${filteredQuestions.length} preguntas filtradas de ${validQuestions.length} (rango: ${startArticle}-${endArticle})`)
      
      // Verificar artículos en preguntas filtradas
      const filteredArticles = filteredQuestions.map(q => parseInt(q.articles?.article_number)).filter(Boolean).sort((a, b) => a - b)
      console.log(`📚 [LAW FETCHER] Artículos en preguntas filtradas:`, {
        count: filteredArticles.length,
        range: filteredArticles.length > 0 ? `${Math.min(...filteredArticles)}-${Math.max(...filteredArticles)}` : 'N/A',
        articles: filteredArticles
      })
    }

    // 📄 Aplicar filtro de artículos específicos si está especificado
    if (selectedArticles && selectedArticles.length > 0) {
      const beforeFilterCount = filteredQuestions.length
      
      filteredQuestions = filteredQuestions.filter(q => {
        const articleNumber = q.articles?.article_number?.toString()
        const isIncluded = selectedArticles.includes(articleNumber)
        
        // Solo mostrar logs para preguntas incluidas para reducir spam en consola
        if (isIncluded) {
          console.log(`📄 [FILTER] Pregunta: Art. ${articleNumber} ✅ INCLUIDA`)
        }
        
        return isIncluded
      })
      
      console.log(`📄 [LAW FETCHER] ✅ FILTRO DE ARTÍCULOS APLICADO: ${filteredQuestions.length} preguntas filtradas de ${beforeFilterCount} (artículos: ${selectedArticles.join(', ')})`)
      
      // Verificar artículos en preguntas filtradas
      const filteredArticles = filteredQuestions.map(q => q.articles?.article_number).filter(Boolean).sort((a, b) => parseInt(a) - parseInt(b))
      console.log(`📄 [LAW FETCHER] Artículos en preguntas filtradas:`, {
        count: filteredArticles.length,
        articles: filteredArticles,
        uniqueArticles: [...new Set(filteredArticles)]
      })
    }

    // 🎯 Verificar si hay suficientes preguntas después del filtrado
    if (filteredQuestions.length === 0) {
      if (parsedSectionFilter) {
        console.warn(`⚠️ [LAW FETCHER] No hay preguntas disponibles para la sección: ${parsedSectionFilter.title} (Arts. ${parsedSectionFilter.articleRange.start}-${parsedSectionFilter.articleRange.end})`)
        throw new Error(`No hay preguntas disponibles para la sección "${parsedSectionFilter.title}" (artículos ${parsedSectionFilter.articleRange.start}-${parsedSectionFilter.articleRange.end}). Prueba con otra sección.`)
      } else if (selectedArticles && selectedArticles.length > 0) {
        console.warn(`⚠️ [LAW FETCHER] No hay preguntas disponibles para los artículos: ${selectedArticles.join(', ')}`)
        throw new Error(`No hay preguntas disponibles para los artículos seleccionados (${selectedArticles.join(', ')}). Prueba con otros artículos.`)
      } else {
        throw new Error(`No hay preguntas disponibles para ${lawShortName}`)
      }
    }

    // 🎲 Mezclar y seleccionar cantidad solicitada
    const shuffledQuestions = shuffleArray(filteredQuestions)
    const finalQuestions = shuffledQuestions.slice(0, Math.min(numQuestions, shuffledQuestions.length))

    console.log(`✅ [LAW FETCHER] Test por ley completado: ${finalQuestions.length} preguntas de ${lawShortName}`)
    
    // 📊 Estadísticas de debug
    if (finalQuestions.length > 0) {
      const lawStats = finalQuestions.reduce((acc, q) => {
        const law = q.articles?.laws?.short_name || 'Desconocida'
        acc[law] = (acc[law] || 0) + 1
        return acc
      }, {})
      console.log(`📊 [LAW FETCHER] Distribución por ley:`, lawStats)
    }
    
    return transformQuestions(finalQuestions)

  } catch (error) {
    console.error(`❌ [LAW FETCHER] Error en fetchQuestionsByLaw (${lawShortName}):`, error)
    throw error
  }
}

// =================================================================
// ⚡ FETCHER ESPECÍFICO: TEST RÁPIDO POR LEY - CORREGIDO
// =================================================================
export async function fetchLawQuickTest(lawShortName, searchParams = {}, config = {}) {
  console.log('⚡ [LAW FETCHER] Test rápido por ley:', lawShortName)
  
  const quickConfig = {
    ...config,
    testType: 'rapido',
    numQuestions: parseInt(getParam(searchParams, 'n')) || 10
  }
  
  return await fetchQuestionsByLaw(lawShortName, searchParams, quickConfig)
}

// =================================================================
// 🎯 FETCHER ESPECÍFICO: TEST AVANZADO POR LEY - CORREGIDO
// =================================================================
export async function fetchLawAdvancedTest(lawShortName, searchParams = {}, config = {}) {
  console.log('🎯 [LAW FETCHER] Test avanzado por ley:', lawShortName)
  
  const advancedConfig = {
    ...config,
    testType: 'avanzado',
    numQuestions: parseInt(getParam(searchParams, 'n')) || 25
  }
  
  return await fetchQuestionsByLaw(lawShortName, searchParams, advancedConfig)
}

// =================================================================
// 🏛️ FETCHER ESPECÍFICO: TEST OFICIAL POR LEY - CORREGIDO
// =================================================================
export async function fetchLawOfficialTest(lawShortName, searchParams = {}, config = {}) {
  console.log('🏛️ [LAW FETCHER] Test oficial por ley:', lawShortName)
  
  const officialConfig = {
    ...config,
    testType: 'oficial',
    numQuestions: parseInt(getParam(searchParams, 'n')) || 20
  }
  
  // Forzar solo preguntas oficiales
  const officialSearchParams = {
    ...searchParams,
    only_official: 'true'
  }
  
  return await fetchQuestionsByLaw(lawShortName, officialSearchParams, officialConfig)
}

// =================================================================
// 🔧 FUNCIÓN AUXILIAR: Validar que una ley existe
// =================================================================
export async function validateLawExists(lawShortName) {
  try {
    const { count, error } = await supabase
      .from('questions')
      .select('id, articles!inner(laws!inner(short_name))', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('articles.laws.short_name', lawShortName)
    
    if (error) {
      console.error('❌ [LAW FETCHER] Error validando ley:', error)
      return false
    }
    
    const hasQuestions = (count || 0) > 0
    console.log(`🔍 [LAW FETCHER] Ley ${lawShortName}: ${count || 0} preguntas, válida: ${hasQuestions}`)
    
    return hasQuestions
    
  } catch (error) {
    console.error('❌ [LAW FETCHER] Error en validateLawExists:', error)
    return false
  }
}

// =================================================================
// 📊 FUNCIÓN AUXILIAR: Obtener estadísticas de una ley
// =================================================================
export async function getLawStats(lawShortName) {
  try {
    console.log(`📊 [LAW FETCHER] Obteniendo estadísticas de ${lawShortName}`)
    
    // Contar total de preguntas
    const { count: totalQuestions } = await supabase
      .from('questions')
      .select('id, articles!inner(laws!inner(short_name))', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('articles.laws.short_name', lawShortName)
    
    // Contar preguntas oficiales
    const { count: officialQuestions } = await supabase
      .from('questions')
      .select('id, articles!inner(laws!inner(short_name))', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('is_official_exam', true)
      .eq('articles.laws.short_name', lawShortName)
    
    // Asegurar que totalQuestions sea al menos igual a officialQuestions
    // (puede haber inconsistencias en las queries con joins)
    const total = totalQuestions || 0
    const official = officialQuestions || 0
    const adjustedTotal = Math.max(total, official) // El total nunca puede ser menor que las oficiales

    const stats = {
      lawShortName,
      totalQuestions: adjustedTotal,
      officialQuestions: official,
      regularQuestions: Math.max(0, adjustedTotal - official), // Nunca negativo
      hasQuestions: adjustedTotal > 0,
      hasOfficialQuestions: official > 0
    }
    
    console.log(`📊 [LAW FETCHER] Estadísticas de ${lawShortName}:`, stats)
    return stats
    
  } catch (error) {
    console.error(`❌ [LAW FETCHER] Error obteniendo estadísticas de ${lawShortName}:`, error)
    return {
      lawShortName,
      totalQuestions: 0,
      officialQuestions: 0,
      regularQuestions: 0,
      hasQuestions: false,
      hasOfficialQuestions: false,
      error: error.message
    }
  }
}

// =================================================================
// 🆕 NUEVOS FETCHERS: Wrappers que mapean tema → ley específica
// =================================================================

// 🔧 Mapeo de temas mono-ley a short_name
const TEMA_TO_LAW_MAPPING = {
  0: 'CE',           // Constitución Española
  7: 'Ley 19/2013',  // Ley de Transparencia
  // Agregar más temas mono-ley aquí según sea necesario
}

// ⚡ WRAPPER: Test rápido por tema (solo para temas mono-ley)
export async function fetchQuickQuestionsByTema(tema, searchParams, config) {
  const lawShortName = TEMA_TO_LAW_MAPPING[tema]
  
  if (!lawShortName) {
    throw new Error(`Tema ${tema} no está configurado como mono-ley en lawFetchers`)
  }
  
  console.log(`⚡ [LAW FETCHER] Test rápido tema ${tema} → ley ${lawShortName}`)
  return await fetchLawQuickTest(lawShortName, searchParams, config)
}

// 🎯 WRAPPER: Test avanzado por tema (solo para temas mono-ley)
export async function fetchAdvancedQuestionsByTema(tema, searchParams, config) {
  const lawShortName = TEMA_TO_LAW_MAPPING[tema]
  
  if (!lawShortName) {
    throw new Error(`Tema ${tema} no está configurado como mono-ley en lawFetchers`)
  }
  
  console.log(`🎯 [LAW FETCHER] Test avanzado tema ${tema} → ley ${lawShortName}`)
  return await fetchLawAdvancedTest(lawShortName, searchParams, config)
}

// 🏛️ WRAPPER: Test oficial por tema (solo para temas mono-ley)
export async function fetchOfficialQuestionsByTema(tema, searchParams, config) {
  const lawShortName = TEMA_TO_LAW_MAPPING[tema]
  
  if (!lawShortName) {
    throw new Error(`Tema ${tema} no está configurado como mono-ley en lawFetchers`)
  }
  
  console.log(`🏛️ [LAW FETCHER] Test oficial tema ${tema} → ley ${lawShortName}`)
  return await fetchLawOfficialTest(lawShortName, searchParams, config)
}

// 🎲 WRAPPER: Test aleatorio por tema (solo para temas mono-ley)
export async function fetchRandomQuestionsByTema(tema, searchParams, config) {
  const lawShortName = TEMA_TO_LAW_MAPPING[tema]
  
  if (!lawShortName) {
    throw new Error(`Tema ${tema} no está configurado como mono-ley en lawFetchers`)
  }
  
  console.log(`🎲 [LAW FETCHER] Test aleatorio tema ${tema} → ley ${lawShortName}`)
  return await fetchQuestionsByLaw(lawShortName, searchParams, config)
}