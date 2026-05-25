/**
 * @jest-environment node
 */
// __tests__/lib/api/withErrorLogging.errorRef.test.ts
// Tests runtime del feature errorRef en withErrorLogging:
// - 5xx: inyecta errorRef en body + llama a logValidationError con el mismo id
// - 4xx: NO inyecta errorRef (solo ruido)
// - throw sin catch: genera errorRef y lo devuelve en respuesta 500 genérica

process.env.VERCEL_GIT_COMMIT_SHA = 'abcdef12' // force non-local so logValidationError no-ops check passes

// Mock loggers. Política 2026-05-25:
//   - logValidationError      → fire-and-forget para 4xx
//   - logValidationErrorAwait → awaitable para 5xx (garantiza persistencia
//     antes del fin de la lambda)
jest.mock('@/lib/api/validation-error-log', () => ({
  logValidationError: jest.fn(),
  logValidationErrorAwait: jest.fn(async () => {}),
  classifyError: jest.fn(() => 'unknown'),
}))

import { NextResponse } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { logValidationError, logValidationErrorAwait } from '@/lib/api/validation-error-log'

const mockLog = logValidationError as jest.Mock
const mockLogAwait = logValidationErrorAwait as jest.Mock

function makeRequest(method = 'POST', body: unknown = {}): Request {
  return new Request('https://www.vence.es/api/test', {
    method,
    headers: { 'content-type': 'application/json', 'user-agent': 'jest' },
    body: JSON.stringify(body),
  })
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('withErrorLogging — errorRef injection', () => {
  beforeEach(() => {
    mockLog.mockClear()
    mockLogAwait.mockClear()
  })

  test('5xx desde handler: inyecta errorRef en body y en log', async () => {
    const handler = jest.fn(async () =>
      NextResponse.json({ success: false, error: 'DB down', errorCode: 'db_error' }, { status: 500 })
    )
    const wrapped = withErrorLogging('/api/test', handler)

    const res = await wrapped(makeRequest('POST', { foo: 'bar' }))
    expect(res.status).toBe(500)

    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toBe('DB down')
    expect(body.errorCode).toBe('db_error')
    expect(body.errorRef).toMatch(UUID_REGEX)

    expect(mockLogAwait).toHaveBeenCalledTimes(1)
    expect(mockLog).not.toHaveBeenCalled()
    const logged = mockLogAwait.mock.calls[0][0]
    expect(logged.id).toBe(body.errorRef)
    expect(logged.severity).toBe('critical')
    expect(logged.httpStatus).toBe(500)
    expect(logged.errorMessage).toBe('DB down')
  })

  test('4xx: NO inyecta errorRef (solo log info)', async () => {
    const handler = jest.fn(async () =>
      NextResponse.json({ success: false, error: 'Token inválido', errorCode: 'invalid_token' }, { status: 400 })
    )
    const wrapped = withErrorLogging('/api/test', handler)

    const res = await wrapped(makeRequest('POST', { token: 'xxx' }))
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.errorRef).toBeUndefined()

    expect(mockLog).toHaveBeenCalledTimes(1)
    expect(mockLog.mock.calls[0][0].severity).toBe('info')
    expect(mockLog.mock.calls[0][0].id).toBeUndefined()
  })

  test('2xx: no inyecta errorRef ni loguea', async () => {
    const handler = jest.fn(async () =>
      NextResponse.json({ success: true }, { status: 200 })
    )
    const wrapped = withErrorLogging('/api/test', handler)

    const res = await wrapped(makeRequest('POST', { foo: 'bar' }))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.errorRef).toBeUndefined()
    expect(mockLog).not.toHaveBeenCalled()
  })

  test('throw sin catch: genera errorRef y 500 genérico', async () => {
    const handler = jest.fn(async () => {
      throw new Error('unexpected boom')
    })
    const wrapped = withErrorLogging('/api/test', handler)

    const res = await wrapped(makeRequest('POST', { foo: 'bar' }))
    expect(res.status).toBe(500)

    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toBe('Error interno del servidor')
    expect(body.errorRef).toMatch(UUID_REGEX)

    expect(mockLogAwait).toHaveBeenCalledTimes(1)
    expect(mockLog).not.toHaveBeenCalled()
    const logged = mockLogAwait.mock.calls[0][0]
    expect(logged.id).toBe(body.errorRef)
    expect(logged.severity).toBe('critical')
    expect(logged.errorMessage).toBe('unexpected boom')
    expect(logged.errorStack).toContain('Error: unexpected boom')
  })

  test('cada 5xx genera un errorRef diferente (unicidad)', async () => {
    const handler = jest.fn(async () =>
      NextResponse.json({ error: 'boom' }, { status: 500 })
    )
    const wrapped = withErrorLogging('/api/test', handler)

    const [r1, r2] = await Promise.all([
      wrapped(makeRequest('POST', {})),
      wrapped(makeRequest('POST', {})),
    ])
    const [b1, b2] = await Promise.all([r1.json(), r2.json()])

    expect(b1.errorRef).toMatch(UUID_REGEX)
    expect(b2.errorRef).toMatch(UUID_REGEX)
    expect(b1.errorRef).not.toBe(b2.errorRef)
  })
})
