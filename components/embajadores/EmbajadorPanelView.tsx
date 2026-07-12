'use client'
// components/embajadores/EmbajadorPanelView.tsx
// Vista presentacional del panel del embajador (saldo, ingresos por fuente, enlace, embudo, referidos).
// Se alimenta por PROPS con el mismo shape que /api/referrals/me. SIN auth, SIN fetch, SIN efectos:
// solo pinta lo que recibe. La usa la vista admin /admin/embajadores/[userId] (read-only, datos reales
// de otro usuario). Réplica visual de app/embajadores/page.tsx, sin la parte celebratoria/confeti.

import { useState } from 'react'
import CopyCode from './CopyCode'

const SOURCE_LABEL: Record<string, string> = {
  referido: '💛 Recomendaciones', registro_activo: '📝 Registros activos', bug: '🐛 Mejoras/bugs', ugc: '📣 Opiniones',
}
const sourceText = (s: string) => SOURCE_LABEL[s] || s

function statusLabel(s: string): { text: string; cls: string } {
  switch (s) {
    case 'qualified':
    case 'payable':
    case 'paid':
      return { text: 'Premium', cls: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' }
    case 'rejected':
      return { text: 'No válido', cls: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' }
    default: // pending / expired → registrado pero aún NO premium
      return { text: 'Registrado · No premium', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' }
  }
}

// Palabra según el género del embajador (BD: male/female/other/prefer_not_say). Femenino → "Embajadora".
const embajadorWord = (g?: string | null) => (g === 'female' ? 'Embajadora' : 'Embajador')

interface ActiveReward { state: 'earned' | 'pending' | 'none'; amount: number; testsDone: number; testsNeeded: number }

// Badge transparente del bonus "registro activo": lo ganado (verde) o el progreso hacia los N tests.
function activeRewardBadge(ar?: ActiveReward): { text: string; cls: string; title: string } | null {
  if (!ar || ar.state === 'none') return null
  if (ar.state === 'earned') {
    return { text: `🎉 +${ar.amount} € ganados`, cls: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
      title: `Bonus de ${ar.amount} € porque este referido ya está activo` }
  }
  return { text: `⏳ ${ar.amount} € · ${ar.testsDone}/${ar.testsNeeded} tests`, cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    title: `Ganarás ${ar.amount} € cuando este referido complete ${ar.testsNeeded} tests (lleva ${ar.testsDone})` }
}

function fmtVoucherDate(d: string | null): string {
  return d ? new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
}

export interface EmbajadorPanelData {
  firstName: string | null
  gender?: string | null
  code: string | null
  link: string | null
  stats: { registros: number; compradores: number; conversion: number }
  details: Array<{ name: string | null; city: string | null; oposicion: string | null; status: string; activeReward?: ActiveReward; selfReferral?: boolean }>
  funnel: { copies: number; clicks: number }
  earnings: {
    balance: number
    pending: number
    paidLifetime: number
    requested?: number
    bySource: Array<{ source: string; earned: number; count: number }>
  }
  recent: Array<{ source: string; amount: number }>
  vouchers?: Array<{ amount: number; code: string; pin?: string | null; serial?: string | null; via: string | null; date: string | null }>
}

export default function EmbajadorPanelView({ data }: { data: EmbajadorPanelData }) {
  const e = data.earnings
  const emb = embajadorWord(data.gender)
  const name = data.firstName || emb
  const [copied, setCopied] = useState(false)
  const copyLink = async () => {
    if (!data.link) return
    try { await navigator.clipboard.writeText(data.link); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* noop */ }
  }
  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      {/* HERO */}
      <section className="text-center mb-8">
        <span className="inline-block bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 px-4 py-1.5 rounded-full text-sm font-semibold mb-5">🎁 PROGRAMA DE REFERIDOS</span>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">
          🎉 ¡Enhorabuena, {name}! Ya eres <span className="text-blue-600 dark:text-blue-400">{emb} de Vence</span>
        </h1>
      </section>

      {/* NOVEDADES (sin confeti: es vista admin de solo lectura) */}
      {data.recent && data.recent.length > 0 && (
        <section className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl shadow-lg p-6 mb-8 text-center">
          <div className="text-3xl mb-2">🎉</div>
          <h2 className="text-lg font-bold mb-1">¡Has ganado dinero!</h2>
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {data.recent.map((r, i) => (
              <span key={i} className="bg-white/20 rounded-full px-4 py-1.5 text-sm font-semibold">+{r.amount} € · {sourceText(r.source)}</span>
            ))}
          </div>
        </section>
      )}

      {/* SALDO + DESGLOSE */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-8 border border-blue-100 dark:border-gray-700">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">Tu saldo</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl py-4">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{e.balance} €</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Disponible</div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/30 rounded-xl py-4">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{e.requested ?? 0} €</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Solicitado</div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl py-4">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{e.pending} €</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">En proceso</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl py-4">
            <div className="text-2xl font-bold text-gray-700 dark:text-gray-200">{e.paidLifetime} €</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Vales emitidos</div>
          </div>
        </div>
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">De dónde vienen tus ingresos</h3>
        <div className="space-y-2">
          {e.bySource.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">Todavía sin ingresos.</p>
          ) : e.bySource.map((s) => (
            <div key={s.source} className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 rounded-lg px-4 py-2.5">
              <span className="text-sm text-gray-700 dark:text-gray-200">{sourceText(s.source)}</span>
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{s.earned} € · {s.count}</span>
            </div>
          ))}
        </div>
      </section>

      {/* SUS VALES — gift cards emitidas (código para canjear) */}
      {data.vouchers && data.vouchers.length > 0 && (
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-8 border border-blue-100 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">Tus vales 🎁</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Tarjetas regalo de Amazon.es que has conseguido. Copia el código y canjéalo en Amazon (el PIN si lo trae).</p>
          <div className="space-y-2">
            {data.vouchers.map((v, i) => (
              <div key={i} className="bg-gray-50 dark:bg-gray-900/50 rounded-lg px-4 py-3">
                <div className="flex items-baseline justify-between gap-3 mb-3">
                  <div className="font-semibold text-gray-800 dark:text-gray-100">{v.amount} € · Amazon.es</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{fmtVoucherDate(v.date)}</div>
                </div>
                <div className="flex flex-col gap-2">
                  <CopyCode label="Código" value={v.code} />
                  {v.pin ? <CopyCode label="PIN" value={v.pin} /> : null}
                  {v.serial ? <CopyCode label="Serial" value={v.serial} /> : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ENLACE + EMBUDO + REFERIDOS */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-8 border border-blue-100 dark:border-gray-700">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3">Tu enlace de referido</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input readOnly value={data.link || '(sin enlace generado todavía)'} className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 text-sm" />
          <button onClick={copyLink} disabled={!data.link} className={`px-6 py-3 rounded-lg font-semibold text-white disabled:opacity-50 transition ${copied ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {copied ? '¡Copiado! ✓' : 'Copiar'}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-6 text-center">
          <div><div className="text-2xl font-bold text-gray-600 dark:text-gray-300">{data.funnel.clicks}</div><div className="text-xs text-gray-500 dark:text-gray-400">Clicks en tu enlace</div></div>
          <div><div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{data.stats.registros}</div><div className="text-xs text-gray-500 dark:text-gray-400">Registros</div></div>
          <div><div className="text-2xl font-bold text-green-600 dark:text-green-400">{data.stats.compradores}</div><div className="text-xs text-gray-500 dark:text-gray-400">Han comprado</div></div>
        </div>
        <div className="text-center text-xs text-gray-500 dark:text-gray-400 mt-3 space-x-3">
          <span>Clics→registros: <strong>{data.funnel.clicks > 0 ? Math.round((data.stats.registros / data.funnel.clicks) * 100) : 0}%</strong></span>
          <span>Registro→compra: <strong>{Math.round((data.stats.conversion || 0) * 100)}%</strong></span>
        </div>
        <div className="mt-8">
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-1">Tus referidos</h3>
          {data.details.some((d) => d.activeReward && d.activeReward.state !== 'none') && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Ganas <strong>2 €</strong> por cada referido que se registre y complete sus primeros{' '}
              {data.details.find((d) => d.activeReward)?.activeReward?.testsNeeded ?? 5} tests.
            </p>
          )}
          <div className="space-y-2">
            {data.details.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">Todavía no tienes referidos.</p>
            ) : data.details.map((d, i) => {
              const st = statusLabel(d.status)
              const ar = activeRewardBadge(d.activeReward)
              return (
                <div key={i} className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg px-4 py-3">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-800 dark:text-gray-100 truncate">{d.name || '—'}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{[d.city, d.oposicion].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${st.cls}`}>{st.text}</span>
                    {d.selfReferral ? (
                      <span title="Registrado con la MISMA IP que el embajador → autoregistro. El guardarraíl anti-fraude lo bloquea: no genera bono." className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">⚠️ Misma IP (autoregistro)</span>
                    ) : ar && (
                      <span title={ar.title} className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${ar.cls}`}>{ar.text}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
