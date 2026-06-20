// hooks/useAdminNotifications.ts - Hook para detectar elementos pendientes en admin
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { adminFetch } from '@/lib/api/adminFetch'

interface AdminNotificationState {
  feedback: number
  feedbackByType: { deletion: number; bug: number; email: number; other: number }
  impugnaciones: number
  impugnacionesByType: { legislativas: number; psicotecnicas: number }
  ventas: number
  ventasImporte: number
  calidad: number
  erroresApi: number
  rateLimitHits: number
  loading: boolean
}

const EMPTY_STATE: AdminNotificationState = {
  feedback: 0,
  feedbackByType: { deletion: 0, bug: 0, email: 0, other: 0 },
  impugnaciones: 0,
  impugnacionesByType: { legislativas: 0, psicotecnicas: 0 },
  ventas: 0,
  ventasImporte: 0,
  calidad: 0,
  rateLimitHits: 0,
  erroresApi: 0,
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

    const totalPending = notifications.feedback + notifications.impugnaciones + notifications.ventas + notifications.calidad + notifications.erroresApi

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
        // 1a. Feedbacks pending/in_progress (con conversaciones y tipo para badges)
        Promise.race([
          supabase
            .from('user_feedback')
            .select('id, type, feedback_conversations(id, status, feedback_messages(id, is_admin, created_at))')
            .in('status', ['pending', 'in_progress']),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 15000)
          )
        ]),
        // 1b. Conversaciones reabiertas: feedback ya resolved pero conversación no cerrada con último msg del usuario
        Promise.race([
          supabase
            .from('feedback_conversations')
            .select('id, status, feedback_id, feedback_messages(id, is_admin, created_at), user_feedback!inner(id, type, status)')
            .neq('status', 'closed')
            .eq('user_feedback.status', 'resolved'),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 15000)
          )
        ]),
        // 3. Obtener impugnaciones via API (usa SERVICE_ROLE para bypass RLS).
        // adminFetch inyecta el Bearer admin: la ruta /api/admin/* está guardada por
        // proxy.ts (guardAdminApi) y un fetch crudo devuelve 401 (regresión del badge
        // de impugnaciones tras el commit 2d67ab33; contrato: usar adminFetch, no fetch).
        Promise.race([
          adminFetch('/api/admin/pending-counts').then(r => r.json()),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 15000)
          )
        ]),
        // 4. Obtener ventas no leídas
        Promise.race([
          adminFetch('/api/v2/admin/unread-sales').then(r => r.json()),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 15000)
          )
        ]),
        // 5. Calidad de preguntas — desactivado del polling (tarda ~20s, solo se ejecuta en /admin/calidad)
        Promise.resolve({ success: true, totalIssues: 0, skipped: true }),
        // 6. Contar errores de validación API (últimas 24h) — via API (usa service role, bypass RLS)
        Promise.race([
          adminFetch('/api/v2/admin/validation-errors?timeRange=1&limit=1').then(r => r.json()),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 15000)
          )
        ]),
        // 7. Contar rate limit hits (últimas 24h) — indica posible scraping
        Promise.race([
          supabase
            .from('validation_error_logs')
            .select('id', { count: 'exact', head: true })
            .eq('error_type', 'rate_limit')
            .is('reviewed_at', null)
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 15000)
          )
        ])
      ])

      const [feedbacksResult, reopenedConvsResult, impugnacionesApiResult, salesResult, calidadResult, erroresApiResult, rateLimitResult] = results

      let pendingFeedback = 0
      const feedbackTypeCounts = { deletion: 0, bug: 0, email: 0, other: 0 }
      let pendingImpugnaciones = 0
      const impugnacionesTypeCounts = { legislativas: 0, psicotecnicas: 0 }
      let pendingVentas = 0
      let pendingCalidad = 0
      let pendingErroresApi = 0
      let pendingRateLimitHits = 0

      // Contar feedbacks pendientes y clasificar por tipo
      if (feedbacksResult.status === 'fulfilled') {
        const feedbacks = feedbacksResult.value.data || []
        feedbacks.forEach((fb: any) => {
          const conv = fb.feedback_conversations?.[0]
          let needsAttention = false

          if (!conv) {
            // Sin conversación = ticket nuevo sin responder
            needsAttention = true
          } else if (conv.status !== 'closed') {
            const msgs = conv.feedback_messages || []
            if (msgs.length === 0) {
              needsAttention = true
            } else {
              const sorted = msgs.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              if (sorted[0] && sorted[0].is_admin === false) {
                needsAttention = true
              }
            }
          }

          if (needsAttention) {
            pendingFeedback++
            if (fb.type === 'account_deletion') feedbackTypeCounts.deletion++
            else if (fb.type === 'bug') feedbackTypeCounts.bug++
            else if (fb.type === 'email') feedbackTypeCounts.email++
            else feedbackTypeCounts.other++
          }
        })
      } else {
        console.warn('Error cargando feedbacks:', feedbacksResult.reason?.message)
      }

      // Contar conversaciones reabiertas (feedback resolved pero conversación necesita atención)
      if (reopenedConvsResult.status === 'fulfilled') {
        const convs = reopenedConvsResult.value.data || []
        convs.forEach((conv: any) => {
          const msgs = conv.feedback_messages || []
          let needsAttention = false
          if (msgs.length === 0) {
            needsAttention = true
          } else {
            const sorted = msgs.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            if (sorted[0] && sorted[0].is_admin === false) {
              needsAttention = true
            }
          }
          if (needsAttention) {
            pendingFeedback++
            const fbType = conv.user_feedback?.type
            if (fbType === 'account_deletion') feedbackTypeCounts.deletion++
            else if (fbType === 'bug') feedbackTypeCounts.bug++
            else if (fbType === 'email') feedbackTypeCounts.email++
            else feedbackTypeCounts.other++
          }
        })
      }

      // Obtener conteo de impugnaciones desde la API (legislativas + psicotécnicas)
      if (impugnacionesApiResult.status === 'fulfilled') {
        const apiData = impugnacionesApiResult.value
        if (apiData.success) {
          pendingImpugnaciones = apiData.impugnaciones || 0
          impugnacionesTypeCounts.legislativas = apiData.detail?.normal || 0
          impugnacionesTypeCounts.psicotecnicas = apiData.detail?.psychometric || 0
        }
      }

      // Obtener ventas no leídas
      let ventasImporte = 0
      if (salesResult.status === 'fulfilled') {
        pendingVentas = salesResult.value.count || 0
        ventasImporte = salesResult.value.totalAmount || 0
      }

      // Obtener problemas de calidad
      if (calidadResult.status === 'fulfilled') {
        const calidadData = calidadResult.value
        if (calidadData.success) {
          pendingCalidad = calidadData.totalIssues || 0
        }
      }

      // Obtener errores de validación API no revisados (últimas 24h)
      if (erroresApiResult.status === 'fulfilled') {
        pendingErroresApi = erroresApiResult.value?.unreviewedCount ?? erroresApiResult.value?.summary?.totalErrors ?? 0
      }

      // Obtener rate limit hits no revisados (últimas 24h)
      if (rateLimitResult.status === 'fulfilled') {
        pendingRateLimitHits = (rateLimitResult.value as any)?.count ?? 0
      }

      setNotifications({
        feedback: pendingFeedback,
        feedbackByType: feedbackTypeCounts,
        impugnaciones: pendingImpugnaciones,
        impugnacionesByType: impugnacionesTypeCounts,
        ventas: pendingVentas,
        ventasImporte,
        calidad: pendingCalidad,
        erroresApi: pendingErroresApi,
        rateLimitHits: pendingRateLimitHits,
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

    // Retrasar 10s para no competir con el dashboard por conexiones del navegador.
    // En dev, Turbopack compila cada ruta API secuencialmente (~5s por ruta).
    // Si estos fetches se disparan antes de que /api/v2/admin/dashboard compile,
    // ocupan las 6 conexiones de Chrome y el dashboard queda en cola.
    const initialDelay = setTimeout(loadPendingCounts, 10000)

    const interval = setInterval(loadPendingCounts, 30000)

    return () => {
      clearTimeout(initialDelay)
      clearInterval(interval)
    }
  }, [supabase, enabled, loadPendingCounts])

  const markSalesRead = async () => {
    try {
      await adminFetch('/api/v2/admin/unread-sales', { method: 'POST' })
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
