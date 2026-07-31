/**
 * @jest-environment node
 */
// Fricción entre sesiones (T-423).
//
// Lo que se fija aquí es el criterio que importa: **no cuántas veces bloquea un guardarraíl —eso
// solo dice que trabaja— sino cuántas veces lo RODEAN**. Ese ratio es un indicador ADELANTADO: se
// ve subir antes de que el guardarraíl deje de servir. El 31/07 murieron tres exactamente así y
// los tres se descubrieron por casualidad.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ratioEscape, diagnostico, esperaDeploy, esClase, CLASES } = require('@/lib/observability/friccionSesiones.cjs')

const ev = (clase: string, guard: string, n = 1) => Array.from({ length: n }, () => ({ clase, guard }))

describe('el catálogo es cerrado (uno abierto acaba en texto libre sin agregar)', () => {
  it('acepta lo declarado y rechaza lo demás', () => {
    expect(esClase('guard_escape')).toBe(true)
    expect(esClase('cualquier_cosa')).toBe(false)
    expect(Object.keys(CLASES)).toContain('indice_compartido')
  })
})

describe('ratioEscape — ¿el guardarraíl sigue vivo?', () => {
  it('rodeado casi siempre → MUERTO: ya no protege, es un peaje', () => {
    const [g] = ratioEscape([...ev('guard_bloqueo', 'x', 1), ...ev('guard_escape', 'x', 5)])
    expect(g.veredicto).toBe('muerto')
    expect(g.ratio).toBeCloseTo(0.83, 1)
  })

  it('rodeado a menudo pero no siempre → EROSIÓN: falta contemplar un caso legítimo', () => {
    expect(ratioEscape([...ev('guard_bloqueo', 'x', 6), ...ev('guard_escape', 'x', 3)])[0].veredicto).toBe('erosion')
  })

  it('rodeado poco → SANO: el escape hace de válvula, que es su función', () => {
    expect(ratioEscape([...ev('guard_bloqueo', 'x', 9), ...ev('guard_escape', 'x', 1)])[0].veredicto).toBe('sano')
  })

  // Declarar muerto un guardarraíl por 1 escape de 1 bloqueo sería el mismo error que este
  // módulo existe para cazar: concluir de un dato que no sostiene la conclusión.
  it('con pocos datos NO opina', () => {
    expect(ratioEscape([...ev('guard_bloqueo', 'x', 1), ...ev('guard_escape', 'x', 1)])[0].veredicto).toBe('sin_datos')
  })

  it('separa por guardarraíl (uno puede estar sano y otro muriéndose)', () => {
    const r = ratioEscape([
      ...ev('guard_bloqueo', 'sano', 9), ...ev('guard_escape', 'sano', 1),
      ...ev('guard_bloqueo', 'malo', 1), ...ev('guard_escape', 'malo', 5),
    ])
    expect(r[0].guard).toBe('malo')          // ordena por ratio: lo peor primero
    expect(r.find((g: any) => g.guard === 'sano').veredicto).toBe('sano')
  })

  it('ignora las clases que no son de guardarraíl y la basura', () => {
    expect(ratioEscape([...ev('deploy_espera', 'x', 5), null, { clase: 'guard_escape' }])).toEqual([])
    expect(ratioEscape(null)).toEqual([])
  })
})

describe('el diagnóstico dice QUÉ HACER, no solo qué pasa', () => {
  it('un guardarraíl muerto propone arreglarlo o quitarlo', () => {
    const [g] = ratioEscape([...ev('guard_bloqueo', 'x', 1), ...ev('guard_escape', 'x', 5)])
    expect(diagnostico(g)).toMatch(/arregla el criterio o quítalo/)
  })
  it('uno erosionado manda buscar el caso legítimo que no contempla', () => {
    const [g] = ratioEscape([...ev('guard_bloqueo', 'x', 6), ...ev('guard_escape', 'x', 3)])
    expect(diagnostico(g)).toMatch(/caso legítimo no contempla/)
  })
})

describe('esperaDeploy — tiempo de sesión tirado esperando el lock', () => {
  it('suma solo las esperas reales', () => {
    const r = esperaDeploy([
      { clase: 'deploy_espera', segundos: 600 },
      { clase: 'deploy_espera', segundos: 300 },
      { clase: 'deploy_espera', segundos: 0 },
      { clase: 'guard_bloqueo', segundos: 999 },
    ])
    expect(r).toEqual({ veces: 2, segundos: 900, minutos: 15 })
  })
  it('sin esperas, cero (y no revienta)', () => {
    expect(esperaDeploy([]).veces).toBe(0)
    expect(esperaDeploy(null).minutos).toBe(0)
  })
})
