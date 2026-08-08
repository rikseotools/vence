// __tests__/sessions/latidoFallo.test.js — [T-687]
//
// El núcleo que decide qué hacer cuando `latir.cjs` falla en silencio: qué guardar en la marca
// local y qué decir cuando alguien (heartbeat) pregunta si su latido de presencia está roto.
// Puro: ni fs, ni red, ni reloj del sistema (todas las horas se pasan como parámetro).

const { registrarIntento, resumenRecuperacion, lineasAvisoActivo } = require('../../lib/sessions/latidoFallo.cjs')

describe('registrarIntento — acumular la racha de fallos', () => {
  it('el primer fallo abre la marca con intentos=1 y desde=ahora', () => {
    const m = registrarIntento(null, 'connect ECONNREFUSED', '2026-08-07T15:00:00.000Z')
    expect(m).toEqual({
      desde: '2026-08-07T15:00:00.000Z',
      intentos: 1,
      ultimoError: 'connect ECONNREFUSED',
      ultimoIntento: '2026-08-07T15:00:00.000Z',
    })
  })

  it('un segundo fallo conserva el "desde" original y suma intentos', () => {
    const primera = registrarIntento(null, 'timeout', '2026-08-07T15:00:00.000Z')
    const segunda = registrarIntento(primera, 'timeout otra vez', '2026-08-07T15:20:00.000Z')
    expect(segunda.desde).toBe('2026-08-07T15:00:00.000Z')
    expect(segunda.intentos).toBe(2)
    expect(segunda.ultimoError).toBe('timeout otra vez')
    expect(segunda.ultimoIntento).toBe('2026-08-07T15:20:00.000Z')
  })

  it('el mensaje se trunca a 200 caracteres: esto viaja a un fichero y a un evento, no a un log completo', () => {
    const largo = 'x'.repeat(500)
    const m = registrarIntento(null, largo, '2026-08-07T15:00:00.000Z')
    expect(m.ultimoError.length).toBe(200)
  })

  it('sin mensaje no revienta: queda como cadena vacía', () => {
    const m = registrarIntento(null, undefined, '2026-08-07T15:00:00.000Z')
    expect(m.ultimoError).toBe('')
  })
})

describe('resumenRecuperacion — convertir el silencio en un número, no dejarlo sin rastro', () => {
  it('mide los minutos reales entre el primer fallo y la recuperación (caso T-687: 41 min)', () => {
    const marca = { desde: '2026-08-07T15:00:00.000Z', intentos: 6, ultimoError: 'ETIMEDOUT' }
    const r = resumenRecuperacion(marca, '2026-08-07T15:41:00.000Z')
    expect(r.minutos).toBe(41)
    expect(r.intentos).toBe(6)
    expect(r.detalle).toContain('6 intento(s)')
    expect(r.detalle).toContain('41 min')
    expect(r.detalle).toContain('ETIMEDOUT')
  })

  it('un fallo aislado que se recupera al momento da 0 min, no negativo ni NaN', () => {
    const marca = { desde: '2026-08-07T15:00:00.000Z', intentos: 1, ultimoError: 'blip' }
    const r = resumenRecuperacion(marca, '2026-08-07T15:00:00.000Z')
    expect(r.minutos).toBe(0)
  })
})

describe('lineasAvisoActivo — lo que ve la sesión al correr heartbeat con el latido roto', () => {
  it('sin marca no hay nada que avisar (el caso normal, sano)', () => {
    expect(lineasAvisoActivo(null, '2026-08-07T15:41:00.000Z')).toEqual([])
  })

  it('con marca activa, dice cuántos intentos y cuánto silencio lleva — con el número, no solo la palabra', () => {
    const marca = { desde: '2026-08-07T15:00:00.000Z', intentos: 3, ultimoError: 'self-signed certificate' }
    const lineas = lineasAvisoActivo(marca, '2026-08-07T15:41:00.000Z')
    expect(lineas.length).toBeGreaterThan(0)
    expect(lineas[0]).toContain('3 INTENTO')
    expect(lineas[0]).toContain('41 min')
    expect(lineas.some((l) => l.includes('self-signed certificate'))).toBe(true)
    // No puede confundirse con el lease de las tareas (otra señal, otro escritor) — es la
    // confusión exacta que le costó el incidente a la sesión `movil3`.
    expect(lineas.some((l) => l.toLowerCase().includes('lease'))).toBe(true)
  })
})
