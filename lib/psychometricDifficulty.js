// =====================================================
// UTILIDADES PARA DIFICULTAD ADAPTATIVA PSICOTÉCNICA
// =====================================================
// Sistema que diferencia dificultad global vs personal
// Solo primeras respuestas afectan dificultad global

/**
 * Obtener información de dificultad efectiva para una pregunta
 * @param {Object} supabase - Cliente de Supabase
 * @param {string} questionId - ID de la pregunta
 * @param {string} userId - ID del usuario (opcional)
 * @returns {Object} Información completa de dificultad
 */
export async function getDifficultyInfo(supabase, questionId, userId = null) {
  try {
    console.log('🎯 Getting difficulty info for question:', questionId)
    
    const { data, error } = await supabase
      .rpc('get_effective_psychometric_difficulty', {
        p_question_id: questionId,
        p_user_id: userId
      })
    
    if (error) {
      console.error('❌ Error getting difficulty info:', error)
      // Fallback: obtener dificultad base
      return await getFallbackDifficulty(supabase, questionId)
    }
    
    console.log('✅ Difficulty info:', data)
    return {
      questionId,
      baseDifficulty: data.base_difficulty,
      globalDifficulty: data.global_difficulty,
      personalDifficulty: data.personal_difficulty,
      sampleSize: data.sample_size,
      effectiveDifficulty: data.effective_difficulty,
      recommendation: data.recommendation,
      difficultyLevel: getDifficultyLevel(data.effective_difficulty),
      difficultyColor: getDifficultyColor(data.effective_difficulty),
      isAdaptive: data.global_difficulty !== null || data.personal_difficulty !== null
    }
  } catch (err) {
    console.error('❌ Error in getDifficultyInfo:', err)
    return await getFallbackDifficulty(supabase, questionId)
  }
}

/**
 * Obtener dificultad de fallback cuando el sistema adaptativo no funciona
 */
async function getFallbackDifficulty(supabase, questionId) {
  try {
    const { data, error } = await supabase
      .from('psychometric_questions')
      .select('difficulty')
      .eq('id', questionId)
      .single()
    
    if (error) throw error
    
    const numericDifficulty = convertBaseDifficultyToNumeric(data.difficulty)
    
    return {
      questionId,
      baseDifficulty: data.difficulty,
      globalDifficulty: null,
      personalDifficulty: null,
      sampleSize: 0,
      effectiveDifficulty: numericDifficulty,
      recommendation: 'fallback',
      difficultyLevel: getDifficultyLevel(numericDifficulty),
      difficultyColor: getDifficultyColor(numericDifficulty),
      isAdaptive: false
    }
  } catch (err) {
    console.error('❌ Error in fallback difficulty:', err)
    return {
      questionId,
      baseDifficulty: 'medium',
      effectiveDifficulty: 50.0,
      difficultyLevel: 'Medio',
      difficultyColor: 'text-yellow-600',
      isAdaptive: false
    }
  }
}

/**
 * Convertir dificultad base a numérica
 */
function convertBaseDifficultyToNumeric(baseDifficulty) {
  switch (baseDifficulty) {
    case 'easy': return 25.0
    case 'medium': return 50.0
    case 'hard': return 75.0
    default: return 50.0
  }
}

/**
 * Obtener nivel de dificultad en texto
 */
function getDifficultyLevel(numericDifficulty) {
  if (numericDifficulty < 30) return 'Fácil'
  if (numericDifficulty < 50) return 'Medio-Fácil'
  if (numericDifficulty < 70) return 'Medio'
  if (numericDifficulty < 85) return 'Difícil'
  return 'Muy Difícil'
}

/**
 * Obtener color CSS para mostrar dificultad
 */
function getDifficultyColor(numericDifficulty) {
  if (numericDifficulty < 30) return 'text-green-600'
  if (numericDifficulty < 50) return 'text-lime-600'
  if (numericDifficulty < 70) return 'text-yellow-600'
  if (numericDifficulty < 85) return 'text-orange-600'
  return 'text-red-600'
}

/**
 * Obtener icono para nivel de dificultad
 */
export function getDifficultyIcon(numericDifficulty) {
  if (numericDifficulty < 30) return '🟢'
  if (numericDifficulty < 50) return '🟡'
  if (numericDifficulty < 70) return '🟠'
  if (numericDifficulty < 85) return '🔴'
  return '🟣'
}

/**
 * Verificar si el usuario ya ha visto esta pregunta antes
 */
export async function isFirstAttempt(supabase, userId, questionId) {
  try {
    const { data, error } = await supabase
      .from('psychometric_first_attempts')
      .select('user_id')
      .eq('user_id', userId)
      .eq('question_id', questionId)
      .limit(1)
    
    if (error) {
      console.error('❌ Error checking first attempt:', error)
      return true // En caso de error, asumir primera vez
    }
    
    // Si no hay datos, es primera vez
    return !data || data.length === 0
  } catch (err) {
    console.error('❌ Error checking first attempt:', err)
    return true // En caso de error, asumir primera vez
  }
}

/**
 * Obtener estadísticas de dificultad para una pregunta
 */
export async function getQuestionDifficultyStats(supabase, questionId) {
  try {
    const { data, error } = await supabase
      .from('psychometric_questions')
      .select(`
        id,
        difficulty,
        global_difficulty,
        difficulty_sample_size,
        last_difficulty_update,
        estimated_time_seconds
      `)
      .eq('id', questionId)
      .single()
    
    if (error) throw error
    
    // Obtener estadísticas de primeras respuestas
    const { data: firstAttempts, error: attemptsError } = await supabase
      .from('psychometric_first_attempts')
      .select('is_correct, time_taken_seconds')
      .eq('question_id', questionId)
    
    let firstAttemptsStats = null
    if (!attemptsError && firstAttempts) {
      const totalAttempts = firstAttempts.length
      const correctAttempts = firstAttempts.filter(a => a.is_correct).length
      const avgTime = firstAttempts.reduce((sum, a) => sum + (a.time_taken_seconds || 0), 0) / totalAttempts
      
      firstAttemptsStats = {
        totalAttempts,
        correctAttempts,
        accuracy: totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0,
        avgTime: Math.round(avgTime),
        isStatisticallySignificant: totalAttempts >= 10
      }
    }
    
    return {
      ...data,
      firstAttemptsStats,
      difficultyEvolution: {
        baseDifficulty: convertBaseDifficultyToNumeric(data.difficulty),
        adaptiveDifficulty: data.global_difficulty,
        hasEvolved: data.global_difficulty !== null && Math.abs(data.global_difficulty - convertBaseDifficultyToNumeric(data.difficulty)) > 10
      }
    }
  } catch (err) {
    console.error('❌ Error getting difficulty stats:', err)
    return null
  }
}

/**
 * Formatear información de dificultad para mostrar al usuario
 */
export function formatDifficultyDisplay(difficultyInfo) {
  const { effectiveDifficulty, isAdaptive, sampleSize, recommendation } = difficultyInfo
  
  let displayText = `${getDifficultyLevel(effectiveDifficulty)} (${Math.round(effectiveDifficulty)}/100)`
  
  if (isAdaptive && sampleSize > 0) {
    displayText += ` • Adaptativa (${sampleSize} respuestas)`
  } else {
    displayText += ` • Base`
  }
  
  let tooltip = ''
  switch (recommendation) {
    case 'increase_difficulty':
      tooltip = 'Esta pregunta parece fácil para ti. El sistema podría sugerir preguntas más difíciles.'
      break
    case 'decrease_difficulty':
      tooltip = 'Esta pregunta parece difícil para ti. El sistema podría sugerir preguntas más fáciles.'
      break
    case 'need_more_data':
      tooltip = 'Se necesitan más respuestas para calcular la dificultad adaptativa.'
      break
    case 'optimal':
      tooltip = 'La dificultad parece apropiada para tu nivel.'
      break
    default:
      tooltip = 'Dificultad basada en la configuración original.'
  }
  
  return {
    displayText,
    tooltip,
    showAdaptiveBadge: isAdaptive,
    color: getDifficultyColor(effectiveDifficulty),
    icon: getDifficultyIcon(effectiveDifficulty)
  }
}

/**
 * Analizar si una pregunta necesita rebalanceo de dificultad
 */
export function analyzeDifficultyRebalance(stats) {
  if (!stats || !stats.firstAttemptsStats) return null
  
  const { firstAttemptsStats, difficulty, global_difficulty } = stats
  const { totalAttempts, accuracy, isStatisticallySignificant } = firstAttemptsStats
  
  if (!isStatisticallySignificant) {
    return {
      needsRebalance: false,
      reason: 'insufficient_data',
      message: `Necesita ${10 - totalAttempts} respuestas más para análisis confiable.`
    }
  }
  
  const baseDifficultyNumeric = convertBaseDifficultyToNumeric(difficulty)
  const adaptiveDifficulty = global_difficulty || baseDifficultyNumeric
  
  // Análisis de discrepancias
  const accuracyDiscrepancy = Math.abs(accuracy - 70) // 70% es el target ideal
  const difficultyDiscrepancy = Math.abs(adaptiveDifficulty - baseDifficultyNumeric)
  
  if (accuracyDiscrepancy > 20) {
    return {
      needsRebalance: true,
      reason: accuracy > 90 ? 'too_easy' : 'too_hard',
      message: accuracy > 90 
        ? `Pregunta muy fácil: ${accuracy.toFixed(1)}% de aciertos. Considerar aumentar dificultad.`
        : `Pregunta muy difícil: ${accuracy.toFixed(1)}% de aciertos. Considerar reducir dificultad.`,
      suggestedAction: accuracy > 90 ? 'increase_base_difficulty' : 'decrease_base_difficulty'
    }
  }
  
  if (difficultyDiscrepancy > 25) {
    return {
      needsRebalance: true,
      reason: 'evolved_significantly',
      message: `La dificultad ha evolucionado significativamente (${baseDifficultyNumeric}→${adaptiveDifficulty.toFixed(1)}). Considerar actualizar dificultad base.`,
      suggestedAction: 'update_base_difficulty'
    }
  }
  
  return {
    needsRebalance: false,
    reason: 'balanced',
    message: 'La dificultad está bien balanceada.'
  }
}