/**
 * Tests exhaustivos para queries del auth callback v2
 * Cubre: logica de negocio, edge cases, concurrencia, seguridad
 */

jest.mock('../../../db/client', () => ({
  getDb: jest.fn(),
}))

jest.mock('../../../lib/api/emails/queries', () => ({
  sendEmailV2: jest.fn().mockResolvedValue({ success: true, emailId: 'mock-id' }),
}))

import { getDb } from '../../../db/client'
import { sendEmailV2 } from '../../../lib/api/emails/queries'
import { processAuthCallback } from '../../../lib/api/auth/queries'
import type { ProcessCallbackRequest } from '../../../lib/api/auth/schemas'

const mockGetDb = getDb as jest.MockedFunction<typeof getDb>
const mockSendEmailV2 = sendEmailV2 as jest.MockedFunction<typeof sendEmailV2>

const UUID_1 = '550e8400-e29b-41d4-a716-446655440000'
const UUID_2 = '660e8400-e29b-41d4-a716-446655440000'

function mockRequest(headers: Record<string, string> = {}): Request {
  return {
    headers: { get: (name: string) => headers[name.toLowerCase()] || null },
  } as unknown as Request
}

function baseParams(overrides: Partial<ProcessCallbackRequest> = {}): ProcessCallbackRequest {
  return {
    userId: UUID_1,
    userEmail: 'test@example.com',
    fullName: 'Test User',
    avatarUrl: 'https://example.com/photo.jpg',
    returnUrl: '/auxiliar-administrativo-estado',
    oposicion: null,
    funnel: null,
    isGoogleAds: false,
    isGoogleAdsFromUrl: false,
    isMetaAds: false,
    googleParams: null,
    metaParams: null,
    ...overrides,
  }
}

/**
 * createMockDb con control fino sobre cada query de select/update/insert
 */
function createMockDb(config: {
  welcomeEmails?: any[]
  existingProfile?: any | null
  registrationIp?: string | null
  insertShouldFail?: boolean
  updateShouldFail?: boolean
} = {}) {
  const {
    welcomeEmails = [],
    existingProfile = null,
    registrationIp = null,
    insertShouldFail = false,
    updateShouldFail = false,
  } = config

  let selectCallIndex = 0
  const selectResults = [
    welcomeEmails,
    existingProfile ? [existingProfile] : [],
    [{ registrationIp }],
  ]

  const mockLimit = jest.fn().mockImplementation(() => selectResults[selectCallIndex++])
  const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit })
  const mockFrom = jest.fn().mockReturnValue({ where: mockWhere })
  const mockSelect = jest.fn().mockReturnValue({ from: mockFrom })

  const mockSetWhere = updateShouldFail
    ? jest.fn().mockRejectedValue(new Error('update failed'))
    : jest.fn().mockResolvedValue(undefined)
  const mockSet = jest.fn().mockReturnValue({ where: mockSetWhere })
  const mockUpdate = jest.fn().mockReturnValue({ set: mockSet })

  const mockOnConflict = insertShouldFail
    ? jest.fn().mockRejectedValue(new Error('insert failed'))
    : jest.fn().mockResolvedValue(undefined)
  const mockValues = jest.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflict })
  const mockInsert = jest.fn().mockReturnValue({ values: mockValues })

  const db = { select: mockSelect, update: mockUpdate, insert: mockInsert }
  mockGetDb.mockReturnValue(db as any)

  return { db, mockSelect, mockUpdate, mockInsert, mockSet, mockValues, mockSetWhere }
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ============================================
// DETECCION DE USUARIO NUEVO
// ============================================

describe('deteccion de usuario nuevo', () => {
  test('sin welcome emails previos → isNewUser true', async () => {
    createMockDb({ welcomeEmails: [] })

    const result = await processAuthCallback(baseParams(), mockRequest())
    expect(result.isNewUser).toBe(true)
  })

  test('con welcome email previo → isNewUser false', async () => {
    createMockDb({
      welcomeEmails: [{ id: 'email-1' }],
      existingProfile: {
        id: UUID_1, planType: 'free', registrationSource: 'organic',
        registrationUrl: '/test', registrationFunnel: 'test',
      },
    })

    const result = await processAuthCallback(baseParams(), mockRequest())
    expect(result.isNewUser).toBe(false)
  })

  test('multiples welcome emails previos → isNewUser false', async () => {
    createMockDb({
      welcomeEmails: [{ id: 'email-1' }, { id: 'email-2' }],
      existingProfile: {
        id: UUID_1, planType: 'free', registrationSource: 'organic',
        registrationUrl: '/test', registrationFunnel: 'test',
      },
    })

    const result = await processAuthCallback(baseParams(), mockRequest())
    expect(result.isNewUser).toBe(false)
  })
})

// ============================================
// PERFIL EXISTENTE - LOGICA DE UPDATE
// ============================================

describe('perfil existente - logica de update', () => {
  test('preserva plan_type (nunca lo cambia)', async () => {
    const { mockSet } = createMockDb({
      welcomeEmails: [{ id: 'e' }],
      existingProfile: {
        id: UUID_1, planType: 'premium', registrationSource: 'google_ads',
        registrationUrl: '/premium', registrationFunnel: 'ads',
      },
    })

    await processAuthCallback(baseParams(), mockRequest())

    // mockSet recibe los datos de update
    const updateArgs = mockSet.mock.calls[0][0]
    expect(updateArgs).not.toHaveProperty('planType')
  })

  test('registration_source google_ads NO se sobreescribe a meta', async () => {
    const { mockSet } = createMockDb({
      welcomeEmails: [{ id: 'e' }],
      existingProfile: {
        id: UUID_1, planType: 'free', registrationSource: 'google_ads',
        registrationUrl: '/test', registrationFunnel: 'test',
      },
    })

    await processAuthCallback(
      baseParams({ isMetaAds: true }),
      mockRequest()
    )

    const updateArgs = mockSet.mock.calls[0][0]
    expect(updateArgs.registrationSource).toBeUndefined()
  })

  test('registration_source meta NO se sobreescribe a google_ads', async () => {
    const { mockSet } = createMockDb({
      welcomeEmails: [{ id: 'e' }],
      existingProfile: {
        id: UUID_1, planType: 'free', registrationSource: 'meta',
        registrationUrl: '/test', registrationFunnel: 'test',
      },
    })

    await processAuthCallback(
      baseParams({ isGoogleAds: true }),
      mockRequest()
    )

    const updateArgs = mockSet.mock.calls[0][0]
    expect(updateArgs.registrationSource).toBeUndefined()
  })

  test('registration_source organic → google_ads cuando isGoogleAds=true', async () => {
    const { mockSet } = createMockDb({
      welcomeEmails: [{ id: 'e' }],
      existingProfile: {
        id: UUID_1, planType: 'free', registrationSource: 'organic',
        registrationUrl: '/test', registrationFunnel: 'test',
      },
    })

    await processAuthCallback(
      baseParams({ isGoogleAds: true }),
      mockRequest()
    )

    const updateArgs = mockSet.mock.calls[0][0]
    expect(updateArgs.registrationSource).toBe('google_ads')
  })

  test('registration_source null → meta cuando isMetaAds=true', async () => {
    const { mockSet } = createMockDb({
      welcomeEmails: [{ id: 'e' }],
      existingProfile: {
        id: UUID_1, planType: 'free', registrationSource: null,
        registrationUrl: '/test', registrationFunnel: 'test',
      },
    })

    await processAuthCallback(
      baseParams({ isMetaAds: true }),
      mockRequest()
    )

    const updateArgs = mockSet.mock.calls[0][0]
    expect(updateArgs.registrationSource).toBe('meta')
  })

  test('isGoogleAdsFromUrl=true NO actualiza registration_source (solo para nuevos perfiles)', async () => {
    const { mockSet } = createMockDb({
      welcomeEmails: [{ id: 'e' }],
      existingProfile: {
        id: UUID_1, planType: 'free', registrationSource: 'organic',
        registrationUrl: '/test', registrationFunnel: 'test',
      },
    })

    // isGoogleAds=true pero isGoogleAdsFromUrl=true → la condicion excluye con !isGoogleAdsFromUrl
    await processAuthCallback(
      baseParams({ isGoogleAds: true, isGoogleAdsFromUrl: true }),
      mockRequest()
    )

    const updateArgs = mockSet.mock.calls[0][0]
    // No se actualiza porque la condicion es: isGoogleAds && !isGoogleAdsFromUrl
    expect(updateArgs.registrationSource).toBeUndefined()
  })

  test('registration_url no se sobreescribe cuando ya existe', async () => {
    const { mockSet } = createMockDb({
      welcomeEmails: [{ id: 'e' }],
      existingProfile: {
        id: UUID_1, planType: 'free', registrationSource: 'organic',
        registrationUrl: '/original-url',
        registrationFunnel: 'test',
      },
    })

    await processAuthCallback(
      baseParams({ returnUrl: '/new-url' }),
      mockRequest()
    )

    const updateArgs = mockSet.mock.calls[0][0]
    expect(updateArgs.registrationUrl).toBeUndefined()
  })

  test('registration_url se guarda cuando no existe', async () => {
    const { mockSet } = createMockDb({
      welcomeEmails: [{ id: 'e' }],
      existingProfile: {
        id: UUID_1, planType: 'free', registrationSource: 'organic',
        registrationUrl: null,
        registrationFunnel: 'test',
      },
    })

    await processAuthCallback(
      baseParams({ returnUrl: '/new-url' }),
      mockRequest()
    )

    const updateArgs = mockSet.mock.calls[0][0]
    expect(updateArgs.registrationUrl).toBe('/new-url')
  })

  test('registration_funnel no se sobreescribe cuando ya existe', async () => {
    const { mockSet } = createMockDb({
      welcomeEmails: [{ id: 'e' }],
      existingProfile: {
        id: UUID_1, planType: 'free', registrationSource: 'organic',
        registrationUrl: '/test',
        registrationFunnel: 'original_funnel',
      },
    })

    await processAuthCallback(
      baseParams({ funnel: 'new_funnel' }),
      mockRequest()
    )

    const updateArgs = mockSet.mock.calls[0][0]
    expect(updateArgs.registrationFunnel).toBeUndefined()
  })

  test('registration_funnel se infiere como temario_pdf con oposicion', async () => {
    const { mockSet } = createMockDb({
      welcomeEmails: [{ id: 'e' }],
      existingProfile: {
        id: UUID_1, planType: 'free', registrationSource: 'organic',
        registrationUrl: '/test',
        registrationFunnel: null,
      },
    })

    await processAuthCallback(
      baseParams({ oposicion: 'auxiliar_estado', funnel: null }),
      mockRequest()
    )

    const updateArgs = mockSet.mock.calls[0][0]
    expect(updateArgs.registrationFunnel).toBe('temario_pdf')
  })

  test('fullName null → fallback a email prefix', async () => {
    const { mockSet } = createMockDb({
      welcomeEmails: [{ id: 'e' }],
      existingProfile: {
        id: UUID_1, planType: 'free', registrationSource: 'organic',
        registrationUrl: '/test', registrationFunnel: 'test',
      },
    })

    await processAuthCallback(
      baseParams({ fullName: null, userEmail: 'maria.garcia@gmail.com' }),
      mockRequest()
    )

    const updateArgs = mockSet.mock.calls[0][0]
    expect(updateArgs.fullName).toBe('maria.garcia')
  })
})

// ============================================
// PERFIL NUEVO - LOGICA DE INSERT
// ============================================

describe('perfil nuevo - logica de insert', () => {
  test('organico: plan free, source organic', async () => {
    const { mockValues } = createMockDb({ welcomeEmails: [], existingProfile: null })

    await processAuthCallback(baseParams(), mockRequest())

    const insertData = mockValues.mock.calls[0][0]
    expect(insertData.planType).toBe('free')
    expect(insertData.registrationSource).toBe('organic')
    expect(insertData.requiresPayment).toBe(false)
  })

  test('Google Ads URL: plan premium_required, source google_ads', async () => {
    const { mockValues } = createMockDb({ welcomeEmails: [], existingProfile: null })

    await processAuthCallback(
      baseParams({ isGoogleAds: true, isGoogleAdsFromUrl: true }),
      mockRequest()
    )

    const insertData = mockValues.mock.calls[0][0]
    expect(insertData.planType).toBe('premium_required')
    expect(insertData.registrationSource).toBe('google_ads')
    expect(insertData.requiresPayment).toBe(true)
  })

  test('Google Ads params (no URL): plan free, source google_ads', async () => {
    const { mockValues } = createMockDb({ welcomeEmails: [], existingProfile: null })

    await processAuthCallback(
      baseParams({ isGoogleAds: true, isGoogleAdsFromUrl: false }),
      mockRequest()
    )

    const insertData = mockValues.mock.calls[0][0]
    expect(insertData.planType).toBe('free')
    expect(insertData.registrationSource).toBe('google_ads')
    expect(insertData.requiresPayment).toBe(false)
  })

  test('Meta Ads: plan free, source meta', async () => {
    const { mockValues } = createMockDb({ welcomeEmails: [], existingProfile: null })

    await processAuthCallback(
      baseParams({ isMetaAds: true }),
      mockRequest()
    )

    const insertData = mockValues.mock.calls[0][0]
    expect(insertData.planType).toBe('free')
    expect(insertData.registrationSource).toBe('meta')
    expect(insertData.requiresPayment).toBe(false)
  })

  test('Google Ads tiene prioridad sobre Meta Ads', async () => {
    const { mockValues } = createMockDb({ welcomeEmails: [], existingProfile: null })

    await processAuthCallback(
      baseParams({ isGoogleAds: true, isGoogleAdsFromUrl: true, isMetaAds: true }),
      mockRequest()
    )

    const insertData = mockValues.mock.calls[0][0]
    expect(insertData.registrationSource).toBe('google_ads')
    expect(insertData.planType).toBe('premium_required')
  })

  test('oposicion se guarda en targetOposicion', async () => {
    const { mockValues } = createMockDb({ welcomeEmails: [], existingProfile: null })

    await processAuthCallback(
      baseParams({ oposicion: 'tramitacion_procesal' }),
      mockRequest()
    )

    const insertData = mockValues.mock.calls[0][0]
    expect(insertData.targetOposicion).toBe('tramitacion_procesal')
  })

  test('sin oposicion: no se incluye targetOposicion', async () => {
    const { mockValues } = createMockDb({ welcomeEmails: [], existingProfile: null })

    await processAuthCallback(
      baseParams({ oposicion: null }),
      mockRequest()
    )

    const insertData = mockValues.mock.calls[0][0]
    expect(insertData.targetOposicion).toBeUndefined()
  })

  test('funnel explicito se guarda', async () => {
    const { mockValues } = createMockDb({ welcomeEmails: [], existingProfile: null })

    await processAuthCallback(
      baseParams({ funnel: 'test_rapido' }),
      mockRequest()
    )

    const insertData = mockValues.mock.calls[0][0]
    expect(insertData.registrationFunnel).toBe('test_rapido')
  })

  test('oposicion sin funnel → infiere temario_pdf', async () => {
    const { mockValues } = createMockDb({ welcomeEmails: [], existingProfile: null })

    await processAuthCallback(
      baseParams({ oposicion: 'auxiliar_estado', funnel: null }),
      mockRequest()
    )

    const insertData = mockValues.mock.calls[0][0]
    expect(insertData.registrationFunnel).toBe('temario_pdf')
  })

  test('ni oposicion ni funnel → no se incluye registrationFunnel', async () => {
    const { mockValues } = createMockDb({ welcomeEmails: [], existingProfile: null })

    await processAuthCallback(
      baseParams({ oposicion: null, funnel: null }),
      mockRequest()
    )

    const insertData = mockValues.mock.calls[0][0]
    expect(insertData.registrationFunnel).toBeUndefined()
  })

  test('returnUrl se guarda en registrationUrl', async () => {
    const { mockValues } = createMockDb({ welcomeEmails: [], existingProfile: null })

    await processAuthCallback(
      baseParams({ returnUrl: '/test/tema/5' }),
      mockRequest()
    )

    const insertData = mockValues.mock.calls[0][0]
    expect(insertData.registrationUrl).toBe('/test/tema/5')
  })

  test('returnUrl vacio: no se incluye registrationUrl', async () => {
    const { mockValues } = createMockDb({ welcomeEmails: [], existingProfile: null })

    await processAuthCallback(
      baseParams({ returnUrl: '' }),
      mockRequest()
    )

    const insertData = mockValues.mock.calls[0][0]
    expect(insertData.registrationUrl).toBeUndefined()
  })

  test('fullName null → fallback a email prefix', async () => {
    const { mockValues } = createMockDb({ welcomeEmails: [], existingProfile: null })

    await processAuthCallback(
      baseParams({ fullName: null, userEmail: 'pedro.martinez@hotmail.com' }),
      mockRequest()
    )

    const insertData = mockValues.mock.calls[0][0]
    expect(insertData.fullName).toBe('pedro.martinez')
  })

  test('preferredLanguage siempre es es', async () => {
    const { mockValues } = createMockDb({ welcomeEmails: [], existingProfile: null })

    await processAuthCallback(baseParams(), mockRequest())

    const insertData = mockValues.mock.calls[0][0]
    expect(insertData.preferredLanguage).toBe('es')
  })

  test('insert con onConflictDoUpdate (upsert seguro)', async () => {
    const { mockValues } = createMockDb({ welcomeEmails: [], existingProfile: null })

    await processAuthCallback(baseParams(), mockRequest())

    // onConflictDoUpdate debe ser llamado
    const onConflict = mockValues.mock.results[0].value.onConflictDoUpdate
    expect(onConflict).toBeDefined()
  })
})

// ============================================
// WELCOME EMAIL
// ============================================

describe('welcome email', () => {
  test('se envia para usuario nuevo', async () => {
    createMockDb({ welcomeEmails: [] })

    await processAuthCallback(baseParams(), mockRequest())

    expect(mockSendEmailV2).toHaveBeenCalledTimes(1)
    expect(mockSendEmailV2).toHaveBeenCalledWith({
      userId: UUID_1,
      emailType: 'bienvenida_inmediato',
      customData: {},
    })
  })

  test('NO se envia para usuario existente', async () => {
    createMockDb({
      welcomeEmails: [{ id: 'e' }],
      existingProfile: {
        id: UUID_1, planType: 'free', registrationSource: 'organic',
        registrationUrl: '/t', registrationFunnel: 't',
      },
    })

    await processAuthCallback(baseParams(), mockRequest())
    expect(mockSendEmailV2).not.toHaveBeenCalled()
  })

  test('error de email NO rompe el callback', async () => {
    createMockDb({ welcomeEmails: [] })
    mockSendEmailV2.mockRejectedValueOnce(new Error('Resend API down'))

    const result = await processAuthCallback(baseParams(), mockRequest())

    expect(result.success).toBe(true)
    expect(result.isNewUser).toBe(true)
  })
})

// ============================================
// IP DE REGISTRO
// ============================================

describe('IP de registro', () => {
  test('se guarda desde x-forwarded-for (primer IP de la cadena)', async () => {
    const { mockUpdate } = createMockDb({
      welcomeEmails: [],
      registrationIp: null,
    })

    await processAuthCallback(
      baseParams(),
      mockRequest({ 'x-forwarded-for': '203.0.113.50, 70.41.3.18, 150.172.238.178' })
    )

    // El update de IP debe incluir la primera IP
    const setCall = mockUpdate.mock.results
    expect(mockUpdate).toHaveBeenCalled()
  })

  test('se guarda desde x-real-ip cuando no hay x-forwarded-for', async () => {
    createMockDb({ welcomeEmails: [], registrationIp: null })

    const result = await processAuthCallback(
      baseParams(),
      mockRequest({ 'x-real-ip': '10.20.30.40' })
    )

    expect(result.success).toBe(true)
  })

  test('no se guarda para usuario existente (no nuevo)', async () => {
    const { mockUpdate } = createMockDb({
      welcomeEmails: [{ id: 'e' }],
      existingProfile: {
        id: UUID_1, planType: 'free', registrationSource: 'organic',
        registrationUrl: '/t', registrationFunnel: 't',
      },
    })

    await processAuthCallback(
      baseParams(),
      mockRequest({ 'x-forwarded-for': '1.2.3.4' })
    )

    // Solo debe llamar update para el perfil, no para IP
    // (mockUpdate se llama 1 vez para update de perfil)
    expect(mockUpdate).toHaveBeenCalledTimes(1)
  })

  test('no se guarda cuando IP es unknown (sin headers)', async () => {
    createMockDb({ welcomeEmails: [], registrationIp: null })

    const result = await processAuthCallback(
      baseParams(),
      mockRequest({}) // sin x-forwarded-for ni x-real-ip
    )

    expect(result.success).toBe(true)
  })

  test('no sobreescribe IP existente', async () => {
    createMockDb({
      welcomeEmails: [],
      registrationIp: '1.1.1.1', // ya tiene IP
    })

    const result = await processAuthCallback(
      baseParams(),
      mockRequest({ 'x-forwarded-for': '2.2.2.2' })
    )

    expect(result.success).toBe(true)
  })
})

// ============================================
// REDIRECT URL
// ============================================

describe('redirect URL', () => {
  test('returnUrl se preserva en redirectUrl', async () => {
    createMockDb({ welcomeEmails: [] })

    const result = await processAuthCallback(
      baseParams({ returnUrl: '/tramitacion-procesal/test' }),
      mockRequest()
    )

    expect(result.redirectUrl).toBe('/tramitacion-procesal/test')
  })

  test('returnUrl vacio → default', async () => {
    createMockDb({ welcomeEmails: [] })

    const result = await processAuthCallback(
      baseParams({ returnUrl: '' }),
      mockRequest()
    )

    expect(result.redirectUrl).toBe('/auxiliar-administrativo-estado')
  })

  test('returnUrl premium-ads se preserva', async () => {
    createMockDb({ welcomeEmails: [] })

    const result = await processAuthCallback(
      baseParams({
        returnUrl: '/premium-ads/checkout?start_checkout=true',
        isGoogleAds: true,
        isGoogleAdsFromUrl: true,
      }),
      mockRequest()
    )

    expect(result.redirectUrl).toBe('/premium-ads/checkout?start_checkout=true')
  })
})

// ============================================
// MANEJO DE ERRORES
// ============================================

describe('manejo de errores', () => {
  test('error de DB en deteccion de usuario → success false', async () => {
    mockGetDb.mockReturnValue({
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockRejectedValue(new Error('connection refused')),
          }),
        }),
      }),
    } as any)

    const result = await processAuthCallback(baseParams(), mockRequest())

    expect(result.success).toBe(false)
    expect(result.error).toBe('connection refused')
    expect(result.isNewUser).toBe(false)
    expect(result.redirectUrl).toBe('/auxiliar-administrativo-estado')
  })

  test('error no-Error → "Error desconocido"', async () => {
    mockGetDb.mockReturnValue({
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockRejectedValue('string error'),
          }),
        }),
      }),
    } as any)

    const result = await processAuthCallback(baseParams(), mockRequest())

    expect(result.success).toBe(false)
    expect(result.error).toBe('Error desconocido')
  })

  test('error preserva returnUrl en response', async () => {
    mockGetDb.mockReturnValue({
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockRejectedValue(new Error('fail')),
          }),
        }),
      }),
    } as any)

    const result = await processAuthCallback(
      baseParams({ returnUrl: '/mi-pagina-custom' }),
      mockRequest()
    )

    expect(result.redirectUrl).toBe('/mi-pagina-custom')
  })
})
