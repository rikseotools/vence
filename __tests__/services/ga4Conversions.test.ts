// __tests__/services/ga4Conversions.test.ts
// Gating de supports() del adapter GA4: solo purchase, solo con flag y client_id.

import { ga4Destination } from '@/lib/services/ga4/conversions'
import type { ConversionEvent } from '@/lib/conversions/types'

const base: ConversionEvent = {
  dedupId: 'purchase:in_1', type: 'purchase', userId: 'u1', valueCents: 5900,
  currency: 'eur', occurredAt: '2026-06-03T00:00:00Z', orderId: 'in_1',
  attribution: { gaClientId: '123.456' },
}

describe('ga4Destination.supports', () => {
  const prev = process.env.GA4_UPLOAD_ENABLED
  afterAll(() => { if (prev !== undefined) process.env.GA4_UPLOAD_ENABLED = prev; else delete process.env.GA4_UPLOAD_ENABLED })

  test('flag off → no acepta (no encola)', () => {
    delete process.env.GA4_UPLOAD_ENABLED
    expect(ga4Destination.supports(base)).toBe(false)
  })

  test('flag on + purchase + client_id → acepta', () => {
    process.env.GA4_UPLOAD_ENABLED = 'true'
    expect(ga4Destination.supports(base)).toBe(true)
  })

  test('flag on pero SIN client_id → no acepta (GA4 MP lo exige)', () => {
    process.env.GA4_UPLOAD_ENABLED = 'true'
    expect(ga4Destination.supports({ ...base, attribution: {} })).toBe(false)
  })

  test('flag on pero no es purchase → no acepta', () => {
    process.env.GA4_UPLOAD_ENABLED = 'true'
    expect(ga4Destination.supports({ ...base, type: 'refund' })).toBe(false)
  })
})
