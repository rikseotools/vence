// hooks/useDisputeNotifications.ts
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { z } from 'zod'
import type { User, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'

// ============================================
// TIPOS E INTERFACES
// ============================================

// Tipo para el contexto de autenticación (AuthContext.js no está tipado)
interface AuthContextValue {
  user: User | null
  supabase: SupabaseClient
}

// Notificación de disputa/impugnación
export interface DisputeNotification {
  id: string
  type: 'dispute_update'
  isPsychometric: boolean
  title: string
  message: string
  timestamp: string
  isRead: boolean
  disputeId: string
  status: 'resolved' | 'rejected' | 'appealed' | string
  article: string
  appealText?: string | null
  appealSubmittedAt?: string | null
  canAppeal: boolean
}

// Retorno del hook
export interface UseDisputeNotificationsReturn {
  notifications: DisputeNotification[]
  unreadCount: number
  loading: boolean
  markAsRead: (notificationId: string, isPsychometric?: boolean) => Promise<void>
  markAllAsRead: () => Promise<void>
  refreshNotifications: () => Promise<void>
  submitAppeal: (disputeId: string, appealText: string) => Promise<boolean>
}

// ============================================
// SCHEMAS ZOD PARA VALIDACIÓN
// ============================================

// Schema para disputa normal de Supabase
const normalDisputeSchema = z.object({
  id: z.string().uuid(),
  dispute_type: z.string().nullable(),
  status: z.enum(['resolved', 'rejected', 'appealed', 'pending']),
  resolved_at: z.string().nullable(),
  admin_response: z.string().nullable(),
  created_at: z.string(),
  is_read: z.boolean().nullable(),
  appeal_text: z.string().nullable().optional(),
  appeal_submitted_at: z.string().nullable().optional(),
  questions: z.object({
    question_text: z.string().optional(),
    articles: z.object({
      article_number: z.string(),
      laws: z.object({
        short_name: z.string()
      })
    })
  })
})

// Schema para disputa psicotécnica de Supabase
const psychoDisputeSchema = z.object({
  id: z.string().uuid(),
  dispute_type: z.string().nullable(),
  status: z.enum(['resolved', 'rejected', 'pending']),
  resolved_at: z.string().nullable(),
  admin_response: z.string().nullable(),
  created_at: z.string(),
  is_read: z.boolean().nullable(),
  question_id: z.string().uuid().nullable()
})

// Arrays de schemas
const normalDisputesArraySchema = z.array(normalDisputeSchema)
const psychoDisputesArraySchema = z.array(psychoDisputeSchema)

// Tipos inferidos de Zod
type NormalDispute = z.infer<typeof normalDisputeSchema>
type PsychoDispute = z.infer<typeof psychoDisputeSchema>

// ============================================
// HOOK PRINCIPAL
// ============================================

export function useDisputeNotifications(): UseDisputeNotificationsReturn {
  const { user, supabase } = useAuth() as AuthContextValue
  const [notifications, setNotifications] = useState<DisputeNotification[]>([])
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    if (!user) {
      setNotifications([])
      setUnreadCount(0)
      setLoading(false)
      return
    }

    loadNotifications()

    // 🔄 REAL-TIME: Escuchar cambios en impugnaciones normales
    const subscription: RealtimeChannel = supabase
      .channel('dispute-notifications')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'question_disputes',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        console.log('🔔 Impugnación actualizada:', payload)
        loadNotifications()
      })
      // 🧠 REAL-TIME: Escuchar cambios en impugnaciones psicotécnicas
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'psychometric_question_disputes',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        console.log('🔔 Impugnación psicotécnica actualizada:', payload)
        loadNotifications()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [user, supabase])

  async function loadNotifications(): Promise<void> {
    try {
      if (!user) return

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      // 📚 Cargar impugnaciones de leyes (normales)
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
        .eq('is_read', false)
        .order('resolved_at', { ascending: false })

      if (error) throw error

      // Validar con Zod (soft validation - log pero no romper)
      let validatedDisputes: NormalDispute[] = []
      try {
        validatedDisputes = normalDisputesArraySchema.parse(disputes || [])
      } catch (zodError) {
        console.warn('⚠️ Zod validation warning for normal disputes:', zodError)
        // Fallback: usar datos sin validar
        validatedDisputes = (disputes || []) as unknown as NormalDispute[]
      }

      const normalNotifications: DisputeNotification[] = validatedDisputes.map(dispute => ({
        id: dispute.id,
        type: 'dispute_update' as const,
        isPsychometric: false,
        title: dispute.status === 'resolved' ? '✅ Impugnación Respondida' :
               dispute.status === 'appealed' ? '📝 Alegación Enviada' : '❌ Impugnación Respondida',
        message: `Tu reporte sobre ${dispute.questions.articles.laws.short_name} Art. ${dispute.questions.articles.article_number} ha sido ${
          dispute.status === 'resolved' ? 'aceptado' :
          dispute.status === 'appealed' ? 'alegado - esperando revisión' : 'rechazado'
        }.`,
        timestamp: dispute.resolved_at || dispute.created_at,
        isRead: dispute.is_read || false,
        disputeId: dispute.id,
        status: dispute.status,
        article: `${dispute.questions.articles.laws.short_name} - Art. ${dispute.questions.articles.article_number}`,
        appealText: dispute.appeal_text,
        appealSubmittedAt: dispute.appeal_submitted_at,
        canAppeal: dispute.status === 'rejected' && !dispute.appeal_text
      }))

      // 🧠 Cargar impugnaciones psicotécnicas
      const { data: psychoDisputes, error: psychoError } = await supabase
        .from('psychometric_question_disputes')
        .select(`
          id,
          dispute_type,
          status,
          resolved_at,
          admin_response,
          created_at,
          is_read,
          question_id
        `)
        .eq('user_id', user.id)
        .in('status', ['resolved', 'rejected'])
        .gte('resolved_at', thirtyDaysAgo)
        .eq('is_read', false)
        .order('resolved_at', { ascending: false })

      let psychoNotifications: DisputeNotification[] = []
      if (!psychoError && psychoDisputes?.length > 0) {
        // Validar con Zod (soft validation)
        let validatedPsychoDisputes: PsychoDispute[] = []
        try {
          validatedPsychoDisputes = psychoDisputesArraySchema.parse(psychoDisputes)
        } catch (zodError) {
          console.warn('⚠️ Zod validation warning for psycho disputes:', zodError)
          // Fallback: usar datos sin validar
          validatedPsychoDisputes = psychoDisputes as unknown as PsychoDispute[]
        }

        psychoNotifications = validatedPsychoDisputes.map(dispute => ({
          id: dispute.id,
          type: 'dispute_update' as const,
          isPsychometric: true,
          title: dispute.status === 'resolved' ? '✅ Impugnación Psicotécnica Respondida' : '❌ Impugnación Psicotécnica Respondida',
          message: `Tu reporte sobre una pregunta psicotécnica ha sido ${
            dispute.status === 'resolved' ? 'aceptado' : 'rechazado'
          }.`,
          timestamp: dispute.resolved_at || dispute.created_at,
          isRead: dispute.is_read || false,
          disputeId: dispute.id,
          status: dispute.status,
          article: '🧠 Psicotécnico',
          canAppeal: false
        }))
      }

      // Combinar y ordenar por fecha
      const allNotifications: DisputeNotification[] = [...normalNotifications, ...psychoNotifications]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      setNotifications(allNotifications)
      setUnreadCount(allNotifications.filter(n => !n.isRead).length)

    } catch (error) {
      console.error('Error cargando notificaciones:', error)
    } finally {
      setLoading(false)
    }
  }

  // ✅ MARCAR UNA NOTIFICACIÓN ESPECÍFICA COMO LEÍDA
  const markAsRead = async (notificationId: string, isPsychometric: boolean = false): Promise<void> => {
    try {
      if (!user) return

      console.log('🔍 Marcando como leída:', { notificationId, userId: user.id, isPsychometric })

      // Usar API con service role para bypasear RLS
      const response = await fetch('/api/dispute/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disputeId: notificationId,
          userId: user.id,
          isPsychometric
        })
      })

      const result = await response.json()

      if (!result.success) {
        console.error('❌ Error en markAsRead:', result.error)
        throw new Error(result.error)
      }

      // Actualizar estado local - QUITAR de la lista
      setNotifications(prev => prev.filter(notification => notification.id !== notificationId))

      // Recalcular contador
      setUnreadCount(prev => Math.max(0, prev - 1))

      console.log('✅ Notificación marcada como leída:', notificationId)

    } catch (error) {
      console.error('Error marcando notificación como leída:', error)
    }
  }

  // ✅ MARCAR TODAS LAS NOTIFICACIONES COMO LEÍDAS
  const markAllAsRead = async (): Promise<void> => {
    try {
      if (!user || unreadCount === 0) return

      // Marcar impugnaciones normales
      const { error: normalError } = await supabase
        .from('question_disputes')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .in('status', ['resolved', 'rejected', 'appealed'])
        .eq('is_read', false)

      if (normalError) console.error('Error en question_disputes:', normalError)

      // Marcar impugnaciones psicotécnicas
      const { error: psychoError } = await supabase
        .from('psychometric_question_disputes')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .in('status', ['resolved', 'rejected'])
        .eq('is_read', false)

      if (psychoError) console.error('Error en psychometric_question_disputes:', psychoError)

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
  const submitAppeal = async (disputeId: string, appealText: string): Promise<boolean> => {
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
