// components/tracking/AttributionCapture.tsx
//
// F0 — trackeo-conversiones-ventas. Captura GLOBAL de atribución en cualquier
// página (no solo /landing/*). Por cada entrada con parámetros de campaña:
//   1) lee TODOS los click-IDs + UTM de la URL,
//   2) los persiste en cookies de 1ª parte (90d) como respaldo,
//   3) emite un toque append-only a /api/attribution/touch vía sendBeacon,
//      keyed por `vence_device_id` (el mismo id de 1ª parte que usa FraudTracker).
//
// Al registrarse, el binding (auth/callback → /api/acquisition) resuelve los
// toques de ese device_id y los liga al user. Fuente de verdad = la tabla
// attribution_touches; las cookies son solo backup.
//
// No gateado por consentimiento: es captura de 1ª parte (igual que FraudTracker
// y el captador de landings que reemplaza). El ENVÍO a plataformas de Ads (F1)
// es lo que respeta Consent Mode.

'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const DEVICE_ID_KEY = 'vence_device_id'
const COOKIE_MAX_AGE_DAYS = 90

// Parámetros de URL → claves del payload del endpoint.
const CLICK_ID_PARAMS = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'ttclid', 'msclkid'] as const
const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

function setCookie(name: string, value: string): void {
  const expires = new Date()
  expires.setDate(expires.getDate() + COOKIE_MAX_AGE_DAYS)
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`
}

function toCamel(snake: string): string {
  return snake.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

export default function AttributionCapture() {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)

    // Recoger señales presentes en la URL.
    const payload: Record<string, string> = {}
    let hasSignal = false
    for (const k of CLICK_ID_PARAMS) {
      const v = params.get(k)
      if (v) { payload[k] = v; hasSignal = true }
    }
    for (const k of UTM_PARAMS) {
      const v = params.get(k)
      if (v) { payload[toCamel(k)] = v; if (k === 'utm_source' || k === 'utm_campaign') hasSignal = true }
    }

    // Sin señales de campaña en la URL → no es un toque atribuible. No hacemos nada.
    if (!hasSignal) return

    // Dedup: no reenviar el mismo querystring dos veces en la misma sesión
    // (evita doble toque por re-render / navegación que conserva params).
    const dedupKey = `attr_touch_sent:${window.location.search}`
    if (sessionStorage.getItem(dedupKey)) return

    const deviceId = getOrCreateDeviceId()

    // Backup en cookies de 1ª parte (la fuente de verdad es la tabla).
    for (const [k, v] of Object.entries(payload)) setCookie(`vence_attr_${k}`, v)

    const body = JSON.stringify({
      deviceId,
      ...payload,
      landingPath: window.location.pathname,
      referrer: document.referrer || null,
    })

    let sent = false
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' })
        sent = navigator.sendBeacon('/api/attribution/touch', blob)
      }
    } catch {
      sent = false
    }
    if (!sent) {
      // Fallback si sendBeacon no está disponible o falla.
      fetch('/api/attribution/touch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {})
    }

    sessionStorage.setItem(dedupKey, '1')
  }, [pathname])

  return null
}
