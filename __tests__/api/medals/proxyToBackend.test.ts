/**
 * Tests del proxy condicional al backend NestJS (Bloque 3 canary).
 *
 * @jest-environment node
 *
 * Verifica que:
 *  - Con flag OFF (estado inicial), el route SIGUE comportándose como
 *    antes — cero regresión.
 *  - Con flag ON, el route hace proxy al backend y devuelve su respuesta.
 *  - Si el backend falla, fallback al path local (graceful).
 */

jest.mock('../../../lib/api/medals', () => ({
  safeParseGetMedalsRequest: jest.fn(),
  safeParseCheckMedalsRequest: jest.fn(),
  getUserMedals: jest.fn(),
  checkAndSaveNewMedals: jest.fn(),
}))

jest.mock('../../../lib/cache/redis', () => ({
  getCached: jest.fn(),
  setCached: jest.fn(),
  invalidate: jest.fn(),
}))

jest.mock('../../../lib/db/timeout', () => ({
  withDbTimeout: jest.fn((fn) => fn()),
  isDbTimeoutError: jest.fn(() => false),
}))

const mockShouldRoute = jest.fn()
jest.mock('../../../lib/api/backend-router', () => ({
  shouldRouteToBackend: (...args: unknown[]) => mockShouldRoute(...args),
  backendUrlFor: (path: string) => `https://api.vence.es/${path.replace(/^\/+/, '')}`,
}))

import { GET } from '../../../app/api/medals/route'
import { safeParseGetMedalsRequest, getUserMedals } from '../../../lib/api/medals'
import { getCached } from '../../../lib/cache/redis'
import { NextRequest } from 'next/server'

const USER_ID = '3260627f-2018-4a5e-8234-e6f07015abb9'

function makeReq(): NextRequest {
  return new NextRequest(`http://localhost/api/medals?userId=${USER_ID}`)
}

describe('GET /api/medals — proxy canary al backend', () => {
  let fetchSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    ;(safeParseGetMedalsRequest as jest.Mock).mockReturnValue({
      success: true,
      data: { userId: USER_ID },
    })
    fetchSpy = jest.spyOn(global, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  describe('flag OFF (estado inicial)', () => {
    beforeEach(() => {
      mockShouldRoute.mockReturnValue(false)
    })

    it('NO llama al backend canary (regresión: comportamiento idéntico al pre-canary)', async () => {
      ;(getCached as jest.Mock).mockResolvedValue(null)
      ;(getUserMedals as jest.Mock).mockResolvedValue({
        success: true,
        medals: [],
      })

      const res = await GET(makeReq())

      expect(fetchSpy).not.toHaveBeenCalled()
      expect(res.status).toBe(200)
      expect(getUserMedals).toHaveBeenCalledWith(USER_ID)
    })
  })

  describe('flag ON (canary activo)', () => {
    beforeEach(() => {
      mockShouldRoute.mockReturnValue(true)
    })

    it('proxiea al backend y devuelve su respuesta tal cual', async () => {
      const backendBody = JSON.stringify({
        success: true,
        medals: [{ id: 'volume_leader', title: 'Test', unlocked: true }],
      })
      fetchSpy.mockResolvedValue(
        new Response(backendBody, {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'x-medals-cache': 'hit',
            'x-served-by': 'vence-backend',
          },
        }),
      )

      const res = await GET(makeReq())

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(fetchSpy.mock.calls[0][0]).toBe(
        `https://api.vence.es/api/medals?userId=${USER_ID}`,
      )
      expect(res.status).toBe(200)
      expect(res.headers.get('x-served-by')).toBe('vence-backend')
      expect(res.headers.get('x-medals-cache')).toBe('hit')
      // Body intacto
      const body = await res.text()
      expect(body).toBe(backendBody)
      // NUNCA toca getUserMedals si proxy OK
      expect(getUserMedals).not.toHaveBeenCalled()
    })

    it('proxiea status non-200 también (no convierte 503 en 200)', async () => {
      fetchSpy.mockResolvedValue(
        new Response('{"success":false,"error":"saturated"}', {
          status: 503,
          headers: { 'content-type': 'application/json' },
        }),
      )

      const res = await GET(makeReq())

      expect(res.status).toBe(503)
      expect(getUserMedals).not.toHaveBeenCalled()
    })

    it('si backend falla (fetch throws), fallback graceful al path Vercel local', async () => {
      fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'))
      ;(getCached as jest.Mock).mockResolvedValue(null)
      ;(getUserMedals as jest.Mock).mockResolvedValue({
        success: true,
        medals: [{ id: 'fallback_medal', title: 'F', unlocked: true }],
      })

      const res = await GET(makeReq())

      // Backend intentado y falló
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      // Path local ejecutado como fallback
      expect(getUserMedals).toHaveBeenCalledWith(USER_ID)
      expect(res.status).toBe(200)
    })

    it('si backend tarda >5s, AbortController lo corta y fallback al path local', async () => {
      // Simular fetch que nunca resuelve hasta abort
      fetchSpy.mockImplementation(
        (_url: string, opts: RequestInit) =>
          new Promise((_resolve, reject) => {
            opts.signal?.addEventListener('abort', () => {
              const err = new Error('aborted')
              err.name = 'AbortError'
              reject(err)
            })
          }),
      )
      ;(getCached as jest.Mock).mockResolvedValue(null)
      ;(getUserMedals as jest.Mock).mockResolvedValue({
        success: true,
        medals: [],
      })

      const promise = GET(makeReq())
      // Avanzar fake timers para disparar el setTimeout interno (5s)
      jest.useFakeTimers()
      jest.advanceTimersByTime(5100)
      const res = await promise
      jest.useRealTimers()

      expect(getUserMedals).toHaveBeenCalled()
      expect(res.status).toBe(200)
    }, 10000)
  })

  describe('validación pre-proxy', () => {
    it('si userId es inválido, devuelve 400 ANTES de tocar backend', async () => {
      mockShouldRoute.mockReturnValue(true)
      ;(safeParseGetMedalsRequest as jest.Mock).mockReturnValue({
        success: false,
        error: 'invalid uuid',
      })

      const res = await GET(makeReq())

      expect(res.status).toBe(400)
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(getUserMedals).not.toHaveBeenCalled()
    })
  })
})
