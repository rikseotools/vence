/**
 * [T-692] El Bearer se pide DOS veces antes de rendirse.
 *
 * Los casos no son inventados: reproducen lo medido en producción el 08/08/2026, cuando
 * `/api/exam/pending` pasó de nueve días a 0,0 % de 401 al 44,2 % (18 usuarios/día) y
 * `/api/v2/user-stats` arrastraba un 20-36 % diario desde antes. El 63 % de los fallos caía en
 * los 10 primeros segundos de la sesión y NO se recuperaba solo (0 de 29 en `user-stats`).
 *
 * Lo que fija esta suite es el equilibrio entre los dos daños conocidos:
 *   · rendirse a la primera → petición condenada al 401 y pantalla vacía (el defecto);
 *   · reintentar sin freno → [T-419] (sondeo martilleando horas) y [T-210] (58.400
 *     acuñaciones/día de un token que dura 1 h).
 * Por eso el contrato es EXACTAMENTE dos intentos: ni uno ni infinitos.
 */

import {
  obtenerBearerConReintento,
  ESPERA_ENTRE_INTENTOS_MS,
} from '@/lib/api/bearerConReintento'

/** Espera de mentira: los tests no duermen, pero se registra CUÁNTO se habría esperado. */
function esperaFalsa() {
  const esperas: number[] = []
  return { esperas, esperar: async (ms: number) => { esperas.push(ms) } }
}

describe('obtenerBearerConReintento (T-692)', () => {
  it('devuelve el token al primer intento y NO reintenta (caso normal, sin coste extra)', async () => {
    const pedirToken = jest.fn().mockResolvedValue('tok-bueno')
    const { esperas, esperar } = esperaFalsa()

    const r = await obtenerBearerConReintento({ pedirToken, esperar })

    expect(r).toEqual({ token: 'tok-bueno', intentos: 1, loSalvoElReintento: false })
    expect(pedirToken).toHaveBeenCalledTimes(1)
    // Ni una espera: el 99 % del tráfico no puede pagar latencia por este arreglo.
    expect(esperas).toEqual([])
  })

  it('EL CASO DEL DEFECTO: no hay token a la primera y el segundo intento lo salva', async () => {
    const pedirToken = jest.fn()
      .mockResolvedValueOnce(undefined) // arranque: la sesión aún no ha cuajado
      .mockResolvedValueOnce('tok-tardio')
    const { esperas, esperar } = esperaFalsa()

    const r = await obtenerBearerConReintento({ pedirToken, esperar })

    expect(r.token).toBe('tok-tardio')
    expect(r.intentos).toBe(2)
    expect(r.loSalvoElReintento).toBe(true)
    expect(esperas).toEqual([ESPERA_ENTRE_INTENTOS_MS])
  })

  it('se rinde tras DOS intentos — nunca un bucle (el daño de T-419)', async () => {
    const pedirToken = jest.fn().mockResolvedValue(undefined)
    const { esperar } = esperaFalsa()

    const r = await obtenerBearerConReintento({ pedirToken, esperar })

    expect(r).toEqual({ token: null, intentos: 0, loSalvoElReintento: false })
    expect(pedirToken).toHaveBeenCalledTimes(2)
  })

  it('un error al pedir el token no se propaga: para el llamante es «no hay token»', async () => {
    const pedirToken = jest.fn().mockRejectedValue(new Error('red caída'))
    const { esperar } = esperaFalsa()

    await expect(obtenerBearerConReintento({ pedirToken, esperar })).resolves.toEqual({
      token: null, intentos: 0, loSalvoElReintento: false,
    })
  })

  it('si el primer intento LANZA y el segundo responde, vale igual', async () => {
    const pedirToken = jest.fn()
      .mockRejectedValueOnce(new Error('transitorio'))
      .mockResolvedValueOnce('tok-tras-error')
    const { esperar } = esperaFalsa()

    const r = await obtenerBearerConReintento({ pedirToken, esperar })
    expect(r.token).toBe('tok-tras-error')
    expect(r.loSalvoElReintento).toBe(true)
  })

  describe('un token que no sirve NO cuenta como token', () => {
    // Dejarlos pasar produce `Authorization: Bearer ` a secas: el servidor lo rechaza igual,
    // pero pasa a contar como credencial PRESENTADA — que es justo lo que hacía este defecto
    // indistinguible de una sesión con el token roto.
    it.each([
      ['cadena vacía', ''],
      ['solo espacios', '   '],
      ['null', null],
      ['undefined', undefined],
    ])('%s → se reintenta y, si no hay nada, se rinde', async (_caso, valor) => {
      const pedirToken = jest.fn().mockResolvedValue(valor)
      const { esperar } = esperaFalsa()

      const r = await obtenerBearerConReintento({ pedirToken, esperar })

      expect(r.token).toBeNull()
      expect(pedirToken).toHaveBeenCalledTimes(2)
    })
  })

  it('la espera es configurable pero por defecto es la medida (200 ms)', async () => {
    expect(ESPERA_ENTRE_INTENTOS_MS).toBe(200)

    const pedirToken = jest.fn().mockResolvedValue(undefined)
    const { esperas, esperar } = esperaFalsa()
    await obtenerBearerConReintento({ pedirToken, esperar, esperaMs: 50 })
    expect(esperas).toEqual([50])
  })
})
