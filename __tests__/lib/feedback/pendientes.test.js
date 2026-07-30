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

  it('deja de salir pasada la ventana (ya no es una novedad)', () => {
    const d = clasificarPendiente({ status: 'pending', created_at: hace(9), ult_admin: null }, AHORA)
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

  it('una réplica de hace más de un día ya no se avisa', () => {
    const d = clasificarPendiente(
      { status: 'pending', created_at: hace(80), ult_admin: hace(50), ult_user: hace(30), resolved_at: null },
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
