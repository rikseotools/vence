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

      // 🔧 USAR MISMA LÓGICA QUE LA PÁGINA DE TEST QUE FUNCIONA
      // Cargar respuestas del usuario agrupadas por tema (igual que test page)
      const { data: responses, error } = await supabase
        .from('test_questions')
        .select(`
          tema_number,
          is_correct,
          created_at,
          tests!inner(user_id)
        `)
        .eq('tests.user_id', user.id)

      if (error) {
        console.error('Error loading user progress:', error)
        setUnlockedTopics(new Set([1]))
        setTopicProgress({})
        return
      }

      // Procesar estadísticas por tema (igual que test page)
      const themeStats = {}
      
      if (responses && responses.length > 0) {
        responses.forEach(response => {
          const theme = response.tema_number
          if (!theme) return

          if (!themeStats[theme]) {
            themeStats[theme] = { 
              total: 0, 
              correct: 0, 
              lastStudy: null 
            }
          }
          
          themeStats[theme].total++
          if (response.is_correct) {
            themeStats[theme].correct++
          }
          
          // Actualizar última fecha de estudio
          const studyDate = new Date(response.created_at)
          if (!themeStats[theme].lastStudy || studyDate > themeStats[theme].lastStudy) {
            themeStats[theme].lastStudy = studyDate
          }
        })
      }

      // Procesar progreso por tema
      const progress = {}
      const unlockedSet = new Set([1]) // Tema 1 siempre desbloqueado

      Object.keys(themeStats).forEach(theme => {
        const stats = themeStats[theme]
        const temaNumber = parseInt(theme)
        const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
        const questionsAnswered = stats.total
        
        progress[temaNumber] = {
          accuracy,
          questionsAnswered,
          masteryLevel: accuracy >= 90 ? 'expert' : accuracy >= 70 ? 'good' : 'beginner',
          isUnlocked: temaNumber === 1 || accuracy >= UNLOCK_THRESHOLD,
          meetsThreshold: accuracy >= UNLOCK_THRESHOLD
        }

        // Si este tema cumple el threshold, desbloquear el siguiente
        if (accuracy >= UNLOCK_THRESHOLD && questionsAnswered >= 10) {
          unlockedSet.add(temaNumber)
          unlockedSet.add(temaNumber + 1) // Desbloquear siguiente tema
        }
      })

      // Asegurar progresión secuencial
      const finalUnlockedSet = new Set([1])
      for (let tema = 1; tema <= 28; tema++) {
        if (unlockedSet.has(tema)) {
          finalUnlockedSet.add(tema)
          // Solo desbloquear el siguiente si el actual cumple requisitos
          if (progress[tema]?.meetsThreshold && progress[tema]?.questionsAnswered >= 10) {
            finalUnlockedSet.add(tema + 1)
          }
        } else {
          break // Detener progresión si encontramos un tema no desbloqueado
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