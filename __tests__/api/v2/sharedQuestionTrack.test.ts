/** @jest-environment node */
// Tests del endpoint /api/v2/shared-question/track (Fase C1). Auth OPCIONAL:
// anónimo permitido (visitor_user_id null); si hay sesión, visitor_user_id sale
// del TOKEN (no del body). Best-effort tracking de preguntas compartidas.

import { NextRequest } from 'next/server'

const mockVerifyAuthOptional = jest.fn()
const mockExecute = jest.fn()

jest.mock('@/lib/api/auth/verifyAuth', () => ({
  verifyAuthOptional: (...a: unknown[]) => mockVerifyAuthOptional(...a),
}))
jest.mock('@/db/client', () => ({
  getAdminDb: () => ({ execute: mockExecute }),
}))
jest.mock('@/lib/api/withErrorLogging', () => ({
  withErrorLogging: (_p: string, h: unknown) => h,
}))

import { POST } from '@/app/api/v2/shared-question/track/route'

const QID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
function req(body: unknown) {
  return { headers: { get: () => null }, url: 'https://x', json: async () => body } as unknown as NextRequest
}
const validBody = {
  questionId: QID, answerSelected: 1, isCorrect: true, timeToAnswerMs: 1200,
  sourcePlatform: 'whatsapp', shareMode: 'quiz', referrer: null, deviceInfo: { screen: '390x844' },
}

beforeEach(() => {
  jest.clearAllMocks()
  mockExecute.mockResolvedValue(undefined)
})

describe('POST /api/v2/shared-question/track', () => {
  test('400 si payload inválido (questionId no uuid)', async () => {
    mockVerifyAuthOptional.mockResolvedValue(null)
    const res = await POST(req({ ...validBody, questionId: 'nope' }))
    expect(res.status).toBe(400)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  test('400 si shareMode no es enum', async () => {
    mockVerifyAuthOptional.mockResolvedValue(null)
    expect((await POST(req({ ...validBody, shareMode: 'otro' }))).status).toBe(400)
  })

  test('anónimo (sin auth): inserta y responde 200', async () => {
    mockVerifyAuthOptional.mockResolvedValue(null)
    const res = await POST(req(validBody))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(mockExecute).toHaveBeenCalledTimes(1)
  })

  test('autenticado: visitor_user_id sale del TOKEN (en el SQL)', async () => {
    mockVerifyAuthOptional.mockResolvedValue({ userId: 'U_TOKEN', email: 'a@b.c' })
    await POST(req(validBody))
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain('U_TOKEN')
  })

  test('el body NO puede inyectar visitor_user_id (lo ignora el schema)', async () => {
    mockVerifyAuthOptional.mockResolvedValue(null)
    await POST(req({ ...validBody, visitor_user_id: 'U_ATTACKER', visitorUserId: 'U_ATTACKER' }))
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).not.toContain('U_ATTACKER')
  })
})
