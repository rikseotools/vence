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

  // ============================================
  // REGRESSION: triggers materializadores RGPD
  // ============================================
  //
  // 2026-05-25: la migración `20260523_materialized_stats_triggers.sql`
  // introdujo 15 triggers AFTER DELETE en test_questions que UPSERT en
  // 5 stats tables con FK CASCADE a user_profiles. Sin borrado explícito
  // de esas tablas ANTES de user_profiles, la cascade re-pueblan los
  // stats vía trigger y provocan FK violation → DELETE de user_profiles
  // hace ROLLBACK silencioso. Casos B y C de RGPD fallaron así.
  //
  // Invariante de este test:
  //   1) test_questions, tests y las 5 stats tables se borran ANTES
  //      de user_profiles.
  //   2) test_questions y tests se borran ANTES de las 5 stats tables
  //      (los triggers AFTER DELETE en test_questions repueblan stats,
  //      así que limpiar test_questions primero deja las stats sin
  //      tocar al final).
  //
  // Si alguien añade una nueva tabla materializada sin actualizar
  // TABLES_TO_CLEAN_NO_CASCADE, este test falla.
  it('should delete test_questions, tests, and 5 stats tables before user_profiles (RGPD regression)', async () => {
    const executeMock = jest.fn().mockResolvedValue({ rows: [] })
    mockDrizzle(executeMock)

    const { deleteUserData } = require('@/lib/api/admin-delete-user/queries')
    const result = await deleteUserData('550e8400-e29b-41d4-a716-446655440000')

    const profilesIdx = result.findIndex((r: any) => r.table === 'user_profiles')
    expect(profilesIdx).toBeGreaterThan(-1)

    const mustBeBeforeProfiles = [
      'test_questions',
      'tests',
      'user_stats_summary',
      'user_article_stats',
      'user_daily_stats',
      'user_difficulty_stats',
      'user_hourly_stats',
    ]
    for (const table of mustBeBeforeProfiles) {
      const idx = result.findIndex((r: any) => r.table === table)
      expect(idx).toBeGreaterThan(-1)
      expect(idx).toBeLessThan(profilesIdx)
    }
  })

  it('should delete test_questions and tests before the 5 stats tables (trigger order)', async () => {
    const executeMock = jest.fn().mockResolvedValue({ rows: [] })
    mockDrizzle(executeMock)

    const { deleteUserData } = require('@/lib/api/admin-delete-user/queries')
    const result = await deleteUserData('550e8400-e29b-41d4-a716-446655440000')

    const tqIdx = result.findIndex((r: any) => r.table === 'test_questions')
    const testsIdx = result.findIndex((r: any) => r.table === 'tests')
    const statsTables = [
      'user_stats_summary',
      'user_article_stats',
      'user_daily_stats',
      'user_difficulty_stats',
      'user_hourly_stats',
    ]
    const minStatsIdx = Math.min(
      ...statsTables.map(t => result.findIndex((r: any) => r.table === t))
    )

    expect(tqIdx).toBeGreaterThan(-1)
    expect(testsIdx).toBeGreaterThan(-1)
    expect(tqIdx).toBeLessThan(minStatsIdx)
    expect(testsIdx).toBeLessThan(minStatsIdx)
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

// ============================================
// DELETION CONFIRMATION EMAIL
// ============================================

describe('sendDeletionConfirmationEmail', () => {
  const mockSend = jest.fn()

  beforeEach(() => {
    jest.resetModules()
    mockSend.mockReset()
    jest.doMock('resend', () => ({
      Resend: jest.fn().mockImplementation(() => ({
        emails: { send: mockSend },
      })),
    }))
    process.env.RESEND_API_KEY = 'test-key'
    process.env.EMAIL_FROM_ADDRESS = 'info@vence.es'
    process.env.EMAIL_FROM_NAME = 'Vence.es'
  })

  it('should send email with first name greeting when fullName provided', async () => {
    mockSend.mockResolvedValue({ data: { id: 'email-123' }, error: null })

    const { sendDeletionConfirmationEmail } = require('@/lib/api/admin-delete-user/email')
    const result = await sendDeletionConfirmationEmail({
      email: 'test@example.com',
      fullName: 'Cristina Hernandez Espinosa',
    })

    expect(result.sent).toBe(true)
    expect(result.emailId).toBe('email-123')
    expect(mockSend).toHaveBeenCalledTimes(1)
    const callArgs = mockSend.mock.calls[0][0]
    expect(callArgs.to).toEqual(['test@example.com'])
    expect(callArgs.subject).toContain('eliminación de cuenta')
    expect(callArgs.html).toContain('Hola Cristina')
    expect(callArgs.html).toContain('ha sido eliminada')
  })

  it('should fall back to generic greeting when fullName is null', async () => {
    mockSend.mockResolvedValue({ data: { id: 'email-124' }, error: null })

    const { sendDeletionConfirmationEmail } = require('@/lib/api/admin-delete-user/email')
    const result = await sendDeletionConfirmationEmail({
      email: 'test@example.com',
      fullName: null,
    })

    expect(result.sent).toBe(true)
    const callArgs = mockSend.mock.calls[0][0]
    expect(callArgs.html).toContain('Hola,')
    expect(callArgs.html).not.toContain('Hola null')
  })

  it('should extract only first name from full name', async () => {
    mockSend.mockResolvedValue({ data: { id: 'email-125' }, error: null })

    const { sendDeletionConfirmationEmail } = require('@/lib/api/admin-delete-user/email')
    await sendDeletionConfirmationEmail({
      email: 'test@example.com',
      fullName: 'María José García López',
    })

    const callArgs = mockSend.mock.calls[0][0]
    expect(callArgs.html).toContain('Hola María')
    expect(callArgs.html).not.toContain('Hola María José')
  })

  it('should return error when email is invalid', async () => {
    const { sendDeletionConfirmationEmail } = require('@/lib/api/admin-delete-user/email')
    const result = await sendDeletionConfirmationEmail({ email: 'invalid' })

    expect(result.sent).toBe(false)
    expect(result.error).toContain('inválido')
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('should return error when email is empty', async () => {
    const { sendDeletionConfirmationEmail } = require('@/lib/api/admin-delete-user/email')
    const result = await sendDeletionConfirmationEmail({ email: '' })

    expect(result.sent).toBe(false)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('should handle Resend API errors gracefully', async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: 'Invalid recipient' } })

    const { sendDeletionConfirmationEmail } = require('@/lib/api/admin-delete-user/email')
    const result = await sendDeletionConfirmationEmail({
      email: 'test@example.com',
      fullName: 'Test',
    })

    expect(result.sent).toBe(false)
    expect(result.error).toBe('Invalid recipient')
  })

  it('should handle Resend exceptions gracefully', async () => {
    mockSend.mockRejectedValue(new Error('Network down'))

    const { sendDeletionConfirmationEmail } = require('@/lib/api/admin-delete-user/email')
    const result = await sendDeletionConfirmationEmail({
      email: 'test@example.com',
      fullName: 'Test',
    })

    expect(result.sent).toBe(false)
    expect(result.error).toBe('Network down')
  })

  it('should return error when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY

    const { sendDeletionConfirmationEmail } = require('@/lib/api/admin-delete-user/email')
    const result = await sendDeletionConfirmationEmail({
      email: 'test@example.com',
      fullName: 'Test',
    })

    expect(result.sent).toBe(false)
    expect(result.error).toContain('RESEND_API_KEY')
    expect(mockSend).not.toHaveBeenCalled()
  })
})
