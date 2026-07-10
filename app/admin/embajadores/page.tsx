'use client'
// app/admin/embajadores/page.tsx — Panel admin de payout de embajadores.
// Lista los referidos `payable` (hold vencido) y permite marcarlos pagados registrando la gift card.
// El guard de admin lo aplica app/admin/layout.tsx. Identidad (approved_by) la pone el token.

import { useCallback, useEffect, useState } from 'react'
import { adminFetch } from '@/lib/api/adminFetch'

interface Payable {
  referralId: string
  referrerUserId: string
  referrerName: string | null
  referrerEmail: string | null
  referredName: string | null
  amount: string
  qualifiedAt: string | null
}

export default function AdminEmbajadoresPage() {
  const [payables, setPayables] = useState<Payable[] | null>(null)
  const [refInput, setRefInput] = useState<Record<string, string>>({})
  const [paying, setPaying] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/referrals/payouts')
      if (!res.ok) { setError(`Error ${res.status}`); return }
      const data = await res.json()
      setPayables(data.payables || [])
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const pay = async (referralId: string) => {
    const giftcardRef = (refInput[referralId] || '').trim()
    setPaying(referralId)
    setError(null)
    try {
      const res = await adminFetch('/api/admin/referrals/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralId, giftcardRef: giftcardRef || undefined, purchasedVia: 'bitrefill' }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        setError(b.reason || b.error || `Error ${res.status}`)
        return
      }
      // quitar de la lista
      setPayables((prev) => (prev || []).filter((p) => p.referralId !== referralId))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPaying(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1">🏅 Payout de Embajadores</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Referidos con el hold vencido, listos para comprar la gift card de Amazon (Bitrefill) y marcar pagados.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {payables === null ? (
        <p className="text-gray-500 dark:text-gray-400">Cargando…</p>
      ) : payables.length === 0 ? (
        <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
          No hay referidos pendientes de pago. 🎉
        </div>
      ) : (
        <div className="space-y-3">
          {payables.map((p) => (
            <div key={p.referralId} className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-gray-800 dark:text-gray-100 truncate">
                    {p.referrerName || 'Embajador'} <span className="text-blue-600 dark:text-blue-400">· {Number(p.amount)} €</span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {p.referrerEmail} · trajo a {p.referredName || 'un opositor'}
                    {p.qualifiedAt ? ` · pagó ${p.qualifiedAt.slice(0, 10)}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    placeholder="Ref/código gift card"
                    value={refInput[p.referralId] || ''}
                    onChange={(e) => setRefInput((s) => ({ ...s, [p.referralId]: e.target.value }))}
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 w-44"
                  />
                  <button
                    onClick={() => pay(p.referralId)}
                    disabled={paying === p.referralId}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                  >
                    {paying === p.referralId ? '…' : 'Marcar pagado'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
