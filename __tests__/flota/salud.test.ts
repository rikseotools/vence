/**
 * @jest-environment node
 */
// La salud de la flota, en el panel donde se mira la del resto. (T-486)
//
// Las señales ya llegaban al panel POR EL CATCH-ALL, que es la red de seguridad y no una vista:
// sirve para que nada capturado quede oculto, no para responder «¿está la flota bien?». Para eso
// había que abrir una terminal — la salud de los trabajadores era la única que no se podía mirar
// donde se mira todo lo demás.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const S = require('@/lib/flota/salud.cjs')

const AHORA = new Date('2026-08-05T18:00:00Z')
const hace = (min: number) => new Date(AHORA.getTime() - min * 60000).toISOString()
const vivo = (n: number) => Array.from({ length: n }, () => ({ last_signal_at: hace(2) }))

describe('lo peor primero: una flota parada no se nota', () => {
  // Sigue apareciendo en el registro, nadie recibe una queja, y puede estar así horas.
  it('todos sin señal es ROJO aunque no haya cola ninguna', () => {
    const v = S.saludFlota({ sesiones: [{ last_signal_at: hace(90) }], esperados: 10, ahora: AHORA })
    expect(v.estado).toBe('rojo')
    expect(v.detalle).toMatch(/parada/)
  })

  it('cinco turnos muertos es ROJO: eso ya no es azar', () => {
    const v = S.saludFlota({ sesiones: vivo(10), esperados: 10, turnosMuertos: 5, ahora: AHORA })
    expect(v.estado).toBe('rojo')
    expect(v.detalle).toMatch(/en serie/)
  })

  it('pero uno o dos sueltos no: un turno se acaba, es normal', () => {
    expect(S.saludFlota({ sesiones: vivo(10), esperados: 10, turnosMuertos: 2, ahora: AHORA }).estado).toBe('verde')
  })
})

describe('después, lo que cuesta tiempo de Manuel', () => {
  it('la cola de entregas pasa a ámbar y dice la más vieja', () => {
    const v = S.saludFlota({
      sesiones: vivo(10), esperados: 10,
      entregas: [1, 2, 3, 4, 5, 6, 7, 8].map((h) => ({ review_requested_at: hace(h * 60) })),
      ahora: AHORA,
    })
    expect(v.estado).toBe('ambar')
    expect(v.esperaMaxH).toBe(8)
    expect(v.detalle).toMatch(/8 h/)
  })

  // [T-689] El conteo (≥8) no ve una cola CORTA pero VIEJA: 1-3 entregas reales esperaron horas
  // sin que el semáforo se moviera, medido contra backlog_tasks (T-612, T-163…). La edad tiene
  // que disparar ámbar POR SU CUENTA, sin depender del conteo.
  it('una sola entrega vieja ya es ámbar, aunque el conteo no llegue a 8', () => {
    const v = S.saludFlota({
      sesiones: vivo(10), esperados: 10,
      entregas: [{ review_requested_at: hace(3 * 60) }],
      ahora: AHORA,
    })
    expect(v.estado).toBe('ambar')
    expect(v.esperaMaxH).toBe(3)
    expect(v.detalle).toMatch(/objetivo de 2 h/)
  })

  it('pero una entrega reciente (menos de 2h) no dispara nada por sí sola', () => {
    const v = S.saludFlota({
      sesiones: vivo(10), esperados: 10,
      entregas: [{ review_requested_at: hace(90) }],
      ahora: AHORA,
    })
    expect(v.estado).toBe('verde')
  })

  // Un borrador es distinto de una entrega: espera un PERMISO, no una revisión. Y mientras espera,
  // hay una persona que escribió y no ha recibido respuesta.
  it('un solo borrador ya es ámbar, y dice que no se ha enviado nada', () => {
    const v = S.saludFlota({ sesiones: vivo(10), esperados: 10, borradores: 1, ahora: AHORA })
    expect(v.estado).toBe('ambar')
    expect(v.detalle).toMatch(/nada de eso se ha enviado/)
  })

  it('faltar trabajadores es ámbar, no rojo: los demás siguen', () => {
    const v = S.saludFlota({ sesiones: vivo(7), esperados: 10, ahora: AHORA })
    expect(v).toMatchObject({ estado: 'ambar', vivos: 7, esperados: 10 })
  })
})

describe('verde de verdad', () => {
  it('todos vivos y nada esperando', () => {
    const v = S.saludFlota({ sesiones: vivo(10), esperados: 10, ahora: AHORA })
    expect(v).toMatchObject({ estado: 'verde', vivos: 10 })
  })

  // Sin flota declarada no se pinta una alarma: no hay nada roto, es que no hay flota.
  it('sin flota declarada no inventa una alarma', () => {
    expect(S.saludFlota({ ahora: AHORA }).estado).toBe('verde')
  })
})

describe('lo que un panel NO puede saber, y no finge', () => {
  // El panel es una página web: no entra en las máquinas. «¿Está ejecutando?» lo sabe el CLI
  // mirando el tmux; aquí solo consta lo que está en la base. Fingirlo sería inventar.
  it('no expone nada sobre procesos vivos', () => {
    const v = S.saludFlota({ sesiones: vivo(3), esperados: 3, ahora: AHORA })
    expect(Object.keys(v).join(' ')).not.toMatch(/ejecut|proceso|tmux/i)
  })

  // Una señal sin fecha no es «viva»: es una fila que no dice nada.
  it('una sesión sin last_signal_at no cuenta como viva', () => {
    expect(S.saludFlota({ sesiones: [{ last_signal_at: null }], esperados: 1, ahora: AHORA }).vivos).toBe(0)
  })
})
