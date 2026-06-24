// hooks/useAdminNotifications.ts - Hook para detectar elementos pendientes en admin
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
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
    if (!enabledRef.current) return

    const withTimeout = (p: Promise<unknown>) => Promise.race([
      p,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000)),
    ])

    try {
      // Usar Promise.allSettled para manejar errores independientemente.
      // Fase C1: feedback pendiente + rate-limit ya NO usan supabase de cliente;
      // los calcula server-side /api/v2/admin/pending-feedback-counts (requireAdmin).
      const results = await Promise.allSettled([
        // 1. Feedback pendiente (clasificado) + rate-limit hits — endpoint admin Drizzle
        withTimeout(adminFetch('/api/v2/admin/pending-feedback-counts').then(r => r.json())),
        // 2. Impugnaciones (legislativas + psicotécnicas) via API admin
        withTimeout(adminFetch('/api/admin/pending-counts').then(r => r.json())),
        // 3. Ventas no leídas
        withTimeout(adminFetch('/api/v2/admin/unread-sales').then(r => r.json())),
        // 4. Calidad de preguntas — desactivado del polling (solo en /admin/calidad)
        Promise.resolve({ success: true, totalIssues: 0, skipped: true }),
        // 5. Errores de validación API (últimas 24h)
        withTimeout(adminFetch('/api/v2/admin/validation-errors?timeRange=1&limit=1').then(r => r.json())),
      ])

      const [feedbackCountsResult, impugnacionesApiResult, salesResult, calidadResult, erroresApiResult] = results

      let pendingFeedback = 0
      let feedbackTypeCounts = { deletion: 0, bug: 0, email: 0, other: 0 }
      let pendingImpugnaciones = 0
      const impugnacionesTypeCounts = { legislativas: 0, psicotecnicas: 0 }
      let pendingVentas = 0
      let pendingCalidad = 0
      let pendingErroresApi = 0
      let pendingRateLimitHits = 0

      // Feedback pendiente + rate-limit (calculados server-side)
      if (feedbackCountsResult.status === 'fulfilled') {
        const fc = feedbackCountsResult.value as { pendingFeedback?: number; feedbackByType?: typeof feedbackTypeCounts; rateLimitHits?: number }
        pendingFeedback = fc.pendingFeedback || 0
        if (fc.feedbackByType) feedbackTypeCounts = fc.feedbackByType
        pendingRateLimitHits = fc.rateLimitHits || 0
      } else {
        console.warn('Error cargando feedback counts:', feedbackCountsResult.reason?.message)
      }

      // Obtener conteo de impugnaciones desde la API (legislativas + psicotécnicas)
      if (impugnacionesApiResult.status === 'fulfilled') {
        const apiData = impugnacionesApiResult.value as any
        if (apiData.success) {
          pendingImpugnaciones = apiData.impugnaciones || 0
          impugnacionesTypeCounts.legislativas = apiData.detail?.normal || 0
          impugnacionesTypeCounts.psicotecnicas = apiData.detail?.psychometric || 0
        }
      }

      // Obtener ventas no leídas
      let ventasImporte = 0
      if (salesResult.status === 'fulfilled') {
        const sales = salesResult.value as any
        pendingVentas = sales.count || 0
        ventasImporte = sales.totalAmount || 0
      }

      // Obtener problemas de calidad
      if (calidadResult.status === 'fulfilled') {
        const calidadData = calidadResult.value as any
        if (calidadData.success) {
          pendingCalidad = calidadData.totalIssues || 0
        }
      }

      // Obtener errores de validación API no revisados (últimas 24h)
      if (erroresApiResult.status === 'fulfilled') {
        const err = erroresApiResult.value as any
        pendingErroresApi = err?.unreviewedCount ?? err?.summary?.totalErrors ?? 0
      }

      // (rate-limit hits ya viene de feedbackCountsResult arriba)

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
  }, [])

  useEffect(() => {
    if (!enabled) {
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
  }, [enabled, loadPendingCounts])

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
