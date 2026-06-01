// __tests__/lib/api/admin/endpoint-classification.test.ts
// Tests unitarios para classifyEndpoint — función pura usada por
// health-check para sub-categorizar errores 5xx admin vs user-facing.

import {
  classifyEndpoint,
  ADMIN_ENDPOINT_PATTERNS,
  ERROR_5XX_THRESHOLDS,
} from '@/lib/api/admin/endpoint-classification'

describe('classifyEndpoint — clasificación admin vs user-facing', () => {
  // ============================================================
  // ADMIN — endpoints internos / operativos
  // ============================================================
  describe('admin endpoints', () => {
    it.each([
      '/api/admin/feedback',
      '/api/admin/system-health',
      '/api/admin/canary/run-now',
      '/api/admin/observability',
      '/api/admin/questions/lifecycle/transition',
      '/api/admin/newsletters/templates/[slug]',
      '/api/v2/admin/validation-errors',
      '/api/v2/admin/topic-summary/refresh',
      '/api/cron/check-stats-drift',
      '/api/cron/check-webhook-health',
      '/api/cron/subscription-reconciliation',
      '/api/debug/observability-smoke',
      '/api/debug/question/[id]',
      '/api/verify-articles/sync-all',
      '/api/armando/auth',
      '/api/armando/logout',
      '/api/armando/me',
    ])('clasifica %s como admin', (endpoint) => {
      expect(classifyEndpoint(endpoint)).toBe('admin')
    })

    it('matchea raíz exacta `/api/admin` sin trailing slash', () => {
      expect(classifyEndpoint('/api/admin')).toBe('admin')
    })

    it('matchea raíz exacta `/api/cron` sin trailing slash', () => {
      expect(classifyEndpoint('/api/cron')).toBe('admin')
    })
  })

  // ============================================================
  // USER-FACING — endpoints que afectan al cliente final
  // ============================================================
  describe('user-facing endpoints', () => {
    it.each([
      '/api/profile',
      '/api/profile/email-preferences',
      '/api/medals',
      '/api/v2/answer-and-save',
      '/api/answer',
      '/api/answer/psychometric',
      '/api/exam/pending',
      '/api/exam/answer',
      '/api/questions/filtered',
      '/api/questions/user-failed',
      '/api/random-test/availability',
      '/api/topics/[numero]',
      '/api/stats',
      '/api/v2/user-stats',
      '/api/v2/difficulty-insights',
      '/api/v2/test-config/articles',
      '/api/v2/topic-progress/weak-articles',
      '/api/teoria/articles',
      '/api/ranking',
      '/api/stripe/create-checkout',
      '/api/laws-configurator',
      '/api/auth/track-session-ip',
    ])('clasifica %s como user_facing', (endpoint) => {
      expect(classifyEndpoint(endpoint)).toBe('user_facing')
    })
  })

  // ============================================================
  // CASOS DEFENSIVOS — nunca rompe, default seguro user_facing
  // ============================================================
  describe('defensa: default user_facing nunca lanza', () => {
    it('string vacío → user_facing', () => {
      expect(classifyEndpoint('')).toBe('user_facing')
    })

    it('null → user_facing', () => {
      expect(classifyEndpoint(null)).toBe('user_facing')
    })

    it('undefined → user_facing', () => {
      expect(classifyEndpoint(undefined)).toBe('user_facing')
    })

    it('number (input inválido) → user_facing', () => {
      expect(classifyEndpoint(123 as unknown as string)).toBe('user_facing')
    })

    it('endpoint que contiene "admin" en medio pero no al inicio → user_facing', () => {
      // Defensa contra matching laxo: solo prefijos exactos cuentan.
      expect(classifyEndpoint('/api/users/admin-tools')).toBe('user_facing')
      expect(classifyEndpoint('/api/data/cron-status')).toBe('user_facing')
    })
  })

  // ============================================================
  // INVARIANTES estructurales del módulo
  // ============================================================
  describe('estructura del módulo', () => {
    it('ADMIN_ENDPOINT_PATTERNS es array de RegExp no vacío', () => {
      expect(Array.isArray(ADMIN_ENDPOINT_PATTERNS)).toBe(true)
      expect(ADMIN_ENDPOINT_PATTERNS.length).toBeGreaterThan(0)
      for (const p of ADMIN_ENDPOINT_PATTERNS) {
        expect(p).toBeInstanceOf(RegExp)
      }
    })

    it('todos los patrones están anchored al inicio con ^ (evita matching laxo)', () => {
      for (const p of ADMIN_ENDPOINT_PATTERNS) {
        expect(p.source.startsWith('^\\/api\\/')).toBe(true)
      }
    })

    it('umbrales user_facing son MÁS estrictos que admin', () => {
      expect(ERROR_5XX_THRESHOLDS.user_facing.amber).toBeLessThan(
        ERROR_5XX_THRESHOLDS.admin.amber,
      )
      expect(ERROR_5XX_THRESHOLDS.user_facing.red).toBeLessThan(
        ERROR_5XX_THRESHOLDS.admin.red,
      )
    })

    it('umbrales son enteros positivos', () => {
      for (const cat of ['user_facing', 'admin'] as const) {
        expect(ERROR_5XX_THRESHOLDS[cat].amber).toBeGreaterThan(0)
        expect(ERROR_5XX_THRESHOLDS[cat].red).toBeGreaterThan(0)
        expect(Number.isInteger(ERROR_5XX_THRESHOLDS[cat].amber)).toBe(true)
        expect(Number.isInteger(ERROR_5XX_THRESHOLDS[cat].red)).toBe(true)
      }
    })
  })

  // ============================================================
  // REGRESSION del incidente 2026-06-01
  // ============================================================
  describe('Regression incidente 2026-06-01 (falso ROJO)', () => {
    it('/api/verify-articles/sync-all es admin (13 errores no debe ser ROJO)', () => {
      // Caso concreto que disparó la mejora: 13 errores 5xx en este endpoint
      // cruzaban el umbral user_facing rojo (>=5) pero deben tratarse con el
      // umbral admin (>=20 para rojo).
      expect(classifyEndpoint('/api/verify-articles/sync-all')).toBe('admin')
      const count = 13
      expect(count).toBeLessThan(ERROR_5XX_THRESHOLDS.admin.red)
      expect(count).toBeGreaterThanOrEqual(ERROR_5XX_THRESHOLDS.admin.amber)
      // 13 admin errors = ambar, NO rojo
    })

    it('/api/profile sigue siendo user_facing y MUY estricto', () => {
      expect(classifyEndpoint('/api/profile')).toBe('user_facing')
      // 1 solo error en user_facing = ambar
      expect(1).toBeGreaterThanOrEqual(ERROR_5XX_THRESHOLDS.user_facing.amber)
    })
  })
})
