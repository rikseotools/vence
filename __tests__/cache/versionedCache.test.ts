// __tests__/cache/versionedCache.test.ts
// Cubre el infra de invalidación cross-instancia agnóstica (versioned cache keys
// sobre el sink KV de lib/cache/redis — Upstash hoy, swappable por proveedor).

import { versionedCache } from '@/lib/cache/versionedCache'
import { getCacheVersion, bumpCacheVersion } from '@/lib/cache/versionStore'

// --- Mock next/cache: unstable_cache(fn, keyParts, opts) → captura keyParts ---
const mockKeyParts: string[][] = []
jest.mock('next/cache', () => ({
  unstable_cache: (fn: (...a: unknown[]) => unknown, keyParts: string[]) => {
    mockKeyParts.push(keyParts)
    return (...args: unknown[]) => fn(...args)
  },
}))

// --- Mock del KV agnóstico (lib/cache/redis): contador en memoria por key ---
const mockCounters: Record<string, number> = {}
let mockKvDown = false
jest.mock('@/lib/cache/redis', () => ({
  getCounter: async (key: string) => (mockKvDown ? 0 : mockCounters[key] ?? 0),
  incrementCounter: async (key: string) => {
    if (mockKvDown) return 0
    mockCounters[key] = (mockCounters[key] ?? 0) + 1
    return mockCounters[key]
  },
}))

// globalCache real pero con TTL 0 (no cachea entre asserts del test)
jest.mock('@/lib/cache/globalCache', () => {
  const actual = jest.requireActual('@/lib/cache/globalCache')
  return { ...actual, createGlobalCache: (key: string) => actual.createGlobalCache(key, 0) }
})

beforeEach(() => {
  mockKeyParts.length = 0
  for (const k of Object.keys(mockCounters)) delete mockCounters[k]
  mockKvDown = false
})

describe('versionStore (KV agnóstico)', () => {
  test('getCacheVersion devuelve 0 cuando el tag no existe', async () => {
    expect(await getCacheVersion('nope')).toBe(0)
  })

  test('usa la convención cache_version:<tag> (coherente con el backend)', async () => {
    mockCounters['cache_version:some-tag'] = 7
    expect(await getCacheVersion('some-tag')).toBe(7)
  })

  test('getCacheVersion degrada a 0 si el KV falla (no rompe el render)', async () => {
    mockKvDown = true
    expect(await getCacheVersion('boom')).toBe(0)
  })

  test('bumpCacheVersion incrementa (INCR atómico) y devuelve la nueva versión', async () => {
    expect(await bumpCacheVersion('t')).toBe(1)
    expect(await bumpCacheVersion('t')).toBe(2)
    expect(mockCounters['cache_version:t']).toBe(2)
  })
})

describe('versionedCache', () => {
  test('mete tag + versión en la clave del unstable_cache', async () => {
    mockCounters['cache_version:test-counts'] = 3
    const wrapped = versionedCache(async (x: number) => x * 2, {
      tag: 'test-counts',
      keyParts: ['theme-question-counts-v1'],
    })
    const result = await wrapped(21)
    expect(result).toBe(42)
    expect(mockKeyParts[0]).toEqual(['theme-question-counts-v1', 'test-counts', 'v3'])
  })

  test('la clave cambia al subir la versión → invalidación cross-instancia', async () => {
    const wrapped = versionedCache(async () => 'x', { tag: 'landing', keyParts: ['k'] })

    mockCounters['cache_version:landing'] = 1
    await wrapped()
    mockCounters['cache_version:landing'] = 2 // simula un INCR en otra instancia
    await wrapped()

    expect(mockKeyParts[0]).toContain('v1')
    expect(mockKeyParts[1]).toContain('v2')
    expect(mockKeyParts[0]).not.toEqual(mockKeyParts[1])
  })
})
