// hooks/useAdminNotifications.js - Hook para detectar elementos pendientes en admin
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

export function useAdminNotifications() {
  const { supabase } = useAuth()
  const [notifications, setNotifications] = useState({
    feedback: 0,
    impugnaciones: 0,
    loading: true
  })

  useEffect(() => {
    if (supabase) {
      loadPendingCounts()
      
      // Recargar menos frecuentemente para evitar problemas de conexión
      const hasAnyPending = notifications.feedback > 0 || notifications.impugnaciones > 0
      const intervalTime = hasAnyPending ? 30000 : 60000 // 30s si hay pendientes, 60s si no
      
      const interval = setInterval(loadPendingCounts, intervalTime)
      
      // ✅ FIX: Eliminado listener de localStorage obsoleto
      // Ahora se usa el sistema de BD directamente
      
      return () => {
        clearInterval(interval)
      }
    }
  }, [supabase, notifications.feedback, notifications.impugnaciones])

  const loadPendingCounts = async () => {
    if (!supabase) {
      console.warn('⚠️ Supabase client no disponible')
      return
    }

    try {
      // Debug: console.log('🔔 Cargando notificaciones admin...')

      // Usar Promise.allSettled para manejar errores independientemente
      const results = await Promise.allSettled([
        // Contar conversaciones de feedback NO VISTAS directamente (FIX BUG)
        Promise.race([
          supabase
            .from('feedback_conversations')
            .select('id')
            .eq('status', 'waiting_admin')
            .is('admin_viewed_at', null), // Solo las NO vistas
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 10000)
          )
        ]),
        // Contar impugnaciones pendientes con timeout
        Promise.race([
          supabase
            .from('question_disputes')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 10000)
          )
        ])
      ])

      const [feedbackResult, impugnacionesResult] = results

      let pendingFeedback = 0
      let pendingImpugnaciones = 0

      // Procesar conversaciones de feedback (✅ FIX: ahora usa BD en lugar de localStorage)
      if (feedbackResult.status === 'fulfilled') {
        const unviewedConversations = feedbackResult.value.data || []
        pendingFeedback = unviewedConversations.length
        // Solo loguear si hay cambios significativos (más de 0)
        if (pendingFeedback > 0) {
          console.log(`🔔 Admin: ${pendingFeedback} conversaciones pendientes`)
        }
      } else {
        console.warn('Error cargando feedback pendiente:', feedbackResult.reason?.message)
        pendingFeedback = 0
      }

      if (impugnacionesResult.status === 'fulfilled') {
        pendingImpugnaciones = impugnacionesResult.value.count || 0
      } else {
        console.warn('Error cargando impugnaciones pendientes:', impugnacionesResult.reason?.message)
      }

      setNotifications({
        feedback: pendingFeedback,
        impugnaciones: pendingImpugnaciones,
        loading: false
      })

      // Debug: console.log('✅ Notificaciones admin actualizadas')

    } catch (error) {
      console.error('❌ Error cargando notificaciones admin:', error)
      setNotifications(prev => ({ ...prev, loading: false }))
    }
  }

  return {
    ...notifications,
    refresh: loadPendingCounts
  }
}