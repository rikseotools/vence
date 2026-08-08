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
// Por defecto simula el fallo real del mock viejo (sin `.execute`): la consulta de
// respuestas reales de servidor lanza y la política se queda sin ese dato (fail-safe).
// Los tests de T-303 la sobrescriben para simular una respuesta real de BD.
const mockDbExecute = jest.fn().mockRejectedValue(new Error('mock sin .execute'))

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
  // `sql` solo se usa como plantilla opaca que se pasa a `db().execute(...)` — sin
  // mockearla, la llamada moría con "sql is not a function" ANTES de llegar al mock
  // de `.execute`, y tanto esto como el bloque de `suspicious_behavior` pasaban por
  // el camino fail-safe del catch sin que ningún test ejerciera el `.execute` de
  // verdad (descubierto construyendo los tests de T-303).
  sql: (strings: TemplateStringsArray, ...vals: unknown[]) => ({ strings, vals }),
}))
jest.mock('@/db/client', () => ({
  getAdminDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    insert: () => ({ values: (...a: unknown[]) => mockInsertValues(...a) }),
    execute: (...a: unknown[]) => mockDbExecute(...a),
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
  mockDbExecute.mockRejectedValue(new Error('mock sin .execute'))
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

// T-185: la mayor parte del ruido venía de abrir expediente con una confianza en
// la que no confiamos. 261 de ~400 alertas eran el patrón Android/BotD a score 60.
describe('/api/fraud/report — solo se abre expediente con la confianza con la que actuaríamos', () => {
  it('score 60 (patrón Android/BotD) responde 200 pero NO crea alerta', async () => {
    const res = await POST(req({
      userId: YO, alertType: 'bot_detected', botScore: 60,
      evidence: ['no_plugins', 'botd:headless_chrome'],
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.alerted).toBe(false)
    expect(body.reason).toContain('bajo_umbral')
    expect(mockInsertValues).not.toHaveBeenCalled()
    expect(mockMarkForcedChallenge).not.toHaveBeenCalled()
  })

  it('lo descartado NO se pierde: queda como evento de observabilidad', async () => {
    await POST(req({ userId: YO, alertType: 'bot_detected', botScore: 60 }))
    const ev = mockEmitFireAndForget.mock.calls.at(-1)?.[0]
    expect(ev.eventType).toBe('bot_detection_below_bar')
    expect(ev.severity).toBe('info')
    expect(ev.metadata.score).toBe(60)
  })

  it('una huella firme (score >= 90) SÍ crea alerta y reta', async () => {
    const res = await POST(req({ userId: YO, alertType: 'bot_detected', botScore: 150 }))
    expect(res.status).toBe(200)
    expect(mockMarkForcedChallenge).toHaveBeenCalledTimes(1)
  })

  // T-303: el patrón EXACTO de las 5 alertas dismissed — score 90 con solo señales
  // blandas — pero ahora con la cuenta habiendo respondido de verdad en servidor.
  it('T-303: score 90 con patrón blando de WebView NO alerta si el servidor confirma respuestas reales', async () => {
    mockDbExecute.mockResolvedValue([{ n: 199 }])
    const res = await POST(req({
      userId: YO, alertType: 'bot_detected', botScore: 90,
      evidence: ['no_plugins', 'zero_dimensions', 'botd:headless_chrome'],
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.alerted).toBe(false)
    expect(body.reason).toContain('actividad_real_confirmada')
    expect(mockInsertValues).not.toHaveBeenCalled()
    expect(mockMarkForcedChallenge).not.toHaveBeenCalled()
  })

  // El mismo patrón, pero la cuenta NUNCA respondió de verdad (el cosechador real
  // medido en T-303, `daily_questions_served` alto y `test_questions` vacío) SIGUE
  // alertando — el arreglo no puede abrir un hueco para la cosecha real.
  it('T-303: el mismo score/patrón SÍ alerta si el servidor confirma CERO respuestas reales', async () => {
    mockDbExecute.mockResolvedValue([{ n: 0 }])
    const res = await POST(req({
      userId: YO, alertType: 'bot_detected', botScore: 90,
      evidence: ['no_plugins', 'zero_dimensions', 'botd:headless_chrome'],
    }))
    expect(mockMarkForcedChallenge).toHaveBeenCalledTimes(1)
    expect(mockInsertValues).toHaveBeenCalledTimes(1)
  })

  // Automatización DURA: nunca se exime aunque el servidor confirme actividad real.
  it('T-303: webdriver_detected SÍ alerta aunque el servidor confirme actividad real', async () => {
    mockDbExecute.mockResolvedValue([{ n: 500 }])
    const res = await POST(req({
      userId: YO, alertType: 'bot_detected', botScore: 90,
      evidence: ['webdriver_detected'],
    }))
    expect(mockMarkForcedChallenge).toHaveBeenCalledTimes(1)
  })

  // Si la consulta de respuestas reales falla (como el mock por defecto), la ruta
  // sigue alertando igual que ANTES de T-303 — fail-safe de verdad, no solo en el
  // núcleo puro.
  it('T-303: si la consulta de respuestas reales falla, sigue alertando como antes', async () => {
    const res = await POST(req({
      userId: YO, alertType: 'bot_detected', botScore: 90,
      evidence: ['no_plugins', 'zero_dimensions', 'botd:headless_chrome'],
    }))
    expect(mockMarkForcedChallenge).toHaveBeenCalledTimes(1)
  })

  // Sin datos de servidor la política no alerta — el mock de db devuelve [] para
  // la consulta de comportamiento, que es justo el caso "no sé".
  it('suspicious_behavior no alerta si el servidor no confirma el comportamiento', async () => {
    const res = await POST(req({
      userId: YO, alertType: 'suspicious_behavior', behaviorScore: 130,
      evidence: { correctRate: 0, answerCount: 24 },
    }))
    expect((await res.json()).alerted).toBe(false)
    expect(mockMarkForcedChallenge).not.toHaveBeenCalled()
  })
})
