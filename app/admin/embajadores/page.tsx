'use client'
// app/admin/embajadores/page.tsx — Panel admin del programa de embajadores.
//   1) Payout de referidos `payable` (marcar pagado).
//   2) Recompensas bug/UGC: crear (por email, tras validarlas en el chat de soporte) + pagar.
// El guard de admin lo aplica app/admin/layout.tsx. Identidad (approved_by) la pone el token.

import { useCallback, useEffect, useState } from 'react'
import { adminFetch } from '@/lib/api/adminFetch'

interface Payable {
  referralId: string
  referrerName: string | null
  referrerEmail: string | null
  referredName: string | null
  amount: string
  qualifiedAt: string | null
}
interface Reward {
  id: string
  type: string
  amount: string
  url: string | null
  holdUntil: string | null
  userName: string | null
  userEmail: string | null
}

export default function AdminEmbajadoresPage() {
  const [payables, setPayables] = useState<Payable[] | null>(null)
  const [rewards, setRewards] = useState<Reward[] | null>(null)
  const [refInput, setRefInput] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ email: '', type: 'bug', url: '' })

  const load = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([
        adminFetch('/api/admin/referrals/payouts'),
        adminFetch('/api/admin/rewards'),
      ])
      if (p.ok) setPayables((await p.json()).payables || [])
      if (r.ok) setRewards((await r.json()).rewards || [])
    } catch (e) { setError((e as Error).message) }
  }, [])
  useEffect(() => { load() }, [load])

  const post = async (url: string, body: unknown) => {
    const res = await adminFetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      throw new Error(b.reason || b.error || `Error ${res.status}`)
    }
    return res.json()
  }

  const payReferral = async (referralId: string) => {
    setBusy(referralId); setError(null)
    try {
      await post('/api/admin/referrals/payouts', {
        referralId, giftcardRef: (refInput[referralId] || '').trim() || undefined, purchasedVia: 'bitrefill',
      })
      setPayables((prev) => (prev || []).filter((p) => p.referralId !== referralId))
    } catch (e) { setError((e as Error).message) } finally { setBusy(null) }
  }

  const payReward = async (id: string) => {
    setBusy(id); setError(null)
    try {
      await post('/api/admin/rewards/pay', { submissionId: id, giftcardRef: (refInput[id] || '').trim() || undefined, purchasedVia: 'bitrefill' })
      setRewards((prev) => (prev || []).filter((r) => r.id !== id))
    } catch (e) { setError((e as Error).message) } finally { setBusy(null) }
  }

  const createReward = async () => {
    if (!form.email.trim()) { setError('Email requerido'); return }
    setBusy('create'); setError(null)
    try {
      await post('/api/admin/rewards', {
        email: form.email.trim(), type: form.type, url: form.url.trim() || undefined,
      })
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
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1">🏅 Payout de Embajadores</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Gift card de Amazon (Bitrefill) para referidos, bugs y opiniones.</p>
      </div>

      {error && <div className="rounded-lg bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-4 py-2 text-sm">{error}</div>}

      {/* 1) REFERIDOS PAYABLE */}
      <section>
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3">Referidos por pagar (10 €)</h2>
        {payables === null ? <p className="text-gray-500 dark:text-gray-400">Cargando…</p>
          : payables.length === 0 ? <div className={`${card} text-center text-gray-500 dark:text-gray-400`}>Nada pendiente 🎉</div>
          : <div className="space-y-3">{payables.map((p) => (
              <div key={p.referralId} className={`${card} flex flex-wrap items-center justify-between gap-3`}>
                <div className="min-w-0">
                  <div className="font-semibold text-gray-800 dark:text-gray-100 truncate">{p.referrerName || 'Embajador'} <span className="text-blue-600 dark:text-blue-400">· {Number(p.amount)} €</span></div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{p.referrerEmail} · trajo a {p.referredName || 'un opositor'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <input placeholder="Ref gift card" value={refInput[p.referralId] || ''} onChange={(e) => setRefInput((s) => ({ ...s, [p.referralId]: e.target.value }))} className={`${input} w-40`} />
                  <button onClick={() => payReferral(p.referralId)} disabled={busy === p.referralId} className={btn}>{busy === p.referralId ? '…' : 'Marcar pagado'}</button>
                </div>
              </div>
            ))}</div>}
      </section>

      {/* 2) BUG / UGC */}
      <section>
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3">Recompensas bug / opinión</h2>

        {/* crear */}
        <div className={`${card} mb-4`}>
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
        </div>

        {/* pendientes */}
        {rewards === null ? <p className="text-gray-500 dark:text-gray-400">Cargando…</p>
          : rewards.length === 0 ? <div className={`${card} text-center text-gray-500 dark:text-gray-400`}>Nada pendiente</div>
          : <div className="space-y-3">{rewards.map((r) => {
              const inHold = r.holdUntil && new Date(r.holdUntil).getTime() > Date.now()
              return (
                <div key={r.id} className={`${card} flex flex-wrap items-center justify-between gap-3`}>
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-800 dark:text-gray-100 truncate">
                      {r.type === 'ugc' ? '📣 Opinión' : '🐛 Bug'} <span className="text-blue-600 dark:text-blue-400">· {Number(r.amount)} €</span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {r.userName || r.userEmail}{r.url ? ` · ${r.url}` : ''}{inHold ? ` · en hold hasta ${r.holdUntil!.slice(0, 10)}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input placeholder="Ref gift card" value={refInput[r.id] || ''} onChange={(e) => setRefInput((s) => ({ ...s, [r.id]: e.target.value }))} className={`${input} w-40`} />
                    <button onClick={() => payReward(r.id)} disabled={busy === r.id || !!inHold} title={inHold ? 'En hold' : ''} className={btn}>{busy === r.id ? '…' : 'Pagar'}</button>
                  </div>
                </div>
              )
            })}</div>}
      </section>
    </div>
  )
}
