// =====================================================
// SISTEMA DE SELECCIÓN ADAPTATIVA DE PREGUNTAS PSICOTÉCNICAS
// =====================================================
// Complementa el sistema de dificultad adaptativa con selección inteligente

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClientAny = any

interface PsychometricQuestionBase {
  id: string
  difficulty?: string
  [key: string]: unknown
}

interface QuestionWithDifficulty extends PsychometricQuestionBase {
  effectiveDifficulty: number
  isAdaptive?: boolean
}

interface CurrentPerformance {
  questionsAnswered: number
  correctAnswers: number
  incorrectStreak: number
}

interface PerformanceAnalysis {
  questionsAnswered: number
  correctAnswers: number
  accuracy: number
  incorrectStreak: number
  recentAccuracy: number
  needsIntervention: boolean
}

interface AdaptiveDecision {
  questionsAnswered: number
  accuracy: number
  incorrectStreak: number
  filterApplied: string
  questionsBeforeFilter: number
  questionsAfterFilter: number
  avgDifficultyBefore: number
  avgDifficultyAfter: number
}

interface AdaptiveRecommendation {
  type: string
  title: string
  message: string
  icon: string
  color: string
}

export async function selectAdaptiveQuestions(
  supabase: SupabaseClientAny,
  userId: string,
  sessionId: string,
  availableQuestions: PsychometricQuestionBase[],
  currentPerformance: CurrentPerformance | null
): Promise<PsychometricQuestionBase[]> {
  try {
    console.log('🎯 Selecting adaptive questions for user performance:', currentPerformance)

    // Verificar que currentPerformance existe antes de desestructurar
    if (!currentPerformance) {
      console.log('⚠️ No performance data available, using random selection')
      // NOTE: bug preexistente en JS — targetCount no está definido aquí
      return shuffleArray(availableQuestions)
    }

    const { questionsAnswered, correctAnswers, incorrectStreak } = currentPerformance

    // Fase 1: Primeras 2 preguntas sin filtro (establecer baseline)
    if (questionsAnswered < 2) {
      console.log('📊 Baseline phase: no difficulty filtering')
      // Aplicar priorización de no vistas incluso en baseline
      return await applyUnseenFirstPrioritization(supabase, userId, availableQuestions)
    }

    // Calcular métricas de rendimiento
    const accuracy = correctAnswers / questionsAnswered
    const needsEasierQuestions = accuracy < 0.6 || incorrectStreak >= 2
    // NO hacer preguntas más difíciles automáticamente

    console.log(`📈 Performance analysis:`, {
      accuracy: accuracy.toFixed(2),
      questionsAnswered,
      correctAnswers,
      incorrectStreak,
      needsEasierQuestions
    })

    // Obtener dificultades efectivas de todas las preguntas
    const questionsWithDifficulty: QuestionWithDifficulty[] = await Promise.all(
      availableQuestions.map(async (question) => {
        const { data: difficultyData, error } = await supabase
          .rpc('get_effective_psychometric_difficulty', {
            p_question_id: question.id,
            p_user_id: userId
          })

        if (error) {
          console.error('❌ Error getting difficulty for question:', question.id, error)
          // Fallback a dificultad base
          return {
            ...question,
            effectiveDifficulty: convertBaseDifficultyToNumeric(question.difficulty)
          }
        }

        return {
          ...question,
          effectiveDifficulty: difficultyData.effective_difficulty,
          isAdaptive: difficultyData.global_difficulty !== null
        }
      })
    )

    // Aplicar filtros adaptativos
    let filteredQuestions = questionsWithDifficulty

    if (needsEasierQuestions) {
      // Usuario con dificultades → preguntas fáciles
      filteredQuestions = questionsWithDifficulty.filter(q => q.effectiveDifficulty < 45)
      console.log(`🟢 Filtering to EASY questions: ${filteredQuestions.length}/${availableQuestions.length}`)

      if (filteredQuestions.length === 0) {
        // Si no hay preguntas fáciles, tomar las más fáciles disponibles
        filteredQuestions = questionsWithDifficulty
          .sort((a, b) => a.effectiveDifficulty - b.effectiveDifficulty)
          .slice(0, Math.ceil(questionsWithDifficulty.length * 0.4))
        console.log(`🟡 No easy questions found, using easiest 40%: ${filteredQuestions.length}`)
      }
    } else {
      // Usuario normal → todas las preguntas (sin filtrar por dificultad)
      filteredQuestions = questionsWithDifficulty
      console.log(`🔵 No filtering applied: ${filteredQuestions.length} questions available`)
    }

    // Registrar decisión adaptativa
    await logAdaptiveDecision(supabase, sessionId, {
      questionsAnswered,
      accuracy,
      incorrectStreak,
      filterApplied: needsEasierQuestions ? 'easy' : 'none',
      questionsBeforeFilter: availableQuestions.length,
      questionsAfterFilter: filteredQuestions.length,
      avgDifficultyBefore: calculateAverageDifficulty(questionsWithDifficulty),
      avgDifficultyAfter: calculateAverageDifficulty(filteredQuestions)
    })

    // Aplicar priorización de preguntas no vistas primero, luego más antiguas
    const finalQuestions = await applyUnseenFirstPrioritization(supabase, userId, filteredQuestions)

    return finalQuestions

  } catch (error) {
    console.error('❌ Error in adaptive question selection:', error)
    // Fallback: retornar preguntas originales con priorización básica
    try {
      return await applyUnseenFirstPrioritization(supabase, userId, availableQuestions)
    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError)
      return shuffleArray(availableQuestions)
    }
  }
}

function convertBaseDifficultyToNumeric(baseDifficulty: string | undefined): number {
  switch (baseDifficulty) {
    case 'easy': return 25.0
    case 'medium': return 50.0
    case 'hard': return 75.0
    default: return 50.0
  }
}

function calculateAverageDifficulty(questions: QuestionWithDifficulty[]): number {
  if (questions.length === 0) return 0
  const sum = questions.reduce((acc, q) => acc + q.effectiveDifficulty, 0)
  return Math.round(sum / questions.length)
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

async function logAdaptiveDecision(supabase: SupabaseClientAny, sessionId: string, decision: AdaptiveDecision): Promise<void> {
  try {
    await supabase
      .from('psychometric_adaptive_logs')
      .insert({
        session_id: sessionId,
        decision_type: 'question_selection',
        decision_data: decision,
        created_at: new Date().toISOString()
      })
  } catch (error) {
    console.error('❌ Error logging adaptive decision:', error)
    // No fallar por error de logging
  }
}

export async function analyzeCurrentPerformance(supabase: SupabaseClientAny, sessionId: string): Promise<PerformanceAnalysis> {
  try {
    const { data: answers, error } = await supabase
      .from('psychometric_test_answers')
      .select('is_correct, created_at')
      .eq('test_session_id', sessionId)
      .order('created_at', { ascending: true })

    if (error) throw error

    const questionsAnswered = answers.length
    const correctAnswers = answers.filter((a: { is_correct: boolean }) => a.is_correct).length

    // Calcular racha de incorrectas (desde el final)
    let incorrectStreak = 0
    for (let i = answers.length - 1; i >= 0; i--) {
      if (!answers[i].is_correct) {
        incorrectStreak++
      } else {
        break
      }
    }

    // Analizar tendencia reciente (últimas 3 respuestas)
    const recentAnswers = answers.slice(-3)
    const recentCorrect = recentAnswers.filter((a: { is_correct: boolean }) => a.is_correct).length
    const recentAccuracy = recentAnswers.length > 0 ? recentCorrect / recentAnswers.length : 0

    return {
      questionsAnswered,
      correctAnswers,
      accuracy: questionsAnswered > 0 ? correctAnswers / questionsAnswered : 0,
      incorrectStreak,
      recentAccuracy,
      needsIntervention: incorrectStreak >= 3 || (questionsAnswered >= 4 && correctAnswers / questionsAnswered < 0.4)
    }

  } catch (error) {
    console.error('❌ Error analyzing performance:', error)
    return {
      questionsAnswered: 0,
      correctAnswers: 0,
      accuracy: 0,
      incorrectStreak: 0,
      recentAccuracy: 0,
      needsIntervention: false
    }
  }
}

export function shouldApplyAdaptiveSelection(performance: PerformanceAnalysis): boolean {
  const { questionsAnswered, accuracy, incorrectStreak } = performance

  // Criterios para activar adaptación
  const hasEnoughData = questionsAnswered >= 2
  const isStruggling = accuracy < 0.6 || incorrectStreak >= 2
  const isAdvanced = accuracy > 0.8 && questionsAnswered >= 3
  const needsAdjustment = isStruggling || isAdvanced

  return hasEnoughData && needsAdjustment
}

export function generateAdaptiveRecommendation(performance: PerformanceAnalysis, filterApplied: string): AdaptiveRecommendation {
  if (filterApplied === 'easy') {
    return {
      type: 'support',
      title: 'Ajuste de Dificultad',
      message: 'Hemos ajustado las preguntas a un nivel más accesible para ayudarte a ganar confianza.',
      icon: '🎯',
      color: 'blue'
    }
  }

  return {
    type: 'balanced',
    title: 'Dificultad Equilibrada',
    message: 'Las preguntas están calibradas para tu nivel actual.',
    icon: '⚖️',
    color: 'yellow'
  }
}

async function applyUnseenFirstPrioritization<T extends PsychometricQuestionBase>(
  supabase: SupabaseClientAny,
  userId: string,
  availableQuestions: T[]
): Promise<T[]> {
  try {
    console.log('🧠 Aplicando priorización: no vistas primero, luego más antiguas')

    if (!userId) {
      console.log('📊 Sin usuario autenticado, usando orden aleatorio')
      return shuffleArray(availableQuestions)
    }

    // 1. Obtener historial de respuestas del usuario para preguntas psicotécnicas
    const { data: userAnswers, error: answersError } = await supabase
      .from('psychometric_test_answers')
      .select('question_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (answersError) {
      console.error('❌ Error obteniendo historial psicotécnico:', answersError)
      return shuffleArray(availableQuestions)
    }

    if (!userAnswers || userAnswers.length === 0) {
      console.log('📊 Sin historial psicotécnico, todas las preguntas son nuevas')
      return shuffleArray(availableQuestions)
    }

    // 2. Clasificar preguntas por prioridad
    const answeredQuestionIds = new Set<string>()
    const questionLastAnswered = new Map<string, Date>()

    userAnswers.forEach((answer: { question_id: string; created_at: string }) => {
      answeredQuestionIds.add(answer.question_id)
      const answerDate = new Date(answer.created_at)

      // Guardar la fecha más reciente para cada pregunta
      if (!questionLastAnswered.has(answer.question_id) ||
          answerDate > questionLastAnswered.get(answer.question_id)!) {
        questionLastAnswered.set(answer.question_id, answerDate)
      }
    })

    // 3. Separar preguntas por prioridad
    const neverSeenQuestions: T[] = []
    const answeredQuestions: (T & { _lastAnswered?: Date })[] = []

    availableQuestions.forEach(question => {
      if (answeredQuestionIds.has(question.id)) {
        // Pregunta ya respondida - agregar fecha para ordenamiento
        const withDate = { ...question, _lastAnswered: questionLastAnswered.get(question.id) }
        answeredQuestions.push(withDate)
      } else {
        // Pregunta nunca vista - máxima prioridad
        neverSeenQuestions.push(question)
      }
    })

    // 4. Ordenar preguntas respondidas por fecha (más antiguas primero)
    answeredQuestions.sort((a, b) => (a._lastAnswered?.getTime() || 0) - (b._lastAnswered?.getTime() || 0))

    console.log(`🎯 PRIORIZACIÓN PSICOTÉCNICA:`)
    console.log(`- Nunca vistas: ${neverSeenQuestions.length}`)
    console.log(`- Ya respondidas: ${answeredQuestions.length}`)

    // 5. Aplicar estrategia de priorización
    let finalQuestions: T[]

    if (neverSeenQuestions.length >= availableQuestions.length * 0.7) {
      // Si hay muchas preguntas nunca vistas, priorizar esas
      console.log('✅ Priorizando preguntas nunca vistas')
      finalQuestions = [
        ...shuffleArray(neverSeenQuestions),
        ...answeredQuestions
      ]
    } else {
      // Mezcla inteligente: nunca vistas primero, luego repaso espaciado
      console.log('✅ Distribución mixta: nunca vistas + repaso espaciado')
      finalQuestions = [
        ...shuffleArray(neverSeenQuestions),
        ...answeredQuestions // Ya ordenadas por antigüedad
      ]
    }

    // 6. Limpiar propiedades temporales
    finalQuestions.forEach(q => {
      delete (q as T & { _lastAnswered?: Date })._lastAnswered
    })

    console.log(`✅ Priorización completada: ${finalQuestions.length} preguntas ordenadas`)
    return finalQuestions

  } catch (error) {
    console.error('❌ Error en priorización de preguntas:', error)
    return shuffleArray(availableQuestions)
  }
}
