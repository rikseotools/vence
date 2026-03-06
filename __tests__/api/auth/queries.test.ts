/**
 * Tests para queries del auth callback v2 (con mock de DB y emails)
 */

// Mock del modulo db/client ANTES de importar queries
jest.mock('../../../db/client', () => ({
  getDb: jest.fn(),
}))

// Mock del modulo de emails
jest.mock('../../../lib/api/emails/queries', () => ({
  sendEmailV2: jest.fn().mockResolvedValue({ success: true, emailId: 'mock-email-id' }),
}))

import { getDb } from '../../../db/client'
import { sendEmailV2 } from '../../../lib/api/emails/queries'
import { processAuthCallback } from '../../../lib/api/auth/queries'
import type { ProcessCallbackRequest } from '../../../lib/api/auth/schemas'

const mockGetDb = getDb as jest.MockedFunction<typeof getDb>
const mockSendEmailV2 = sendEmailV2 as jest.MockedFunction<typeof sendEmailV2>

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

function createMockRequest(headers: Record<string, string> = {}): Request {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] || null,
    },
  } as unknown as Request
}

function createMockDb(options: {
  welcomeEmails?: any[]
  existingProfile?: any | null
  registrationIp?: string | null
} = {}) {
  const { welcomeEmails = [], existingProfile = null, registrationIp = null } = options

  // Track calls to build the chain
  let selectCallIndex = 0
  const selectResults = [
    // 1st select: email_logs check
    welcomeEmails,
    // 2nd select: existing profile
    existingProfile ? [existingProfile] : [],
    // 3rd select (optional): registration IP check
    [{ registrationIp }],
  ]

  const mockLimit = jest.fn().mockImplementation(() => selectResults[selectCallIndex++])
  const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit })
  const mockSingle = jest.fn().mockReturnValue(selectResults[selectCallIndex])
  const mockFrom = jest.fn().mockReturnValue({ where: mockWhere })
  const mockSelect = jest.fn().mockReturnValue({ from: mockFrom })
  const mockSet = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) })
  const mockUpdate = jest.fn().mockReturnValue({ set: mockSet })
  const mockOnConflict = jest.fn().mockResolvedValue(undefined)
  const mockValues = jest.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflict })
  const mockInsert = jest.fn().mockReturnValue({ values: mockValues })

  const db = {
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
  }

  mockGetDb.mockReturnValue(db as any)

  return { db, mockSelect, mockUpdate, mockInsert, mockValues, mockSet }
}

function baseRequest(overrides: Partial<ProcessCallbackRequest> = {}): ProcessCallbackRequest {
  return {
    userId: VALID_UUID,
    userEmail: 'test@example.com',
    fullName: 'Test User',
    avatarUrl: null,
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

beforeEach(() => {
  jest.clearAllMocks()
})

describe('processAuthCallback', () => {
  test('usuario nuevo: crea perfil y envia welcome email', async () => {
    const { mockInsert } = createMockDb({
      welcomeEmails: [],  // no welcome emails = new user
      existingProfile: null,
    })

    const result = await processAuthCallback(
      baseRequest(),
      createMockRequest({ 'x-forwarded-for': '1.2.3.4' })
    )

    expect(result.success).toBe(true)
    expect(result.isNewUser).toBe(true)
    expect(result.redirectUrl).toBe('/auxiliar-administrativo-estado')

    // Should have sent welcome email
    expect(mockSendEmailV2).toHaveBeenCalledWith({
      userId: VALID_UUID,
      emailType: 'bienvenida_inmediato',
      customData: {},
    })
  })

  test('usuario existente: actualiza perfil, no envia welcome email', async () => {
    createMockDb({
      welcomeEmails: [{ id: 'existing-email' }],
      existingProfile: {
        id: VALID_UUID,
        planType: 'free',
        registrationSource: 'organic',
        registrationUrl: '/test',
        registrationFunnel: 'test',
      },
    })

    const result = await processAuthCallback(
      baseRequest(),
      createMockRequest()
    )

    expect(result.success).toBe(true)
    expect(result.isNewUser).toBe(false)
    expect(mockSendEmailV2).not.toHaveBeenCalled()
  })

  test('Google Ads usuario nuevo: plan premium_required', async () => {
    const { mockInsert } = createMockDb({
      welcomeEmails: [],
      existingProfile: null,
    })

    const result = await processAuthCallback(
      baseRequest({
        isGoogleAds: true,
        isGoogleAdsFromUrl: true,
        returnUrl: '/premium-ads/checkout',
      }),
      createMockRequest()
    )

    expect(result.success).toBe(true)
    expect(result.isNewUser).toBe(true)
    expect(result.redirectUrl).toBe('/premium-ads/checkout')
  })

  test('Meta Ads usuario nuevo: registrationSource meta', async () => {
    createMockDb({
      welcomeEmails: [],
      existingProfile: null,
    })

    const result = await processAuthCallback(
      baseRequest({ isMetaAds: true }),
      createMockRequest()
    )

    expect(result.success).toBe(true)
    expect(result.isNewUser).toBe(true)
  })

  test('usuario existente con organic: actualiza a google_ads', async () => {
    createMockDb({
      welcomeEmails: [{ id: 'existing' }],
      existingProfile: {
        id: VALID_UUID,
        planType: 'free',
        registrationSource: 'organic',
        registrationUrl: null,
        registrationFunnel: null,
      },
    })

    const result = await processAuthCallback(
      baseRequest({ isGoogleAds: true }),
      createMockRequest()
    )

    expect(result.success).toBe(true)
    expect(result.isNewUser).toBe(false)
  })

  test('con oposicion y funnel: guarda ambos', async () => {
    createMockDb({
      welcomeEmails: [],
      existingProfile: null,
    })

    const result = await processAuthCallback(
      baseRequest({ oposicion: 'auxiliar_estado', funnel: 'temario_pdf' }),
      createMockRequest()
    )

    expect(result.success).toBe(true)
  })

  test('oposicion sin funnel: infiere temario_pdf', async () => {
    createMockDb({
      welcomeEmails: [],
      existingProfile: null,
    })

    const result = await processAuthCallback(
      baseRequest({ oposicion: 'auxiliar_estado', funnel: null }),
      createMockRequest()
    )

    expect(result.success).toBe(true)
  })

  test('error de DB retorna success false', async () => {
    mockGetDb.mockReturnValue({
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockRejectedValue(new Error('DB connection failed')),
          }),
        }),
      }),
    } as any)

    const result = await processAuthCallback(
      baseRequest(),
      createMockRequest()
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('DB connection failed')
  })

  test('returnUrl default cuando es vacio', async () => {
    createMockDb({
      welcomeEmails: [{ id: 'existing' }],
      existingProfile: {
        id: VALID_UUID,
        planType: 'free',
        registrationSource: 'google_ads',
        registrationUrl: '/test',
        registrationFunnel: 'test',
      },
    })

    const result = await processAuthCallback(
      baseRequest({ returnUrl: '' }),
      createMockRequest()
    )

    expect(result.success).toBe(true)
    expect(result.redirectUrl).toBe('/auxiliar-administrativo-estado')
  })

  test('IP se guarda desde x-forwarded-for para nuevo usuario', async () => {
    createMockDb({
      welcomeEmails: [],
      existingProfile: null,
      registrationIp: null,
    })

    const result = await processAuthCallback(
      baseRequest(),
      createMockRequest({ 'x-forwarded-for': '203.0.113.50, 70.41.3.18' })
    )

    expect(result.success).toBe(true)
    expect(result.isNewUser).toBe(true)
  })
})
