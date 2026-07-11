'use client'
// app/embajadores/page.tsx — Programa de Embajadores de Vence.
// Tono aspiracional/de estatus: el premium descubre que YA es embajador y puede ganar recompensas
// en tarjetas regalo de Amazon. Explica las 3 formas de ganar. Auth-aware (premium / free / anónimo).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import MisVales from '@/components/embajadores/MisVales'
import { getAuthHeaders } from '@/lib/api/authHeaders'

interface ActiveReward { state: 'earned' | 'pending' | 'none'; amount: number; testsDone: number; testsNeeded: number }
interface ReferralDetail {
  name: string | null
  city: string | null
  oposicion: string | null
  status: string
  date: string
  activeReward?: ActiveReward
}
interface EarningsBySource { source: string; earned: number; count: number }
interface Earnings { balance: number; earnedLifetime: number; paidLifetime: number; pending: number; bySource: EarningsBySource[] }
interface RecentEarning { source: string; amount: number; date: string }
interface MeResponse {
  isAmbassador: boolean
  code?: string
  link?: string
  stats?: { registros: number; compradores: number; conversion: number }
  details?: ReferralDetail[]
  funnel?: { copies: number; clicks: number }
  earnings?: Earnings
  unseen?: number
  recent?: RecentEarning[]
}

const SOURCE_LABEL: Record<string, string> = {
  referido: '💛 Recomendaciones', registro_activo: '📝 Registros activos', bug: '🐛 Mejoras/bugs', ugc: '📣 Opiniones',
}
const sourceText = (s: string) => SOURCE_LABEL[s] || s

// Confeti celebratorio al revelar una recompensa nueva (dos ráfagas laterales). SSR-safe.
function fireConfetti() {
  if (typeof window === 'undefined') return
  import('canvas-confetti').then(({ default: confetti }) => {
    confetti({ particleCount: 90, spread: 80, startVelocity: 35, ticks: 120, zIndex: 9999, origin: { x: 0.2, y: 0.3 } })
    setTimeout(() => confetti({ particleCount: 90, spread: 80, startVelocity: 35, ticks: 120, zIndex: 9999, origin: { x: 0.8, y: 0.3 } }), 200)
  }).catch(() => {})
}

// Palabra según el género del embajador (BD: male/female/other/prefer_not_say). Femenino → "Embajadora".
const embajadorWord = (g?: string | null) => (g === 'female' ? 'Embajadora' : 'Embajador')

// Badge transparente del bonus "registro activo": lo ganado (verde) o el progreso hacia los N tests.
function activeRewardBadge(ar?: ActiveReward): { text: string; cls: string; title: string } | null {
  if (!ar || ar.state === 'none') return null
  if (ar.state === 'earned') {
    return { text: `🎉 +${ar.amount} € ganados`, cls: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
      title: `Bonus de ${ar.amount} € porque este referido ya está activo` }
  }
  return { text: `⏳ ${ar.amount} € · ${ar.testsDone}/${ar.testsNeeded} tests`, cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    title: `Ganarás ${ar.amount} € cuando complete ${ar.testsNeeded} tests (lleva ${ar.testsDone})` }
}

// Estado del referido → etiqueta amistosa + color.
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

// Oposición (slug target_oposicion) → texto legible.
function prettyOpo(slug: string | null): string {
  if (!slug) return ''
  const s = slug.replace(/[_-]+/g, ' ').trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const PROGRAMAS = [
  {
    icon: '💛',
    titulo: 'Recomienda Vence',
    premio: '10 €',
    desc: 'Por cada amigo nuevo que se suscriba con tu enlace y pague en sus primeros 10 días. Y tu amigo se lleva 5 € de descuento en su primer pago.',
    detalle: [
      'Comparte tu enlace de referido donde haya opositores: grupos de WhatsApp y Telegram, foros, Instagram, Facebook, tu academia, compañeros de estudio… donde tú quieras.',
      'Cuando alguien que nunca ha pagado se registra con tu enlace y se hace Premium en sus primeros 10 días, ganas 10 €.',
      'Además, esa persona recibe 5 € de descuento en su primer pago — ganáis los dos.',
      'El importe se abona tras un breve periodo de seguridad (por si hubiera reembolsos).',
      'Sin límite: cuantos más opositores traigas, más recompensas acumulas.',
      'Esto es CON tu enlace de referido. Si solo dejas una opinión nombrando Vence SIN tu enlace, eso va por «Comparte tu opinión» (5 €) — son cosas distintas.',
    ],
  },
  {
    icon: '✅',
    titulo: 'Trae opositores activos',
    premio: '2 €',
    desc: 'Por cada persona nueva que se registre con tu enlace y empiece a estudiar de verdad (sus primeros 5 tests). No hace falta que pague: solo con que se registre y practique, ganas 2 €.',
    detalle: [
      'Cuando alguien que nunca ha estado en Vence se registra con tu enlace y completa sus primeros 5 tests, ganas 2 €.',
      'No necesita hacerse Premium — basta con que se registre gratis y empiece a hacer tests.',
      'Debe ser una persona real y distinta a ti: nada de auto-registros ni segundas cuentas (lo detectamos y no cuentan).',
      'Se abona automáticamente en cuanto el opositor llega a sus 5 tests. Puedes seguir el progreso en «Tus referidos».',
      'Es un programa de impulso: lo mantenemos de forma temporal mientras hacemos crecer Vence. 🚀',
    ],
  },
  {
    icon: '📣',
    titulo: 'Comparte tu opinión',
    premio: '5 €',
    desc: 'Por una opinión genuina en la que nombras Vence (SIN tu enlace de referido) en grupos de estudio, redes o foros de opositores. Hasta 3 al mes. Nos lo envías por el chat de soporte con el enlace y una captura.',
    detalle: [
      'Escribe una opinión REAL y honesta sobre algo que de verdad te guste de Vence, mencionando Vence por su nombre.',
      'Importante: es una reseña donde hablas de Vence, SIN poner tu enlace de referido. Si lo que compartes es tu enlace, eso va por «Recomienda Vence» (10 € por venta), no por aquí — no se paga dos veces por lo mismo.',
      'Vale en grupos de Facebook/Telegram de opositores, un post en Instagram, o un comentario o hilo en un foro.',
      'Debe ser tu experiencia genuina — nada inventado ni copiado.',
      'Para cobrar, crea un chat de soporte y envíanos el enlace público a tu publicación + una captura de pantalla.',
      'Hasta 3 opiniones al mes. Respeta siempre las normas del grupo o foro (nada de spam).',
      'Verificamos que la publicación sigue online y te abonamos los 5 €.',
    ],
  },
  {
    icon: '🐛',
    titulo: 'Ayúdanos a mejorar',
    premio: '3 €',
    desc: 'Por cada fallo técnico que encuentres o mejora de usabilidad de la plataforma que nos propongas y nos sirva de verdad. No incluye impugnaciones de preguntas.',
    detalle: [
      '¿Has encontrado un fallo técnico o se te ocurre cómo mejorar la usabilidad de la plataforma? Cuéntanoslo.',
      'Repórtalo por el chat de soporte, con el máximo detalle posible (qué pasó, dónde, capturas…).',
      'Si es un bug reproducible o una mejora de usabilidad que nos sirve de verdad, ganas 3 €.',
      'Importante: esto NO son impugnaciones de preguntas (esas tienen su propio proceso y no entran aquí). Es sobre el funcionamiento y la usabilidad de la app.',
      'Los duplicados o cosas ya conocidas no cuentan. Hay un límite mensual por usuario.',
      'Tu ayuda hace Vence mejor para todos los opositores. 🙌',
    ],
  },
]

export default function EmbajadoresPage() {
  const { user, userProfile, loading, isPremium } = useAuth()
  const [me, setMe] = useState<MeResponse | null>(null)
  const [copied, setCopied] = useState(false)
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [reveal, setReveal] = useState<RecentEarning[] | null>(null)

  // Primer nombre para personalizar la enhorabuena (de perfil o metadata de auth).
  const fullName = (userProfile?.full_name || (user?.user_metadata?.full_name as string | undefined) || '').trim()
  const firstName = fullName ? fullName.split(/\s+/)[0] : ''
  // Género de BD → "Embajador"/"Embajadora" (no asumir masculino si es mujer).
  const emb = embajadorWord((userProfile as { gender?: string | null } | null)?.gender)

  // Observabilidad: registra la visita a la página (top del embudo), una vez por carga, para todos.
  // Manda el token si lo hay → captura el userId del visitante (trazabilidad); anónimo cuenta igual.
  useEffect(() => {
    getAuthHeaders()
      .then((headers) => fetch('/api/referrals/track-view', { method: 'POST', headers }))
      .catch(() => { /* silencioso */ })
  }, [])

  // (La atribución se dispara globalmente en components/ReferralAttributionOnLogin, montado en el
  //  layout, para cubrir a los referidos que pagan sin volver a esta página.)

  useEffect(() => {
    if (loading || !user || !isPremium) return
    let cancel = false
    ;(async () => {
      try {
        const headers = await getAuthHeaders()
        const res = await fetch('/api/referrals/me', { headers })
        if (!res.ok) return
        const data: MeResponse = await res.json()
        if (cancel) return
        setMe(data)
        // Novedades sin ver → revelación celebratoria + confeti + marcar visto (apaga el badge).
        if ((data.unseen ?? 0) > 0) {
          setReveal(data.recent ?? [])
          fireConfetti()
          getAuthHeaders()
            .then((h) => fetch('/api/referrals/badge', { method: 'POST', headers: h }))
            .then(() => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('referral-earnings-seen')) })
            .catch(() => {})
        }
      } catch { /* silencioso */ }
    })()
    return () => { cancel = true }
  }, [loading, user, isPremium])

  const copyLink = async () => {
    if (!me?.link) return
    try {
      await navigator.clipboard.writeText(me.link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      // Observabilidad: registrar la copia (top del embudo). Fire-and-forget.
      getAuthHeaders().then((headers) => fetch('/api/referrals/track-copy', { method: 'POST', headers })).catch(() => {})
    } catch { /* noop */ }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-10 sm:py-16 max-w-5xl">

        {/* HERO — cambia según estado */}
        <section className="text-center mb-10 sm:mb-14">
          <span className="inline-block bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 px-4 py-1.5 rounded-full text-sm font-semibold mb-5">
            🎁 PROGRAMA DE REFERIDOS
          </span>

          {loading ? (
            <h1 className="text-2xl sm:text-4xl font-bold text-gray-800 dark:text-gray-100">Cargando…</h1>
          ) : user && isPremium ? (
            <>
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                🎉 ¡Enhorabuena{firstName ? `, ${firstName}` : ''}! Ya eres <span className="text-blue-600 dark:text-blue-400">{emb} de Vence</span>
              </h1>
              <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
                No solo eres <strong>Premium</strong> — ahora formas parte de nuestro círculo de embajadores.
                Puedes <strong>ganar recompensas en tarjetas regalo de Amazon</strong> recomendando Vence,
                ayudándonos a mejorar y compartiendo tu experiencia.
              </p>
            </>
          ) : user ? (
            <>
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                Hazte <span className="text-blue-600 dark:text-blue-400">{emb} de Vence</span> y gana recompensas
              </h1>
              <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed mb-6">
                El programa de embajadores es para usuarios <strong>Premium</strong>. Hazte Premium y empieza a
                ganar <strong>tarjetas regalo de Amazon</strong> recomendando Vence a tus compañeros de oposición.
              </p>
              <Link href="/premium" className="inline-block bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold px-6 py-3 rounded-lg shadow-md hover:brightness-95 transition">
                👑 Hazte Premium
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                Programa de <span className="text-blue-600 dark:text-blue-400">Embajadores</span> de Vence
              </h1>
              <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed mb-6">
                Recomienda Vence a otros opositores y gana <strong>recompensas en tarjetas regalo de Amazon</strong>.
              </p>
              <Link href="/login" className="inline-block bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg shadow-md hover:bg-blue-700 transition">
                Iniciar sesión
              </Link>
            </>
          )}
        </section>

        {/* NOVEDADES: alguien te ha hecho ganar dinero (revelación al abrir tras el badge) */}
        {user && isPremium && reveal && reveal.length > 0 && (
          <section className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl shadow-lg p-6 sm:p-8 mb-8 text-center animate-[fadeIn_0.4s_ease]">
            <div className="text-4xl mb-2">🎉</div>
            <h2 className="text-xl sm:text-2xl font-bold mb-1">¡Has ganado dinero!</h2>
            <p className="text-white/90 mb-4">Se ha sumado a tu saldo de embajador:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {reveal.slice(0, 6).map((r, i) => (
                <span key={i} className="bg-white/20 rounded-full px-4 py-1.5 text-sm font-semibold">
                  +{r.amount} € · {sourceText(r.source)}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* SALDO + DESGLOSE POR FUENTE (solo premium) */}
        {user && isPremium && me?.earnings && (
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 sm:p-8 mb-8 border border-blue-100 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">Tu saldo</h2>
            <div className="grid grid-cols-3 gap-3 text-center mb-6">
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl py-4">
                <div className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">{me.earnings.balance} €</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Disponible</div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl py-4">
                <div className="text-2xl sm:text-3xl font-bold text-amber-600 dark:text-amber-400">{me.earnings.pending} €</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">En proceso</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl py-4">
                <div className="text-2xl sm:text-3xl font-bold text-gray-700 dark:text-gray-200">{me.earnings.paidLifetime} €</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Vales emitidos</div>
              </div>
            </div>
            {me.earnings.bySource.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">De dónde vienen tus ingresos</h3>
                <div className="space-y-2">
                  {me.earnings.bySource.map((s) => (
                    <div key={s.source} className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 rounded-lg px-4 py-2.5">
                      <span className="text-sm text-gray-700 dark:text-gray-200">{sourceText(s.source)}</span>
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{s.earned} € · {s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
              Cuando tu saldo disponible llega a 5 €, te pagamos en tarjeta regalo de Amazon. Lo que sobre se acumula para la próxima.
            </p>
          </section>
        )}

        {/* MIS VALES — gift cards conseguidas (solo premium con vales) */}
        {user && isPremium && <MisVales />}

        {/* ENLACE DEL EMBAJADOR + MÉTRICA (solo premium) */}
        {user && isPremium && (
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 sm:p-8 mb-10 border border-blue-100 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3">Tu enlace de referido</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                readOnly
                value={me?.link ?? 'Generando tu enlace…'}
                className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 text-sm"
              />
              <button
                onClick={copyLink}
                disabled={!me?.link}
                className={`px-6 py-3 rounded-lg font-semibold text-white disabled:opacity-50 transition ${copied ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {copied ? '¡Copiado! ✓' : 'Copiar'}
              </button>
            </div>

            {me?.stats && (
              <>
                {/* Embudo: clicks → registros → han comprado */}
                <div className="grid grid-cols-3 gap-4 mt-6 text-center">
                  <div>
                    <div className="text-2xl sm:text-3xl font-bold text-gray-600 dark:text-gray-300">{me.funnel?.clicks ?? 0}</div>
                    <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Clicks en tu enlace</div>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">{me.stats.registros}</div>
                    <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Registros</div>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">{me.stats.compradores}</div>
                    <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Han comprado</div>
                  </div>
                </div>
                <div className="text-center text-xs text-gray-500 dark:text-gray-400 mt-3 space-x-3">
                  <span>Clics→registros: <strong>{(me.funnel?.clicks ?? 0) > 0 ? Math.round((me.stats.registros / (me.funnel!.clicks)) * 100) : 0}%</strong></span>
                  <span>Registro→compra: <strong>{Math.round((me.stats.conversion || 0) * 100)}%</strong></span>
                </div>
              </>
            )}

            {/* Detalle de referidos: nombre, ciudad, oposición, estado */}
            {me?.details && me.details.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-1">Tus referidos</h3>
                {me.details.some((d) => d.activeReward && d.activeReward.state !== 'none') && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Ganas <strong>2 €</strong> por cada referido que se registre y complete sus primeros{' '}
                    {me.details.find((d) => d.activeReward)?.activeReward?.testsNeeded ?? 5} tests.
                  </p>
                )}
                <div className="space-y-2">
                  {me.details.map((d, i) => {
                    const st = statusLabel(d.status)
                    const ar = activeRewardBadge(d.activeReward)
                    const sub = [d.city, prettyOpo(d.oposicion)].filter(Boolean).join(' · ')
                    return (
                      <div key={i} className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg px-4 py-3">
                        <div className="min-w-0">
                          <div className="font-medium text-gray-800 dark:text-gray-100 truncate">{d.name || 'Opositor/a'}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{sub || '—'}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${st.cls}`}>{st.text}</span>
                          {ar && <span title={ar.title} className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${ar.cls}`}>{ar.text}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* LAS 3 FORMAS DE GANAR */}
        <section>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 text-center mb-6">
            4 formas de ganar recompensas
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
            {PROGRAMAS.map((p, i) => {
              const open = openIndex === i
              return (
                <div key={p.titulo} className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenIndex(open ? null : i)}
                    aria-expanded={open}
                    className="w-full text-left p-6 hover:bg-blue-50/50 dark:hover:bg-gray-700/40 transition"
                  >
                    <div className="text-4xl mb-3">{p.icon}</div>
                    <div className="flex items-baseline justify-between gap-2 mb-2">
                      <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{p.titulo}</h3>
                      <span className="text-blue-600 dark:text-blue-400 font-bold whitespace-nowrap shrink-0">{p.premio}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{p.desc}</p>
                    <span className="mt-3 inline-block text-sm text-blue-600 dark:text-blue-400 font-medium">
                      {open ? 'Ocultar detalles ▲' : 'Ver cómo funciona ▼'}
                    </span>
                  </button>
                  {open && (
                    <div className="px-6 pb-6">
                      <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300 border-t border-gray-100 dark:border-gray-700 pt-4">
                        {p.detalle.map((d, j) => (
                          <li key={j} className="flex gap-2">
                            <span className="text-blue-500 dark:text-blue-400 mt-0.5">•</span>
                            <span>{d}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6 max-w-2xl mx-auto">
            Tus recompensas se <strong>acumulan en tu saldo</strong>. Cuando llegas a <strong>5 €</strong>, te
            pagamos en <strong>tarjetas regalo de Amazon</strong> (5, 10, 20 €…) y lo que sobre se guarda para
            la próxima, tras una verificación manual. Recomienda siempre de forma honesta y respetando las
            normas de cada grupo o foro. 🙌
          </p>
        </section>
      </div>
    </div>
  )
}
