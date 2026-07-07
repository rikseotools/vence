// __tests__/cache/versionedCache.test.ts
// Cubre el infra de invalidación cross-instancia agnóstica (Postgres/Drizzle).

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

// --- Estado mutable del mock de BD (prefijo `mock` obligado por jest) ---
const mockState = { version: 0, throw: false }
jest.mock('@/db/client', () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            if (mockState.throw) throw new Error('db down')
            return mockState.version > 0 ? [{ version: mockState.version }] : []
          },
        }),
      }),
    }),
  }),
  getAdminDb: () => ({
    execute: async () => {
      mockState.version += 1
      return [{ version: mockState.version }]
    },
  }),
}))

// globalCache real pero con TTL 0 (no cachea entre asserts del test)
jest.mock('@/lib/cache/globalCache', () => {
  const actual = jest.requireActual('@/lib/cache/globalCache')
  return { ...actual, createGlobalCache: (key: string) => actual.createGlobalCache(key, 0) }
})

beforeEach(() => {
  mockKeyParts.length = 0
  mockState.version = 0
  mockState.throw = false
})

describe('versionStore', () => {
  test('getCacheVersion devuelve 0 cuando el tag no existe', async () => {
    expect(await getCacheVersion('nope')).toBe(0)
  })

  test('getCacheVersion devuelve la versión de la BD', async () => {
    mockState.version = 7
    expect(await getCacheVersion('some-tag')).toBe(7)
  })

  test('getCacheVersion degrada a 0 si la BD falla (no rompe el render)', async () => {
    mockState.throw = true
    expect(await getCacheVersion('boom')).toBe(0)
  })

  test('bumpCacheVersion incrementa y devuelve la nueva versión', async () => {
    expect(await bumpCacheVersion('t')).toBe(1)
    expect(await bumpCacheVersion('t')).toBe(2)
  })
})

describe('versionedCache', () => {
  test('mete tag + versión en la clave del unstable_cache', async () => {
    mockState.version = 3
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

    mockState.version = 1
    await wrapped()
    mockState.version = 2 // simula un bump en otra instancia
    await wrapped()

    expect(mockKeyParts[0]).toContain('v1')
    expect(mockKeyParts[1]).toContain('v2')
    expect(mockKeyParts[0]).not.toEqual(mockKeyParts[1])
  })
})
