/**
 * @jest-environment node
 */
// Esfuerzo declarado en cajones + contraste con lo que costó de verdad (T-414).
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  CAJONES, esValido, pesoEsfuerzo, ordenarPorPrioridadYEsfuerzo, contrastar, formatearDuracion,
} = require('@/lib/backlog/esfuerzo.cjs')

const RANK: Record<string, number> = { critica: 0, alta: 1, media: 2, baja: 3, ninguna: 9 }
const peso = (p: string) => RANK[p] ?? 9

describe('los cajones', () => {
  it('van de menos a más coste, y ese orden ES la funcionalidad', () => {
    expect(CAJONES).toEqual(['minutos', 'rato', 'larga', 'sesion_propia'])
  })
  it('rechaza lo que no es un cajón (nada de horas sueltas)', () => {
    expect(esValido('2h')).toBe(false)
    expect(esValido('')).toBe(false)
    expect(esValido('minutos')).toBe(true)
  })
})

describe('orden de ataque: importante primero, y a igualdad lo más CORTO', () => {
  it('la prioridad manda sobre el esfuerzo', () => {
    const out = ordenarPorPrioridadYEsfuerzo([
      { id: 'T-002', priority: 'baja', effort: 'minutos' },
      { id: 'T-001', priority: 'critica', effort: 'sesion_propia' },
    ], peso)
    expect(out.map((t: any) => t.id)).toEqual(['T-001', 'T-002'])
  })

  it('a igual prioridad, lo corto primero (la preferencia de Manuel)', () => {
    const out = ordenarPorPrioridadYEsfuerzo([
      { id: 'T-001', priority: 'alta', effort: 'sesion_propia' },
      { id: 'T-002', priority: 'alta', effort: 'minutos' },
      { id: 'T-003', priority: 'alta', effort: 'larga' },
    ], peso)
    expect(out.map((t: any) => t.id)).toEqual(['T-002', 'T-003', 'T-001'])
  })

  // Lo importante del caso: NO promocionar lo desconocido. Si el hueco se ordenara como "corto",
  // la cabeza de la lista se llenaría de tareas que nadie ha mirado y que no se cierran en un rato
  // — o sea, el campo empeoraría exactamente lo que viene a mejorar.
  it('lo NO declarado va al FINAL de su prioridad, nunca al principio', () => {
    const out = ordenarPorPrioridadYEsfuerzo([
      { id: 'T-001', priority: 'alta', effort: null },
      { id: 'T-002', priority: 'alta', effort: 'sesion_propia' },
    ], peso)
    expect(out.map((t: any) => t.id)).toEqual(['T-002', 'T-001'])
    expect(pesoEsfuerzo(undefined)).toBeGreaterThan(pesoEsfuerzo('sesion_propia'))
  })

  it('con todo igual, ordena por id (determinista con varias sesiones leyendo)', () => {
    const out = ordenarPorPrioridadYEsfuerzo([
      { id: 'T-009', priority: 'media', effort: 'rato' },
      { id: 'T-002', priority: 'media', effort: 'rato' },
    ], peso)
    expect(out.map((t: any) => t.id)).toEqual(['T-002', 'T-009'])
  })
})

// La razón de ser del campo: sin poder desmentirlo, una estimación se rellena a ojo y muere.
describe('contrastar lo declarado con lo que costó', () => {
  const h = (n: number) => n * 3600

  it('declaraste «rato» y fueron 90 min → ajustado', () => {
    expect(contrastar({ effort: 'rato', workedSeconds: h(1.5) }).veredicto).toBe('acertada')
  })

  it('declaraste «rato» y fueron 6 h → se PASÓ (y eso es lo que sirve para calibrar)', () => {
    const c = contrastar({ effort: 'rato', workedSeconds: h(6) })
    expect(c.veredicto).toBe('pasada')
    expect(c.techo).toBe(2)
  })

  it('declaraste «sesión propia» y fueron 20 min → salió corta', () => {
    expect(contrastar({ effort: 'sesion_propia', workedSeconds: h(0.33) }).veredicto).toBe('corta')
  })

  // «No sé» tiene que poder decirse, igual que en el resto del andamiaje: inventar un veredicto
  // sobre cuatro minutos de reloj sería ruido que acabaría con la credibilidad del contraste.
  it('sin esfuerzo declarado NO opina', () => {
    expect(contrastar({ effort: null, workedSeconds: h(3) }).veredicto).toBe('sin_datos')
  })
  it('con apenas tiempo trabajado tampoco opina', () => {
    expect(contrastar({ effort: 'larga', workedSeconds: 60 }).veredicto).toBe('sin_datos')
  })
  it('tolera que no le pasen nada', () => {
    expect(contrastar().veredicto).toBe('sin_datos')
  })
})

describe('formatearDuracion — que nadie tenga que dividir entre 3600', () => {
  it.each([[45, '45s'], [600, '10m'], [3600, '1h 0m'], [11520, '3h 12m']])('%s s → %s', (s, txt) => {
    expect(formatearDuracion(s)).toBe(txt)
  })
  it('la basura no revienta', () => {
    expect(formatearDuracion(null)).toBe('0s')
    expect(formatearDuracion(-5)).toBe('0s')
  })
})
