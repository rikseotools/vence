// hooks/useAdminNotifications.ts - Hook para detectar elementos pendientes en admin
'use client'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'

interface AdminNotificationState {
  feedback: number
  impugnaciones: number
  ventas: number
  loading: boolean
}

export function useAdminNotifications() {
  const { supabase } = useAuth() as any
  const [notifications, setNotifications] = useState<AdminNotificationState>({
    feedback: 0,
    impugnaciones: 0,
    ventas: 0,
    loading: true
  })
  const originalTitle = useRef<string | null>(null)

  // Efecto para actualizar el título del tab
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Guardar título original solo una vez
    if (originalTitle.current === null) {
      originalTitle.current = document.title || 'Vence Admin'
    }

    const totalPending = notifications.feedback + notifications.impugnaciones + notifications.ventas

    if (totalPending > 0) {
      document.title = `(${totalPending}) ${originalTitle.current}`
    } else if (!notifications.loading) {
      document.title = originalTitle.current
    }

    return () => {
      // Restaurar título al desmontar
      if (originalTitle.current) {
        document.title = originalTitle.current
      }
    }
  }, [notifications.feedback, notifications.impugnaciones, notifications.ventas, notifications.loading])

  useEffect(() => {
    if (!supabase) return

    loadPendingCounts()

    // Polling fijo cada 30s - NO depender de notifications para evitar
    // ciclo de re-renders (loadPendingCounts actualiza notifications,
    // que re-dispararía este effect, causando stack overflow en iOS WebKit)
    const interval = setInterval(loadPendingCounts, 30000)

    return () => {
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  const loadPendingCounts = async () => {
    if (!supabase) {
      console.warn('⚠️ Supabase client no disponible')
      return
    }

    try {
      // Usar Promise.allSettled para manejar errores independientemente
      const results = await Promise.allSettled([
        // 1. Obtener conversaciones NO cerradas con sus mensajes para ver cuál necesita respuesta
        Promise.race([
          supabase
            .from('feedback_conversations')
            .select('id, status, feedback_messages(id, is_admin, created_at)')
            .neq('status', 'closed'),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 10000)
          )
        ]),
        // 2. Contar feedbacks pending/in_progress sin conversación
        Promise.race([
          supabase
            .from('user_feedback')
            .select('id, feedback_conversations(id)')
            .in('status', ['pending', 'in_progress']),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 10000)
          )
        ]),
        // 3. Obtener impugnaciones via API (usa SERVICE_ROLE para bypass RLS)
        // Esto incluye tanto normales como psicotécnicas
        Promise.race([
          fetch('/api/admin/pending-counts').then(r => r.json()),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 10000)
          )
        ]),
        // 4. Obtener ventas no leídas
        Promise.race([
          fetch('/api/v2/admin/unread-sales').then(r => r.json()),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 10000)
          )
        ])
      ])

      const [conversationsResult, feedbacksResult, impugnacionesApiResult, salesResult] = results

      let pendingFeedback = 0
      let pendingImpugnaciones = 0
      let pendingVentas = 0

      // Contar conversaciones donde el último mensaje es del USUARIO (necesita respuesta del admin)
      // También contar conversaciones sin mensajes (vacías) que no estén cerradas
      if (conversationsResult.status === 'fulfilled') {
        const conversations = conversationsResult.value.data || []
        conversations.forEach((conv: any) => {
          const msgs = conv.feedback_messages || []

          // Conversación vacía no cerrada = necesita atención del admin
          if (msgs.length === 0) {
            pendingFeedback++
            return
          }

          // Ordenar por fecha descendente para obtener el último
          const sorted = msgs.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          const lastMsg = sorted[0]
          // Si el último mensaje NO es del admin, necesita respuesta
          if (lastMsg && lastMsg.is_admin === false) {
            pendingFeedback++
          }
        })
      } else {
        console.warn('Error cargando conversaciones:', conversationsResult.reason?.message)
      }

      // Contar feedbacks sin conversación
      if (feedbacksResult.status === 'fulfilled') {
        const feedbacks = feedbacksResult.value.data || []
        feedbacks.forEach((fb: any) => {
          const hasConversation = fb.feedback_conversations && fb.feedback_conversations.length > 0
          if (!hasConversation) {
            pendingFeedback++
          }
        })
      } else {
        console.warn('Error cargando feedbacks:', feedbacksResult.reason?.message)
      }

      // Obtener conteo de impugnaciones desde la API (incluye normales + psicotécnicas)
      if (impugnacionesApiResult.status === 'fulfilled') {
        const apiData = impugnacionesApiResult.value
        if (apiData.success) {
          pendingImpugnaciones = apiData.impugnaciones || 0
        } else {
          console.warn('Error en API impugnaciones:', apiData.error)
        }
      } else {
        console.warn('Error cargando impugnaciones:', impugnacionesApiResult.reason?.message)
      }

      // Obtener ventas no leídas
      if (salesResult.status === 'fulfilled') {
        pendingVentas = salesResult.value.count || 0
      } else {
        console.warn('Error cargando ventas:', salesResult.reason?.message)
      }

      setNotifications({
        feedback: pendingFeedback,
        impugnaciones: pendingImpugnaciones,
        ventas: pendingVentas,
        loading: false
      })

    } catch (error) {
      console.error('❌ Error cargando notificaciones admin:', error)
      setNotifications(prev => ({ ...prev, loading: false }))
    }
  }

  const markSalesRead = async () => {
    try {
      await fetch('/api/v2/admin/unread-sales', { method: 'POST' })
      setNotifications(prev => ({ ...prev, ventas: 0 }))
    } catch (error) {
      console.warn('Error marcando ventas como leídas:', error)
    }
  }

  return {
    ...notifications,
    refresh: loadPendingCounts,
    markSalesRead
  }
}