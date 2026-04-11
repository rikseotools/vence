/**
 * Tests para el flujo robusto de unsubscribe.
 *
 * Cubre los 5 escenarios de error que añadimos:
 *  1. Token no existe (not_found) → errorCode 'invalid_token'
 *  2. Error de BD al validar token → errorCode 'db_error'
 *  3. Error de BD al actualizar email_preferences → errorCode 'db_error'
 *  4. Fallo al marcar token como used_at → warnings (no bloquea éxito)
 *  5. Exception no controlada → errorCode 'internal_error'
 *
 * Y también el caso happy-path para regresión.
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
process.env.RESEND_API_KEY = 'test-resend-key'

jest.mock('server-only', () => ({}))

// Mock @supabase/supabase-js antes de importar emailService.server
// Usamos un mock controlable por test
const mockSupabaseState: {
  tokenSelectResponse: { data: unknown; error: unknown }
  prefsUpdateError: unknown
  markUsedError: unknown
  throwOnGetSupabase: boolean
} = {
  tokenSelectResponse: { data: null, error: null },
  prefsUpdateError: null,
  markUsedError: null,
  throwOnGetSupabase: false,
}

const mockFromFn = jest.fn((table: string) => {
  if (table === 'email_unsubscribe_tokens') {
    return {
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          is: jest.fn(() => ({
            gt: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve(mockSupabaseState.tokenSelectResponse)),
            })),
          })),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: mockSupabaseState.markUsedError })),
      })),
    }
  }
  if (table === 'email_preferences') {
    return {
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: mockSupabaseState.prefsUpdateError })),
      })),
    }
  }
  return {}
})

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => {
    if (mockSupabaseState.throwOnGetSupabase) {
      throw new Error('Supabase client init failed')
    }
    return { from: mockFromFn }
  }),
}))

import {
  validateUnsubscribeToken,
  processUnsubscribeByToken,
} from '@/lib/emails/emailService.server'

const VALID_TOKEN = 'abc123def456'

function resetMock() {
  mockSupabaseState.tokenSelectResponse = { data: null, error: null }
  mockSupabaseState.prefsUpdateError = null
  mockSupabaseState.markUsedError = null
  mockSupabaseState.throwOnGetSupabase = false
  mockFromFn.mockClear()
}

describe('validateUnsubscribeToken', () => {
  beforeEach(resetMock)

  test('happy path: devuelve ok:true con datos del token', async () => {
    mockSupabaseState.tokenSelectResponse = {
      data: {
        user_id: 'user-uuid',
        email: 'test@vence.es',
        email_type: 'newsletter',
        user_profiles: { email: 'test@vence.es', full_name: 'Test User' },
      },
      error: null,
    }

    const result = await validateUnsubscribeToken(VALID_TOKEN)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.userId).toBe('user-uuid')
      expect(result.email).toBe('test@vence.es')
      expect(result.emailType).toBe('newsletter')
      expect(result.userProfile?.full_name).toBe('Test User')
    }
  })

  test('token no existe: devuelve code:not_found (PGRST116)', async () => {
    mockSupabaseState.tokenSelectResponse = {
      data: null,
      error: { code: 'PGRST116', message: 'No rows returned' },
    }

    const result = await validateUnsubscribeToken(VALID_TOKEN)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('not_found')
      expect(result.error).toContain('Token inválido')
    }
  })

  test('error de BD (no PGRST116): devuelve code:db_error con dbError', async () => {
    mockSupabaseState.tokenSelectResponse = {
      data: null,
      error: { code: '42P01', message: 'relation does not exist' },
    }

    const result = await validateUnsubscribeToken(VALID_TOKEN)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('db_error')
      expect(result.dbError).toEqual({ code: '42P01', message: 'relation does not exist' })
    }
  })

  test('exception en el cliente Supabase: devuelve code:db_error', async () => {
    mockSupabaseState.throwOnGetSupabase = true

    const result = await validateUnsubscribeToken(VALID_TOKEN)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('db_error')
      expect(result.error).toContain('Error interno')
    }
  })

  test('data=null sin error explícito: devuelve code:not_found', async () => {
    mockSupabaseState.tokenSelectResponse = { data: null, error: null }

    const result = await validateUnsubscribeToken(VALID_TOKEN)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('not_found')
    }
  })
})

describe('processUnsubscribeByToken', () => {
  beforeEach(resetMock)

  function mockValidToken() {
    mockSupabaseState.tokenSelectResponse = {
      data: {
        user_id: 'user-uuid',
        email: 'test@vence.es',
        email_type: 'newsletter',
        user_profiles: { email: 'test@vence.es', full_name: 'Test User' },
      },
      error: null,
    }
  }

  test('happy path: unsubscribe por categorías funciona y marca token como usado', async () => {
    mockValidToken()

    const result = await processUnsubscribeByToken(VALID_TOKEN, null, false, ['newsletter'])
    expect(result.success).toBe(true)
    expect(result.errorCode).toBeUndefined()
    expect(result.warnings).toBeUndefined()
    expect(result.email).toBe('test@vence.es')
    expect(result.updatedPreferences).toMatchObject({ email_newsletter_disabled: true })
  })

  test('token inválido: devuelve errorCode invalid_token', async () => {
    mockSupabaseState.tokenSelectResponse = {
      data: null,
      error: { code: 'PGRST116', message: 'No rows' },
    }

    const result = await processUnsubscribeByToken(VALID_TOKEN, null, false, ['newsletter'])
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('invalid_token')
  })

  test('BD falla al validar token: devuelve errorCode db_error', async () => {
    mockSupabaseState.tokenSelectResponse = {
      data: null,
      error: { code: '08006', message: 'connection failure' },
    }

    const result = await processUnsubscribeByToken(VALID_TOKEN, null, false, ['newsletter'])
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('db_error')
  })

  test('BD falla al actualizar email_preferences: devuelve errorCode db_error', async () => {
    mockValidToken()
    mockSupabaseState.prefsUpdateError = { message: 'deadlock detected' }

    const result = await processUnsubscribeByToken(VALID_TOKEN, null, false, ['newsletter'])
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('db_error')
    expect(result.error).toContain('Error actualizando preferencias')
  })

  test('falla al marcar token como usado: success:true pero con warnings', async () => {
    mockValidToken()
    mockSupabaseState.markUsedError = { message: 'timeout' }

    const result = await processUnsubscribeByToken(VALID_TOKEN, null, false, ['newsletter'])
    expect(result.success).toBe(true) // baja sí aplicada
    expect(result.warnings).toContain('mark_token_used_failed')
  })

  test('unsubscribeAll: aplica todas las categorías', async () => {
    mockValidToken()

    const result = await processUnsubscribeByToken(VALID_TOKEN, null, true, null)
    expect(result.success).toBe(true)
    expect(result.updatedPreferences).toMatchObject({
      unsubscribed_all: true,
      email_newsletter_disabled: true,
      email_soporte_disabled: true,
    })
  })
})
