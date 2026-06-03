// __tests__/services/googleAdsConversions.test.ts
// Lógica pura del adapter de conversiones de Google Ads (sin red ni credenciales):
// hash de email (Enhanced Conversions), branch sin identificador, y supports().

import {
  hashEmail,
  uploadPurchaseConversion,
  googleAdsDestination,
} from '@/lib/services/googleAds/conversions'
import type { ConversionEvent } from '@/lib/conversions/types'

describe('googleAds/conversions', () => {
  describe('hashEmail', () => {
    test('SHA-256 hex del email normalizado (lowercase + trim)', () => {
      const expected = '973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b'
      expect(hashEmail('test@example.com')).toBe(expected)
      // Normaliza mayúsculas y espacios → mismo hash.
      expect(hashEmail('  Test@Example.COM ')).toBe(expected)
    })
  })

  describe('uploadPurchaseConversion', () => {
    test('sin click-ID ni email → no_identifier (no toca la API)', async () => {
      const res = await uploadPurchaseConversion({
        valueEur: 59,
        currency: 'eur',
        orderId: 'in_test',
        occurredAt: new Date().toISOString(),
        dryRun: true,
      })
      expect(res).toEqual({ ok: false, detail: 'no_identifier' })
    })
  })

  describe('googleAdsDestination.supports', () => {
    const base: ConversionEvent = {
      dedupId: 'x', type: 'purchase', userId: null, valueCents: 5900,
      currency: 'eur', occurredAt: '2026-06-03T00:00:00Z', attribution: {},
    }
    test('acepta purchase', () => {
      expect(googleAdsDestination.supports(base)).toBe(true)
    })
    test('rechaza refund/registration (futuro / no aplica)', () => {
      expect(googleAdsDestination.supports({ ...base, type: 'refund' })).toBe(false)
      expect(googleAdsDestination.supports({ ...base, type: 'registration' })).toBe(false)
    })
  })
})
