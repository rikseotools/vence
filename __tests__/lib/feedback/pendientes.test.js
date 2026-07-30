// ¿Qué feedback sigue esperando respuesta?
//
// ## Por qué (30/07/2026)
//
// El vigía marcaba «te han contestado» comparando solo los mensajes: último del usuario +
// alguno nuestro antes = réplica pendiente. Pero cuando alguien escribe «genial, muchas
// gracias» el hilo se cierra en SILENCIO, sin mensaje nuestro (mandarle un aviso vacío sería
// peor). Como no se inserta nada, la comparación seguía diciendo «el último es del usuario» y
// el aviso reaparecía en cada pasada durante 24 horas: tres agradecimientos ya cerrados
// seguían saliendo ese día.
//
// Un vigía que repite lo ya hecho se vuelve ruido, y al ruido uno se acostumbra: entonces
// deja de ver el aviso de verdad. La regla que fija esto: **cerrar también es atender**.
const { clasificarPendiente, filtrarPendientes } = require('@/lib/feedback/pendientes')

const AHORA = new Date('2026-07-30T12:00:00Z').getTime()
const hace = (h) => new Date(AHORA - h * 3600_000).toISOString()

describe('feedback nuevo, sin responder', () => {
  it('sale cuando es reciente y nadie ha contestado', () => {
    const d = clasificarPendiente({ status: 'pending', created_at: hace(2), ult_admin: null }, AHORA)
    expect(d).toMatchObject({ pendiente: true, clase: 'NUEVO' })
  })

  // La ventana pasó de 6 h a 30 días el 30/07: con 6 h, lo no atendido en media mañana
  // desaparecía del vigía. Se conserva un límite solo para no arrastrar restos históricos.
  it('deja de salir pasado el límite histórico (30 días), no antes', () => {
    const d = clasificarPendiente({ status: 'pending', created_at: hace(24 * 45), ult_admin: null }, AHORA)
    expect(d.pendiente).toBe(false)
    expect(d.motivo).toBe('fuera_de_ventana')
  })

  it('si se cerró sin responder, no se avisa', () => {
    const d = clasificarPendiente({ status: 'dismissed', created_at: hace(1), ult_admin: null }, AHORA)
    expect(d.pendiente).toBe(false)
  })
})

describe('réplica del usuario', () => {
  it('sale cuando nos ha vuelto a escribir tras nuestra respuesta', () => {
    const d = clasificarPendiente(
      { status: 'pending', created_at: hace(30), ult_admin: hace(5), ult_user: hace(2), resolved_at: null },
      AHORA,
    )
    expect(d).toMatchObject({ pendiente: true, clase: 'REPLICA' })
  })

  it('EL FALLO DEL 30/07: una réplica cerrada EN SILENCIO deja de repetirse', () => {
    // «Genial, muchas gracias» a las 08:16 → cierre sin mensaje a las 10:20. No hay mensaje
    // nuestro posterior, así que el criterio viejo lo daba por pendiente para siempre.
    const d = clasificarPendiente(
      { status: 'resolved', created_at: hace(40), ult_admin: hace(6), ult_user: hace(4), resolved_at: hace(2) },
      AHORA,
    )
    expect(d.pendiente).toBe(false)
    expect(d.motivo).toBe('atendida_con_cierre_silencioso')
  })

  it('pero si escribe DESPUÉS del cierre, vuelve a salir', () => {
    const d = clasificarPendiente(
      { status: 'resolved', created_at: hace(40), ult_admin: hace(8), ult_user: hace(1), resolved_at: hace(3) },
      AHORA,
    )
    expect(d).toMatchObject({ pendiente: true, clase: 'REPLICA' })
  })

  it('una réplica en un hilo cerrado SIN atender sí sale (es justo la que se pierde)', () => {
    const d = clasificarPendiente(
      { status: 'resolved', created_at: hace(40), ult_admin: hace(6), ult_user: hace(2), resolved_at: null },
      AHORA,
    )
    expect(d).toMatchObject({ pendiente: true, clase: 'REPLICA' })
  })

  it('una réplica de hace más de una semana ya no se avisa', () => {
    const d = clasificarPendiente(
      { status: 'pending', created_at: hace(24 * 20), ult_admin: hace(24 * 15), ult_user: hace(24 * 9), resolved_at: null },
      AHORA,
    )
    expect(d.pendiente).toBe(false)
    expect(d.motivo).toBe('replica_antigua')
  })

  it('si el último mensaje es NUESTRO, no hay réplica', () => {
    const d = clasificarPendiente(
      { status: 'pending', created_at: hace(30), ult_admin: hace(1), ult_user: hace(3), resolved_at: null },
      AHORA,
    )
    expect(d.pendiente).toBe(false)
    expect(d.motivo).toBe('sin_replica')
  })
})

describe('filtrarPendientes', () => {
  it('deja solo lo pendiente y le pone su clase', () => {
    const out = filtrarPendientes(
      [
        { id: 'nuevo', status: 'pending', created_at: hace(1), ult_admin: null },
        { id: 'cerrado-en-silencio', status: 'resolved', created_at: hace(40), ult_admin: hace(6), ult_user: hace(4), resolved_at: hace(2) },
        { id: 'replica', status: 'pending', created_at: hace(30), ult_admin: hace(5), ult_user: hace(2), resolved_at: null },
      ],
      AHORA,
    )
    expect(out.map((x) => x.id)).toEqual(['nuevo', 'replica'])
    expect(out.map((x) => x.clase)).toEqual(['NUEVO', 'REPLICA'])
  })

  it('lista vacía o nula no rompe', () => {
    expect(filtrarPendientes([], AHORA)).toEqual([])
    expect(filtrarPendientes(null, AHORA)).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// EL AGUJERO DE LA VENTANA (30/07/2026)
//
// El «sin responder» tenía una ventana de 6 HORAS: pasadas esas, un feedback que nadie había
// contestado desaparecía del vigía. Lo contrario de para lo que existe.
//
// Medido el día que se cazó: el vigía decía «cola limpia» y había NUEVE sin responder — un
// BUG, un premium preguntando por el cambio de método de suscripción, dos bajas de cuenta — y
// el más viejo llevaba dos días. Lo vio Manuel mirando el panel, no el vigía.
//
// Pendiente es pendiente, tenga la edad que tenga.
// ─────────────────────────────────────────────────────────────────────────────
describe('un feedback sin responder no se esconde por viejo', () => {
  const AHORA2 = new Date('2026-07-30T14:00:00Z').getTime()
  const hace2 = (h) => new Date(AHORA2 - h * 3600_000).toISOString()

  it('el de hace DOS DÍAS sigue saliendo (antes desaparecía a las 6 h)', () => {
    const d = clasificarPendiente({ status: 'pending', created_at: hace2(48), ult_admin: null }, AHORA2)
    expect(d.pendiente).toBe(true)
    expect(d.clase).toBe('NUEVO')
  })

  it('y el de hace una semana también', () => {
    const d = clasificarPendiente({ status: 'pending', created_at: hace2(24 * 7), ult_admin: null }, AHORA2)
    expect(d.pendiente).toBe(true)
  })

  it('una réplica de hace tres días sigue contando', () => {
    const d = clasificarPendiente(
      { status: 'pending', created_at: hace2(24 * 10), ult_admin: hace2(24 * 5), ult_user: hace2(24 * 3), resolved_at: null },
      AHORA2,
    )
    expect(d.pendiente).toBe(true)
    expect(d.clase).toBe('REPLICA')
  })

  it('pero un resto histórico de hace meses ya no se arrastra', () => {
    const d = clasificarPendiente({ status: 'pending', created_at: hace2(24 * 90), ult_admin: null }, AHORA2)
    expect(d.pendiente).toBe(false)
    expect(d.motivo).toBe('fuera_de_ventana')
  })
})
