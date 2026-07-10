'use client'
// app/embajadores/page.tsx — Programa de Embajadores de Vence.
// Tono aspiracional/de estatus: el premium descubre que YA es embajador y puede ganar recompensas
// en tarjetas regalo de Amazon. Explica las 3 formas de ganar. Auth-aware (premium / free / anónimo).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { getAuthHeaders } from '@/lib/api/authHeaders'

interface ReferralDetail {
  name: string | null
  city: string | null
  oposicion: string | null
  status: string
  date: string
}
interface MeResponse {
  isAmbassador: boolean
  code?: string
  link?: string
  stats?: { registros: number; compradores: number; conversion: number }
  details?: ReferralDetail[]
  funnel?: { copies: number; clicks: number }
}

// Estado del referido → etiqueta amistosa + color.
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
    default: // pending
      return { text: 'Registrado', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' }
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
      'Comparte tu enlace de embajador donde haya opositores: grupos de WhatsApp y Telegram, foros, Instagram, Facebook, tu academia, compañeros de estudio… donde tú quieras.',
      'Cuando alguien que nunca ha pagado se registra con tu enlace y se hace Premium en sus primeros 10 días, ganas 10 €.',
      'Además, esa persona recibe 5 € de descuento en su primer pago — ganáis los dos.',
      'El importe se abona tras un breve periodo de seguridad (por si hubiera reembolsos).',
      'Sin límite: cuantos más opositores traigas, más recompensas acumulas.',
    ],
  },
  {
    icon: '📣',
    titulo: 'Comparte tu opinión',
    premio: '5 €',
    desc: 'Por una recomendación genuina de Vence en grupos de estudio, redes o foros de opositores. Hasta 3 al mes. Nos lo envías por el chat de soporte con el enlace y una captura.',
    detalle: [
      'Escribe una opinión REAL y honesta sobre algo que de verdad te guste de Vence.',
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

  // Primer nombre para personalizar la enhorabuena (de perfil o metadata de auth).
  const fullName = (userProfile?.full_name || (user?.user_metadata?.full_name as string | undefined) || '').trim()
  const firstName = fullName ? fullName.split(/\s+/)[0] : ''

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
        if (!cancel) setMe(data)
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
            🎁 PROGRAMA DE EMBAJADORES
          </span>

          {loading ? (
            <h1 className="text-2xl sm:text-4xl font-bold text-gray-800 dark:text-gray-100">Cargando…</h1>
          ) : user && isPremium ? (
            <>
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                🎉 ¡Enhorabuena{firstName ? `, ${firstName}` : ''}! Ya eres <span className="text-blue-600 dark:text-blue-400">Embajador de Vence</span>
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
                Hazte <span className="text-blue-600 dark:text-blue-400">Embajador de Vence</span> y gana recompensas
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

        {/* ENLACE DEL EMBAJADOR + MÉTRICA (solo premium) */}
        {user && isPremium && (
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 sm:p-8 mb-10 border border-blue-100 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3">Tu enlace de embajador</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                readOnly
                value={me?.link ?? 'Generando tu enlace…'}
                className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 text-sm"
              />
              <button
                onClick={copyLink}
                disabled={!me?.link}
                className="px-6 py-3 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {copied ? '¡Copiado! ✓' : 'Copiar'}
              </button>
            </div>

            {me?.stats && (
              <>
                {/* Embudo completo: copias → clicks → registros → han comprado */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 text-center">
                  <div>
                    <div className="text-2xl sm:text-3xl font-bold text-gray-600 dark:text-gray-300">{me.funnel?.copies ?? 0}</div>
                    <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Copias del enlace</div>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-bold text-gray-600 dark:text-gray-300">{me.funnel?.clicks ?? 0}</div>
                    <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Clicks</div>
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
                <div className="text-center text-xs text-gray-500 dark:text-gray-400 mt-3">
                  Conversión registro→compra: <strong>{Math.round((me.stats.conversion || 0) * 100)}%</strong>
                </div>
              </>
            )}

            {/* Detalle de referidos: nombre, ciudad, oposición, estado */}
            {me?.details && me.details.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">Tus referidos</h3>
                <div className="space-y-2">
                  {me.details.map((d, i) => {
                    const st = statusLabel(d.status)
                    const sub = [d.city, prettyOpo(d.oposicion)].filter(Boolean).join(' · ')
                    return (
                      <div key={i} className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg px-4 py-3">
                        <div className="min-w-0">
                          <div className="font-medium text-gray-800 dark:text-gray-100 truncate">{d.name || 'Opositor/a'}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{sub || '—'}</div>
                        </div>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${st.cls}`}>{st.text}</span>
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
            3 formas de ganar recompensas
          </h2>
          <div className="grid md:grid-cols-3 gap-5 items-start">
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
                    <div className="flex items-baseline gap-2 mb-2">
                      <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{p.titulo}</h3>
                      <span className="text-blue-600 dark:text-blue-400 font-bold">{p.premio}</span>
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
