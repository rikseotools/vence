/**
 * Tests del contrato de seguridad de /api/fraud/report (T-180, 27/07/2026).
 *
 * ANTES: el endpoint no tenía auth y se creía el `userId` del cuerpo. Con eso,
 * cualquiera podía fabricar alertas de fraude contra otra persona — y, peor,
 * provocarle CAPTCHAS: un score alto llama a `markForcedChallenge`, así que
 * bastaba un POST con el uuid de una clienta de pago para llenarle la sesión de
 * retos. Este fichero impide que el agujero se reabra.
 */

const mockVerifyAuthOptional = jest.fn()
const mockMarkForcedChallenge = jest.fn().mockResolvedValue(undefined)
const mockEmitFireAndForget = jest.fn()
const mockInsertValues = jest.fn().mockReturnValue({
  returning: jest.fn().mockResolvedValue([{ id: 'alerta-1' }]),
})

jest.mock('@/lib/api/auth/verifyAuth', () => ({
  verifyAuthOptional: (...a: unknown[]) => mockVerifyAuthOptional(...a),
}))
jest.mock('@/lib/security/challengePolicy/forceChallenge', () => ({
  markForcedChallenge: (...a: unknown[]) => mockMarkForcedChallenge(...a),
}))
jest.mock('@/lib/observability/emit', () => ({
  emitFireAndForget: (...a: unknown[]) => mockEmitFireAndForget(...a),
}))
jest.mock('@/lib/api/withErrorLogging', () => ({
  withErrorLogging: (_e: string, h: unknown) => h,
}))
jest.mock('@/db/schema', () => ({ fraudAlerts: { id: 'id', alertType: 'alert_type', userIds: 'user_ids', detectedAt: 'detected_at', details: 'details' } }))
jest.mock('drizzle-orm', () => ({
  and: (...a: unknown[]) => a, eq: (...a: unknown[]) => a,
  gte: (...a: unknown[]) => a, arrayContains: (...a: unknown[]) => a,
}))
jest.mock('@/db/client', () => ({
  getAdminDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    insert: () => ({ values: (...a: unknown[]) => mockInsertValues(...a) }),
  }),
}))
jest.mock('next/headers', () => ({
  headers: async () => ({ get: (n: string) => (n === 'x-forwarded-for' ? '203.0.113.9' : null) }),
}))
jest.mock('next/server', () => {
  class MockNextResponse {
    private _b: string; status: number
    constructor(b: string, init?: { status?: number }) { this._b = b; this.status = init?.status || 200 }
    async json() { return JSON.parse(this._b) }
    static json(d: unknown, init?: { status?: number }) { return new MockNextResponse(JSON.stringify(d), init) }
  }
  return { NextResponse: MockNextResponse }
})

import { POST } from '@/app/api/fraud/report/route'

const YO = '11111111-1111-1111-1111-111111111111'
const OTRA_PERSONA = '22222222-2222-2222-2222-222222222222'

const req = (body: unknown) => ({ json: async () => body }) as never

beforeEach(() => {
  jest.clearAllMocks()
  mockVerifyAuthOptional.mockResolvedValue({ userId: YO })
})

describe('/api/fraud/report — la identidad sale del token, no del cuerpo', () => {
  it('sin sesión rechaza el reporte', async () => {
    mockVerifyAuthOptional.mockResolvedValue(null)
    const res = await POST(req({ userId: YO, alertType: 'bot_detected', botScore: 150 }))
    expect(res.status).toBe(401)
    // y NO marca a nadie para reto forzado
    expect(mockMarkForcedChallenge).not.toHaveBeenCalled()
  })

  // EL ATAQUE: reportar sobre una tercera persona para forzarle captchas.
  it('rechaza un cuerpo que apunta a OTRO usuario y deja rastro', async () => {
    const res = await POST(req({ userId: OTRA_PERSONA, alertType: 'bot_detected', botScore: 150 }))
    expect(res.status).toBe(403)
    expect(mockMarkForcedChallenge).not.toHaveBeenCalled()

    const ev = mockEmitFireAndForget.mock.calls.at(-1)?.[0]
    expect(ev.eventType).toBe('fraud_report_identity_mismatch')
    expect(ev.severity).toBe('warn')
    expect(ev.userId).toBe(YO)
  })

  it('un reporte legítimo sobre uno mismo sigue funcionando', async () => {
    const res = await POST(req({ userId: YO, alertType: 'bot_detected', botScore: 150 }))
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
  })

  it('acepta el reporte aunque el cuerpo no traiga userId (se toma el del token)', async () => {
    const res = await POST(req({ alertType: 'bot_detected', botScore: 150 }))
    expect(res.status).toBe(200)
  })

  it('el reto forzado se marca sobre la identidad del TOKEN', async () => {
    await POST(req({ userId: YO, alertType: 'bot_detected', botScore: 150 }))
    expect(mockMarkForcedChallenge).toHaveBeenCalledTimes(1)
    expect(mockMarkForcedChallenge.mock.calls[0][0]).toContain(YO)
  })

  it('sigue exigiendo alertType', async () => {
    const res = await POST(req({ userId: YO, botScore: 150 }))
    expect(res.status).toBe(400)
  })

  it('un score bajo no marca reto forzado (no escala solo)', async () => {
    await POST(req({ userId: YO, alertType: 'bot_detected', botScore: 50 }))
    expect(mockMarkForcedChallenge).not.toHaveBeenCalled()
  })
})
