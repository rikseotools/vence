'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useOposicionPaths } from '@/hooks/useOposicionPaths'
import NavigationButton from '@/components/ui/NavigationButton'

// Estados de la activación síncrona post-checkout. Cada uno tiene su UI
// específica para no engañar al usuario (caso 27/05/2026: enseñábamos
// "¡Bienvenido a Premium!" sin haber confirmado la activación → user
// pulsaba "Empezar" y se bloqueaba a las 25 preguntas).
type SyncState =
  | 'loading'              // POST en vuelo o cargando user
  | 'activated'            // sync devolvió 'activated' o 'already_active'
  | 'pending_payment'      // 3DS / async payment — esperar email
  | 'error_unauthorized'   // session_id pertenece a otro user
  | 'error_session'        // session_id inválido / expirado
  | 'error_unknown'        // fallo de red / Stripe / BD — webhook backup

// Sprint C — Polling en 3DS pending. Si payment_status='unpaid' (3DS en
// proceso, transferencia bancaria, async payment), reintentamos el sync
// cada POLL_INTERVAL_MS hasta que pase a paid o se agote POLL_MAX_DURATION_MS.
// Después del timeout, el webhook sigue siendo el backup.
const POLL_INTERVAL_MS = 8_000
const POLL_MAX_DURATION_MS = 5 * 60_000 // 5 min — cobertura 95%+ de 3DS

async function callSyncEndpoint(sessionId: string): Promise<{
  status?: 'activated' | 'already_active' | 'pending_payment' | 'unpaid'
  httpStatus: number
  errorMessage?: string
}> {
  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data: sessionRes } = await sb.auth.getSession()
  const token = sessionRes.session?.access_token
  if (!token) return { httpStatus: 401, errorMessage: 'no_token' }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 12_000)
  try {
    const res = await fetch('/api/stripe/checkout-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionId }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      return { httpStatus: res.status, errorMessage: body?.error ?? `HTTP ${res.status}` }
    }
    const data = await res.json()
    return { status: data.status, httpStatus: 200 }
  } catch (err) {
    clearTimeout(timeoutId)
    return { httpStatus: 0, errorMessage: err instanceof Error ? err.message : String(err) }
  }
}

function PremiumSuccessContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const { user, refreshUser } = useAuth() as unknown as {
    user: { id: string } | null
    refreshUser?: () => Promise<void>
  }
  const { testUrl } = useOposicionPaths()
  const [state, setState] = useState<SyncState>('loading')
  const [errorDetail, setErrorDetail] = useState<string | null>(null)

  useEffect(() => {
    // No session_id en query (usuario navegó directamente, prueba dev, etc.)
    // → degradar a refresh manual + asumir webhook llegó (comportamiento legacy).
    if (!sessionId) {
      if (user && refreshUser) {
        refreshUser().then(() => setState('activated'))
      } else {
        setState('activated')
      }
      return
    }

    // No user logged → sesión expiró durante el pago.
    if (!user) {
      setState('error_unauthorized')
      return
    }

    let cancelled = false
    let pollTimer: ReturnType<typeof setTimeout> | null = null
    const pollStartedAt = Date.now()

    async function applyResult(result: Awaited<ReturnType<typeof callSyncEndpoint>>) {
      if (cancelled) return

      if (result.httpStatus === 403) {
        setState('error_unauthorized')
        return
      }
      if (result.httpStatus === 404 || result.httpStatus === 410) {
        setState('error_session')
        return
      }
      if (result.httpStatus !== 200) {
        // 5xx, error de red. Webhook backup activará en segundos/minutos.
        setErrorDetail(result.errorMessage ?? 'unknown')
        setState('error_unknown')
        return
      }

      if (result.status === 'activated' || result.status === 'already_active') {
        if (refreshUser) await refreshUser()
        if (!cancelled) setState('activated')
        return
      }

      if (result.status === 'pending_payment' || result.status === 'unpaid') {
        // Sprint C: polling. UI pasa a pending_payment y reintentamos en
        // POLL_INTERVAL_MS. Si el user hace 3DS en el banco y vuelve a
        // confirmar mientras está en esta página, lo pillamos al instante
        // sin necesidad de refresh manual. Timeout de 5 min para no dejar
        // un setTimeout infinito (webhook actúa como backup eterno).
        setState('pending_payment')
        if (Date.now() - pollStartedAt < POLL_MAX_DURATION_MS) {
          pollTimer = setTimeout(async () => {
            if (cancelled) return
            const next = await callSyncEndpoint(sessionId!)
            applyResult(next)
          }, POLL_INTERVAL_MS)
        }
        // Si pasó el timeout, dejamos UI en pending_payment con su mensaje
        // explícito de "te avisaremos por email".
        return
      }

      // Status desconocido — degradar a activated.
      if (refreshUser) await refreshUser()
      if (!cancelled) setState('activated')
    }

    callSyncEndpoint(sessionId).then(applyResult)

    return () => {
      cancelled = true
      if (pollTimer) clearTimeout(pollTimer)
    }
  }, [sessionId, user, refreshUser])

  // ─── UI por estado ───────────────────────────────────────────────

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-12">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-6"></div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Activando tu Premium…</h1>
            <p className="text-gray-600">Estamos confirmando tu pago con la pasarela. Tardará un segundo.</p>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'pending_payment') {
    // Sprint C: spinner + polling cada 8s en background hasta 5 min. Si el
    // pago se confirma (3DS, transferencia, etc.), el estado pasa a
    // 'activated' sin necesidad de refresh manual.
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-50 py-12">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-5xl mb-4">⏳</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Tu pago se está procesando</h1>
            <p className="text-gray-700 mb-4">
              Tu banco está confirmando el cobro (autenticación 3D Secure o transferencia).
              Esto puede tardar de unos segundos a unos minutos.
            </p>
            <p className="text-gray-600 text-sm mb-2">
              <span className="inline-block w-2 h-2 bg-amber-500 rounded-full animate-pulse mr-2"></span>
              Estamos comprobando automáticamente. Cuando se confirme, esta página activará tu Premium al instante.
            </p>
            <p className="text-gray-500 text-xs mb-6">
              También te avisaremos por email por si cierras la pestaña.
            </p>
            <NavigationButton
              href="/"
              loadingText="Cargando..."
              className="bg-gray-700 text-white py-3 px-6 rounded-lg font-medium hover:bg-gray-800"
            >
              Volver al inicio
            </NavigationButton>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'error_unauthorized') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 py-12">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-5xl mb-4">🔒</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">No podemos confirmar este pago</h1>
            <p className="text-gray-700 mb-4">
              Este enlace de confirmación no pertenece a tu cuenta o tu sesión ha caducado.
              Si has pagado, no te preocupes: nuestro sistema procesará tu compra automáticamente en unos minutos.
            </p>
            <p className="text-gray-600 text-sm mb-6">
              Si pasados 5 minutos sigues sin acceso, contáctanos.
            </p>
            <div className="flex gap-3 justify-center">
              <NavigationButton href="/login" loadingText="..." className="bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700">
                Iniciar sesión
              </NavigationButton>
              <NavigationButton href="/" loadingText="..." className="bg-gray-200 text-gray-800 py-3 px-6 rounded-lg font-medium hover:bg-gray-300">
                Inicio
              </NavigationButton>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'error_session') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 py-12">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Enlace no válido</h1>
            <p className="text-gray-700 mb-6">
              No hemos encontrado tu sesión de pago. Si ya has pagado, nuestro sistema lo procesará en unos minutos.
              Si no, puedes volver a intentar la compra desde la página de Premium.
            </p>
            <NavigationButton href="/premium" loadingText="..." className="bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700">
              Ir a Premium
            </NavigationButton>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'error_unknown') {
    // Webhook es el backup — usuario casi seguro tendrá premium activo en
    // <1 min. UI honesta + botón reintentar (recarga vuelve a correr sync).
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 py-12">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-5xl mb-4">🔄</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Pago recibido, finalizando activación…</h1>
            <p className="text-gray-700 mb-4">
              Hemos tenido un problema técnico temporal al activar tu Premium al instante.
              Tranquilo: <strong>tu pago se ha procesado</strong> y la activación se completará automáticamente en menos de un minuto.
            </p>
            <p className="text-gray-600 text-sm mb-6">
              Si refrescas la página en 30 segundos deberías ver Premium activo.
            </p>
            {errorDetail && (
              <p className="text-xs text-gray-400 mb-4 font-mono">Detalle técnico: {errorDetail}</p>
            )}
            <div className="flex gap-3 justify-center">
              <button onClick={() => window.location.reload()} className="bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700">
                Reintentar ahora
              </button>
              <NavigationButton href="/" loadingText="..." className="bg-gray-200 text-gray-800 py-3 px-6 rounded-lg font-medium hover:bg-gray-300">
                Volver al inicio
              </NavigationButton>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // state === 'activated'
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 py-12">
      <div className="max-w-2xl mx-auto px-4 text-center">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-6xl mb-6">🎉</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">¡Bienvenido a Premium!</h1>
          <p className="text-lg text-gray-600 mb-6">
            Tu suscripción está activa. Ya tienes acceso ilimitado a tests, sin tope diario.
          </p>
          <NavigationButton
            href={testUrl}
            loadingText="Cargando..."
            className="bg-blue-600 text-white py-4 px-6 rounded-lg font-bold hover:bg-blue-700"
          >
            🚀 Empezar a Estudiar
          </NavigationButton>
        </div>
      </div>
    </div>
  )
}

export default function PremiumSuccess() {
  // useSearchParams requiere Suspense para SSR.
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-12" />}>
      <PremiumSuccessContent />
    </Suspense>
  )
}
