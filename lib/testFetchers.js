// lib/testFetchers.js - FETCHERS MODULARES PARA TODOS LOS TIPOS DE TEST - CON SOPORTE MULTI-LEY
import { getSupabaseClient } from './supabase'

const supabase = getSupabaseClient()

// =================================================================
// 🔧 FUNCIÓN DE TRANSFORMACIÓN COMÚN
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
      correct: q.correct_option, 
      explanation: q.explanation,
      
      // 🔥 INCLUIR primary_article_id PARA HOT ARTICLES
      primary_article_id: q.primary_article_id,
      
      // 🎯 INCLUIR TEMA PARA TESTS ALEATORIOS
      tema: q.tema,
      
      article: {
        id: q.articles?.id,
        number: q.articles?.article_number || (index + 1).toString(),
        title: q.articles?.title || `Artículo ${index + 1}`,
        full_text: q.articles?.content || `Artículo ${q.articles?.article_number || index + 1} de la Ley 19/2013`,
        law_name: q.articles?.laws?.name || 'Ley 19/2013 de transparencia',
        law_short_name: q.articles?.laws?.short_name || 'Ley 19/2013',
        display_number: `Art. ${q.articles?.article_number || index + 1} ${q.articles?.laws?.short_name || 'Ley 19/2013'}`,
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
// 🎲 FETCHER: TEST ALEATORIO
// =================================================================
export async function fetchRandomQuestions(tema, searchParams, config) {
  try {
    console.log('🎲 Cargando test aleatorio para tema:', tema)
    
    const numQuestions = parseInt(searchParams.get('n')) || 25
    const adaptiveMode = searchParams.get('adaptive') === 'true'
    
    // 🧠 Si modo adaptativo, cargar pool más grande
    const poolSize = adaptiveMode ? numQuestions * 2 : numQuestions
    
    const { data, error } = await supabase.rpc('get_questions_dynamic', {
      tema_number: tema,
      total_questions: poolSize
    })
    
    if (error) {
      console.error('❌ Error en get_questions_dynamic:', error)
      throw error
    }
    
    if (!data || data.length === 0) {
      throw new Error(`No hay preguntas disponibles para el tema ${tema}`)
    }
    
    const questions = transformQuestions(data)
    
    if (adaptiveMode) {
      console.log('🧠 Modo adaptativo:', questions.length, 'preguntas en pool,', numQuestions, 'activas')
      // Separar en activas y pool de reserva
      return {
        activeQuestions: questions.slice(0, numQuestions),
        questionPool: questions,
        poolSize: questions.length,
        requestedCount: numQuestions,
        isAdaptive: true
      }
    }
    
    console.log('✅ Test aleatorio cargado:', questions.length, 'preguntas')
    return questions
    
  } catch (error) {
    console.error('❌ Error en fetchRandomQuestions:', error)
    throw error
  }
}

// =================================================================
// ⚡ FETCHER: TEST RÁPIDO - ARREGLADO
// =================================================================
export async function fetchQuickQuestions(tema, searchParams, config) {
  try {
    console.log('⚡ Cargando test rápido para tema:', tema)
    
    const numQuestions = parseInt(searchParams.get('n')) || 10
    const lawParam = searchParams.get('law') // 🆕 OBTENER PARÁMETRO DE LEY
    const articlesParam = searchParams.get('articles') // 🆕 OBTENER PARÁMETROS DE ARTÍCULOS
    
    console.log('🔍 Parámetros de test rápido:', { tema, numQuestions, lawParam, articlesParam })
    
    // 🎯 SI HAY PARÁMETRO DE LEY, FILTRAR POR ESA LEY
    if (lawParam) {
      console.log('🎯 Filtrando por ley específica:', lawParam)
      
      // 🚀 SISTEMA 100% UNIVERSAL: Generar TODAS las variantes posibles + patrones automáticos
      const mappedName = mapLawSlugToShortName(lawParam)
      
      // Generar patrones automáticos para cualquier ley
      const autoPatterns = []
      
      // Patrón ley-XX-YYYY → múltiples formatos
      if (lawParam.match(/^ley-(\d+)-(\d+)$/)) {
        const [, number, year] = lawParam.match(/^ley-(\d+)-(\d+)$/)
        autoPatterns.push(
          `Ley ${number}/${year}`,     // Ley 15/2025
          `LEY ${number}/${year}`,     // LEY 15/2025
          `Ley ${number} de ${year}`,  // Ley 15 de 2025
          `L ${number}/${year}`,       // L 15/2025
          `${number}/${year}`,         // 15/2025
        )
      }
      
      // Patrón general: slug → múltiples formatos
      const slugVariants = [
        lawParam.replace(/-/g, ' '),                    // guiones → espacios
        lawParam.replace(/-/g, ' ').toUpperCase(),      // MAYÚSCULAS con espacios
        lawParam.replace(/-/g, '_'),                    // guiones → underscores
        lawParam.replace(/^([a-z]+)-/, (match, p1) => p1.toUpperCase() + ' '), // primera palabra en mayúscula
      ]
      
      const possibleLawNames = [
        lawParam,                     // Valor original
        lawParam.toUpperCase(),       // MAYÚSCULAS
        lawParam.toLowerCase(),       // minúsculas
        mappedName,                   // Mapeo oficial
        ...autoPatterns,              // Patrones automáticos
        ...slugVariants,              // Variantes del slug
        // Casos específicos conocidos
        'CE', 'LPAC', 'LRJSP', 'LOTC', 'TUE', 'TFUE',
      ].filter(Boolean).filter((name, index, arr) => arr.indexOf(name) === index)
      
      console.log('🔍 Probando variantes de ley:', possibleLawNames)
      
      // 🎯 QUERY CON FILTRO POR LEY (y opcionalmente por artículos)
      let query = supabase
        .from('questions')
        .select(`
          id, question_text, option_a, option_b, option_c, option_d,
          correct_option, explanation, difficulty, is_official_exam,
          primary_article_id, exam_source, exam_date, exam_entity,
          articles!inner(
            id, article_number, title, content,
            laws!inner(short_name, name)
          )
        `)
        .eq('is_active', true)
        .in('articles.laws.short_name', possibleLawNames)
      
      // 🎯 FILTRO ADICIONAL POR ARTÍCULOS ESPECÍFICOS (para artículos problemáticos)
      if (articlesParam) {
        const articleNumbers = articlesParam.split(',').map(a => parseInt(a.trim())).filter(Boolean)
        if (articleNumbers.length > 0) {
          console.log('🎯 Filtrando también por artículos específicos:', articleNumbers)
          query = query.in('articles.article_number', articleNumbers)
        }
      }
      
      const { data: lawQuestions, error: lawError } = await query
        .order('created_at', { ascending: false })
        .limit(numQuestions * 2)
      
      if (!lawError && lawQuestions && lawQuestions.length > 0) {
        console.log(`✅ Encontradas ${lawQuestions.length} preguntas para ley: ${lawParam}`)
        const shuffledQuestions = shuffleArray(lawQuestions)
        const finalQuestions = shuffledQuestions.slice(0, numQuestions)
        return transformQuestions(finalQuestions)
      } else {
        console.warn(`⚠️ No se encontraron preguntas para ley: ${lawParam}, usando fallback general`)
      }
    }
    
    // 🔄 FALLBACK: TEST RÁPIDO GENERAL (sin filtro de ley)
    console.log('⚡ Cargando test rápido general (sin filtro de ley)')
    
    // 🔄 FALLBACK DIRECTO: Query normal SIN función RPC
    const { data, error } = await supabase
      .from('questions')
      .select(`
        id, question_text, option_a, option_b, option_c, option_d,
        correct_option, explanation, difficulty, is_official_exam,
        primary_article_id, exam_source, exam_date, exam_entity,
        articles!inner(
          id, article_number, title, content,
          laws!inner(short_name, name)
        )
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(numQuestions * 2)
    
    if (error) {
      console.error('❌ Error en get_questions_dynamic:', error)
      
      // 🔄 FALLBACK: Query directa SIN random()
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('questions')
        .select(`
          id, question_text, option_a, option_b, option_c, option_d,
          correct_option, explanation, difficulty, is_official_exam,
          primary_article_id, exam_source, exam_date, exam_entity,
          articles!inner(
            id, article_number, title, content,
            laws!inner(short_name, name)
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false }) // ✅ SIN random()
        .limit(numQuestions * 2)
      
      if (fallbackError) throw fallbackError
      
      if (!fallbackData || fallbackData.length === 0) {
        throw new Error(`No hay preguntas disponibles para test rápido`)
      }
      
      // Mezclar y tomar solo las que necesitamos
      const shuffledQuestions = shuffleArray(fallbackData)
      const finalQuestions = shuffledQuestions.slice(0, numQuestions)
      
      console.log('✅ Test rápido cargado (fallback):', finalQuestions.length, 'preguntas')
      return transformQuestions(finalQuestions)
    }
    
    if (!data || data.length === 0) {
      throw new Error(`No hay preguntas disponibles para test rápido del tema ${tema}`)
    }
    
    // Mezclar las preguntas obtenidas
    const shuffledQuestions = shuffleArray(data)
    const finalQuestions = shuffledQuestions.slice(0, numQuestions)
    
    console.log('✅ Test rápido cargado:', finalQuestions.length, 'preguntas')
    return transformQuestions(finalQuestions)
    
  } catch (error) {
    console.error('❌ Error en fetchQuickQuestions:', error)
    throw error
  }
}

// =================================================================
// 🏛️ FETCHER: TEST OFICIAL
// =================================================================
export async function fetchOfficialQuestions(tema, searchParams, config) {
  try {
    console.log('🏛️ Cargando test oficial para tema:', tema)
    
    const numQuestions = parseInt(searchParams.get('n')) || 20
    
    const { data, error } = await supabase.rpc('get_official_questions_by_oposicion', {
      tema_number: tema,
      total_questions: numQuestions,
      target_oposicion: 'auxiliar_administrativo'
    })
    
    if (error) {
      console.error('❌ Error en test oficial:', error)
      throw error
    }
    
    if (!data || data.length === 0) {
      throw new Error(`No hay preguntas oficiales disponibles para el tema ${tema}`)
    }
    
    console.log('✅ Test oficial cargado:', data.length, 'preguntas oficiales')
    return transformQuestions(data)
    
  } catch (error) {
    console.error('❌ Error en fetchOfficialQuestions:', error)
    throw error
  }
}

// =================================================================
// 🎛️ FETCHER: TEST PERSONALIZADO - MONO-LEY (Tema 7, etc.)
// =================================================================
export async function fetchPersonalizedQuestions(tema, searchParams, config) {
  try {
    console.log('🎛️ Cargando test personalizado MONO-LEY para tema:', tema)
    
    // Obtener usuario actual
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Usuario no autenticado')
    }

    // Leer parámetros de configuración
    const configParams = {
      numQuestions: parseInt(searchParams.get('n')) || 25,
      excludeRecent: searchParams.get('exclude_recent') === 'true',
      recentDays: parseInt(searchParams.get('recent_days')) || 15,
      difficultyMode: searchParams.get('difficulty_mode') || 'random',
      // customDifficulty eliminado
      onlyOfficialQuestions: searchParams.get('only_official') === 'true',
      focusWeakAreas: searchParams.get('focus_weak') === 'true',
      timeLimit: searchParams.get('time_limit') ? parseInt(searchParams.get('time_limit')) : null
    }

    console.log('🎛️ Configuración personalizada MONO-LEY:', configParams)

    // 🔥 PASO 1: Obtener preguntas a excluir
    let excludedQuestionIds = []
    if (configParams.excludeRecent && user) {
      console.log(`🚫 Excluyendo preguntas respondidas en los últimos ${configParams.recentDays} días`)
      
      const cutoffDate = new Date(Date.now() - configParams.recentDays * 24 * 60 * 60 * 1000).toISOString()
      
      const { data: recentAnswers, error: recentError } = await supabase
        .from('test_questions')
        .select('question_id, tests!inner(user_id)')
        .eq('tests.user_id', user.id)
        .gte('created_at', cutoffDate)

      if (!recentError && recentAnswers?.length > 0) {
        excludedQuestionIds = [...new Set(recentAnswers.map(answer => answer.question_id))]
        console.log(`📊 Total de preguntas a excluir: ${excludedQuestionIds.length}`)
      }
    }

    // 🔥 PASO 2: Construir query base para Ley 19/2013 (tema 7)
    let baseQuery = supabase
      .from('questions')
      .select(`
        id, question_text, option_a, option_b, option_c, option_d,
        correct_option, explanation, difficulty, question_type, tags,
        primary_article_id, is_official_exam, exam_source, exam_date,
        exam_entity, official_difficulty_level, is_active, created_at, updated_at,
        articles!inner (
          id, article_number, title, content, section,
          laws!inner (id, name, short_name, year, type, scope, current_version)
        )
      `)
      .eq('is_active', true)
      .eq('articles.laws.short_name', 'Ley 19/2013')

    // 🏛️ Filtro por preguntas oficiales si está activado
    if (configParams.onlyOfficialQuestions) {
      baseQuery = baseQuery.eq('is_official_exam', true)
      console.log('🏛️ Filtro aplicado: Solo preguntas oficiales')
    }

    // 🎯 Aplicar filtro de dificultad
    switch (configParams.difficultyMode) {
      case 'easy':
        baseQuery = baseQuery.eq('difficulty', 'easy')
        break
      case 'medium':
        baseQuery = baseQuery.eq('difficulty', 'medium')
        break
      case 'hard':
        baseQuery = baseQuery.eq('difficulty', 'hard')
        break
      case 'extreme':
        baseQuery = baseQuery.eq('difficulty', 'extreme')
        break
      // 'custom' eliminado
    }

    // 🔥 PASO 3: Obtener todas las preguntas
    const { data: allQuestions, error: questionsError } = await baseQuery
      .order('created_at', { ascending: false })

    if (questionsError) {
      console.error('❌ Error en consulta personalizada:', questionsError)
      throw questionsError
    }

    if (!allQuestions || allQuestions.length === 0) {
      throw new Error('No hay preguntas disponibles con esta configuración.')
    }

    // 🔥 PASO 4: Filtrar preguntas excluidas EN MEMORIA
    let filteredQuestions = allQuestions
    
    if (excludedQuestionIds.length > 0) {
      const excludedSet = new Set(excludedQuestionIds.map(id => String(id)))
      filteredQuestions = allQuestions.filter(question => {
        const questionId = String(question.id)
        return !excludedSet.has(questionId)
      })
      
      console.log(`✅ Después de exclusión: ${filteredQuestions.length} preguntas disponibles`)
    }

    if (filteredQuestions.length === 0) {
      throw new Error('No hay preguntas disponibles después de aplicar exclusiones.')
    }

    // 🎲 Mezclar y seleccionar
    const shuffledQuestions = shuffleArray(filteredQuestions)
    const finalQuestions = shuffledQuestions.slice(0, configParams.numQuestions)

    console.log('✅ Test personalizado MONO-LEY cargado:', finalQuestions.length, 'preguntas')
    return transformQuestions(finalQuestions)

  } catch (error) {
    console.error('❌ Error en fetchPersonalizedQuestions:', error)
    throw error
  }
}

// =================================================================
// 🎯 FETCHER: TEST MULTI-LEY - PARA TEMAS CON MÚLTIPLES LEYES (Tema 6, etc.)
// =================================================================

// =================================================================
export async function fetchQuestionsByTopicScope(tema, searchParams, config) {
  try {
    console.log(`🎯🔥 EJECUTANDO fetchQuestionsByTopicScope para tema ${tema} - TIMESTAMP:`, new Date().toLocaleTimeString())
    
    const numQuestions = parseInt(searchParams.get('n')) || 25
    const onlyOfficialQuestions = searchParams.get('only_official') === 'true'
    const excludeRecent = searchParams.get('exclude_recent') === 'true'
    const recentDays = parseInt(searchParams.get('recent_days')) || 15
    const difficultyMode = searchParams.get('difficulty_mode') || 'random'
    const focusEssentialArticles = searchParams.get('focus_essential') === 'true'
    const adaptiveMode = searchParams.get('adaptive') === 'true' // 🧠 MODO ADAPTATIVO
    const focusWeakAreas = searchParams.get('focus_weak') === 'true' // 🎯 ÁREAS DÉBILES
    const onlyFailedQuestions = searchParams.get('only_failed') === 'true' // 🆕 SOLO PREGUNTAS FALLADAS
    const failedQuestionIds = searchParams.get('failed_question_ids') ? JSON.parse(searchParams.get('failed_question_ids')) : null // 🆕 IDs ESPECÍFICOS
    const failedQuestionsOrder = searchParams.get('failed_questions_order') || null // 🆕 TIPO DE ORDEN
    const timeLimit = searchParams.get('time_limit') ? parseInt(searchParams.get('time_limit')) : null // ⏱️ LÍMITE DE TIEMPO
    
    // 🆕 FILTROS DE LEYES Y ARTÍCULOS DESDE CONFIG
    const selectedLaws = config?.selectedLaws || []
    const selectedArticlesByLaw = config?.selectedArticlesByLaw || {}
    
    console.log('🎛️ Configuración MULTI-LEY:', {
      numQuestions,
      onlyOfficialQuestions,
      excludeRecent,
      recentDays,
      difficultyMode,
      focusEssentialArticles,
      adaptiveMode, // 🧠 NUEVO
      focusWeakAreas, // 🎯 NUEVO
      onlyFailedQuestions, // 🆕 NUEVO
      failedQuestionIds: failedQuestionIds?.length || 0, // 🆕 NUEVO
      failedQuestionsOrder, // 🆕 NUEVO
      timeLimit, // ⏱️ NUEVO
      selectedLaws: selectedLaws.length,
      selectedArticlesByLaw: Object.keys(selectedArticlesByLaw).length
    })

    // 🆕 MANEJO ESPECIAL PARA PREGUNTAS FALLADAS CON IDs ESPECÍFICOS
    if (onlyFailedQuestions && failedQuestionIds && failedQuestionIds.length > 0) {
      console.log(`❌ Modo preguntas falladas específicas: ${failedQuestionIds.length} preguntas, orden: ${failedQuestionsOrder}`)
      
      try {
        // Obtener las preguntas específicas en el orden correcto
        const { data: specificQuestions, error: specificError } = await supabase
          .from('questions')
          .select(`
            id, question_text, option_a, option_b, option_c, option_d,
            correct_option, explanation, difficulty, is_official_exam,
            primary_article_id, exam_source, exam_date, exam_entity,
            articles!inner(
              id, article_number, title, content,
              laws!inner(short_name, name)
            )
          `)
          .eq('is_active', true)
          .in('id', failedQuestionIds)
        
        if (specificError) {
          console.error('❌ Error obteniendo preguntas falladas específicas:', specificError)
          throw specificError
        }
        
        if (!specificQuestions || specificQuestions.length === 0) {
          throw new Error('No se encontraron las preguntas falladas especificadas')
        }
        
        // Ordenar las preguntas según la lista de IDs (mantener el orden elegido por el usuario)
        const orderedQuestions = failedQuestionIds
          .map(id => specificQuestions.find(q => q.id === id))
          .filter(q => q) // Filtrar preguntas no encontradas
        
        // Tomar solo el número solicitado
        const finalQuestions = orderedQuestions.slice(0, numQuestions)
        
        console.log(`✅ Test de preguntas falladas cargado: ${finalQuestions.length} preguntas en orden ${failedQuestionsOrder}`)
        return transformQuestions(finalQuestions)
        
      } catch (error) {
        console.error('❌ Error en modo preguntas falladas específicas:', error)
        throw error
      }
    }
    
    
    // 1. Obtener mapeo del tema desde topic_scope o construcción directa
    let mappings = []
    
    if (tema && tema > 0) {
      // Flujo normal: usar topic_scope para un tema específico
      const { data: topicMappings, error: mappingError } = await supabase
        .from('topic_scope')
        .select(`
          article_numbers,
          laws!inner(short_name, id, name),
          topics!inner(topic_number, position_type)
        `)
        .eq('topics.topic_number', tema)
        .eq('topics.position_type', 'auxiliar_administrativo')
      
      if (mappingError) {
        console.error('❌ Error obteniendo mapeo:', mappingError)
        throw mappingError
      }
      
      if (!topicMappings?.length) {
        throw new Error(`No se encontró mapeo para tema ${tema}`)
      }
      
      mappings = topicMappings
      console.log(`📊 Mapeo tema ${tema}:`, mappings.map(m => `${m.laws.short_name}: ${m.article_numbers.length} arts`))
      
    } else if (selectedLaws.length > 0) {
      // Flujo alternativo: construir mapeo directo desde leyes seleccionadas
      console.log(`🔧 Construyendo mapeo directo para leyes:`, selectedLaws)
      
      for (const lawShortName of selectedLaws) {
        const { data: lawData, error: lawError } = await supabase
          .from('laws')
          .select('id, name, short_name')
          .eq('short_name', lawShortName)
          .single()
        
        if (lawError || !lawData) {
          console.error(`❌ Error obteniendo ley ${lawShortName}:`, lawError)
          continue
        }
        
        // Obtener todos los artículos de esta ley (o los filtrados si se especifican)
        let articleNumbers = []
        if (selectedArticlesByLaw[lawShortName]?.length > 0) {
          articleNumbers = selectedArticlesByLaw[lawShortName]
        } else {
          // Si no hay filtros específicos, obtener todos los artículos de la ley
          const { data: allArticles, error: articlesError } = await supabase
            .from('articles')
            .select('article_number')
            .eq('law_id', lawData.id)
            .order('article_number')
          
          if (!articlesError && allArticles) {
            articleNumbers = allArticles.map(a => a.article_number)
          }
        }
        
        if (articleNumbers.length > 0) {
          mappings.push({
            article_numbers: articleNumbers,
            laws: {
              id: lawData.id,
              name: lawData.name,
              short_name: lawData.short_name
            }
          })
        }
      }
      
      console.log(`📊 Mapeo directo construido:`, mappings.map(m => `${m.laws.short_name}: ${m.article_numbers.length} arts`))
      
    } else {
      throw new Error('No se especificó tema ni leyes para filtrar')
    }
    
    
    // 🆕 FILTRAR MAPEOS POR LEYES SELECCIONADAS
    let filteredMappings = mappings
    if (selectedLaws.length > 0) {
      filteredMappings = mappings.filter(mapping => {
        const lawShortName = mapping.laws.short_name
        return selectedLaws.includes(lawShortName)
      })
      console.log(`🔧 Filtrado por leyes seleccionadas: ${filteredMappings.length}/${mappings.length} leyes`)
    }
    
    // 🆕 APLICAR FILTRO DE ARTÍCULOS POR LEY
    if (Object.keys(selectedArticlesByLaw).length > 0) {
      filteredMappings = filteredMappings.map(mapping => {
        const lawShortName = mapping.laws.short_name
        const selectedArticles = selectedArticlesByLaw[lawShortName]
        
        if (selectedArticles && selectedArticles.length > 0) {
          // Filtrar solo los artículos seleccionados
          // 🔧 FIX: Convertir selectedArticles a strings para comparar con article_numbers (que son strings)
          const selectedArticlesAsStrings = selectedArticles.map(num => String(num))
          const filteredArticleNumbers = mapping.article_numbers.filter(articleNum => {
            return selectedArticlesAsStrings.includes(articleNum)
          })
          console.log(`🔧 Ley ${mapping.laws.short_name}: ${filteredArticleNumbers.length}/${mapping.article_numbers.length} artículos seleccionados`)
          
          return {
            ...mapping,
            article_numbers: filteredArticleNumbers
          }
        }
        
        return mapping
      }).filter(mapping => mapping.article_numbers.length > 0) // Eliminar mapeos sin artículos
    }
    
    if (filteredMappings.length === 0) {
      throw new Error('No hay leyes o artículos seleccionados para generar el test')
    }
    
    // 2. Obtener usuario actual para exclusiones
    let excludedQuestionIds = []
    if (excludeRecent) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          console.log(`🚫 Excluyendo preguntas respondidas en los últimos ${recentDays} días`)
          
          const cutoffDate = new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000).toISOString()
          
          const { data: recentAnswers, error: recentError } = await supabase
            .from('test_questions')
            .select('question_id, tests!inner(user_id)')
            .eq('tests.user_id', user.id)
            .gte('created_at', cutoffDate)

          if (!recentError && recentAnswers?.length > 0) {
            excludedQuestionIds = [...new Set(recentAnswers.map(answer => answer.question_id))]
            console.log(`📊 Total de preguntas a excluir: ${excludedQuestionIds.length}`)
          }
        }
      } catch (userError) {
        console.log('⚠️ No se pudo obtener usuario para exclusiones:', userError.message)
      }
    }
    
    // 3. ENFOQUE MEJORADO: Hacer múltiples consultas separadas con todos los filtros
    const allQuestions = []
    
    for (const mapping of filteredMappings) {
      console.log(`🔍 Consultando ${mapping.laws.short_name}: ${mapping.article_numbers.length} artículos`)
      
      // Construir consulta base
      let baseQuery = supabase
        .from('questions')
        .select(`
          id, question_text, option_a, option_b, option_c, option_d,
          correct_option, explanation, difficulty, question_type, tags,
          primary_article_id, is_official_exam, exam_source, exam_date,
          exam_entity, official_difficulty_level, is_active, created_at, updated_at,
          articles!inner (
            id, article_number, title, content, section,
            laws!inner (id, name, short_name, year, type, scope, current_version)
          )
        `)
        .eq('is_active', true)
        .eq('articles.laws.short_name', mapping.laws.short_name)
        .in('articles.article_number', mapping.article_numbers)
      
      // 🏛️ FILTRO CORREGIDO: Solo preguntas oficiales si está activado
      if (onlyOfficialQuestions) {
        baseQuery = baseQuery.eq('is_official_exam', true)
        console.log(`🏛️ ${mapping.laws.short_name}: Filtro aplicado - Solo preguntas oficiales`)
      }
      
      // 🎯 Aplicar filtro de dificultad
      switch (difficultyMode) {
        case 'easy':
          baseQuery = baseQuery.eq('difficulty', 'easy')
          console.log(`🎯 ${mapping.laws.short_name}: Aplicando filtro dificultad = 'easy'`)
          break
        case 'medium':
          baseQuery = baseQuery.eq('difficulty', 'medium')
          console.log(`🎯 ${mapping.laws.short_name}: Aplicando filtro dificultad = 'medium'`)
          break
        case 'hard':
          baseQuery = baseQuery.eq('difficulty', 'hard')
          console.log(`🎯 ${mapping.laws.short_name}: Aplicando filtro dificultad = 'hard'`)
          break
        case 'extreme':
          baseQuery = baseQuery.eq('difficulty', 'extreme')
          console.log(`🎯 ${mapping.laws.short_name}: Aplicando filtro dificultad = 'extreme'`)
          break
        default:
          console.log(`🎲 ${mapping.laws.short_name}: Sin filtro de dificultad (modo: ${difficultyMode})`)
          break
      }
      
      // Ejecutar consulta
      const { data: lawQuestions, error: lawError } = await baseQuery
        .order('created_at', { ascending: false })
      
      if (lawError) {
        console.error(`❌ Error consultando ${mapping.laws.short_name}:`, lawError)
        continue // Continuar con la siguiente ley en lugar de fallar todo
      }
      
      
      if (lawQuestions && lawQuestions.length > 0) {
        console.log(`✅ ${mapping.laws.short_name}: ${lawQuestions.length} preguntas encontradas`)
        allQuestions.push(...lawQuestions)
      } else {
        console.log(`⚠️ ${mapping.laws.short_name}: Sin preguntas disponibles con filtros aplicados`)
      }
    }
    
    if (allQuestions.length === 0) {
      const filterInfo = []
      if (onlyOfficialQuestions) filterInfo.push('solo oficiales')
      if (difficultyMode !== 'random') filterInfo.push(`dificultad: ${difficultyMode}`)
      if (excludeRecent) filterInfo.push(`excluyendo recientes`)
      if (focusEssentialArticles) filterInfo.push('artículos imprescindibles')
      
      const filtersApplied = filterInfo.length > 0 ? ` (filtros: ${filterInfo.join(', ')})` : ''
      throw new Error(`No hay preguntas disponibles para tema ${tema}${filtersApplied}`)
    }
    
    console.log(`📋 Total preguntas encontradas: ${allQuestions.length}`)
    
    // 4. Aplicar filtro de exclusión de preguntas recientes EN MEMORIA
    let filteredQuestions = allQuestions
    
    if (excludedQuestionIds.length > 0) {
      const excludedSet = new Set(excludedQuestionIds.map(id => String(id)))
      filteredQuestions = allQuestions.filter(question => {
        const questionId = String(question.id)
        return !excludedSet.has(questionId)
      })
      
      console.log(`✅ Después de exclusión: ${filteredQuestions.length} preguntas disponibles`)
      
      if (filteredQuestions.length === 0) {
        throw new Error('No hay preguntas disponibles después de aplicar exclusiones.')
      }
    }

    
    // 5. Aplicar filtro de artículos imprescindibles si está activado
    let prioritizedQuestions = filteredQuestions
    
    if (focusEssentialArticles) {
      console.log('⭐ Aplicando filtro de artículos imprescindibles...')
      
      // CORRECCIÓN: Identificar artículos imprescindibles consultando TODA la base de datos
      const articleOfficialCount = {}
      
      // Obtener todos los artículos que tienen preguntas oficiales para este tema
      for (const mapping of mappings) {
        for (const articleNumber of mapping.article_numbers) {
          const { count } = await supabase
            .from('questions')
            .select('id, articles!inner(laws!inner(short_name))', { count: 'exact', head: true })
            .eq('is_active', true)
            .eq('is_official_exam', true)
            .eq('articles.laws.short_name', mapping.laws.short_name)
            .eq('articles.article_number', articleNumber)
          
          if (count > 0) {
            const articleKey = `${mapping.laws.short_name}-${articleNumber}`
            articleOfficialCount[articleKey] = count
          }
        }
      }
      
      console.log('📊 Artículos con preguntas oficiales (CORREGIDO):', articleOfficialCount)
      
      // Separar preguntas por si son de artículos imprescindibles o no
      const essentialQuestions = []
      const nonEssentialQuestions = []
      
      filteredQuestions.forEach(question => {
        if (question.articles?.article_number) {
          const articleKey = `${question.articles.laws.short_name}-${question.articles.article_number}`
          if (articleOfficialCount[articleKey] >= 1) {
            essentialQuestions.push(question)
          } else {
            nonEssentialQuestions.push(question)
          }
        } else {
          nonEssentialQuestions.push(question)
        }
      })
      
      console.log(`⭐ Artículos imprescindibles: ${essentialQuestions.length} preguntas`)
      console.log(`📝 Artículos normales: ${nonEssentialQuestions.length} preguntas`)
      
      // 🔍 DEBUG: Verificar dificultades de preguntas imprescindibles
      const difficultyStats = {}
      essentialQuestions.forEach(q => {
        const difficulty = q.difficulty || 'unknown'
        difficultyStats[difficulty] = (difficultyStats[difficulty] || 0) + 1
      })
      console.log('📊 Distribución de dificultades en artículos imprescindibles:', difficultyStats)
      
      if (difficultyMode !== 'random') {
        const filteredByDifficulty = essentialQuestions.filter(q => q.difficulty === difficultyMode)
        console.log(`🎯 Preguntas imprescindibles con dificultad "${difficultyMode}": ${filteredByDifficulty.length}`)
      }
      
      // 🔥 FILTRO EXCLUSIVO: Solo artículos imprescindibles (100%)
      console.log('⭐ MODO EXCLUSIVO: Solo preguntas de artículos imprescindibles')
      
      if (essentialQuestions.length === 0) {
        throw new Error(`No hay preguntas de artículos imprescindibles para tema ${tema}. Los artículos imprescindibles son aquellos que tienen preguntas oficiales.`)
      }
      
      // ✅ USAR TODAS las preguntas de artículos imprescindibles para priorización inteligente
      // NO hacer selección aleatoria aquí - dejar que la priorización inteligente decida
      prioritizedQuestions = essentialQuestions
      
      console.log(`⭐ Filtro exclusivo aplicado: ${prioritizedQuestions.length} preguntas SOLO de artículos imprescindibles`)
      console.log('📊 Artículos imprescindibles disponibles:', Object.keys(articleOfficialCount))
      
      // Debug: Mostrar qué artículos van a aparecer en el test
      const testArticles = new Set()
      prioritizedQuestions.forEach(q => {
        if (q.articles?.article_number) {
          const articleKey = `Art. ${q.articles.article_number} ${q.articles.laws.short_name}`
          testArticles.add(articleKey)
        }
      })
      
      console.log('🎯 ARTÍCULOS QUE APARECERÁN EN EL TEST:', Array.from(testArticles).sort())
    }
    
    // 🧠 CALCULAR TAMAÑO DEL POOL SEGÚN MODO ADAPTATIVO
    const poolSize = adaptiveMode ? Math.max(numQuestions * 2, 50) : numQuestions
    console.log(`🧠 Tamaño del pool: ${poolSize} preguntas (adaptativo: ${adaptiveMode})`)
    
    // 🧠 PRIORIZACIÓN INTELIGENTE (como en test aleatorio)
    let questionsToProcess = focusEssentialArticles ? prioritizedQuestions : filteredQuestions
    let finalQuestions = []
    
    // Obtener usuario actual para priorización
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      // Aplicando priorización inteligente para test individual
      
      // 1. Obtener historial de respuestas del usuario SOLO a preguntas que siguen activas
      
      // NUEVA ESTRATEGIA: Filtrar directamente en la consulta con JOIN
      const { data: userAnswers, error: answersError } = await supabase
        .from('test_questions')
        .select(`
          question_id, 
          created_at, 
          tests!inner(user_id),
          questions!inner(is_active)
        `)
        .eq('tests.user_id', user.id)
        .eq('questions.is_active', true)
        .order('created_at', { ascending: false })
        .limit(2000) // Mayor límite para respuestas del usuario
      
      
      if (!answersError && userAnswers && userAnswers.length > 0) {
        // 2. Clasificar preguntas por prioridad
        const answeredQuestionIds = new Set()
        const questionLastAnswered = new Map()
        
        userAnswers.forEach(answer => {
          answeredQuestionIds.add(answer.question_id)
          const answerDate = new Date(answer.created_at)
          
          // Guardar la fecha más reciente para cada pregunta
          if (!questionLastAnswered.has(answer.question_id) || 
              answerDate > questionLastAnswered.get(answer.question_id)) {
            questionLastAnswered.set(answer.question_id, answerDate)
          }
        })
        
        // 3. Separar preguntas por prioridad
        const neverSeenQuestions = []
        const answeredQuestions = []
        
        questionsToProcess.forEach(question => {
          if (answeredQuestionIds.has(question.id)) {
            // Pregunta ya respondida - agregar fecha para ordenamiento
            question._lastAnswered = questionLastAnswered.get(question.id)
            answeredQuestions.push(question)
          } else {
            // Pregunta nunca vista - máxima prioridad
            neverSeenQuestions.push(question)
          }
        })
        
        
        // 4. Ordenar preguntas respondidas por fecha (más antiguas primero)
        answeredQuestions.sort((a, b) => a._lastAnswered - b._lastAnswered)
        
        console.log(`🎯 DECISIÓN DE PRIORIZACIÓN TEMA ${tema}:`)
        console.log(`- Nunca vistas: ${neverSeenQuestions.length}`)
        console.log(`- Ya respondidas: ${answeredQuestions.length}`)
        console.log(`- Pool solicitado: ${poolSize} (activas: ${numQuestions})`)

        // 5. Calcular distribución inteligente PARA EL POOL COMPLETO
        if (neverSeenQuestions.length >= poolSize) {
          // ✅ 1º PRIORIDAD: Si hay suficientes preguntas nunca vistas, usar solo esas
          console.log('🎯 CASO 1: Suficientes preguntas nunca vistas - usando solo nunca vistas')
          
          finalQuestions = neverSeenQuestions
            .sort(() => Math.random() - 0.5) // Mezclar aleatoriamente
            .slice(0, poolSize)
            
          console.log(`✅ Seleccionadas ${finalQuestions.length} preguntas nunca vistas (de ${neverSeenQuestions.length} disponibles)`)
        } else {
          // ✅ DISTRIBUCIÓN INTELIGENTE: Mezclar nunca vistas + repaso espaciado
          const neverSeenCount = neverSeenQuestions.length
          const reviewCount = poolSize - neverSeenCount
          
          console.log('🎯 CASO 2: Distribución mixta - combinando nunca vistas + repaso espaciado')
          console.log(`📊 Distribución: ${neverSeenCount} nunca vistas + ${reviewCount} para repaso`)
          
          // Todas las nunca vistas (mezcladas)
          const shuffledNeverSeen = neverSeenQuestions.sort(() => Math.random() - 0.5)
          
          // ✅ 2º PRIORIDAD: Las más antiguas para repaso espaciado (ya ordenadas)
          const oldestForReview = answeredQuestions.slice(0, reviewCount)
          
          finalQuestions = [...shuffledNeverSeen, ...oldestForReview]
        }
        
        // 6. Mezclar orden final para que no sea predecible
        finalQuestions = finalQuestions.sort(() => Math.random() - 0.5)
        
        // Limpiar propiedades temporales
        finalQuestions.forEach(q => {
          delete q._lastAnswered
        })
        
      } else {
        // Fallback si no hay historial o error
        console.log('📊 Sin historial de usuario, usando selección aleatoria')
        finalQuestions = shuffleArray(questionsToProcess).slice(0, poolSize)
      }
    } else {
      // Fallback si no hay usuario
      console.log('📊 Usuario no autenticado, usando selección aleatoria')  
      finalQuestions = shuffleArray(questionsToProcess).slice(0, poolSize)
    }
    
    // 6. Log de resumen
    const lawDistribution = finalQuestions.reduce((acc, q) => {
      const law = q.articles?.laws?.short_name || 'N/A'
      acc[law] = (acc[law] || 0) + 1
      return acc
    }, {})
    
    const officialCount = finalQuestions.filter(q => q.is_official_exam).length
    
    console.log(`\n✅ Tema ${tema} MULTI-LEY cargado: ${finalQuestions.length} preguntas de ${mappings.length} leyes`)
    console.log(`📊 Distribución por ley:`, lawDistribution)
    console.log(`🏛️ Preguntas oficiales: ${officialCount}/${finalQuestions.length}`)
    if (focusEssentialArticles) {
      console.log(`⭐ Filtro aplicado: SOLO artículos imprescindibles`)
    }
    
    // 🔍 DEBUG: Verificar dificultades de preguntas finales
    const finalDifficultyStats = {}
    finalQuestions.forEach(q => {
      const difficulty = q.difficulty || 'unknown'
      finalDifficultyStats[difficulty] = (finalDifficultyStats[difficulty] || 0) + 1
    })
    console.log(`🎯 Dificultades en test final:`, finalDifficultyStats)
    
    if (difficultyMode !== 'random') {
      const expectedDifficulty = difficultyMode
      const matchingCount = finalQuestions.filter(q => q.difficulty === expectedDifficulty).length
      console.log(`✅ Filtro de dificultad "${expectedDifficulty}": ${matchingCount}/${finalQuestions.length} preguntas coinciden`)
      
      if (matchingCount === 0) {
        console.log(`⚠️ ADVERTENCIA: No hay preguntas de dificultad "${expectedDifficulty}" en el test final`)
      } else if (matchingCount < finalQuestions.length) {
        console.log(`⚠️ ADVERTENCIA: Solo ${matchingCount} de ${finalQuestions.length} preguntas son de dificultad "${expectedDifficulty}"`)
      }
    }
    
    // 🔍 DEBUG MEJORADO: Análisis detallado de artículos en el test
    if (focusEssentialArticles) {
      console.log('\n🔍 ===== ANÁLISIS DETALLADO DE ARTÍCULOS IMPRESCINDIBLES =====')
      
      // Re-obtener articleOfficialCount para el debug (ya se calculó antes)
      const debugArticleOfficialCount = {}
      for (const mapping of mappings) {
        for (const articleNumber of mapping.article_numbers) {
          const { count } = await supabase
            .from('questions')
            .select('id, articles!inner(laws!inner(short_name))', { count: 'exact', head: true })
            .eq('is_active', true)
            .eq('is_official_exam', true)
            .eq('articles.laws.short_name', mapping.laws.short_name)
            .eq('articles.article_number', articleNumber)
          
          if (count > 0) {
            const articleKey = `${mapping.laws.short_name}-${articleNumber}`
            debugArticleOfficialCount[articleKey] = count
          }
        }
      }
      
      // Mostrar todos los artículos imprescindibles identificados
      const allEssentialArticles = Object.keys(debugArticleOfficialCount || {}).map(key => {
        const [law, article] = key.split('-')
        return `Art. ${article} ${law} (${debugArticleOfficialCount[key]} oficiales)`
      })
      
      console.log('⭐ ARTÍCULOS IMPRESCINDIBLES IDENTIFICADOS:')
      allEssentialArticles.forEach(article => console.log(`   • ${article}`))
      
      // Analizar artículos que realmente aparecen en el test
      const testArticleStats = {}
      finalQuestions.forEach(q => {
        if (q.articles?.article_number) {
          const articleDisplay = `Art. ${q.articles.article_number} ${q.articles.laws.short_name}`
          const articleKey = `${q.articles.laws.short_name}-${q.articles.article_number}`
          const isEssential = (debugArticleOfficialCount || {})[articleKey] >= 1
          
          if (!testArticleStats[articleDisplay]) {
            testArticleStats[articleDisplay] = {
              count: 0,
              isEssential: isEssential,
              officialCount: (debugArticleOfficialCount || {})[articleKey] || 0
            }
          }
          testArticleStats[articleDisplay].count++
        }
      })
      
      console.log('\n🎯 ARTÍCULOS QUE APARECEN EN ESTE TEST:')
      Object.entries(testArticleStats)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([article, stats]) => {
          const marker = stats.isEssential ? '⭐' : '📄'
          const essentialInfo = stats.isEssential ? ` (${stats.officialCount} oficiales)` : ' (NO imprescindible)'
          console.log(`   ${marker} ${article}: ${stats.count} preguntas${essentialInfo}`)
        })
      
      const essentialInTest = Object.values(testArticleStats).filter(s => s.isEssential).length
      const totalInTest = Object.keys(testArticleStats).length
      
      console.log(`\n📊 RESUMEN: ${essentialInTest}/${totalInTest} artículos del test son imprescindibles`)
      console.log('================================================================\n')
    }
    
    // 🧠 MODO ADAPTATIVO: Usar el pool ya priorizado
    if (adaptiveMode) {
      console.log('🧠 Modo adaptativo activado para multi-ley:', finalQuestions.length, 'preguntas en pool PRIORIZADO,', numQuestions, 'activas')
      
      const activeQuestions = finalQuestions.slice(0, numQuestions)
      
      console.log(`🧠 Pool adaptativo PRIORIZADO: ${activeQuestions.length} activas / ${finalQuestions.length} en pool`)
      
      return {
        activeQuestions: transformQuestions(activeQuestions),
        questionPool: transformQuestions(finalQuestions),
        poolSize: finalQuestions.length,
        requestedCount: numQuestions,
        isAdaptive: true
      }
    }
    
    // En modo NO adaptativo, devolver solo las preguntas activas
    return transformQuestions(finalQuestions.slice(0, numQuestions))
    
  } catch (error) {
    console.error(`❌ Error en fetchQuestionsByTopicScope tema ${tema}:`, error)
    throw error
  }
}

// =================================================================
// 🔧 FUNCIÓN AUXILIAR: Contar preguntas por tema multi-ley
// =================================================================
export async function countQuestionsByTopicScope(tema) {
  try {
    // 1. Obtener mapeo del tema
    const { data: mappings } = await supabase
      .from('topic_scope')
      .select(`
        article_numbers,
        laws!inner(short_name),
        topics!inner(topic_number, position_type)
      `)
      .eq('topics.topic_number', tema)
      .eq('topics.position_type', 'auxiliar_administrativo')
    
    if (!mappings?.length) {
      return 0
    }
    
    // 2. ENFOQUE ALTERNATIVO: Contar con múltiples consultas separadas
    let totalCount = 0
    
    for (const mapping of mappings) {
      const { count, error } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('articles.laws.short_name', mapping.laws.short_name)
        .in('articles.article_number', mapping.article_numbers)
      
      if (!error && count) {
        totalCount += count
        console.log(`📊 ${mapping.laws.short_name}: ${count} preguntas`)
      }
    }
    
    console.log(`📊 Tema ${tema} tiene ${totalCount} preguntas disponibles (total)`)
    return totalCount
    
  } catch (error) {
    console.error('Error en countQuestionsByTopicScope:', error)
    return 0
  }
}

// =================================================================
// 🎯 FETCHER PRINCIPAL: TEST DE ARTÍCULOS DIRIGIDO POR LEY ESPECÍFICA - CORREGIDO
// =================================================================
export async function fetchArticulosDirigido(lawName, searchParams, config) {
  console.log('🎯 INICIO fetchArticulosDirigido:', { lawName, timestamp: new Date().toISOString() })
  
  try {
    // ✅ MANEJAR searchParams como objeto plano o URLSearchParams
    const getParam = (key, defaultValue = null) => {
      if (!searchParams) return defaultValue
      
      // Si es URLSearchParams (desde hook)
      if (typeof searchParams.get === 'function') {
        return searchParams.get(key) || defaultValue
      }
      
      // Si es objeto plano (desde server component)
      return searchParams[key] || defaultValue
    }
    
    const articles = getParam('articles')
    const mode = getParam('mode', 'intensive')
    const requestedCount = parseInt(getParam('n', '10'))
    
    console.log('📋 Parámetros extraídos:', { 
      lawName, 
      articles, 
      mode, 
      requestedCount,
      searchParamsType: typeof searchParams?.get === 'function' ? 'URLSearchParams' : 'object'
    })

    // 🔄 ESTRATEGIA 1: Test dirigido por artículos específicos
    if (articles && articles.trim()) {
      console.log('🎯 Intentando test dirigido por artículos específicos...')
      
      const articleNumbers = articles.split(',').map(a => a.trim()).filter(Boolean)
      console.log('🔢 Tipos de articleNumbers:', articleNumbers.map(a => typeof a + ':' + a))
      
      // 🎯 SISTEMA UNIVERSAL: Intentar múltiples estrategias de mapeo
      let lawShortName = mapLawSlugToShortName(lawName)
      console.log('🔍 PASO 1 - Mapeo inicial:', lawName, '→', lawShortName)
      
      // 🚀 ESTRATEGIA UNIVERSAL: Probar múltiples variantes hasta encontrar preguntas
      const possibleNames = [
        lawShortName,  // Mapeo normal
        lawName,       // Slug original
        lawName.toUpperCase(), // MAYÚSCULAS
        lawName.replace(/-/g, ' '), // Reemplazar guiones por espacios
        lawName.replace(/^ley-/, 'Ley ').replace(/-(\d+)-(\d+)$/, ' $1/$2'), // ley-39-2015 → Ley 39/2015
        lawName.replace(/^constitucion-espanola$/, 'CE'), // Caso específico CE
        lawName.replace(/^ce$/, 'CE'), // ce → CE
      ].filter(Boolean).filter((name, index, arr) => arr.indexOf(name) === index) // Remover duplicados
      
      console.log('🔍 PASO 2 - Variantes a probar:', possibleNames)
      
      console.log('📚 Buscando artículos:')
      console.log('   articleNumbers:', articleNumbers)
      
      // 🚀 SISTEMA UNIVERSAL: Probar cada variante hasta encontrar resultados
      let specificQuestions = null
      let specificError = null
      let successfulLawName = null
      
      for (const testLawName of possibleNames) {
        console.log(`🔍 PROBANDO variante: "${testLawName}"`)
        
        try {
          const { data: questions, error } = await supabase
            .from('questions')
            .select(`
              id, question_text, option_a, option_b, option_c, option_d,
              correct_option, explanation, difficulty, is_official_exam,
              primary_article_id, exam_source, exam_date, exam_entity,
              articles!inner(
                id, article_number, title, content,
                laws!inner(short_name, name)
              )
            `)
            .eq('articles.laws.short_name', testLawName)
            .in('articles.article_number', articleNumbers)
            .eq('is_active', true)
            .limit(requestedCount * 2)
          
          if (!error && questions && questions.length > 0) {
            console.log(`✅ ÉXITO con variante: "${testLawName}" - ${questions.length} preguntas encontradas`)
            specificQuestions = questions
            specificError = error
            successfulLawName = testLawName
            break
          } else {
            console.log(`❌ Sin resultados para: "${testLawName}" (${questions?.length || 0} preguntas)`)
          }
        } catch (err) {
          console.log(`❌ Error probando "${testLawName}":`, err.message)
        }
      }
      
      try {
        
        console.log('🔍 Resultado de consulta específica:', {
          error: specificError,
          questionsFound: specificQuestions?.length || 0,
          firstQuestion: specificQuestions?.[0]?.question_text?.substring(0, 50) + '...' || 'N/A',
          queryParams: { lawShortName, articleNumbers },
          actualError: specificError
        })
        
        if (specificError) {
          console.error('❌ Error en consulta específica:', specificError)
        }
        
        if (!specificError && specificQuestions && specificQuestions.length > 0) {
          // 🧪 Log detallado de qué artículos encontró
          const foundArticles = [...new Set(specificQuestions.map(q => q.articles.article_number))].sort((a, b) => a - b)
          console.log('📋 Artículos encontrados en preguntas:', foundArticles)
          console.log('🎯 Preguntas por artículo:', 
            foundArticles.map(art => `Art.${art}: ${specificQuestions.filter(q => q.articles.article_number === art).length} preguntas`).join(', ')
          )
          
          const shuffled = shuffleArray(specificQuestions).slice(0, requestedCount)
          console.log(`✅ ${shuffled.length} preguntas específicas encontradas para test dirigido`)
          return transformQuestions(shuffled)
        } else {
          console.log('❌ No se encontraron preguntas específicas, activando fallback...')
          console.log('   Razón: specificError =', !!specificError, ', questionsLength =', specificQuestions?.length || 0)
        }
      } catch (specificErr) {
        console.log('⚠️ Error en búsqueda específica:', specificErr.message)
      }
    }

    // 🔄 ESTRATEGIA 2: Test por ley completa
    console.log('📚 Fallback: Cargando preguntas por ley completa...')
    
    // 🚀 SISTEMA UNIVERSAL FALLBACK: Probar múltiples variantes
    let lawShortName = mapLawSlugToShortName(lawName)
    const possibleNames = [
      lawShortName,
      lawName,
      lawName.toUpperCase(),
      lawName.replace(/-/g, ' '),
      lawName.replace(/^ley-/, 'Ley ').replace(/-(\d+)-(\d+)$/, ' $1/$2'),
      lawName.replace(/^constitucion-espanola$/, 'CE'),
      lawName.replace(/^ce$/, 'CE'),
    ].filter(Boolean).filter((name, index, arr) => arr.indexOf(name) === index)
    
    console.log('🔍 FALLBACK - Variantes a probar:', possibleNames)
    
    let lawQuestions = null
    let lawError = null
    let successfulFallbackLaw = null
    
    for (const testLawName of possibleNames) {
      console.log(`🔍 FALLBACK - Probando: "${testLawName}"`)
      
      try {
        const { data: questions, error } = await supabase
          .from('questions')
          .select(`
            id, question_text, option_a, option_b, option_c, option_d,
            correct_option, explanation, difficulty, is_official_exam,
            primary_article_id, exam_source, exam_date, exam_entity,
            articles!inner(
              id, article_number, title, content,
              laws!inner(short_name, name)
            )
          `)
          .eq('articles.laws.short_name', testLawName)
          .eq('is_active', true)
          .limit(requestedCount * 2)
        
        if (!error && questions && questions.length > 0) {
          console.log(`✅ FALLBACK ÉXITO con: "${testLawName}" - ${questions.length} preguntas`)
          lawQuestions = questions
          lawError = error
          successfulFallbackLaw = testLawName
          break
        } else {
          console.log(`❌ FALLBACK sin resultados para: "${testLawName}"`)
        }
      } catch (err) {
        console.log(`❌ FALLBACK error con "${testLawName}":`, err.message)
      }
    }
    
    try {
      if (!lawError && lawQuestions && lawQuestions.length > 0) {
        const shuffled = shuffleArray(lawQuestions).slice(0, requestedCount)
        console.log(`✅ ${shuffled.length} preguntas por ley encontradas con: ${successfulFallbackLaw}`)
        return transformQuestions(shuffled)
      }
    } catch (lawErr) {
      console.log('⚠️ Error en búsqueda por ley:', lawErr.message)
    }

    // 🔄 ESTRATEGIA 3: Fallback final - test rápido
    console.log('🎲 Fallback final: Test rápido general...')
    
    const { data: randomQuestions, error: randomError } = await supabase
      .from('questions')
      .select(`
        id, question_text, option_a, option_b, option_c, option_d,
        correct_option, explanation, difficulty, is_official_exam,
        primary_article_id, exam_source, exam_date, exam_entity,
        articles(
          id, article_number, title, content,
          laws(short_name, name)
        )
      `)
      .eq('is_active', true)
      .limit(requestedCount)
    
    if (randomError) throw randomError
    
    if (randomQuestions && randomQuestions.length > 0) {
      console.log(`✅ ${randomQuestions.length} preguntas aleatorias como último recurso`)
      return transformQuestions(shuffleArray(randomQuestions))
    }

    throw new Error('No se encontraron preguntas')

  } catch (error) {
    console.error('❌ Error en fetchArticulosDirigido:', error)
    throw new Error(`Error cargando test dirigido: ${error.message}`)
  }
}

// 🔧 FUNCIÓN AUXILIAR: Mapear slug de URL a short_name de BD
function mapLawSlugToShortName(lawSlug) {
  const mapping = {
    'ley-19-2013': 'Ley 19/2013',
    'ley-40-2015': 'LRJSP',
    'LRJSP': 'LRJSP',
    'ley-39-2015': 'LPAC',
    'LPAC': 'LPAC',
    'ley-50-1997': 'Ley 50/1997',
    'ley-7-1985': 'Ley 7/1985',
    'ley-2-2014': 'Ley 2/2014',
    'ley-25-2014': 'Ley 25/2014',
    'ley-38-2015': 'Ley 38/2015',
    'ce': 'CE',
    'CE': 'CE', // Mapeo directo para mayúsculas
    'constitucion-espanola': 'CE', // Sin tildes
    'constitución-española': 'CE', // Con tildes
    'tue': 'TUE',
    'tfue': 'TFUE'
  }
  
  // Buscar en mapping
  if (mapping[lawSlug]) {
    return mapping[lawSlug]
  }
  
  // 🚀 FALLBACK INTELIGENTE: Generar automáticamente para leyes nuevas
  if (!mapping[lawSlug]) {
    console.warn(`⚠️ Ley no encontrada en mapeo: ${lawSlug}, generando automáticamente...`)
    
    // Patrón específico para leyes numeradas (ley-XX-YYYY)
    if (lawSlug.match(/^ley-(\d+)-(\d+)$/)) {
      const [, number, year] = lawSlug.match(/^ley-(\d+)-(\d+)$/)
      const generated = `Ley ${number}/${year}`
      console.log(`🔧 Generado automáticamente: ${lawSlug} → ${generated}`)
      return generated
    }
    
    // Patrón para constitución
    if (lawSlug.match(/constitucion/i)) {
      console.log(`🔧 Generado automáticamente: ${lawSlug} → CE`)
      return 'CE'
    }
    
    // Otros patrones automáticos
    const autoGenerated = lawSlug
      .replace(/-/g, ' ')  // guiones → espacios
      .replace(/^([a-z])/, (match, p1) => p1.toUpperCase()) // Primera letra mayúscula
    
    console.log(`🔧 Generado automáticamente: ${lawSlug} → ${autoGenerated}`)
    return autoGenerated
  }
  
  // Si no está en mapping, intentar extraer de formato "Ley X/YYYY"
  if (lawSlug.includes('ley-') && lawSlug.includes('-')) {
    const parts = lawSlug.split('-')
    if (parts.length >= 3) {
      const number = parts[1]
      const year = parts[2]
      return `Ley ${number}/${year}`
    }
  }
  
  // Fallback: devolver tal como viene
  console.warn('⚠️ No se pudo mapear la ley:', lawSlug)
  return lawSlug
}


// =================================================================
// 🚀 FETCHER: MANTENER RACHA - 
// Prioriza temas con mejor rendimiento (≥50% aciertos), Distribuye preguntas entre 3 temas máximo para variedad, Solo preguntas fáciles para mantener motivación, mezcla aleatoria,
// =================================================================

// =================================================================
// 🚀 FETCHER: MANTENER RACHA - VERSIÓN UNIVERSAL INTELIGENTE
// =================================================================
export async function fetchMantenerRacha(tema, searchParams, config) {
  try {
    console.log('🚀 Cargando test inteligente para mantener racha')
    
    const n = parseInt(searchParams.get('n')) || 5
    const streakDays = parseInt(searchParams.get('streak_days')) || 0
    
    // 🧠 PASO 1: Obtener usuario actual
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.log('⚠️ Usuario no autenticado, usando fallback universal')
      return await fetchMantenerRachaFallback(n, null)
    }

    // 🎯 PASO 2: Detectar temas que el usuario ha estudiado
    const { data: temasEstudiados, error: temasError } = await supabase
      .from('tests')
      .select('tema_number, COUNT(*) as tests_count, AVG(score) as avg_score')
      .eq('user_id', user.id)
      .not('tema_number', 'is', null)
      .eq('is_completed', true)
      .group('tema_number')
      .having('COUNT(*)', 'gte', 1) // Al menos 1 test completado
      .order('tests_count', { ascending: false })

    if (temasError) {
      console.error('❌ Error obteniendo temas estudiados:', temasError)
      return await fetchMantenerRachaFallback(n, user)
    }

    if (!temasEstudiados || temasEstudiados.length === 0) {
      console.log('📚 Usuario sin temas estudiados, usando fallback universal')
      return await fetchMantenerRachaFallback(n, user)
    }

    console.log('🎯 Temas estudiados detectados:', temasEstudiados.map(t => `Tema ${t.tema_number} (${t.tests_count} tests, ${Math.round(t.avg_score)}%)`))

    // 🔥 PASO 3: Estrategia inteligente de selección
    // Priorizar temas con mejor rendimiento para mantener motivación
    const temasParaRacha = temasEstudiados
      .filter(t => t.avg_score >= 50) // Solo temas con rendimiento decente
      .slice(0, 3) // Máximo 3 temas para mantener enfoque
      .map(t => t.tema_number)

    if (temasParaRacha.length === 0) {
      // Si no hay temas con buen rendimiento, usar todos los estudiados
      temasParaRacha.push(...temasEstudiados.map(t => t.tema_number))
    }

    console.log('🎯 Temas seleccionados para racha:', temasParaRacha)

    // 🚀 PASO 4: Obtener preguntas de temas estudiados con distribución inteligente
    const questionsPerTema = Math.ceil(n * 1.5 / temasParaRacha.length) // 1.5x para mezclar mejor
    const allQuestions = []

    for (const temaNummer of temasParaRacha) {
      console.log(`🔍 Obteniendo preguntas del tema ${temaNummer}...`)
      
      // Intentar con función específica para el tema
      const { data: temaQuestions, error: temaError } = await supabase.rpc('get_questions_by_tema_and_difficulty', {
        tema_number: temaNummer,
        total_questions: questionsPerTema,
        difficulty_filter: 'easy' // Preguntas fáciles para mantener motivación
      })

      if (!temaError && temaQuestions && temaQuestions.length > 0) {
        console.log(`✅ Tema ${temaNummer}: ${temaQuestions.length} preguntas obtenidas`)
        allQuestions.push(...temaQuestions)
      } else {
        console.log(`⚠️ Tema ${temaNummer}: Sin preguntas disponibles`)
      }
    }

    // 🎲 PASO 5: Mezclar y seleccionar cantidad final
    if (allQuestions.length === 0) {
      console.log('❌ No se obtuvieron preguntas de temas estudiados, usando fallback universal')
      return await fetchMantenerRachaFallback(n, user)
    }

    // Mezclar todas las preguntas obtenidas
    const shuffledQuestions = shuffleArray(allQuestions)
    const finalQuestions = shuffledQuestions.slice(0, n)

    console.log(`✅ Mantener racha INTELIGENTE: ${finalQuestions.length} preguntas de ${temasParaRacha.length} temas estudiados`)
    console.log(`📊 Distribución final: ${finalQuestions.map(q => q.articles?.laws?.short_name || 'N/A').reduce((acc, law) => {
      acc[law] = (acc[law] || 0) + 1
      return acc
    }, {})}`)

    return transformQuestions(finalQuestions)

  } catch (error) {
    console.error('❌ Error en fetchMantenerRacha inteligente:', error)
    return await fetchMantenerRachaFallback(n, user || null)
  }
}

// 🔄 FUNCIÓN FALLBACK UNIVERSAL INTELIGENTE
async function fetchMantenerRachaFallback(n, user) {
  try {
    console.log('🔄 Ejecutando fallback universal inteligente')
    
    // 🧠 PASO 1: Detectar leyes que el usuario ha estudiado (si tiene historial)
    let studiedLaws = null
    
    if (user) {
      console.log('👤 Usuario detectado, analizando historial de leyes estudiadas...')
      
      // Obtener leyes de preguntas que ha respondido
      const { data: userQuestionHistory, error: historyError } = await supabase
        .from('test_questions')
        .select(`
          articles!inner(
            laws!inner(short_name)
          ),
          tests!inner(user_id)
        `)
        .eq('tests.user_id', user.id)
.limit(10000) // Límite aumentado para usuarios muy activos

      if (!historyError && userQuestionHistory?.length > 0) {
        // Extraer leyes únicas del historial
        const lawsFromHistory = [...new Set(
          userQuestionHistory
            .map(item => item.articles?.laws?.short_name)
            .filter(Boolean)
        )]
        
        if (lawsFromHistory.length > 0) {
          studiedLaws = lawsFromHistory
          console.log('🎯 Leyes detectadas del historial del usuario:', studiedLaws)
        }
      }
      
      // FALLBACK: Si no hay historial de preguntas, intentar detectar por oposición
      if (!studiedLaws) {
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('target_oposicion')
          .eq('id', user.id)
          .single()
        
        if (userProfile?.target_oposicion) {
          // Mapear oposición a leyes principales
          const oposicionLaws = {
            'auxiliar_administrativo_estado': ['Ley 19/2013', 'LRJSP', 'CE'],
            'auxiliar_administrativo': ['Ley 19/2013', 'LRJSP', 'CE'],
            'tecnico_hacienda': ['LRJSP', 'CE', 'Ley 7/1985'],
            // Agregar más mapeos según oposiciones disponibles
          }
          
          studiedLaws = oposicionLaws[userProfile.target_oposicion] || null
          if (studiedLaws) {
            console.log(`🎯 Leyes detectadas por oposición (${userProfile.target_oposicion}):`, studiedLaws)
          }
        }
      }
    }
    
    // 🚀 PASO 2: Construir query con filtro inteligente
    let query = supabase
      .from('questions')
      .select(`
        id, question_text, option_a, option_b, option_c, option_d,
        correct_option, explanation, difficulty, is_official_exam,
        primary_article_id, exam_source, exam_date, exam_entity,
        articles!inner(
          id, article_number, title, content,
          laws!inner(short_name, name)
        )
      `)
      .eq('is_active', true)
      .in('difficulty', ['easy', 'medium']) // Mantener motivación con preguntas no muy difíciles

    // 🎯 PASO 3: Aplicar filtro de leyes solo si las detectamos
    if (studiedLaws && studiedLaws.length > 0) {
      query = query.in('articles.laws.short_name', studiedLaws)
      console.log('🔍 Aplicando filtro por leyes estudiadas:', studiedLaws)
    } else {
      console.log('🌍 Sin filtro de leyes - usando todas las leyes disponibles (comportamiento neutral)')
    }
    
    // 🎲 PASO 4: Obtener y mezclar preguntas
    const { data: fallbackData, error: fallbackError } = await query
      .limit(n * 3) // Obtener más para mezclar mejor

    if (fallbackError) throw fallbackError

    if (!fallbackData || fallbackData.length === 0) {
      // Si el filtro no devuelve resultados, intentar sin filtro
      if (studiedLaws) {
        console.log('⚠️ Sin resultados con filtro de leyes, reintentando sin filtro...')
        
        const { data: universalData, error: universalError } = await supabase
          .from('questions')
          .select(`
            id, question_text, option_a, option_b, option_c, option_d,
            correct_option, explanation, difficulty, is_official_exam,
            primary_article_id, exam_source, exam_date, exam_entity,
            articles!inner(
              id, article_number, title, content,
              laws!inner(short_name, name)
            )
          `)
          .eq('is_active', true)
          .in('difficulty', ['easy', 'medium'])
          .limit(n * 3)
        
        if (universalError) throw universalError
        
        if (universalData && universalData.length > 0) {
          const shuffledQuestions = shuffleArray(universalData)
          const finalQuestions = shuffledQuestions.slice(0, n)
          console.log(`✅ Fallback universal: ${finalQuestions.length} preguntas de todas las leyes`)
          return transformQuestions(finalQuestions)
        }
      }
      
      throw new Error('No hay preguntas disponibles para mantener racha')
    }

    // 🎲 Mezclar y seleccionar
    const shuffledQuestions = shuffleArray(fallbackData)
    const finalQuestions = shuffledQuestions.slice(0, n)

    const lawDistribution = finalQuestions.reduce((acc, q) => {
      const law = q.articles?.laws?.short_name || 'N/A'
      acc[law] = (acc[law] || 0) + 1
      return acc
    }, {})

    console.log(`✅ Fallback inteligente: ${finalQuestions.length} preguntas`)
    console.log(`📊 Distribución por ley:`, lawDistribution)
    
    return transformQuestions(finalQuestions)

  } catch (error) {
    console.error('❌ Error en fallback universal de mantener racha:', error)
    throw error
  }
}



// =================================================================
// 🔍 FETCHER: EXPLORAR CONTENIDO (Nuevo contenido añadido)
// =================================================================
export async function fetchExplorarContenido(tema, searchParams, config) {
  try {
    console.log('🔍 Cargando contenido nuevo para explorar')
    
    const n = parseInt(searchParams.get('n')) || 8
    const weeks = parseInt(searchParams.get('weeks')) || 1
    const weekAgo = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000).toISOString()
    
    const { data, error } = await supabase
      .from('questions')
      .select(`
        id, question_text, option_a, option_b, option_c, option_d,
        correct_option, explanation, difficulty, is_official_exam,
        primary_article_id, exam_source, exam_date, exam_entity,
        articles!inner(
          id, article_number, title, content,
          laws!inner(short_name, name)
        )
      `)
      .eq('is_active', true)
      .gte('created_at', weekAgo)
      .order('created_at', { ascending: false })
      .limit(n)
      
    if (error) throw error
    
    if (!data || data.length === 0) {
      throw new Error(`No hay contenido nuevo de las últimas ${weeks} semanas`)
    }
    
    console.log(`✅ ${data.length} preguntas nuevas cargadas`)
    return transformQuestions(data)
    
  } catch (error) {
    console.error('❌ Error en fetchExplorarContenido:', error)
    throw error
  }
}

// =================================================================
// 🔧 FUNCIONES AUXILIARES
// =================================================================

// Convertir porcentaje a dificultad
function getDifficultyFromPercentage(percentage) {
  if (percentage <= 25) return 'easy'
  if (percentage <= 50) return 'medium'
  if (percentage <= 75) return 'hard'
  return 'extreme'
}

// =================================================================
// 🎲 FETCHER: TEST ALEATORIO MULTI-TEMA - PARA TEST ALEATORIO PERSONALIZADO
// =================================================================
export async function fetchAleatorioMultiTema(themes, searchParams, config) {
  try {
    console.log('🎲🔥 EJECUTANDO fetchAleatorioMultiTema:', themes, 'TIMESTAMP:', new Date().toLocaleTimeString())
    
    // Obtener usuario actual
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Usuario no autenticado')
    }

    // Leer parámetros de configuración
    const configParams = {
      numQuestions: parseInt(searchParams.get('n')) || 20,
      difficulty: searchParams.get('difficulty') || 'mixed',
      excludeRecent: searchParams.get('exclude_recent') === 'true',
      excludeDays: parseInt(searchParams.get('exclude_days')) || 15,
      onlyOfficialQuestions: searchParams.get('official_only') === 'true',
      focusWeakAreas: searchParams.get('focus_weak') === 'true',
      focusEssentialArticles: searchParams.get('focus_essential') === 'true'  // ✅ AÑADIDO
    }

    console.log('🎛️ Configuración multi-tema:', configParams)

    // ✅ USAR QUERY DIRECTA BASADA EN topic_scope COMO fetchQuestionsByTopicScope
    const allQuestions = []
    
    for (const tema of themes) {
      console.log(`📋 Obteniendo preguntas del tema ${tema}...`)
      
      try {
        // 1. Obtener mapeo del tema desde topic_scope
        const { data: mappings, error: mappingError } = await supabase
          .from('topic_scope')
          .select(`
            article_numbers,
            laws!inner(short_name, id, name),
            topics!inner(topic_number, position_type)
          `)
          .eq('topics.topic_number', tema)
          .eq('topics.position_type', 'auxiliar_administrativo')

        if (mappingError) {
          console.error(`❌ Error obteniendo mapeo para tema ${tema}:`, mappingError)
          continue
        }

        if (!mappings?.length) {
          console.log(`⚠️ No se encontró mapeo para tema ${tema}`)
          continue
        }

        console.log(`📊 Mapeo tema ${tema}:`, mappings.map(m => `${m.laws.short_name}: ${m.article_numbers.length} arts`))

        // 2. Obtener preguntas para cada mapeo del tema
        for (const mapping of mappings) {
          const lawShortName = mapping.laws.short_name
          const articleNumbers = mapping.article_numbers

          console.log(`📋 Consultando ${lawShortName} con ${articleNumbers.length} artículos`)

          // ✅ Query directa a través de articles->laws (patrón que SÍ funciona)
          let query = supabase
            .from('questions')
            .select(`
              id, question_text, option_a, option_b, option_c, option_d,
              correct_option, explanation, difficulty, is_official_exam,
              primary_article_id, exam_source, exam_date, exam_entity,
              articles!inner(
                id, article_number, title, content,
                laws!inner(short_name, id, name)
              )
            `)
            .eq('is_active', true)
            .eq('articles.laws.short_name', lawShortName)
            .in('articles.article_number', articleNumbers)

          // Aplicar filtros de configuración
          if (configParams.difficulty !== 'mixed') {
            const difficultyMap = {
              'easy': 'facil',
              'medium': 'medio', 
              'hard': 'dificil'
            }
            const targetDifficulty = difficultyMap[configParams.difficulty]
            if (targetDifficulty) {
              query = query.eq('difficulty', targetDifficulty)
            }
          }

          if (configParams.onlyOfficialQuestions) {
            query = query.eq('is_official_exam', true)
          }

          const { data: temaQuestions, error: temaError } = await query

          if (temaError) {
            console.error(`❌ Error obteniendo preguntas de ${lawShortName} para tema ${tema}:`, temaError)
            continue
          }

          if (temaQuestions && temaQuestions.length > 0) {
            // Marcar cada pregunta con el tema de origen para las estadísticas
            const questionsWithTopic = temaQuestions.map(q => ({
              ...q,
              source_topic: tema
            }))
            
            allQuestions.push(...questionsWithTopic)
            console.log(`✅ ${lawShortName} tema ${tema}: ${temaQuestions.length} preguntas obtenidas`)
          }
        }
      } catch (error) {
        console.error(`❌ Error procesando tema ${tema}:`, error)
      }
    }

    if (allQuestions.length === 0) {
      throw new Error('No hay preguntas disponibles con los criterios seleccionados')
    }

    console.log(`📊 Total de preguntas disponibles: ${allQuestions.length}`)

    // ✅ FILTRO DE PREGUNTAS RECIENTES
    let filteredQuestions = allQuestions
    if (configParams.excludeRecent) {
      console.log('🚫 Aplicando filtro de preguntas recientes...')
      const cutoffDate = new Date(Date.now() - configParams.excludeDays * 24 * 60 * 60 * 1000).toISOString()
      
      const { data: recentAnswers, error: recentError } = await supabase
        .from('test_questions')
        .select(`
          question_id,
          tests!inner(user_id)
        `)
        .eq('tests.user_id', user.id)
        .gte('created_at', cutoffDate)

      if (!recentError && recentAnswers && recentAnswers.length > 0) {
        const recentQuestionIds = new Set(recentAnswers.map(answer => answer.question_id))
        filteredQuestions = allQuestions.filter(q => !recentQuestionIds.has(q.id))
        console.log(`📊 Preguntas después de filtro reciente: ${filteredQuestions.length} (${allQuestions.length - filteredQuestions.length} excluidas)`)
      } else {
        console.log('📊 No hay preguntas recientes que excluir')
      }
    }

    // ✅ FILTRO DE ARTÍCULOS IMPRESCINDIBLES (si está activado)
    if (configParams.focusEssentialArticles) {
      console.log('⭐ Aplicando filtro de artículos imprescindibles...')
      
      // Identificar artículos que tienen preguntas oficiales (= imprescindibles)
      const articleOfficialCount = {}
      
      // Para cada tema seleccionado, identificar artículos con preguntas oficiales
      for (const tema of themes) {
        const { data: mappings } = await supabase
          .from('topic_scope')
          .select(`
            article_numbers,
            laws!inner(short_name),
            topics!inner(topic_number, position_type)
          `)
          .eq('topics.topic_number', tema)
          .eq('topics.position_type', 'auxiliar_administrativo')
        
        if (mappings?.length > 0) {
          for (const mapping of mappings) {
            for (const articleNumber of mapping.article_numbers) {
              const { count } = await supabase
                .from('questions')
                .select('id, articles!inner(laws!inner(short_name), article_number)', { count: 'exact', head: true })
                .eq('is_active', true)
                .eq('is_official_exam', true)
                .eq('articles.laws.short_name', mapping.laws.short_name)
                .eq('articles.article_number', articleNumber)
              
              if (count > 0) {
                const articleKey = `${mapping.laws.short_name}-${articleNumber}`
                articleOfficialCount[articleKey] = count
              }
            }
          }
        }
      }
      
      // Filtrar solo preguntas de artículos imprescindibles
      const essentialQuestions = filteredQuestions.filter(question => {
        if (question.articles?.article_number && question.articles?.laws?.short_name) {
          const articleKey = `${question.articles.laws.short_name}-${question.articles.article_number}`
          return articleOfficialCount[articleKey] >= 1
        }
        return false
      })
      
      console.log(`⭐ Artículos imprescindibles: ${essentialQuestions.length} preguntas (de ${filteredQuestions.length} totales)`)
      console.log(`📊 Artículos imprescindibles identificados:`, Object.keys(articleOfficialCount))
      
      if (essentialQuestions.length === 0) {
        throw new Error('No hay preguntas de artículos imprescindibles disponibles para los temas seleccionados')
      }
      
      filteredQuestions = essentialQuestions
    }

    // ✅ PRIORIZACIÓN INTELIGENTE AUTOMÁTICA
    console.log('🧠 Aplicando priorización inteligente automática...')
    
    // 1. Obtener historial de respuestas del usuario SOLO a preguntas que siguen activas
    console.log('📊 Obteniendo historial de respuestas a preguntas activas...')
    
    // Obtener todas las respuestas del usuario
    const { data: allUserAnswers, error: allAnswersError } = await supabase
      .from('test_questions')
      .select('question_id, created_at, tests!inner(user_id)')
      .eq('tests.user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5000)
    
    if (allAnswersError) {
      console.error('❌ Error obteniendo respuestas:', allAnswersError)
      const selectedQuestions = filteredQuestions
        .sort(() => Math.random() - 0.5)
        .slice(0, configParams.numQuestions)
      return transformQuestions(selectedQuestions)
    }
    
    // Luego filtrar solo las que corresponden a preguntas activas (SIN LÍMITES)
    const activeQuestionIds = new Set()
    const { data: activeQuestions, error: activeError } = await supabase
      .from('questions')
      .select('id')
      .eq('is_active', true)
      .range(0, 100000) // Usar range en lugar de limit para obtener TODAS
    
    if (!activeError && activeQuestions) {
      activeQuestions.forEach(q => activeQuestionIds.add(q.id))
    }
    
    // ✅ FIX DEFINITIVO: USAR TODAS LAS RESPUESTAS para construir el historial de respondidas
    // El historial debe incluir preguntas que pudieron haber sido desactivadas temporalmente
    const userAnswers = allUserAnswers || []
    const answersError = allAnswersError
    
    console.log(`📊 Historial de respuestas del usuario: ${userAnswers.length}`)
    console.log(`📊 Preguntas filtradas disponibles: ${filteredQuestions.length}`)
    
    // 2. Clasificar preguntas por prioridad
    const answeredQuestionIds = new Set()
    const questionLastAnswered = new Map()
    
    if (userAnswers && userAnswers.length > 0) {
      userAnswers.forEach(answer => {
        answeredQuestionIds.add(answer.question_id)
        const answerDate = new Date(answer.created_at)
        
        // Guardar la fecha más reciente para cada pregunta
        if (!questionLastAnswered.has(answer.question_id) || 
            answerDate > questionLastAnswered.get(answer.question_id)) {
          questionLastAnswered.set(answer.question_id, answerDate)
        }
      })
    }

    // 3. Separar preguntas por prioridad
    const neverSeenQuestions = []
    const answeredQuestions = []
    
    filteredQuestions.forEach(question => {
      if (answeredQuestionIds.has(question.id)) {
        // Pregunta ya respondida - agregar fecha para ordenamiento
        question._lastAnswered = questionLastAnswered.get(question.id)
        answeredQuestions.push(question)
      } else {
        // Pregunta nunca vista - máxima prioridad
        neverSeenQuestions.push(question)
      }
    })

    // 🔍 LOG PARA VERIFICACIÓN SQL: IDs de preguntas vistas vs nunca vistas
    console.log('🔍 SQL CHECK - PREGUNTAS YA RESPONDIDAS:')
    console.log(`Total: ${answeredQuestions.length}`)
    if (answeredQuestions.length > 0) {
      console.log('IDs:', answeredQuestions.map(q => `'${q.id}'`).join(', '))
      console.log(`Verificar en SQL: SELECT question_id, created_at FROM test_questions tq JOIN tests t ON t.id = tq.test_id WHERE t.user_id = 'b9ebbad0-cb6d-4dc3-87fc-a32a31611256' AND question_id IN (${answeredQuestions.map(q => `'${q.id}'`).join(', ')}) ORDER BY created_at DESC;`)
    }
    
    console.log('🔍 SQL CHECK - PREGUNTAS NUNCA VISTAS:')
    console.log(`Total: ${neverSeenQuestions.length}`)
    if (neverSeenQuestions.length > 0) {
      console.log('IDs:', neverSeenQuestions.map(q => `'${q.id}'`).join(', '))
      console.log(`Verificar en SQL: SELECT question_id, created_at FROM test_questions tq JOIN tests t ON t.id = tq.test_id WHERE t.user_id = 'b9ebbad0-cb6d-4dc3-87fc-a32a31611256' AND question_id IN (${neverSeenQuestions.map(q => `'${q.id}'`).join(', ')}) ORDER BY created_at DESC;`)
    }

    console.log(`🎯 DECISIÓN DE PRIORIZACIÓN:`)
    console.log(`- Nunca vistas: ${neverSeenQuestions.length}`)
    console.log(`- Ya respondidas: ${answeredQuestions.length}`)
    console.log(`- Solicitadas: ${configParams.numQuestions}`)

    

    // 4. Ordenar preguntas respondidas por fecha (más antiguas primero para repaso espaciado)
    answeredQuestions.sort((a, b) => a._lastAnswered - b._lastAnswered)

    // 5. Calcular distribución inteligente
    let selectedQuestions = []
    
    if (neverSeenQuestions.length >= configParams.numQuestions) {
      // ✅ 1º PRIORIDAD: Si hay suficientes preguntas nunca vistas, usar solo esas
      console.log('🎯 CASO 1: Suficientes preguntas nunca vistas - usando solo nunca vistas')
      
      selectedQuestions = shuffleArray(neverSeenQuestions)
        .slice(0, configParams.numQuestions)
        
      console.log(`✅ Seleccionadas ${selectedQuestions.length} preguntas nunca vistas (de ${neverSeenQuestions.length} disponibles)`)
      console.log('🔍 Para verificar en SQL si ya fueron respondidas:')
      console.log(`SELECT question_id, created_at FROM test_questions tq JOIN tests t ON t.id = tq.test_id WHERE t.user_id = 'b9ebbad0-cb6d-4dc3-87fc-a32a31611256' AND question_id IN (${selectedQuestions.map(q => `'${q.id}'`).join(', ')}) ORDER BY created_at DESC;`)
      console.log('🔍 Para verificar si están activas:')
      console.log(`SELECT id, is_active FROM questions WHERE id IN (${selectedQuestions.map(q => `'${q.id}'`).join(', ')});`)
      
    } else {
      // ✅ DISTRIBUCIÓN INTELIGENTE: Mezclar nunca vistas + repaso espaciado
      const neverSeenCount = neverSeenQuestions.length
      const reviewCount = configParams.numQuestions - neverSeenCount
      
      console.log('🎯 CASO 2: Distribución mixta - combinando nunca vistas + repaso espaciado')
      console.log(`📊 Distribución: ${neverSeenCount} nunca vistas + ${reviewCount} para repaso`)
      
      // Todas las nunca vistas (usar shuffleArray para consistencia)
      const shuffledNeverSeen = shuffleArray(neverSeenQuestions)
      
      // ✅ 2º PRIORIDAD: Las más antiguas para repaso espaciado (ya ordenadas)
      const oldestForReview = answeredQuestions.slice(0, reviewCount)
      
      selectedQuestions = [...shuffledNeverSeen, ...oldestForReview]
      console.log(`✅ Combinadas: ${shuffledNeverSeen.length} nunca vistas + ${oldestForReview.length} para repaso = ${selectedQuestions.length} total`)
    }

    // 6. 🔧 MEZCLAR SOLO EL ORDEN FINAL (no la priorización)
    // Esto mantiene la priorización pero hace impredecible el orden de aparición
    selectedQuestions = shuffleArray(selectedQuestions)
    
    // Limpiar propiedades temporales
    selectedQuestions.forEach(q => {
      delete q._lastAnswered
    })

    console.log(`✅ Test aleatorio multi-tema generado: ${selectedQuestions.length} preguntas de ${themes.length} temas`)
    
    // Mantener source_topic como tema para el sistema de guardado
    const questionsWithTema = selectedQuestions.map(({ source_topic, ...question }) => ({
      ...question,
      tema: source_topic // Asignar el tema de origen para el guardado correcto
    }))
    
    return transformQuestions(questionsWithTema)

  } catch (error) {
    console.error('❌ Error en fetchAleatorioMultiTema:', error)
    throw error
  }
}