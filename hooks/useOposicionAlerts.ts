// hooks/useOposicionAlerts.ts
// Fase 8 (8c): feed de la campana — avisos por hito verificado de las
// oposiciones que sigue el usuario. Fuente adicional para NotificationBell
// (se mergea como las disputas). Aislado para no acoplar el bell.

import { useState, useEffect, useCallback } from 'react'
import { getAuthHeaders } from '@/lib/api/authHeaders'
import type { Notification } from './useIntelligentNotifications.types'

interface AlertRow {
  id: string
  oposicionId: string
  hitoId: string
  titulo: string
  descripcion: string | null
  severity: string
  url: string | null
  readAt: string | null
  createdAt: string
}

// Notification + url de navegación (campo extra propio de este feed).
export type AlertNotification = Notification & { actionUrl?: string }

function mapToNotification(a: AlertRow): AlertNotification {
  const critical = a.severity === 'critical'
  return {
    id: `opo-alert-${a.id}`,
    type: 'oposicion_hito',
    title: a.titulo,
    message: a.descripcion || 'Novedad en tu oposición',
    timestamp: a.createdAt,
    isRead: a.readAt != null,
    priority: critical ? 90 : 60,
    icon: '🔔',
    color: 'blue',
    bgColor: 'bg-blue-100 dark:bg-blue-900/50',
    textColor: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-200 dark:border-blue-800',
    actionUrl: a.url || undefined,
  }
}

export function useOposicionAlerts(enabled: boolean) {
  const [notifications, setNotifications] = useState<AlertNotification[]>([])
  const [unreadCount, setUnreadCount] = useState<number>(0)

  const refresh = useCallback(async () => {
    if (!enabled) return
    try {
      // getAuthHeaders puede colgarse → race con timeout para no bloquear.
      const headers = await Promise.race<HeadersInit>([
        getAuthHeaders(),
        new Promise<HeadersInit>((r) => setTimeout(() => r({}), 4000)),
      ]).catch(() => ({} as HeadersInit))
      const res = await fetch('/api/notifications/oposicion-alerts', { headers })
      const json = await res.json().catch(() => ({}))
      if (json?.success && Array.isArray(json.data)) {
        setNotifications((json.data as AlertRow[]).map(mapToNotification))
        setUnreadCount(typeof json.unreadCount === 'number' ? json.unreadCount : 0)
      }
    } catch {
      // feed secundario: silencioso
    }
  }, [enabled])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Marca leído (id viene con prefijo 'opo-alert-'); optimista + persiste.
  const markAsRead = useCallback(async (notificationId: string) => {
    const rawId = notificationId.replace(/^opo-alert-/, '')
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)),
    )
    setUnreadCount((c) => Math.max(0, c - 1))
    try {
      await fetch('/api/notifications/oposicion-alerts', {
        method: 'PATCH',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [rawId] }),
      })
    } catch {
      // si falla, el optimista se corrige en el próximo refresh
    }
  }, [])

  return { notifications, unreadCount, markAsRead, refresh }
}
