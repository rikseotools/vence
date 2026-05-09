// __tests__/db/getReadDb.test.ts
// Tests del feature flag USE_READ_REPLICA y la fallback rollback-safe.
// Garantiza que rollback es 1 variable env y nunca rompe el endpoint.

describe('getReadDb — feature flag y fallback', () => {
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

  it('USE_READ_REPLICA undefined → devuelve el cliente del primary (getDb)', () => {
    delete process.env.USE_READ_REPLICA

    jest.doMock('drizzle-orm/postgres-js', () => ({
      drizzle: jest.fn(() => ({ _client: 'mock-drizzle' })),
    }))
    jest.doMock('postgres', () => ({
      __esModule: true,
      default: jest.fn(() => Object.assign((s: unknown) => Promise.resolve(s), { unsafe: jest.fn() })),
    }))
    jest.doMock('../../db/schema', () => ({}))

    const { getReadDb, getDb } = require('../../db/client')
    const readDb = getReadDb()
    const primaryDb = getDb()

    // Should be the same object reference (primary)
    expect(readDb).toBe(primaryDb)
  })

  it('USE_READ_REPLICA="false" → devuelve primary', () => {
    process.env.USE_READ_REPLICA = 'false'
    process.env.DATABASE_URL_REPLICA = 'postgresql://fake-replica/postgres'

    jest.doMock('drizzle-orm/postgres-js', () => ({
      drizzle: jest.fn(() => ({ _client: 'mock-drizzle' })),
    }))
    jest.doMock('postgres', () => ({
      __esModule: true,
      default: jest.fn(() => Object.assign((s: unknown) => Promise.resolve(s), { unsafe: jest.fn() })),
    }))
    jest.doMock('../../db/schema', () => ({}))

    const { getReadDb, getDb } = require('../../db/client')
    expect(getReadDb()).toBe(getDb())
  })

  it('USE_READ_REPLICA="true" sin DATABASE_URL_REPLICA → fallback a primary + warn', () => {
    process.env.USE_READ_REPLICA = 'true'
    delete process.env.DATABASE_URL_REPLICA

    jest.doMock('drizzle-orm/postgres-js', () => ({
      drizzle: jest.fn(() => ({ _client: 'mock-drizzle' })),
    }))
    jest.doMock('postgres', () => ({
      __esModule: true,
      default: jest.fn(() => Object.assign((s: unknown) => Promise.resolve(s), { unsafe: jest.fn() })),
    }))
    jest.doMock('../../db/schema', () => ({}))

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const { getReadDb, getDb } = require('../../db/client')
    const readDb = getReadDb()

    expect(readDb).toBe(getDb())
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('USE_READ_REPLICA=true pero DATABASE_URL_REPLICA no está configurado'),
    )

    warnSpy.mockRestore()
  })

  it('USE_READ_REPLICA="true" + DATABASE_URL_REPLICA configurado → cliente distinto al primary', () => {
    process.env.USE_READ_REPLICA = 'true'
    process.env.DATABASE_URL = 'postgresql://primary/postgres'
    process.env.DATABASE_URL_REPLICA = 'postgresql://replica/postgres'

    let drizzleCallCount = 0
    jest.doMock('drizzle-orm/postgres-js', () => ({
      drizzle: jest.fn(() => ({ _id: ++drizzleCallCount })),
    }))
    jest.doMock('postgres', () => ({
      __esModule: true,
      default: jest.fn(() => Object.assign((s: unknown) => Promise.resolve(s), { unsafe: jest.fn() })),
    }))
    jest.doMock('../../db/schema', () => ({}))

    const { getReadDb, getDb } = require('../../db/client')
    const primaryDb = getDb()
    const readDb = getReadDb()

    expect(readDb).not.toBe(primaryDb)
  })
})
