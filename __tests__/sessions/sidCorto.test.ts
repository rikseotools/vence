/**
 * sidCorto.test.ts — un sid abreviado no puede confundirse con el de otra sesión. (T-538)
 *
 * ## El caso que fija
 *
 * `crear-worktree.sh` acuña los sid con la forma `<nombre>-<máquina>-<azar>`, donde lo distintivo
 * va al principio. Once sitios lo recortaban a mano por LONGITUD (unos a 8, otros a 12), que es
 * cortar justo por donde no es: el 04/08, con cinco sesiones abiertas el mismo día, `imp-04ago-b`,
 * `-c`, `-d`, `-e` y `-g` se escribían todas `imp-04ag`.
 *
 * Y no era cosmético: `cola.cjs list` marcaba con un candado seis reservas ajenas y, junto al
 * candado, el nombre que quien miraba reconocía como suyo. El icono distinguía; el texto no. Ocho
 * filas ajenas leídas como propias, y tres viajes a la base de datos para deshacer el equívoco.
 */
import path from 'path'
import { createRequire } from 'module'

const req = createRequire(__filename)
const ROOT = path.join(__dirname, '..', '..')
const { sidCorto, nuevoSid } = req(path.join(ROOT, 'lib/sessions/sid.cjs'))
const { etiquetaReserva } = req(path.join(ROOT, 'lib/impugnaciones/reserva.cjs'))

/** Las cinco sesiones reales que había abiertas el 04/08. Comparten los 8 primeros caracteres. */
const HERMANAS = [
  'imp-04ago-b-fedora-45b0da',
  'imp-04ago-c-fedora-eca3f1',
  'imp-04ago-d-fedora-75459b',
  'imp-04ago-e-fedora-b6a253',
  'imp-04ago-g-fedora-73618e',
]

describe('sidCorto — abrevia por segmento, nunca por longitud', () => {
  it('CINCO sesiones del mismo día se escriben DISTINTO (a 8 caracteres eran idénticas)', () => {
    // La comprobación que habría cazado el bug: a `slice(0,8)` este Set tendría tamaño 1.
    expect(new Set(HERMANAS.map((s) => s.slice(0, 8))).size).toBe(1)
    expect(new Set(HERMANAS.map(sidCorto)).size).toBe(HERMANAS.length)
  })

  it('conserva el nombre entero y tira máquina y azar, que no identifican nada para un humano', () => {
    expect(sidCorto('imp-04ago-c-fedora-eca3f1')).toBe('imp-04ago-c')
    expect(sidCorto('t486-flota-fedora-aead7f')).toBe('t486-flota')
  })

  it('es el inverso de nuevoSid cuando hay máquina, que es el caso normal', () => {
    // Si `nuevoSid` cambia de forma, esto se entera: son las dos mitades del mismo contrato.
    expect(sidCorto(nuevoSid('imp-04ago-z', { host: 'fedora', azar: () => 'abc123' }))).toBe('imp-04ago-z')
  })

  it('SIN máquina no se poda, y es la decisión correcta', () => {
    // `nuevoSid` hace `.filter(Boolean)`, así que sin host el sid queda en DOS segmentos
    // (`sesion-abc123`) y no se puede distinguir de un nombre legítimo cuyo segundo segmento
    // parezca hexadecimal (`deploy-abcdef`). Entre dejar una línea algo más larga y arriesgarse a
    // podar un nombre real, se deja larga: el daño de este bug fue justo una abreviatura que se
    // parecía a otra cosa. Y no colisiona, porque el azar sigue ahí.
    expect(sidCorto(nuevoSid('sesion', { host: null, azar: () => 'abc123' }))).toBe('sesion-abc123')
    expect(sidCorto('deploy-abcdef')).toBe('deploy-abcdef')
  })

  it('NO toca un sid que no tiene esa forma — más vale largo que colisionando', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    expect(sidCorto(uuid)).toBe(uuid)
    expect(sidCorto('sesion-antigua')).toBe('sesion-antigua')
  })

  it('no devuelve nunca undefined ni cadena vacía', () => {
    expect(sidCorto(null)).toBe('?')
    expect(sidCorto(undefined)).toBe('?')
    expect(sidCorto('   ')).toBe('?')
  })
})

describe('la etiqueta de la cola dice de QUIÉN es, no solo un identificador', () => {
  const AHORA = new Date('2026-08-04T12:30:00Z')
  const YO = 'imp-04ago-c-fedora-eca3f1'
  const OTRA = 'imp-04ago-b-fedora-45b0da'
  const sesiones = [
    { sid: YO, last_signal_at: AHORA },
    { sid: OTRA, last_signal_at: AHORA },
  ]
  const hace = (min: number) => new Date(AHORA.getTime() - min * 60_000)
  const etiqueta = (claimedBy: string | null, min = 20) =>
    etiquetaReserva({ claimedBy, claimedAt: claimedBy ? hace(min) : null, sesiones, sid: YO, ahora: AHORA })

  it('la mía se anuncia como TUYA, sin identificador que interpretar', () => {
    expect(etiqueta(YO)).toBe('🙋 TUYA')
  })

  it('la ajena dice «otra sesión» EN PALABRAS, no solo con un icono', () => {
    // El fallo original: el emoji distinguía y el texto decía lo contrario. Lo que se lee es el
    // texto, así que la relación tiene que estar escrita.
    const s = etiqueta(OTRA)
    expect(s).toContain('otra sesión')
    expect(s).toContain('imp-04ago-b')
    expect(s).not.toContain('TUYA')
  })

  it('la mía y la de la sesión hermana NO se pueden confundir', () => {
    // El caso exacto del 04/08: mismos 8 primeros caracteres, distinta sesión.
    expect(etiqueta(YO)).not.toBe(etiqueta(OTRA))
    expect(etiqueta(OTRA)).not.toContain(sidCorto(YO))
  })

  it('libre y sin reservar siguen igual: esto solo cambia cómo se nombra al dueño', () => {
    expect(etiqueta(null)).toBe('🟢 libre')
    // Reserva vieja de una sesión que ya no late → libre, y el motivo se conserva.
    const muerta = etiquetaReserva({
      claimedBy: OTRA,
      claimedAt: hace(400),
      sesiones: [{ sid: OTRA, last_signal_at: hace(300) }],
      sid: YO,
      ahora: AHORA,
    })
    expect(muerta).toContain('🟢 libre')
    expect(muerta).toContain('no late')
  })
})
