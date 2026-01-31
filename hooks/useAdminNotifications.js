// hooks/useAdminNotifications.js - Hook para detectar elementos pendientes en admin
'use client'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'

export function useAdminNotifications() {
  const { supabase } = useAuth()
  const [notifications, setNotifications] = useState({
    feedback: 0,
    impugnaciones: 0,
    loading: true
  })
  const originalTitle = useRef(null)

  // Efecto para actualizar el título del tab
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Guardar título original solo una vez
    if (originalTitle.current === null) {
      originalTitle.current = document.title || 'Vence Admin'
    }

    const totalPending = notifications.feedback + notifications.impugnaciones

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
  }, [notifications.feedback, notifications.impugnaciones, notifications.loading])

  useEffect(() => {
    if (supabase) {
      loadPendingCounts()

      // Recargar menos frecuentemente para evitar problemas de conexión
      const hasAnyPending = notifications.feedback > 0 || notifications.impugnaciones > 0
      const intervalTime = hasAnyPending ? 30000 : 60000 // 30s si hay pendientes, 60s si no

      const interval = setInterval(loadPendingCounts, intervalTime)

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
        // 3. Contar impugnaciones pendientes (normales)
        Promise.race([
          supabase
            .from('question_disputes')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 10000)
          )
        ]),
        // 4. Contar impugnaciones psicotécnicas pendientes
        Promise.race([
          supabase
            .from('psychometric_question_disputes')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 10000)
          )
        ])
      ])

      const [conversationsResult, feedbacksResult, impugnacionesResult, psychoImpugnacionesResult] = results

      let pendingFeedback = 0
      let pendingImpugnaciones = 0

      // Contar conversaciones donde el último mensaje es del USUARIO (necesita respuesta del admin)
      // También contar conversaciones sin mensajes (vacías) que no estén cerradas
      if (conversationsResult.status === 'fulfilled') {
        const conversations = conversationsResult.value.data || []
        conversations.forEach(conv => {
          const msgs = conv.feedback_messages || []

          // Conversación vacía no cerrada = necesita atención del admin
          if (msgs.length === 0) {
            pendingFeedback++
            return
          }

          // Ordenar por fecha descendente para obtener el último
          const sorted = msgs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
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
        feedbacks.forEach(fb => {
          const hasConversation = fb.feedback_conversations && fb.feedback_conversations.length > 0
          if (!hasConversation) {
            pendingFeedback++
          }
        })
      } else {
        console.warn('Error cargando feedbacks:', feedbacksResult.reason?.message)
      }

      if (impugnacionesResult.status === 'fulfilled') {
        pendingImpugnaciones += impugnacionesResult.value.count || 0
      } else {
        console.warn('Error cargando impugnaciones:', impugnacionesResult.reason?.message)
      }

      if (psychoImpugnacionesResult.status === 'fulfilled') {
        pendingImpugnaciones += psychoImpugnacionesResult.value.count || 0
      } else {
        console.warn('Error cargando impugnaciones psicotécnicas:', psychoImpugnacionesResult.reason?.message)
      }

      setNotifications({
        feedback: pendingFeedback,
        impugnaciones: pendingImpugnaciones,
        loading: false
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