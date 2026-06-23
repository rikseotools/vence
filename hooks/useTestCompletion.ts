// hooks/useTestCompletion.ts - HOOK PARA MANEJAR COMPLETION DE TESTS Y ACTUALIZAR PROGRESO
'use client'
import { useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTopicUnlock } from './useTopicUnlock'
import { useMedalChecker } from './useMedalChecker'

export function useTestCompletion() {
  const { user } = useAuth() as any
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

  // (handleTestCompletion eliminado 2026-06-23: dead code —0 callers vivos, solo
  //  TestLayout.notifyTestCompletion se usa; los tests se guardan por el endpoint
  //  v2 complete-test. Contenía un INSERT PostgREST a la tabla tests, no portable.)

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
    notifyTestCompletion
  }
}