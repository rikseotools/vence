// hooks/useDisputeNotifications.js
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

export function useDisputeNotifications() {
  const { user, supabase } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setNotifications([])
      setUnreadCount(0)
      setLoading(false)
      return
    }

    loadNotifications()
    
    // 🔄 REAL-TIME: Escuchar cambios en impugnaciones
    const subscription = supabase
      .channel('dispute-notifications')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'question_disputes',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        console.log('🔔 Impugnación actualizada:', payload)
        loadNotifications() // Recargar notificaciones
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [user, supabase])

  async function loadNotifications() {
    try {
      if (!user) return

      // Obtener impugnaciones resueltas/rechazadas recientes (últimos 30 días)
      // Solo mostrar notificaciones de los últimos 30 días (más relevante)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      
      const { data: disputes, error } = await supabase
        .from('question_disputes')
        .select(`
          id,
          dispute_type,
          status,
          resolved_at,
          admin_response,
          created_at,
          is_read,
          appeal_text,
          appeal_submitted_at,
          questions!inner (
            question_text,
            articles!inner (
              article_number,
              laws!inner (short_name)
            )
          )
        `)
        .eq('user_id', user.id)
        .in('status', ['resolved', 'rejected', 'appealed'])
        .gte('resolved_at', thirtyDaysAgo)
        .eq('is_read', false) // 🆕 Solo mostrar notificaciones NO leídas
        .order('resolved_at', { ascending: false })

      if (error) throw error

      const notifications = disputes?.map(dispute => ({
        id: dispute.id,
        type: 'dispute_update',
        title: dispute.status === 'resolved' ? '✅ Impugnación Respondida' : 
               dispute.status === 'appealed' ? '📝 Alegación Enviada' : '❌ Impugnación Respondida',
        message: `Tu reporte sobre ${dispute.questions.articles.laws.short_name} Art. ${dispute.questions.articles.article_number} ha sido ${
          dispute.status === 'resolved' ? 'aceptado' : 
          dispute.status === 'appealed' ? 'alegado - esperando revisión' : 'rechazado'
        }.`,
        timestamp: dispute.resolved_at,
        isRead: dispute.is_read || false,
        disputeId: dispute.id,
        status: dispute.status,
        article: `${dispute.questions.articles.laws.short_name} - Art. ${dispute.questions.articles.article_number}`,
        appealText: dispute.appeal_text,
        appealSubmittedAt: dispute.appeal_submitted_at,
        canAppeal: dispute.status === 'rejected' && !dispute.appeal_text
      })) || []

      setNotifications(notifications)
      setUnreadCount(notifications.filter(n => !n.isRead).length)

    } catch (error) {
      console.error('Error cargando notificaciones:', error)
    } finally {
      setLoading(false)
    }
  }

  // ✅ MARCAR UNA NOTIFICACIÓN ESPECÍFICA COMO LEÍDA
  const markAsRead = async (notificationId) => {
    try {
      if (!user) return

      console.log('🔍 Marcando como leída:', { notificationId, userId: user.id })

      const { error } = await supabase
        .from('question_disputes')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', user.id)

      if (error) {
        console.error('❌ Error en markAsRead:', error)
        throw error
      }

      // Actualizar estado local
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, isRead: true }
            : notification
        )
      )

      // Recalcular contador
      setUnreadCount(prev => Math.max(0, prev - 1))

      console.log('✅ Notificación marcada como leída:', notificationId)

    } catch (error) {
      console.error('Error marcando notificación como leída:', error)
    }
  }

  // ✅ MARCAR TODAS LAS NOTIFICACIONES COMO LEÍDAS
  const markAllAsRead = async () => {
    try {
      if (!user || unreadCount === 0) return

      const { error } = await supabase
        .from('question_disputes')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .in('status', ['resolved', 'rejected', 'appealed'])
        .eq('is_read', false)

      if (error) throw error

      // Actualizar estado local
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, isRead: true }))
      )

      // Resetear contador
      setUnreadCount(0)

      console.log('✅ Todas las notificaciones marcadas como leídas')

    } catch (error) {
      console.error('Error marcando todas las notificaciones como leídas:', error)
    }
  }

  // ✅ ENVIAR ALEGACIÓN PARA IMPUGNACIÓN RECHAZADA
  const submitAppeal = async (disputeId, appealText) => {
    try {
      if (!user || !appealText.trim()) return false

      const { error } = await supabase
        .from('question_disputes')
        .update({ 
          appeal_text: appealText.trim(),
          appeal_submitted_at: new Date().toISOString(),
          status: 'appealed' // Cambiar estado a 'appealed'
        })
        .eq('id', disputeId)
        .eq('user_id', user.id)
        .eq('status', 'rejected') // Solo permitir alegaciones de impugnaciones rechazadas

      if (error) throw error

      // Recargar notificaciones para actualizar la UI
      await loadNotifications()

      console.log('✅ Alegación enviada correctamente:', disputeId)
      return true

    } catch (error) {
      console.error('Error enviando alegación:', error)
      return false
    }
  }

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refreshNotifications: loadNotifications,
    submitAppeal
  }
}