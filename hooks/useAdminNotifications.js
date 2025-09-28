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
      
      // Recargar más frecuentemente si hay elementos pendientes
      const hasAnyPending = notifications.feedback > 0 || notifications.impugnaciones > 0
      const intervalTime = hasAnyPending ? 15000 : 30000 // 15s si hay pendientes, 30s si no
      
      const interval = setInterval(loadPendingCounts, intervalTime)
      return () => clearInterval(interval)
    }
  }, [supabase, notifications.feedback, notifications.impugnaciones])

  const loadPendingCounts = async () => {
    try {
      console.log('🔔 Cargando notificaciones admin...')

      // Contar feedback pendiente - simplificado
      const { count: pendingFeedback, error: feedbackError } = await supabase
        .from('user_feedback')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      if (feedbackError) {
        console.warn('Error cargando feedback pendiente:', feedbackError)
      }

      // Contar impugnaciones pendientes
      const { count: pendingImpugnaciones, error: impugnacionesError } = await supabase
        .from('question_disputes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      if (impugnacionesError) {
        console.warn('Error cargando impugnaciones pendientes:', impugnacionesError)
      }

      setNotifications({
        feedback: pendingFeedback || 0,
        impugnaciones: pendingImpugnaciones || 0,
        loading: false
      })

      console.log('✅ Notificaciones actualizadas:', {
        feedback: pendingFeedback || 0,
        impugnaciones: pendingImpugnaciones || 0
      })

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