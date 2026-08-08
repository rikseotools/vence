// hooks/useSupportUnreadBadge.ts
// [T-378] Badge del botón 💬 Soporte del Header. Server-driven: el backend cuenta las
// respuestas de soporte sin leer (`/api/support/unread-badge`, feedback + impugnaciones);
// quién decide qué se pinta es el núcleo puro `estadoBadgeSoporte` — aquí no hay reglas.
// Mismo patrón que `useReferralEarningsBadge` (icono 🎁).
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getAuthHeaders } from '../lib/api/authHeaders'
import { estadoBadgeSoporte } from '../lib/support/badgeSoporte'

export function useSupportUnreadBadge() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { user } = useAuth() as any
  const [unread, setUnread] = useState(0)

  const check = useCallback(async () => {
    if (!user?.id) { setUnread(0); return }
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/support/unread-badge', { headers })
      if (!res.ok) { setUnread(0); return }
      const data = await res.json()
      setUnread(Number(data?.unread || 0))
    } catch {
      setUnread(0)
    }
  }, [user?.id])

  useEffect(() => { check() }, [check])

  return {
    unread,
    badge: estadoBadgeSoporte(unread),
    refresh: check,
  }
}
