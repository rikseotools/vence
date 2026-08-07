// __tests__/security/forceChallengeSintetica.test.ts
//
// El reto forzado por señal de bot NO se marca sobre una cuenta SINTÉTICA (canary / smoke).
//
// Origen (07/08/2026): nuestros canaries navegan con un navegador automatizado y con
// `smoke@vence.es`. BotD los reconoce como automatización —correctamente— y el sistema acababa
// marcándose a sí mismo: medido, el flag se puso a las 13:41 con score 175 y el canary
// `canary-questions-gate` pasó a fallar con `reason:'bot_flag'` teniendo **1 servida de 500**.
// Un canary crítico que no puede volver a verde deja de ser señal.
//
// Se ejercita la decisión PURA (sin Redis ni BD) y la puerta de escritura con el lector mockeado,
// que es donde de verdad se decide: si la exención viviera en el llamante, el próximo sitio que
// marque un reto nacería sin ella.

import { decidirMarcadoForzado } from '@/lib/security/challengePolicy/forceChallenge'

jest.mock('@/lib/cache/redis', () => ({
  setCached: jest.fn().mockResolvedValue(undefined),
  getCached: jest.fn().mockResolvedValue(null),
}))

const mockEjecutarSql = jest.fn()
jest.mock('@/db/client', () => ({
  getAdminDb: () => ({ execute: (...args: unknown[]) => mockEjecutarSql(...args) }),
}))
const ejecutarSql = mockEjecutarSql

describe('decidirMarcadoForzado (núcleo puro)', () => {
  const sujetos = ['u-1', 'device:d-1']

  it('marca a un usuario normal con sujetos', () => {
    expect(decidirMarcadoForzado({ subjectKeys: sujetos, esSintetico: false }))
      .toEqual({ marcado: true, sujetos: 2 })
  })

  it('NO marca a una cuenta sintética, y dice por qué', () => {
    expect(decidirMarcadoForzado({ subjectKeys: sujetos, esSintetico: true }))
      .toEqual({ marcado: false, motivo: 'cuenta_sintetica', sujetos: 2 })
  })

  it('sin sujetos no hay nada que marcar', () => {
    expect(decidirMarcadoForzado({ subjectKeys: [], esSintetico: false }))
      .toEqual({ marcado: false, motivo: 'sin_sujetos', sujetos: 0 })
  })

  it('la exención gana aunque haya sujetos válidos', () => {
    const r = decidirMarcadoForzado({ subjectKeys: ['u-1'], esSintetico: true })
    expect(r.marcado).toBe(false)
    expect(r.motivo).toBe('cuenta_sintetica')
  })
})

describe('markForcedChallenge (puerta de escritura)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
  })

  async function cargar() {
    return await import('@/lib/security/challengePolicy/forceChallenge')
  }

  it('NO escribe en Redis cuando la cuenta es sintética', async () => {
    ejecutarSql.mockResolvedValue({ rows: [{ is_synthetic: true }] })
    const { markForcedChallenge } = await cargar()
    const { setCached } = await import('@/lib/cache/redis')

    const res = await markForcedChallenge(['u-1', 'device:d-1'], { userId: 'u-1' })

    expect(res).toEqual({ marcado: false, motivo: 'cuenta_sintetica', sujetos: 2 })
    expect(setCached).not.toHaveBeenCalled()
  })

  it('escribe una clave por sujeto cuando la cuenta es normal', async () => {
    ejecutarSql.mockResolvedValue({ rows: [{ is_synthetic: false }] })
    const { markForcedChallenge } = await cargar()
    const { setCached } = await import('@/lib/cache/redis')

    const res = await markForcedChallenge(['u-1', 'device:d-1'], { userId: 'u-1' })

    expect(res.marcado).toBe(true)
    expect(setCached).toHaveBeenCalledTimes(2)
    expect((setCached as jest.Mock).mock.calls.map((c) => c[0]))
      .toEqual(['captcha:force:u-1', 'captcha:force:device:d-1'])
  })

  it('si la BD no contesta, MARCA (fail-open hacia proteger el banco)', async () => {
    ejecutarSql.mockRejectedValue(new Error('sin conexión'))
    const { markForcedChallenge } = await cargar()
    const { setCached } = await import('@/lib/cache/redis')

    const res = await markForcedChallenge(['u-1'], { userId: 'u-1' })

    expect(res.marcado).toBe(true)
    expect(setCached).toHaveBeenCalledTimes(1)
  })

  it('sin userId no puede haber exención: marca', async () => {
    const { markForcedChallenge } = await cargar()
    const { setCached } = await import('@/lib/cache/redis')

    const res = await markForcedChallenge(['device:d-1'], {})

    expect(res.marcado).toBe(true)
    expect(ejecutarSql).not.toHaveBeenCalled()
    expect(setCached).toHaveBeenCalledTimes(1)
  })
})
