// components/embajadores/EmbajadorPanelView.tsx
// Vista presentacional del panel del embajador (saldo, ingresos por fuente, enlace, embudo, referidos).
// Se alimenta por PROPS con el mismo shape que /api/referrals/me. SIN auth, SIN fetch, SIN efectos:
// solo pinta lo que recibe. La usa la vista admin /admin/embajadores/[userId] (read-only, datos reales
// de otro usuario). Réplica visual de app/embajadores/page.tsx, sin la parte celebratoria/confeti.

const SOURCE_LABEL: Record<string, string> = {
  referido: '💛 Recomendaciones', bug: '🐛 Mejoras/bugs', ugc: '📣 Opiniones',
}
const sourceText = (s: string) => SOURCE_LABEL[s] || s

function statusLabel(s: string): { text: string; cls: string } {
  switch (s) {
    case 'qualified':
    case 'payable':
      return { text: 'Ha comprado ✓', cls: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' }
    case 'paid':
      return { text: 'Recompensa pagada 🎁', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' }
    case 'expired':
      return { text: 'No compró a tiempo', cls: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' }
    case 'rejected':
      return { text: 'No válido', cls: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' }
    default:
      return { text: 'Registrado', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' }
  }
}

export interface EmbajadorPanelData {
  firstName: string | null
  code: string | null
  link: string | null
  stats: { registros: number; compradores: number; conversion: number }
  details: Array<{ name: string | null; city: string | null; oposicion: string | null; status: string }>
  funnel: { copies: number; clicks: number }
  earnings: {
    balance: number
    pending: number
    paidLifetime: number
    bySource: Array<{ source: string; earned: number; count: number }>
  }
  recent: Array<{ source: string; amount: number }>
}

export default function EmbajadorPanelView({ data }: { data: EmbajadorPanelData }) {
  const e = data.earnings
  const name = data.firstName || 'Embajador'
  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      {/* HERO */}
      <section className="text-center mb-8">
        <span className="inline-block bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 px-4 py-1.5 rounded-full text-sm font-semibold mb-5">🎁 PROGRAMA DE EMBAJADORES</span>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">
          🎉 ¡Enhorabuena, {name}! Ya eres <span className="text-blue-600 dark:text-blue-400">Embajador de Vence</span>
        </h1>
      </section>

      {/* NOVEDADES (sin confeti: es vista admin de solo lectura) */}
      {data.recent && data.recent.length > 0 && (
        <section className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl shadow-lg p-6 mb-8 text-center">
          <div className="text-3xl mb-2">🎉</div>
          <h2 className="text-lg font-bold mb-1">¡Ha ganado dinero!</h2>
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {data.recent.map((r, i) => (
              <span key={i} className="bg-white/20 rounded-full px-4 py-1.5 text-sm font-semibold">+{r.amount} € · {sourceText(r.source)}</span>
            ))}
          </div>
        </section>
      )}

      {/* SALDO + DESGLOSE */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-8 border border-blue-100 dark:border-gray-700">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">Su saldo</h2>
        <div className="grid grid-cols-3 gap-3 text-center mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl py-4">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{e.balance} €</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Disponible</div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl py-4">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{e.pending} €</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">En proceso</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl py-4">
            <div className="text-2xl font-bold text-gray-700 dark:text-gray-200">{e.paidLifetime} €</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Ya cobrado</div>
          </div>
        </div>
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">De dónde vienen sus ingresos</h3>
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

      {/* ENLACE + EMBUDO + REFERIDOS */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-8 border border-blue-100 dark:border-gray-700">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3">Su enlace de embajador</h2>
        <input readOnly value={data.link || '(sin enlace generado todavía)'} className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 text-sm" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 text-center">
          <div><div className="text-2xl font-bold text-gray-600 dark:text-gray-300">{data.funnel.copies}</div><div className="text-xs text-gray-500 dark:text-gray-400">Copias del enlace</div></div>
          <div><div className="text-2xl font-bold text-gray-600 dark:text-gray-300">{data.funnel.clicks}</div><div className="text-xs text-gray-500 dark:text-gray-400">Clicks</div></div>
          <div><div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{data.stats.registros}</div><div className="text-xs text-gray-500 dark:text-gray-400">Registros</div></div>
          <div><div className="text-2xl font-bold text-green-600 dark:text-green-400">{data.stats.compradores}</div><div className="text-xs text-gray-500 dark:text-gray-400">Han comprado</div></div>
        </div>
        <div className="text-center text-xs text-gray-500 dark:text-gray-400 mt-3">
          Conversión registro→compra: <strong>{Math.round((data.stats.conversion || 0) * 100)}%</strong>
        </div>
        <div className="mt-8">
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">Sus referidos</h3>
          <div className="space-y-2">
            {data.details.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">Todavía no tiene referidos.</p>
            ) : data.details.map((d, i) => {
              const st = statusLabel(d.status)
              return (
                <div key={i} className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg px-4 py-3">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-800 dark:text-gray-100 truncate">{d.name || '—'}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{[d.city, d.oposicion].filter(Boolean).join(' · ')}</div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${st.cls}`}>{st.text}</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
