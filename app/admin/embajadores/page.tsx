'use client'
// app/admin/embajadores/page.tsx — ESCAPARATE de estadísticas del programa de embajadores.
// Filosofía (decisión Manuel 10/07): este panel es SOLO LECTURA de métricas. Las OPERACIONES
// (crear recompensa/bonus, pagar gift card) las ejecuta Claude Code vía API guiado por
// docs/runbooks/embajadores-recompensas.md. Las acciones manuales quedan como fallback (abajo).
// El guard de admin lo aplica app/admin/layout.tsx.

import { useCallback, useEffect, useState } from 'react'
import { adminFetch } from '@/lib/api/adminFetch'

const DENOMS = [5, 10, 20, 50, 100, 200, 400, 500, 1000, 1500]
const SOURCE_LABEL: Record<string, string> = { referido: '💛 Referidos', bug: '🐛 Bugs/UX', ugc: '📣 Opiniones (UGC)' }
const STATUS_LABEL: Record<string, string> = {
  pending: 'Atribuidos', qualified: 'Compraron', payable: 'Por pagar', paid: 'Pagados', rejected: 'Rechazados', expired: 'Caducados',
}
const eur = (n: number) => `${(n ?? 0).toLocaleString('es-ES')} €`

interface EarningsBySource { source: string; earned: number; count: number }
interface TopEmbajador { userId: string; name: string | null; email: string | null; earned: number; count: number }
interface Stats {
  totalEarned: number; totalPaid: number; outstanding: number; earners: number
  bySource: EarningsBySource[]
  referralStatus: Record<string, number>
  funnel: { views: number; copies: number; clicks: number; signups: number; buyers: number }
  topEmbajadores: TopEmbajador[]
}
interface Balance { userId: string; name: string | null; email: string | null; balance: number; suggested: number }

export default function AdminEmbajadoresPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [balances, setBalances] = useState<Balance[] | null>(null)
  const [refInput, setRefInput] = useState<Record<string, string>>({})
  const [amountInput, setAmountInput] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ email: '', type: 'bug', url: '' })

  const load = useCallback(async () => {
    try {
      const [s, b] = await Promise.all([
        adminFetch('/api/admin/referrals/stats'),
        adminFetch('/api/admin/rewards/accumulated'),
      ])
      if (s.ok) setStats((await s.json()).stats)
      if (b.ok) setBalances((await b.json()).balances || [])
      if (!s.ok && !b.ok) setError(`Error ${s.status}`)
    } catch (e) { setError((e as Error).message) }
  }, [])
  useEffect(() => { load() }, [load])

  const post = async (url: string, body: unknown) => {
    const res = await adminFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.reason || b.error || `Error ${res.status}`) }
    return res.json()
  }
  const pay = async (b: Balance) => {
    setBusy(b.userId); setError(null)
    try {
      await post('/api/admin/rewards/accumulated', {
        userId: b.userId, amount: amountInput[b.userId] ?? b.suggested,
        giftcardRef: (refInput[b.userId] || '').trim() || undefined, purchasedVia: 'bitrefill',
      })
      await load()
    } catch (e) { setError((e as Error).message) } finally { setBusy(null) }
  }
  const createReward = async () => {
    if (!form.email.trim()) { setError('Email requerido'); return }
    setBusy('create'); setError(null)
    try {
      await post('/api/admin/rewards', { email: form.email.trim(), type: form.type, url: form.url.trim() || undefined })
      setForm({ email: '', type: 'bug', url: '' }); await load()
    } catch (e) { setError((e as Error).message) } finally { setBusy(null) }
  }

  const input = 'px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100'
  const btn = 'px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50'
  const card = 'rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4'

  const f = stats?.funnel
  const maxSource = Math.max(1, ...(stats?.bySource || []).map((s) => s.earned))

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1">🎁 Embajadores — Escaparate</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Solo lectura. Las operaciones (crear recompensa/bonus, pagar gift card) las ejecuta Claude Code vía API + runbook.
        </p>
      </div>

      {error && <div className="rounded-lg bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-4 py-2 text-sm">{error}</div>}

      {/* KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Ingresos generados', value: eur(stats?.totalEarned ?? 0), sub: `${stats?.earners ?? 0} embajadores` },
          { label: 'Pagado', value: eur(stats?.totalPaid ?? 0), sub: 'en gift cards' },
          { label: 'Pendiente de pagar', value: eur(stats?.outstanding ?? 0), sub: 'ganado − pagado' },
          { label: 'Compradores', value: String(f?.buyers ?? 0), sub: `de ${f?.signups ?? 0} registros` },
        ].map((k) => (
          <div key={k.label} className={card}>
            <div className="text-xs text-gray-500 dark:text-gray-400">{k.label}</div>
            <div className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-1">{k.value}</div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </section>

      {/* EMBUDO */}
      <section className={card}>
        <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Embudo del programa</div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {[
            { label: 'Vistas', n: f?.views ?? 0 }, { label: 'Copias', n: f?.copies ?? 0 },
            { label: 'Clicks', n: f?.clicks ?? 0 }, { label: 'Registros', n: f?.signups ?? 0 },
            { label: 'Compradores', n: f?.buyers ?? 0 },
          ].map((step, i, arr) => (
            <div key={step.label} className="flex items-center gap-2">
              <div className="rounded-lg bg-gray-50 dark:bg-gray-900 px-3 py-2 text-center min-w-[80px]">
                <div className="text-lg font-bold text-gray-800 dark:text-gray-100">{step.n}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{step.label}</div>
              </div>
              {i < arr.length - 1 && <span className="text-gray-300 dark:text-gray-600">→</span>}
            </div>
          ))}
        </div>
      </section>

      {/* INGRESOS POR FUENTE */}
      <section className={card}>
        <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Ingresos por fuente</div>
        {!stats?.bySource?.length ? <p className="text-sm text-gray-400 dark:text-gray-500">Aún no hay ingresos.</p>
          : <div className="space-y-2">{stats.bySource.map((s) => (
              <div key={s.source} className="flex items-center gap-3">
                <div className="w-32 shrink-0 text-sm text-gray-700 dark:text-gray-200">{SOURCE_LABEL[s.source] || s.source}</div>
                <div className="flex-1 bg-gray-100 dark:bg-gray-900 rounded-full h-5 overflow-hidden">
                  <div className="h-5 bg-blue-500 rounded-full" style={{ width: `${Math.max(4, (s.earned / maxSource) * 100)}%` }} />
                </div>
                <div className="w-28 shrink-0 text-right text-sm text-gray-600 dark:text-gray-300">{eur(s.earned)} · {s.count}</div>
              </div>
            ))}</div>}
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ESTADO DE REFERIDOS */}
        <section className={card}>
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Estado de referidos</div>
          <div className="grid grid-cols-3 gap-2">
            {['pending', 'qualified', 'payable', 'paid', 'rejected', 'expired'].map((k) => (
              <div key={k} className="rounded-lg bg-gray-50 dark:bg-gray-900 px-2 py-2 text-center">
                <div className="text-lg font-bold text-gray-800 dark:text-gray-100">{stats?.referralStatus?.[k] ?? 0}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{STATUS_LABEL[k]}</div>
              </div>
            ))}
          </div>
        </section>

        {/* TOP EMBAJADORES */}
        <section className={card}>
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Top embajadores</div>
          {!stats?.topEmbajadores?.length ? <p className="text-sm text-gray-400 dark:text-gray-500">Aún no hay ingresos.</p>
            : <ol className="space-y-1.5">{stats.topEmbajadores.map((t, i) => (
                <li key={t.userId} className="flex items-center justify-between gap-2 text-sm">
                  <a href={`/admin/embajadores/${t.userId}`} target="_blank" rel="noopener noreferrer" title="Ver su panel como lo ve el usuario (nueva pestaña)" className="truncate text-blue-600 dark:text-blue-400 hover:underline">{i + 1}. {t.name || t.email || 'Embajador'}</a>
                  <span className="shrink-0 text-blue-600 dark:text-blue-400 font-semibold">{eur(t.earned)} · {t.count}</span>
                </li>
              ))}</ol>}
        </section>
      </div>

      {/* SALDOS POR PAGAR (lectura) */}
      <section>
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3">Saldos por pagar</h2>
        {balances === null ? <p className="text-gray-500 dark:text-gray-400">Cargando…</p>
          : balances.length === 0 ? <div className={`${card} text-center text-gray-500 dark:text-gray-400`}>Nadie llega al mínimo de 5 € todavía.</div>
          : <div className="space-y-2">{balances.map((b) => (
              <div key={b.userId} className={`${card} flex flex-wrap items-center justify-between gap-2`}>
                <div className="min-w-0">
                  <div className="font-semibold text-gray-800 dark:text-gray-100 truncate">{b.name || 'Embajador'} <span className="text-blue-600 dark:text-blue-400">· {eur(b.balance)}</span></div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{b.email} · sugerido: tarjeta de {eur(b.suggested)}</div>
                </div>
              </div>
            ))}</div>}
      </section>

      {/* ACCIONES MANUALES — fallback. Normalmente las hace Claude Code vía API + runbook. */}
      <details className="rounded-xl border border-gray-200 dark:border-gray-700">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-600 dark:text-gray-300 select-none">
          🔧 Acciones manuales (fallback — normalmente vía Claude Code + API)
        </summary>
        <div className="p-4 space-y-6 border-t border-gray-100 dark:border-gray-700">
          <div>
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Crear recompensa (validada en soporte)</div>
            <div className="flex flex-wrap gap-2">
              <input placeholder="email del usuario" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} className={`${input} flex-1 min-w-[180px]`} />
              <select value={form.type} onChange={(e) => setForm((s) => ({ ...s, type: e.target.value }))} className={input}>
                <option value="bug">Bug/UX (3 €)</option>
                <option value="ugc">Opinión/UGC (5 €)</option>
              </select>
              <input placeholder="link (opinión)" value={form.url} onChange={(e) => setForm((s) => ({ ...s, url: e.target.value }))} className={`${input} flex-1 min-w-[180px]`} />
              <button onClick={createReward} disabled={busy === 'create'} className={btn}>{busy === 'create' ? '…' : 'Crear'}</button>
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Pagar saldo</div>
            {!balances?.length ? <p className="text-sm text-gray-400 dark:text-gray-500">Nadie llega al mínimo.</p>
              : <div className="space-y-2">{balances.map((b) => (
                  <div key={b.userId} className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-200 min-w-[160px] truncate">{b.email} · {eur(b.balance)}</span>
                    <select value={amountInput[b.userId] ?? b.suggested} onChange={(e) => setAmountInput((s) => ({ ...s, [b.userId]: Number(e.target.value) }))} className={input}>
                      {DENOMS.filter((d) => d <= b.balance).map((d) => <option key={d} value={d}>{d} €</option>)}
                    </select>
                    <input placeholder="Ref gift card" value={refInput[b.userId] || ''} onChange={(e) => setRefInput((s) => ({ ...s, [b.userId]: e.target.value }))} className={`${input} w-36`} />
                    <button onClick={() => pay(b)} disabled={busy === b.userId} className={btn}>{busy === b.userId ? '…' : 'Pagar'}</button>
                  </div>
                ))}</div>}
          </div>
        </div>
      </details>
    </div>
  )
}
