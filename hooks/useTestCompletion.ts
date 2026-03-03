// hooks/useTestCompletion.ts - HOOK PARA MANEJAR COMPLETION DE TESTS Y ACTUALIZAR PROGRESO
'use client'
import { useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTopicUnlock } from './useTopicUnlock'
import { useMedalChecker } from './useMedalChecker'

interface TestData {
  tema: number
  questions: any[]
  answers: any[]
  score: number
  totalTime: number
  testType?: string
}

// Lista de nombres de temas para personalización
const TOPIC_NAMES: Record<number, string> = {
  1: "La Constitución Española de 1978",
  2: "Los Derechos Fundamentales y Libertades Públicas", 
  3: "La Corona",
  4: "Las Cortes Generales",
  5: "El Gobierno y la Administración",
  6: "El Poder Judicial",
  7: "La Ley 19/2013 de Transparencia",
  8: "Personal al servicio de las Administraciones Públicas"
}

// Función para enviar email de desbloqueo personalizado
async function sendUnlockEmail(user: any, completedTopic: number, unlockedTopic: number, accuracy: number) {
  if (!user?.email) {
    console.log('❌ No se puede enviar email: usuario sin email')
    return
  }

  try {
    const response = await fetch('/api/send-unlock-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userEmail: user.email,
        userName: user.user_metadata?.full_name || user.user_metadata?.name || 'Estudiante',
        completedTopic,
        completedTopicName: TOPIC_NAMES[completedTopic] || `Tema ${completedTopic}`,
        unlockedTopic,
        unlockedTopicName: TOPIC_NAMES[unlockedTopic] || `Tema ${unlockedTopic}`,
        accuracy: Math.round(accuracy),
        userId: user.id
      })
    })

    if (response.ok) {
      console.log('✅ Email de desbloqueo enviado correctamente')
    } else {
      const errorText = await response.text()
      console.error('❌ Error enviando email de desbloqueo:', errorText)
    }
  } catch (error) {
    console.error('❌ Error en sendUnlockEmail:', error)
  }
}

export function useTestCompletion() {
  const { user, supabase } = useAuth() as any
  const { updateTopicProgress } = useTopicUnlock()
  const { checkMedalsAfterTest } = useMedalChecker()

  // Función para auto-descartar notificaciones resueltas después del test
  const autoDismissResolvedNotifications = useCallback(() => {
    try {
      console.log('🔔 Auto-descartando notificaciones resueltas por completar test...')
      
      // Obtener notificaciones descartadas del localStorage
      const getDismissedNotifications = () => {
        try {
          if (typeof window === 'undefined') return new Set()
          const stored = localStorage.getItem('dismissed_notifications')
          if (!stored) return new Set()
          
          const parsed = JSON.parse(stored)
          return new Set(parsed.notifications || [])
        } catch (error) {
          return new Set()
        }
      }

      // Guardar notificación como descartada
      const saveDismissedNotification = (notificationId: string) => {
        try {
          if (typeof window === 'undefined') return
          
          const dismissed = getDismissedNotifications()
          dismissed.add(notificationId)
          
          const data = {
            notifications: Array.from(dismissed),
            timestamp: Date.now()
          }
          
          localStorage.setItem('dismissed_notifications', JSON.stringify(data))
          console.log(`🗑️ Notificación ${notificationId} auto-descartada por completar test`)
        } catch (error) {
          console.warn('Error auto-descartando notificación:', error)
        }
      }

      // Auto-descartar notificaciones de racha rota (cualquier variante)
      const dismissed = getDismissedNotifications()
      let autoDismissed = 0
      
      // ✅ Auto-dismiss de notificaciones de inactividad eliminado - ya no se generan
      console.log(`✅ Auto-dismiss no necesario - notificaciones de inactividad eliminadas del sistema`)
      
    } catch (error) {
      console.warn('Error en auto-dismiss de notificaciones:', error)
    }
  }, [])

  // Función para manejar la completion de un test
  const handleTestCompletion = useCallback(async (testData: TestData) => {
    if (!user || !supabase) {
      console.log('No user or supabase for test completion')
      return
    }

    try {
      const {
        tema,
        questions,
        answers,
        score,
        totalTime,
        testType = 'normal'
      } = testData

      console.log(`🏁 Test completado: Tema ${tema}, Score: ${score}/${questions.length}`)

      // Calcular estadísticas del test
      const accuracy = (score / questions.length) * 100
      const avgTimePerQuestion = totalTime / questions.length

      // Guardar resultado del test en la tabla tests
      const testResult = {
        user_id: user.id,
        tema_number: tema,
        score: score,
        total_questions: questions.length,
        accuracy_percentage: Math.round(accuracy),
        time_spent_seconds: Math.round(totalTime / 1000),
        test_type: testType,
        is_completed: true,
        completed_at: new Date().toISOString(),
        avg_time_per_question: Math.round(avgTimePerQuestion / 1000)
      }

      const { data: testInsert, error: testError } = await supabase
        .from('tests')
        .insert(testResult)
        .select('id')
        .single()

      if (testError) {
        console.error('Error saving test result:', testError)
        return
      }

      console.log(`✅ Test guardado con ID: ${testInsert.id}`)

      // 🏆 VERIFICAR MEDALLAS DE RANKING DESPUÉS DE COMPLETAR EL TEST
      try {
        console.log('🏆 Verificando medallas de ranking...')
        const newMedals = await checkMedalsAfterTest()
        if (newMedals && newMedals.length > 0) {
          console.log(`🎉 ¡${newMedals.length} nueva(s) medalla(s) conseguida(s)!`, newMedals.map((m: any) => m.title))
        }
      } catch (medalError) {
        console.error('❌ Error verificando medallas:', medalError)
      }

      // 🔔 Auto-descartar notificaciones resueltas (racha rota, inactividad, etc.)
      try {
        autoDismissResolvedNotifications()
      } catch (dismissError) {
        console.warn('❌ Error auto-descartando notificaciones:', dismissError)
      }

      // Actualizar progreso de desbloqueo
      if (tema && typeof tema === 'number') {
        console.log(`🔄 Actualizando progreso de desbloqueo para tema ${tema}`)
        await updateTopicProgress()
        
        // Si el usuario alcanzó el threshold, mostrar notificación de desbloqueo
        if (accuracy >= 70 && questions.length >= 10) {
          console.log(`🎉 Tema ${tema} completado con ${accuracy}% - Siguiente tema desbloqueado`)
          
          // Intentar notificación push primero
          let pushSent = false
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(`🎉 ¡Tema ${tema + 1} Desbloqueado!`, {
                body: `Completaste el Tema ${tema} con ${Math.round(accuracy)}% de precisión`,
                icon: '/icon-192.png',
                tag: `topic-unlock-${tema + 1}`
              })
              pushSent = true
              console.log('✅ Notificación push enviada correctamente')
            } catch (error) {
              console.log('❌ Error enviando notificación push:', error)
            }
          }
          
          // Si no se pudo enviar push, enviar email de fallback
          if (!pushSent) {
            console.log('📧 Push no disponible, enviando email de desbloqueo...')
            try {
              await sendUnlockEmail(user, tema, tema + 1, accuracy)
            } catch (emailError) {
              console.error('❌ Error enviando email de desbloqueo:', emailError)
            }
          }
        }
      }

      return {
        success: true,
        testId: testInsert.id,
        accuracy,
        nextTopicUnlocked: accuracy >= 70 && questions.length >= 10
      }

    } catch (error: any) {
      console.error('Error in handleTestCompletion:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }, [user, supabase, updateTopicProgress, checkMedalsAfterTest])

  // Función simplificada para tests que ya tienen la lógica de guardado
  const notifyTestCompletion = useCallback(async (tema?: number, accuracy?: number, questionCount?: number) => {
    if (!user || !tema || accuracy == null || questionCount == null) return

    console.log(`📊 Notificando completion: Tema ${tema}, ${accuracy}% accuracy`)

    try {
      // 🏆 VERIFICAR MEDALLAS DE RANKING
      try {
        console.log('🏆 Verificando medallas de ranking (notify)...')
        const newMedals = await checkMedalsAfterTest()
        if (newMedals && newMedals.length > 0) {
          console.log(`🎉 ¡${newMedals.length} nueva(s) medalla(s) conseguida(s)!`, newMedals.map((m: any) => m.title))
        }
      } catch (medalError) {
        console.error('❌ Error verificando medallas:', medalError)
      }

      // 🔔 Auto-descartar notificaciones resueltas (racha rota, inactividad, etc.)
      try {
        autoDismissResolvedNotifications()
      } catch (dismissError) {
        console.warn('❌ Error auto-descartando notificaciones:', dismissError)
      }

      // Solo actualizar progreso de desbloqueo
      await updateTopicProgress()

      // Mostrar notificación si se desbloqueó el siguiente tema
      if (accuracy >= 70 && questionCount >= 10) {
        console.log(`🎉 Tema ${tema} completado - Siguiente tema desbloqueado`)
        
        // Intentar notificación push primero
        let pushSent = false
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(`🎉 ¡Tema ${tema + 1} Desbloqueado!`, {
              body: `Completaste el Tema ${tema} con ${Math.round(accuracy)}% de precisión`,
              icon: '/icon-192.png',
              tag: `topic-unlock-${tema + 1}`
            })
            pushSent = true
            console.log('✅ Notificación push enviada correctamente')
          } catch (error) {
            console.log('❌ Error enviando notificación push:', error)
          }
        }
        
        // Si no se pudo enviar push, enviar email de fallback
        if (!pushSent) {
          console.log('📧 Push no disponible, enviando email de desbloqueo...')
          try {
            await sendUnlockEmail(user, tema, tema + 1, accuracy)
          } catch (emailError) {
            console.error('❌ Error enviando email de desbloqueo:', emailError)
          }
        }
      }

      return { success: true, nextTopicUnlocked: accuracy >= 70 && questionCount >= 10 }
    } catch (error: any) {
      console.error('Error in notifyTestCompletion:', error)
      return { success: false, error: error.message }
    }
  }, [user, updateTopicProgress, checkMedalsAfterTest])

  return {
    handleTestCompletion,
    notifyTestCompletion
  }
}