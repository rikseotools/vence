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
    
    const { error } = await supabase
      .from('tests')
      .update({
        score: finalScore,
        total_questions: questions.length, // 🐛 FIX: Actualizar total_questions con el valor real
        completed_at: new Date().toISOString(),
        is_completed: true,
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
    
    // 🔥 ACTUALIZAR USER_PROGRESS - FIX CRÍTICO PARA DESBLOQUEO DE TEMAS
    try {
      console.log('🎯 Actualizando progreso del usuario...')
      const { error: progressError } = await supabase
        .rpc('update_user_progress', {
          p_user_id: userSession?.user_id || null,
          p_test_id: sessionId
        })
      
      if (progressError) {
        console.error('❌ Error actualizando user_progress:', progressError)
        // No fallar todo el test por esto
      } else {
        console.log('✅ user_progress actualizado correctamente')
      }
    } catch (progressErr) {
      console.error('❌ Excepción actualizando user_progress:', progressErr)
    }
    
    // Actualizar sesión de usuario
    if (userSession) {
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

// Función para formatear tiempo
export const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins === 0) return `${secs} segundo${secs !== 1 ? 's' : ''}`
  if (secs === 0) return `${mins} minuto${mins !== 1 ? 's' : ''}`
  return `${mins}m ${secs}s`
}