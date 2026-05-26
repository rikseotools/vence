/**
 * Tests del endpoint POST /api/observability/vercel-log-drain (Gap 14).
 *
 * Validamos:
 *   1. Auth: rechaza sin x-ingest-secret → 401
 *   2. Misconfig: sin env var → 503
 *   3. Body NDJSON con 504 timeout (caso Gap 14) → persistido como runtime_kill
 *   4. Body con mix de relevantes + ruido → solo persiste relevantes
 *   5. Body vacío → 200 received:0 (Vercel reintentaría si 4xx/5xx)
 *
 * @jest-environment node
 */

jest.mock('@/lib/api/withErrorLogging', () => ({
  withErrorLogging: <T extends (...args: unknown[]) => unknown>(_path: string, handler: T): T =>
    handler,
}))

const mockEmit = jest.fn().mockResolvedValue(undefined)
jest.mock('@/lib/observability/emit', () => ({
  emit: (...args: unknown[]) => mockEmit(...args),
}))

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/observability/vercel-log-drain/route'

function makeRequest(body: string, secret = 'test-secret'): NextRequest {
  return new NextRequest('http://localhost/api/observability/vercel-log-drain', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-ndjson',
      'x-ingest-secret': secret,
    },
    body,
  })
}

describe('POST /api/observability/vercel-log-drain', () => {
  const ORIGINAL = process.env.OBSERVABILITY_INGEST_SECRET

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.OBSERVABILITY_INGEST_SECRET = 'test-secret'
  })

  afterAll(() => {
    process.env.OBSERVABILITY_INGEST_SECRET = ORIGINAL
  })

  test('401 si secret falta o es incorrecto', async () => {
    const body = JSON.stringify({ statusCode: 500, message: 'test' })

    const r1 = await POST(
      new NextRequest('http://localhost/api/observability/vercel-log-drain', {
        method: 'POST',
        body,
      }),
    )
    expect(r1.status).toBe(401)

    const r2 = await POST(makeRequest(body, 'wrong-secret'))
    expect(r2.status).toBe(401)

    expect(mockEmit).not.toHaveBeenCalled()
  })

  test('503 si OBSERVABILITY_INGEST_SECRET no configurado en server', async () => {
    delete process.env.OBSERVABILITY_INGEST_SECRET
    const res = await POST(makeRequest(JSON.stringify({ statusCode: 500 }), 'anything'))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toContain('OBSERVABILITY_INGEST_SECRET')
    expect(mockEmit).not.toHaveBeenCalled()
  })

  test('caso Gap 14 — NDJSON con 504 Runtime Timeout → persiste runtime_kill', async () => {
    const ndjson = JSON.stringify({
      id: 'log_xxx',
      timestamp: 1716663060000,
      message: 'Vercel Runtime Timeout Error: Task timed out after 300 seconds',
      level: 'error',
      source: 'lambda',
      deploymentId: 'dpl_abcdefgh12345',
      path: '/api/v2/admin/dashboard',
      method: 'GET',
      statusCode: 504,
      executionRegion: 'lhr1',
    })

    const res = await POST(makeRequest(ndjson))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ success: true, received: 1, persisted: 1, skipped: 0 })

    expect(mockEmit).toHaveBeenCalledTimes(1)
    const event = mockEmit.mock.calls[0][0]
    expect(event).toMatchObject({
      source: 'vercel',
      severity: 'critical',
      eventType: 'runtime_kill',
      endpoint: '/api/v2/admin/dashboard',
      httpStatus: 504,
    })
    expect(event.metadata.drain).toBe(true)
  })

  test('mix relevantes + ruido → solo persiste relevantes', async () => {
    const ndjson = [
      JSON.stringify({ statusCode: 200, message: 'OK', source: 'lambda' }), // ruido
      JSON.stringify({ statusCode: 500, message: 'boom', source: 'lambda' }), // ✓
      JSON.stringify({ level: 'info', message: 'cold start' }), // ruido
      JSON.stringify({ statusCode: 401, message: 'unauth', path: '/api/foo' }), // ✓
    ].join('\n')

    const res = await POST(makeRequest(ndjson))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ received: 4, persisted: 2, skipped: 2 })
    expect(mockEmit).toHaveBeenCalledTimes(2)
  })

  test('body vacío → 200 con received:0 (no devolvemos error a Vercel)', async () => {
    const res = await POST(makeRequest(''))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ success: true, received: 0, persisted: 0 })
    expect(mockEmit).not.toHaveBeenCalled()
  })

  test('body con líneas malformadas — ignora las rotas, procesa el resto', async () => {
    const ndjson = [
      JSON.stringify({ statusCode: 500, message: 'good' }),
      '{ broken json line',
      JSON.stringify({ statusCode: 503, message: 'also good' }),
    ].join('\n')

    const res = await POST(makeRequest(ndjson))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ received: 2, persisted: 2 })
  })

  test('si emit() de una entry lanza, el resto del batch sigue procesándose', async () => {
    mockEmit.mockReset()
    mockEmit
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('sink down'))
      .mockResolvedValueOnce(undefined)

    const ndjson = [
      JSON.stringify({ statusCode: 500, message: 'a' }),
      JSON.stringify({ statusCode: 500, message: 'b' }),
      JSON.stringify({ statusCode: 500, message: 'c' }),
    ].join('\n')

    const res = await POST(makeRequest(ndjson))
    expect(res.status).toBe(200)
    const body = await res.json()
    // received=3, persisted=2 (b falló pero a y c sí persistieron)
    expect(body).toMatchObject({ received: 3, persisted: 2, skipped: 1 })
  })
})
