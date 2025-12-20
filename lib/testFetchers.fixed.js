// lib/testFetchers.fixed.js - VERSIÓN CORREGIDA DEL ALGORITMO
// Fix para el problema de preguntas repetidas

import { getSupabaseClient } from './supabase'

const supabase = getSupabaseClient()

// 🔧 FUNCIÓN MEJORADA: fetchPersonalizedQuestions con fixes para evitar duplicados
export async function fetchPersonalizedQuestions(tema, searchParams, config) {
  try {
    console.log('🎛️ [FIXED] Cargando test personalizado MONO-LEY para tema:', tema)
    
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
      onlyOfficialQuestions: searchParams.get('only_official') === 'true',
      focusWeakAreas: searchParams.get('focus_weak') === 'true',
      timeLimit: searchParams.get('time_limit') ? parseInt(searchParams.get('time_limit')) : null
    }
    console.log('🎛️ [FIXED] Configuración personalizada:', configParams)

    // 🔥 FIX #1: QUERY UNIFICADA Y CONSISTENTE
    console.log('🔍 [FIXED] PASO 1: Obteniendo preguntas con query unificada...')
    
    let baseQuery = supabase
      .from('questions')
      .select(`
        id, question_text, option_a, option_b, option_c, option_d,
        correct_option, explanation, difficulty, question_type, tags,
        primary_article_id, is_official_exam, exam_source, exam_date,
        exam_entity, official_difficulty_level, is_active, created_at, updated_at,
        articles!inner(
          id, article_number, title, content,
          laws!inner(id, short_name, name)
        )
      `)
      .eq('articles.laws.short_name', 'Ley 19/2013')
      .eq('is_active', true) // ✅ SOLO PREGUNTAS ACTIVAS
    
    // Aplicar filtros adicionales
    if (configParams.onlyOfficialQuestions) {
      baseQuery = baseQuery.eq('is_official_exam', true)
    }

    const { data: allQuestions, error: questionsError } = await baseQuery
      .order('created_at', { ascending: false })

    if (questionsError) {
      console.error('❌ Error obteniendo preguntas:', questionsError.message)
      throw questionsError
    }

    if (!allQuestions || allQuestions.length === 0) {
      console.log('❌ No se encontraron preguntas para esta ley')
      return []
    }

    console.log(`📚 [FIXED] Preguntas disponibles: ${allQuestions.length}`)

    // 🔥 FIX #2: HISTORIAL CON MISMOS FILTROS Y MEJOR CONSISTENCIA
    console.log('🔍 [FIXED] PASO 2: Obteniendo historial con filtros consistentes...')
    
    const { data: userAnswers, error: answersError } = await supabase
      .from('test_questions')
      .select(`
        question_id, 
        created_at,
        tests!inner(user_id),
        questions!inner(
          is_active,
          articles!inner(
            laws!inner(short_name)
          )
        )
      `)
      .eq('tests.user_id', user.id)
      .eq('questions.is_active', true) // ✅ SOLO HISTORIAL DE PREGUNTAS ACTIVAS
      .eq('questions.articles.laws.short_name', 'Ley 19/2013') // ✅ MISMA LEY
      .order('created_at', { ascending: false })

    if (answersError) {
      console.error('❌ Error obteniendo historial:', answersError.message)
      // No fallar por esto, continuar sin historial
    }

    // 🔥 FIX #3: VALIDACIÓN ESTRICTA DE IDs
    console.log('🔍 [FIXED] PASO 3: Validando consistencia de IDs...')
    
    const answeredQuestionIds = new Set()
    const questionLastAnswered = new Map()
    const validQuestionIds = new Set(allQuestions.map(q => q.id))

    if (userAnswers && userAnswers.length > 0) {
      let validAnswers = 0
      let invalidAnswers = 0
      
      userAnswers.forEach(answer => {
        const questionId = answer.question_id
        
        // ✅ VALIDAR QUE EL ID EXISTE EN LAS PREGUNTAS DISPONIBLES
        if (validQuestionIds.has(questionId)) {
          answeredQuestionIds.add(questionId)
          const answerDate = new Date(answer.created_at)
          
          if (!questionLastAnswered.has(questionId) || 
              answerDate > questionLastAnswered.get(questionId)) {
            questionLastAnswered.set(questionId, answerDate)
          }
          validAnswers++
        } else {
          // ⚠️ ID inconsistente - loggear para debug
          console.warn(`⚠️ [FIXED] ID inconsistente en historial: ${questionId}`)
          invalidAnswers++
        }
      })
      
      console.log(`📊 [FIXED] Historial procesado:`)
      console.log(`   ✅ Respuestas válidas: ${validAnswers}`)
      console.log(`   ⚠️ Respuestas inconsistentes: ${invalidAnswers}`)
      console.log(`   📝 Preguntas únicas respondidas: ${answeredQuestionIds.size}`)
    } else {
      console.log('📊 [FIXED] Usuario sin historial - todas las preguntas son nuevas')
    }

    // 🔥 FIX #4: CLASIFICACIÓN MEJORADA CON LOGS DETALLADOS
    console.log('🔍 [FIXED] PASO 4: Clasificando preguntas con verificación...')
    
    const neverSeenQuestions = []
    const answeredQuestions = []
    
    allQuestions.forEach(question => {
      const isAnswered = answeredQuestionIds.has(question.id)
      
      if (isAnswered) {
        question._lastAnswered = questionLastAnswered.get(question.id)
        answeredQuestions.push(question)
      } else {
        neverSeenQuestions.push(question)
      }
    })

    // Ordenar respondidas por fecha (más antiguas primero)
    answeredQuestions.sort((a, b) => a._lastAnswered - b._lastAnswered)

    console.log(`📊 [FIXED] CLASIFICACIÓN FINAL:`)
    console.log(`   🟢 Nunca vistas: ${neverSeenQuestions.length}`)
    console.log(`   🟡 Ya respondidas: ${answeredQuestions.length}`)

    // 🔥 FIX #5: ALGORITMO DE SELECCIÓN MEJORADO
    console.log('🔍 [FIXED] PASO 5: Aplicando algoritmo de selección optimizado...')
    
    let selectedQuestions = []
    
    if (neverSeenQuestions.length >= configParams.numQuestions) {
      // ✅ CASO 1: Suficientes nunca vistas
      console.log('🎯 [FIXED] ESTRATEGIA: Solo preguntas nunca vistas')
      
      selectedQuestions = shuffleArray(neverSeenQuestions)
        .slice(0, configParams.numQuestions)
        
      console.log(`✅ [FIXED] Seleccionadas ${selectedQuestions.length} preguntas nunca vistas`)
      
      // 🔥 FIX #6: VERIFICACIÓN ESTRICTA DE LA SELECCIÓN
      const verificationFailed = selectedQuestions.some(q => answeredQuestionIds.has(q.id))
      if (verificationFailed) {
        console.error('🚨 [FIXED] BUG CRÍTICO: Se seleccionaron preguntas ya vistas!')
        selectedQuestions.forEach((q, index) => {
          const wasAnswered = answeredQuestionIds.has(q.id)
          if (wasAnswered) {
            console.error(`   ❌ ${index + 1}. ${q.id} - YA VISTA el ${questionLastAnswered.get(q.id)}`)
          }
        })
        throw new Error('Error crítico en selección de preguntas')
      }
      
    } else {
      // ✅ CASO 2: Distribución mixta
      console.log('🎯 [FIXED] ESTRATEGIA: Distribución mixta')
      
      const neverSeenCount = neverSeenQuestions.length
      const reviewCount = configParams.numQuestions - neverSeenCount
      
      console.log(`📊 [FIXED] Distribución: ${neverSeenCount} nunca vistas + ${reviewCount} repaso`)
      
      const shuffledNeverSeen = shuffleArray(neverSeenQuestions)
      const oldestForReview = answeredQuestions.slice(0, reviewCount)
      
      selectedQuestions = [...shuffledNeverSeen, ...oldestForReview]
      
      console.log(`✅ [FIXED] Combinadas: ${shuffledNeverSeen.length} + ${oldestForReview.length} = ${selectedQuestions.length}`)
    }

    // 🔥 FIX #7: MEZCLA FINAL Y LIMPIEZA
    selectedQuestions = shuffleArray(selectedQuestions)
    
    // Limpiar propiedades temporales
    selectedQuestions.forEach(q => {
      delete q._lastAnswered
    })

    // 🔥 FIX #8: LOGGING FINAL PARA DEBUGGING
    console.log(`📊 [FIXED] RESULTADO FINAL:`)
    console.log(`   📚 Preguntas devueltas: ${selectedQuestions.length}`)
    console.log(`   🎯 IDs: ${selectedQuestions.map(q => q.id).slice(0, 5).join(', ')}${selectedQuestions.length > 5 ? '...' : ''}`)

    // Transformar al formato esperado
    return transformQuestions(selectedQuestions)

  } catch (error) {
    console.error('❌ [FIXED] Error en fetchPersonalizedQuestions:', error.message)
    console.error(error.stack)
    throw error
  }
}

// 🔧 FUNCIÓN AUXILIAR: Mezclar arrays (sin mutación)
function shuffleArray(array) {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// 🔧 FUNCIÓN DE TRANSFORMACIÓN (igual que original)
function transformQuestions(supabaseQuestions) {
  if (!supabaseQuestions || !Array.isArray(supabaseQuestions)) {
    console.error('❌ transformQuestions: Datos inválidos recibidos')
    return []
  }

  return supabaseQuestions.map((q, index) => {
    return {
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
      primary_article_id: q.primary_article_id,
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
      metadata: {
        id: q.id,
        difficulty: q.difficulty || 'auto',
        question_type: q.question_type || 'single',
        tags: q.tags || [],
        is_active: q.is_active,
        created_at: q.created_at,
        updated_at: q.updated_at,
        is_official_exam: q.is_official_exam,
        exam_source: q.exam_source,
        exam_date: q.exam_date,
        exam_entity: q.exam_entity,
        official_difficulty_level: q.official_difficulty_level,
      }
    }
  })
}

export { transformQuestions }