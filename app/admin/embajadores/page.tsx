'use client'
// app/admin/embajadores/page.tsx — Panel admin del programa de embajadores (modelo ACUMULADO).
//   1) Crear recompensa bug/opinión (tras validarla en el chat de soporte).
//   2) Pagar SALDOS acumulados: por embajador, en gift cards de Amazon.es de denominación fija.
// El guard de admin lo aplica app/admin/layout.tsx. Identidad (approved_by) la pone el token.

import { useCallback, useEffect, useState } from 'react'
import { adminFetch } from '@/lib/api/adminFetch'

// Denominaciones de Amazon.es en Bitrefill (inline para no importar lib/referrals/logic en cliente).
const DENOMS = [5, 10, 20, 50, 100, 200, 400, 500, 1000, 1500]

interface Balance {
  userId: string
  name: string | null
  email: string | null
  balance: number
  suggested: number
}

export default function AdminEmbajadoresPage() {
  const [balances, setBalances] = useState<Balance[] | null>(null)
  const [refInput, setRefInput] = useState<Record<string, string>>({})
  const [amountInput, setAmountInput] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ email: '', type: 'bug', url: '' })

  const load = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/rewards/accumulated')
      if (!res.ok) { setError(`Error ${res.status}`); return }
      setBalances((await res.json()).balances || [])
    } catch (e) { setError((e as Error).message) }
  }, [])
  useEffect(() => { load() }, [load])

  const post = async (url: string, body: unknown) => {
    const res = await adminFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.reason || b.error || `Error ${res.status}`) }
    return res.json()
  }

  const pay = async (b: Balance) => {
    const amount = amountInput[b.userId] ?? b.suggested
    setBusy(b.userId); setError(null)
    try {
      await post('/api/admin/rewards/accumulated', {
        userId: b.userId, amount, giftcardRef: (refInput[b.userId] || '').trim() || undefined, purchasedVia: 'bitrefill',
      })
      await load() // recargar: el saldo baja (el resto se acumula)
    } catch (e) { setError((e as Error).message) } finally { setBusy(null) }
  }

  const createReward = async () => {
    if (!form.email.trim()) { setError('Email requerido'); return }
    setBusy('create'); setError(null)
    try {
      await post('/api/admin/rewards', { email: form.email.trim(), type: form.type, url: form.url.trim() || undefined })
      setForm({ email: '', type: 'bug', url: '' })
      await load()
    } catch (e) { setError((e as Error).message) } finally { setBusy(null) }
  }

  const input = 'px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100'
  const btn = 'px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50'
  const card = 'rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4'

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1">🎁 Embajadores — Payout</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Las recompensas se acumulan por usuario y se pagan en gift cards de Amazon.es (Bitrefill) de denominación fija.
        </p>
      </div>

      {error && <div className="rounded-lg bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-4 py-2 text-sm">{error}</div>}

      {/* 1) CREAR RECOMPENSA BUG/UGC */}
      <section className={card}>
        <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Crear recompensa (validada en soporte)</div>
        <div className="flex flex-wrap gap-2">
          <input placeholder="email del usuario" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={`${input} flex-1 min-w-[180px]`} />
          <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className={input}>
            <option value="bug">Bug/UX (3 €)</option>
            <option value="ugc">Opinión/UGC (5 €)</option>
          </select>
          <input placeholder="link (opinión)" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} className={`${input} flex-1 min-w-[180px]`} />
          <button onClick={createReward} disabled={busy === 'create'} className={btn}>{busy === 'create' ? '…' : 'Crear'}</button>
        </div>
      </section>

      {/* 2) SALDOS ACUMULADOS POR PAGAR */}
      <section>
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3">Saldos por pagar</h2>
        {balances === null ? <p className="text-gray-500 dark:text-gray-400">Cargando…</p>
          : balances.length === 0 ? <div className={`${card} text-center text-gray-500 dark:text-gray-400`}>Nadie llega al mínimo de 5 € todavía.</div>
          : <div className="space-y-3">{balances.map((b) => {
              const chosen = amountInput[b.userId] ?? b.suggested
              const options = DENOMS.filter((d) => d <= b.balance)
              return (
                <div key={b.userId} className={`${card} flex flex-wrap items-center justify-between gap-3`}>
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-800 dark:text-gray-100 truncate">
                      {b.name || 'Embajador'} <span className="text-blue-600 dark:text-blue-400">· saldo {b.balance} €</span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{b.email} · sugerido: tarjeta de {b.suggested} € (sobran {b.balance - b.suggested} €)</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select value={chosen} onChange={(e) => setAmountInput((s) => ({ ...s, [b.userId]: Number(e.target.value) }))} className={input}>
                      {options.map((d) => <option key={d} value={d}>{d} €</option>)}
                    </select>
                    <input placeholder="Ref gift card" value={refInput[b.userId] || ''} onChange={(e) => setRefInput((s) => ({ ...s, [b.userId]: e.target.value }))} className={`${input} w-36`} />
                    <button onClick={() => pay(b)} disabled={busy === b.userId} className={btn}>{busy === b.userId ? '…' : 'Pagar'}</button>
                  </div>
                </div>
              )
            })}</div>}
      </section>
    </div>
  )
}
