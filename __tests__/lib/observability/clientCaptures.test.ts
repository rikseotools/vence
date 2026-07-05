/**
 * @jest-environment jsdom
 *
 * Tests de la lógica de clasificación del wrapper de fetch in-house
 * (lib/observability/client.ts), que reemplaza a Sentry httpClientIntegration.
 * Cubre las exclusiones (para no meter ruido ni falsas alertas) y el anti-bucle.
 */
import { observeUrl, isExpectedStatus } from '@/lib/observability/client'

describe('observeUrl — qué peticiones observa el wrapper', () => {
  it('observa API same-origin', () => {
    expect(observeUrl('/api/answer')).toBe(true)
    expect(observeUrl(`${window.location.origin}/api/v2/tests`)).toBe(true)
  })

  it('NO observa el propio endpoint de ingesta (anti-bucle infinito)', () => {
    expect(observeUrl('/api/observability/ingest')).toBe(false)
  })

  it('NO observa hosts externos (Stripe, Google, doubleclick, etc.)', () => {
    expect(observeUrl('https://api.stripe.com/v1/charges')).toBe(false)
    expect(observeUrl('https://ad.doubleclick.net/x')).toBe(false)
    expect(observeUrl('https://www.googletagmanager.com/gtm.js')).toBe(false)
  })

  it('NO observa rutas no-API same-origin (páginas, assets)', () => {
    expect(observeUrl('/temario/algo')).toBe(false)
    expect(observeUrl('/_next/static/chunk.js')).toBe(false)
  })

  it('URLs basura no revientan', () => {
    expect(observeUrl('::::not a url::::')).toBe(false)
  })
})

describe('isExpectedStatus — 4xx que son flujo normal (no señal de bug)', () => {
  it('cualquier <400 es esperado (no error)', () => {
    for (const s of [200, 201, 204, 301, 302, 304]) {
      expect(isExpectedStatus(s, '/api/x')).toBe(true)
    }
  })

  it('excluye 401/403/404/409/429 (auth, anti-scraping, opcional, conflicto, rate-limit)', () => {
    for (const s of [401, 403, 404, 409, 429]) {
      expect(isExpectedStatus(s, '/api/x')).toBe(true)
    }
  })

  it('NO excluye 400/422 ni otros 4xx (son bugs de cliente → se capturan)', () => {
    for (const s of [400, 402, 405, 410, 418, 422, 451]) {
      expect(isExpectedStatus(s, '/api/x')).toBe(false)
    }
  })

  it('NO excluye 5xx (siempre se capturan)', () => {
    for (const s of [500, 502, 503, 504]) {
      expect(isExpectedStatus(s, '/api/x')).toBe(false)
    }
  })
})
