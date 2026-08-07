// __tests__/security/levantarRetoForzado.test.ts
//
// El gesto INVERSO de marcar un reto forzado, que hasta el 07/08/2026 no existía: la marca se
// ponía sola con TTL de 24 h y nadie podía quitarla. Se notó con el canario que el propio
// antifraude marcó (T-651) — 21 h condenado a rojo — pero lo que de verdad lo justifica es que
// ese mismo día seis usuarias PREMIUM recibieron el captcha: sin esto, a una mal marcada solo se
// le podía decir «espera un día».
//
// Se ejercita el criterio PURO (compartido por el endpoint admin y el CLI) y el levantado, que
// traduce sujeto → clave en el único sitio que conoce el formato.

const { planearLevantado, MOTIVO_MINIMO } = require('@/lib/security/challengePolicy/levantarMarcaCore.cjs')

const mockInvalidate = jest.fn()
jest.mock('@/lib/cache/redis', () => ({
  invalidate: (...args: unknown[]) => mockInvalidate(...args),
  setCached: jest.fn(),
  getCached: jest.fn(),
}))

const MOTIVO_OK = 'falso positivo: es el canario de smoke, no un scraper'

describe('planearLevantado — el criterio que comparten endpoint y CLI', () => {
  it('exige motivo: sin él no se levanta una defensa', () => {
    const r = planearLevantado({ userId: 'u-1', motivo: '' })
    expect(r.valido).toBe(false)
    expect(r.error).toMatch(/motivo/i)
  })

  it('rechaza el motivo de trámite («ok», «ya»), que no explica nada en tres semanas', () => {
    expect(planearLevantado({ userId: 'u-1', motivo: 'ok' }).valido).toBe(false)
    expect(planearLevantado({ userId: 'u-1', motivo: 'ya' }).valido).toBe(false)
    expect('ok'.length).toBeLessThan(MOTIVO_MINIMO)
  })

  it('exige al menos un sujeto', () => {
    const r = planearLevantado({ motivo: MOTIVO_OK })
    expect(r.valido).toBe(false)
    expect(r.error).toMatch(/sujeto/i)
  })

  it('con usuario y dispositivo levanta LOS DOS: la marca se puso sobre ambos', () => {
    const r = planearLevantado({ userId: 'u-1', deviceId: 'd-9', motivo: MOTIVO_OK })
    expect(r.valido).toBe(true)
    expect(r.sujetos).toEqual(['u-1', 'device:d-9'])
  })

  it('solo dispositivo: caza la cuenta nueva en la misma máquina', () => {
    const r = planearLevantado({ deviceId: 'd-9', motivo: MOTIVO_OK })
    expect(r.sujetos).toEqual(['device:d-9'])
  })

  it('el núcleo NO conoce el formato de la clave de Redis (una sola puerta)', () => {
    const r = planearLevantado({ userId: 'u-1', motivo: MOTIVO_OK })
    expect(JSON.stringify(r)).not.toContain('captcha:force')
  })
})

describe('levantarMarcas — traduce sujeto → clave y no se queda a medias', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockInvalidate.mockResolvedValue(undefined)
  })

  it('borra una clave por sujeto, con el formato de la puerta única', async () => {
    const { levantarMarcas } = await import('@/lib/security/challengePolicy/levantarMarca')

    const r = await levantarMarcas(['u-1', 'device:d-9'])

    expect(r.levantados).toEqual(['u-1', 'device:d-9'])
    expect(r.fallidos).toEqual([])
    expect(mockInvalidate.mock.calls.map((c) => c[0])).toEqual([
      'captcha:force:u-1',
      'captcha:force:device:d-9',
    ])
  })

  it('si un sujeto falla, los demás se intentan igual y se dice cuál quedó', async () => {
    mockInvalidate
      .mockRejectedValueOnce(new Error('redis caído'))
      .mockResolvedValueOnce(undefined)
    const { levantarMarcas } = await import('@/lib/security/challengePolicy/levantarMarca')

    const r = await levantarMarcas(['u-1', 'device:d-9'])

    // A medias es el peor sitio: el usuario sigue viendo captchas y quien ejecutó cree que ya está.
    expect(r.fallidos).toEqual(['u-1'])
    expect(r.levantados).toEqual(['device:d-9'])
  })
})
