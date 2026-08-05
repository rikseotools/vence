/**
 * @jest-environment node
 */
// Un borrador por destinatario. (T-486)
//
// Los primeros diez borradores de la flota traían TRES pares duplicados: dos trabajadores habían
// analizado la misma impugnación y cada uno dejó el suyo. El claim de la cola funciona — protege el
// trabajo SIMULTÁNEO; lo que nadie protegía era el trabajo YA HECHO, porque al terminar el
// trabajador suelta la fila (hace bien: no puede cerrarla) y vuelve al pool.
//
// El coste no es la cuota gastada dos veces: es que Manuel abre la cola y tiene que decidir cuál de
// los dos mandar, que es justo el trabajo que la flota venía a ahorrarle.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const B = require('@/lib/backlog/borradores.cjs')

describe('reconocer «el mismo caso»', () => {
  // Los trabajadores escriben el destinatario con su propia prosa: comparar cadenas no los
  // emparejaría nunca. Lo que comparten es el identificador.
  it('empareja dos redacciones distintas del mismo id', () => {
    const a = "impugnación 1aac9e3c (LO 3/2007 art.12, 'no corresponde al temario')"
    const b = "impugnación 1aac9e3c (otro/tema_incorrecto: 'no corresponde')"
    expect(B.claveDe(a)).toBe(B.claveDe(b))
  })

  it('acepta el UUID entero o su prefijo', () => {
    expect(B.claveDe('impugnación 968b0a9d-a88f-422d-9315-51f386b5ce5a (art. 44)')).toBe('968b0a9d')
    expect(B.claveDe('impugnación 968b0a9d (art. 44)')).toBe('968b0a9d')
  })

  // Sin id NO se deduplica, a propósito: «Marta» y «la lista de inscritos» pueden ser dos
  // destinatarios legítimamente distintos, y bloquear por parecido impediría el segundo de verdad.
  it.each(['la lista de inscritos', 'Marta', '', null])('«%s» no tiene clave', (d) => {
    expect(B.claveDe(d as any)).toBeNull()
  })
})

describe('la puerta', () => {
  const abiertos = [
    { id: 22, draft_target: "impugnación 1aac9e3c (LO 3/2007 art.12)", sid: 'l5-fedora-e6' },
    { id: 24, draft_target: 'impugnación 4683e35b (desacuerdo_correcta)', sid: 'l6-fedora-c5' },
  ]

  it('el caso real: el segundo borrador de 1aac9e3c se para', () => {
    const v = B.yaHayUno("impugnación 1aac9e3c (otro/tema_incorrecto)", abiertos)
    expect(v.duplicado).toBe(true)
    expect(v.existente.id).toBe(22)
    expect(v.motivo).toMatch(/#22/)
  })

  it('un caso nuevo pasa', () => {
    expect(B.yaHayUno('impugnación 744f0db0 (art. 27)', abiertos).duplicado).toBe(false)
  })

  it('sin id no bloquea nunca', () => {
    expect(B.yaHayUno('la lista de inscritos', abiertos).duplicado).toBe(false)
  })

  it('sin borradores abiertos tampoco', () => {
    expect(B.yaHayUno('impugnación 1aac9e3c', []).duplicado).toBe(false)
  })

  // Un bloqueo sin salida se rodea ([T-375]): tiene que ofrecer el camino bueno ANTES del escape.
  it('el mensaje manda leer el que ya hay, y el escape va el último', () => {
    const m = B.mensajeDuplicado(B.yaHayUno('impugnación 1aac9e3c', abiertos))
    expect(m).toMatch(/backlog\.cjs preguntas/)
    expect(m.indexOf('preguntas')).toBeLessThan(m.indexOf('--igualmente'))
  })
})

// ── LA COLA NO PUEDE REPARTIR LO QUE YA ESTÁ TRABAJADO ──────────────────────────────────────
// `yaHayUno` corta al FINAL: el trabajador ya gastó el turno entero leyendo la impugnación y
// contrastándola contra el BOE, y entonces se le dice que ya había un borrador. Como un
// `claude -p` muere al acabar, ese trabajo no se recupera. Lo que hay que impedir es que se la
// ENTREGUEN — y el claim no puede verlo, porque el trabajador SUELTA la fila al terminar.
// Medido el 05/08 contra producción: 15 de 16 impugnaciones abiertas ya tenían borrador.
describe('sqlSinBorradorPendiente — el mismo criterio, en la puerta de la cola', () => {
  const { sqlSinBorradorPendiente, claveDe } = require(
    require('path').join(process.cwd(), 'lib', 'backlog', 'borradores.cjs'))

  it('excluye por el prefijo de 8 hex, que es la MISMA clave que usa claveDe', () => {
    const sql = sqlSinBorradorPendiente('public.question_disputes.')
    expect(sql).toMatch(/left\(public\.question_disputes\.id::text, 8\)/)
    // La clave tiene que ser la misma en las dos puertas: si una compara 8 hex y la otra el uuid
    // entero, la cola repartiría justo lo que el guard de creación va a rechazar.
    expect(claveDe('impugnación 744f0db0-1234-… (cita errónea)')).toBe('744f0db0')
  })

  it('solo mira borradores ABIERTOS: uno ya aprobado no puede bloquear la cola para siempre', () => {
    const sql = sqlSinBorradorPendiente()
    expect(sql).toMatch(/kind = 'borrador'/)
    expect(sql).toMatch(/status = 'open'/)
  })

  it('es una exclusión, no un filtro positivo (NOT EXISTS)', () => {
    expect(sqlSinBorradorPendiente()).toMatch(/NOT EXISTS/)
  })

  it('acepta prefijo de tabla para poder calificarse dentro del UPDATE atómico', () => {
    expect(sqlSinBorradorPendiente('d.')).toContain('left(d.id::text, 8)')
    expect(sqlSinBorradorPendiente()).toContain('left(id::text, 8)')
  })
})

// ── EL MENSAJE LO FIRMA UN EQUIPO, ASÍ QUE VA EN PLURAL ─────────────────────────────────────
// Norma de Manuel (05/08/2026): «además he comprobado no, hemos comprobado, siempre en plural».
// Medido ese día: 4 de 26 borradores de la flota estaban en singular y ninguna capa lo miraba.
describe('primeraPersonaSingular — la firma vista desde dentro del texto', () => {
  const { primeraPersonaSingular, avisoPlural } = require(
    require('path').join(process.cwd(), 'lib', 'backlog', 'borradores.cjs'))

  it('caza las formas reales que aparecieron en los borradores', () => {
    expect(primeraPersonaSingular('He comprobado el atajo contra la documentación.')).toHaveLength(1)
    expect(primeraPersonaSingular('BLOQUEADO: no puedo leer target_oposicion.')).toHaveLength(1)
    expect(primeraPersonaSingular('He revisado tu impugnación sobre el artículo 68.')).toHaveLength(1)
  })

  it('deja pasar el plural, que es lo correcto', () => {
    expect(primeraPersonaSingular('Hemos comprobado el atajo con la documentación oficial.')).toEqual([])
    expect(primeraPersonaSingular('Te confirmamos que la clave es la B.')).toEqual([])
  })

  it('no confunde el «he» de otra palabra ni el plural que lo contiene', () => {
    expect(primeraPersonaSingular('El archivo adjunto he.pdf no existe')).toEqual([])
    expect(primeraPersonaSingular('Hemos comprobado')).toEqual([])
  })

  it('AVISA, no bloquea: el aviso dice que una cita en singular es legítima', () => {
    const aviso = avisoPlural(['He comprobado'])
    expect(aviso).toMatch(/CITA/i)
    expect(aviso).toMatch(/hemos comprobado/i)
  })
})
