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
// 🔧 FUNCIÓN DE TRANSFORMACIÓN (misma que testFetchers.js)
// =================================================================
export function transformQuestions(supabaseQuestions) {
  if (!supabaseQuestions || !Array.isArray(supabaseQuestions)) {
    console.error('❌ transformQuestions: Datos inválidos recibidos')
    return []
  }

  return supabaseQuestions.map((q, index) => {
    return {
      question: q.question_text,
      options: [
        q.option_a,
        q.option_b, 
        q.option_c,
        q.option_d
      ],
      correct: q.correct_option, 
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
    console.log('📚 [LAW FETCHER] Cargando preguntas por ley:', lawShortName)
    
    // ✅ USAR FUNCIÓN getParam UNIVERSAL
    const numQuestions = parseInt(getParam(searchParams, 'n')) || 
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
      searchParamsType: typeof searchParams?.get === 'function' ? 'URLSearchParams' : 'object'
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

    // 🏛️ Filtro por preguntas oficiales si está activado
    if (onlyOfficial) {
      baseQuery = baseQuery.eq('is_official_exam', true)
      console.log('🏛️ [LAW FETCHER] Filtro aplicado: Solo preguntas oficiales')
    }

    // 🔄 Obtener preguntas (más de las necesarias para mezclar)
    const multiplier = Math.min(3, Math.max(1.5, 50 / numQuestions)) // Entre 1.5x y 3x
    const queryLimit = Math.min(200, Math.ceil(numQuestions * multiplier))
    
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

    // 🎲 Mezclar y seleccionar cantidad solicitada
    const shuffledQuestions = shuffleArray(validQuestions)
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
    
    const stats = {
      lawShortName,
      totalQuestions: totalQuestions || 0,
      officialQuestions: officialQuestions || 0,
      regularQuestions: (totalQuestions || 0) - (officialQuestions || 0),
      hasQuestions: (totalQuestions || 0) > 0,
      hasOfficialQuestions: (officialQuestions || 0) > 0
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