// hooks/useReferralEarningsBadge.ts
// Badge de "ganancias sin ver" del embajador para el icono 🎁 del Header.
// Server-driven: el backend cuenta los ingresos nuevos (referido/bug/ugc) sin ver (getUnseenEarningsCount).
// Se apaga cuando /embajadores marca visto y emite el evento 'referral-earnings-seen'.
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getAuthHeaders } from '../lib/api/authHeaders'

export function useReferralEarningsBadge() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { user } = useAuth() as any
  const [unseen, setUnseen] = useState(0)

  const check = useCallback(async () => {
    if (!user?.id) { setUnseen(0); return }
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/referrals/badge', { headers })
      if (!res.ok) { setUnseen(0); return }
      const data = await res.json()
      setUnseen(Number(data?.unseen || 0))
    } catch {
      setUnseen(0)
    }
  }, [user?.id])

  useEffect(() => { check() }, [check])

  // /embajadores marca visto → apaga el badge sin recargar.
  useEffect(() => {
    const onSeen = () => setUnseen(0)
    if (typeof window !== 'undefined') window.addEventListener('referral-earnings-seen', onSeen)
    return () => { if (typeof window !== 'undefined') window.removeEventListener('referral-earnings-seen', onSeen) }
  }, [])

  return { unseen, hasUnseen: unseen > 0, refresh: check }
}
