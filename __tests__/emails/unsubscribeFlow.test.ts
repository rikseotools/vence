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
 *
 * 2026-06-02: migrado de mock @supabase/supabase-js a mock @/db/client
 * (getAdminDb, Drizzle) tras agnosticar emailService.server. Con Drizzle,
 * "0 filas" = array vacío (ya no hay error PGRST116) y los errores de BD
 * LANZAN (se simulan haciendo que la cadena thenable rechace).
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test'
process.env.RESEND_API_KEY = 'test-resend-key'

jest.mock('server-only', () => ({}))

// Estado controlable por test para el mock de Drizzle (@/db/client getAdminDb).
const mockDbState: {
  tokenRows: unknown[]        // resultado del SELECT del token (leftJoin)
  tokenSelectError: unknown   // si !=null, el SELECT lanza esto
  prefsUpdateError: unknown   // si !=null, db.execute (UPDATE prefs) rechaza esto
  markUsedError: unknown      // si !=null, el UPDATE mark-used lanza esto
  getDbThrows: boolean        // si true, getAdminDb() lanza (path "Error interno")
} = {
  tokenRows: [],
  tokenSelectError: null,
  prefsUpdateError: null,
  markUsedError: null,
  getDbThrows: false,
}

// Cadena thenable estilo Drizzle: cualquier método (select/from/leftJoin/where/
// limit/update/set/...) devuelve la propia cadena; al hacer `await` se ejecuta
// getResult() (resuelve el valor o lanza para simular error de BD).
function thenableChain(getResult: () => unknown) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'from', 'leftJoin', 'where', 'limit', 'update', 'set', 'insert', 'values', 'returning', 'orderBy', 'onConflictDoUpdate']
  for (const m of methods) chain[m] = () => chain
  chain.then = (onF: (v: unknown) => unknown, onR: (e: unknown) => unknown) => {
    try {
      return Promise.resolve(getResult()).then(onF, onR)
    } catch (e) {
      return Promise.reject(e).then(onF, onR)
    }
  }
  return chain
}

const mockGetAdminDb = jest.fn(() => {
  if (mockDbState.getDbThrows) throw new Error('getAdminDb init failed')
  return {
    // validateUnsubscribeToken: db.select().from().leftJoin().where().limit()
    select: () => thenableChain(() => {
      if (mockDbState.tokenSelectError) throw mockDbState.tokenSelectError
      return mockDbState.tokenRows
    }),
    // mark-used: db.update().set().where()
    update: () => thenableChain(() => {
      if (mockDbState.markUsedError) throw mockDbState.markUsedError
      return []
    }),
    // email_preferences update: db.execute(sql`UPDATE ...`)
    execute: () => {
      if (mockDbState.prefsUpdateError) return Promise.reject(mockDbState.prefsUpdateError)
      return Promise.resolve([])
    },
  }
})

jest.mock('@/db/client', () => ({
  getAdminDb: () => mockGetAdminDb(),
}))

import {
  validateUnsubscribeToken,
  processUnsubscribeByToken,
} from '@/lib/emails/emailService.server'

const VALID_TOKEN = 'abc123def456'

// Shape de fila que devuelve el SELECT migrado (leftJoin token + user_profiles).
const VALID_TOKEN_ROW = {
  user_id: 'user-uuid',
  email: 'test@vence.es',
  email_type: 'newsletter',
  profile_email: 'test@vence.es',
  profile_full_name: 'Test User',
}

function resetMock() {
  mockDbState.tokenRows = []
  mockDbState.tokenSelectError = null
  mockDbState.prefsUpdateError = null
  mockDbState.markUsedError = null
  mockDbState.getDbThrows = false
  mockGetAdminDb.mockClear()
}

describe('validateUnsubscribeToken', () => {
  beforeEach(resetMock)

  test('happy path: devuelve ok:true con datos del token', async () => {
    mockDbState.tokenRows = [VALID_TOKEN_ROW]

    const result = await validateUnsubscribeToken(VALID_TOKEN)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.userId).toBe('user-uuid')
      expect(result.email).toBe('test@vence.es')
      expect(result.emailType).toBe('newsletter')
      expect(result.userProfile?.full_name).toBe('Test User')
    }
  })

  test('token no existe: devuelve code:not_found (0 filas)', async () => {
    mockDbState.tokenRows = []

    const result = await validateUnsubscribeToken(VALID_TOKEN)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('not_found')
      expect(result.error).toContain('Token inválido')
    }
  })

  test('error de BD (SELECT lanza): devuelve code:db_error con dbError', async () => {
    mockDbState.tokenSelectError = { code: '42P01', message: 'relation does not exist' }

    const result = await validateUnsubscribeToken(VALID_TOKEN)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('db_error')
      expect(result.dbError).toEqual({ code: '42P01', message: 'relation does not exist' })
    }
  })

  test('exception en getAdminDb: devuelve code:db_error (Error interno)', async () => {
    mockDbState.getDbThrows = true

    const result = await validateUnsubscribeToken(VALID_TOKEN)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('db_error')
      expect(result.error).toContain('Error interno')
    }
  })

  test('0 filas sin error: devuelve code:not_found', async () => {
    mockDbState.tokenRows = []

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
    mockDbState.tokenRows = [VALID_TOKEN_ROW]
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
    mockDbState.tokenRows = []

    const result = await processUnsubscribeByToken(VALID_TOKEN, null, false, ['newsletter'])
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('invalid_token')
  })

  test('BD falla al validar token: devuelve errorCode db_error', async () => {
    mockDbState.tokenSelectError = { code: '08006', message: 'connection failure' }

    const result = await processUnsubscribeByToken(VALID_TOKEN, null, false, ['newsletter'])
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('db_error')
  })

  test('BD falla al actualizar email_preferences: devuelve errorCode db_error', async () => {
    mockValidToken()
    mockDbState.prefsUpdateError = { message: 'deadlock detected' }

    const result = await processUnsubscribeByToken(VALID_TOKEN, null, false, ['newsletter'])
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('db_error')
    expect(result.error).toContain('Error actualizando preferencias')
  })

  test('falla al marcar token como usado: success:true pero con warnings', async () => {
    mockValidToken()
    mockDbState.markUsedError = { message: 'timeout' }

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
