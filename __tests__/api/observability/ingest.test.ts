/**
 * Tests del endpoint POST /api/observability/ingest (Bloque 4, Gap 2).
 *
 * Validamos:
 *   1. Auth: rechaza sin header `x-ingest-secret` correcto → 401
 *   2. Misconfig: sin env var OBSERVABILITY_INGEST_SECRET → 503
 *   3. JSON inválido → 400
 *   4. Validation Zod: shape inválido → 400 con mensaje del campo
 *   5. Batch válido: INSERT correcto + response {success:true, inserted:N}
 *   6. Batch máx 50 events (Zod schema)
 *   7. Batch mín 1 event (Zod schema)
 *
 * Mockeamos `getAdminDb` para verificar el INSERT sin tocar BD real.
 *
 * @jest-environment node
 */

jest.mock('@/lib/api/withErrorLogging', () => ({
  withErrorLogging: <T extends (...args: unknown[]) => unknown>(_path: string, handler: T): T =>
    handler,
}))

const mockExecute = jest.fn()
jest.mock('@/db/client', () => ({
  getAdminDb: jest.fn(() => ({
    execute: mockExecute,
  })),
}))

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/observability/ingest/route'

const VALID_EVENT = {
  source: 'gha' as const,
  severity: 'error' as const,
  eventType: 'workflow_failed',
  endpoint: 'Deploy backend',
  errorMessage: 'docker build failed',
  metadata: { runId: '12345', conclusion: 'failure' },
}

function makeRequest(body: unknown, secret = 'test-ingest-secret'): NextRequest {
  return new NextRequest('http://localhost/api/observability/ingest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ingest-secret': secret,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/observability/ingest', () => {
  const ORIGINAL_SECRET = process.env.OBSERVABILITY_INGEST_SECRET

  beforeEach(() => {
    jest.clearAllMocks()
    mockExecute.mockResolvedValue([])
    process.env.OBSERVABILITY_INGEST_SECRET = 'test-ingest-secret'
  })

  afterAll(() => {
    process.env.OBSERVABILITY_INGEST_SECRET = ORIGINAL_SECRET
  })

  // ────────────────────────────────────────────────────────────────
  // AUTH
  // ────────────────────────────────────────────────────────────────
  describe('auth — modo A (server-to-server con secret)', () => {
    it('rechaza secret incorrecto con 401', async () => {
      const res = await POST(makeRequest({ events: [VALID_EVENT] }, 'wrong'))
      expect(res.status).toBe(401)
      expect(mockExecute).not.toHaveBeenCalled()
    })

    it('rechaza sin headers (ni secret ni origin válido) con 401', async () => {
      const req = new NextRequest('http://localhost/api/observability/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: [VALID_EVENT] }),
      })
      const res = await POST(req)
      expect(res.status).toBe(401)
      expect(mockExecute).not.toHaveBeenCalled()
    })

    it('secret válido acepta CUALQUIER source (server confianza alta)', async () => {
      const res = await POST(makeRequest({ events: [VALID_EVENT] })) // source='gha'
      expect(res.status).toBe(200)
      expect(mockExecute).toHaveBeenCalledTimes(1)
    })
  })

  describe('auth — modo B (client-side con Origin)', () => {
    function makeClientRequest(events: unknown[], origin: string): NextRequest {
      return new NextRequest('http://localhost/api/observability/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin,
        },
        body: JSON.stringify({ events }),
      })
    }

    it.each([
      ['https://www.vence.es'],
      ['https://vence.es'],
      ['https://preview-123.vercel.app'],
    ])('acepta Origin "%s" con source=frontend', async (origin) => {
      const frontendEvent = {
        source: 'frontend' as const,
        severity: 'error' as const,
        eventType: 'js_uncaught',
        errorMessage: 'TypeError: x is undefined',
      }
      const res = await POST(makeClientRequest([frontendEvent], origin))
      expect(res.status).toBe(200)
      expect(mockExecute).toHaveBeenCalledTimes(1)
    })

    it.each([
      ['https://evil.com'],
      ['http://www.vence.es'], // http, no https
      ['https://www.vence.com'], // .com, no .es
    ])('rechaza Origin "%s" con 401', async (origin) => {
      const res = await POST(
        makeClientRequest(
          [
            {
              source: 'frontend',
              severity: 'error',
              eventType: 'js_uncaught',
            },
          ],
          origin,
        ),
      )
      expect(res.status).toBe(401)
      expect(mockExecute).not.toHaveBeenCalled()
    })

    it('Origin válido pero source NO frontend → 403 (anti-spam alertas)', async () => {
      const fakeServerEvent = {
        source: 'fargate', // ¡intento de fake!
        severity: 'critical',
        eventType: 'http_5xx',
        errorMessage: 'spam attempt',
      }
      const res = await POST(
        makeClientRequest([fakeServerEvent], 'https://www.vence.es'),
      )
      expect(res.status).toBe(403)
      expect(mockExecute).not.toHaveBeenCalled()
    })

    it('Origin válido con mix frontend + fake fargate → 403 (rechaza todo el batch)', async () => {
      const events = [
        { source: 'frontend', severity: 'error', eventType: 'js_uncaught' },
        { source: 'fargate', severity: 'critical', eventType: 'http_5xx' }, // fake
      ]
      const res = await POST(makeClientRequest(events, 'https://www.vence.es'))
      expect(res.status).toBe(403)
      expect(mockExecute).not.toHaveBeenCalled()
    })
  })

  // ────────────────────────────────────────────────────────────────
  // VALIDACIÓN BODY
  // ────────────────────────────────────────────────────────────────
  describe('validación body', () => {
    it('rechaza JSON inválido con 400', async () => {
      const req = new NextRequest('http://localhost/api/observability/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ingest-secret': 'test-ingest-secret',
        },
        body: 'not-json',
      })
      const res = await POST(req)
      expect(res.status).toBe(400)
    })

    it('rechaza events vacío con 400', async () => {
      const res = await POST(makeRequest({ events: [] }))
      expect(res.status).toBe(400)
      expect(mockExecute).not.toHaveBeenCalled()
    })

    it('rechaza events > 50 con 400', async () => {
      const events = Array.from({ length: 51 }, () => VALID_EVENT)
      const res = await POST(makeRequest({ events }))
      expect(res.status).toBe(400)
      expect(mockExecute).not.toHaveBeenCalled()
    })

    it.each([
      ['source inválido', { ...VALID_EVENT, source: 'mars' }],
      ['severity inválido', { ...VALID_EVENT, severity: 'panic' }],
      ['eventType vacío', { ...VALID_EVENT, eventType: '' }],
      ['httpStatus fuera de rango', { ...VALID_EVENT, httpStatus: 999 }],
      ['userId no UUID', { ...VALID_EVENT, userId: 'not-uuid' }],
    ])('rechaza %s con 400', async (_, invalidEvent) => {
      const res = await POST(makeRequest({ events: [invalidEvent] }))
      expect(res.status).toBe(400)
      expect(mockExecute).not.toHaveBeenCalled()
    })
  })

  // ────────────────────────────────────────────────────────────────
  // HAPPY PATH
  // ────────────────────────────────────────────────────────────────
  describe('batch INSERT', () => {
    it('1 evento válido → 200 + inserted:1 + 1 execute', async () => {
      const res = await POST(makeRequest({ events: [VALID_EVENT] }))
      const body = await res.json()
      expect(res.status).toBe(200)
      expect(body).toEqual({ success: true, inserted: 1 })
      expect(mockExecute).toHaveBeenCalledTimes(1)
    })

    it('5 eventos válidos → 200 + inserted:5 + 5 executes', async () => {
      const events = Array.from({ length: 5 }, () => VALID_EVENT)
      const res = await POST(makeRequest({ events }))
      const body = await res.json()
      expect(res.status).toBe(200)
      expect(body).toEqual({ success: true, inserted: 5 })
      expect(mockExecute).toHaveBeenCalledTimes(5)
    })

    it('soporta evento con todos los campos opcionales nullos', async () => {
      const minimalEvent = {
        source: 'frontend',
        severity: 'warn',
        eventType: 'console_error',
      }
      const res = await POST(makeRequest({ events: [minimalEvent] }))
      expect(res.status).toBe(200)
      expect(mockExecute).toHaveBeenCalledTimes(1)
    })

    it('soporta evento con metadata jsonb compleja', async () => {
      const event = {
        ...VALID_EVENT,
        metadata: { nested: { a: 1, b: ['x', 'y'] }, flag: true },
      }
      const res = await POST(makeRequest({ events: [event] }))
      expect(res.status).toBe(200)
      expect(mockExecute).toHaveBeenCalledTimes(1)
    })
  })

  // ────────────────────────────────────────────────────────────────
  // BD ERROR HANDLING
  // ────────────────────────────────────────────────────────────────
  describe('BD error handling', () => {
    it('devuelve 500 si execute lanza', async () => {
      mockExecute.mockRejectedValueOnce(new Error('connection refused'))
      const res = await POST(makeRequest({ events: [VALID_EVENT] }))
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.success).toBe(false)
    })
  })
})
