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
      
      // Listener para cambios en localStorage (cuando se marcan conversaciones como vistas)
      const handleStorageChange = (e) => {
        if (e.key === 'admin_viewed_conversations') {
          console.log('🔄 localStorage admin_viewed_conversations cambió, refrescando notificaciones...')
          loadPendingCounts()
        }
      }
      
      window.addEventListener('storage', handleStorageChange)
      
      return () => {
        clearInterval(interval)
        window.removeEventListener('storage', handleStorageChange)
      }
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
        // Contar conversaciones de feedback no vistas (usando el mismo sistema que Header)
        Promise.race([
          supabase
            .from('feedback_conversations')
            .select('id')
            .eq('status', 'waiting_admin'),
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

      // Procesar conversaciones de feedback (filtrar por localStorage igual que el Header)
      if (feedbackResult.status === 'fulfilled') {
        const conversaciones = feedbackResult.value.data || []
        
        try {
          // Aplicar el mismo filtro de localStorage que usa el Header
          const stored = localStorage.getItem('admin_viewed_conversations')
          if (stored && conversaciones.length > 0) {
            const viewedIds = new Set(JSON.parse(stored))
            const unviewedConversations = conversaciones.filter(conv => !viewedIds.has(conv.id))
            pendingFeedback = unviewedConversations.length
            console.log(`🔔 useAdminNotifications: ${conversaciones.length} total, ${viewedIds.size} vistas, ${pendingFeedback} pendientes`)
          } else {
            pendingFeedback = conversaciones.length
          }
        } catch (storageError) {
          console.warn('⚠️ Error leyendo localStorage en useAdminNotifications:', storageError)
          pendingFeedback = conversaciones.length
        }
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