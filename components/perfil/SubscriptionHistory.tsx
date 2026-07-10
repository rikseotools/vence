'use client'
// components/perfil/SubscriptionHistory.tsx
// Historial (hitos) de la suscripción del usuario en /perfil — lo ve para TODOS los estados
// (premium, cancelado o free), no solo con sub activa. Datos de /api/profile/subscription-history
// (identidad del token, solo tu propio historial). Si no hay hitos, no pinta nada.

import { useEffect, useState } from 'react'
import { getAuthHeaders } from '@/lib/api/authHeaders'

interface SubHistoryEvent { type: string; date: string; detail?: string }
interface History { isPremium: boolean; timeline: SubHistoryEvent[] }

function fmt(d: string): string {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

const LABEL: Record<string, (detail?: string) => string> = {
  became_premium: () => 'Te hiciste Premium',
  became_free: () => 'Tu plan volvió a Gratuito',
  cancelled: (d) => (d ? `Cancelaste la renovación (con acceso hasta el ${fmt(d)})` : 'Cancelaste la renovación'),
  reactivated: () => 'Reactivaste tu suscripción',
  cancelled_unpaid: () => 'Suscripción cancelada por falta de pago',
}
const ICON: Record<string, string> = {
  became_premium: '⭐', became_free: '↩️', cancelled: '⚠️', reactivated: '✅', cancelled_unpaid: '⚠️',
}

export default function SubscriptionHistory() {
  const [data, setData] = useState<History | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    let alive = true
    getAuthHeaders()
      .then((h) => fetch('/api/profile/subscription-history', { headers: h }))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (alive) setData(d) })
      .catch(() => { if (alive) setErr(true) })
    return () => { alive = false }
  }, [])

  // Sin datos o sin hitos → no ocupa espacio.
  if (err || !data || !Array.isArray(data.timeline) || data.timeline.length === 0) return null

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4">
      <h5 className="font-medium text-gray-800 dark:text-white mb-3 text-sm">Historial de tu suscripción</h5>
      <ul className="space-y-2.5">
        {data.timeline.map((e, i) => (
          <li key={`${e.type}-${e.date}-${i}`} className="flex items-start gap-3 text-sm">
            <span className="shrink-0" aria-hidden>{ICON[e.type] || '•'}</span>
            <span className="text-gray-500 dark:text-gray-400 shrink-0 w-24 tabular-nums">{fmt(e.date)}</span>
            <span className="text-gray-700 dark:text-gray-200">{(LABEL[e.type] || (() => e.type))(e.detail)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
