// hooks/useTopicUnlock.js - SISTEMA DE DESBLOQUEO PROGRESIVO DE TEMAS
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

const UNLOCK_THRESHOLD = 70 // Porcentaje mínimo para desbloquear siguiente tema

export function useTopicUnlock() {
  const { user, supabase } = useAuth()
  const [unlockedTopics, setUnlockedTopics] = useState(new Set([1])) // Tema 1 siempre desbloqueado
  const [topicProgress, setTopicProgress] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user && supabase) {
      loadUserProgress()
    } else {
      // Usuario no logueado: solo tema 1 disponible
      setUnlockedTopics(new Set([1]))
      setTopicProgress({})
      setLoading(false)
    }
  }, [user, supabase])

  // Cargar progreso del usuario desde la base de datos
  const loadUserProgress = async () => {
    if (!user) return

    try {
      setLoading(true)

      // 🔥 USAR MISMA FUNCIÓN QUE LA PÁGINA DE TESTS - get_user_theme_stats
      const { data: themeStatsData, error } = await supabase
        .rpc('get_user_theme_stats', { p_user_id: user.id })

      if (error) {
        console.error('Error loading user theme stats:', error)
        setUnlockedTopics(new Set([1]))
        setTopicProgress({})
        return
      }

      console.log('🎯 Cargando progreso desde get_user_theme_stats:', themeStatsData?.length || 0, 'temas')

      // Procesar progreso por tema usando la misma lógica que la página de tests
      const progress = {}
      const unlockedSet = new Set([1]) // Tema 1 siempre desbloqueado

      if (themeStatsData && themeStatsData.length > 0) {
        themeStatsData.forEach(row => {
          const temaNumber = row.tema_number
          // CRÍTICO: tema_number es 0-indexed, donde 0 = Tema 1
          if (typeof temaNumber !== 'number') return
          
          // Convertir de 0-indexed a 1-indexed
          const actualTemaNumber = temaNumber + 1

          const accuracy = parseInt(row.accuracy) || 0
          const questionsAnswered = parseInt(row.total) || 0
          
          progress[actualTemaNumber] = {
            accuracy,
            questionsAnswered,
            masteryLevel: accuracy >= 90 ? 'expert' : accuracy >= 70 ? 'good' : 'beginner',
            isUnlocked: actualTemaNumber === 1 || accuracy >= UNLOCK_THRESHOLD,
            meetsThreshold: accuracy >= UNLOCK_THRESHOLD,
            lastStudy: row.last_study ? new Date(row.last_study) : null,
            needsReview: accuracy < UNLOCK_THRESHOLD
          }

          // Si este tema cumple el threshold, desbloquear el siguiente
          if (accuracy >= UNLOCK_THRESHOLD && questionsAnswered >= 10) {
            unlockedSet.add(actualTemaNumber)
            unlockedSet.add(actualTemaNumber + 1) // Desbloquear siguiente tema
          }
        })
      }

      // Asegurar progresión secuencial - CORREGIDA CON FLEXIBILIDAD AVANZADA
      const finalUnlockedSet = new Set([1]) // Tema 1 siempre desbloqueado
      
      for (let tema = 1; tema <= 28; tema++) {
        const currentProgress = progress[tema]
        
        // Un tema está desbloqueado si:
        // 1. Es el tema 1 (siempre desbloqueado)
        // 2. El tema anterior cumple requisitos completos (70% + 10 preguntas)
        // 3. NUEVO: Tiene progreso propio suficiente (permite saltar gaps)
        // 4. NUEVO: El usuario tiene buen progreso en temas anteriores (permite saltar 1 gap)
        if (tema === 1) {
          finalUnlockedSet.add(1)
        } else {
          const previousTopic = tema - 1
          const prevProgress = progress[previousTopic]
          
          // Método 1: Desbloqueo normal (tema anterior cumple requisitos)
          const normalUnlock = prevProgress?.meetsThreshold && prevProgress?.questionsAnswered >= 10
          
          // Método 2: NUEVO - Desbloqueo por progreso propio (para casos edge)
          const selfUnlock = currentProgress?.questionsAnswered >= 20 && currentProgress?.accuracy >= 75
          
          // Método 3: NUEVO - Desbloqueo flexible si usuario avanzó varios temas
          const skipUnlock = tema <= 6 && Object.keys(progress).some(t => parseInt(t) > tema && progress[t]?.meetsThreshold)
          
          // Método 4: NUEVO - Desbloqueo por gap único (máximo 1 gap permitido)
          const gapUnlock = tema <= 8 && (() => {
            // Verificar si hay buen progreso en los 2 temas anteriores al gap
            const twoBack = tema - 2
            const threeBack = tema - 3
            const twoBackProgress = progress[twoBack]
            const threeBackProgress = progress[threeBack]
            
            // Si hay un gap de 1 tema pero buen progreso antes y después
            const hasGoodProgressBefore = (twoBackProgress?.meetsThreshold && twoBackProgress?.questionsAnswered >= 10) ||
                                         (threeBackProgress?.meetsThreshold && threeBackProgress?.questionsAnswered >= 10)
            
            return hasGoodProgressBefore && (!prevProgress || prevProgress.questionsAnswered === 0)
          })()
          
          if (normalUnlock || selfUnlock || skipUnlock || gapUnlock) {
            finalUnlockedSet.add(tema)
          }
        }
      }

      setTopicProgress(progress)
      setUnlockedTopics(finalUnlockedSet)

    } catch (error) {
      console.error('Error in loadUserProgress:', error)
      setUnlockedTopics(new Set([1]))
      setTopicProgress({})
    } finally {
      setLoading(false)
    }
  }

  // Verificar si un tema está desbloqueado
  const isTopicUnlocked = (topicNumber) => {
    return unlockedTopics.has(topicNumber)
  }

  // Obtener el siguiente tema a desbloquear
  const getNextTopicToUnlock = () => {
    for (let tema = 1; tema <= 28; tema++) {
      if (!unlockedTopics.has(tema)) {
        return tema
      }
    }
    return null // Todos los temas desbloqueados
  }

  // Obtener progreso de un tema específico
  const getTopicProgress = (topicNumber) => {
    return topicProgress[topicNumber] || {
      accuracy: 0,
      questionsAnswered: 0,
      masteryLevel: null,
      isUnlocked: topicNumber === 1,
      meetsThreshold: false
    }
  }

  // Verificar requisitos para desbloquear siguiente tema
  const getUnlockRequirements = (topicNumber) => {
    const progress = getTopicProgress(topicNumber)
    const isCurrentlyUnlocked = isTopicUnlocked(topicNumber)
    const nextTopic = topicNumber + 1
    const isNextUnlocked = isTopicUnlocked(nextTopic)

    return {
      currentTopic: topicNumber,
      nextTopic,
      isCurrentUnlocked: isCurrentlyUnlocked,
      isNextUnlocked: isNextUnlocked,
      currentAccuracy: progress.accuracy,
      questionsAnswered: progress.questionsAnswered,
      requiredAccuracy: UNLOCK_THRESHOLD,
      requiredQuestions: 10,
      canUnlockNext: progress.accuracy >= UNLOCK_THRESHOLD && progress.questionsAnswered >= 10,
      progressToUnlock: Math.min(100, (progress.accuracy / UNLOCK_THRESHOLD) * 100),
      questionsNeeded: Math.max(0, 10 - progress.questionsAnswered)
    }
  }

  // Actualizar progreso cuando el usuario complete tests
  const updateTopicProgress = async (topicNumber) => {
    if (!user) return

    // Recargar progreso desde la base de datos
    await loadUserProgress()
  }

  // Obtener mensaje de desbloqueo
  const getUnlockMessage = (topicNumber) => {
    const requirements = getUnlockRequirements(topicNumber)
    
    if (requirements.isNextUnlocked) {
      return {
        type: 'success',
        message: `¡Tema ${requirements.nextTopic} desbloqueado!`,
        icon: '🎉'
      }
    }

    if (!requirements.isCurrentUnlocked) {
      return {
        type: 'locked',
        message: `Completa el Tema ${topicNumber - 1} con un 70% o más de precisión para desbloquear`,
        icon: '🔒'
      }
    }

    if (requirements.questionsNeeded > 0) {
      return {
        type: 'progress',
        message: `Responde ${requirements.questionsNeeded} preguntas más (${requirements.currentAccuracy}% actual)`,
        icon: '📊'
      }
    }

    if (requirements.currentAccuracy < UNLOCK_THRESHOLD) {
      return {
        type: 'progress',
        message: `Necesitas ${UNLOCK_THRESHOLD}% (actual: ${requirements.currentAccuracy}%)`,
        icon: '🎯'
      }
    }

    return {
      type: 'ready',
      message: 'Cumples los requisitos para desbloquear el siguiente tema',
      icon: '✅'
    }
  }

  return {
    // Estados
    unlockedTopics: Array.from(unlockedTopics).sort((a, b) => a - b),
    topicProgress,
    loading,

    // Funciones de verificación
    isTopicUnlocked,
    getTopicProgress,
    getUnlockRequirements,
    getNextTopicToUnlock,
    getUnlockMessage,

    // Funciones de actualización
    updateTopicProgress,
    refreshProgress: loadUserProgress,

    // Constantes
    UNLOCK_THRESHOLD
  }
}