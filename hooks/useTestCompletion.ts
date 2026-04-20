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

      // Actualizar progreso
      if (tema && typeof tema === 'number') {
        await updateTopicProgress()
      }

      return {
        success: true,
        testId: testInsert.id,
        accuracy
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

      // Actualizar progreso
      await updateTopicProgress()

      return { success: true }
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