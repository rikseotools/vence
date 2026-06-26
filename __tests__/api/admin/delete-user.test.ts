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

  // 🆕 2026-06-26: el borrado de datos lo hace la función SQL
  // public.delete_user_account(uuid) en UNA transacción (migración
  // 20260626_delete_user_account_fn.sql). deleteUserData es un wrapper fino
  // que la invoca por Drizzle/getAdminDb en 1 round-trip. La atomicidad, el
  // orden anti-trigger y la completitud (barrido information_schema) viven
  // AHORA en la función SQL — se validan con una verificación de integración
  // contra BD real (ver docs/maintenance/eliminacion-cuentas.md §6, "barrido
  // final hasta 0 filas"), no con mocks.
  function mockAdminDb(executeMock: jest.Mock) {
    const sqlFn: any = (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values, _type: 'sql' })
    sqlFn.raw = (str: string) => str
    jest.doMock('@/db/client', () => ({ getAdminDb: () => ({ execute: executeMock }) }))
    jest.doMock('drizzle-orm', () => ({ sql: sqlFn }))
  }

  it('calls delete_user_account exactly once and reports deleted', async () => {
    const executeMock = jest.fn().mockResolvedValue({ rows: [{ ok: true }] })
    mockAdminDb(executeMock)

    const { deleteUserData } = require('@/lib/api/admin-delete-user/queries')
    const result = await deleteUserData('550e8400-e29b-41d4-a716-446655440000')

    // 1 sola llamada (no ~52) → mata el 504 por round-trips
    expect(executeMock).toHaveBeenCalledTimes(1)
    const sqlArg = JSON.stringify(executeMock.mock.calls[0][0])
    expect(sqlArg).toContain('delete_user_account')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ table: '_delete_user_account', status: 'deleted' })
  })

  it('reports error (not throw) when the SQL function fails, so the route returns 500', async () => {
    const executeMock = jest.fn().mockRejectedValue(
      new Error('deleted_users_log row for 550e8400 is missing')
    )
    mockAdminDb(executeMock)

    const { deleteUserData } = require('@/lib/api/admin-delete-user/queries')
    const result = await deleteUserData('550e8400-e29b-41d4-a716-446655440000')

    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('error')
    expect(result[0].error).toContain('missing')
  })

  it('persistArchivedData (fallback manual) only writes when archived_data IS NULL — idempotente', async () => {
    const executeMock = jest.fn().mockResolvedValue(undefined)
    mockAdminDb(executeMock)

    const { persistArchivedData } = require('@/lib/api/admin-delete-user/queries')
    await persistArchivedData('user-1', { archived_at: '2026-06-26T00:00:00.000Z', tables: {} })

    const sqlArg = JSON.stringify(executeMock.mock.calls[0][0])
    expect(sqlArg).toContain('archived_data IS NULL')
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
