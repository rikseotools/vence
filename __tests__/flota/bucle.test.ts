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
