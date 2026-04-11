/**
 * Tests para admin-delete-user: schemas y queries
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import {
  deleteUserRequestSchema,
  deleteUserResponseSchema,
  deleteUserErrorSchema,
} from '@/lib/api/admin-delete-user/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Admin Delete User - Schemas', () => {
  describe('deleteUserRequestSchema', () => {
    it('should accept valid UUID userId', () => {
      const result = deleteUserRequestSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000'
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing userId', () => {
      const result = deleteUserRequestSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('should reject invalid UUID', () => {
      const result = deleteUserRequestSchema.safeParse({
        userId: 'not-a-uuid'
      })
      expect(result.success).toBe(false)
    })
  })

  describe('deleteUserResponseSchema', () => {
    it('should accept valid response with deletion results', () => {
      const result = deleteUserResponseSchema.safeParse({
        success: true,
        message: 'Usuario eliminado correctamente',
        details: [
          { table: 'pwa_events', status: 'deleted' },
          { table: 'test_questions', status: 'skipped', reason: 'Table does not exist' },
          { table: 'auth.users', status: 'deleted' }
        ]
      })
      expect(result.success).toBe(true)
    })

    it('should accept response with error results', () => {
      const result = deleteUserResponseSchema.safeParse({
        success: true,
        message: 'Usuario eliminado correctamente',
        details: [
          { table: 'user_profiles', status: 'error', error: 'FK constraint' }
        ]
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid status value', () => {
      const result = deleteUserResponseSchema.safeParse({
        success: true,
        message: 'Test',
        details: [
          { table: 'test', status: 'unknown' }
        ]
      })
      expect(result.success).toBe(false)
    })
  })

  describe('deleteUserErrorSchema', () => {
    it('should accept valid error response', () => {
      const result = deleteUserErrorSchema.safeParse({
        success: false,
        error: 'userId es requerido'
      })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================
// QUERY TESTS
// ============================================

describe('Admin Delete User - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  // Helper para mockear drizzle-orm con sql.raw + sql template tag
  function mockDrizzle(executeMock: jest.Mock) {
    // sql is both a function (template tag) and has .raw method
    const sqlFn: any = (strings: TemplateStringsArray, ...values: unknown[]) => {
      // Return a placeholder that can be passed to execute()
      return { strings, values, _type: 'sql' }
    }
    sqlFn.raw = (str: string) => str

    jest.doMock('@/db/client', () => ({
      getDb: () => ({ execute: executeMock }),
    }))
    jest.doMock('drizzle-orm', () => ({ sql: sqlFn }))
  }

  it('should archive payment_settlements before deleting', async () => {
    // SELECT devuelve filas, todas las demás queries tienen éxito
    const paymentsRows = [
      { id: 'p1', user_id: 'user-1', amount_gross: 2000, stripe_invoice_id: 'inv_1' },
      { id: 'p2', user_id: 'user-1', amount_gross: 2000, stripe_invoice_id: 'inv_2' },
    ]
    const executeMock = jest.fn().mockImplementation((sqlArg: any) => {
      // SELECT para archivado devuelve rows
      const sqlStr = typeof sqlArg === 'string' ? sqlArg : JSON.stringify(sqlArg)
      if (sqlStr.includes('SELECT') && sqlStr.includes('payment_settlements')) {
        return Promise.resolve({ rows: paymentsRows })
      }
      return Promise.resolve(undefined)
    })

    mockDrizzle(executeMock)

    const { deleteUserData } = require('@/lib/api/admin-delete-user/queries')
    const result = await deleteUserData('550e8400-e29b-41d4-a716-446655440000')

    // Debe haber una entrada _archive con conteo positivo
    const archiveEntry = result.find((r: any) => r.table === '_archive')
    expect(archiveEntry).toBeDefined()
    expect(archiveEntry?.status).toBe('deleted')
    expect(archiveEntry?.reason).toContain('payment_settlements')

    // Debe haber entrada _archive_persist
    const persistEntry = result.find((r: any) => r.table === '_archive_persist')
    expect(persistEntry).toBeDefined()
    expect(persistEntry?.status).toBe('deleted')
  })

  it('should DELETE user_profiles at the end', async () => {
    const executeMock = jest.fn().mockResolvedValue({ rows: [] })
    mockDrizzle(executeMock)

    const { deleteUserData } = require('@/lib/api/admin-delete-user/queries')
    const result = await deleteUserData('550e8400-e29b-41d4-a716-446655440000')

    const profilesEntry = result.find((r: any) => r.table === 'user_profiles')
    expect(profilesEntry).toBeDefined()
    expect(profilesEntry?.status).toBe('deleted')

    // Debe ser una de las últimas operaciones ejecutadas
    const profilesIdx = result.findIndex((r: any) => r.table === 'user_profiles')
    expect(profilesIdx).toBeGreaterThan(result.length - 3)
  })

  it('should execute deletes for tables in all three lists', async () => {
    const executeMock = jest.fn().mockResolvedValue({ rows: [] })
    mockDrizzle(executeMock)

    const { deleteUserData } = require('@/lib/api/admin-delete-user/queries')
    const result = await deleteUserData('550e8400-e29b-41d4-a716-446655440000')

    // Tablas que DEBEN aparecer en el resultado (de cada categoría):
    const expectedTables = [
      'payment_settlements',  // legal retention
      'feedback_conversations', // no cascade
      'feedback_messages',      // no cascade
      'user_interactions',      // gdpr (no FK)
      'custom_oposiciones',     // gdpr (no FK)
      'user_streaks',           // gdpr (no FK)
      'user_profiles',          // final
    ]

    for (const table of expectedTables) {
      const entry = result.find((r: any) => r.table === table)
      expect(entry).toBeDefined()
      expect(entry?.status).toBe('deleted')
    }
  })

  it('should handle table not found errors gracefully', async () => {
    const executeMock = jest.fn()
      .mockResolvedValueOnce({ rows: [] })  // SELECT archive
      .mockResolvedValueOnce(undefined)     // UPDATE archive_persist
      .mockRejectedValueOnce(new Error('relation "payment_settlements" does not exist')) // DELETE legal
      .mockResolvedValue(undefined)         // resto OK

    mockDrizzle(executeMock)

    const { deleteUserData } = require('@/lib/api/admin-delete-user/queries')
    const result = await deleteUserData('550e8400-e29b-41d4-a716-446655440000')

    const paymentsEntry = result.find((r: any) => r.table === 'payment_settlements')
    expect(paymentsEntry?.status).toBe('skipped')
    expect(paymentsEntry?.reason).toContain('does not exist')
  })

  it('should report archive errors without crashing', async () => {
    // SELECT de archivado falla
    const executeMock = jest.fn()
      .mockRejectedValueOnce(new Error('SELECT failed'))  // SELECT archive payment_settlements
      .mockResolvedValue({ rows: [] })                    // resto OK

    mockDrizzle(executeMock)

    const { deleteUserData } = require('@/lib/api/admin-delete-user/queries')
    const result = await deleteUserData('550e8400-e29b-41d4-a716-446655440000')

    // _archive entry debería existir aunque hubo fallo interno
    // (el código captura y sigue con objeto archived vacío)
    const archiveEntry = result.find((r: any) => r.table === '_archive')
    expect(archiveEntry).toBeDefined()
  })
})

// ============================================
// ARCHIVED USER DATA SCHEMA
// ============================================

describe('Archived User Data Schema', () => {
  it('should accept valid archived data structure', async () => {
    const { archivedUserDataSchema } = await import('@/lib/api/admin-delete-user/schemas')
    const result = archivedUserDataSchema.safeParse({
      archived_at: '2026-04-11T12:00:00.000Z',
      tables: {
        payment_settlements: [
          { id: 'p1', user_id: 'u1', amount_gross: 2000 },
        ],
      },
    })
    expect(result.success).toBe(true)
  })

  it('should accept empty tables object', async () => {
    const { archivedUserDataSchema } = await import('@/lib/api/admin-delete-user/schemas')
    const result = archivedUserDataSchema.safeParse({
      archived_at: '2026-04-11T12:00:00.000Z',
      tables: {},
    })
    expect(result.success).toBe(true)
  })

  it('should reject missing archived_at', async () => {
    const { archivedUserDataSchema } = await import('@/lib/api/admin-delete-user/schemas')
    const result = archivedUserDataSchema.safeParse({
      tables: {},
    })
    expect(result.success).toBe(false)
  })
})
