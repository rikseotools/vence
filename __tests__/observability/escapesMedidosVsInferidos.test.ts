/**
 * [T-702] El panel no puede mandar borrar un guardarraíl con una cifra que no puede variar.
 *
 * Dos defectos reales, los dos medidos sobre la puerta de temario el 08/08/2026:
 *   (1) `preventivos = escapes - bloqueos` da 100% FORZOSO en una puerta que no emite bloqueo
 *       cuando se la saltan — la de temario llevaba 0 bloqueos / 9 escapes en 30 días.
 *   (2) los 9 escapes eran 2 decisiones: una aplicada 7 veces en 6 minutos a impugnaciones
 *       hermanas del mismo caso.
 */
const { escapesSinBloqueo } = require('../../lib/observability/friccionSesiones.cjs')

const esc = (guard: string, sid: string, motivo?: string, evitoBloqueo?: boolean) => ({
  clase: 'guard_escape', guard, sid, motivo, evitoBloqueo,
})
const blo = (guard: string, sid: string) => ({ clase: 'guard_bloqueo', guard, sid })
const de = (r: any[], g: string) => r.find((x) => x.guard === g)

describe('[T-702] repetir una decisión no son varias decisiones', () => {
  it('siete escapes con el MISMO motivo en la misma sesión son una decisión', () => {
    const eventos = Array.from({ length: 7 }, () => esc('temario', 'w4', 'el epígrafe del Tema 2 está verified_literal'))
    const r = de(escapesSinBloqueo(eventos), 'temario')
    expect(r.escapes).toBe(7)       // el volumen no se oculta…
    expect(r.decisiones).toBe(1)    // …pero la cuenta que juzga la puerta usa la decisión
    expect(r.preventivos).toBe(1)
  })

  it('normaliza espacios y mayúsculas: la misma razón escrita distinto sigue siendo una', () => {
    const r = de(escapesSinBloqueo([
      esc('temario', 'w4', 'Mismo   motivo que las hermanas'),
      esc('temario', 'w4', 'mismo motivo que las hermanas'),
    ]), 'temario')
    expect(r.decisiones).toBe(1)
  })

  it('motivos DISTINTOS siguen contando por separado', () => {
    const r = de(escapesSinBloqueo([
      esc('temario', 'w4', 'el artículo vinculado TUE 19 no contiene la materia'),
      esc('temario', 'w4', 'el epígrafe del Tema 2 está verified_literal'),
    ]), 'temario')
    expect(r.decisiones).toBe(2)
  })

  it('sin motivo NO se agrupa: no se inventa un parecido que no consta', () => {
    const r = de(escapesSinBloqueo([esc('x', 's1'), esc('x', 's1'), esc('x', 's1')]), 'x')
    expect(r.decisiones).toBe(3)
  })

  it('sesiones distintas no se mezclan aunque coincida el motivo', () => {
    const r = de(escapesSinBloqueo([
      esc('temario', 'w1', 'mismo motivo'), esc('temario', 'w2', 'mismo motivo'),
    ]), 'temario')
    expect(r.decisiones).toBe(2)
  })
})

describe('[T-702] medido manda sobre inferido', () => {
  it('el caso que lo motivó: 0 bloqueos y escapes que SÍ evitaban algo ya no dan 100%', () => {
    const eventos = [
      esc('temario', 'w4', 'motivo A', true),
      esc('temario', 'w4', 'motivo B', true),
      esc('temario', 'w4', 'motivo C', false),
    ]
    const r = de(escapesSinBloqueo(eventos), 'temario')
    expect(r.fuente).toBe('medida')
    expect(r.preventivos).toBe(1)          // solo el que no tenía nada que rodear
    expect(r.ratioPreventivo).toBeCloseTo(0.33, 2)
  })

  it('SIN el dato medido, la resta da 100% aunque los escapes fueran legítimos — y lo confiesa', () => {
    // Exactamente lo que pasaba: la puerta no emite `guard_bloqueo` al saltársela, así que
    // `escapes - bloqueos` = escapes, pase lo que pase.
    const r = de(escapesSinBloqueo([esc('temario', 'w4', 'a'), esc('temario', 'w4', 'b')]), 'temario')
    expect(r.fuente).toBe('inferida')
    expect(r.ratioPreventivo).toBe(1)
  })

  it('una medición A MEDIAS no se cree: mezclar dos formas de contar da un número que no significa nada', () => {
    const r = de(escapesSinBloqueo([
      esc('g', 's1', 'a', false),
      esc('g', 's1', 'b'),          // sin medir
    ]), 'g')
    expect(r.fuente).toBe('inferida')
  })

  it('los bloqueos siguen descontando cuando hay que inferir', () => {
    const r = de(escapesSinBloqueo([blo('g', 's1'), esc('g', 's1', 'a'), esc('g', 's1', 'b')]), 'g')
    expect(r.decisiones).toBe(2)
    expect(r.preventivos).toBe(1)
    expect(r.fuente).toBe('inferida')
  })

  it('no cuenta negativos si hubo más bloqueos que escapes', () => {
    const r = de(escapesSinBloqueo([blo('g', 's1'), blo('g', 's1'), esc('g', 's1', 'a')]), 'g')
    expect(r.preventivos).toBe(0)
  })
})

describe('[T-702] no rompe lo que ya medía', () => {
  it('ignora eventos que no son de guardarraíl', () => {
    expect(escapesSinBloqueo([{ clase: 'deploy_espera', segundos: 10 } as any])).toEqual([])
  })
  it('aguanta entradas vacías', () => {
    expect(escapesSinBloqueo([])).toEqual([])
    expect(escapesSinBloqueo(null as any)).toEqual([])
    expect(escapesSinBloqueo([null, {}] as any)).toEqual([])
  })
  it('un guard sin escapes no sale en la lista', () => {
    expect(escapesSinBloqueo([blo('g', 's1')])).toEqual([])
  })
})

describe('[T-702] un guardarraíl sin bloqueos no se puede juzgar', () => {
  const { ratioEscape, diagnostico } = require('../../lib/observability/friccionSesiones.cjs')

  it('nueve escapes y cero bloqueos NO es "muerto": es no medible', () => {
    // El caso literal de la puerta de temario. Antes salía 🔴 «quítalo» con un 100% que el
    // denominador (bloqueos + escapes) hacía inevitable.
    const eventos = Array.from({ length: 9 }, () => esc('temario', 'w4', 'motivo'))
    const g = ratioEscape(eventos).find((x: any) => x.guard === 'temario')
    expect(g.veredicto).toBe('no_medible')
    expect(diagnostico(g)).toMatch(/no se puede juzgar/i)
    expect(diagnostico(g)).not.toMatch(/quítalo/i)
  })

  it('con UN solo bloqueo ya vuelve a juzgarse como siempre', () => {
    const eventos = [blo('g', 's1'), ...Array.from({ length: 9 }, () => esc('g', 's1', 'm'))]
    const g = ratioEscape(eventos).find((x: any) => x.guard === 'g')
    expect(g.veredicto).toBe('muerto')
  })

  it('no se cuela por delante del umbral de datos: pocos eventos siguen siendo sin_datos', () => {
    const g = ratioEscape([esc('g', 's1', 'm')]).find((x: any) => x.guard === 'g')
    expect(g.veredicto).toBe('sin_datos')
  })

  it('un guardarraíl sano no cambia de veredicto', () => {
    const eventos = [...Array.from({ length: 9 }, () => blo('g', 's1')), esc('g', 's1', 'm')]
    const g = ratioEscape(eventos).find((x: any) => x.guard === 'g')
    expect(g.veredicto).toBe('sano')
  })
})
