/**
 * @jest-environment node
 */
// EL SUPERVISOR CONTINUO (T-486, 06/08)
//
// Pregunta de Manuel: «¿por qué el supervisor no les da tareas continuamente? así no es
// productivo». No había ningún programador: `repartir` se corría a mano, así que la flota
// trabajaba exactamente mientras alguien la mirara. Medido ese día: w2, w3 y w4 estuvieron ~30
// min encendidos sin hacer nada tras terminar su turno.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const BUC = require('@/lib/flota/bucle.cjs')

describe('el bucle FALLA CERRADO, al revés que el resto del andamiaje', () => {
  it('sin base de datos NO reparte: repartir a ciegas duplica trabajo', () => {
    const r = BUC.puedeRepartir({ hayBd: false, hayTrabajadores: true })
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/ciegas/)
  })

  it('sin trabajadores que reciban, tampoco', () => {
    expect(BUC.puedeRepartir({ hayBd: true, hayTrabajadores: false }).ok).toBe(false)
  })

  it('con las dos cosas, adelante', () => {
    expect(BUC.puedeRepartir({ hayBd: true, hayTrabajadores: true }).ok).toBe(true)
  })
})

describe('el ritmo se adapta: no machaca cuando no hay nada que repartir', () => {
  it('si repartió, ritmo normal', () => {
    expect(BUC.siguientePausa({ repartidos: 2, cada: 600, anterior: 3000 })).toBe(600)
  })

  it('si no repartió, espacia', () => {
    const p1 = BUC.siguientePausa({ repartidos: 0, cada: 600, anterior: 600 })
    expect(p1).toBeGreaterThan(600)
    const p2 = BUC.siguientePausa({ repartidos: 0, cada: 600, anterior: p1 })
    expect(p2).toBeGreaterThan(p1)
  })

  it('pero con techo: un trabajador que se libera no espera media tarde', () => {
    let p = 600
    for (let i = 0; i < 30; i++) p = BUC.siguientePausa({ repartidos: 0, cada: 600, anterior: p })
    expect(p).toBe(BUC.CADA_MAX_S)
  })
})

describe('detecta turnos atascados — y AVISA, no mata', () => {
  const AHORA = new Date('2026-08-06T12:00:00Z')
  const haceMin = (m: number) => new Date(AHORA.getTime() - m * 60000)

  it('caza el caso real que lo calibra: w1, 2 h en el mismo git commit', () => {
    const r = BUC.turnosAtascados([{ trabajador: 'w1', inicio: haceMin(120) }], { ahora: AHORA })
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ trabajador: 'w1', minutos: 120 })
  })

  it('un turno largo pero legítimo NO salta: con tareas encadenadas se pasa de la hora', () => {
    expect(BUC.turnosAtascados([{ trabajador: 'w2', inicio: haceMin(75) }], { ahora: AHORA })).toHaveLength(0)
  })

  it('sin turno abierto no inventa nada', () => {
    expect(BUC.turnosAtascados([{ trabajador: 'w3', inicio: null }], { ahora: AHORA })).toHaveLength(0)
    expect(BUC.turnosAtascados(null as any, { ahora: AHORA })).toHaveLength(0)
  })

  it('el más atascado primero: es a quien hay que mirar', () => {
    const r = BUC.turnosAtascados(
      [{ trabajador: 'w1', inicio: haceMin(95) }, { trabajador: 'w4', inicio: haceMin(200) }],
      { ahora: AHORA })
    expect(r.map((x: any) => x.trabajador)).toEqual(['w4', 'w1'])
  })
})

describe('cada pasada deja rastro legible', () => {
  it('dice cuántos repartió y cuándo vuelve', () => {
    expect(BUC.resumenPasada({ repartidos: 3, pausaS: 600 })).toMatch(/3 encargo/)
  })

  it('un salto explica POR QUÉ no repartió (si no, parece que no había trabajo)', () => {
    const t = BUC.resumenPasada({ repartidos: 0, motivoSalto: 'sin base de datos', pausaS: 900 })
    expect(t).toMatch(/sin base de datos/)
    expect(t).not.toMatch(/0 encargo/)
  })

  it('y canta los atascados con sus minutos', () => {
    const t = BUC.resumenPasada({ repartidos: 1, atascados: [{ trabajador: 'w1', minutos: 120 }], pausaS: 600 })
    expect(t).toMatch(/w1 lleva 120 min/)
  })
})

// ── T-642 (07/08/2026): la espera crecía con la OCUPACIÓN, no con la calma ──────────────────
describe('[T-642] siguientePausa — «cero encargos» significaba dos cosas opuestas', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const BUC = require('../../lib/flota/bucle.cjs')

  it('flota LLENA: no se espacia, porque un turno acaba cuando quiere', () => {
    // El caso medido: tres trabajadores ocupados y la espera subiendo 5 → 8 → 11 → 17 → 25 min.
    // Al morir sus turnos tardaron media hora en volver. Cuanto mejor iba, más tarde se enteraba.
    expect(BUC.siguientePausa({ repartidos: 0, ocupados: 3, cada: 600, anterior: 1500 })).toBe(600)
  })

  it('nadie ocupado y nada repartido: ahí SÍ se espacia (no hay nada que hacer)', () => {
    const p1 = BUC.siguientePausa({ repartidos: 0, ocupados: 0, cada: 600, anterior: 600 })
    expect(p1).toBeGreaterThan(600)
    expect(BUC.siguientePausa({ repartidos: 0, ocupados: 0, cada: 600, anterior: p1 })).toBeGreaterThan(p1)
  })

  it('con movimiento, ritmo normal, haya quien haya ocupado', () => {
    expect(BUC.siguientePausa({ repartidos: 2, ocupados: 0, cada: 600, anterior: 3000 })).toBe(600)
    expect(BUC.siguientePausa({ repartidos: 2, ocupados: 3, cada: 600, anterior: 3000 })).toBe(600)
  })

  it('sin el dato de ocupados (versión vieja de repartir), se comporta como antes: degrada, no revienta', () => {
    expect(BUC.siguientePausa({ repartidos: 0, cada: 600, anterior: 600 })).toBeGreaterThan(600)
  })

  it('el techo sigue en pie: la calma no espacia más de una hora', () => {
    let p = 600
    for (let i = 0; i < 30; i++) p = BUC.siguientePausa({ repartidos: 0, ocupados: 0, cada: 600, anterior: p })
    expect(p).toBeLessThanOrEqual(3600)
  })
})

describe('[T-642] otroSupervisorVivo — dos repartidores no dan error, dan trabajo repetido', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const BUC = require('../../lib/flota/bucle.cjs')
  const AHORA = new Date('2026-08-07T10:00:00Z')
  const hace = (min: number) => new Date(AHORA.getTime() - min * 60000).toISOString()

  it('otra máquina con pasada reciente: NO se arranca', () => {
    // El caso real: el servicio del VPS llevaba horas repartiendo mientras se lanzaba otro
    // supervisor desde el portátil, cada uno con su reloj sobre los mismos cuatro trabajadores.
    const v = BUC.otroSupervisorVivo({ ultima: { host: 'flota-1', ts: hace(3), pausaS: 300 }, yo: 'portatil', ahora: AHORA })
    expect(v.hay).toBe(true)
    expect(v.motivo).toMatch(/flota-1/)
  })

  it('la ventana es la espera que el OTRO anunció, no un número fijo', () => {
    // Un supervisor en calma puede anunciar una hora. Con ventana fija corta se le daría por
    // muerto justo cuando está más tranquilo, y volverían a arrancar dos.
    expect(BUC.otroSupervisorVivo({ ultima: { host: 'flota-1', ts: hace(45), pausaS: 3600 }, yo: 'yo', ahora: AHORA }).hay).toBe(true)
    expect(BUC.otroSupervisorVivo({ ultima: { host: 'flota-1', ts: hace(45), pausaS: 300 }, yo: 'yo', ahora: AHORA }).hay).toBe(false)
  })

  it('si el rastro es MÍO, no me bloqueo a mí mismo al reiniciar', () => {
    expect(BUC.otroSupervisorVivo({ ultima: { host: 'flota-1', ts: hace(1), pausaS: 300 }, yo: 'flota-1', ahora: AHORA }).hay).toBe(false)
  })

  it('sin rastro (o sin host en él) no se juzga: se deja arrancar', () => {
    // Fail-open deliberado: el primer arranque tras estrenar esto no tiene ningún rastro con
    // host, y bloquear ahí dejaría la flota sin supervisor por una comprobación nueva.
    expect(BUC.otroSupervisorVivo({ ultima: null, yo: 'yo', ahora: AHORA }).hay).toBe(false)
    expect(BUC.otroSupervisorVivo({ ultima: { host: null, ts: hace(1), pausaS: 300 }, yo: 'yo', ahora: AHORA }).hay).toBe(false)
  })

  it('un rastro viejo caduca solo: lease, no lock', () => {
    // Si el otro muere, nadie tiene que limpiar nada para que el siguiente pueda arrancar.
    expect(BUC.otroSupervisorVivo({ ultima: { host: 'flota-1', ts: hace(180), pausaS: 300 }, yo: 'yo', ahora: AHORA }).hay).toBe(false)
  })
})

describe('[T-642] el supervisor que se despide SUELTA el sitio', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const BUC = require('../../lib/flota/bucle.cjs')
  const AHORA = new Date('2026-08-07T10:00:00Z')
  const hace = (min: number) => new Date(AHORA.getTime() - min * 60000).toISOString()

  it('un cierre limpio libera al instante: reiniciar tras un despliegue es el caso NORMAL', () => {
    // Medido al estrenar el guard: el supervisor del VPS se pasó 7 min negándose a arrancar por
    // el rastro de un bucle ya muerto. Bloquear al legítimo es peor que no proteger.
    const v = BUC.otroSupervisorVivo({
      ultima: { host: 'flota-1', ts: hace(1), pausaS: 300, parado: true }, yo: 'yo', ahora: AHORA,
    })
    expect(v.hay).toBe(false)
  })

  it('pero una muerte SUCIA sigue bloqueando hasta que caduque: ahí no hubo despedida', () => {
    // kill -9, máquina caída: no escribe nada, y ahí manda la ventana. Es para lo que está.
    const v = BUC.otroSupervisorVivo({
      ultima: { host: 'flota-1', ts: hace(1), pausaS: 300 }, yo: 'yo', ahora: AHORA,
    })
    expect(v.hay).toBe(true)
  })
})

describe('[T-647] muertesPorMemoria — los OOM dejan de ser invisibles', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const BUC = require('../../lib/flota/bucle.cjs')

  it('cuenta las muertes y dice a QUIÉN mataron', () => {
    // Líneas reales del 07/08 en la máquina de la flota.
    const txt = [
      'kernel: Out of memory: Killed process 905990 (claude.exe) total-vm:7637004kB, anon-rss:6614912kB',
      'kernel: Out of memory: Killed process 933101 (node) total-vm:3149764kB, anon-rss:2199292kB',
      'kernel: Out of memory: Killed process 946359 (node) total-vm:3774824kB, anon-rss:2836572kB',
    ].join('\n')
    const r = BUC.muertesPorMemoria(txt)
    expect(r.muertes).toBe(3)
    expect(r.victimas).toEqual({ 'claude.exe': 1, node: 2 })
  })

  it('sin muertes no inventa nada: una señal que se emite siempre no avisa de nada', () => {
    expect(BUC.muertesPorMemoria('').muertes).toBe(0)
    expect(BUC.muertesPorMemoria('kernel: nada que ver aquí').muertes).toBe(0)
  })

  it('tolera entrada nula sin romper el bucle', () => {
    expect(BUC.muertesPorMemoria(null).muertes).toBe(0)
    expect(BUC.muertesPorMemoria(undefined).victimas).toEqual({})
  })
})
