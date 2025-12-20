// utils/questionFiltering.js - SISTEMA DE FILTRADO POR COOLDOWN
import { getSupabaseClient } from '../lib/supabase'

const supabase = getSupabaseClient()

/**
 * ✅ FUNCIÓN PRINCIPAL: Filtrar preguntas según cooldown del usuario
 * @param {string} userId - ID del usuario
 * @param {Array} allQuestions - Array completo de preguntas
 * @param {string} difficulty - Dificultad deseada ('easy', 'medium', 'hard')
 * @param {number} maxQuestions - Número máximo de preguntas a devolver
 * @returns {Promise<Array>} - Array de preguntas filtradas
 */
export async function filterQuestionsByCooldown(userId, allQuestions, difficulty = null, maxQuestions = 10) {
  try {
    console.log('🔍 Filtrando preguntas por cooldown...', {
      userId,
      totalQuestions: allQuestions.length,
      difficulty,
      maxQuestions
    })

    if (!userId || !allQuestions || allQuestions.length === 0) {
      console.warn('⚠️ Datos insuficientes para filtrar preguntas')
      return allQuestions.slice(0, maxQuestions)
    }

    // 1. Obtener configuración de cooldown del usuario
    const userCooldownDays = await getUserCooldownSettings(userId)
    console.log('⚙️ Cooldown del usuario:', userCooldownDays, 'días')

    // 2. Si cooldown es 0, devolver preguntas directamente
    if (userCooldownDays === 0) {
      console.log('🚀 Sin cooldown - Devolviendo preguntas sin filtrar')
      const filtered = difficulty 
        ? allQuestions.filter(q => q.metadata?.difficulty === difficulty)
        : allQuestions
      return shuffleArray(filtered).slice(0, maxQuestions)
    }

    // 3. Obtener preguntas ya respondidas en el período de cooldown
    const answeredQuestionIds = await getAnsweredQuestionsInCooldown(userId, userCooldownDays)
    console.log('📝 Preguntas en cooldown:', answeredQuestionIds.length)

    // 4. Filtrar preguntas disponibles
    let availableQuestions = allQuestions.filter(question => {
      // Verificar dificultad si se especifica
      if (difficulty && question.metadata?.difficulty !== difficulty) {
        return false
      }

      // Verificar si la pregunta no está en cooldown
      const questionId = question.metadata?.id
      if (!questionId) {
        console.warn('⚠️ Pregunta sin ID:', question.question?.slice(0, 50))
        return true // Incluir preguntas sin ID por seguridad
      }

      return !answeredQuestionIds.includes(questionId)
    })

    console.log('✅ Preguntas disponibles después del filtrado:', availableQuestions.length)

    // 5. Si no hay suficientes preguntas disponibles, incluir algunas del cooldown
    if (availableQuestions.length < maxQuestions) {
      console.log('📊 Pocas preguntas disponibles, incluyendo algunas del cooldown...')
      
      const cooldownQuestions = allQuestions.filter(question => {
        if (difficulty && question.metadata?.difficulty !== difficulty) {
          return false
        }
        const questionId = question.metadata?.id
        return questionId && answeredQuestionIds.includes(questionId)
      })

      // Priorizar las preguntas más antiguas del cooldown
      const sortedCooldownQuestions = await sortQuestionsByLastAnswered(userId, cooldownQuestions)
      const additionalNeeded = maxQuestions - availableQuestions.length
      availableQuestions = [
        ...availableQuestions,
        ...sortedCooldownQuestions.slice(0, additionalNeeded)
      ]
    }

    // 6. Mezclar y limitar
    const shuffledQuestions = shuffleArray(availableQuestions)
    const finalQuestions = shuffledQuestions.slice(0, maxQuestions)

    console.log('🎯 Preguntas finales seleccionadas:', finalQuestions.length)
    
    return finalQuestions

  } catch (error) {
    console.error('❌ Error filtrando preguntas por cooldown:', error)
    // Fallback: devolver preguntas sin filtrar
    const fallback = difficulty 
      ? allQuestions.filter(q => q.metadata?.difficulty === difficulty)
      : allQuestions
    return shuffleArray(fallback).slice(0, maxQuestions)
  }
}

/**
 * Obtener configuración de cooldown del usuario
 */
async function getUserCooldownSettings(userId) {
  try {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('question_cooldown_days')
      .eq('user_id', userId)
      .single()

    if (error || !profile) {
      console.warn('⚠️ No se pudo obtener configuración de cooldown, usando 10 días por defecto')
      return 10
    }

    return profile.question_cooldown_days || 10

  } catch (error) {
    console.error('❌ Error obteniendo configuración de cooldown:', error)
    return 10 // Valor por defecto
  }
}

/**
 * Obtener IDs de preguntas respondidas en el período de cooldown
 */
async function getAnsweredQuestionsInCooldown(userId, cooldownDays) {
  try {
    // Calcular fecha de cooldown
    const cooldownDate = new Date()
    cooldownDate.setDate(cooldownDate.getDate() - cooldownDays)

    // Obtener tests del usuario
    const { data: userTests, error: testsError } = await supabase
      .from('tests')
      .select('id')
      .eq('user_id', userId)

    if (testsError || !userTests) {
      console.warn('⚠️ Error obteniendo tests del usuario:', testsError)
      return []
    }

    if (userTests.length === 0) {
      console.log('📝 Usuario sin tests previos')
      return []
    }

    const testIds = userTests.map(test => test.id)

    // Obtener preguntas respondidas en el período de cooldown
    const { data: answeredQuestions, error: questionsError } = await supabase
      .from('test_questions')
      .select('question_id')
      .in('test_id', testIds)
      .gte('created_at', cooldownDate.toISOString())

    if (questionsError) {
      console.warn('⚠️ Error obteniendo preguntas respondidas:', questionsError)
      return []
    }

    // Extraer IDs únicos
    const uniqueQuestionIds = [...new Set(answeredQuestions.map(q => q.question_id))]
    
    return uniqueQuestionIds

  } catch (error) {
    console.error('❌ Error obteniendo preguntas en cooldown:', error)
    return []
  }
}

/**
 * Ordenar preguntas del cooldown por última vez respondida (más antiguas primero)
 */
async function sortQuestionsByLastAnswered(userId, questions) {
  try {
    if (!questions || questions.length === 0) return []

    // Obtener tests del usuario
    const { data: userTests, error: testsError } = await supabase
      .from('tests')
      .select('id')
      .eq('user_id', userId)

    if (testsError || !userTests) return questions

    const testIds = userTests.map(test => test.id)
    const questionIds = questions.map(q => q.metadata?.id).filter(Boolean)

    if (questionIds.length === 0) return questions

    // Obtener última fecha de respuesta para cada pregunta
    const { data: lastAnswers, error: answersError } = await supabase
      .from('test_questions')
      .select('question_id, created_at')
      .in('test_id', testIds)
      .in('question_id', questionIds)
      .order('created_at', { ascending: false })

    if (answersError) return questions

    // Crear mapa de última respuesta por pregunta
    const lastAnswerMap = {}
    lastAnswers.forEach(answer => {
      if (!lastAnswerMap[answer.question_id]) {
        lastAnswerMap[answer.question_id] = answer.created_at
      }
    })

    // Ordenar preguntas por última respuesta (más antiguas primero)
    return questions.sort((a, b) => {
      const aDate = lastAnswerMap[a.metadata?.id]
      const bDate = lastAnswerMap[b.metadata?.id]
      
      if (!aDate && !bDate) return 0
      if (!aDate) return 1  // Sin fecha va al final
      if (!bDate) return -1 // Sin fecha va al final
      
      return new Date(aDate) - new Date(bDate) // Más antigua primero
    })

  } catch (error) {
    console.error('❌ Error ordenando preguntas por última respuesta:', error)
    return questions
  }
}

/**
 * Mezclar array aleatoriamente (Fisher-Yates shuffle)
 */
function shuffleArray(array) {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * ✅ FUNCIÓN PARA OBTENER ESTADÍSTICAS DE COOLDOWN
 * @param {string} userId - ID del usuario
 * @returns {Promise<Object>} - Estadísticas de cooldown
 */
export async function getCooldownStats(userId) {
  try {
    if (!userId) return null

    const userCooldownDays = await getUserCooldownSettings(userId)
    const answeredQuestionIds = await getAnsweredQuestionsInCooldown(userId, userCooldownDays)

    // Obtener total de preguntas respondidas
    const { data: userTests } = await supabase
      .from('tests')
      .select('id')
      .eq('user_id', userId)

    if (!userTests) return null

    const testIds = userTests.map(test => test.id)

    const { data: allAnswers } = await supabase
      .from('test_questions')
      .select('question_id')
      .in('test_id', testIds)

    const totalAnswered = allAnswers ? allAnswers.length : 0
    const uniqueQuestions = allAnswers ? new Set(allAnswers.map(q => q.question_id)).size : 0

    return {
      cooldownDays: userCooldownDays,
      questionsInCooldown: answeredQuestionIds.length,
      totalAnswered,
      uniqueQuestions,
      availableQuestions: Math.max(0, uniqueQuestions - answeredQuestionIds.length)
    }

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas de cooldown:', error)
    return null
  }
}

/**
 * ✅ FUNCIÓN PARA TESTS: Verificar si el usuario necesita más preguntas
 * @param {string} userId - ID del usuario
 * @param {string} difficulty - Dificultad deseada
 * @param {number} questionsNeeded - Número de preguntas necesarias
 * @returns {Promise<Object>} - Información sobre disponibilidad
 */
export async function checkQuestionAvailability(userId, difficulty, questionsNeeded = 10) {
  try {
    const stats = await getCooldownStats(userId)
    
    if (!stats) {
      return {
        hasEnoughQuestions: true,
        availableCount: questionsNeeded,
        message: 'Estadísticas no disponibles'
      }
    }

    const hasEnoughQuestions = stats.availableQuestions >= questionsNeeded
    
    return {
      hasEnoughQuestions,
      availableCount: stats.availableQuestions,
      questionsInCooldown: stats.questionsInCooldown,
      cooldownDays: stats.cooldownDays,
      message: hasEnoughQuestions 
        ? `${stats.availableQuestions} preguntas disponibles`
        : `Solo ${stats.availableQuestions} preguntas disponibles (${stats.questionsInCooldown} en cooldown de ${stats.cooldownDays} días)`
    }

  } catch (error) {
    console.error('❌ Error verificando disponibilidad de preguntas:', error)
    return {
      hasEnoughQuestions: true,
      availableCount: questionsNeeded,
      message: 'Error verificando disponibilidad'
    }
  }
}