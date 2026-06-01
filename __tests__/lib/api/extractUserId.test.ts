// __tests__/lib/api/extractUserId.test.ts
// Tests unitarios para extractUserIdFromRequest — función pura usada por
// withErrorLogging para enriquecer logs de error con el userId real del cliente.

import { extractUserIdFromRequest } from '@/lib/api/extractUserId'

describe('extractUserIdFromRequest — cascada body → responseBody → queryParam', () => {
  // ============================================================
  // PRIORIDAD 1 — body.userId (POST/PUT/PATCH)
  // ============================================================
  describe('Prioridad 1: body.userId', () => {
    it('extrae userId del body cuando es string no vacío', () => {
      const request = new Request('https://app.test/api/answer')
      const body = { userId: 'user-abc-123', questionId: 'q-1' }
      expect(extractUserIdFromRequest(request, body, null)).toBe('user-abc-123')
    })

    it('body.userId tiene prioridad sobre responseBody.userId', () => {
      const request = new Request('https://app.test/api/answer')
      const body = { userId: 'from-body' }
      const responseBody = { userId: 'from-response' }
      expect(extractUserIdFromRequest(request, body, responseBody)).toBe('from-body')
    })

    it('body.userId tiene prioridad sobre query param', () => {
      const request = new Request('https://app.test/api/profile?userId=from-query')
      const body = { userId: 'from-body' }
      expect(extractUserIdFromRequest(request, body, null)).toBe('from-body')
    })

    it('body.userId vacío string NO se devuelve (cae a siguiente fuente)', () => {
      const request = new Request('https://app.test/api/profile?userId=from-query')
      const body = { userId: '' }
      expect(extractUserIdFromRequest(request, body, null)).toBe('from-query')
    })

    it('body.userId no-string (number, null, object) NO se devuelve', () => {
      const request = new Request('https://app.test/api/profile?userId=from-query')
      expect(extractUserIdFromRequest(request, { userId: 123 }, null)).toBe('from-query')
      expect(extractUserIdFromRequest(request, { userId: null }, null)).toBe('from-query')
      expect(extractUserIdFromRequest(request, { userId: { id: 'x' } }, null)).toBe('from-query')
    })
  })

  // ============================================================
  // PRIORIDAD 2 — responseBody.userId
  // ============================================================
  describe('Prioridad 2: responseBody.userId', () => {
    it('extrae userId de responseBody si body no lo tiene', () => {
      const request = new Request('https://app.test/api/v2/answer-and-save', { method: 'POST' })
      const responseBody = { userId: 'user-from-response', blockedReason: 'device_limit' }
      expect(extractUserIdFromRequest(request, {}, responseBody)).toBe('user-from-response')
    })

    it('responseBody.userId tiene prioridad sobre query param', () => {
      const request = new Request('https://app.test/api/profile?userId=from-query')
      const responseBody = { userId: 'from-response' }
      expect(extractUserIdFromRequest(request, undefined, responseBody)).toBe('from-response')
    })

    it('responseBody null no rompe', () => {
      const request = new Request('https://app.test/api/profile?userId=from-query')
      expect(extractUserIdFromRequest(request, undefined, null)).toBe('from-query')
    })

    it('responseBody undefined no rompe', () => {
      const request = new Request('https://app.test/api/profile?userId=from-query')
      expect(extractUserIdFromRequest(request, undefined, undefined)).toBe('from-query')
    })
  })

  // ============================================================
  // PRIORIDAD 3 — query param ?userId=... (CASO DEL INCIDENTE 31/05)
  // ============================================================
  describe('Prioridad 3: query param ?userId=', () => {
    it('extrae userId del query param para GET típico (/api/profile)', () => {
      const request = new Request('https://app.test/api/profile?userId=abc-xyz-456')
      expect(extractUserIdFromRequest(request, undefined, null)).toBe('abc-xyz-456')
    })

    it('extrae userId del query param con otros params presentes', () => {
      const request = new Request(
        'https://app.test/api/topics/15?userId=u1&oposicion=auxiliar-administrativo-estado&limit=20',
      )
      expect(extractUserIdFromRequest(request, undefined, null)).toBe('u1')
    })

    it('query param ausente devuelve undefined', () => {
      const request = new Request('https://app.test/api/profile?other=foo')
      expect(extractUserIdFromRequest(request, undefined, null)).toBeUndefined()
    })

    it('query param vacío (?userId=) devuelve undefined', () => {
      const request = new Request('https://app.test/api/profile?userId=')
      expect(extractUserIdFromRequest(request, undefined, null)).toBeUndefined()
    })
  })

  // ============================================================
  // CASOS DEFENSIVOS — no debe romper bajo ningún input
  // ============================================================
  describe('Defensa: nunca lanza excepción', () => {
    it('todo undefined devuelve undefined', () => {
      expect(extractUserIdFromRequest(undefined, undefined, undefined)).toBeUndefined()
    })

    it('request undefined + body con userId funciona (fallback path)', () => {
      const body = { userId: 'u1' }
      expect(extractUserIdFromRequest(undefined, body, null)).toBe('u1')
    })

    it('request con URL inválida no rompe (cae silenciosamente)', () => {
      // Simulamos request "raro" como los que aparecen en algunos entornos
      // de test que pasan objetos parciales en vez de Request real.
      const fakeRequest = { url: 'not-a-valid-url' } as unknown as Request
      expect(extractUserIdFromRequest(fakeRequest, undefined, null)).toBeUndefined()
    })

    it('request sin url no rompe', () => {
      const fakeRequest = {} as unknown as Request
      expect(extractUserIdFromRequest(fakeRequest, undefined, null)).toBeUndefined()
    })

    it('request con url null no rompe', () => {
      const fakeRequest = { url: null } as unknown as Request
      expect(extractUserIdFromRequest(fakeRequest, undefined, null)).toBeUndefined()
    })
  })

  // ============================================================
  // REGRESSION del incidente 31/05 — caso real reproducido
  // ============================================================
  describe('Regression incidente 2026-05-31 /api/profile', () => {
    it('GET /api/profile?userId=xxx devuelve xxx (antes devolvía undefined → user_id=NULL en log)', () => {
      // Reproducción exacta del caso del incidente: GET /api/profile con userId en
      // query param, sin body, sin response body útil. Antes del fix esto caía a
      // user_id=NULL → 477 errores aparecían como "1 user anónimo" cuando eran
      // 478 users reales distintos.
      const request = new Request(
        'https://www.vence.es/api/profile?userId=550e8400-e29b-41d4-a716-446655440000',
      )
      const result = extractUserIdFromRequest(request, undefined, null)
      expect(result).toBe('550e8400-e29b-41d4-a716-446655440000')
    })
  })
})
