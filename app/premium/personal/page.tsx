// app/premium/personal/page.tsx — "Tu precio", la página de una oferta personalizada.
//
// POR QUÉ EXISTE (caso Rocío, 29/07/2026): cuando le mantenemos a alguien el precio que
// ya pagaba, hay que darle una forma de contratarlo. La primera versión fue mandarle un
// enlace de pago de Stripe por mensaje, y eso tiene dos pegas: **no se entiende dónde
// está contratando** (una URL ajena que no menciona Vence) y el precio bajo quedaría
// suelto para quien tuviera el enlace. Aquí lo ve dentro de Vence, con su nombre, y el
// checkout comprueba que la oferta es suya (`user_price_offers`).
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { auth } from '@/lib/auth'
import { apiGet } from '@/lib/api/client'
import { getAuthHeaders } from '@/lib/api/authHeaders'
import { trackIntent, confirmIntent, emitClientEvent } from '@/lib/observability/client'

interface OfertaVista {
  priceId: string
  intervalo: string
  periodicidad: string
  importe: string
  euroPorMes: string
  expiraEl: string | null
}

export default function PrecioPersonalPage() {
  const { user, loading: authLoading } = useAuth() as { user: { id: string; email: string } | null; loading: boolean }
  const [ofertas, setOfertas] = useState<OfertaVista[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [pagando, setPagando] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) { setCargando(false); return }
    let vivo = true
    ;(async () => {
      try {
        // El endpoint exige sesión (verifyAuth con Bearer). Sin estas cabeceras responde
        // 401 y la página dice «no tienes precio activo» a alguien que SÍ lo tiene — que es
        // lo que le pasó a Rocío dos veces: primero por un 405 y luego por esto.
        const headers = await getAuthHeaders()
        // `apiGet`, no `apiFetch`: la firma de `apiFetch` es (url, body, options) y aquí no
        // hay cuerpo que mandar, así que las opciones acababan en la posición del cuerpo y
        // la petición salía como POST (el 405 que tuvo bloqueada a una usuaria tres días).
        const data = await apiGet<{ success: boolean; ofertas?: OfertaVista[]; oferta: OfertaVista | null }>(
          '/api/v2/premium/mi-oferta',
          { retries: 2, headers },
        )
        // `ofertas` es lo actual; `oferta` queda como respaldo por si responde un servidor viejo.
        if (vivo) setOfertas(data.ofertas ?? (data.oferta ? [data.oferta] : []))
      } catch {
        if (vivo) setError('No hemos podido cargar tu precio. Vuelve a intentarlo en un momento.')
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => { vivo = false }
  }, [user, authLoading])

  async function contratar(oferta: OfertaVista) {
    if (!user) return
    setPagando(true)
    setError('')
    // Mismo intent tracking que /premium: si el redirect no llega, queda como
    // `intent_unfulfilled` en observable_events en vez de en el silencio.
    const intentId = `checkout-personal-${Date.now()}`
    trackIntent(intentId, 'Checkout precio personalizado', 10000)
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: oferta.priceId, userId: user.id, mode: 'normal' }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409 || data.error === 'already_subscribed') {
          setError('Ya tienes una suscripción activa. Te llevamos a tu perfil…')
          setTimeout(() => { window.location.href = '/perfil?tab=suscripcion' }, 1500)
          return
        }
        throw new Error(data.message || data.error || 'No se ha podido iniciar el pago')
      }
      // El endpoint devuelve el destino en `checkoutUrl`. Aquí ponía `data.url`, que no
      // existe: `location.href = undefined` navega a «/undefined» y la persona acaba en un
      // 404 de la propia web justo al pulsar «Activar mi Premium». Le pasó a la usuaria del
      // precio de fidelidad el 30/07, con la página ya correcta y sus dos precios delante.
      // `data.url` se conserva como respaldo por si el contrato cambia al revés.
      const destino: string | undefined = data.checkoutUrl || data.url
      if (!destino) {
        // Nunca navegar a un destino vacío: mejor decirlo y dejar rastro que mandar a
        // ninguna parte a quien acaba de decidir pagar.
        emitClientEvent({
          severity: 'error',
          eventType: 'custom',
          endpoint: '/api/stripe/create-checkout',
          errorMessage: 'checkout sin URL de destino',
          metadata: { pagina: '/premium/personal', priceId: oferta.priceId, claves: Object.keys(data || {}) },
        })
        throw new Error('No hemos podido abrir la pasarela de pago. Inténtalo de nuevo en un momento.')
      }
      confirmIntent(intentId)
      try { await auth.refreshSession() } catch { /* el redirect manda igual */ }
      window.location.href = destino
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido iniciar el pago')
      setPagando(false)
    }
  }

  if (authLoading || cargando) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Cargando…</div>
      </div>
    )
  }

  if (!user) {
    return (
      <Marco titulo="Tu precio de fidelidad">
        <p className="text-gray-600 dark:text-gray-300">
          Inicia sesión con tu cuenta para ver tu precio de fidelidad.
        </p>
        <Link href="/login" className="mt-6 inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl">
          Iniciar sesión
        </Link>
      </Marco>
    )
  }

  if (!ofertas.length) {
    return (
      <Marco titulo="Tu precio de fidelidad">
        <p className="text-gray-600 dark:text-gray-300">
          No tienes ningún precio de fidelidad activo en este momento.
        </p>
        <Link href="/premium" className="mt-6 inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl">
          Ver los planes
        </Link>
      </Marco>
    )
  }

  return (
    <Marco titulo="Tu precio de fidelidad">
      <p className="text-gray-600 dark:text-gray-300">
        Por llevar tiempo con nosotros mantienes tu precio. Elige el plan que prefieras.
      </p>

      {ofertas.map((oferta) => (
        <div key={oferta.priceId} className="mt-6 rounded-2xl border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/40 p-6 text-center">
          <div className="text-sm uppercase tracking-wide text-blue-700 dark:text-blue-300 font-semibold">
            Vence Premium
          </div>
          <div className="mt-2 flex items-baseline justify-center gap-2">
            <span className="text-5xl font-bold text-gray-900 dark:text-white">{oferta.importe}</span>
            <span className="text-gray-600 dark:text-gray-300">{oferta.periodicidad}</span>
          </div>
          {oferta.intervalo !== 'mensual' && (
            <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">{oferta.euroPorMes} al mes</div>
          )}
          <button
            onClick={() => contratar(oferta)}
            disabled={pagando}
            className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold px-6 py-4 rounded-xl text-lg"
          >
            {pagando ? 'Abriendo el pago…' : 'Activar mi Premium'}
          </button>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            El pago se realiza de forma segura. Puedes cancelar cuando quieras desde tu perfil.
          </p>
        </div>
      ))}

      {error && (
        <div className="mt-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-4 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <ul className="mt-8 space-y-2 text-gray-700 dark:text-gray-300 text-sm">
        <li>✓ Preguntas y tests sin límite diario</li>
        <li>✓ Todas las oposiciones incluidas, con estadísticas por separado</li>
        <li>✓ Descarga del temario en PDF</li>
        <li>✓ Lectura por voz para repasar sin pantalla</li>
        <li>✓ Chat de dudas sin límite</li>
      </ul>
    </Marco>
  )
}

function Marco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="min-h-[60vh] px-4 py-12">
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{titulo}</h1>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}
