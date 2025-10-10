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
      return () => clearInterval(interval)
    }
  }, [supabase, notifications.feedback, notifications.impugnaciones])

  const loadPendingCounts = async () => {
    if (!supabase) {
      console.warn('⚠️ Supabase client no disponible')
      return
    }

    try {
      console.log('🔔 Cargando notificaciones admin...')

      // Usar Promise.allSettled para manejar errores independientemente
      const results = await Promise.allSettled([
        // Contar feedback pendiente con timeout
        Promise.race([
          supabase
            .from('user_feedback')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
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

      if (feedbackResult.status === 'fulfilled') {
        pendingFeedback = feedbackResult.value.count || 0
      } else {
        console.warn('Error cargando feedback pendiente:', feedbackResult.reason?.message)
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

      console.log('✅ Notificaciones actualizadas:', {
        feedback: pendingFeedback,
        impugnaciones: pendingImpugnaciones
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