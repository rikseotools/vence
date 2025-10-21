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

      // 🔥 USAR USER_PROGRESS MIGRADA - MÁS EFICIENTE Y PRECISA
      const { data: userProgressData, error } = await supabase
        .from('user_progress')
        .select(`
          total_attempts,
          correct_attempts,
          accuracy_percentage,
          last_attempt_date,
          needs_review,
          topics!inner(topic_number, title)
        `)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error loading user progress:', error)
        setUnlockedTopics(new Set([1]))
        setTopicProgress({})
        return
      }

      console.log('🎯 Cargando progreso desde user_progress:', userProgressData)

      // Procesar progreso por tema usando datos migrados
      const progress = {}
      const unlockedSet = new Set([1]) // Tema 1 siempre desbloqueado

      if (userProgressData && userProgressData.length > 0) {
        userProgressData.forEach(record => {
          const temaNumber = record.topics.topic_number
          const accuracy = Math.round(record.accuracy_percentage || 0)
          const questionsAnswered = record.total_attempts || 0
          
          progress[temaNumber] = {
            accuracy,
            questionsAnswered,
            masteryLevel: accuracy >= 90 ? 'expert' : accuracy >= 70 ? 'good' : 'beginner',
            isUnlocked: temaNumber === 1 || accuracy >= UNLOCK_THRESHOLD,
            meetsThreshold: accuracy >= UNLOCK_THRESHOLD,
            lastStudy: record.last_attempt_date ? new Date(record.last_attempt_date) : null,
            needsReview: record.needs_review
          }

          // Si este tema cumple el threshold, desbloquear el siguiente
          if (accuracy >= UNLOCK_THRESHOLD && questionsAnswered >= 10) {
            unlockedSet.add(temaNumber)
            unlockedSet.add(temaNumber + 1) // Desbloquear siguiente tema
          }
        })
      }

      // Asegurar progresión secuencial - CORREGIDA
      const finalUnlockedSet = new Set([1]) // Tema 1 siempre desbloqueado
      
      for (let tema = 1; tema <= 28; tema++) {
        const currentProgress = progress[tema]
        
        // Un tema está desbloqueado si:
        // 1. Es el tema 1 (siempre desbloqueado)
        // 2. El tema anterior cumple requisitos completos (70% + 10 preguntas)
        if (tema === 1) {
          finalUnlockedSet.add(1)
        } else {
          const previousTopic = tema - 1
          const prevProgress = progress[previousTopic]
          
          // Desbloquear si el tema anterior cumple ambos requisitos
          if (prevProgress?.meetsThreshold && prevProgress?.questionsAnswered >= 10) {
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