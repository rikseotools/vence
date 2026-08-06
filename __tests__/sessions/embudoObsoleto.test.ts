/**
 * @jest-environment node
 *
 * [T-606] El embudo se llena de preguntas por casos ya decididos, y nadie puede quitarlas.
 *
 * `retirar` lleva `AND sid = <la tuya>`, así que una pregunta solo la retira quien la escribió —
 * y quien la escribió suele ser un turno de flota de ayer. Cuando OTRA sesión cierra el caso (el
 * flujo normal: quien tiene la reserva es quien cierra), la pregunta se queda ahí para siempre.
 *
 * Medido el 06/08/2026: de 16 entradas abiertas, 8 preguntaban por impugnaciones ya cerradas y
 * respondidas, todas de 25-30 h. Cuatro eran las del incidente de [T-609]: pedían permiso para
 * mandar unos correos que ya se habían mandado.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { casoCerradoQueCita, puedeRetirar } = require('../../lib/sessions/embudoObsoleto.cjs')

const DISPUTES = [
  { id: '066a3d65-1111-2222-3333-444455556666', status: 'rejected' },
  { id: 'f34b88ad-aaaa-bbbb-cccc-ddddeeeeffff', status: 'resolved' },
  { id: '9cf8da61-9999-8888-7777-666655554444', status: 'pending' },
  { id: '15db0cb8-0000-1111-2222-333344445555', status: 'appealed' },
]

describe('[T-606] casoCerradoQueCita', () => {
  it('EL CASO REAL: el id vive en la PROSA, no en draft_target', () => {
    // Las 8 medidas son `kind='pregunta'` con `draft_target IS NULL`. Un barrido que solo mirase
    // esa columna —que es como la ficha original imaginó el arreglo— no habría visto ninguna.
    const fila = { question: 'Borrador RECHAZO para 066a3d65 (Manolo, Dip. Córdoba, art.108 CE) — ¿lo apruebo?', draft_target: null }
    expect(casoCerradoQueCita(fila, DISPUTES)).toMatchObject({ status: 'rejected' })
  })

  it('también lo encuentra en draft_target y en context (pidiendo aprobación)', () => {
    expect(casoCerradoQueCita({ question: '¿lo apruebas?', draft_target: 'impugnación f34b88ad (CE art.112)' }, DISPUTES))
      .toMatchObject({ status: 'resolved' })
    expect(casoCerradoQueCita({ question: '¿apruebas el borrador?', context: 'viene de f34b88ad' }, DISPUTES))
      .toMatchObject({ status: 'resolved' })
  })

  it('un caso PENDIENTE no se toca: ahí la pregunta sigue viva', () => {
    expect(casoCerradoQueCita({ question: 'sobre 9cf8da61 ¿qué hago?' }, DISPUTES)).toBeNull()
  })

  it('una RÉPLICA (appealed) tampoco: es justo cuando más falta hace preguntar', () => {
    expect(casoCerradoQueCita({ question: 'la réplica 15db0cb8, ¿la contesto?' }, DISPUTES)).toBeNull()
  })

  it('una pregunta que no cita ningún caso se queda donde está', () => {
    expect(casoCerradoQueCita({ question: '¿quito Stripe Link del checkout?' }, DISPUTES)).toBeNull()
  })

  it('no casa un id dentro de otro hash (frontera)', () => {
    expect(casoCerradoQueCita({ question: 'el commit abc066a3d65def' }, DISPUTES)).toBeNull()
  })

  // ── LOS CINCO FALSOS POSITIVOS REALES ───────────────────────────────────────────────────
  // La primera versión marcaba «cualquier entrada que mencione un caso cerrado» y el dry-run
  // contra el embudo real dio 12 de 16, con estos 5 dentro. Los cinco son preguntas VIVAS que
  // citan una impugnación como EJEMPLO o como CONTEXTO. Retirarlas habría perdido justo lo que
  // este canal existe para no perder, así que van clavados uno a uno.
  it.each([
    ['#38 — decisión de rumbo', 'T-579: ¿investigo si hay fuga de preguntas fuera del topic_scope, o lo dejo anotado? (viene de f34b88ad)'],
    ['#45 — huecos de permisos', 'Dos huecos nuevos de permisos en vence_coordinacion: el dossier de 066a3d65 moría entero por SELECT en user_profiles'],
    ['#55 — pregunta de diseño', '¿Documento user_theme_stats.position_type como vía no-PII, o espero al fix de RLS? Lo vi analizando f34b88ad'],
    ['#73 — la medida del propio embudo', 'El embudo está saturado de borradores duplicados: 066a3d65 tiene 3, f34b88ad tiene 5'],
    ['#74 — otro fallo de permisos', "cola.cjs list revienta con 'permission denied for user_feedback' — lo vi al abrir 066a3d65. ¿Mismo GRANT o ficha aparte?"],
  ])('NO retira %s: cita un caso cerrado pero no pide aprobar nada', (_, question) => {
    expect(casoCerradoQueCita({ question }, DISPUTES)).toBeNull()
  })

  it('un kind=borrador SÍ cuenta por construcción: existe para que alguien lo apruebe', () => {
    expect(casoCerradoQueCita({ kind: 'borrador', draft_target: 'impugnación 066a3d65', question: '' }, DISPUTES))
      .toMatchObject({ status: 'rejected' })
  })
})

describe('[T-606] puedeRetirar — se levanta el dueño SOLO sobre lo ya decidido', () => {
  it('la mía, siempre', () => {
    expect(puedeRetirar({ esMia: true, caso: null }).permitido).toBe(true)
  })

  it('ajena con el caso CERRADO: se puede — no hay decisión que proteger', () => {
    const v = puedeRetirar({ esMia: false, caso: { id: '066a3d65-…', status: 'rejected' } })
    expect(v.permitido).toBe(true)
    expect(v.motivo).toMatch(/rejected/)
  })

  it('ajena con el caso ABIERTO: NO — sería borrar el trabajo vivo de otra sesión', () => {
    // Esta es la razón por la que existe el `AND sid`, y no se toca.
    const v = puedeRetirar({ esMia: false, caso: null })
    expect(v.permitido).toBe(false)
    expect(v.motivo).toMatch(/trabajo vivo/)
  })
})
