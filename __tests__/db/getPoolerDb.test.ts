// __tests__/db/getPoolerDb.test.ts
// Tests del feature flag USE_SELF_HOSTED_POOLER y la fallback rollback-safe.
// Mismo patrón que getReadDb: rollback es 1 variable env, nunca rompe endpoint.

describe('getPoolerDb — feature flag y fallback', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    // Asegurar DATABASE_URL para que getDb() del primary inicialice
    process.env.DATABASE_URL = 'postgresql://primary/postgres'
    jest.resetModules()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('USE_SELF_HOSTED_POOLER undefined → devuelve el cliente del primary (getDb)', () => {
    delete process.env.USE_SELF_HOSTED_POOLER

    jest.doMock('drizzle-orm/postgres-js', () => ({
      drizzle: jest.fn(() => ({ _client: 'mock-drizzle' })),
    }))
    jest.doMock('postgres', () => ({
      __esModule: true,
      default: jest.fn(() => Object.assign((s: unknown) => Promise.resolve(s), { unsafe: jest.fn() })),
    }))
    jest.doMock('../../db/schema', () => ({}))

    const { getPoolerDb, getDb } = require('../../db/client')
    expect(getPoolerDb()).toBe(getDb())
  })

  it('USE_SELF_HOSTED_POOLER="false" → devuelve primary', () => {
    process.env.USE_SELF_HOSTED_POOLER = 'false'
    process.env.DATABASE_URL_SELF_POOLER = 'postgresql://pooler.vence.es:6543/postgres'

    jest.doMock('drizzle-orm/postgres-js', () => ({
      drizzle: jest.fn(() => ({ _client: 'mock-drizzle' })),
    }))
    jest.doMock('postgres', () => ({
      __esModule: true,
      default: jest.fn(() => Object.assign((s: unknown) => Promise.resolve(s), { unsafe: jest.fn() })),
    }))
    jest.doMock('../../db/schema', () => ({}))

    const { getPoolerDb, getDb } = require('../../db/client')
    expect(getPoolerDb()).toBe(getDb())
  })

  it('USE_SELF_HOSTED_POOLER="true" sin DATABASE_URL_SELF_POOLER → fallback a primary + warn', () => {
    process.env.USE_SELF_HOSTED_POOLER = 'true'
    delete process.env.DATABASE_URL_SELF_POOLER

    jest.doMock('drizzle-orm/postgres-js', () => ({
      drizzle: jest.fn(() => ({ _client: 'mock-drizzle' })),
    }))
    jest.doMock('postgres', () => ({
      __esModule: true,
      default: jest.fn(() => Object.assign((s: unknown) => Promise.resolve(s), { unsafe: jest.fn() })),
    }))
    jest.doMock('../../db/schema', () => ({}))

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const { getPoolerDb, getDb } = require('../../db/client')
    const pooler = getPoolerDb()

    expect(pooler).toBe(getDb())
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('USE_SELF_HOSTED_POOLER=true pero DATABASE_URL_SELF_POOLER no está configurado'),
    )

    warnSpy.mockRestore()
  })

  it('USE_SELF_HOSTED_POOLER="true" + DATABASE_URL_SELF_POOLER configurado → cliente distinto al primary', () => {
    process.env.USE_SELF_HOSTED_POOLER = 'true'
    process.env.DATABASE_URL = 'postgresql://primary/postgres'
    process.env.DATABASE_URL_SELF_POOLER = 'postgresql://pooler.vence.es:6543/postgres'

    let drizzleCallCount = 0
    jest.doMock('drizzle-orm/postgres-js', () => ({
      drizzle: jest.fn(() => ({ _id: ++drizzleCallCount })),
    }))
    jest.doMock('postgres', () => ({
      __esModule: true,
      default: jest.fn(() => Object.assign((s: unknown) => Promise.resolve(s), { unsafe: jest.fn() })),
    }))
    jest.doMock('../../db/schema', () => ({}))

    const { getPoolerDb, getDb } = require('../../db/client')
    const primaryDb = getDb()
    const pooler = getPoolerDb()

    expect(pooler).not.toBe(primaryDb)
  })

  it('llamadas múltiples reutilizan la MISMA instancia (singleton)', () => {
    process.env.USE_SELF_HOSTED_POOLER = 'true'
    process.env.DATABASE_URL_SELF_POOLER = 'postgresql://pooler.vence.es:6543/postgres'

    let drizzleCallCount = 0
    jest.doMock('drizzle-orm/postgres-js', () => ({
      drizzle: jest.fn(() => ({ _id: ++drizzleCallCount })),
    }))
    jest.doMock('postgres', () => ({
      __esModule: true,
      default: jest.fn(() => Object.assign((s: unknown) => Promise.resolve(s), { unsafe: jest.fn() })),
    }))
    jest.doMock('../../db/schema', () => ({}))

    const { getPoolerDb } = require('../../db/client')
    const a = getPoolerDb()
    const b = getPoolerDb()
    const c = getPoolerDb()

    expect(a).toBe(b)
    expect(b).toBe(c)
  })
})
