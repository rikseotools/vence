import {
  backoffTrasUnauth,
  puedeIntentarAcunar,
  BACKOFF_ANONIMO_MS,
  BACKOFF_CON_SESION_MS,
} from '@/lib/auth/backoffAcunado'

/**
 * [T-671] — el freno estaba puesto para los anónimos y frenaba a todo el mundo. Medido sobre
 * el bundle que YA llevaba el arreglo de los llamantes: 48 % de fallo en 28 usuarios, y **18 de
 * esos 28 no acuñaron un solo token** en toda la ventana. No es que fallara el acuñado: es que
 * ni se intentaba.
 */
describe('backoffTrasUnauth — el silencio se le aplica a quien lo provocó', () => {
  it('anónimo: 60 s, el valor histórico, que es para lo que se puso', () => {
    expect(backoffTrasUnauth(false)).toBe(BACKOFF_ANONIMO_MS)
    expect(BACKOFF_ANONIMO_MS).toBe(60_000)
  })

  it('con sesión: 2 s, porque tiene que caber dentro de lo que tarda alguien en volver a pulsar', () => {
    expect(backoffTrasUnauth(true)).toBe(BACKOFF_CON_SESION_MS)
    expect(BACKOFF_CON_SESION_MS).toBe(2_000)
  })

  it('sigue habiendo suelo con sesión: quitarlo del todo devuelve el flood que esto evita', () => {
    expect(backoffTrasUnauth(true)).toBeGreaterThan(0)
  })
})

describe('puedeIntentarAcunar', () => {
  const T = 1_000_000

  it('con token en caché nunca frena: el silencio es sobre PEDIR uno nuevo', () => {
    expect(puedeIntentarAcunar({ hayCache: true, ahora: T, silencioHasta: T + 60_000, haySesionConocida: false })).toBe(true)
  })

  it('pasado el silencio, se reintenta', () => {
    expect(puedeIntentarAcunar({ hayCache: false, ahora: T, silencioHasta: T, haySesionConocida: false })).toBe(true)
    expect(puedeIntentarAcunar({ hayCache: false, ahora: T + 1, silencioHasta: T, haySesionConocida: true })).toBe(true)
  })

  it('dentro del silencio, calla', () => {
    expect(puedeIntentarAcunar({ hayCache: false, ahora: T, silencioHasta: T + 1, haySesionConocida: true })).toBe(false)
    expect(puedeIntentarAcunar({ hayCache: false, ahora: T, silencioHasta: T + 1, haySesionConocida: false })).toBe(false)
  })

  it('EL CASO DEL INCIDENTE: con sesión, a los 3 s ya se puede reintentar; antes eran 60', () => {
    // El silencio efectivo lo fija `backoffTrasUnauth` al momento del 401, así que a los 3 s
    // un cliente con sesión ya está fuera y un anónimo sigue dentro. Ese es todo el cambio.
    const fallo = T
    const conSesion = fallo + backoffTrasUnauth(true)
    const anonimo = fallo + backoffTrasUnauth(false)
    const tresSegundosDespues = fallo + 3_000

    expect(puedeIntentarAcunar({ hayCache: false, ahora: tresSegundosDespues, silencioHasta: conSesion, haySesionConocida: true })).toBe(true)
    expect(puedeIntentarAcunar({ hayCache: false, ahora: tresSegundosDespues, silencioHasta: anonimo, haySesionConocida: false })).toBe(false)
  })
})
