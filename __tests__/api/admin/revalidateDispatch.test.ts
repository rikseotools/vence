/**
 * Tests de regresión del bug detectado el 2026-05-25:
 *   POST /api/admin/revalidate { tag: 'test-config' } solo invalidaba
 *   unstable_cache de Next.js, NO incrementaba cache_version:test-config
 *   en Upstash — el backend NestJS canary seguía sirviendo cache versionado
 *   viejo 6-24h.
 *
 * Fix en commit 3980cf87: mapping `TAG_INVALIDATORS` que llama al
 * invalidador específico (`invalidateTestConfigCache`) cuando el tag
 * tiene counterpart cross-runtime.
 *
 * @jest-environment node
 */

jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
}))

jest.mock('@/lib/cache/test-config', () => ({
  invalidateTestConfigCache: jest.fn(),
}))

// Evitar logs reales en validation_error_logs durante tests
jest.mock('@/lib/api/withErrorLogging', () => ({
  withErrorLogging: <T extends (...args: unknown[]) => unknown>(_path: string, handler: T): T =>
    handler,
}))

import { NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { invalidateTestConfigCache } from '@/lib/cache/test-config'
import { POST } from '@/app/api/admin/revalidate/route'

const mockRevalidateTag = revalidateTag as jest.Mock
const mockInvalidateTestConfig = invalidateTestConfigCache as jest.Mock

function makeRequest(body: unknown, secret = 'test-secret'): NextRequest {
  return new NextRequest('http://localhost/api/admin/revalidate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cron-secret': secret,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/revalidate — dispatch cross-runtime', () => {
  const ORIGINAL_SECRET = process.env.CRON_SECRET

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
  })

  afterAll(() => {
    process.env.CRON_SECRET = ORIGINAL_SECRET
  })

  // ────────────────────────────────────────────────────────────────
  // REGRESSION GUARD — el bug original
  // ────────────────────────────────────────────────────────────────
  describe('tag cross-runtime: test-config', () => {
    it('llama a invalidateTestConfigCache (NO revalidateTag genérico)', async () => {
      
      const res = await POST(makeRequest({ tag: 'test-config' }))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.revalidated).toBe('test-config')
      // 🔒 ANTI-REGRESSION GUARD: crossRuntime debe ser true.
      // Si esto baja a false, alguien rompió el mapping TAG_INVALIDATORS.
      expect(body.crossRuntime).toBe(true)

      // El invalidador específico se llama exactamente 1 vez.
      expect(mockInvalidateTestConfig).toHaveBeenCalledTimes(1)
      // El revalidateTag genérico NO se llama (el invalidador específico
      // YA lo hace internamente — llamar ambos sería doble revalidación).
      expect(mockRevalidateTag).not.toHaveBeenCalled()
    })

    it('await la promise del invalidador (sync o async)', async () => {
      // Simula un invalidador async que tarda en resolver
      let resolved = false
      mockInvalidateTestConfig.mockImplementationOnce(async () => {
        await new Promise((r) => setTimeout(r, 10))
        resolved = true
      })

      
      await POST(makeRequest({ tag: 'test-config' }))
      expect(resolved).toBe(true)
    })
  })

  // ────────────────────────────────────────────────────────────────
  // FALLBACK — tags solo-Vercel mantienen el comportamiento viejo
  // ────────────────────────────────────────────────────────────────
  describe('tags solo-Vercel (sin counterpart backend)', () => {
    it.each([
      ['temario'],
      ['teoria'],
      ['laws'],
      ['landing'],
      ['medals'],
      ['profile'],
      ['questions'],
    ])('tag "%s" usa revalidateTag genérico', async (tag) => {
      
      const res = await POST(makeRequest({ tag }))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.revalidated).toBe(tag)
      expect(body.crossRuntime).toBe(false)

      expect(mockRevalidateTag).toHaveBeenCalledTimes(1)
      expect(mockRevalidateTag).toHaveBeenCalledWith(tag, 'max')
      // El invalidador específico NO se invoca para estos tags
      expect(mockInvalidateTestConfig).not.toHaveBeenCalled()
    })
  })

  // ────────────────────────────────────────────────────────────────
  // SEGURIDAD + VALIDACIÓN
  // ────────────────────────────────────────────────────────────────
  describe('validación', () => {
    it('rechaza tag no válido con 400', async () => {
      
      const res = await POST(makeRequest({ tag: 'tag-inventado' }))
      expect(res.status).toBe(400)
      expect(mockRevalidateTag).not.toHaveBeenCalled()
      expect(mockInvalidateTestConfig).not.toHaveBeenCalled()
    })

    it('rechaza sin x-cron-secret con 401', async () => {
      
      const res = await POST(makeRequest({ tag: 'test-config' }, 'wrong'))
      expect(res.status).toBe(401)
      expect(mockInvalidateTestConfig).not.toHaveBeenCalled()
      expect(mockRevalidateTag).not.toHaveBeenCalled()
    })
  })
})
