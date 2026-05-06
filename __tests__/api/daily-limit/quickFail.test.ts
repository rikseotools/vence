/** @jest-environment node */
// __tests__/api/daily-limit/quickFail.test.ts
// Garantiza el contrato de Phase 3 quick-fail en /api/daily-limit:
//   - Query rápida → 200 normal
//   - Query > 8s → 503 con header Retry-After
//   - Auth fail → 401 (sin tocar BD ni timeout)
//   - Otros errores → 500 (no se camufla como 503)

const mockGetUserIdFromToken = jest.fn()
const mockGetDailyLimitStatus = jest.fn()

jest.mock('@/lib/api/dailyLimit', () => ({
  getUserIdFromToken: (...args: unknown[]) => mockGetUserIdFromToken(...args),
  getDailyLimitStatus: (...args: unknown[]) => mockGetDailyLimitStatus(...args),
}))

import { GET } from '@/app/api/daily-limit/route'
import { NextRequest } from 'next/server'

function mockReq(): NextRequest {
  return {
    headers: { get: () => 'Bearer xxx' },
  } as unknown as NextRequest
}

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('GET /api/daily-limit — quick-fail (Phase 3)', () => {
  beforeEach(() => {
    mockGetUserIdFromToken.mockReset()
    mockGetDailyLimitStatus.mockReset()
  })

  test('200 cuando query responde rápido', async () => {
    mockGetUserIdFromToken.mockResolvedValue('user-1')
    mockGetDailyLimitStatus.mockResolvedValue({
      questionsToday: 5, questionsRemaining: 25, dailyLimit: 30,
      allowed: true, isPremium: false, isGraduated: false, tierLabel: 'free',
    })

    const res = await GET(mockReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.questionsToday).toBe(5)
    expect(body.dailyLimit).toBe(30)
    expect(body.isLimitReached).toBe(false)
  })

  test('401 cuando auth falla (sin tocar BD)', async () => {
    mockGetUserIdFromToken.mockResolvedValue(null)

    const res = await GET(mockReq())
    expect(res.status).toBe(401)
    expect(mockGetDailyLimitStatus).not.toHaveBeenCalled()
  })

  test('503 con Retry-After cuando query excede 8s timeout', async () => {
    mockGetUserIdFromToken.mockResolvedValue('user-1')
    const d = deferred<unknown>()
    mockGetDailyLimitStatus.mockReturnValue(d.promise)

    jest.useFakeTimers()
    try {
      const promise = GET(mockReq())
      // Avanzar más allá del timeout (8000ms)
      await jest.advanceTimersByTimeAsync(8001)

      const res = await promise
      expect(res.status).toBe(503)
      expect(res.headers.get('Retry-After')).toBe('5')

      const body = await res.json()
      expect(body.retryable).toBe(true)
      expect(body.error).toMatch(/saturado/i)
    } finally {
      jest.useRealTimers()
      d.resolve(null) // cleanup
    }
  })

  test('500 (NO 503) cuando query falla con error real', async () => {
    mockGetUserIdFromToken.mockResolvedValue('user-1')
    mockGetDailyLimitStatus.mockRejectedValue(new Error('connection refused'))

    const consoleErr = jest.spyOn(console, 'error').mockImplementation(() => {})

    const res = await GET(mockReq())
    expect(res.status).toBe(500)

    const body = await res.json()
    expect(body.error).toBe('Error interno')
    expect(body.retryable).toBeUndefined() // no se camufla como 503

    consoleErr.mockRestore()
  })

  test('query rápida no dispara timeout (no 503 falso positivo)', async () => {
    mockGetUserIdFromToken.mockResolvedValue('user-1')
    mockGetDailyLimitStatus.mockImplementation(async () => {
      // Simulamos query de 100ms — bien por debajo del timeout 8s
      await new Promise(r => setTimeout(r, 100))
      return {
        questionsToday: 0, questionsRemaining: 30, dailyLimit: 30,
        allowed: true, isPremium: false, isGraduated: false, tierLabel: 'free',
      }
    })

    const res = await GET(mockReq())
    expect(res.status).toBe(200)
  })
})
