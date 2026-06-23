/**
 * Backoff exponencial + deadline del worker de conversiones (fix 19-23/06).
 *
 * Garantía central: un fallo REINTENTABLE (OAuth "Premature close", red, 5xx)
 * nunca produce un estado terminal antes de la deadline por edad. Una caída de
 * horas/días de oauth2.googleapis.com no pierde la venta — se reintenta hasta
 * que el endpoint vuelve, dentro de la ventana de ~90d de Google.
 */

import { decideRetry, RETRY_DEADLINE_MS } from '@/lib/conversions/retry'

const t0 = new Date('2026-06-23T12:00:00.000Z')
const at = (ms: number) => new Date(t0.getTime() + ms)

describe('decideRetry', () => {
  test('dentro de la deadline → sigue reintentando (no DLQ)', () => {
    const d = decideRetry(0, t0, at(60_000), 0)
    expect(d.giveUp).toBe(false)
    expect(d.nextAttemptAt).not.toBeNull()
    expect(d.nextAttemptAt!.getTime()).toBeGreaterThan(at(60_000).getTime())
  })

  test('un fallo transitorio NO agota un cap de intentos: a los 50 intentos sigue vivo si está dentro de la deadline', () => {
    const d = decideRetry(50, t0, at(60_000), 0)
    expect(d.giveUp).toBe(false)
  })

  test('backoff crece con retryCount pero está acotado a 30min', () => {
    const delay = (retry: number) => decideRetry(retry, t0, t0, 0).nextAttemptAt!.getTime() - t0.getTime()
    // jitter=0 → factor 0.8 sobre el backoff base
    expect(delay(0)).toBeCloseTo(2 * 60_000 * 0.8, -2)
    expect(delay(1)).toBeGreaterThan(delay(0))
    expect(delay(2)).toBeGreaterThan(delay(1))
    // Techo: a partir de ~4 intentos el exp satura el cap (30min·0.8 = 24min)
    expect(delay(10)).toBeCloseTo(30 * 60_000 * 0.8, -2)
    expect(delay(100)).toBe(delay(10)) // no explota
  })

  test('jitter mantiene el delay en ±20% del backoff (techo)', () => {
    const cap = 30 * 60_000
    const lo = decideRetry(10, t0, t0, 0).nextAttemptAt!.getTime() - t0.getTime()
    const hi = decideRetry(10, t0, t0, 1).nextAttemptAt!.getTime() - t0.getTime()
    expect(lo).toBe(cap * 0.8) // jitter=0 → -20%
    expect(hi).toBe(cap * 1.2) // jitter=1 → +20%
    // Cualquier jitter intermedio cae dentro de la banda
    const mid = decideRetry(10, t0, t0, 0.5).nextAttemptAt!.getTime() - t0.getTime()
    expect(mid).toBeGreaterThanOrEqual(cap * 0.8)
    expect(mid).toBeLessThanOrEqual(cap * 1.2)
  })

  test('superada la deadline por edad → DLQ real (failed), sin próximo intento', () => {
    const d = decideRetry(3, t0, at(RETRY_DEADLINE_MS), 0)
    expect(d.giveUp).toBe(true)
    expect(d.nextAttemptAt).toBeNull()
  })

  test('justo antes de la deadline → todavía reintenta', () => {
    const d = decideRetry(3, t0, at(RETRY_DEADLINE_MS - 1000), 0)
    expect(d.giveUp).toBe(false)
  })
})
