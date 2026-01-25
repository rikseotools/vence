// utils/testAnalytics.js - Todo el análisis y completar test
import { createClient } from '@supabase/supabase-js'
import { getDeviceInfo } from './testSession.js'

import { getSupabaseClient } from '../lib/supabase'
const supabase = getSupabaseClient()

// Completar test con análisis completo
export const completeDetailedTest = async (sessionId, finalScore, allAnswers, questions, startTime, interactionEvents, userSession) => {
  try {
    console.log('🏁 Completando test con análisis completo...', sessionId)
    
    if (!sessionId) {
      console.error('❌ No se puede completar: sessionId faltante')
      return { success: false, status: 'error' }
    }

    if (!allAnswers || allAnswers.length === 0) {
      console.error('❌ No se puede completar: sin respuestas')
      return { success: false, status: 'error' }
    }
    
    const totalTime = Math.round((Date.now() - startTime) / 1000)
    const avgTimePerQuestion = Math.round(totalTime / questions.length)
    const correctAnswers = allAnswers.filter(a => a.isCorrect)
    const incorrectAnswers = allAnswers.filter(a => !a.isCorrect)
    
    const difficultyStats = {
      easy: allAnswers.filter(a => a.questionData?.metadata?.difficulty === 'easy'),
      medium: allAnswers.filter(a => a.questionData?.metadata?.difficulty === 'medium'), 
      hard: allAnswers.filter(a => a.questionData?.metadata?.difficulty === 'hard'),
      extreme: allAnswers.filter(a => a.questionData?.metadata?.difficulty === 'extreme')
    }
    
    const articleStats = {}
    allAnswers.forEach(answer => {
      const articleId = answer.questionData?.article?.id
      const articleNumber = answer.questionData?.article?.number
      if (articleId && articleNumber) {
        if (!articleStats[articleNumber]) {
          articleStats[articleNumber] = {
            article_id: articleId,
            total: 0,
            correct: 0,
            time_spent: 0,
            law_name: answer.questionData?.article?.law_short_name || 'unknown'
          }
        }
        articleStats[articleNumber].total++
        if (answer.isCorrect) articleStats[articleNumber].correct++
        articleStats[articleNumber].time_spent += answer.timeSpent || 0
      }
    })
    
    const confidenceAnalysis = {
      very_sure_correct: allAnswers.filter(a => a.confidence === 'very_sure' && a.isCorrect).length,
      very_sure_incorrect: allAnswers.filter(a => a.confidence === 'very_sure' && !a.isCorrect).length,
      guessing_correct: allAnswers.filter(a => a.confidence === 'guessing' && a.isCorrect).length,
      guessing_incorrect: allAnswers.filter(a => a.confidence === 'guessing' && !a.isCorrect).length
    }

    const learningPatterns = {
      speed_consistency: avgTimePerQuestion > 0 ? Math.round((1 - (Math.sqrt(allAnswers.reduce((sum, a) => sum + Math.pow((a.timeSpent || 0) - avgTimePerQuestion, 2), 0) / allAnswers.length) / avgTimePerQuestion)) * 100) : 0,
      confidence_accuracy: allAnswers.length > 0 ? Math.round(((confidenceAnalysis.very_sure_correct + confidenceAnalysis.guessing_incorrect) / allAnswers.length) * 100) : 0,
      improvement_during_test: allAnswers.length >= 6 ? allAnswers.slice(-3).filter(a => a.isCorrect).length > allAnswers.slice(0, 3).filter(a => a.isCorrect).length : false,
      interaction_efficiency: allAnswers.length > 0 ? Math.round((allAnswers.filter(a => (a.interactions || 1) === 1).length / allAnswers.length) * 100) : 0
    }

    // 🔴 NUEVA VALIDACIÓN: Verificar que todas las preguntas se guardaron antes de completar
    const { data: savedQuestions, error: verifyError } = await supabase
      .from('test_questions')
      .select('question_order')
      .eq('test_id', sessionId)

    if (verifyError) {
      console.error('❌ Error verificando preguntas guardadas:', verifyError)
    }

    const savedCount = savedQuestions?.length || 0
    const expectedCount = questions.length

    // 🔴 Detectar si hay preguntas perdidas
    if (savedCount < expectedCount) {
      console.warn('⚠️ TEST INCOMPLETO DETECTADO', {
        testId: sessionId,
        preguntasGuardadas: savedCount,
        preguntasEsperadas: expectedCount,
        preguntasPerdidas: expectedCount - savedCount,
        porcentajePerdido: Math.round(((expectedCount - savedCount) / expectedCount) * 100) + '%'
      })

      // Identificar exactamente qué preguntas faltan
      const savedOrders = new Set(savedQuestions?.map(q => q.question_order) || [])
      const missingOrders = []
      for (let i = 1; i <= expectedCount; i++) {
        if (!savedOrders.has(i)) {
          missingOrders.push(i)
        }
      }

      if (missingOrders.length > 0) {
        console.error('❌ Números de pregunta faltantes:', missingOrders)

        // TODO: Aquí podríamos intentar recuperar las preguntas desde localStorage
        // if (typeof window !== 'undefined') {
        //   const backup = new TestBackupSystem(testId)
        //   const unsynced = backup.getUnsyncedAnswers()
        //   if (unsynced.length > 0) {
        //     console.log('💾 Intentando recuperar desde backup local...')
        //   }
        // }
      }
    }

    const { error } = await supabase
      .from('tests')
      .update({
        score: finalScore,
        total_questions: savedCount, // 🔴 FIX: Usar el número real de preguntas guardadas, no las esperadas
        completed_at: new Date().toISOString(),
        is_completed: true, // 🔴 FIX: Si se llama a finalizar, el test está completado
        total_time_seconds: totalTime,
        average_time_per_question: avgTimePerQuestion,
        detailed_analytics: JSON.stringify({
          performance_summary: {
            accuracy_percentage: Math.round((finalScore / questions.length) * 100),
            total_time_minutes: Math.round(totalTime / 60),
            avg_time_per_question: avgTimePerQuestion,
            questions_attempted: allAnswers.length
          },
          
          difficulty_breakdown: Object.keys(difficultyStats).map(diff => ({
            difficulty: diff,
            total: difficultyStats[diff].length,
            correct: difficultyStats[diff].filter(a => a.isCorrect).length,
            accuracy: difficultyStats[diff].length > 0 ? 
              Math.round((difficultyStats[diff].filter(a => a.isCorrect).length / difficultyStats[diff].length) * 100) : 0,
            avg_time: difficultyStats[diff].length > 0 ?
              Math.round(difficultyStats[diff].reduce((sum, a) => sum + (a.timeSpent || 0), 0) / difficultyStats[diff].length) : 0
          })).filter(item => item.total > 0),
          
          article_performance: Object.keys(articleStats).map(artNum => ({
            article_number: artNum,
            article_id: articleStats[artNum].article_id,
            law_name: articleStats[artNum].law_name,
            total: articleStats[artNum].total,
            correct: articleStats[artNum].correct,
            accuracy: Math.round((articleStats[artNum].correct / articleStats[artNum].total) * 100),
            total_time: articleStats[artNum].time_spent,
            avg_time: Math.round(articleStats[artNum].time_spent / articleStats[artNum].total)
          })),
          
          time_analysis: {
            fastest_question: allAnswers.length > 0 ? Math.min(...allAnswers.map(a => a.timeSpent || 0)) : 0,
            slowest_question: allAnswers.length > 0 ? Math.max(...allAnswers.map(a => a.timeSpent || 0)) : 0,
            avg_correct_time: correctAnswers.length > 0 ? 
              Math.round(correctAnswers.reduce((sum, a) => sum + (a.timeSpent || 0), 0) / correctAnswers.length) : 0,
            avg_incorrect_time: incorrectAnswers.length > 0 ? 
              Math.round(incorrectAnswers.reduce((sum, a) => sum + (a.timeSpent || 0), 0) / incorrectAnswers.length) : 0,
            time_distribution: allAnswers.map(a => a.timeSpent || 0)
          },
          
          confidence_analysis: confidenceAnalysis,
          learning_patterns: learningPatterns,
          
          improvement_areas: incorrectAnswers.map(a => ({
            question_order: (a.questionIndex || 0) + 1,
            article_number: a.questionData?.article?.number || 'unknown',
            law_name: a.questionData?.article?.law_short_name || 'unknown',
            difficulty: a.questionData?.metadata?.difficulty || 'unknown',
            time_spent: a.timeSpent || 0,
            confidence: a.confidence || 'unknown',
            interactions: a.interactions || 1,
            priority: a.confidence === 'very_sure' ? 'high' : 
                     (a.timeSpent || 0) > avgTimePerQuestion * 1.5 ? 'medium' : 'low'
          })),
          
          session_metadata: {
            device_info: getDeviceInfo(),
            total_interactions: interactionEvents.length,
            session_quality: learningPatterns.interaction_efficiency > 80 ? 'excellent' :
                            learningPatterns.interaction_efficiency > 60 ? 'good' : 'needs_improvement'
          }
        }),
        
        performance_metrics: JSON.stringify({
          completion_rate: 100,
          engagement_score: Math.min(100, interactionEvents.length * 2),
          focus_score: learningPatterns.speed_consistency,
          confidence_calibration: learningPatterns.confidence_accuracy,
          learning_efficiency: Math.round((finalScore / allAnswers.length) * (100 / Math.max(1, totalTime / 60)))
        })
      })
      .eq('id', sessionId)

    if (error) {
      console.error('❌ Error completando test:', error)
      return { success: false, status: 'error' }
    }
    
    console.log('✅ Test completado con análisis completo')

    // 🆕 REGISTRAR EN USER_QUESTION_HISTORY (para estadísticas de artículos débiles)
    // Incluye preguntas no contestadas como falladas
    await registerQuestionsInHistory(userSession?.user_id, allAnswers, questions)

    // 🔥 ACTUALIZAR USER_PROGRESS - REPARADO CON MÉTODO DIRECTO
    await updateUserProgressDirect(userSession?.user_id, sessionId, finalScore, allAnswers.length)
    
    // Actualizar sesión de usuario (solo si tenemos el ID de la sesión)
    if (userSession?.id) {
      await supabase
        .from('user_sessions')
        .update({
          session_end: new Date().toISOString(),
          total_duration_minutes: Math.round(totalTime / 60),
          tests_completed: 1,
          questions_answered: allAnswers.length,
          questions_correct: finalScore,
          session_outcome: finalScore >= Math.ceil(questions.length * 0.7) ? 'successful' : 'needs_improvement',
          engagement_score: Math.min(100, Math.round((interactionEvents.length / allAnswers.length) * 10)),
          conversion_events: ['completed_test']
        })
        .eq('id', userSession.id)
    }
    
    return { success: true, status: 'saved' }
    
  } catch (error) {
    console.error('❌ Error completando test completo:', error)
    return { success: false, status: 'error' }
  }
}

// 🔧 FUNCIÓN REPARADA: Actualizar user_progress directamente (SIN RPC rota)
export const updateUserProgressDirect = async (userId, sessionId, correctAnswers, totalQuestions) => {
  if (!userId || !sessionId) {
    console.log('ℹ️ Saltando update user_progress - faltan datos básicos')
    return
  }

  try {
    console.log('🎯 Actualizando user_progress directamente...', { userId, sessionId, correctAnswers, totalQuestions })

    // 1. Obtener el tema del test desde la tabla tests
    const { data: testData, error: testError } = await supabase
      .from('tests')
      .select('tema_number, test_type')
      .eq('id', sessionId)
      .single()

    if (testError || !testData?.tema_number) {
      console.log('ℹ️ No se puede actualizar user_progress - no hay tema_number en el test')
      return
    }

    console.log('📊 Test encontrado:', { tema_number: testData.tema_number, test_type: testData.test_type })

    // 1.5 Obtener topic_id desde la tabla topics usando tema_number
    // Intentar con varios position_type posibles (mapeo URL -> DB)
    const positionTypesToTry = [
      'auxiliar_administrativo',      // DB usa este
      'auxiliar_administrativo_estado', // URL usa este
      'administrativo',
      'tramitacion_procesal',
      'auxilio_judicial'
    ]

    let topicData = null
    for (const posType of positionTypesToTry) {
      const { data, error } = await supabase
        .from('topics')
        .select('id')
        .eq('topic_number', testData.tema_number)
        .eq('position_type', posType)
        .single()

      if (!error && data?.id) {
        topicData = data
        console.log('📊 Topic encontrado con position_type:', posType)
        break
      }
    }

    if (!topicData?.id) {
      console.log('ℹ️ No se puede actualizar user_progress - no se encontró topic_id para tema_number:', testData.tema_number)
      return
    }

    const topicId = topicData.id
    console.log('📊 Topic encontrado:', { topic_id: topicId, tema_number: testData.tema_number })

    // 2. Verificar si ya existe registro de user_progress para este usuario y tema
    const { data: existingProgress, error: checkError } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('topic_id', topicId)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Error verificando user_progress existente:', checkError)
      return
    }

    const accuracy = Math.round((correctAnswers / totalQuestions) * 100)
    const now = new Date().toISOString()

    if (existingProgress) {
      // 3A. Actualizar registro existente
      const newTotalAttempts = existingProgress.total_attempts + totalQuestions
      const newCorrectAttempts = existingProgress.correct_attempts + correctAnswers
      const newAccuracy = Math.round((newCorrectAttempts / newTotalAttempts) * 100)

      const { error: updateError } = await supabase
        .from('user_progress')
        .update({
          total_attempts: newTotalAttempts,
          correct_attempts: newCorrectAttempts,
          accuracy_percentage: newAccuracy,
          last_attempt_date: now,
          updated_at: now,
          needs_review: newAccuracy < 70
        })
        .eq('user_id', userId)
        .eq('topic_id', topicId)

      if (updateError) {
        console.error('❌ Error actualizando user_progress:', updateError)
      } else {
        console.log(`✅ user_progress actualizado: ${newAccuracy}% (${newCorrectAttempts}/${newTotalAttempts})`)
      }

    } else {
      // 3B. Crear nuevo registro
      const { error: insertError } = await supabase
        .from('user_progress')
        .insert({
          user_id: userId,
          topic_id: topicId,
          total_attempts: totalQuestions,
          correct_attempts: correctAnswers,
          accuracy_percentage: accuracy,
          last_attempt_date: now,
          needs_review: accuracy < 70,
          created_at: now,
          updated_at: now
        })

      if (insertError) {
        console.error('❌ Error creando user_progress:', insertError)
      } else {
        console.log(`✅ user_progress creado: ${accuracy}% (${correctAnswers}/${totalQuestions})`)
      }
    }

  } catch (error) {
    console.error('❌ Error en updateUserProgressDirect:', error)
  }
}

// 🆕 FUNCIÓN: Registrar preguntas en user_question_history
// Registra TODAS las preguntas, incluyendo las no contestadas como falladas
export const registerQuestionsInHistory = async (userId, allAnswers, questions) => {
  if (!userId) {
    console.log('ℹ️ Saltando registro en history - no hay userId')
    return
  }

  try {
    console.log(`📊 [History] Registrando ${allAnswers.length} preguntas en user_question_history...`)

    let answeredCount = 0
    let unansweredCount = 0
    let updatedCount = 0
    let createdCount = 0

    for (const answer of allAnswers) {
      const questionId = answer.questionData?.id
      if (!questionId) continue

      // Determinar si fue contestada o no
      const wasAnswered = answer.selectedAnswer !== -1 && answer.selectedAnswer !== null
      const isCorrect = wasAnswered ? answer.isCorrect : false // No contestada = fallada

      if (wasAnswered) {
        answeredCount++
      } else {
        unansweredCount++
      }

      // Buscar registro existente
      const { data: existing, error: fetchError } = await supabase
        .from('user_question_history')
        .select('id, total_attempts, correct_attempts')
        .eq('user_id', userId)
        .eq('question_id', questionId)
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 = no rows returned (esperado si no existe)
        console.error(`❌ Error buscando history para ${questionId}:`, fetchError)
        continue
      }

      if (existing) {
        // Actualizar registro existente
        const newTotal = existing.total_attempts + 1
        const newCorrect = isCorrect ? existing.correct_attempts + 1 : existing.correct_attempts
        const successRate = newTotal > 0 ? (newCorrect / newTotal).toFixed(2) : '0.00'

        const { error: updateError } = await supabase
          .from('user_question_history')
          .update({
            total_attempts: newTotal,
            correct_attempts: newCorrect,
            success_rate: successRate,
            last_attempt_at: new Date().toISOString(),
          })
          .eq('id', existing.id)

        if (!updateError) updatedCount++
      } else {
        // Crear nuevo registro
        const { error: insertError } = await supabase
          .from('user_question_history')
          .insert({
            user_id: userId,
            question_id: questionId,
            total_attempts: 1,
            correct_attempts: isCorrect ? 1 : 0,
            success_rate: isCorrect ? '1.00' : '0.00',
            first_attempt_at: new Date().toISOString(),
            last_attempt_at: new Date().toISOString(),
          })

        if (!insertError) createdCount++
      }
    }

    console.log(`✅ [History] Registradas ${allAnswers.length} preguntas:`)
    console.log(`   - Contestadas: ${answeredCount}`)
    console.log(`   - No contestadas (registradas como falladas): ${unansweredCount}`)
    console.log(`   - Actualizadas: ${updatedCount}, Creadas: ${createdCount}`)

  } catch (error) {
    console.error('❌ Error en registerQuestionsInHistory:', error)
  }
}

// Función para formatear tiempo
export const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins === 0) return `${secs} segundo${secs !== 1 ? 's' : ''}`
  if (secs === 0) return `${mins} minuto${mins !== 1 ? 's' : ''}`
  return `${mins}m ${secs}s`
}