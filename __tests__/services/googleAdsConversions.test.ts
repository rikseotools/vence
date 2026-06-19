// __tests__/services/googleAdsConversions.test.ts
// Lógica pura del adapter de conversiones de Google Ads (sin red ni credenciales):
// hash de email (Enhanced Conversions), branch sin identificador, y supports().

import {
  hashEmail,
  uploadPurchaseConversion,
  googleAdsDestination,
  isTransientTransportError,
} from '@/lib/services/googleAds/conversions'
import type { ConversionEvent } from '@/lib/conversions/types'

describe('googleAds/conversions', () => {
  describe('isTransientTransportError', () => {
    test('reconoce errores de transporte transitorios (reintento inmediato)', () => {
      expect(isTransientTransportError('2 UNKNOWN: Getting metadata from plugin failed with error: Invalid response body while trying to fetch https://oauth2.googleapis.com/token: Premature close')).toBe(true)
      expect(isTransientTransportError('socket hang up')).toBe(true)
      expect(isTransientTransportError('read ECONNRESET')).toBe(true)
      expect(isTransientTransportError('14 UNAVAILABLE: connection error')).toBe(true)
      expect(isTransientTransportError('other side closed')).toBe(true)
    })
    test('NO marca como transitorio errores de datos/terminales', () => {
      expect(isTransientTransportError('partial_failure: conversion action not found')).toBe(false)
      expect(isTransientTransportError('no_identifier')).toBe(false)
      expect(isTransientTransportError('INVALID_ARGUMENT: order_id too long')).toBe(false)
      expect(isTransientTransportError('')).toBe(false)
    })
  })

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
      expect(res).toEqual({ ok: false, detail: 'no_identifier', terminal: true })
    })

    test('email pero Enhanced Conversions OFF → no_identifier (no envía email, no rompe)', async () => {
      const prev = process.env.ADS_ENHANCED_CONVERSIONS_ENABLED
      delete process.env.ADS_ENHANCED_CONVERSIONS_ENABLED
      const res = await uploadPurchaseConversion({
        emailSha256: 'a'.repeat(64),
        valueEur: 59,
        currency: 'eur',
        orderId: 'in_test',
        occurredAt: new Date().toISOString(),
        dryRun: true,
      })
      expect(res).toEqual({ ok: false, detail: 'no_identifier', terminal: true })
      if (prev !== undefined) process.env.ADS_ENHANCED_CONVERSIONS_ENABLED = prev
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
