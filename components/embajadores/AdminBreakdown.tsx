'use client'
// components/embajadores/AdminBreakdown.tsx
// Desglose ADMIN de un embajador: totales + línea de tiempo de TODAS sus
// recompensas (bug/opinión/referido/pago) con importe, estado, fecha y ASUNTO.
// Es la vista de CONTROL (distinta del panel "como lo ve el usuario"). Read-only.

import { useEffect, useState } from 'react'
import { adminFetch } from '@/lib/api/adminFetch'

interface Row { kind: 'bug' | 'ugc' | 'referral' | 'payout'; amount: number; status: string; date: string; asunto: string }
interface Totals { earned: number; paid: number; requested: number; byKind: Record<string, { count: number; amount: number }> }
interface Data { success: true; user: { name: string | null; email: string | null }; totals: Totals; rows: Row[] }

const KIND: Record<Row['kind'], { label: string; emoji: string; cls: string }> = {
  bug: { label: 'Bug', emoji: '🐞', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  ugc: { label: 'Opinión', emoji: '🧡', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  referral: { label: 'Referido', emoji: '💛', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
  payout: { label: 'Pago/Vale', emoji: '🎁', cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
}

function statusCls(kind: Row['kind'], status: string): string {
  if (kind === 'payout' && status === 'pending') return 'text-amber-600 dark:text-amber-400 font-semibold' // pidió el vale
  if (status === 'paid' || status === 'approved' || status === 'qualified') return 'text-green-600 dark:text-green-400'
  if (status === 'rejected' || status === 'expired') return 'text-red-500 dark:text-red-400'
  return 'text-gray-500 dark:text-gray-400'
}

export default function AdminBreakdown({ userId }: { userId: string }) {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    let alive = true
    adminFetch(`/api/admin/embajadores/${userId}/breakdown`)
      .then(async (res) => {
        if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `Error ${res.status}`) }
        return res.json()
      })
      .then((d) => { if (alive) setData(d) })
      .catch((err) => { if (alive) setError((err as Error).message) })
    return () => { alive = false }
  }, [userId])

  const card = 'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700'

  return (
    <div className={`${card} p-5 mb-6`}>
      <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">🔎 Desglose (admin)</h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Todas sus recompensas con su asunto, para tenerlo controlado.</p>

      {error ? <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        : !data ? <p className="text-gray-500 dark:text-gray-400 text-sm">Cargando…</p>
        : (
          <>
            <div className="flex flex-wrap gap-4 text-sm mb-4">
              <span><b className="text-gray-800 dark:text-gray-100">{data.totals.earned.toFixed(2)}€</b> <span className="text-gray-500">ganado</span></span>
              <span className="text-amber-600 dark:text-amber-400"><b>{data.totals.requested.toFixed(2)}€</b> solicitado (pidió vale)</span>
              <span><b className="text-green-600 dark:text-green-400">{data.totals.paid.toFixed(2)}€</b> <span className="text-gray-500">pagado</span></span>
            </div>

            {data.rows.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">Sin recompensas todavía.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="py-2 pr-3">Fecha</th>
                      <th className="py-2 pr-3">Tipo</th>
                      <th className="py-2 pr-3 text-right">Importe</th>
                      <th className="py-2 pr-3">Estado</th>
                      <th className="py-2">Asunto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r, i) => {
                      const k = KIND[r.kind]
                      return (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50 align-top">
                          <td className="py-2 pr-3 whitespace-nowrap text-gray-600 dark:text-gray-300">{r.date.slice(0, 10)}</td>
                          <td className="py-2 pr-3 whitespace-nowrap"><span className={`inline-block px-2 py-0.5 rounded text-xs ${k.cls}`}>{k.emoji} {k.label}</span></td>
                          <td className="py-2 pr-3 text-right whitespace-nowrap text-gray-800 dark:text-gray-100">{r.amount.toFixed(2)}€</td>
                          <td className={`py-2 pr-3 whitespace-nowrap ${statusCls(r.kind, r.status)}`}>{r.status}</td>
                          <td className="py-2 text-gray-600 dark:text-gray-300 break-words">{r.asunto}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
    </div>
  )
}
