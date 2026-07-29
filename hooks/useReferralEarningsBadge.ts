// hooks/useReferralEarningsBadge.ts
// Estado del icono 🎁 del Header. Server-driven: el backend da los ingresos nuevos sin ver
// (getUnseenEarningsCount) y el SALDO (getUserOwedBalance, con sus holds y solicitudes ya restadas).
// Quién decide qué se pinta es el núcleo puro `estadoIconoRecompensas` — aquí no hay reglas.
// El punto de novedad se apaga cuando /recompensas marca visto y emite 'referral-earnings-seen'.
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getAuthHeaders } from '../lib/api/authHeaders'
import { estadoIconoRecompensas } from '../lib/referrals/logic'

export function useReferralEarningsBadge() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { user } = useAuth() as any
  const [unseen, setUnseen] = useState(0)
  const [balance, setBalance] = useState(0)

  const check = useCallback(async () => {
    if (!user?.id) { setUnseen(0); setBalance(0); return }
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/referrals/badge', { headers })
      if (!res.ok) { setUnseen(0); setBalance(0); return }
      const data = await res.json()
      setUnseen(Number(data?.unseen || 0))
      setBalance(Number(data?.balance || 0))
    } catch {
      setUnseen(0)
      setBalance(0)
    }
  }, [user?.id])

  useEffect(() => { check() }, [check])

  // /embajadores marca visto → apaga el badge sin recargar.
  useEffect(() => {
    const onSeen = () => setUnseen(0)
    if (typeof window !== 'undefined') window.addEventListener('referral-earnings-seen', onSeen)
    return () => { if (typeof window !== 'undefined') window.removeEventListener('referral-earnings-seen', onSeen) }
  }, [])

  // `hasUnseen` se mantiene por compatibilidad con quien ya lo consume; lo nuevo es `icono`.
  return {
    unseen,
    balance,
    hasUnseen: unseen > 0,
    icono: estadoIconoRecompensas({ balanceEur: balance, unseen }),
    refresh: check,
  }
}
