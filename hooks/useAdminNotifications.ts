// hooks/useAdminNotifications.ts - Hook para detectar elementos pendientes en admin
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'

interface AdminNotificationState {
  feedback: number
  impugnaciones: number
  ventas: number
  calidad: number
  loading: boolean
}

const EMPTY_STATE: AdminNotificationState = {
  feedback: 0,
  impugnaciones: 0,
  ventas: 0,
  calidad: 0,
  loading: false
}

/**
 * Hook para cargar conteos de notificaciones admin.
 * @param enabled - Solo ejecuta queries cuando es true (pasar isAdmin)
 */
export function useAdminNotifications(enabled = false) {
  const { supabase } = useAuth() as any
  const [notifications, setNotifications] = useState<AdminNotificationState>({
    ...EMPTY_STATE,
    loading: enabled
  })
  const originalTitle = useRef<string | null>(null)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  // Efecto para actualizar el título del tab
  useEffect(() => {
    if (typeof window === 'undefined' || !enabled) return

    // Guardar título original solo una vez
    if (originalTitle.current === null) {
      originalTitle.current = document.title || 'Vence Admin'
    }

    const totalPending = notifications.feedback + notifications.impugnaciones + notifications.ventas + notifications.calidad

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
  }, [notifications.feedback, notifications.impugnaciones, notifications.ventas, notifications.calidad, notifications.loading, enabled])

  const loadPendingCounts = useCallback(async () => {
    if (!supabase || !enabledRef.current) return

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
            setTimeout(() => reject(new Error('Timeout')), 8000)
          )
        ]),
        // 2. Contar feedbacks pending/in_progress sin conversación
        Promise.race([
          supabase
            .from('user_feedback')
            .select('id, feedback_conversations(id)')
            .in('status', ['pending', 'in_progress']),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 8000)
          )
        ]),
        // 3. Obtener impugnaciones via API (usa SERVICE_ROLE para bypass RLS)
        Promise.race([
          fetch('/api/admin/pending-counts').then(r => r.json()),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 8000)
          )
        ]),
        // 4. Obtener ventas no leídas
        Promise.race([
          fetch('/api/v2/admin/unread-sales').then(r => r.json()),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 8000)
          )
        ]),
        // 5. Obtener problemas de calidad de preguntas
        Promise.race([
          fetch('/api/admin/question-quality?count_only=true').then(r => r.json()),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 8000)
          )
        ])
      ])

      const [conversationsResult, feedbacksResult, impugnacionesApiResult, salesResult, calidadResult] = results

      let pendingFeedback = 0
      let pendingImpugnaciones = 0
      let pendingVentas = 0
      let pendingCalidad = 0

      // Contar conversaciones donde el último mensaje es del USUARIO (necesita respuesta del admin)
      if (conversationsResult.status === 'fulfilled') {
        const conversations = conversationsResult.value.data || []
        conversations.forEach((conv: any) => {
          const msgs = conv.feedback_messages || []

          if (msgs.length === 0) {
            pendingFeedback++
            return
          }

          const sorted = msgs.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          const lastMsg = sorted[0]
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

      // Obtener conteo de impugnaciones desde la API
      if (impugnacionesApiResult.status === 'fulfilled') {
        const apiData = impugnacionesApiResult.value
        if (apiData.success) {
          pendingImpugnaciones = apiData.impugnaciones || 0
        }
      }

      // Obtener ventas no leídas
      if (salesResult.status === 'fulfilled') {
        pendingVentas = salesResult.value.count || 0
      }

      // Obtener problemas de calidad
      if (calidadResult.status === 'fulfilled') {
        const calidadData = calidadResult.value
        if (calidadData.success) {
          pendingCalidad = calidadData.totalIssues || 0
        }
      }

      setNotifications({
        feedback: pendingFeedback,
        impugnaciones: pendingImpugnaciones,
        ventas: pendingVentas,
        calidad: pendingCalidad,
        loading: false
      })

    } catch (error) {
      console.error('❌ Error cargando notificaciones admin:', error)
      setNotifications(prev => ({ ...prev, loading: false }))
    }
  }, [supabase])

  useEffect(() => {
    if (!supabase || !enabled) {
      // Si no es admin, devolver estado vacío inmediatamente
      setNotifications(EMPTY_STATE)
      return
    }

    // Retrasar 3s para no competir con las APIs del dashboard por conexiones del navegador
    const initialDelay = setTimeout(loadPendingCounts, 3000)

    // Polling cada 30s (empieza después del delay inicial)
    const interval = setInterval(loadPendingCounts, 30000)

    return () => {
      clearTimeout(initialDelay)
      clearInterval(interval)
    }
  }, [supabase, enabled, loadPendingCounts])

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
